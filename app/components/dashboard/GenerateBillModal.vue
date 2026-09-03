<template>
  <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
    
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText class="w-5 h-5 text-[#1a5c4c]" />
            Generate Invoice
          </h2>
          <p class="text-sm text-gray-500 mt-1">Order: {{ order?.orderNumber || 'Loading...' }}</p>
        </div>
        <button @click="closeModal" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="pending" class="flex justify-center py-12">
          <Loader2 class="w-8 h-8 animate-spin text-[#1a5c4c]" />
        </div>
        
        <div v-else-if="order" class="space-y-8">
          <!-- Customer Details -->
          <div class="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Bill To</p>
              <p class="text-sm font-medium text-gray-900">{{ order.customer?.name }}</p>
              <p v-if="order.customer?.company" class="text-sm text-gray-600">{{ order.customer.company }}</p>
              <p class="text-sm text-gray-500 mt-1">{{ order.customer?.address || 'No address provided' }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Invoice Date</p>
              <p class="text-sm font-medium text-gray-900">{{ new Date().toLocaleDateString() }}</p>
            </div>
          </div>

          <!-- Items Table -->
          <div>
            <h3 class="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest">Order Items</h3>
            <div class="border border-gray-200 rounded-xl overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                    <th class="px-4 py-3 whitespace-nowrap">Item</th>
                    <th class="px-4 py-3 whitespace-nowrap text-right">Qty</th>
                    <th class="px-4 py-3 whitespace-nowrap text-right w-32">Unit Price (₹)</th>
                    <th class="px-4 py-3 whitespace-nowrap text-right w-24">Discount %</th>
                    <th class="px-4 py-3 whitespace-nowrap text-right w-24">Tax Rate</th>
                    <th class="px-4 py-3 whitespace-nowrap text-right w-28">Tax Amt</th>
                    <th class="px-4 py-3 whitespace-nowrap text-right w-32">Total (₹)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(item, index) in editableItems" :key="item.id" class="hover:bg-gray-50/50">
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-900">{{ item.productName }}</p>
                      <p class="text-xs text-gray-500">{{ item.sku }} <span v-if="item.product?.hsnCode">| HSN: {{ item.product.hsnCode }}</span></p>
                    </td>
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 text-right">{{ item.quantity }}</td>
                    <td class="px-4 py-3 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.unitPrice" 
                        class="w-full text-right text-sm border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white"
                      >
                    </td>
                    <td class="px-4 py-3 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.discount" 
                        min="0" max="100"
                        class="w-full text-right text-sm border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white"
                      >
                    </td>
                    <td class="px-4 py-3 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.taxRate" 
                        min="0" max="100"
                        class="w-full text-right text-sm border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white"
                      >
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 text-right">₹{{ calculateTax(item).toFixed(2) }}</td>
                    <td class="px-4 py-3 text-sm font-bold text-gray-900 text-right">₹{{ calculateTotal(item).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary -->
          <div class="flex justify-end">
            <div class="w-72 bg-gray-50 rounded-xl p-5 border border-gray-200">
              <div class="flex justify-between items-center mb-3 text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{{ grandSubtotal.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-center mb-3 text-sm text-gray-600">
                <span>Total Discount</span>
                <span class="text-red-600">-₹{{ grandDiscount.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-center mb-4 text-sm text-gray-600">
                <span>Total Tax</span>
                <span>₹{{ grandTax.toFixed(2) }}</span>
              </div>
              <div class="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span class="text-sm font-bold text-gray-900 uppercase tracking-widest">Grand Total</span>
                <span class="text-xl font-bold text-[#1a5c4c]">₹{{ grandTotal.toFixed(2) }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <div class="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
        <button @click="closeModal" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button 
          @click="confirmGenerate" 
          :disabled="isGenerating"
          class="flex items-center gap-2 px-6 py-2 bg-[#1a5c4c] text-white text-sm font-medium rounded-lg hover:bg-[#134336] transition-colors disabled:opacity-50"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          {{ isGenerating ? 'Generating...' : 'Confirm & Generate Bill' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, FileText, Loader2, Check } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  orderId: string | null
}>()

const emit = defineEmits(['close', 'generated'])

const order = ref<any>(null)
const pending = ref(false)
const isGenerating = ref(false)

const editableItems = ref<any[]>([])

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.orderId) {
    pending.value = true
    try {
      const data = await $fetch(`/api/orders/${props.orderId}`)
      order.value = data
      
      // Initialize editable items
      editableItems.value = data.items.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: 0,
        taxRate: Number(item.product?.taxRate || 0)
      }))
    } catch (e) {
      console.error(e)
    } finally {
      pending.value = false
    }
  } else {
    order.value = null
    editableItems.value = []
  }
})

const closeModal = () => {
  emit('close')
}

// Calculations
const calculateSubtotal = (item: any) => {
  return item.quantity * item.unitPrice
}

const calculateDiscountAmt = (item: any) => {
  const sub = calculateSubtotal(item)
  return sub * ((item.discount || 0) / 100)
}

const calculateTax = (item: any) => {
  const afterDiscount = calculateSubtotal(item) - calculateDiscountAmt(item)
  return afterDiscount * ((item.taxRate || 0) / 100)
}

const calculateTotal = (item: any) => {
  const afterDiscount = calculateSubtotal(item) - calculateDiscountAmt(item)
  return afterDiscount + calculateTax(item)
}

const grandSubtotal = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateSubtotal(item), 0)
})

const grandDiscount = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateDiscountAmt(item), 0)
})

const grandTax = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateTax(item), 0)
})

const grandTotal = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateTotal(item), 0)
})

const confirmGenerate = async () => {
  isGenerating.value = true
  try {
    const itemsToSave = editableItems.value.map(item => ({
      id: item.id,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
      taxAmount: calculateTax(item),
      totalPrice: calculateTotal(item)
    }))

    await $fetch(`/api/orders/${props.orderId}/billing`, {
      method: 'PATCH',
      body: { 
        status: 'GENERATED',
        items: itemsToSave
      }
    })
    emit('generated')
    closeModal()
  } catch (error) {
    console.error('Failed to generate invoice:', error)
  } finally {
    isGenerating.value = false
  }
}
</script>
