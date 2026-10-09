<template>
  <div 
    ref="rootRef"
    v-show="hasHorizontalOverflow"
    class="hidden md:block sticky -bottom-3 md:-bottom-[18px] z-20 w-full bg-white/95 backdrop-blur-xs border-t border-gray-200 shadow-xs px-3 py-1 transition-all duration-150"
    @wheel.prevent="onWheel"
  >
    <div 
      ref="floatingScrollRef"
      class="w-full overflow-x-auto overflow-y-hidden subtle-horizontal-scroll"
      @scroll="onFloatingScroll"
    >
      <div :style="{ width: `${Math.max(scrollWidth, 1)}px` }" class="h-2.5 min-h-[10px] pointer-events-none"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps<{
  target?: HTMLElement | null | undefined
}>()

const rootRef = ref<HTMLElement | null>(null)
const floatingScrollRef = ref<HTMLElement | null>(null)
const hasHorizontalOverflow = ref(false)
const scrollWidth = ref(0)

let isSyncingFromTarget = false
let isSyncingFromFloating = false
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let currentTarget: HTMLElement | null = null

const resolveTarget = (): HTMLElement | null => {
  if (props.target && props.target instanceof HTMLElement) {
    return props.target
  }
  if (!rootRef.value) return null

  // 1. Check previous siblings
  let el: Element | null = rootRef.value.previousElementSibling
  while (el) {
    if (el instanceof HTMLElement) {
      if (el.classList.contains('overflow-x-auto') || el.scrollWidth > el.clientWidth) {
        return el
      }
      const child = el.querySelector<HTMLElement>('.overflow-x-auto')
      if (child) return child
    }
    el = el.previousElementSibling
  }

  // 2. Check parent container
  if (rootRef.value.parentElement) {
    const parentMatch = rootRef.value.parentElement.querySelector<HTMLElement>('.overflow-x-auto')
    if (parentMatch) return parentMatch
  }

  return null
}

const updateScrollState = () => {
  const el = resolveTarget()
  if (!el) {
    hasHorizontalOverflow.value = false
    return
  }
  if (currentTarget !== el) {
    setupTarget(el)
    return
  }
  scrollWidth.value = el.scrollWidth
  const maxScroll = el.scrollWidth - el.clientWidth
  hasHorizontalOverflow.value = maxScroll > 1

  if (floatingScrollRef.value && !isSyncingFromFloating) {
    floatingScrollRef.value.scrollLeft = el.scrollLeft
  }
}

const onTargetScroll = () => {
  if (isSyncingFromFloating || !currentTarget || !floatingScrollRef.value) return
  isSyncingFromTarget = true
  floatingScrollRef.value.scrollLeft = currentTarget.scrollLeft
  requestAnimationFrame(() => {
    isSyncingFromTarget = false
  })
}

const onFloatingScroll = () => {
  if (isSyncingFromTarget || !currentTarget || !floatingScrollRef.value) return
  isSyncingFromFloating = true
  currentTarget.scrollLeft = floatingScrollRef.value.scrollLeft
  requestAnimationFrame(() => {
    isSyncingFromFloating = false
  })
}

const onWheel = (e: WheelEvent) => {
  if (!currentTarget) return
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  currentTarget.scrollLeft += delta
}

const setupTarget = (el?: HTMLElement | null) => {
  const targetEl = el || resolveTarget()
  if (currentTarget === targetEl && targetEl) {
    scrollWidth.value = targetEl.scrollWidth
    const maxScroll = targetEl.scrollWidth - targetEl.clientWidth
    hasHorizontalOverflow.value = maxScroll > 1
    if (floatingScrollRef.value && !isSyncingFromFloating) {
      floatingScrollRef.value.scrollLeft = targetEl.scrollLeft
    }
    return
  }

  if (currentTarget) {
    currentTarget.removeEventListener('scroll', onTargetScroll)
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = null
    }
  }

  currentTarget = targetEl || null

  if (targetEl) {
    targetEl.addEventListener('scroll', onTargetScroll, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollState()
      })
      resizeObserver.observe(targetEl)
      if (targetEl.firstElementChild) {
        resizeObserver.observe(targetEl.firstElementChild)
      }
    }

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        updateScrollState()
        if (resizeObserver && targetEl.firstElementChild) {
          try {
            resizeObserver.observe(targetEl.firstElementChild)
          } catch (_) {}
        }
      })
      mutationObserver.observe(targetEl, { childList: true, subtree: true })
    }

    scrollWidth.value = targetEl.scrollWidth
    const maxScroll = targetEl.scrollWidth - targetEl.clientWidth
    hasHorizontalOverflow.value = maxScroll > 1
    if (floatingScrollRef.value && !isSyncingFromFloating) {
      floatingScrollRef.value.scrollLeft = targetEl.scrollLeft
    }
  } else {
    hasHorizontalOverflow.value = false
  }
}

watch(() => props.target, (newEl) => {
  nextTick(() => {
    setupTarget(newEl)
  })
}, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', updateScrollState, { passive: true })
  nextTick(() => {
    setupTarget(props.target)
  })
  setTimeout(() => {
    setupTarget(props.target)
  }, 50)
  setTimeout(() => {
    setupTarget(props.target)
  }, 250)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScrollState)
  if (currentTarget) {
    currentTarget.removeEventListener('scroll', onTargetScroll)
    currentTarget = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }
})
</script>

<style scoped>
.subtle-horizontal-scroll {
  scrollbar-width: thin;
  scrollbar-color: #9ca3af #f3f4f6;
}
.subtle-horizontal-scroll::-webkit-scrollbar {
  height: 8px;
}
.subtle-horizontal-scroll::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 9999px;
}
.subtle-horizontal-scroll::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 9999px;
}
.subtle-horizontal-scroll::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
