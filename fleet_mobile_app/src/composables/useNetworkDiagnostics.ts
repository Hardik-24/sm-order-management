import { ref } from 'vue'

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
let isInitialized = false

const API_URL = 'https://sm-order-management.vercel.app'

export function useNetworkDiagnostics() {
  const probePublicInternet = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true
    if (!navigator.onLine) return false

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2200)

    try {
      await fetch(`https://www.google.com/generate_204?t=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)
      return true
    } catch {
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

  const probeAppServer = async (): Promise<{ serverOk: boolean; dbOk: boolean }> => {
    if (typeof window === 'undefined') return { serverOk: true, dbOk: true }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    try {
      const res = await fetch(`${API_URL}/api/health?t=${Date.now()}`, {
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
      try {
        const edgeCtrl = new AbortController()
        const edgeTimeout = setTimeout(() => edgeCtrl.abort(), 2000)
        const edgeRes = await fetch(`${API_URL}/api/health?quick=1&t=${Date.now()}`, {
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

  const runDiagnostics = async () => {
    if (typeof window === 'undefined') return

    if (!navigator.onLine) {
      currentStatus.value = 'OFFLINE'
      diagnosticDetails.value = 'Phone is offline. Please check your cellular data or WiFi.'
      return
    }

    const [isInternetReachable, serverHealth] = await Promise.all([
      probePublicInternet(),
      probeAppServer()
    ])

    if (!isInternetReachable) {
      currentStatus.value = 'CLIENT_SLOW'
      diagnosticDetails.value = 'Weak mobile network connection detected on your device.'
    } else if (!serverHealth.serverOk) {
      currentStatus.value = 'SERVER_ERROR'
      diagnosticDetails.value = 'Cloud server is temporarily unreachable. Retrying...'
    } else if (!serverHealth.dbOk) {
      currentStatus.value = 'SERVER_SLOW'
      diagnosticDetails.value = 'Mobile internet is working. Cloud server (Supabase) is responding slowly...'
    } else {
      if (activeRequestCount.value === 0 && currentStatus.value !== 'IDLE') {
        clearStatus()
      }
    }
  }

  const reportRequestStart = () => {
    activeRequestCount.value++
    if (!longRequestTimer) {
      longRequestTimer = setTimeout(() => {
        if (activeRequestCount.value > 0) {
          runDiagnostics()
        }
      }, 2500)
    }
  }

  const reportRequestEnd = () => {
    activeRequestCount.value = Math.max(0, activeRequestCount.value - 1)
    if (activeRequestCount.value === 0) {
      if (longRequestTimer) {
        clearTimeout(longRequestTimer)
        longRequestTimer = null
      }
      if (['CLIENT_SLOW', 'SERVER_SLOW'].includes(currentStatus.value)) {
        clearStatus()
      }
    }
  }

  const clearStatus = (delayed = true) => {
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
      diagnosticDetails.value = 'Phone is offline. Check your cellular signal or WiFi.'
    })

    window.addEventListener('online', async () => {
      currentStatus.value = 'RECONNECTED'
      diagnosticDetails.value = 'Signal restored! Back online.'
      if (reconnectedTimer) clearTimeout(reconnectedTimer)
      reconnectedTimer = setTimeout(() => {
        if (currentStatus.value === 'RECONNECTED') {
          clearStatus(false)
        }
      }, 2500)
      await runDiagnostics()
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
