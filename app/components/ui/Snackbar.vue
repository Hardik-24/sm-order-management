<template>
  <Transition name="snackbar-slide">
    <div 
      v-if="snackbarState !== 'hidden'" 
      class="fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:top-auto sm:bottom-8 left-1/2 -translate-x-1/2 z-[100000] w-[calc(100%-1.5rem)] sm:w-auto max-w-md sm:max-w-xl flex justify-between px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-[0_12px_40px_rgb(0,0,0,0.22)] border transition-all duration-300 backdrop-blur-md" 
      :class="[
        colorClasses,
        snackbarState === 'editing' && hasActions 
          ? 'flex-col sm:flex-row sm:items-center items-stretch gap-2.5 sm:gap-3' 
          : 'items-center gap-3'
      ]"
    >
      <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <component :is="currentIcon" class="w-5 h-5 flex-shrink-0" :class="{'animate-spin': snackbarState === 'saving'}" />
        <span class="text-xs sm:text-sm font-medium tracking-normal sm:tracking-wide break-words leading-snug">{{ snackbarMessage }}</span>
      </div>

      <!-- Action Buttons -->
      <div v-if="snackbarState === 'editing' && hasActions" class="flex items-center justify-end gap-2 pt-2 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-amber-200/60 flex-shrink-0">
        <button @click="handleCancel" class="flex-1 sm:flex-initial text-center text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer">Discard</button>
        <button @click="handleSave" class="flex-1 sm:flex-initial text-center text-xs font-bold px-3.5 py-1.5 rounded-lg bg-amber-600 text-white shadow-sm hover:bg-amber-700 hover:shadow transition-all whitespace-nowrap cursor-pointer">Save Changes</button>
      </div>

      <!-- Dismiss Button for Informational Alerts -->
      <button 
        v-else-if="snackbarState !== 'saving'" 
        @click="hide" 
        class="p-1 rounded-lg hover:bg-black/5 text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0 cursor-pointer"
        title="Dismiss"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, CheckCircle2, Loader2, Info, X } from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'

const { snackbarState, snackbarMessage, hasActions, handleSave, handleCancel, hide } = useSnackbar()

const colorClasses = computed(() => {
  switch (snackbarState.value) {
    case 'editing':
      return 'bg-amber-50/95 border-amber-200 text-amber-900 shadow-amber-900/10'
    case 'saving':
      return 'bg-blue-50/95 border-blue-200 text-blue-900 shadow-blue-900/10'
    case 'saved':
      return 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-900/10'
    case 'error':
      return 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-900/10'
    default:
      return 'bg-white/95 border-gray-200 text-gray-800'
  }
})

const currentIcon = computed(() => {
  switch (snackbarState.value) {
    case 'editing':
      return AlertCircle
    case 'saving':
      return Loader2
    case 'saved':
      return CheckCircle2
    case 'error':
      return AlertCircle
    default:
      return Info
  }
})
</script>

<style scoped>
.snackbar-slide-enter-active,
.snackbar-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (max-width: 639px) {
  .snackbar-slide-enter-from,
  .snackbar-slide-leave-to {
    opacity: 0;
    transform: translate(-50%, -100%);
  }
  .snackbar-slide-enter-to,
  .snackbar-slide-leave-from {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@media (min-width: 640px) {
  .snackbar-slide-enter-from,
  .snackbar-slide-leave-to {
    opacity: 0;
    transform: translate(-50%, 100%);
  }
  .snackbar-slide-enter-to,
  .snackbar-slide-leave-from {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
