<template>
  <NuxtLoadingIndicator color="#1a5c4c" :height="3" />
  <Snackbar />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Snackbar from '~/components/ui/Snackbar.vue'

onMounted(() => {
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
