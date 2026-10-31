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
  ShoppingBag,
  IndianRupee,
  Clock,
  Truck
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{
  modelValue: boolean
  quotation: any | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'converted', order: any): void
}>()

const { user } = useAuth()
const { showSaved, showEditing } = useSnackbar()
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

interface ConvertItemRow {
  productId?: string
  articleNumber: string
  description: string
  quantity: number
  unitPrice: number
  mrp?: number
  discount?: number
  uom?: string
}

const form = ref({
  customerId: '',
  deliveryAddress: '',
  paymentTerms: 'Net 30',
  vehicleMode: 'OUR_FLEET',
  isUrgent: false,
  notes: '',
  taxMode: 'EXTRA',
  items: [] as ConvertItemRow[]
})

const paymentTermsOptions = [
  { label: 'Net 30 (Default)', value: 'Net 30' },
  { label: 'Immediate / Due on Receipt', value: 'Immediate' },
  { label: 'Net 15', value: 'Net 15' },
  { label: 'Net 45', value: 'Net 45' },
  { label: 'Net 60', value: 'Net 60' },
  { label: 'Advance Payment', value: 'Advance Payment' },
  { label: 'Cash on Delivery (COD)', value: 'COD' }
]

const vehicleModeOptions = [
  { label: 'Our Fleet Delivery', value: 'OUR_FLEET' },
  { label: 'Party Vehicle Pickup', value: 'PARTY_VEHICLE' },
  { label: 'Third Party Transport (Porter/Rapido)', value: 'THIRD_PARTY' }
]

const matchedCustomer = computed(() => {
  const q = props.quotation
  if (!q || !customersList.value.length) return null

  // 1. Match by phone
  if (q.customerPhone) {
    const cleanPhone = String(q.customerPhone).replace(/\D/g, '')
    if (cleanPhone) {
      const byPhone = customersList.value.find(c => {
        const cPhone = String(c.phone || '').replace(/\D/g, '')
        return cPhone && (cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone))
      })
      if (byPhone) return byPhone
    }
  }

  // 2. Match by exact or trimmed name/company
  if (q.customerName) {
    const qName = String(q.customerName).trim().toLowerCase()
    const byName = customersList.value.find(c => {
      const cName = String(c.name || '').trim().toLowerCase()
      const cComp = String(c.company || '').trim().toLowerCase()
      return cName === qName || cComp === qName
    })
    if (byName) return byName
  }

  return null
})

const customerOptions = computed(() => {
  const q = props.quotation
  const options: Array<{ label: string; value: string; subtitle?: string }> = []

  if (q) {
    const matched = matchedCustomer.value
    if (matched) {
      options.push({
        label: `${matched.name} (${matched.company || 'Existing Customer'})`,
        value: matched.id,
        subtitle: `Auto-matched: ${matched.phone || matched.city || ''}`
      })
    } else {
      options.push({
        label: `➕ Create New Customer: ${q.customerName}`,
        value: '',
        subtitle: `Will auto-create customer record (${q.customerPlace || 'No place specified'})`
      })
    }
  }

  // List all other customers
  for (const c of customersList.value) {
    if (matchedCustomer.value && c.id === matchedCustomer.value.id) continue
    options.push({
      label: c.name,
      value: c.id,
      subtitle: [c.company, c.city, c.phone].filter(Boolean).join(' • ')
    })
  }

  return options
})

const initForm = async () => {
  await loadData()
  errorMessage.value = ''

  const q = props.quotation
  if (!q) return

  const matched = matchedCustomer.value
  const fullAddress = matched?.address
    ? [matched.address, matched.city, matched.pincode].filter(Boolean).join(', ')
    : (q.customerPlace || '')

  form.value = {
    customerId: matched?.id || '',
    deliveryAddress: fullAddress,
    paymentTerms: matched?.paymentTerms || 'Net 30',
    vehicleMode: 'OUR_FLEET',
    isUrgent: false,
    notes: q.quoteNotes || '',
    taxMode: q.taxMode || 'EXTRA',
    items: []
  }

  // Pre-fill line items from quotation
  const rawItems: any[] = Array.isArray(q.items) ? q.items : []
  form.value.items = rawItems.map((it: any) => {
    const sku = String(it.articleNumber || it.sku || '').trim()
    const name = String(it.description || it.productName || it.name || sku).trim()

    // Try finding matching product in DB product list
    const found = productsList.value.find((p: any) =>
      (sku && p.sku?.toLowerCase() === sku.toLowerCase()) ||
      (name && p.name?.toLowerCase() === name.toLowerCase())
    )

    const mrp = Number(it.mrp) || Number(it.price) || Number(found?.price) || 0
    const discount = Number(it.discount) || 0
    const calculatedRate = mrp > 0 ? mrp * (1 - discount / 100) : (Number(it.unitPrice) || 0)
    const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice > 0
      ? it.unitPrice
      : (calculatedRate > 0 ? Number(calculatedRate.toFixed(2)) : (Number(found?.price) || 0))

    return {
      productId: found?.id || undefined,
      articleNumber: sku || (found?.sku || 'CUSTOM'),
      description: name || (found?.name || 'Item'),
      quantity: Math.max(1, Number(it.quantity) || 1),
      unitPrice: Number(unitPrice) || 0,
      mrp,
      discount,
      uom: it.uom || found?.unit || 'PIECE'
    }
  })
}

