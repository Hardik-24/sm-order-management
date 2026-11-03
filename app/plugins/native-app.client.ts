export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const capacitor = (window as any).Capacitor
  if (!capacitor?.isNativePlatform?.()) {
    return
  }

  const Plugins = capacitor.Plugins || {}
  const StatusBar = Plugins.StatusBar
  const SplashScreen = Plugins.SplashScreen
  const App = Plugins.App

  // 1. Native Status Bar Styling
  if (StatusBar) {
    try {
      StatusBar.setStyle({ style: 'DARK' })
      StatusBar.setBackgroundColor({ color: '#1c1c1c' })
      StatusBar.setOverlaysWebView({ overlay: false })
    } catch (e) {
      console.warn('StatusBar configuration skipped:', e)
    }
  }

  // 2. Hide Native Splash Screen cleanly after Nuxt has hydrated
  if (SplashScreen) {
    try {
      setTimeout(() => {
        SplashScreen.hide()
      }, 500)
    } catch (e) {
      console.warn('SplashScreen hide skipped:', e)
    }
  }

  // 3. Android Hardware Back Button Navigation Handler
  if (App) {
    let lastBackPress = 0
    const router = useRouter()
    const route = useRoute()
    const { showEditing } = useSnackbar()

    /**
     * Resolves and dismisses the top-most active modal, slide-over drawer, or dialog.
     * Returns true if a modal was found and dismissed.
     */
    function tryCloseTopmostModal(): boolean {
      // 1. Direct search for explicitly tagged close buttons
      const explicitCloseButtons = Array.from(
        document.querySelectorAll<HTMLElement>('[data-modal-close="true"], [data-modal-close], .modal-close-btn')
      ).filter(btn => {
        const rect = btn.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })

      if (explicitCloseButtons.length > 0) {
        // Click the last one rendered in DOM (top-most in visual stacking order)
        const topBtn = explicitCloseButtons[explicitCloseButtons.length - 1]
        topBtn.click()
        return true
      }

      // 2. Scan all visible full-screen overlays, slide-overs, and modal containers
      const overlays = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-modal-container], [role="dialog"], [aria-modal="true"], div.fixed.inset-0, div.fixed.inset-x-0'
        )
      ).filter(el => {
        if (el.id === '__nuxt' || el.id === 'app' || el.tagName === 'BODY') return false
        if (el.closest('.network-status-banner') || el.classList.contains('pointer-events-none')) return false
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })

      if (overlays.length > 0) {
        // Sort by z-index descending to ensure top-most layered modal closes first
        overlays.sort((a, b) => {
          const zA = parseInt(window.getComputedStyle(a).zIndex) || 0
          const zB = parseInt(window.getComputedStyle(b).zIndex) || 0
          return zB - zA
        })

        const topOverlay = overlays[0]

        // Find candidate close button inside topOverlay
        const candidateBtn = topOverlay.querySelector<HTMLElement>(
          'button[title*="close" i], button[title*="cancel" i], button[aria-label*="close" i], button[aria-label*="cancel" i]'
        ) || Array.from(topOverlay.querySelectorAll<HTMLElement>('button')).find(btn => {
          if (btn.querySelector('svg.lucide-x, svg[data-lucide="x"]')) return true
          const svg = btn.querySelector('svg')
          if (svg && (svg.innerHTML.includes('18 6 6 18') || svg.innerHTML.includes('M18 6'))) return true
          const text = (btn.textContent || '').trim().toLowerCase()
          return text === 'close' || text === 'cancel' || text === 'dismiss' || text === 'go back'
        })

        if (candidateBtn) {
          candidateBtn.click()
          return true
        }

        // Fallback: backdrop click inside topOverlay
        const backdrop = topOverlay.querySelector<HTMLElement>(
          '[data-modal-backdrop], .modal-backdrop, [class*="bg-black"], [class*="backdrop-blur"]'
        )
        if (backdrop && typeof backdrop.click === 'function') {
          backdrop.click()
          return true
        }
      }

      return false
    }

    App.addListener('backButton', () => {
      // Priority 1: Close mobile navigation drawer if expanded
      const mobileMenuState = useState<boolean>('mobileMenuOpen')
      if (mobileMenuState.value) {
        mobileMenuState.value = false
        return
      }

      // Priority 2: Dismiss top-most active modal, drawer, or dialog
      if (tryCloseTopmostModal()) {
        return
      }

      // Priority 3: Close open custom select dropdowns or popovers
      const openDropdown = document.querySelector<HTMLElement>('.custom-select-options, [data-popover-open="true"]')
      if (openDropdown) {
        document.body.click()
        return
      }

      // Priority 4: Navigate backwards in Vue Router if not on primary home / login
      if (route.path !== '/dashboard' && route.path !== '/login') {
        if (window.history.length > 1 && window.history.state?.back) {
          router.back()
        } else {
          router.push('/dashboard')
        }
        return
      }

      // Priority 5: Double-tap back within 2 seconds to exit app (only on root /dashboard or /login)
      const now = Date.now()
      if (now - lastBackPress < 2000) {
        App.exitApp()
      } else {
        lastBackPress = now
        showEditing('Press back again to exit')
      }
    })

    // 4. Mobile App Foreground Session & Hardware Authorization Verification
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        try {
          const { fetchUser } = useAuth()
          await fetchUser()
        } catch {}
      }
    })
  }
})
