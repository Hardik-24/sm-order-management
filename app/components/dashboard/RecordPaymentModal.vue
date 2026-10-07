<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, CreditCard, Check, Loader2, IndianRupee, AlertCircle } from 'lucide-vue-next'
import { formatCurrency, formatDate } from '~/lib/utils'
import type { Order } from '~/types'

const props = defineProps<{
  isOpen: boolean
  order: Order | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'recorded', result: { paymentStatus: any; order: any }): void
}>()

const isSubmitting = ref(false)
const errorMessage = ref('')

const paymentMethods = [
  { id: 'UPI', label: 'UPI / QR' },
  { id: 'NEFT', label: 'NEFT / RTGS' },
  { id: 'CHEQUE', label: 'Cheque' },
  { id: 'CASH', label: 'Cash' },
  { id: 'OTHER', label: 'Other' }
]

const form = ref({
  amountReceived: 0,
  paymentMethod: 'UPI',
  referenceNo: '',
  notes: '',
  markFullPaid: false
})

const orderTotal = computed(() => Number(props.order?.totalAmount || 0))
const currentPaid = computed(() => Number(props.order?.paymentStatus?.amountPaid || 0))
const balanceDue = computed(() => {
  if (props.order?.paymentStatus?.balanceDue !== undefined) {
    return Number(props.order.paymentStatus.balanceDue)
  }
  return Math.max(0, orderTotal.value - currentPaid.value)
})

watch(() => props.isOpen, (open) => {
  if (open && props.order) {
    errorMessage.value = ''
    form.value = {
      amountReceived: balanceDue.value,
      paymentMethod: 'UPI',
      referenceNo: '',
      notes: '',
      markFullPaid: false
    }
  }
})

const setFullBalance = () => {
  form.value.amountReceived = balanceDue.value
  form.value.markFullPaid = true
}

const closeModal = () => {
  if (!isSubmitting.value) {
    emit('close')
  }
}

const submitPayment = async () => {
  if (!props.order) return
  errorMessage.value = ''

  if (form.value.amountReceived <= 0 && !form.value.markFullPaid) {
    errorMessage.value = 'Please enter a valid amount greater than ₹0'
    return
  }

  if (form.value.amountReceived > balanceDue.value) {
    errorMessage.value = `Amount cannot exceed the remaining balance due of ${formatCurrency(balanceDue.value)}`
    return
  }

  isSubmitting.value = true
  try {
    const res = await $fetch<any>(`/api/orders/${props.order.id}/payment`, {
      method: 'PATCH',
      body: {
        amountReceived: Number(form.value.amountReceived),
        paymentMethod: form.value.paymentMethod,
        referenceNo: form.value.referenceNo?.trim() || null,
        notes: form.value.notes?.trim() || null,
        markFullPaid: form.value.markFullPaid || form.value.amountReceived >= balanceDue.value
      }
    })

    emit('recorded', res)
    emit('close')
  } catch (err: any) {
    console.error('Failed to record payment', err)
    errorMessage.value = err?.data?.message || err?.message || 'Failed to record payment'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>

      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/80">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#e6f4f1] text-[#1a5c4c] flex items-center justify-center">
              <CreditCard class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-base font-bold text-gray-900">Record Payment</h2>
              <p class="text-xs text-gray-500 mt-0.5">Order {{ order?.orderNumber }} • {{ order?.customer?.name }}</p>
            </div>
          </div>
          <button @click="closeModal" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-5">
          <!-- Balance Summary Banner -->
          <div class="grid grid-cols-3 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 text-center">
            <div>
              <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total</span>
              <span class="text-sm font-bold text-gray-900">{{ formatCurrency(orderTotal) }}</span>
            </div>
            <div class="border-x border-gray-200">
              <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Paid</span>
              <span class="text-sm font-semibold text-emerald-700">{{ formatCurrency(currentPaid) }}</span>
            </div>
            <div>
              <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Balance Due</span>
              <span class="text-sm font-bold text-amber-700">{{ formatCurrency(balanceDue) }}</span>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Form Fields -->
          <div class="space-y-4">
            <!-- Amount Input -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Amount to Record (₹)</label>
                <button 
                  type="button" 
                  @click="setFullBalance" 
                  class="text-[11px] font-semibold text-[#1a5c4c] hover:underline"
                >
                  Pay Full Balance ({{ formatCurrency(balanceDue) }})
                </button>
              </div>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 font-medium">₹</span>
                <input 
                  type="number" 
                  v-model.number="form.amountReceived" 
                  min="1" 
                  :max="balanceDue" 
                  step="any"
                  placeholder="Enter amount"
                  class="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c] focus:border-transparent transition"
                />
              </div>
            </div>

            <!-- Payment Method Buttons -->
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Payment Method</label>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="pm in paymentMethods"
                  :key="pm.id"
                  type="button"
                  @click="form.paymentMethod = pm.id"
                  class="py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all duration-150"
                  :class="form.paymentMethod === pm.id 
                    ? 'border-[#1a5c4c] bg-[#1a5c4c] text-white shadow-sm' 
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'"
                >
                  {{ pm.label }}
                </button>
              </div>
            </div>

            <!-- Reference / UTR Number -->
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Reference / UTR / Cheque Number
              </label>
              <input 
                type="text" 
                v-model="form.referenceNo"
                placeholder="e.g. UTR-982341209 / Cheque #10492"
                class="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c] focus:border-transparent transition"
              />
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Notes (Optional)
              </label>
              <textarea 
                v-model="form.notes"
                rows="2"
                placeholder="Add any internal transaction remarks..."
                class="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c] focus:border-transparent transition resize-none"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50">
          <button 
            type="button" 
            @click="closeModal" 
            :disabled="isSubmitting"
            class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200/70 rounded-xl transition"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="submitPayment" 
            :disabled="isSubmitting || form.amountReceived <= 0"
            class="px-5 py-2.5 text-xs font-bold bg-[#1a5c4c] text-white rounded-xl hover:bg-[#1a5c4c]/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 transition"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <Check v-else class="w-4 h-4" />
            {{ isSubmitting ? 'Recording...' : 'Confirm Payment' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
