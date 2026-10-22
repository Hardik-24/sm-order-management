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

    App.addListener('backButton', () => {
      // Priority 1: Close mobile menu if expanded
      const mobileMenuState = useState<boolean>('mobileMenuOpen')
      if (mobileMenuState.value) {
        mobileMenuState.value = false
        return
      }

      // Priority 2: Dismiss any open dialog/modal with close button
      const openModalBtn = document.querySelector<HTMLElement>('[data-modal-close], button[title="Close"], .modal-close-btn')
      if (openModalBtn) {
        openModalBtn.click()
        return
      }

      // Priority 3: Navigate backwards in Vue Router if not on primary root
      if (route.path !== '/dashboard' && route.path !== '/login' && window.history.length > 1) {
        router.back()
        return
      }

      // Priority 4: Double-tap back within 2 seconds to exit app
      const now = Date.now()
      if (now - lastBackPress < 2000) {
        App.exitApp()
      } else {
        lastBackPress = now
        showEditing('Press back again to exit')
      }
    })
  }
})
