<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        
        <!-- Modal Header -->
        <div class="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <Sliders class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold text-[#1a1a1a] flex items-center gap-2 truncate">
                General Settings
              </h3>
              <p class="text-xs text-gray-500 mt-0.5 truncate">
                System-wide preferences, quotation branding, and slip options
              </p>
            </div>
          </div>
          <button 
            @click="emit('close')" 
            data-modal-close="true"
            title="Close (Esc)"
            class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          <!-- Quotation Mode Setting Card -->
          <div class="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-gray-900">Anonymous Quotation Mode</span>
                  <span 
                    class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    :class="quotationAnonymousMode 
                      ? 'bg-amber-100 text-amber-900 border-amber-300' 
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'"
                  >
                    {{ quotationAnonymousMode ? 'Anonymous' : 'Branded' }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 leading-relaxed max-w-md">
                  When enabled, all quotation slips are generated anonymously without company branding (Silicon Marketing logo/name) or sales representative info.
                </p>
              </div>

              <!-- Interactive Toggle Switch -->
              <button
                type="button"
                role="switch"
                :aria-checked="quotationAnonymousMode"
                @click="quotationAnonymousMode = !quotationAnonymousMode"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                :class="quotationAnonymousMode ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                  :class="quotationAnonymousMode ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>

            <!-- Comparison Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <!-- Branded Preview Info -->
              <div 
                class="p-3.5 rounded-xl border text-xs transition-all"
                :class="!quotationAnonymousMode ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 ring-1 ring-emerald-300/50' : 'bg-gray-50 border-gray-200 text-gray-500 opacity-60'"
              >
                <div class="flex items-center gap-1.5 font-bold mb-1.5" :class="!quotationAnonymousMode ? 'text-emerald-900' : 'text-gray-700'">
                  <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                  <span>Branded Mode (Default)</span>
                </div>
                <ul class="space-y-1 text-[11px] leading-relaxed list-disc list-inside">
                  <li>Shows <strong>Silicon Marketing</strong> logo</li>
                  <li>Shows <strong>Issued By: Silicon Marketing</strong> & rep name</li>
                  <li>Signoff with Authorized Signatory & rep name</li>
                </ul>
              </div>

              <!-- Anonymous Preview Info -->
              <div 
                class="p-3.5 rounded-xl border text-xs transition-all"
                :class="quotationAnonymousMode ? 'bg-amber-50/70 border-amber-300 text-amber-950 ring-1 ring-amber-300/50' : 'bg-gray-50 border-gray-200 text-gray-500 opacity-60'"
              >
                <div class="flex items-center gap-1.5 font-bold mb-1.5" :class="quotationAnonymousMode ? 'text-amber-900' : 'text-gray-700'">
                  <EyeOff class="w-3.5 h-3.5 text-amber-600" />
                  <span>Anonymous Mode</span>
                </div>
                <ul class="space-y-1 text-[11px] leading-relaxed list-disc list-inside">
                  <li>Neutral <strong>PRICE QUOTATION</strong> header</li>
                  <li>No company logo, name, or rep details</li>
                  <li>Clean customer details & neutral signatory line</li>
                </ul>
              </div>
            </div>

            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-gray-600 flex items-start gap-2">
              <Info class="w-4 h-4 text-[#1b3b5f] shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> This is a global system setting managed exclusively by administrators.
              </span>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <div class="text-xs text-gray-500">
            <span v-if="saveSuccess" class="text-emerald-700 font-bold flex items-center gap-1">
              <Check class="w-4 h-4" />
              Settings saved successfully!
            </span>
            <span v-else-if="saveError" class="text-rose-600 font-semibold">
              {{ saveError }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button 
              @click="emit('close')" 
              class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              @click="saveSettings" 
              :disabled="isSaving"
              class="flex items-center gap-1.5 px-5 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
              <Save v-else class="w-3.5 h-3.5" />
              <span>{{ isSaving ? 'Saving...' : 'Save Settings' }}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Sliders,
  X,
  CheckCircle2,
  EyeOff,
  Info,
  Check,
  Save,
  Loader2
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', payload: { quotationAnonymousMode: boolean }): void
}>()

const quotationAnonymousMode = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

const loadSettings = async () => {
  isLoading.value = true
  saveSuccess.value = false
  saveError.value = ''
  try {
    const res = await $fetch<{ quotationAnonymousMode: boolean }>('/api/settings')
    quotationAnonymousMode.value = Boolean(res?.quotationAnonymousMode)
  } catch (err: any) {
    console.error('Failed to load settings:', err)
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async () => {
  isSaving.value = true
  saveSuccess.value = false
  saveError.value = ''
  try {
    const res = await $fetch<{ success: boolean; quotationAnonymousMode: boolean }>('/api/settings', {
      method: 'POST',
      body: {
        quotationAnonymousMode: quotationAnonymousMode.value
      }
    })
    saveSuccess.value = true
    emit('saved', { quotationAnonymousMode: quotationAnonymousMode.value })
    setTimeout(() => {
      saveSuccess.value = false
      emit('close')
    }, 700)
  } catch (err: any) {
    saveError.value = err.data?.message || 'Failed to save settings'
  } finally {
    isSaving.value = false
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadSettings()
  }
})
</script>
