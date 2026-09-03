<template>
  <div class="inline-flex items-baseline font-semibold tracking-tight select-none" :class="props.class">
    <!-- Shimmer Skeleton while loading -->
    <div 
      v-if="loading" 
      class="h-8 w-20 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer bg-[length:200%_100%] my-0.5"
    ></div>

    <!-- Animated Value -->
    <span v-else ref="numberTextRef" class="inline-block font-semibold">
      {{ displayedText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import gsap from 'gsap'

const props = withDefaults(defineProps<{
  value: number | string | null | undefined
  prefix?: string
  suffix?: string
  loading?: boolean
  duration?: number
  formatCommas?: boolean
  class?: string
}>(), {
  value: 0,
  prefix: '',
  suffix: '',
  loading: false,
  duration: 0.65,
  formatCommas: true,
  class: ''
})

const numberTextRef = ref<HTMLElement | null>(null)
const currentDisplayNum = ref<number>(0)

const formatNumber = (num: number): string => {
  const rounded = Math.round(num)
  const formatted = props.formatCommas ? rounded.toLocaleString('en-IN') : String(rounded)
  return `${props.prefix}${formatted}${props.suffix}`
}

const displayedText = computed(() => {
  const target = typeof props.value === 'string' ? parseFloat(props.value) : Number(props.value ?? 0)
  if (isNaN(target)) {
    return `${props.prefix}${props.value ?? 0}${props.suffix}`
  }
  return formatNumber(currentDisplayNum.value)
})

let tween: gsap.core.Tween | null = null

const runCountAnimation = () => {
  const target = typeof props.value === 'string' ? parseFloat(props.value) : Number(props.value ?? 0)
  if (isNaN(target)) return

  tween?.kill()

  const animObj = { val: currentDisplayNum.value }

  // Quick blur-pop entrance on the element
  if (numberTextRef.value) {
    gsap.fromTo(numberTextRef.value, 
      { filter: 'blur(3px)', scale: 0.95, opacity: 0.8 }, 
      { filter: 'blur(0px)', scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' }
    )
  }

  tween = gsap.to(animObj, {
    val: target,
    duration: props.duration,
    ease: 'power3.out',
    onUpdate: () => {
      currentDisplayNum.value = animObj.val
    },
    onComplete: () => {
      currentDisplayNum.value = target
    }
  })
}

onMounted(() => {
  if (!props.loading) {
    runCountAnimation()
  }
})

watch(() => [props.value, props.loading], ([newVal, newLoading]) => {
  if (!newLoading) {
    nextTick(() => {
      runCountAnimation()
    })
  }
}, { deep: true })
</script>

<style scoped>
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite linear;
}
</style>
