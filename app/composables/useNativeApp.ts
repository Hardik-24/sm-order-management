import { ref } from 'vue'

export function useNativeApp() {
  const isNative = ref(false)
  const isOnline = ref(true)

  if (typeof window !== 'undefined') {
    isNative.value = Boolean((window as any).Capacitor?.isNativePlatform?.())
    isOnline.value = navigator.onLine
  }

  // Trigger subtle native tactile haptics on user actions
  const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (typeof window === 'undefined') return
    try {
      const Haptics = (window as any).Capacitor?.Plugins?.Haptics
      if (Haptics) {
        await Haptics.impact({ style: style.toUpperCase() })
      } else if ('vibrate' in navigator) {
        navigator.vibrate(style === 'light' ? 12 : style === 'medium' ? 25 : 45)
      }
    } catch (e) {}
  }

  // Trigger success vibration pattern (e.g. quote generated, bill saved)
  const triggerSuccessHaptic = async () => {
    if (typeof window === 'undefined') return
    try {
      const Haptics = (window as any).Capacitor?.Plugins?.Haptics
      if (Haptics) {
        await Haptics.notification({ type: 'SUCCESS' })
      } else if ('vibrate' in navigator) {
        navigator.vibrate([20, 60, 20])
      }
    } catch (e) {}
  }

  return {
    isNative,
    isOnline,
    triggerHaptic,
    triggerSuccessHaptic
  }
}
