<template>
  <NuxtLoadingIndicator color="#1b3b5f" :height="3" />
  <NetworkStatusBanner />
  <Snackbar />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Snackbar from '~/components/ui/Snackbar.vue'
import NetworkStatusBanner from '~/components/ui/NetworkStatusBanner.vue'
import { useNetworkDiagnostics } from '~/composables/useNetworkDiagnostics'

const { initGlobalListeners, reportRequestStart, reportRequestEnd } = useNetworkDiagnostics()

onMounted(() => {
  // Initialize global online/offline and reachability listeners
  initGlobalListeners()

  const nuxtApp = useNuxtApp()
  nuxtApp.hook('page:start', () => reportRequestStart())
  nuxtApp.hook('page:finish', () => reportRequestEnd())
  nuxtApp.hook('page:loading:start', () => reportRequestStart())
  nuxtApp.hook('page:loading:end', () => reportRequestEnd())

  // Graceful scroll indicator that only reveals when tab bar is touched or actively scrolled
  let timer: any = null
  window.addEventListener('scroll', (e) => {
    const target = e.target as HTMLElement
    if (target && target.classList && target.classList.contains('tab-scroll-container')) {
      target.classList.add('is-scrolling')
      clearTimeout(timer)
      timer = setTimeout(() => {
        target.classList.remove('is-scrolling')
      }, 700)
    }
  }, true)
})
</script>
