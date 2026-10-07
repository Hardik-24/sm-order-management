<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  ShieldCheck, 
  Building2, 
  CreditCard, 
  MapPin, 
  Package,
  Check
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const props = defineProps<{
  isOpen: boolean
  orderRequest: any | null
  matchedCustomer: any | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'converted', order: any): void
}>()

const { user } = useAuth()
const { showSaved } = useSnackbar()
const { notifyChange } = useRealtimeSync()

const isSubmitting = ref(false)
const errorMessage = ref('')

const customersList = ref<any[]>([])
const productsList = ref<any[]>([])
const isLoadingData = ref(false)

const loadData = async () => {
  if (customersList.value.length && productsList.value.length) return
  isLoadingData.value = true
  try {
    const [cData, pData] = await Promise.all([
      $fetch<any[]>('/api/customers'),
      $fetch<any[]>('/api/products')
    ])
    customersList.value = cData || []
    productsList.value = pData || []
  } catch (err) {
    console.error('Failed to load customers or products:', err)
  } finally {
    isLoadingData.value = false
  }
}

const form = ref({
  customerId: '',
  deliveryAddress: '',
  paymentTerms: 'Net 30',
  notes: '',
  items: [] as Array<{
    productId: string
    productSku?: string
    productName?: string
    quantity: number
    unitPrice: number
    stock?: number
  }>
})

const paymentTermsOptions = [
  { label: 'Net 30', value: 'Net 30' },
  { label: 'Net 15', value: 'Net 15' },
  { label: 'Net 45', value: 'Net 45' },
  { label: 'Net 60', value: 'Net 60' },
  { label: 'Due on Receipt', value: 'Due on Receipt' },
  { label: 'Advance Payment', value: 'Advance Payment' },
  { label: 'Cash on Delivery (COD)', value: 'COD' }
]

const customerOptions = computed(() => {
  const req = props.orderRequest
  const options: Array<{ label: string; value: string; subtitle?: string }> = []

  // Option 1: Create New / Match from request
  if (req) {
    const isMatched = !!props.matchedCustomer
    options.push({
      label: isMatched 
        ? `${props.matchedCustomer.name} (${props.matchedCustomer.company || 'Existing Customer'})`
        : `➕ Create New Lead: ${req.customerName} (${req.companyName || req.phone})`,
      value: props.matchedCustomer?.id || '',
      subtitle: isMatched ? `Matched via phone ${req.phone}` : 'Will create a new customer record automatically'
    })
  }

  // Option 2: All existing customers
  for (const c of customersList.value) {
    if (props.matchedCustomer && c.id === props.matchedCustomer.id) continue
    options.push({
      label: c.name,
      value: c.id,
      subtitle: c.company || c.phone || c.city || ''
    })
  }

  return options
})

const productOptions = computed(() => {
  return productsList.value.map(p => ({
    label: `${p.sku} - ${p.name}`,
    value: p.id,
    subtitle: `Stock: ${p.stock ?? 0} ${p.unit || ''} | ₹${Number(p.price || 0).toLocaleString('en-IN')}`
  }))
})

const initForm = async () => {
  await loadData()
  errorMessage.value = ''
  
  const req = props.orderRequest
  if (!req) return

  const matched = props.matchedCustomer
  const fullAddress = [req.deliveryAddress, req.city, req.pincode].filter(Boolean).join(', ')

  form.value = {
    customerId: matched?.id || '',
    deliveryAddress: fullAddress || (matched?.address ? `${matched.address}, ${matched.city || ''}` : ''),
    paymentTerms: matched?.paymentTerms || 'Net 30',
    notes: req.notes || '',
    items: (req.items || []).map((it: any) => {
      // Match product by ID, SKU, or name
      const found = productsList.value.find((p: any) => 
        p.id === it.productId || 
        (it.sku && p.sku?.toLowerCase() === it.sku?.toLowerCase()) ||
        (it.productName && p.name?.toLowerCase() === it.productName?.toLowerCase())
      )

      return {
        productId: found?.id || it.productId || '',
        productSku: found?.sku || it.sku || '',
        productName: found?.name || it.productName || '',
        quantity: it.quantity || 1,
        unitPrice: typeof it.estimatedPrice === 'number' && it.estimatedPrice >= 0
          ? it.estimatedPrice 
          : (found?.price || 0),
        stock: found?.stock ?? undefined
      }
    })
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    initForm()
  }
})

