<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { X, Plus, Trash2, Zap, MapPin, UserCheck, ShieldAlert, Award, FileText, IndianRupee, Truck, Car, AlertCircle, Package, Loader2, Clock, Crown, Check, Tag } from 'lucide-vue-next'
import { formatCurrency, formatDate } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()
const { showSaving, showSaved, hide } = useSnackbar()
const { paymentTermsOptions } = useMasters()
const { animateModalOpen, initContext } = useGsapAnimation()

const customerBannerRef = ref<HTMLElement | null>(null)
const itemsContainerRef = ref<HTMLElement | null>(null)

const form = ref({
  customerId: '',
  deliveryAddressId: '',
  deliveryAddress: '',
  vehicleMode: 'OUR_FLEET',
  paymentTerms: '',
  notes: '',
  isUrgent: false,
  items: [] as Array<{ 
    productId: string
    productSku?: string
    quantity: number
    unitPrice: number
    taxRate: number
    isTaxInclusive: boolean
    applyLastPrice: boolean
    itemNotes: string
  }>
})

const { data: customers } = await useFetch('/api/customers')
const { data: products } = await useFetch('/api/products')

const selectedCustomer = computed(() => {
  return (customers.value as any[] || []).find(c => c.id === form.value.customerId)
})

const customerOptions = computed(() => {
  return (customers.value as any[] || []).map(c => ({
    label: `${c.customerCode ? `[${c.customerCode}] ` : ''}${c.name} ${c.company ? `(${c.company})` : ''}`,
    value: c.id,
    subtitle: c.city ? `${c.city} • ${c.phone}` : c.phone
  }))
})

