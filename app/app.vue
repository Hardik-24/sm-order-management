<template>
  <NuxtLoadingIndicator color="#1a5c4c" :height="3" />
  <Snackbar />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import Snackbar from '~/components/ui/Snackbar.vue'
</script>