const onCustomerChange = () => {
  if (!form.value.customerId) {
    const req = props.orderRequest
    if (req) {
      form.value.deliveryAddress = [req.deliveryAddress, req.city, req.pincode].filter(Boolean).join(', ')
    }
    return
  }
  const c = customersList.value.find(c => c.id === form.value.customerId)
  if (c) {
    const full = [c.address, c.city, c.state].filter(Boolean).join(', ')
    form.value.deliveryAddress = `${full}${c.pincode ? ' - ' + c.pincode : ''}`
    if (c.paymentTerms) {
      form.value.paymentTerms = c.paymentTerms
    }
  }
}

const onProductChange = (index: number) => {
  const item = form.value.items[index]
  const p = productsList.value.find(p => p.id === item.productId)
  if (p) {
    item.productSku = p.sku
    item.productName = p.name
    item.unitPrice = Number(p.price || 0)
    item.stock = p.stock
  }
}

const addItem = () => {
  form.value.items.push({
    productId: '',
    productSku: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
    stock: undefined
  })
}

const removeItem = (index: number) => {
  form.value.items.splice(index, 1)
}

const totalAmount = computed(() => {
  return form.value.items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0)
})

const closeModal = () => {
  if (!isSubmitting.value) {
    emit('close')
  }
}