const addressOptions = computed(() => {
  if (!selectedCustomer.value?.addresses?.length) {
    if (selectedCustomer.value?.address || selectedCustomer.value?.city) {
      return [{
        label: 'Default Address',
        value: 'default',
        addressLine: [selectedCustomer.value.address, selectedCustomer.value.city, selectedCustomer.value.state].filter(Boolean).join(', ')
      }]
    }
    return []
  }
  return selectedCustomer.value.addresses.map((addr: any) => ({
    label: `${addr.label}${addr.isDefault ? ' (Default)' : ''}`,
    value: addr.id,
    addressLine: [addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
  }))
})

const productMap = computed(() => {
  const map: Record<string, any> = {}
  for (const p of (products.value as any[] || [])) {
    map[p.id] = p
  }
  return map
})

const getSelectedProduct = (productId: string) => {
  if (!productId) return null
  return productMap.value[productId] || null
}

const productOptions = computed(() => {
  return (products.value as any[] || []).map(p => ({
    label: p.sku === p.name ? p.name : `${p.sku} - ${p.name}`,
    value: p.id,
    subtitle: p.hsnCode ? `HSN: ${p.hsnCode}` : '',
    stock: p.stock ?? 0,
    unit: p.unit || ''
  }))
})

const isFirstOrderForCustomer = computed(() => {
  if (!selectedCustomer.value) return false
  const count = selectedCustomer.value.orderCount ?? selectedCustomer.value._count?.orders ?? 0
  return count === 0
})

const onCustomerChange = () => {
  const c = selectedCustomer.value
  if (c) {
    const isFirst = (c.orderCount ?? c._count?.orders ?? 0) === 0
    if (isFirst) {
      // First order for this customer:
      // If customer has a specific custom term set, use it; otherwise leave blank so salesperson selects the party's terms
      form.value.paymentTerms = c.paymentTerms && c.paymentTerms !== '30 Days' ? c.paymentTerms : ''
    } else {
      // Subsequent order: load established master payment terms
      form.value.paymentTerms = c.paymentTerms || '30 Days'
    }
    
    // Auto-select default address if available
    if (c.addresses && c.addresses.length > 0) {
      const defaultAddr = c.addresses.find((a: any) => a.isDefault) || c.addresses[0]
      form.value.deliveryAddressId = defaultAddr.id
      form.value.deliveryAddress = [defaultAddr.addressLine, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(', ')
    } else {
      const fullAddress = [c.address, c.city, c.state].filter(Boolean).join(', ')
      form.value.deliveryAddressId = ''
      form.value.deliveryAddress = `${fullAddress}${c.pincode ? ' - ' + c.pincode : ''}`
    }

    nextTick(() => {
      if (customerBannerRef.value) {
        animateModalOpen(customerBannerRef.value, null, { duration: 0.25 })
      }
    })
  }
}

const onAddressSelect = (addrId: string) => {
  form.value.deliveryAddressId = addrId
  const chosen = addressOptions.value.find((a: any) => a.value === addrId)
  if (chosen) {
    form.value.deliveryAddress = chosen.addressLine
  }
}

const addItem = () => {
  form.value.items.push({ 
    productId: '', 
    quantity: 1, 
    unitPrice: 0,
    taxRate: 18,
    isTaxInclusive: false,
    applyLastPrice: false,
    itemNotes: ''
  })

  nextTick(() => {
    if (itemsContainerRef.value?.lastElementChild) {
      animateModalOpen(itemsContainerRef.value.lastElementChild as HTMLElement, null, { duration: 0.25 })
    }
  })
}

const removeItem = (index: number) => {
  form.value.items.splice(index, 1)
}

// Historical Prices Lookup
const historicalPricesMap = ref<Record<string, any>>({})
const loadingPrices = ref<Record<string, boolean>>({})

const fetchHistoricalPrice = async (customerId: string, productId: string) => {
  if (!customerId || !productId) return
  loadingPrices.value[productId] = true
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}/last-prices`, {
      method: 'POST',
      body: { productIds: [productId] }
    })
    if (res.prices && res.prices[productId]) {
      historicalPricesMap.value[productId] = res.prices[productId]
    } else {
      historicalPricesMap.value[productId] = null
    }
  } catch (err) {
    console.error('Failed to fetch historical price:', err)
  } finally {
    loadingPrices.value[productId] = false
  }
}

const fetchHistoricalPricesForList = async (customerId: string, productIds: string[]) => {
  const missing = productIds.filter(pId => pId && historicalPricesMap.value[pId] === undefined)
  if (!customerId || missing.length === 0) return
  for (const id of missing) {
    loadingPrices.value[id] = true
  }
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}/last-prices`, {
      method: 'POST',
      body: { productIds: missing }
    })
    if (res.prices) {
      for (const pId of missing) {
        historicalPricesMap.value[pId] = res.prices[pId] || null
      }
    }
  } catch (err) {
    console.error('Failed to fetch historical prices list:', err)
  } finally {
    for (const id of missing) {
      loadingPrices.value[id] = false
    }
  }
}

// Watch customer selection to load price history for all current items
watch(() => form.value.customerId, (newCustId) => {
  historicalPricesMap.value = {}
  if (newCustId) {
    const pIds = form.value.items.map(it => it.productId).filter(Boolean)
    if (pIds.length > 0) {
      fetchHistoricalPricesForList(newCustId, pIds)
    }
  }
})

const onProductChange = (index: number) => {
  const item = form.value.items[index]
  item.applyLastPrice = false
  const p = (products.value as any[])?.find((p: any) => p.id === item.productId)
  if (p) {
    item.unitPrice = Number(p.price) || 0
    item.productSku = p.sku || ''
    // Pre-fill taxRate from the product in DB (if available); default to 18%
    const dbTaxRate = p.taxRate !== null && p.taxRate !== undefined && !isNaN(Number(p.taxRate))
      ? Number(p.taxRate)
      : 18
    item.taxRate = dbTaxRate

    // Fetch historical price if customer is selected
    if (form.value.customerId && item.productId) {
      fetchHistoricalPrice(form.value.customerId, item.productId)
    }
  }
}