watch(() => props.modelValue, (open) => {
  if (open) {
    initForm()
  }
})

const onCustomerChange = () => {
  if (!form.value.customerId) {
    const q = props.quotation
    if (q) {
      form.value.deliveryAddress = q.customerPlace || ''
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

const addItem = () => {
  form.value.items.push({
    articleNumber: 'CUSTOM',
    description: 'Additional Material / Item',
    quantity: 1,
    unitPrice: 0,
    uom: 'PIECE'
  })
}

const removeItem = (idx: number) => {
  if (form.value.items.length <= 1) {
    errorMessage.value = 'Sales order must have at least one line item.'
    return
  }
  form.value.items.splice(idx, 1)
}

const subtotal = computed(() => {
  return form.value.items.reduce((acc, it) => {
    const qty = Number(it.quantity) || 0
    const price = Number(it.unitPrice) || 0
    return acc + (qty * price)
  }, 0)
})

const gstAmount = computed(() => {
  if (form.value.taxMode !== 'EXTRA') return 0
  return Number((subtotal.value * 0.18).toFixed(2))
})

const grandTotal = computed(() => {
  return Number((subtotal.value + gstAmount.value).toFixed(2))
})

const closeModal = () => {
  if (!isSubmitting.value) {
    emit('update:modelValue', false)
    emit('close')
  }
}

const submitConversion = async () => {
  if (!props.quotation) return
  errorMessage.value = ''

  if (!form.value.items.length) {
    errorMessage.value = 'Please include at least one product item to create the sales order.'
    return
  }

  for (let i = 0; i < form.value.items.length; i++) {
    const it = form.value.items[i]
    if (!it.description && !it.articleNumber) {
      errorMessage.value = `Item #${i + 1} requires a valid description or article number.`
      return
    }
    if (it.quantity <= 0) {
      errorMessage.value = `Item #${i + 1} quantity must be at least 1.`
      return
    }
  }

  isSubmitting.value = true
  try {
    const payload = {
      customerId: form.value.customerId || undefined,
      deliveryAddress: form.value.deliveryAddress?.trim() || undefined,
      paymentTerms: form.value.paymentTerms,
      vehicleMode: form.value.vehicleMode,
      isUrgent: form.value.isUrgent,
      notes: form.value.notes?.trim() || undefined,
      taxMode: form.value.taxMode,
      items: form.value.items.map(it => ({
        productId: it.productId || undefined,
        articleNumber: it.articleNumber,
        sku: it.articleNumber,
        description: it.description,
        productName: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        uom: it.uom
      }))
    }

    const res = await $fetch<any>(`/api/quotations/${props.quotation.id}/convert`, {
      method: 'POST',
      body: payload
    })

    if (res?.success) {
      notifyChange({ orderId: res.order?.id || res.orderId, action: 'ORDER_CREATED' })
      showSaved(`Sales Order ${res.orderNumber || ''} created successfully from Quote ${props.quotation.quoteNumber}!`)
      emit('converted', res.order)
      emit('update:modelValue', false)
      emit('close')
    } else {
      throw new Error(res?.error || 'Could not convert quotation to order')
    }
  } catch (err: any) {
    console.error('Failed to convert quotation to order:', err)
    errorMessage.value = err?.data?.message || err?.message || 'Failed to convert quotation to order. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[350] flex items-center justify-center p-2 sm:p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeModal"></div>

      <!-- Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50/90 shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <ShoppingBag class="w-5 h-5 text-emerald-700" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-sm sm:text-base font-bold text-gray-900 truncate">Convert Quotation to Sales Order</h2>
                <span class="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  {{ quotation?.quoteNumber }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                Prefilled from quote for <strong>{{ quotation?.customerName }}</strong>. Confirm details to generate confirmed Sales Order.
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="closeModal"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer shrink-0 ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs">
          
          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Section 1: Customer & Terms -->
          <div class="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-200 pb-2">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-700">Customer & Delivery Configuration</span>
              <span v-if="matchedCustomer" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck class="w-3 h-3" /> Matched DB Customer
              </span>
              <span v-else class="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                New Customer Record
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
                  placeholder="Select or Create Customer"
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
                  Delivery Address / Site Destination
                </label>
                <textarea
                  v-model="form.deliveryAddress"
                  rows="2"
                  class="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"
                  placeholder="Enter full delivery destination or site location..."
                ></textarea>
              </div>

              <!-- Vehicle / Logistics Mode -->
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
                  Dispatch / Vehicle Mode
                </label>
                <CustomSelect
                  :modelValue="form.vehicleMode"
                  @update:modelValue="val => form.vehicleMode = val"
                  :options="vehicleModeOptions"
                  placeholder="Select Vehicle Mode"
                  class="w-full bg-white"
                />
              </div>

              <!-- Urgent Toggle -->
              <div class="flex items-center gap-2 pt-5">
                <label class="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    v-model="form.isUrgent"
                    class="w-4 h-4 text-[#1b3b5f] rounded border-gray-300 focus:ring-[#1b3b5f]"
                  />
                  <span>Mark as Urgent Dispatch (Priority Order)</span>
                </label>
              </div>

              <!-- Internal Notes -->
              <div class="md:col-span-2">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
                  Order Remarks & Customer Notes
                </label>
                <textarea
                  v-model="form.notes"
                  rows="2"
                  class="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"
                  placeholder="Add special delivery instructions or quotation notes..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Section 2: Items & Pricing Table -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700">Order Items (Prefilled from Quotation)</h3>
                <p class="text-[11px] text-gray-400">Review quantities and net pricing before generating confirmed Sales Order.</p>
              </div>
              <button
                type="button"
                @click="addItem"
                class="px-2.5 py-1 text-xs font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 hover:bg-[#1b3b5f]/20 rounded-lg transition flex items-center gap-1 cursor-pointer"
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
                  <!-- Article No / SKU (3 cols) -->
                  <div class="col-span-12 sm:col-span-3">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                      Article / Code #{{ idx + 1 }}
                    </label>
                    <input
                      type="text"
                      v-model="item.articleNumber"
                      placeholder="e.g. 524.23.100"
                      class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                    />
                  </div>

                  <!-- Description (4 cols) -->
                  <div class="col-span-12 sm:col-span-4">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      v-model="item.description"
                      placeholder="Product Name / Spec"
                      class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
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
                      class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                    />
                  </div>

                  <!-- Net Unit Rate (2 cols) -->
                  <div class="col-span-5 sm:col-span-2">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                      Rate (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      v-model.number="item.unitPrice"
                      min="0"
                      class="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                    />
                  </div>

                  <!-- Remove Action (1 col) -->
                  <div class="col-span-3 sm:col-span-1 flex justify-end pb-1">
                    <button
                      type="button"
                      @click="removeItem(idx)"
                      :disabled="form.items.length <= 1"
                      class="p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove item"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Line Total Display -->
                <div class="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-200/60 pt-1.5 px-1">
                  <span>Line Total:</span>
                  <span class="font-bold text-gray-900">
                    {{ formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Totals Card -->
            <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="text-xs text-gray-500">
                <span>Total Items: </span>
                <span class="font-bold text-gray-800">{{ form.items.length }}</span>
                <span class="mx-2 text-gray-300">&bull;</span>
                <span>Tax Mode: </span>
                <span class="font-bold text-gray-800">{{ form.taxMode === 'EXTRA' ? 'GST 18% Extra' : 'GST Inclusive' }}</span>
              </div>

              <div class="flex items-center gap-4 text-xs">
                <div v-if="form.taxMode === 'EXTRA'" class="text-right">
                  <div class="text-[10px] uppercase font-bold text-gray-400">GST (18%)</div>
                  <div class="font-semibold text-gray-700">{{ formatCurrency(gstAmount) }}</div>
                </div>

                <div class="text-right pl-4 border-l border-gray-200">
                  <div class="text-[10px] uppercase font-bold text-gray-400">Total Order Value</div>
                  <div class="text-base font-extrabold text-[#1b3b5f]">{{ formatCurrency(grandTotal) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            @click="closeModal"
            :disabled="isSubmitting"
            class="px-4 py-2 border border-gray-300 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            @click="submitConversion"
            :disabled="isSubmitting"
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold shadow-md shadow-emerald-900/10 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <ShoppingBag v-else class="w-4 h-4" />
            <span>{{ isSubmitting ? 'Converting to Order...' : 'Confirm & Create Sales Order' }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