const submitConversion = async () => {
  if (!props.orderRequest) return
  errorMessage.value = ''

  if (!form.value.items.length) {
    errorMessage.value = 'Please add at least one product item to create the sales order.'
    return
  }

  // Validate all items have a product selected
  for (let i = 0; i < form.value.items.length; i++) {
    const item = form.value.items[i]
    if (!item.productId) {
      errorMessage.value = `Item #${i + 1} has no product selected. Please select a valid catalog product or remove the row.`
      return
    }
    if (item.quantity <= 0) {
      errorMessage.value = `Item #${i + 1} quantity must be at least 1.`
      return
    }
  }

  isSubmitting.value = true
  try {
    const res = await $fetch<any>(`/api/order-requests/${props.orderRequest.id}/convert`, {
      method: 'POST',
      body: {
        customerId: form.value.customerId || undefined,
        deliveryAddress: form.value.deliveryAddress?.trim() || undefined,
        paymentTerms: form.value.paymentTerms,
        notes: form.value.notes?.trim() || undefined,
        salesPersonId: user.value?.id,
        items: form.value.items.map(it => ({
          productId: it.productId,
          sku: it.productSku,
          quantity: it.quantity,
          unitPrice: it.unitPrice
        }))
      }
    })

    if (res?.success) {
      notifyChange({ orderId: res.order?.id || res.orderId, action: 'ORDER_CREATED' })
      showSaved(`Sales Order ${res.orderNumber || ''} created successfully!`)
      emit('converted', res.order)
      emit('close')
    }
  } catch (err: any) {
    console.error('Failed to convert order request:', err)
    errorMessage.value = err?.data?.message || err?.message || 'Failed to convert order request to sales order'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeModal"></div>

      <!-- Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/90 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#1a5c4c]/10 text-[#1a5c4c] flex items-center justify-center shrink-0">
              <CheckCircle2 class="w-5 h-5 text-[#1a5c4c]" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-gray-900">Review & Create Sales Order</h2>
                <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                  {{ orderRequest?.requestNumber }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                Review customer terms, verify stock, and adjust pricing before generating the active sales order.
              </p>
            </div>
          </div>
          <button 
            type="button"
            @click="closeModal" 
            class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Section 1: Customer & Terms -->
          <div class="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-200 pb-2">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-700">Customer & Payment Terms</span>
              <span v-if="matchedCustomer" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck class="w-3 h-3" /> Registered Customer
              </span>
              <span v-else class="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                New Storefront Lead
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Customer Selection -->
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
                  Customer Account
                </label>
                <CustomSelect 
                  :modelValue="form.customerId"
                  @update:modelValue="val => { form.customerId = val; onCustomerChange() }"
                  :options="customerOptions"
                  searchable
                  searchPlaceholder="Search customer name, company, phone..."
                  placeholder="Select Customer Account"
                  class="w-full bg-white"
                />
              </div>

              <!-- Payment Terms -->
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
                  Payment Terms
                </label>
                <CustomSelect 
                  :modelValue="form.paymentTerms"
                  @update:modelValue="val => form.paymentTerms = val"
                  :options="paymentTermsOptions"
                  placeholder="Select Payment Terms"
                  class="w-full bg-white"
                />
              </div>

              <!-- Delivery Address -->
              <div class="md:col-span-2">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
                  Delivery Address
                </label>
                <textarea 
                  v-model="form.deliveryAddress" 
                  rows="2" 
                  class="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none"
                  placeholder="Enter full delivery destination..."
                ></textarea>
              </div>

              <!-- Internal Notes -->
              <div class="md:col-span-2">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
                  Order Remarks & Customer Notes
                </label>
                <textarea 
                  v-model="form.notes" 
                  rows="2" 
                  class="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none"
                  placeholder="Add special packing instructions, coupons, or notes..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Section 2: Items & Pricing Table -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">Order Items & Inventory Stock</h3>
                <p class="text-[11px] text-gray-400">Review requested quantities, adjust rates, or add extra items.</p>
              </div>
              <button 
                type="button" 
                @click="addItem" 
                class="px-2.5 py-1 text-xs font-bold text-[#1a5c4c] bg-[#1a5c4c]/10 hover:bg-[#1a5c4c]/20 rounded-lg transition flex items-center gap-1"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <!-- Items List -->
            <div class="space-y-2.5">
              <div 
                v-for="(item, idx) in form.items" 
                :key="idx" 
                class="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 hover:border-gray-300 transition"
              >
                <div class="grid grid-cols-12 gap-3 items-end">
                  
                  <!-- Product Select (6 cols) -->
                  <div class="col-span-12 sm:col-span-6">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                      Product Catalog Item #{{ idx + 1 }}
                    </label>
                    <CustomSelect 
                      :modelValue="item.productId"
                      @update:modelValue="val => { item.productId = val; onProductChange(idx) }"
                      :options="productOptions"
                      searchable
                      searchPlaceholder="Search by SKU or Product Name..."
                      placeholder="Select Catalog Product..."
                      class="w-full bg-white"
                    />
                  </div>

                  <!-- Qty (2 cols) -->
                  <div class="col-span-4 sm:col-span-2">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                      Qty
                    </label>
                    <input 
                      type="number" 
                      v-model.number="item.quantity" 
                      min="1" 
                      required 
                      class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                    />
                  </div>

                  <!-- Unit Price (2 cols) -->
                  <div class="col-span-4 sm:col-span-2">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                      Unit Price (₹)
                    </label>
                    <input 
                      type="number" 
                      v-model.number="item.unitPrice" 
                      min="0" 
                      step="any"
                      required 
                      class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                    />
                  </div>

                  <!-- Line Total & Delete (2 cols) -->
                  <div class="col-span-4 sm:col-span-2 flex items-center justify-between gap-1">
                    <div class="flex-1 text-right">
                      <span class="block text-[9px] uppercase font-bold text-gray-400">Total</span>
                      <span class="font-bold text-xs font-mono text-gray-900">
                        {{ formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0)) }}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      @click="removeItem(idx)" 
                      class="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Remove item"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Stock info row -->
                <div v-if="item.stock !== undefined" class="pt-1 flex items-center gap-2 text-[10px]">
                  <span 
                    v-if="item.stock >= item.quantity" 
                    class="text-emerald-700 font-semibold flex items-center gap-1"
                  >
                    <Check class="w-3 h-3 text-emerald-600" />
                    Stock available: {{ item.stock }} in warehouse
                  </span>
                  <span 
                    v-else-if="item.stock > 0" 
                    class="text-amber-700 font-semibold flex items-center gap-1"
                  >
                    <AlertCircle class="w-3 h-3 text-amber-600" />
                    Low stock: Only {{ item.stock }} available (short by {{ item.quantity - item.stock }})
                  </span>
                  <span 
                    v-else 
                    class="text-rose-700 font-semibold flex items-center gap-1"
                  >
                    <AlertCircle class="w-3 h-3 text-rose-600" />
                    Out of stock (0 available)
                  </span>
                </div>
              </div>

              <div v-if="!form.items.length" class="p-6 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                No items added. Click "+ Add Item" to add products.
              </div>
            </div>

            <!-- Grand Total -->
            <div class="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl mt-4">
              <div>
                <span class="text-xs font-bold text-gray-700 uppercase tracking-wider block">Estimated Total Order Value</span>
                <span class="text-[11px] text-gray-400">{{ form.items.length }} items selected</span>
              </div>
              <div class="text-right">
                <span class="font-mono text-xl font-bold text-[#1a5c4c]">
                  {{ formatCurrency(totalAmount) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
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
            @click="submitConversion" 
            :disabled="isSubmitting || !form.items.length"
            class="px-5 py-2.5 bg-[#1a5c4c] hover:bg-[#14473b] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <CheckCircle2 v-else class="w-4 h-4" />
            <span>{{ isSubmitting ? 'Creating Sales Order...' : 'Confirm & Generate Sales Order' }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
