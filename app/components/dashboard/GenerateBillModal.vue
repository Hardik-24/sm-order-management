<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
      
      <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText class="w-5 h-5 text-[#1a5c4c]" />
            Generate & Reconcile Invoice
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
        
        <div v-else-if="order" class="space-y-6">
          <!-- Customer & Invoice Metadata Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Bill To Customer</p>
              <p class="text-sm font-bold text-gray-900">{{ order.customer?.name }}</p>
              <p v-if="order.customer?.company" class="text-xs text-gray-600">{{ order.customer.company }}</p>
              <p class="text-xs text-gray-500 mt-0.5 truncate">{{ order.deliveryAddress || order.customer?.address || 'No address' }}</p>
              <p v-if="order.customer?.gstNumber" class="text-xs font-mono font-semibold text-gray-700 mt-1">
                GSTIN: {{ order.customer.gstNumber }}
              </p>
            </div>
            
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Bill / Invoice No. *</label>
                  <input 
                    type="text" 
                    v-model="invoiceNumber" 
                    placeholder="e.g. INV-2026-001 or Busy No." 
                    class="w-full text-xs font-mono font-bold border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Invoice Date *</label>
                  <input 
                    type="date" 
                    v-model="invoiceDate" 
                    class="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                  />
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Invoice Document / PDF URL (Optional)</label>
                <input 
                  type="text" 
                  v-model="invoicePdfUrl" 
                  placeholder="https://... or invoice document reference" 
                  class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                />
              </div>
            </div>
          </div>

          <!-- Items Reconciliation Table -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold text-gray-900 uppercase tracking-widest">
                Reconcile & Adjust Billed Quantities
              </h3>
              <span class="text-xs text-gray-500">
                Ordered vs Physically Packed vs Billed
              </span>
            </div>
            <div class="border border-gray-200 rounded-xl overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[850px] text-xs">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 font-bold text-gray-500 uppercase tracking-widest text-[10px]">
                    <th class="px-3 py-3">Item / SKU</th>
                    <th class="px-3 py-3 text-center">Ordered</th>
                    <th class="px-3 py-3 text-center">Packed</th>
                    <th class="px-3 py-3 text-center w-24">Billed Qty</th>
                    <th class="px-3 py-3 text-right w-28">Rate (₹)</th>
                    <th class="px-3 py-3 text-right w-20">Disc %</th>
                    <th class="px-3 py-3 text-right w-20">Tax %</th>
                    <th class="px-3 py-3 text-right w-28">Tax Amt</th>
                    <th class="px-3 py-3 text-right w-28">Total (₹)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(item, index) in editableItems" :key="item.id" class="hover:bg-gray-50/50">
                    <td class="px-3 py-2.5">
                      <p class="font-bold text-gray-900">{{ item.productName || item.product?.name }}</p>
                      <p class="text-[11px] text-gray-500 mt-0.5">
                        {{ item.sku || item.product?.sku }} <span v-if="item.product?.hsnCode">| HSN: {{ item.product.hsnCode }}</span>
                      </p>
                      <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        <span 
                          v-if="item.isTaxInclusive" 
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                          title="Tax Inclusive Rate"
                        >
                          Tax Inc.
                        </span>
                        <span 
                          v-if="item.applyLastPrice" 
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                          title="Applied Customer's Last Agreed Price"
                        >
                          Last Price
                        </span>
                        <span 
                          v-if="item.itemNotes" 
                          class="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 truncate max-w-[200px]" 
                          :title="item.itemNotes"
                        >
                          💬 {{ item.itemNotes }}
                        </span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-center text-gray-600 font-semibold">{{ item.quantity }}</td>
                    <td class="px-3 py-2.5 text-center">
                      <span class="font-bold px-1.5 py-0.5 rounded text-[11px]" :class="(item.packedQuantity ?? item.quantity) < item.quantity ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'">
                        {{ item.packedQuantity !== undefined ? item.packedQuantity : item.quantity }}
                      </span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                      <input 
                        type="number" 
                        min="0"
                        v-model.number="item.billedQuantity" 
                        class="w-16 text-center font-bold text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.unitPrice" 
                        class="w-24 text-right text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white font-medium"
                      />
                      <div v-if="item.isTaxInclusive" class="text-[9px] font-semibold text-blue-600 mt-0.5">
                        (Tax Incl.)
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.discount" 
                        min="0" max="100"
                        class="w-16 text-right text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.taxRate" 
                        min="0" max="100"
                        class="w-16 text-right text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right font-medium text-gray-600">₹{{ calculateTax(item).toFixed(2) }}</td>
                    <td class="px-3 py-2.5 text-right font-bold text-gray-900">₹{{ calculateTotal(item).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary -->
          <div class="flex justify-end">
            <div class="w-80 bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
              <div class="flex justify-between items-center text-gray-600">
                <span>Subtotal (Billed)</span>
                <span class="font-semibold">₹{{ grandSubtotal.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-center text-gray-600">
                <span>Total Discount</span>
                <span class="text-rose-600 font-semibold">-₹{{ grandDiscount.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-center text-gray-600">
                <span>Total Tax (GST)</span>
                <span class="font-semibold">₹{{ grandTax.toFixed(2) }}</span>
              </div>
              <div class="pt-3 border-t border-gray-200 flex justify-between items-center">
                <span class="text-xs font-bold text-gray-900 uppercase tracking-widest">Final Bill Amount</span>
                <span class="text-xl font-black text-[#1a5c4c]">₹{{ grandTotal.toFixed(2) }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
        <button @click="closeModal" class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button 
          @click="confirmGenerate" 
          :disabled="isGenerating || !invoiceNumber.trim()"
          class="flex items-center gap-2 px-6 py-2 bg-[#1a5c4c] text-white text-xs font-bold rounded-lg hover:bg-[#134336] transition-colors disabled:opacity-50 shadow-sm"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          {{ isGenerating ? 'Generating...' : 'Confirm & Generate Bill' }}
        </button>
      </div>
    </div>
  </div>
  </Teleport>
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

const invoiceNumber = ref('')
const invoiceDate = ref(new Date().toISOString().split('T')[0])
const invoicePdfUrl = ref('')

const editableItems = ref<any[]>([])

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.orderId) {
    pending.value = true
    try {
      const data = await $fetch<any>(`/api/orders/${props.orderId}`)
      order.value = data
      
      invoiceNumber.value = data.billingStatus?.invoiceNumber || `INV-${new Date().getFullYear()}-${data.orderNumber?.replace('SO-', '') || '001'}`
      invoiceDate.value = data.billingStatus?.invoiceDate 
        ? new Date(data.billingStatus.invoiceDate).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0]
      invoicePdfUrl.value = data.billingStatus?.invoicePdfUrl || ''

      // Initialize editable items reconciling packed vs ordered
      editableItems.value = (data.items || []).map((item: any) => {
        const approvedQty = item.approvedQuantity ?? item.quantity
        const packedQty = item.packedQuantity !== undefined && item.packedQuantity !== null ? item.packedQuantity : approvedQty
        const billedQty = item.billedQuantity !== undefined && item.billedQuantity !== null ? item.billedQuantity : packedQty

        return {
          ...item,
          productName: item.productName || item.product?.name,
          sku: item.sku || item.product?.sku,
          quantity: approvedQty,
          packedQuantity: packedQty,
          billedQuantity: billedQty,
          unitPrice: Number(item.unitPrice || 0),
          discount: item.discount ? Number(item.discount) : 0,
          taxRate: item.taxRate !== undefined && item.taxRate !== null ? Number(item.taxRate) : Number(item.product?.taxRate || 0),
          isTaxInclusive: Boolean(item.isTaxInclusive),
          applyLastPrice: Boolean(item.applyLastPrice),
          itemNotes: item.itemNotes || ''
        }
      })
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

// Calculations based on billedQuantity
const calculateSubtotal = (item: any) => {
  const qty = Number(item.billedQuantity !== undefined ? item.billedQuantity : (item.packedQuantity ?? item.quantity))
  return qty * Number(item.unitPrice || 0)
}

const calculateDiscountAmt = (item: any) => {
  const sub = calculateSubtotal(item)
  return sub * ((Number(item.discount || 0)) / 100)
}

const calculateTax = (item: any) => {
  const afterDiscount = calculateSubtotal(item) - calculateDiscountAmt(item)
  return afterDiscount * ((Number(item.taxRate || 0)) / 100)
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
  if (!invoiceNumber.value.trim()) {
    alert('Please enter an Invoice / Bill Number')
    return
  }
  isGenerating.value = true
  try {
    const itemsToSave = editableItems.value.map(item => ({
      id: item.id,
      billedQuantity: Number(item.billedQuantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount || 0),
      taxRate: Number(item.taxRate || 0),
      taxAmount: calculateTax(item),
      totalPrice: calculateTotal(item)
    }))

    await $fetch(`/api/orders/${props.orderId}/billing`, {
      method: 'PATCH',
      body: { 
        status: 'GENERATED',
        invoiceNumber: invoiceNumber.value.trim(),
        invoiceDate: invoiceDate.value || undefined,
        invoicePdfUrl: invoicePdfUrl.value?.trim() || undefined,
        items: itemsToSave
      }
    })
    const { notifyChange } = useRealtimeSync()
    notifyChange({ orderId: props.orderId, action: 'BILL_GENERATED' })
    emit('generated')
    closeModal()
  } catch (error: any) {
    console.error('Failed to generate invoice:', error)
    alert(error.data?.message || 'Failed to generate invoice')
  } finally {
    isGenerating.value = false
  }
}
</script>
