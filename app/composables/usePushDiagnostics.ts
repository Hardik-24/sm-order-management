import { ref, reactive } from 'vue'

export interface PushDiagnosticsState {
  isCapacitorPresent: boolean
  isNativePlatform: boolean
  isOMSApp: boolean
  isPushPluginAvailable: boolean
  permission: string
  token: string | null
  backendStatus: string
  lastError: string | null
  isRunning: boolean
}

export function usePushDiagnostics() {
  const logs = ref<Array<{ time: string; level: 'info' | 'warn' | 'error' | 'success'; text: string }>>([])
  
  const state = reactive<PushDiagnosticsState>({
    isCapacitorPresent: false,
    isNativePlatform: false,
    isOMSApp: false,
    isPushPluginAvailable: false,
    permission: 'unknown',
    token: null,
    backendStatus: 'not_started',
    lastError: null,
    isRunning: false
  })

  const addLog = (text: string, level: 'info' | 'warn' | 'error' | 'success' = 'info', data?: any) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    logs.value.unshift({ time, level, text })
    if (logs.value.length > 50) logs.value.pop()

    // Also send to server debug logger asynchronously
    try {
      $fetch('/api/notifications/debug-log', {
        method: 'POST',
        body: { level, message: text, data }
      }).catch(() => {})
    } catch {}
  }

  // Poll for window.Capacitor with a timeout
  const waitForCapacitor = async (timeoutMs = 3000): Promise<any> => {
    if (typeof window === 'undefined') return null
    if ((window as any).Capacitor) return (window as any).Capacitor

    return new Promise((resolve) => {
      const start = Date.now()
      const interval = setInterval(() => {
        if ((window as any).Capacitor) {
          clearInterval(interval)
          resolve((window as any).Capacitor)
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval)
          resolve(null)
        }
      }, 100)
    })
  }

  // Run initial diagnostic check
  const checkStatus = async () => {
    if (typeof window === 'undefined') return

    state.token = localStorage.getItem('sm_flow_fcm_token') || null
    const ua = navigator.userAgent || ''
    state.isOMSApp = ua.includes('SiliconOMSApp') || (window as any).isSiliconOMSApp === true || /; wv\)/.test(ua)

    const cap = await waitForCapacitor(1500)
    state.isCapacitorPresent = Boolean(cap)
    state.isNativePlatform = Boolean(cap?.isNativePlatform?.())

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      state.isPushPluginAvailable = Boolean(PushNotifications)
      if (PushNotifications) {
        const perm = await PushNotifications.checkPermissions()
        state.permission = perm.receive || 'unknown'
      }
    } catch (e: any) {
      state.lastError = e?.message || String(e)
    }
  }

  // Request permissions, register with FCM, and sync with server
  const registerPush = async () => {
    state.isRunning = true
    state.lastError = null
    addLog('Starting Push Notification Registration...', 'info')

    try {
      const cap = await waitForCapacitor(2500)
      if (!cap) {
        const msg = 'Capacitor native bridge not found. Are you running inside the APK?'
        state.lastError = msg
        addLog(msg, 'error')
        state.isRunning = false
        return false
      }

      const { PushNotifications } = await import('@capacitor/push-notifications')
      if (!PushNotifications) {
        const msg = '@capacitor/push-notifications plugin module failed to load.'
        state.lastError = msg
        addLog(msg, 'error')
        state.isRunning = false
        return false
      }

      // 1. Create channel
      try {
        try {
          await PushNotifications.deleteChannel({ id: 'sm_flow_notifications' })
        } catch {}

        await PushNotifications.createChannel({
          id: 'sm_flow_alerts_v2',
          name: 'SM Flow Alerts',
          description: 'Instant alerts with sound and vibration for orders and quotations',
          importance: 5,
          visibility: 1,
          vibration: true
        })
        addLog('Notification channel configured (Importance: High, Sound & Vibrate enabled)', 'info')
      } catch (e: any) {
        addLog(`Channel creation notice: ${e?.message || e}`, 'warn')
      }

      // 2. Set up listeners first
      PushNotifications.removeAllListeners().catch(() => {})

      PushNotifications.addListener('registration', async (token) => {
        addLog(`FCM Token generated: ${token.value.slice(0, 15)}...`, 'success', { token: token.value })
        state.token = token.value
        localStorage.setItem('sm_flow_fcm_token', token.value)

        // Sync with backend
        try {
          state.backendStatus = 'syncing'
          let deviceId: string | undefined
          try {
            const { detectDevice } = useDeviceSecurity()
            const dev = await detectDevice()
            deviceId = dev?.id
          } catch {}

          const res = await $fetch<any>('/api/notifications/register-token', {
            method: 'POST',
            body: { token: token.value, deviceId }
          })

          if (res?.success) {
            state.backendStatus = 'registered'
            addLog('Token successfully registered and subscribed on server!', 'success')
          } else {
            state.backendStatus = 'failed'
            addLog(`Server registration returned: ${res?.error || 'Unknown error'}`, 'error')
          }
        } catch (err: any) {
          state.backendStatus = 'failed'
          addLog(`Failed to post token to backend: ${err?.message || err}`, 'error')
        }
      })

      PushNotifications.addListener('registrationError', (error) => {
        state.lastError = error?.error || JSON.stringify(error)
        addLog(`Registration Error from Android: ${state.lastError}`, 'error', error)
      })

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        addLog(`Push received in foreground: ${notification.title}`, 'info', notification)
      })

      // 3. Request permissions
      addLog('Checking notification permissions...', 'info')
      let perm = await PushNotifications.checkPermissions()
      addLog(`Current permission status: ${perm.receive}`, 'info')

      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        addLog('Requesting system permission dialog...', 'info')
        perm = await PushNotifications.requestPermissions()
        addLog(`Permission dialog result: ${perm.receive}`, 'info')
      }

      state.permission = perm.receive

      if (perm.receive !== 'granted') {
        const msg = `Permission not granted (${perm.receive}). Please enable in Android Settings > Apps > SM Flow > Notifications.`
        state.lastError = msg
        addLog(msg, 'warn')
        state.isRunning = false
        return false
      }

      // 4. Register with Apple/Google APNS/FCM
      addLog('Calling PushNotifications.register()...', 'info')
      await PushNotifications.register()
      addLog('PushNotifications.register() executed. Waiting for token...', 'info')

      state.isRunning = false
      return true
    } catch (err: any) {
      state.lastError = err?.message || String(err)
      addLog(`Exception during registration: ${state.lastError}`, 'error', err)
      state.isRunning = false
      return false
    }
  }

  // Trigger test push
  const sendTestPush = async () => {
    addLog('Dispatching test push notification...', 'info')
    try {
      const res = await $fetch<any>('/api/notifications/test', {
        method: 'POST',
        body: {
          title: 'SM Flow Diagnostics 🔔',
          body: `Test notification at ${new Date().toLocaleTimeString()}`,
          token: state.token || undefined,
          topic: 'quotations'
        }
      })

      if (res?.success) {
        addLog('Server reported test notification sent successfully!', 'success')
      } else {
        addLog(`Server test push failed: ${res?.message || 'Check logs'}`, 'error')
      }
    } catch (err: any) {
      addLog(`Test push API error: ${err?.message || err}`, 'error')
    }
  }

  return {
    state,
    logs,
    checkStatus,
    registerPush,
    sendTestPush,
    addLog
  }
}
