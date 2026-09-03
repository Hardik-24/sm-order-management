<template>
  <Transition name="slide-up">
    <div 
      v-if="snackbarState !== 'hidden'" 
      class="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100000] w-[calc(100%-2rem)] sm:w-auto max-w-md sm:max-w-xl flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-[0_12px_40px_rgb(0,0,0,0.18)] border transition-all duration-300 backdrop-blur-md" 
      :class="colorClasses"
    >
      <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <component :is="currentIcon" class="w-5 h-5 flex-shrink-0" :class="{'animate-spin': snackbarState === 'saving'}" />
        <span class="text-xs sm:text-sm font-medium tracking-normal sm:tracking-wide break-words leading-snug">{{ snackbarMessage }}</span>
      </div>

      <!-- Action Buttons -->
      <div v-if="snackbarState === 'editing' && hasActions" class="flex items-center gap-2 pl-3 sm:pl-4 border-l border-amber-200/50 flex-shrink-0">
        <button @click="handleCancel" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">Discard</button>
        <button @click="handleSave" class="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-amber-600 text-white shadow-sm hover:bg-amber-700 hover:shadow transition-all whitespace-nowrap">Save Changes</button>
      </div>

      <!-- Dismiss Button for Informational Alerts -->
      <button 
        v-else-if="snackbarState !== 'saving'" 
        @click="hide" 
        class="p-1 rounded-lg hover:bg-black/5 text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
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
    default:
      return Info
  }
})
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 100%);
}
</style>
