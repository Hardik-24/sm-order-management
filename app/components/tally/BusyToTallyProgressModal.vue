<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
    <!-- Backdrop -->
    <div 
      ref="backdropRef"
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity" 
      @click="handleBackdropClick"
    ></div>

    <!-- Stepper Dialog Card (Non-clipping, Flex-column with Scrollable Body) -->
    <div 
      ref="modalCardRef"
      class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg flex flex-col max-h-[92vh] my-auto overflow-hidden"
    >
      
      <!-- Top Banner (Sticky Header) -->
      <div 
        class="px-6 py-4 border-b flex items-center justify-between shrink-0"
        :class="[
          currentStep === 5 ? 'bg-emerald-50/80 border-emerald-100' : 
          currentStep === -1 ? 'bg-red-50/80 border-red-100' : 'bg-slate-50 border-gray-200'
        ]"
      >
        <div class="flex items-center gap-3">
          <div 
            class="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs"
            :class="[
              currentStep === 5 ? 'bg-emerald-600 text-white' : 
              currentStep === -1 ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'
            ]"
          >
            <CheckCircle2 v-if="currentStep === 5" class="w-6 h-6 animate-in zoom-in" />
            <AlertCircle v-else-if="currentStep === -1" class="w-6 h-6 animate-in zoom-in" />
            <Send v-else class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 class="text-sm font-black text-gray-900 flex items-center gap-2">
              <span>{{ headerTitle }}</span>
              <span v-if="currentStep === 5" class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                Created
              </span>
              <span v-else-if="currentStep === -1" class="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold border border-red-200">
                Failed
              </span>
              <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold border border-indigo-200 animate-pulse">
                In Progress
              </span>
            </h3>
            <p class="text-[11px] text-gray-500 mt-0.5 font-medium">
              {{ voucherType }} #{{ voucherNo }} &bull; ₹{{ totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
            </p>
          </div>
        </div>

        <button 
          v-if="currentStep === 5 || currentStep === -1"
          @click="emit('close')"
          class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Stepper Steps Body (Scrollable, never overflows/clips) -->
      <div class="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">

        <!-- Target Summary Strip -->
        <div class="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs flex items-center justify-between">
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500">BUSY Party</div>
            <div class="font-bold text-gray-900 truncate max-w-[200px]" :title="partyName">{{ partyName }}</div>
          </div>
          <ArrowRight class="w-4 h-4 text-gray-400 shrink-0 mx-2" />
          <div class="text-right">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tally Ledger</div>
            <div class="font-bold text-indigo-900 truncate max-w-[200px]" :title="tallyLedgerName">{{ tallyLedgerName }}</div>
          </div>
        </div>

        <!-- 4-Step Pipeline Indicator -->
        <div class="space-y-3.5 pt-1">

          <!-- Step 1: Connectivity -->
          <div class="flex items-start gap-3.5">
            <div class="shrink-0 mt-0.5">
              <div 
                v-if="currentStep > 1 || currentStep === 5"
                class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center"
              >
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else-if="currentStep === 1"
                class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center justify-center animate-spin"
              >
                <Loader2 class="w-3.5 h-3.5" />
              </div>
              <div 
                v-else-if="currentStep === -1 && failedAtStep === 1"
                class="w-6 h-6 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center justify-center"
              >
                <X class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else
                class="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-[11px] font-bold"
              >
                1
              </div>
            </div>
            <div class="flex-1">
              <div class="text-xs font-bold" :class="getStepTextClass(1)">
                Step 1: Enqueue & Duplicate Prevention Check
              </div>
              <div class="text-[11px] text-gray-500 mt-0.5">
                {{ step1Details || 'Enqueuing voucher & verifying duplicate protection...' }}
              </div>
            </div>
          </div>

          <!-- Step 2: Validation -->
          <div class="flex items-start gap-3.5">
            <div class="shrink-0 mt-0.5">
              <div 
                v-if="currentStep > 2 || currentStep === 5"
                class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center"
              >
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else-if="currentStep === 2"
                class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center justify-center animate-spin"
              >
                <Loader2 class="w-3.5 h-3.5" />
              </div>
              <div 
                v-else-if="currentStep === -1 && failedAtStep === 2"
                class="w-6 h-6 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center justify-center"
              >
                <X class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else
                class="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-[11px] font-bold"
              >
                2
              </div>
            </div>
            <div class="flex-1">
              <div class="text-xs font-bold" :class="getStepTextClass(2)">
                Step 2: Validate Ledgers & Tax Balance
              </div>
              <div class="text-[11px] text-gray-500 mt-0.5">
                {{ step2Details || 'Verifying Debit/Credit equilibrium and GST structure...' }}
              </div>
            </div>
          </div>

          <!-- Step 3: XML Transmission -->
          <div class="flex items-start gap-3.5">
            <div class="shrink-0 mt-0.5">
              <div 
                v-if="currentStep > 3 || currentStep === 5"
                class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center"
              >
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else-if="currentStep === 3"
                class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center justify-center animate-spin"
              >
                <Loader2 class="w-3.5 h-3.5" />
              </div>
              <div 
                v-else-if="currentStep === -1 && failedAtStep === 3"
                class="w-6 h-6 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center justify-center"
              >
                <X class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else
                class="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-[11px] font-bold"
              >
                3
              </div>
            </div>
            <div class="flex-1">
              <div class="text-xs font-bold" :class="getStepTextClass(3)">
                Step 3: Transmit XML via Sync Agent to Tally Prime
              </div>
              <div class="text-[11px] text-gray-500 mt-0.5">
                {{ step3Details || 'Sync Agent on Main PC posting <TALLYMESSAGE> to Port 9000...' }}
              </div>
            </div>
          </div>

          <!-- Step 4: Confirmation -->
          <div class="flex items-start gap-3.5">
            <div class="shrink-0 mt-0.5">
              <div 
                v-if="currentStep === 5"
                class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center"
              >
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else-if="currentStep === 4"
                class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center justify-center animate-spin"
              >
                <Loader2 class="w-3.5 h-3.5" />
              </div>
              <div 
                v-else-if="currentStep === -1 && failedAtStep === 4"
                class="w-6 h-6 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center justify-center"
              >
                <X class="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div 
                v-else
                class="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-[11px] font-bold"
              >
                4
              </div>
            </div>
            <div class="flex-1">
              <div class="text-xs font-bold" :class="getStepTextClass(4)">
                Step 4: Confirm Creation in Tally Books
              </div>
              <div class="text-[11px] text-gray-500 mt-0.5">
                {{ step4Details || 'Verifying voucher created in active Tally company...' }}
              </div>
            </div>
          </div>

        </div>

        <!-- Success Box (Step 5) -->
        <div v-if="currentStep === 5" class="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-2 animate-in fade-in">
          <div class="flex items-center gap-2 font-bold text-emerald-900">
            <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Voucher #{{ voucherNo }} successfully created!</span>
          </div>
          <div class="text-[11px] text-emerald-800 leading-relaxed space-y-1">
            <div>&bull; Company: <strong>{{ tallyCompany || 'SRI LAKSHMI PLYWOODS 2627' }}</strong></div>
            <div>&bull; Bill Tracking: <strong>New Ref ({{ voucherNo }})</strong> in Outstanding Register</div>
            <div class="pt-1 text-[10px] text-emerald-700 font-medium">
              ℹ️ Status set to <strong>"Just Posted"</strong>. On the next background sync, it will be promoted to <strong>"Verified in Tally"</strong>.
            </div>
          </div>
        </div>

        <!-- Error Box (Step -1) -->
        <div v-if="currentStep === -1" class="p-3.5 bg-red-50 rounded-xl border border-red-200 text-xs space-y-2 animate-in fade-in">
          <div class="flex items-center gap-2 font-bold text-red-900">
            <AlertCircle class="w-4 h-4 text-red-600 shrink-0" />
            <span>Posting Failed</span>
          </div>
          <p class="text-[11px] text-red-800 leading-relaxed font-mono bg-white/70 p-2 rounded-lg border border-red-200/60 break-words">
            {{ errorMessage || 'Tally Prime rejected the voucher request.' }}
          </p>
          <div class="text-[10px] text-red-700 font-medium pt-1">
            Tip: Please ensure Tally Prime is open, Port 9000 is active, and all selected ledgers exist in the company.
          </div>
        </div>

      </div>

      <!-- Footer Action (Sticky) -->
      <div class="px-6 py-3.5 border-t border-gray-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
        <span class="text-gray-400 text-[11px]">
          {{ currentStep === 5 ? 'Voucher is live in Tally' : (currentStep === -1 ? 'Ready to retry' : 'Please keep this window open...') }}
        </span>

        <div class="flex items-center gap-2">
          <button 
            v-if="currentStep === -1"
            type="button"
            @click="emit('retry')"
            class="px-4 py-1.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Retry Posting
          </button>
          
          <button 
            type="button"
            @click="emit('close')"
            class="px-4 py-1.5 font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            {{ currentStep === 5 ? 'Done' : (currentStep === -1 ? 'Back to Review' : 'Dismiss') }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import gsap from 'gsap'
