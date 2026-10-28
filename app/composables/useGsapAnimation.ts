import gsap from 'gsap'
import { ref, onUnmounted, nextTick } from 'vue'

export function useGsapAnimation() {
  const ctx = ref<gsap.Context | null>(null)

  const isReducedMotion = () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  const initContext = (scope?: Element | string) => {
    ctx.value?.revert()
    ctx.value = gsap.context(() => {}, scope)
    return ctx.value
  }

  onUnmounted(() => {
    ctx.value?.revert()
  })

  /**
   * Animate rolling numbers/currency smoothly
   */
  const animateNumber = (
    el: HTMLElement | null,
    endValue: number,
    options: { duration?: number; prefix?: string; suffix?: string; isCurrency?: boolean; startValue?: number } = {}
  ) => {
    if (!el) return
    if (isReducedMotion()) {
      const rounded = Math.round(endValue)
      const prefix = options.prefix || ''
      const suffix = options.suffix || ''
      el.innerText = options.isCurrency
        ? `${prefix}₹${rounded.toLocaleString('en-IN')}${suffix}`
        : `${prefix}${rounded.toLocaleString('en-IN')}${suffix}`
      return
    }

    const { duration = 0.6, prefix = '', suffix = '', isCurrency = false, startValue = 0 } = options
    const target = { val: startValue }

    gsap.to(target, {
      val: endValue,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (!el) return
        const rounded = Math.round(target.val)
        if (isCurrency) {
          el.innerText = `${prefix}₹${rounded.toLocaleString('en-IN')}${suffix}`
        } else {
          el.innerText = `${prefix}${rounded.toLocaleString('en-IN')}${suffix}`
        }
      }
    })
  }

  /**
   * Snappy staggered cascading entrance for cards, list items, or table rows
   */
  const animateStagger = (
    elements: (Element | null)[] | NodeListOf<Element> | string,
    options: { duration?: number; stagger?: number; y?: number; opacity?: number } = {}
  ) => {
    if (isReducedMotion()) return
    const { duration = 0.24, stagger = 0.02, y = 8, opacity = 0 } = options
    gsap.from(elements, {
      y,
      opacity,
      duration,
      stagger,
      ease: 'power2.out',
      clearProps: 'transform,opacity'
    })
  }

  /**
   * Liquid spring progress bar tweening
   */
  const animateProgressBar = (
    el: HTMLElement | null,
    targetPercent: number,
    options: { duration?: number } = {}
  ) => {
    if (!el) return
    const pct = Math.min(100, Math.max(0, targetPercent))
    if (isReducedMotion()) {
      el.style.width = `${pct}%`
      return
    }
    const { duration = 0.45 } = options
    gsap.to(el, {
      width: `${pct}%`,
      duration,
      ease: 'power2.out'
    })
  }

  /**
   * Crisp modal spring pop-in
   */
  const animateModalOpen = (
    modalEl: HTMLElement | null,
    backdropEl?: HTMLElement | null,
    options: { duration?: number } = {}
  ) => {
    if (!modalEl) return
    if (isReducedMotion()) {
      if (backdropEl) backdropEl.style.opacity = '1'
      modalEl.style.opacity = '1'
      return
    }

    const { duration = 0.28 } = options

    if (backdropEl) {
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: duration * 0.75, ease: 'power1.out' }
      )
    }

    gsap.fromTo(
      modalEl,
      { scale: 0.94, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration, ease: 'back.out(1.3)' }
    )
  }

  /**
   * Smooth tab or wizard step view switch
   */
  const animateTabSwitch = (
    viewEl: HTMLElement | null,
    options: { duration?: number; y?: number } = {}
  ) => {
    if (!viewEl || isReducedMotion()) return
    const { duration = 0.25, y = 8 } = options
    gsap.fromTo(
      viewEl,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, ease: 'power2.out', clearProps: 'transform,opacity' }
    )
  }

  /**
   * Soft highlight pulse for freshly synced or updated rows/cards
   */
  const animatePulseHighlight = (
    el: HTMLElement | null,
    highlightColor: string = 'rgba(78, 205, 196, 0.2)'
  ) => {
    if (!el || isReducedMotion()) return
    gsap.fromTo(
      el,
      { backgroundColor: highlightColor },
      { backgroundColor: 'transparent', duration: 1.2, ease: 'power2.out', clearProps: 'backgroundColor' }
    )
  }

  return {
    gsap,
    initContext,
    animateNumber,
    animateStagger,
    animateProgressBar,
    animateModalOpen,
    animateTabSwitch,
    animatePulseHighlight,
    isReducedMotion
  }
}

