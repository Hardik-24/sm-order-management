<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="splashOverlayRef"
      @click="dismissEarly"
      class="fixed inset-0 z-[99999] bg-[#1c1c1c] flex flex-col items-center justify-center select-none overflow-hidden touch-none cursor-pointer"
      aria-label="SM Flow Splash Screen"
    >
      <!-- Ambient Radial Glow Behind Logo -->
      <div class="absolute w-[340px] h-[340px] rounded-full bg-gradient-to-tr from-amber-500/10 via-sky-500/10 to-indigo-500/5 blur-3xl pointer-events-none"></div>

      <!-- Center Brand Container -->
      <div class="relative z-10 flex flex-col items-center">
        <!-- Logo Box -->
        <div ref="logoBoxRef" class="relative mb-6">
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
            <!-- Subtle glow halo -->
            <div class="absolute inset-0 rounded-3xl bg-sky-500/15 blur-xl scale-105 pointer-events-none"></div>

            <!-- Crisp Logo Icon -->
            <img
              src="/images/logo-icon.png"
              alt="SM Flow"
              class="relative z-10 w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
            />

            <!-- Shimmer Light Sweep Beam -->
            <div
              ref="shimmerRef"
              class="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl opacity-0"
            >
              <div class="w-[200%] h-full -rotate-45 bg-gradient-to-r from-transparent via-white/40 to-transparent transform -translate-x-full"></div>
            </div>
          </div>
        </div>

        <!-- Typography -->
        <div ref="textGroupRef" class="flex flex-col items-center text-center px-4">
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-[0.24em] text-[#f4efe6] uppercase font-sans">
            SM FLOW
          </h1>
          <p class="text-[11px] sm:text-xs tracking-[0.28em] font-semibold text-gray-400 uppercase mt-2">
            Operations &amp; Order Management
          </p>
        </div>

        <!-- Micro-Loader Track -->
        <div class="w-36 sm:w-44 h-1 bg-white/10 rounded-full mt-7 overflow-hidden relative">
          <div
            ref="progressBarRef"
            class="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-indigo-400 w-0 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.6)]"
          ></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeMount, nextTick } from 'vue'
import gsap from 'gsap'

const isVisible = ref(false)
const splashOverlayRef = ref<HTMLElement | null>(null)
const logoBoxRef = ref<HTMLElement | null>(null)
const shimmerRef = ref<HTMLElement | null>(null)
const textGroupRef = ref<HTMLElement | null>(null)
const progressBarRef = ref<HTMLElement | null>(null)

let timeline: gsap.core.Timeline | null = null
let fallbackTimer: any = null

const dismissSplash = () => {
  if (!isVisible.value) return
  if (fallbackTimer) clearTimeout(fallbackTimer)

  if (splashOverlayRef.value) {
    gsap.to(splashOverlayRef.value, {
      opacity: 0,
      scale: 1.05,
      duration: 0.35,
      ease: 'power2.inOut',
      onComplete: () => {
        isVisible.value = false
        if (timeline) timeline.kill()
      }
    })
  } else {
    isVisible.value = false
  }
}

const dismissEarly = () => {
  dismissSplash()
}

onBeforeMount(() => {
  if (typeof window !== 'undefined') {
    const hasPlayed = sessionStorage.getItem('sm_flow_splash_played')
    const urlParams = new URLSearchParams(window.location.search)
    const forceSplash = urlParams.get('splash') === '1'

    if (!hasPlayed || forceSplash) {
      isVisible.value = true
      sessionStorage.setItem('sm_flow_splash_played', '1')
    }
  }
})

onMounted(() => {
  if (!isVisible.value) return

  // Dismiss native Capacitor splash screen if active so web GSAP smoothly transitions
  try {
    const cap = (window as any).Capacitor
    if (cap?.Plugins?.SplashScreen?.hide) {
      cap.Plugins.SplashScreen.hide()
    }
  } catch {
    // Ignore Capacitor absence on web
  }

  // Safety fallback: maximum display duration 2.0s
  fallbackTimer = setTimeout(() => {
    dismissSplash()
  }, 2000)

  nextTick(() => {
    if (!splashOverlayRef.value) return

    timeline = gsap.timeline({
      onComplete: () => {
        setTimeout(dismissSplash, 260)
      }
    })

    // Set initial GSAP states
    if (logoBoxRef.value) gsap.set(logoBoxRef.value, { scale: 0.75, opacity: 0, y: 10 })
    if (textGroupRef.value) gsap.set(textGroupRef.value, { opacity: 0, y: 12 })
    if (shimmerRef.value) gsap.set(shimmerRef.value, { opacity: 0 })

    // 1. Logo entrance with bounce settle
    if (logoBoxRef.value) {
      timeline.to(logoBoxRef.value, {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: 'back.out(1.5)'
      })
    }

    // 2. Light beam shimmer sweep
    if (shimmerRef.value) {
      const beam = shimmerRef.value.querySelector('div')
      timeline.to(shimmerRef.value, { opacity: 1, duration: 0.1 }, '-=0.25')
      if (beam) {
        timeline.fromTo(beam, { xPercent: -100 }, { xPercent: 125, duration: 0.65, ease: 'power2.inOut' }, '<')
      }
      timeline.to(shimmerRef.value, { opacity: 0, duration: 0.15 }, '-=0.15')
    }

    // 3. Text fade & lift
    if (textGroupRef.value) {
      timeline.to(textGroupRef.value, {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: 'power2.out'
      }, '-=0.5')
    }

    // 4. Glowing progress bar fill
    if (progressBarRef.value) {
      timeline.to(progressBarRef.value, {
        width: '100%',
        duration: 0.75,
        ease: 'power2.inOut'
      }, '-=0.6')
    }
  })
})
</script>