import {
  Send,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight
} from 'lucide-vue-next'

const backdropRef = ref<HTMLElement | null>(null)
const modalCardRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  isOpen: boolean
  voucherNo: string
  voucherType: string
  partyName: string
  tallyLedgerName: string
  totalAmount: number
  currentStep: number // 1: Connecting, 2: Validating, 3: Transmitting, 4: Confirming, 5: Success, -1: Error
  failedAtStep?: number
  step1Details?: string
  step2Details?: string
  step3Details?: string
  step4Details?: string
  errorMessage?: string
  tallyCompany?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'retry'): void
}>()

const headerTitle = computed(() => {
  if (props.currentStep === 5) return 'Voucher Created in Tally Prime'
  if (props.currentStep === -1) return 'Posting Error from Tally'
  return `Posting ${props.voucherType} #${props.voucherNo}`
})

const getStepTextClass = (step: number) => {
  if (props.currentStep === 5 || props.currentStep > step) {
    return 'text-emerald-900 font-bold'
  }
  if (props.currentStep === step) {
    return 'text-indigo-900 font-black animate-pulse'
  }
  if (props.currentStep === -1 && props.failedAtStep === step) {
    return 'text-red-900 font-bold'
  }
  return 'text-gray-400 font-medium'
}

const handleBackdropClick = () => {
  if (props.currentStep === 5 || props.currentStep === -1) {
    emit('close')
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    nextTick(() => {
      if (backdropRef.value && modalCardRef.value) {
        gsap.fromTo(backdropRef.value, 
          { opacity: 0 }, 
          { opacity: 1, duration: 0.25, ease: 'power2.out' }
        )
        gsap.fromTo(modalCardRef.value, 
          { opacity: 0, scale: 0.9, y: 15 }, 
          { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' }
        )
      }
    })
  }
})
</script>
