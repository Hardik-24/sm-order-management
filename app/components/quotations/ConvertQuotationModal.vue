<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  X,
  Plus,
  Trash2,
  Zap,
  MapPin,
  UserCheck,
  Award,
  IndianRupee,
  Truck,
  Car,
  AlertCircle,
  Package,
  Loader2,
  Crown,
  CheckCircle2,
  ShoppingBag,
  PackageSearch,
  UserPlus
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useAuth } from '~/composables/useAuth'
import { useMasters } from '~/composables/useMasters'

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
const { showSaving, showSaved } = useSnackbar()
const { notifyChange } = useRealtimeSync()
const { paymentTermsOptions } = useMasters()

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
  taxRate: number
  isTaxInclusive: boolean
  itemNotes?: string
  mrp?: number
  discount?: number
  uom?: string
}

const form = ref({
  customerId: '',
  deliveryAddressId: '',
  deliveryAddress: '',
  vehicleMode: 'OUR_FLEET',
  paymentTerms: '',
  notes: '',
  isUrgent: false,
  items: [] as ConvertItemRow[]
})

const selectedCustomer = computed(() => {
  return customersList.value.find(c => c.id === form.value.customerId) || null
})

const isFirstOrderForCustomer = computed(() => {
  if (!selectedCustomer.value) return false
  const count = selectedCustomer.value.orderCount ?? selectedCustomer.value._count?.orders ?? 0
  return count === 0
})

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

  // If quotation customer is not matched to DB, offer creating new lead
  if (q && !matchedCustomer.value) {
    options.push({
      label: `➕ Create New Customer: ${q.customerName}`,
      value: '',
      subtitle: `Will auto-create customer record (${q.customerPlace || 'No place specified'})`
    })
  }

  for (const c of customersList.value) {
    const hasDistinctCompany = c.company && c.company.trim().toLowerCase() !== c.name?.trim().toLowerCase()
    const label = hasDistinctCompany ? `${c.name} (${c.company.trim()})` : (c.name || c.company || '')
    options.push({
      label,
      value: c.id,
      subtitle: [c.city, c.phone].filter(Boolean).join(' • ')
    })
  }

  return options
})

