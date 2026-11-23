<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      @click.self="onCancel"
    >
      <div
        class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform animate-in zoom-in-95 duration-150 p-5 sm:p-6 flex flex-col space-y-4 text-gray-900"
        role="dialog"
        aria-modal="true"
        @keydown.esc="onCancel"
      >
        <!-- Icon & Header -->
        <div class="flex items-start gap-3.5">
          <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertTriangle class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="space-y-1 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base sm:text-lg font-black text-gray-950 tracking-tight leading-snug">
                {{ title || 'Discard unsaved changes?' }}
              </h3>
              <span
                v-if="badgeText"
                class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider"
              >
                {{ badgeText }}
              </span>
            </div>
            <p class="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {{ message || 'You have unsaved changes in this form. If you exit now, all entered items and details will be lost.' }}
            </p>
          </div>
        </div>

        <!-- Optional summary box (e.g. "5 item(s) in draft") -->
        <div
          v-if="itemCount !== undefined && itemCount > 0"
          class="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-amber-900"
        >
          <div class="flex items-center gap-2">
            <Package class="w-4 h-4 text-amber-600 shrink-0" />
            <span>Active draft items:</span>
          </div>
          <span class="font-bold text-amber-950 px-2 py-0.5 bg-amber-200/70 rounded-md">
            {{ itemCount }} {{ itemCount === 1 ? 'item' : 'items' }}
          </span>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            @click="onConfirm"
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 transition-colors cursor-pointer text-center active:scale-[0.99]"
          >
            {{ confirmText || 'Discard & Leave' }}
          </button>
          <button
            type="button"
            ref="keepEditingBtnRef"
            @click="onCancel"
            class="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1b3b5f] hover:bg-[#132c49] shadow-md transition-all active:scale-[0.99] cursor-pointer text-center"
          >
            {{ cancelText || 'Keep Editing' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { AlertTriangle, Package } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  itemCount?: number
  badgeText?: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const keepEditingBtnRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        keepEditingBtnRef.value?.focus()
      })
    }
  }
)

const onConfirm = () => {
  emit('confirm')
}

const onCancel = () => {
  emit('cancel')
}
</script>