const applyHistoricalPrice = (item: any, hp: any) => {
  if (!hp) return
  // If the user's row is currently tax inclusive: apply unitPrice (which includes tax)
  // If user row is tax exclusive: apply basePrice (which excludes tax)
  if (item.isTaxInclusive) {
    item.unitPrice = Number(hp.unitPrice)
  } else {
    item.unitPrice = Number(hp.basePrice)
  }
  if (hp.taxRate !== undefined && hp.taxRate !== null) {
    item.taxRate = Number(hp.taxRate)
  }
  item.applyLastPrice = true
}

const onTaxInclusiveToggle = (item: any) => {
  const hp = historicalPricesMap.value[item.productId]
  if (item.applyLastPrice && hp) {
    if (item.isTaxInclusive) {
      item.unitPrice = Number(hp.unitPrice)
    } else {
      item.unitPrice = Number(hp.basePrice)
    }
  }
}

const calculateItemTotals = (item: { quantity: number; unitPrice: number; taxRate?: number; isTaxInclusive?: boolean }) => {
  const qty = Number(item.quantity || 0)
  const rate = Number(item.unitPrice || 0)
  const taxPct = Number(item.taxRate ?? 0)
  const isInc = Boolean(item.isTaxInclusive)

  if (isInc) {
    // When rate includes tax: Total = qty * rate
    // Taxable base = Total / (1 + taxPct / 100)
    // Tax amount = Total - Taxable base
    const total = qty * rate
    const taxable = taxPct > 0 ? (total / (1 + (taxPct / 100))) : total
    const taxAmount = total - taxable
    return {
      taxable: Number(taxable.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2))
    }
  } else {
    // When rate is exclusive of tax: Taxable base = qty * rate
    // Tax amount = Taxable base * (taxPct / 100)
    // Total = Taxable base + Tax amount
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

const totalAmount = computed(() => {
  return orderSummary.value.grandTotal
})

const submitOrder = async () => {
  if (!form.value.customerId) {
    alert('Please select a customer')
    return
  }
  if (!form.value.paymentTerms) {
    alert('Please select payment terms for this order')
    return
  }
  if (!form.value.items.length) {
    alert('Please add at least one product')
    return
  }

  showSaving()
  try {
    const res = await $fetch<any>('/api/orders', {
      method: 'POST',
      body: form.value
    })
    const { notifyChange } = useRealtimeSync()
    notifyChange({ orderId: res?.id, action: 'ORDER_CREATED' })
    showSaved('Order created successfully')
    router.push('/dashboard/orders')
  } catch (err: any) {
    console.error(err)
    showSaved(err.data?.message || 'Failed to create order')
  }
}

const getPrivilegeColor = (tier: string) => {
  switch ((tier || '').toUpperCase()) {
    case 'PLATINUM': return 'bg-purple-100 text-purple-900 border-purple-300'
    case 'GOLD': return 'bg-amber-100 text-amber-900 border-amber-300'
    case 'SILVER': return 'bg-slate-100 text-slate-800 border-slate-300'
    default: return 'bg-orange-100 text-orange-900 border-orange-200'
  }
}

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
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5 sm:space-y-6 md:space-y-8 pb-12">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Create New Order</h1>
        <p class="text-xs text-gray-500 mt-1">Capture customer requirements, choose delivery destinations, and specify rates.</p>
      </div>
      
      <!-- Urgent Order Toggle Header -->
      <label class="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border cursor-pointer select-none transition-all shadow-xs self-start sm:self-auto shrink-0"
        :class="form.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
      >
        <input type="checkbox" v-model="form.isUrgent" class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" />
        <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
          <Zap class="w-4 h-4 text-rose-600" />
          <span>⚡ Urgent Order</span>
        </div>
      </label>
    </div>

    <form @submit.prevent="submitOrder" class="space-y-6">
      
      <!-- Section 1: Customer Profile & Order Info -->
      <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4 flex items-center justify-between">
          <span>Customer & Fulfillment Details</span>
          <span v-if="selectedCustomer" class="text-xs font-normal normal-case text-gray-500">
            Code: <strong class="text-gray-800">{{ selectedCustomer.customerCode || 'N/A' }}</strong>
          </span>
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <!-- Customer Picker -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer *</label>
            <CustomSelect 
              :modelValue="form.customerId"
              @update:modelValue="val => { form.customerId = val; onCustomerChange() }"
              :options="customerOptions"
              searchable
              searchPlaceholder="Search customers by name, code, company..."
              placeholder="Select Customer"
              class="w-full"
            />

            <!-- Selected Customer Info Banner (Enhanced & Prominent) -->
            <div v-if="selectedCustomer" ref="customerBannerRef" class="mt-3.5 p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-sky-50/20 rounded-2xl border border-gray-200 shadow-2xs transition-all">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <!-- Left: Big Avatar, Name, Company & Code -->
                <div class="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div class="w-12 h-12 rounded-2xl bg-[#1b3b5f] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0 tracking-wider">
                    {{ getCustomerInitials(selectedCustomer.name) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h4 class="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight leading-snug">
                        {{ selectedCustomer.name }}
                      </h4>
                      <span v-if="selectedCustomer.customerCode" class="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {{ selectedCustomer.customerCode }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-xs sm:text-sm text-gray-500 font-medium mt-0.5 flex-wrap">
                      <span v-if="selectedCustomer.company" class="text-gray-700 font-semibold">{{ selectedCustomer.company }}</span>
                      <span v-if="selectedCustomer.company && (selectedCustomer.city || selectedCustomer.phone)">•</span>
                      <span v-if="selectedCustomer.city" class="flex items-center gap-1 text-gray-600">
                        <MapPin class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {{ selectedCustomer.city }}
                      </span>
                      <span v-if="selectedCustomer.phone" class="text-gray-500 font-mono">{{ selectedCustomer.phone }}</span>
                    </div>
                  </div>
                </div>

                <!-- Right: Prominent Privilege Tier & Priority Badges -->
                <div class="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
                  <div 
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs uppercase tracking-wider border shadow-2xs"
                    :class="getPrivilegeBadgeStyle(selectedCustomer.privilegeTier || 'BRONZE')"
                  >
                    <Award class="w-4 h-4" />
                    <span>{{ selectedCustomer.privilegeTier || 'BRONZE' }} TIER</span>
                  </div>

                  <div v-if="selectedCustomer.isPriorityClient" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                    <Crown class="w-4 h-4" />
                    <span>Priority Client</span>
                  </div>
                </div>
              </div>

              <!-- Bottom Meta Row: Account Manager & Payment Terms -->
              <div v-if="selectedCustomer.customerManager || selectedCustomer.paymentTerms" class="mt-3.5 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div v-if="selectedCustomer.customerManager" class="flex items-center gap-2 text-gray-600 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                  <UserCheck class="w-4 h-4 text-[#1b3b5f]" />
                  <span>Account Manager: <strong class="text-gray-900 font-bold">{{ selectedCustomer.customerManager.name }}</strong></span>
                </div>
                <div v-if="selectedCustomer.paymentTerms" class="flex items-center gap-1.5 text-gray-500 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                  <Clock class="w-3.5 h-3.5 text-emerald-600" />
                  <span>Profile Default Terms: <strong class="text-gray-800 font-bold">{{ selectedCustomer.paymentTerms }}</strong></span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Placed By -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Created By</label>
            <input :value="user?.name || 'Unknown'" disabled class="w-full text-sm border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed" />
          </div>
          
          <!-- Payment Terms -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Terms *</label>
              <span v-if="isFirstOrderForCustomer" class="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ★ 1st Order (Saves as Customer Default)
              </span>
              <span v-else-if="selectedCustomer && selectedCustomer.paymentTerms" class="text-[10px] text-gray-400">
                Profile Default: <strong class="text-gray-700">{{ selectedCustomer.paymentTerms }}</strong>
              </span>
            </div>
            <CustomSelect 
              :modelValue="form.paymentTerms"
              @update:modelValue="val => form.paymentTerms = val"
              :options="paymentTermsOptions"
              placeholder="Select Terms"
              class="w-full"
            />
            <p v-if="isFirstOrderForCustomer" class="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
              💡 First order for this customer: the chosen terms will be saved to their master profile.
            </p>
            <p v-else-if="selectedCustomer && form.paymentTerms && form.paymentTerms !== selectedCustomer.paymentTerms" class="text-[11px] text-sky-700 mt-1.5 flex items-center gap-1 font-medium">
              ℹ Tweak for this order only — customer profile default remains "{{ selectedCustomer.paymentTerms }}".
            </p>
          </div>

          <!-- Transport / Vehicle Selection Mode -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Transport & Delivery Vehicle *</span>
              <span class="text-[11px] font-semibold" :class="form.vehicleMode === 'OUR_FLEET' ? 'text-[#1b3b5f]' : (form.vehicleMode === 'THIRD_PARTY' ? 'text-indigo-700' : 'text-amber-700')">
                {{ form.vehicleMode === 'OUR_FLEET' ? '✓ Company Fleet Dispatch' : (form.vehicleMode === 'THIRD_PARTY' ? '📦 Third Party (Porter/Rapido Handover)' : '🚗 Party Transport (Direct Handover)') }}
              </span>
            </label>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <!-- Option 1: Our Fleet -->
              <div
                @click="form.vehicleMode = 'OUR_FLEET'"
                class="p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none"
                :class="form.vehicleMode === 'OUR_FLEET'
                  ? 'border-[#1b3b5f] bg-emerald-50/50 shadow-xs ring-1 ring-[#1b3b5f]/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'"
              >
                <div
                  class="p-2.5 rounded-lg shrink-0 mt-0.5 transition-colors"
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
                class="p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none"
                :class="form.vehicleMode === 'PARTY_VEHICLE'
                  ? 'border-amber-600 bg-amber-50/60 shadow-xs ring-1 ring-amber-500/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'"
              >
                <div
                  class="p-2.5 rounded-lg shrink-0 mt-0.5 transition-colors"
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

              <!-- Option 3: Third Party (Porter / Rapido) -->
              <div
                @click="form.vehicleMode = 'THIRD_PARTY'"
                class="p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none"
                :class="form.vehicleMode === 'THIRD_PARTY'
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-500/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'"
              >
                <div
                  class="p-2.5 rounded-lg shrink-0 mt-0.5 transition-colors"
                  :class="form.vehicleMode === 'THIRD_PARTY' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 text-gray-500'"
                >
                  <Package class="w-4 h-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-gray-900">Third Party (Porter/Rapido)</span>
                    <span v-if="form.vehicleMode === 'THIRD_PARTY'" class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  </div>
                  <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Porter, Rapido or hired transport. Staff marks as Handed Over directly.
                  </p>
                </div>
              </div>
            </div>

            <!-- Party Vehicle Informational Notice -->
            <div
              v-if="form.vehicleMode === 'PARTY_VEHICLE'"
              class="mt-2.5 p-3 bg-amber-50/80 border border-amber-200/90 rounded-lg flex items-start gap-2 text-xs text-amber-900"
            >
              <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div class="leading-relaxed">
                <strong>Party Vehicle Pickup:</strong> This order will not appear in Trip Creation. Once billing and packing are done, warehouse staff will see a <strong>"Hand Over"</strong> button to complete delivery.
              </div>
            </div>

            <!-- Third Party Informational Notice -->
            <div
              v-else-if="form.vehicleMode === 'THIRD_PARTY'"
              class="mt-2.5 p-3 bg-indigo-50/80 border border-indigo-200/90 rounded-lg flex items-start gap-2 text-xs text-indigo-900"
            >
              <Package class="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div class="leading-relaxed">
                <strong>Third Party Delivery (Porter / Rapido):</strong> This order is excluded from multi-stop fleet trips. Warehouse staff will record the handover and driver details using the <strong>"Hand Over"</strong> button upon pickup.
              </div>
            </div>
          </div>
          
          <!-- Registered Address Picker Dropdown -->
          <div v-if="addressOptions.length > 1" class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select Registered Destination Address
            </label>
            <CustomSelect 
              :modelValue="form.deliveryAddressId"
              @update:modelValue="onAddressSelect"
              :options="addressOptions"
              placeholder="Choose destination address..."
              class="w-full"
            />
          </div>

          <!-- Delivery Address Textarea -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery Address (Site / Destination) *</label>
            <textarea v-model="form.deliveryAddress" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none" required placeholder="Enter delivery address, godown name, or landmark..."></textarea>
          </div>

          <!-- Internal Order Notes -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Internal Order Instructions / Dispatch Notes</label>
            <textarea v-model="form.notes" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none" placeholder="e.g. Call client 30 mins before arrival, deliver only between 10am-2pm, verify site unloading clearance..."></textarea>
          </div>
        </div>
      </div>

      <!-- Section 2: Items -->
      <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
          <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items</h3>
          <button type="button" @click="addItem" class="text-xs font-bold text-[#1b3b5f] flex items-center gap-1 hover:underline cursor-pointer">
            <Plus class="w-3.5 h-3.5" /> Add Product
          </button>
        </div>

        <div ref="itemsContainerRef" class="space-y-4">
          <div v-for="(item, idx) in form.items" :key="idx" class="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200 space-y-3">
            <div class="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
              <!-- Product Select -->
              <div class="flex-1 w-full min-w-0">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Product *</label>
                <CustomSelect 
                  :modelValue="item.productId"
                  @update:modelValue="val => { item.productId = val; onProductChange(idx) }"
                  :options="productOptions"
                  searchable
                  searchPlaceholder="Search product or HSN..."
                  placeholder="Select Product"
                  class="w-full"
                />

                <!-- Live Stock Badge right below the product name -->
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
              </div>

              <!-- Quantity, Rate, Tax %, Total & Remove in a responsive flex layout -->
              <div class="grid grid-cols-12 gap-2 items-end w-full md:w-auto">
                <!-- Qty -->
                <div class="col-span-3 sm:col-span-2 md:w-20">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Qty *</label>
                  <input type="number" v-model.number="item.quantity" min="1" required class="w-full border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" />
                </div>

                <!-- Unit Price (Rate) -->
                <div class="col-span-3 sm:col-span-3 md:w-28">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center gap-1 truncate">
                    <IndianRupee class="w-3 h-3 text-gray-400 shrink-0" />
                    <span>Rate *</span>
                  </label>
                  <div class="relative flex items-center">
                    <IndianRupee class="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input type="number" v-model.number="item.unitPrice" min="0" step="0.01" required class="w-full pl-6 border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" />
                  </div>
                </div>

                <!-- Tax Rate % -->
                <div class="col-span-2 sm:col-span-2 md:w-20">
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
                      class="w-full pr-5 border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f] text-right" 
                    />
                    <span class="absolute right-1.5 text-xs font-semibold text-gray-400 pointer-events-none">%</span>
                  </div>
                </div>

                <!-- Line Total -->
                <div class="col-span-3 sm:col-span-4 md:w-28">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center justify-between">
                    <span>Total</span>
                    <span v-if="item.isTaxInclusive" class="text-[8px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">INCL</span>
                    <span v-else class="text-[8px] font-bold text-gray-600 bg-gray-100 px-1 py-0.2 rounded border border-gray-200">+TAX</span>
                  </label>
                  <div class="p-2 bg-gray-50 text-gray-900 rounded-lg font-bold text-xs sm:text-sm border border-gray-200 truncate text-right">
                    {{ formatCurrency(calculateItemTotals(item).total) }}
                  </div>
                </div>

                <!-- Remove -->
                <div class="col-span-1 sm:col-span-1 md:w-auto flex justify-center pb-0.5">
                  <button type="button" @click="removeItem(idx)" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0 transition-colors cursor-pointer" title="Remove Item">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Item-Level Options & Notes -->
            <div class="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200/60 text-xs">
              <!-- Tax Inclusive Toggle -->
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  v-model="item.isTaxInclusive" 
                  @change="onTaxInclusiveToggle(item)"
                  class="w-3.5 h-3.5 rounded text-[#1b3b5f] focus:ring-[#1b3b5f]" 
                />
                <span class="text-gray-700 font-medium">Tax Inclusive Rate</span>
                <span v-if="item.isTaxInclusive" class="text-[10px] text-blue-600 font-semibold">(Tax incl.)</span>
                <span v-else class="text-[10px] text-gray-500">(+{{ item.taxRate ?? 0 }}% Tax)</span>
              </label>

              <!-- Last Billed Price Interactive Pill -->
              <div v-if="form.customerId && item.productId" class="flex items-center">
                <!-- If Price History Exists -->
                <div 
                  v-if="historicalPricesMap[item.productId]" 
                  class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition border"
                  :class="item.applyLastPrice 
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs ring-1 ring-emerald-400/30' 
                    : 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100/80'"
                >
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="item.applyLastPrice ? 'bg-emerald-600' : 'bg-amber-500'"></span>
                  <span>
                    Last Billed: 
                    <strong class="font-bold text-gray-900">
                      {{ formatCurrency(item.isTaxInclusive ? historicalPricesMap[item.productId].unitPrice : historicalPricesMap[item.productId].basePrice) }}
                    </strong>
                    <span class="text-[10px] text-gray-500 ml-1">
                      ({{ item.isTaxInclusive ? 'Incl. Tax' : '+Tax' }} • {{ historicalPricesMap[item.productId].daysAgo }}d ago)
                    </span>
                  </span>

                  <button
                    type="button"
                    @click="applyHistoricalPrice(item, historicalPricesMap[item.productId])"
                    class="ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition cursor-pointer select-none"
                    :class="item.applyLastPrice 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-amber-200 text-amber-900 hover:bg-amber-300'"
                    :title="`Voucher ${historicalPricesMap[item.productId].voucherNo} on ${formatDate(historicalPricesMap[item.productId].voucherDate)}`"
                  >
                    {{ item.applyLastPrice ? '✓ Applied' : 'Apply' }}
                  </button>
                </div>

                <!-- If Loading -->
                <div v-else-if="loadingPrices[item.productId]" class="text-[11px] text-gray-400 flex items-center gap-1.5 italic">
                  <Loader2 class="w-3 h-3 animate-spin text-gray-400" />
                  <span>Checking price history...</span>
                </div>

                <!-- If First Time Item -->
                <div v-else-if="historicalPricesMap[item.productId] === null" class="text-[11px] text-gray-400 italic">
                  First time ordering this item
                </div>
              </div>

              <!-- Item Notes Input -->
              <div class="flex-1 min-w-[180px]">
                <input 
                  type="text" 
                  v-model="item.itemNotes" 
                  placeholder="Optional item note: e.g. custom edge-banding..."
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

          <div v-if="!form.items.length" class="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            No products added yet. Click "Add Product" to begin.
          </div>
        </div>

        <!-- Order Totals & Tax Summary -->
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

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4">
        <NuxtLink to="/dashboard/orders" class="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
          Cancel
        </NuxtLink>
        <button type="submit" :disabled="!form.items.length" class="px-6 py-2.5 bg-[#1b3b5f] text-white text-sm font-bold rounded-lg hover:bg-[#1b3b5f]/90 disabled:opacity-50 transition-colors shadow-sm">
          Submit Order
        </button>
      </div>

    </form>
  </div>
</template>
