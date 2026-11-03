import { ref, onMounted, onUnmounted } from 'vue'

export type DiagnosticStatus = 
  | 'IDLE' 
  | 'OFFLINE' 
  | 'CLIENT_SLOW' 
  | 'SERVER_SLOW' 
  | 'SERVER_ERROR' 
  | 'RECONNECTED'

const currentStatus = ref<DiagnosticStatus>('IDLE')
const diagnosticDetails = ref<string>('')
const activeRequestCount = ref<number>(0)
let longRequestTimer: any = null
let reconnectedTimer: any = null
let recoveryPollingTimer: any = null
let isProbingRecovery = false
let isInitialized = false

export function useNetworkDiagnostics() {
  /**
   * Transition to green RECONNECTED banner and schedule automatic dismissal
   */
  const triggerReconnected = (message = 'Connection restored! Back online.') => {
    stopRecoveryPolling()
    currentStatus.value = 'RECONNECTED'
    diagnosticDetails.value = message

    if (reconnectedTimer) {
      clearTimeout(reconnectedTimer)
    }
    reconnectedTimer = setTimeout(() => {
      if (currentStatus.value === 'RECONNECTED') {
        clearStatus(false)
      }
    }, 2500)
  }

  /**
   * Stop background auto-recovery heartbeat polling
   */
  const stopRecoveryPolling = () => {
    if (recoveryPollingTimer) {
      clearInterval(recoveryPollingTimer)
      recoveryPollingTimer = null
    }
    isProbingRecovery = false
  }

  /**
   * Background auto-recovery polling: pings server every 3.5s while an error is visible
   */
  const startRecoveryPolling = () => {
    if (typeof window === 'undefined' || recoveryPollingTimer) return

    recoveryPollingTimer = setInterval(async () => {
      if (!['SERVER_ERROR', 'OFFLINE', 'SERVER_SLOW', 'CLIENT_SLOW'].includes(currentStatus.value)) {
        stopRecoveryPolling()
        return
      }

      if (isProbingRecovery) return
      isProbingRecovery = true

      try {
        if (!navigator.onLine) {
          return
        }

        const health = await probeAppServer()
        if (health.serverOk) {
          const msg = currentStatus.value === 'SERVER_ERROR'
            ? 'Server connection restored! All systems operational.'
            : 'Connection restored! Back online.'
          triggerReconnected(msg)
        }
      } catch {
        // Server still unreachable, continue polling
      } finally {
        isProbingRecovery = false
      }
    }, 3500)
  }

  /**
   * Probe public internet reachability (tests user's local connection)
   * Uses Google 204 / Cloudflare with a strict 2.2-second timeout
   */
  const probePublicInternet = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true
    if (!navigator.onLine) return false

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2200)

    try {
      // mode: 'no-cors' allows opaque reachability check to any public endpoint without CORS blocking
      await fetch(`https://www.google.com/generate_204?t=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)
      return true
    } catch {
      // Fallback check to Cloudflare trace
      try {
        const cfController = new AbortController()
        const cfTimeout = setTimeout(() => cfController.abort(), 2000)
        await fetch(`https://1.1.1.1/cdn-cgi/trace?t=${Date.now()}`, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: cfController.signal
        })
        clearTimeout(cfTimeout)
        return true
      } catch {
        return false
      }
    }
  }

  /**
   * Probe application server and Supabase database availability
   */
  const probeAppServer = async (): Promise<{ serverOk: boolean; dbOk: boolean }> => {
    if (typeof window === 'undefined') return { serverOk: true, dbOk: true }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    try {
      const res = await fetch(`/api/health?t=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)
      const data = await res.json().catch(() => ({}))
      return {
        serverOk: res.ok,
        dbOk: data?.status === 'ok'
      }
    } catch {
      // Test quick edge probe without DB
      try {
        const edgeCtrl = new AbortController()
        const edgeTimeout = setTimeout(() => edgeCtrl.abort(), 2000)
        const edgeRes = await fetch(`/api/health?quick=1&t=${Date.now()}`, {
          cache: 'no-store',
          signal: edgeCtrl.signal
        })
        clearTimeout(edgeTimeout)
        return { serverOk: edgeRes.ok, dbOk: false }
      } catch {
        return { serverOk: false, dbOk: false }
      }
    }
  }

  /**
   * Run full diagnostics and determine if the delay is Client or Server
   */
  const runDiagnostics = async () => {
    if (typeof window === 'undefined') return

    // 1. Check physical device network
    if (!navigator.onLine) {
      currentStatus.value = 'OFFLINE'
      diagnosticDetails.value = 'Your device is offline. Check your WiFi or mobile data.'
      startRecoveryPolling()
      return
    }

    // 2. Parallel probe: public internet vs cloud backend
    const [isInternetReachable, serverHealth] = await Promise.all([
      probePublicInternet(),
      probeAppServer()
    ])

    if (!isInternetReachable) {
      currentStatus.value = 'CLIENT_SLOW'
      diagnosticDetails.value = 'Slow or unstable internet connection detected on your device.'
      startRecoveryPolling()
    } else if (!serverHealth.serverOk) {
      currentStatus.value = 'SERVER_ERROR'
      diagnosticDetails.value = 'Cloud server is temporarily unreachable. Auto-reconnecting...'
      startRecoveryPolling()
    } else if (!serverHealth.dbOk) {
      currentStatus.value = 'SERVER_SLOW'
      diagnosticDetails.value = 'Your internet is fine. Cloud database (Supabase) is responding slowly...'
      startRecoveryPolling()
    } else {
      // Both are ok!
      if (['SERVER_ERROR', 'OFFLINE', 'SERVER_SLOW', 'CLIENT_SLOW'].includes(currentStatus.value)) {
        triggerReconnected('Server connection restored! All systems operational.')
      } else if (activeRequestCount.value === 0 && currentStatus.value !== 'IDLE') {
        clearStatus()
      }
    }
  }

  /**
   * Called when an asynchronous data request or route navigation starts
   */
  const reportRequestStart = () => {
    activeRequestCount.value++
    if (!longRequestTimer) {
      // If a request takes more than 2.5 seconds, start diagnostics
      longRequestTimer = setTimeout(() => {
        if (activeRequestCount.value > 0) {
          runDiagnostics()
        }
      }, 2500)
    }
  }

  /**
   * Called when the request completes
   */
  const reportRequestEnd = () => {
    activeRequestCount.value = Math.max(0, activeRequestCount.value - 1)
    if (activeRequestCount.value === 0) {
      if (longRequestTimer) {
        clearTimeout(longRequestTimer)
        longRequestTimer = null
      }
      // If we were showing a warning, transition gracefully back to IDLE
      if (['CLIENT_SLOW', 'SERVER_SLOW'].includes(currentStatus.value)) {
        clearStatus()
      }
    }
  }

  const clearStatus = (delayed = true) => {
    stopRecoveryPolling()
    if (delayed) {
      setTimeout(() => {
        if (activeRequestCount.value === 0 && navigator.onLine) {
          currentStatus.value = 'IDLE'
          diagnosticDetails.value = ''
        }
      }, 800)
    } else {
      currentStatus.value = 'IDLE'
      diagnosticDetails.value = ''
    }
  }

  const initGlobalListeners = () => {
    if (typeof window === 'undefined' || isInitialized) return
    isInitialized = true

    window.addEventListener('offline', () => {
      currentStatus.value = 'OFFLINE'
      diagnosticDetails.value = 'You are offline. Please check your network connection.'
      startRecoveryPolling()
    })

    window.addEventListener('online', async () => {
      triggerReconnected('Network connection restored!')
      // Re-run diagnostics to confirm backend connectivity
      await runDiagnostics()
    })

    // Instant probe when returning to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ['SERVER_ERROR', 'OFFLINE', 'SERVER_SLOW', 'CLIENT_SLOW'].includes(currentStatus.value)) {
        runDiagnostics()
      }
    })
  }

  return {
    currentStatus,
    diagnosticDetails,
    activeRequestCount,
    runDiagnostics,
    reportRequestStart,
    reportRequestEnd,
    clearStatus,
    initGlobalListeners
  }
}