const addressOptions = computed(() => {
  const sc = selectedCustomer.value
  if (!sc?.addresses?.length) {
    if (sc?.address || sc?.city) {
      return [{
        label: 'Default Address',
        value: 'default',
        addressLine: [sc.address, sc.city, sc.state].filter(Boolean).join(', ')
      }]
    }
    return []
  }
  return sc.addresses.map((addr: any) => ({
    label: `${addr.label}${addr.isDefault ? ' (Default)' : ''}`,
    value: addr.id,
    addressLine: [addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
  }))
})

const productMap = computed(() => {
  const map: Record<string, any> = {}
  for (const p of productsList.value) {
    map[p.id] = p
  }
  return map
})

const getSelectedProduct = (productId?: string) => {
  if (!productId) return null
  return productMap.value[productId] || null
}

const productOptions = computed(() => {
  return productsList.value.map(p => ({
    label: p.sku === p.name ? p.name : `${p.sku} - ${p.name}`,
    value: p.id,
    stock: p.stock ?? 0,
    unit: p.unit || '',
    hsnCode: p.hsnCode || ''
  }))
})

const initForm = async () => {
  await loadData()
  errorMessage.value = ''

  const q = props.quotation
  if (!q) return

  const matched = matchedCustomer.value
  const targetCustomer = matched || null

  let fullAddress = ''
  let initialAddressId = ''

  if (targetCustomer) {
    if (targetCustomer.addresses && targetCustomer.addresses.length > 0) {
      const defaultAddr = targetCustomer.addresses.find((a: any) => a.isDefault) || targetCustomer.addresses[0]
      initialAddressId = defaultAddr.id
      fullAddress = [defaultAddr.addressLine, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(', ')
    } else {
      fullAddress = [targetCustomer.address, targetCustomer.city, targetCustomer.state].filter(Boolean).join(', ')
      if (targetCustomer.pincode) fullAddress += ` - ${targetCustomer.pincode}`
    }
  } else {
    fullAddress = q.customerPlace || ''
  }

  const isTaxInc = q.taxMode === 'INCLUSIVE'

  form.value = {
    customerId: targetCustomer?.id || '',
    deliveryAddressId: initialAddressId,
    deliveryAddress: fullAddress,
    vehicleMode: 'OUR_FLEET',
    paymentTerms: targetCustomer?.paymentTerms || '30 Days',
    notes: q.quoteNotes || '',
    isUrgent: false,
    items: []
  }

  // Pre-fill line items from quotation
  const rawItems: any[] = Array.isArray(q.items) ? q.items : []
  form.value.items = rawItems.map((it: any) => {
    const sku = String(it.articleNumber || it.sku || '').trim()
    const name = String(it.description || it.productName || it.name || sku).trim()

    // Try finding matching product in DB product catalog
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

    const taxRate = it.taxRate !== undefined && !isNaN(Number(it.taxRate))
      ? Number(it.taxRate)
      : (found?.taxRate !== null && found?.taxRate !== undefined ? Number(found.taxRate) : 18)

    return {
      productId: found?.id || undefined,
      articleNumber: sku || (found?.sku || 'CUSTOM'),
      description: name || (found?.name || 'Item'),
      quantity: Math.max(1, Number(it.quantity) || 1),
      unitPrice: Number(unitPrice) || 0,
      taxRate,
      isTaxInclusive: isTaxInc,
      itemNotes: it.itemNotes || '',
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
  const c = selectedCustomer.value
  if (c) {
    const isFirst = (c.orderCount ?? c._count?.orders ?? 0) === 0
    if (isFirst) {
      form.value.paymentTerms = c.paymentTerms && c.paymentTerms !== '30 Days' ? c.paymentTerms : ''
    } else {
      form.value.paymentTerms = c.paymentTerms || '30 Days'
    }

    if (c.addresses && c.addresses.length > 0) {
      const defaultAddr = c.addresses.find((a: any) => a.isDefault) || c.addresses[0]
      form.value.deliveryAddressId = defaultAddr.id
      form.value.deliveryAddress = [defaultAddr.addressLine, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(', ')
    } else {
      const full = [c.address, c.city, c.state].filter(Boolean).join(', ')
      form.value.deliveryAddressId = ''
      form.value.deliveryAddress = `${full}${c.pincode ? ' - ' + c.pincode : ''}`
    }
  } else {
    const q = props.quotation
    if (q) {
      form.value.deliveryAddress = q.customerPlace || ''
    }
  }
}

const onAddressSelect = (addrId: string) => {
  form.value.deliveryAddressId = addrId
  const chosen = addressOptions.value.find((a: any) => a.value === addrId)
  if (chosen) {
    form.value.deliveryAddress = chosen.addressLine
  }
}

const onProductSelect = (index: number, productId: string) => {
  const item = form.value.items[index]
  item.productId = productId
  const p = productsList.value.find((prod: any) => prod.id === productId)
  if (p) {
    item.articleNumber = p.sku || item.articleNumber
    item.description = p.name || item.description
    item.unitPrice = Number(p.price) || item.unitPrice
    item.uom = p.unit || item.uom
    if (p.taxRate !== null && p.taxRate !== undefined && !isNaN(Number(p.taxRate))) {
      item.taxRate = Number(p.taxRate)
    }
  }
}

const addItem = () => {
  form.value.items.push({
    articleNumber: 'CUSTOM',
    description: 'Additional Material / Item',
    quantity: 1,
    unitPrice: 0,
    taxRate: 18,
    isTaxInclusive: false,
    itemNotes: '',
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

// Calculations exactly matching create.vue:277-327
const calculateItemTotals = (item: { quantity: number; unitPrice: number; taxRate?: number; isTaxInclusive?: boolean }) => {
  const qty = Number(item.quantity || 0)
  const rate = Number(item.unitPrice || 0)
  const taxPct = Number(item.taxRate ?? 0)
  const isInc = Boolean(item.isTaxInclusive)

  if (isInc) {
    const total = qty * rate
    const taxable = taxPct > 0 ? (total / (1 + (taxPct / 100))) : total
    const taxAmount = total - taxable
    return {
      taxable: Number(taxable.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2))
    }
  } else {
    const taxable = qty * rate
    const taxAmount = taxable * (taxPct / 100)
    const total = taxable + taxAmount
    return {
      taxable: Number(taxable.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2))
    }
  }
}

const orderSummary = computed(() => {
  let subtotal = 0
  let totalTax = 0
  let grandTotal = 0

  for (const item of form.value.items) {
    const res = calculateItemTotals(item)
    subtotal += res.taxable
    totalTax += res.taxAmount
    grandTotal += res.total
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2))
  }
})

const getPrivilegeBadgeStyle = (tier: string) => {
  switch ((tier || '').toUpperCase()) {
    case 'PLATINUM': return 'bg-purple-50 text-purple-800 border-purple-300'
    case 'GOLD': return 'bg-amber-50 text-amber-800 border-amber-300'
    case 'SILVER': return 'bg-slate-50 text-slate-800 border-slate-300'
    default: return 'bg-orange-50 text-orange-800 border-orange-200'
  }
}

const getCustomerInitials = (name: string) => {
  if (!name) return 'C'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

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
      deliveryAddressId: form.value.deliveryAddressId || undefined,
      deliveryAddress: form.value.deliveryAddress?.trim() || undefined,
      paymentTerms: form.value.paymentTerms,
      vehicleMode: form.value.vehicleMode,
      isUrgent: form.value.isUrgent,
      notes: form.value.notes?.trim() || undefined,
      items: form.value.items.map(it => ({
        productId: it.productId || undefined,
        articleNumber: it.articleNumber,
        sku: it.articleNumber,
        description: it.description,
        productName: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        isTaxInclusive: it.isTaxInclusive,
        itemNotes: it.itemNotes || undefined,
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

      <!-- Modal Card (max-w-4xl matching create.vue max-w-4xl) -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header (Matching create.vue title + urgent toggle bar) -->
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50/90 shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center shrink-0">
              <ShoppingBag class="w-5 h-5 text-[#1b3b5f]" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight truncate">Review & Create Sales Order</h2>
                <span class="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700 shrink-0 font-mono">
                  {{ quotation?.quoteNumber }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                Pre-filled from quotation for <strong>{{ quotation?.customerName }}</strong>. Confirm terms to generate Sales Order.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Urgent Order Toggle Header (Matching create.vue:398-406 exact style) -->
            <label
              class="flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all shadow-2xs text-xs font-bold uppercase tracking-wider"
              :class="form.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
            >
              <input type="checkbox" v-model="form.isUrgent" class="w-3.5 h-3.5 text-rose-600 rounded focus:ring-rose-500" />
              <Zap class="w-3.5 h-3.5 text-rose-600" />
              <span class="hidden sm:inline">Urgent Order</span>
              <span class="sm:hidden">Urgent</span>
            </label>

            <button
              type="button"
              @click="closeModal"
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
              title="Close Modal"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Scrollable Form Body (Structured identically to create.vue) -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 text-xs">
          
          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Section 1: Customer Profile & Order Info (Matching create.vue:411-654) -->
          <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-2xs space-y-4">
            <div class="border-b border-gray-100 pb-2 mb-4 flex items-center justify-between gap-2">
              <h3 class="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider truncate">
                <span class="sm:hidden">Customer & Delivery</span>
                <span class="hidden sm:inline">Customer & Fulfillment Details</span>
              </h3>
              <span v-if="selectedCustomer" class="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 normal-case tracking-normal shadow-2xs">
                <CheckCircle2 class="w-3 h-3 text-emerald-600 shrink-0" />
                <span class="sm:hidden">Registered</span>
                <span class="hidden sm:inline">Registered Customer</span>
              </span>
              <span v-else class="shrink-0 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 normal-case tracking-normal shadow-2xs">
                <UserPlus class="w-3 h-3 text-blue-600 shrink-0" />
                <span class="sm:hidden">New Lead</span>
                <span class="hidden sm:inline">New Customer Lead</span>
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <!-- Customer Picker (Matching create.vue:419-485) -->
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer *</label>
                <CustomSelect
                  :modelValue="form.customerId"
                  @update:modelValue="val => { form.customerId = val; onCustomerChange() }"
                  :options="customerOptions"
                  searchable
                  searchPlaceholder="Search customers by name, company, city..."
                  placeholder="Select Customer"
                  class="w-full bg-white"
                />

                <!-- Selected Customer Info Banner (Enhanced & Mobile-Optimized) -->
                <div v-if="selectedCustomer" class="mt-3.5 p-3.5 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-sky-50/20 rounded-2xl border border-gray-200 shadow-2xs transition-all">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <!-- Left: Avatar, Name, Company, Code, & Badges -->
                    <div class="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
                      <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#1b3b5f] text-white flex items-center justify-center font-black text-sm sm:text-base shadow-xs shrink-0 tracking-wider">
                        {{ getCustomerInitials(selectedCustomer.name) }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h4 class="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight leading-snug">
                            {{ selectedCustomer.name }}
                          </h4>
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-extrabold text-[10px] uppercase tracking-wider border shadow-2xs"
                              :class="getPrivilegeBadgeStyle(selectedCustomer.privilegeTier || 'BRONZE')"
                            >
                              <Award class="w-3 h-3" />
                              <span>{{ selectedCustomer.privilegeTier || 'BRONZE' }}</span>
                            </span>

                            <span v-if="selectedCustomer.isPriorityClient" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-extrabold text-[10px] uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                              <Crown class="w-3 h-3" />
                              <span>Priority</span>
                            </span>

                            <span v-if="selectedCustomer.customerCode" class="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-gray-100 text-gray-600 border border-gray-200">
                              {{ selectedCustomer.customerCode }}
                            </span>
                          </div>
                        </div>

                        <div class="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1 flex-wrap">
                          <span v-if="selectedCustomer.company && selectedCustomer.company !== selectedCustomer.name" class="text-gray-700 font-semibold">{{ selectedCustomer.company }}</span>
                          <span v-if="selectedCustomer.company && selectedCustomer.company !== selectedCustomer.name && (selectedCustomer.city || selectedCustomer.phone)">•</span>
                          <span v-if="selectedCustomer.city" class="flex items-center gap-1 text-gray-600">
                            <MapPin class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {{ selectedCustomer.city }}
                          </span>
                          <span v-if="selectedCustomer.phone" class="text-gray-500 font-mono">{{ selectedCustomer.phone }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Account Manager row -->
                  <div v-if="selectedCustomer.customerManager" class="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-1.5 text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs text-[11px]">
                      <UserCheck class="w-3.5 h-3.5 text-[#1b3b5f]" />
                      <span>Account Manager: <strong class="text-gray-900 font-bold">{{ selectedCustomer.customerManager.name }}</strong></span>
                    </div>
                  </div>
                </div>

                <!-- New Customer Lead Info Banner (Mobile-Optimized) -->
                <div v-else-if="quotation && !form.customerId" class="mt-3.5 p-3.5 sm:p-5 bg-gradient-to-r from-blue-50/70 via-white to-sky-50/20 rounded-2xl border border-blue-200 shadow-2xs transition-all">
                  <div class="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
                    <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base shadow-xs shrink-0 tracking-wider">
                      {{ getCustomerInitials(quotation.customerName) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h4 class="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight leading-snug">
                          {{ quotation.customerName }}
                        </h4>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                          <UserPlus class="w-3 h-3 text-blue-600 shrink-0" />
                          <span>New Customer Lead</span>
                        </span>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1 flex-wrap">
                        <span v-if="quotation.customerPlace" class="flex items-center gap-1 text-gray-600">
                          <MapPin class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {{ quotation.customerPlace }}
                        </span>
                        <span v-if="quotation.customerPlace && quotation.customerPhone">•</span>
                        <span v-if="quotation.customerPhone" class="text-gray-600 font-mono">{{ quotation.customerPhone }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-2.5 pt-2 border-t border-blue-100/80 text-[11px] text-blue-700 flex items-center gap-1.5 font-medium">
                    <span>⚡ Order will auto-create this customer profile in database upon confirmation.</span>
                  </div>
                </div>
              </div>

              <!-- Placed By (Matching create.vue:488-492) -->
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Created By</label>
                <input :value="user?.name || quotation?.createdByName || 'Sales Staff'" disabled class="w-full text-sm border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed" />
              </div>

              <!-- Payment Terms (Matching create.vue:494-517) -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Terms *</label>
                  <span v-if="isFirstOrderForCustomer" class="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    ★ 1st Order (Saves as Default)
                  </span>
                  <span v-else-if="selectedCustomer?.paymentTerms" class="text-[10px] text-gray-400">
                    Default: <strong class="text-gray-700">{{ selectedCustomer.paymentTerms }}</strong>
                  </span>
                </div>
                <CustomSelect
                  :modelValue="form.paymentTerms"
                  @update:modelValue="val => form.paymentTerms = val"
                  :options="paymentTermsOptions"
                  placeholder="Select Terms"
                  class="w-full bg-white"
                />
              </div>

              <!-- Transport / Vehicle Selection Mode (Matching create.vue:520-626 exact 3 cards) -->
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Transport & Delivery Vehicle *</span>
                  <span class="hidden md:inline text-[11px] font-semibold" :class="form.vehicleMode === 'OUR_FLEET' ? 'text-[#1b3b5f]' : (form.vehicleMode === 'THIRD_PARTY' ? 'text-indigo-700' : 'text-amber-700')">
                    {{ form.vehicleMode === 'OUR_FLEET' ? '✓ Company Fleet Dispatch' : (form.vehicleMode === 'THIRD_PARTY' ? '📦 Third Party (Porter/Rapido Handover)' : '🚗 Party Transport (Direct Handover)') }}
                  </span>
                </label>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <!-- Option 1: Our Fleet -->
                  <div
                    @click="form.vehicleMode = 'OUR_FLEET'"
                    class="p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none"
                    :class="form.vehicleMode === 'OUR_FLEET'
                      ? 'border-[#1b3b5f] bg-emerald-50/50 shadow-xs ring-1 ring-[#1b3b5f]/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'"
                  >
                    <div
                      class="p-2 sm:p-2.5 rounded-lg shrink-0 mt-0.5 transition-colors"
                      :class="form.vehicleMode === 'OUR_FLEET' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-500'"
                    >
                      <Truck class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-gray-900">Our Vehicle (Fleet)</span>
                        <span v-if="form.vehicleMode === 'OUR_FLEET'" class="w-2 h-2 rounded-full bg-[#1b3b5f]"></span>
                      </div>
                      <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Bundled into fleet trips. Drivers assigned via OMS with GPS tracking.
                      </p>
                    </div>
                  </div>

                  <!-- Option 2: Party Vehicle -->
                  <div
                    @click="form.vehicleMode = 'PARTY_VEHICLE'"
                    class="p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none"
                    :class="form.vehicleMode === 'PARTY_VEHICLE'
                      ? 'border-amber-600 bg-amber-50/60 shadow-xs ring-1 ring-amber-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'"
                  >
                    <div
                      class="p-2 sm:p-2.5 rounded-lg shrink-0 mt-0.5 transition-colors"
                      :class="form.vehicleMode === 'PARTY_VEHICLE' ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 text-gray-500'"
                    >
                      <Car class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-gray-900">Party Vehicle</span>
                        <span v-if="form.vehicleMode === 'PARTY_VEHICLE'" class="w-2 h-2 rounded-full bg-amber-600"></span>
                      </div>
                      <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Customer sends own vehicle. Staff marks as Handed Over directly.
                      </p>
                    </div>
                  </div>

                  <!-- Option 3: Third Party -->
                  <div
                    @click="form.vehicleMode = 'THIRD_PARTY'"
                    class="p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none"
                    :class="form.vehicleMode === 'THIRD_PARTY'
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'"
                  >
                    <div
                      class="p-2 sm:p-2.5 rounded-lg shrink-0 mt-0.5 transition-colors"
                      :class="form.vehicleMode === 'THIRD_PARTY' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-500'"
                    >
                      <Package class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-gray-900">Third Party (Porter)</span>
                        <span v-if="form.vehicleMode === 'THIRD_PARTY'" class="w-2 h-2 rounded-full bg-indigo-600"></span>
                      </div>
                      <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Porter, Rapido or transport. Staff marks as Handed Over directly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Registered Address Picker Dropdown (Matching create.vue:629-640) -->
              <div v-if="addressOptions.length > 1" class="md:col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Select Registered Destination Address
                </label>
                <CustomSelect
                  :modelValue="form.deliveryAddressId"
                  @update:modelValue="onAddressSelect"
                  :options="addressOptions"
                  placeholder="Choose destination address..."
                  class="w-full bg-white"
                />
              </div>

              <!-- Delivery Address Textarea (Matching create.vue:643-646) -->
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  <span class="sm:hidden">Delivery Address *</span>
                  <span class="hidden sm:inline">Delivery Address (Site / Destination) *</span>
                </label>
                <textarea
                  v-model="form.deliveryAddress"
                  rows="2"
                  class="w-full text-sm border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"
                  required
                  placeholder="Delivery address, site or landmark..."
                ></textarea>
              </div>

              <!-- Internal Order Notes (Matching create.vue:649-652) -->
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  <span class="sm:hidden">Internal Dispatch Notes</span>
                  <span class="hidden sm:inline">Internal Order Instructions / Dispatch Notes</span>
                </label>
                <textarea
                  v-model="form.notes"
                  rows="2"
                  class="w-full text-sm border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"
                  placeholder="e.g. Call before arrival, gate timing, site contact..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Section 2: Order Items (Matching create.vue:657-863 exact item cards) -->
          <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-2xs space-y-4">
            <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
              <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items</h3>
              <button
                type="button"
                @click="addItem"
                class="text-xs font-bold text-[#1b3b5f] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div class="space-y-4">
              <div
                v-for="(item, idx) in form.items"
                :key="idx"
                class="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200 space-y-3"
              >
                <!-- Mobile Item Card Header: Index tag + Remove action -->
                <div class="flex items-center justify-between md:hidden pb-1.5 border-b border-gray-200/60">
                  <span class="text-xs font-bold font-mono text-gray-600 bg-gray-200/70 px-2 py-0.5 rounded">
                    #{{ idx + 1 }} Item
                  </span>
                  <button
                    type="button"
                    @click="removeItem(idx)"
                    :disabled="form.items.length <= 1"
                    class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove Item"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div class="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                  <!-- Product Select or Custom Name (Matching create.vue:668-718) -->
                  <div class="flex-1 w-full min-w-0">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Product Item #{{ idx + 1 }} *</label>
                    <CustomSelect
                      :modelValue="item.productId"
                      @update:modelValue="val => onProductSelect(idx, val)"
                      :options="productOptions"
                      searchable
                      searchPlaceholder="Search product by SKU or name..."
                      :placeholder="item.description || 'Select Catalog Product'"
                      class="w-full bg-white"
                    />

                    <!-- Live Stock Badge right below product (Matching create.vue:682-717) -->
                    <div v-if="getSelectedProduct(item.productId)" class="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border shadow-2xs transition-colors"
                        :class="[
                          Number(getSelectedProduct(item.productId)?.stock ?? 0) <= 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : Number(getSelectedProduct(item.productId)?.stock ?? 0) < 10
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        ]"
                      >
                        <span
                          class="w-2 h-2 rounded-full"
                          :class="[
                            Number(getSelectedProduct(item.productId)?.stock ?? 0) <= 0
                              ? 'bg-rose-500'
                              : Number(getSelectedProduct(item.productId)?.stock ?? 0) < 10
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          ]"
                        ></span>
                        <span>
                          Stock: <strong class="font-bold">{{ getSelectedProduct(item.productId)?.stock ?? 0 }}</strong> {{ getSelectedProduct(item.productId)?.unit || 'units' }}
                        </span>
                        <span v-if="Number(getSelectedProduct(item.productId)?.stock ?? 0) <= 0" class="text-[10px] font-bold text-rose-600 uppercase tracking-wide">
                          (Out of Stock)
                        </span>
                        <span v-else-if="Number(getSelectedProduct(item.productId)?.stock ?? 0) < 10" class="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                          (Low Stock)
                        </span>
                      </span>

                      <span v-if="getSelectedProduct(item.productId)?.category?.name" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        {{ getSelectedProduct(item.productId)?.category?.name }}
                      </span>
                    </div>

                    <!-- Quoted Origin Pill (If imported from Google Sheet/Quotation) -->
                    <div v-else class="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                      <span class="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-semibold">
                        {{ item.articleNumber }}
                      </span>
                      <span class="truncate">{{ item.description }}</span>
                    </div>
                  </div>

                  <!-- Quantity, Rate, Tax %, Total (Clean 2x2 grid on mobile, inline on desktop) -->
                  <div class="w-full md:w-auto">
                    <div class="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-end gap-2.5 sm:gap-2">
                      <!-- Qty -->
                      <div class="col-span-1 md:w-20">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Qty *</label>
                        <input
                          type="number"
                          v-model.number="item.quantity"
                          min="1"
                          required
                          class="w-full border border-gray-300 rounded-lg shadow-2xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                        />
                      </div>

                      <!-- Unit Price (Rate) -->
                      <div class="col-span-1 md:w-28">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center gap-1 truncate">
                          <IndianRupee class="w-3 h-3 text-gray-400 shrink-0" />
                          <span>Rate *</span>
                        </label>
                        <div class="relative flex items-center">
                          <IndianRupee class="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          <input
                            type="number"
                            v-model.number="item.unitPrice"
                            min="0"
                            step="0.01"
                            required
                            class="w-full pl-6 border border-gray-300 rounded-lg shadow-2xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                          />
                        </div>
                      </div>

                      <!-- Tax Rate % -->
                      <div class="col-span-1 md:w-20">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 truncate">
                          <span>Tax %</span>
                        </label>
                        <div class="relative flex items-center">
                          <input
                            type="number"
                            v-model.number="item.taxRate"
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="18"
                            class="w-full pr-5 border border-gray-300 rounded-lg shadow-2xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f] text-right"
                          />
                          <span class="absolute right-1.5 text-xs font-semibold text-gray-400 pointer-events-none">%</span>
                        </div>
                      </div>

                      <!-- Line Total -->
                      <div class="col-span-1 md:w-28">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center justify-between">
                          <span>Total</span>
                          <span v-if="item.isTaxInclusive" class="text-[8px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">INCL</span>
                          <span v-else class="text-[8px] font-bold text-gray-600 bg-gray-100 px-1 py-0.2 rounded border border-gray-200">+TAX</span>
                        </label>
                        <div class="p-2 bg-white sm:bg-gray-50 text-gray-900 rounded-lg font-bold text-xs sm:text-sm border border-gray-200 truncate text-right shadow-2xs">
                          {{ formatCurrency(calculateItemTotals(item).total) }}
                        </div>
                      </div>

                      <!-- Remove (Desktop only) -->
                      <div class="hidden md:flex md:w-auto justify-center pb-0.5">
                        <button
                          type="button"
                          @click="removeItem(idx)"
                          :disabled="form.items.length <= 1"
                          class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove Item"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Item-Level Options & Notes (Matching create.vue:780-857 exact sub-bar) -->
                <div class="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200/60 text-xs">
                  <!-- Tax Inclusive Toggle -->
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      v-model="item.isTaxInclusive"
                      class="w-3.5 h-3.5 rounded text-[#1b3b5f] focus:ring-[#1b3b5f]"
                    />
                    <span class="text-gray-700 font-medium">Tax Inclusive Rate</span>
                    <span v-if="item.isTaxInclusive" class="text-[10px] text-blue-600 font-semibold">(Tax incl.)</span>
                    <span v-else class="text-[10px] text-gray-500">(+{{ item.taxRate ?? 0 }}% Tax)</span>
                  </label>

                  <!-- Item Notes Input -->
                  <div class="flex-1 w-full sm:w-auto min-w-[200px]">
                    <input
                      type="text"
                      v-model="item.itemNotes"
                      placeholder="Note (e.g. edge-banding, batch)..."
                      class="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-[#1b3b5f]"
                    />
                  </div>

                  <!-- Item Breakdown Mini-Pill -->
                  <div class="text-[11px] text-gray-500 font-medium ml-auto flex items-center gap-2">
                    <span>Taxable: <strong class="text-gray-700">{{ formatCurrency(calculateItemTotals(item).taxable) }}</strong></span>
                    <span>•</span>
                    <span>Tax: <strong class="text-gray-700">{{ formatCurrency(calculateItemTotals(item).taxAmount) }}</strong></span>
                  </div>
                </div>
              </div>

              <!-- Polished Empty State Box -->
              <div 
                v-if="!form.items.length" 
                class="my-3 px-4 py-8 sm:py-10 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center transition-all"
              >
                <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-slate-400 mb-3">
                  <PackageSearch class="w-6 h-6 text-[#1b3b5f]/70" />
                </div>
                <p class="text-sm font-bold text-gray-800">No products added yet</p>
                <p class="text-xs text-gray-500 mt-1 max-w-xs">
                  Click below to select products and build your order.
                </p>
                <button
                  type="button"
                  @click="addItem"
                  class="mt-4 px-4 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>+ Add Product</span>
                </button>
              </div>
            </div>

            <!-- Order Totals & Tax Summary (Matching create.vue:865-895 exact layout & typography) -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-5 border-t border-gray-200 mt-6 gap-4">
              <div class="text-xs text-gray-500 space-y-1">
                <p class="flex items-center gap-1.5 font-medium">
                  <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                  <span><strong>Tax Inclusive:</strong> Rate includes GST. Taxable base is calculated automatically.</span>
                </p>
                <p class="flex items-center gap-1.5 font-medium">
                  <span class="w-2 h-2 rounded-full bg-gray-400 shrink-0"></span>
                  <span><strong>Tax Exclusive:</strong> GST is added to the subtotal of the line item.</span>
                </p>
              </div>

              <div class="w-full sm:w-80 bg-gray-50/80 rounded-xl p-4 border border-gray-200 space-y-2 text-xs self-end">
                <div class="flex justify-between items-center text-gray-600">
                  <span>Taxable Subtotal</span>
                  <span class="font-semibold text-gray-900">{{ formatCurrency(orderSummary.subtotal) }}</span>
                </div>
                <div class="flex justify-between items-center text-gray-600">
                  <span>Total GST / Tax</span>
                  <span class="font-semibold text-gray-900">{{ formatCurrency(orderSummary.totalTax) }}</span>
                </div>
                <div class="pt-2.5 border-t border-gray-200 flex justify-between items-center">
                  <span class="text-xs font-bold text-gray-900 uppercase tracking-wider">Total Amount</span>
                  <span class="text-2xl font-black text-[#1b3b5f] flex items-baseline">
                    <OdometerNumber :value="orderSummary.grandTotal" prefix="₹" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
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
            class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold shadow-md shadow-emerald-900/10 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
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
