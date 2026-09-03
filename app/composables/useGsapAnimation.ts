import gsap from 'gsap'
import { ref, onUnmounted, nextTick } from 'vue'

export function useGsapAnimation() {
  const ctx = ref<gsap.Context | null>(null)

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
    const { duration = 0.3, stagger = 0.04, y = 12, opacity = 0 } = options
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
    const { duration = 0.4 } = options
    gsap.to(el, {
      width: `${Math.min(100, Math.max(0, targetPercent))}%`,
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
    const { duration = 0.28 } = options

    if (backdropEl) {
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: duration * 0.8, ease: 'power1.out' }
      )
    }

    gsap.fromTo(
      modalEl,
      { scale: 0.94, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration, ease: 'back.out(1.4)' }
    )
  }

  return {
    gsap,
    initContext,
    animateNumber,
    animateStagger,
    animateProgressBar,
    animateModalOpen
  }
}
