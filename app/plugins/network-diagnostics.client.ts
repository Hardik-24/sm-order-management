export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const { reportRequestStart, reportRequestEnd, runDiagnostics, initGlobalListeners } = useNetworkDiagnostics()

  // Initialize online / offline browser window listeners
  initGlobalListeners()

  // Global fetch interceptor to monitor EVERY page, table, and data query across the app
  const originalFetch = window.fetch
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || ''
    
    // Ignore internal diagnostic probes to prevent recursion
    const isDiagnostic = 
      url.includes('/api/health') || 
      url.includes('generate_204') || 
      url.includes('1.1.1.1') ||
      url.includes('cdn-cgi/trace')

    if (!isDiagnostic) {
      reportRequestStart()
    }

    try {
      const response = await originalFetch.apply(this, args)
      
      // If server returned 502 Bad Gateway, 503 Service Unavailable, or 504 Gateway Timeout
      if (!isDiagnostic && [502, 503, 504].includes(response.status)) {
        runDiagnostics()
      }

      return response
    } catch (err: any) {
      if (!isDiagnostic) {
        // Network drop or connection refused
        runDiagnostics()
      }
      throw err
    } finally {
      if (!isDiagnostic) {
        reportRequestEnd()
      }
    }
  }
})
