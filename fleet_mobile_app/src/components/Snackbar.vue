<template>
  <transition name="slide-up">
    <div v-if="isVisible" class="fixed bottom-6 left-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3"
         :class="{
           'bg-[#1a5c4c] text-white': snackbarType === 'success',
           'bg-blue-600 text-white': snackbarType === 'loading',
           'bg-red-500 text-white': snackbarType === 'error'
         }">
      <span class="text-sm font-medium tracking-wide">{{ snackbarMessage }}</span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useSnackbar } from '../composables/useSnackbar'
const { isVisible, snackbarMessage, snackbarType } = useSnackbar()
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
