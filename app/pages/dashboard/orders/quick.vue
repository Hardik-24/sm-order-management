<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ArrowLeft, X, Plus, Minus, Trash2, Zap, Calculator, Clock, Check, 
  Truck, Car, AlertCircle, Package, Loader2, Tag, ChevronDown, ChevronUp, 
  ShoppingBag, Search, Sparkles, Building2, User, Phone, MapPin, 
  ShieldCheck, ShieldAlert, CheckCircle2, History
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import AccessDenied from '~/components/ui/AccessDenied.vue'
import PriceHistoryModal from '~/components/orders/PriceHistoryModal.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useMasters } from '~/composables/useMasters'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()
const { showSaving, showSaved, hide } = useSnackbar()
const { paymentTermsOptions } = useMasters()

// Guard against non-admin direct access
onMounted(() => {
  if (user.value && user.value.role !== 'ADMIN') {
    router.replace('/dashboard/orders')
  }
})

// ── DATA FETCHING ──────────────────────────────────────────────
const { data: rawCustomers, pending: loadingCustomers } = await useFetch<any[]>('/api/customers')
const { data: rawProducts, pending: loadingProducts } = await useFetch<any[]>('/api/products')

// Fetch Tally Receivables Data (Admin Only) for live credit status
const { data: tallyReceivablesRes } = await useFetch<any>('/api/admin/tally/receivables')
const tallyPartiesMap = computed(() => {
  const map: Record<string, any> = {}
  if (tallyReceivablesRes.value?.data?.parties) {
    for (const p of tallyReceivablesRes.value.data.parties) {
      const k1 = (p.name || '').trim().toLowerCase()
      map[k1] = p
    }
  }
  return map
})

// ── CUSTOMER STATE ─────────────────────────────────────────────
const isCustomCustomer = ref(false)
const selectedCustomerId = ref<string>('')
const customCustomer = ref({
  name: '',
  phone: '',
  city: ''
})

// Initialize with first available customer
onMounted(() => {
  if (rawCustomers.value && rawCustomers.value.length > 0 && !selectedCustomerId.value) {
    selectedCustomerId.value = rawCustomers.value[0].id
  }
})

const selectedCustomer = computed(() => {
  if (isCustomCustomer.value) return null
  return (rawCustomers.value || []).find(c => c.id === selectedCustomerId.value) || null
})

// Credit information for selected customer
const customerCreditInfo = computed(() => {
  if (isCustomCustomer.value) {
    return {
      status: 'CASH',
      badgeText: 'Cash / Walk-in',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      description: 'Walk-in / Ad-hoc Party • Immediate Settlement (No Credit Hold)',
      pendingBalance: 0
    }
  }

  const cust = selectedCustomer.value
  if (!cust) {
    return {
      status: 'UNKNOWN',
      badgeText: 'Select Party',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      description: 'Choose a customer to load credit & pricing',
      pendingBalance: 0
    }
  }

  // Lookup in Tally Receivables
  const key1 = (cust.name || '').trim().toLowerCase()
  const key2 = (cust.company || '').trim().toLowerCase()
  const tallyParty = tallyPartiesMap.value[key1] || tallyPartiesMap.value[key2]

  if (tallyParty) {
    const bal = Number(tallyParty.closingBalance || tallyParty.closing_balance || 0)
    const overdueDays = Number(tallyParty.overdueDays || 0)
    const isOverdue = overdueDays > 0 || (tallyParty.status && String(tallyParty.status).toUpperCase().includes('OVERDUE'))

    if (isOverdue) {
      return {
        status: 'OVERDUE',
        badgeText: `Overdue (${overdueDays}d)`,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        description: `Pending Balance: ₹${Math.round(bal).toLocaleString('en-IN')} • Overdue Bills Detected`,
        pendingBalance: bal
      }
    }

    return {
      status: 'OK',
      badgeText: 'Credit OK',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description: `Pending Balance: ₹${Math.round(bal).toLocaleString('en-IN')} • Standard Terms: ${cust.paymentTerms || '30 Days'}`,
      pendingBalance: bal
    }
  }

  // Fallback if not in Tally receivables snapshot
  return {
    status: 'OK',
    badgeText: 'Credit OK',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: `Standard Terms: ${cust.paymentTerms || '30 Days'} • No outstanding alerts`,
    pendingBalance: 0
  }
})

// Customer Last Prices map
const customerLastPrices = ref<Record<string, any>>({})
const loadingLastPrices = ref(false)

const loadCustomerLastPrices = async (custId: string) => {
  if (!custId || isCustomCustomer.value) {
    customerLastPrices.value = {}
    return
  }

  const productIds = (rawProducts.value || []).map(p => p.id)
  if (productIds.length === 0) return

  loadingLastPrices.value = true
  try {
    const res = await $fetch<any>(`/api/customers/${custId}/last-prices`, {
      method: 'POST',
      body: { productIds }
    })
    customerLastPrices.value = res?.prices || {}
  } catch (err) {
    console.error('Failed to load last prices:', err)
  } finally {
    loadingLastPrices.value = false
  }
}

watch(selectedCustomerId, (newId) => {
  if (newId) {
    loadCustomerLastPrices(newId)
    // Update delivery address from customer default
    const cust = (rawCustomers.value || []).find(c => c.id === newId)
    if (cust) {
      deliveryAddress.value = cust.address || cust.city || ''
      if (cust.paymentTerms) {
        paymentTerms.value = cust.paymentTerms
      }
    }
  }
}, { immediate: true })

// ── CATALOG & SEARCH ───────────────────────────────────────────
const searchQuery = ref('')
const selectedCategory = ref('All')

const categories = computed(() => {
  const set = new Set<string>()
  for (const p of rawProducts.value || []) {
    if (p.category?.name) set.add(p.category.name)
    else if (p.categoryName) set.add(p.categoryName)
  }
  return ['All', ...Array.from(set)]
})

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const cat = selectedCategory.value

  return (rawProducts.value || []).filter(p => {
    const pCat = p.category?.name || p.categoryName || ''
    const matchCat = cat === 'All' || pCat === cat
    if (!matchCat) return false

    if (!q) return true
    const nameMatch = (p.name || '').toLowerCase().includes(q)
    const skuMatch = (p.sku || '').toLowerCase().includes(q)
    const brandMatch = (p.brand || '').toLowerCase().includes(q)
    const catMatch = pCat.toLowerCase().includes(q)
    return nameMatch || skuMatch || brandMatch || catMatch
  })
})

// ── CART STATE ─────────────────────────────────────────────────
interface CartItem {
  id: string
  isCustom?: boolean
  customName?: string
  customSpec?: string
  customUnit?: string
  qty: number
  customPrice: number
  isTaxInclusive: boolean
  applyLastPrice: boolean
  isExpanded: boolean
}

const cart = ref<Record<string, CartItem>>({})
const isCartDrawerOpen = ref(false)
let customItemCounter = 1

const cartItemsList = computed(() => {
  return Object.keys(cart.value).map(id => cart.value[id])
})

const totalUnitsCount = computed(() => {
  return Object.keys(cart.value).reduce((sum, id) => sum + (cart.value[id]?.qty || 0), 0)
})

const totalItemsCount = computed(() => {
  return Object.keys(cart.value).length
})

// Totals Calculation
const cartTotals = computed(() => {
  let taxableTotal = 0
  let gstTotal = 0
  let grandTotal = 0

  for (const id of Object.keys(cart.value)) {
    const c = cart.value[id]
    if (!c || c.qty <= 0) continue

    const p = (rawProducts.value || []).find(x => x.id === id)
    const taxRate = c.isCustom ? 18 : (p?.taxRate ?? 18)
    const qty = Number(c.qty) || 1
    const rate = Number(c.customPrice) || 0

    if (c.isTaxInclusive) {
      const totalWithTax = rate * qty
      const base = taxRate > 0 ? totalWithTax / (1 + (taxRate / 100)) : totalWithTax
      const gst = totalWithTax - base
      taxableTotal += base
      gstTotal += gst
      grandTotal += totalWithTax
    } else {
      const base = rate * qty
      const gst = base * (taxRate / 100)
      taxableTotal += base
      gstTotal += gst
      grandTotal += (base + gst)
    }
  }

  return {
    taxableTotal: Math.round(taxableTotal),
    gstTotal: Math.round(gstTotal),
    grandTotal: Math.round(grandTotal)
  }
})

// Cart Actions
const addToCart = (product: any, change: number = 1) => {
  const id = product.id
  if (!cart.value[id]) {
    cart.value[id] = {
      id,
      qty: Math.max(1, change),
      customPrice: Number(product.price) || 0,
      isTaxInclusive: false,
      applyLastPrice: false,
      isExpanded: false
    }
  } else {
    cart.value[id].qty += change
    if (cart.value[id].qty <= 0) {
      delete cart.value[id]
    }
  }
}

const setDirectCartQty = (id: string, val: string | number) => {
  const num = parseInt(String(val)) || 0
  if (num <= 0) {
    delete cart.value[id]
  } else if (cart.value[id]) {
    cart.value[id].qty = num
  } else {
    const p = (rawProducts.value || []).find(x => x.id === id)
    if (p) {
      cart.value[id] = {
        id,
        qty: num,
        customPrice: Number(p.price) || 0,
        isTaxInclusive: false,
        applyLastPrice: false,
        isExpanded: false
      }
    }
  }
}

const toggleItemAccordion = (id: string) => {
  if (cart.value[id]) {
    cart.value[id].isExpanded = !cart.value[id].isExpanded
  }
}

const deleteCartItem = (id: string) => {
  delete cart.value[id]
  if (Object.keys(cart.value).length === 0) {
    isCartDrawerOpen.value = false
  }
}

const applyLastPriceToItem = (id: string) => {
  const lp = customerLastPrices.value[id]
  if (lp && lp.lastPrice && cart.value[id]) {
    cart.value[id].customPrice = Number(lp.lastPrice)
    cart.value[id].applyLastPrice = true
  }
}

// ── CUSTOM NON-CATALOG ITEM MODAL ──────────────────────────────
const isCustomItemModalOpen = ref(false)
const customItemForm = ref({
  name: '',
  spec: '',
  qty: 25,
  unit: 'Sheets',
  rate: 1850,
  isTaxInclusive: false
})

const openCustomItemModal = (prefillTitle: string = '') => {
  customItemForm.value = {
    name: prefillTitle || '',
    spec: '',
    qty: 25,
    unit: 'Sheets',
    rate: 1850,
    isTaxInclusive: false
  }
  isCustomItemModalOpen.value = true
}

const addCustomItemToCart = () => {
  if (!customItemForm.value.name.trim()) {
    alert('Please enter an item title / description')
    return
  }

  const cid = `custom_${customItemCounter++}`
  cart.value[cid] = {
    id: cid,
    isCustom: true,
    customName: customItemForm.value.name.trim(),
    customSpec: customItemForm.value.spec.trim(),
    customUnit: customItemForm.value.unit,
    qty: Math.max(1, Number(customItemForm.value.qty) || 1),
    customPrice: Number(customItemForm.value.rate) || 0,
    isTaxInclusive: customItemForm.value.isTaxInclusive,
    applyLastPrice: false,
    isExpanded: false
  }

  isCustomItemModalOpen.value = false
  isCartDrawerOpen.value = true
}

// ── SQ.FT RATE CALCULATOR MODAL ────────────────────────────────
const isRateCalcModalOpen = ref(false)
const rateCalcTargetId = ref<string | null>(null)
const rateCalcState = ref({
  length: 8,
  width: 4,
  sqftRate: 65,
  title: 'Sheet Rate Calculator'
})

const calculatedSheetArea = computed(() => {
  return Number((rateCalcState.value.length * rateCalcState.value.width).toFixed(2))
})

const calculatedSheetRate = computed(() => {
  return Math.round(calculatedSheetArea.value * (Number(rateCalcState.value.sqftRate) || 0))
})

const openRateCalc = (targetId: string | null = null, defaultTitle: string = 'Sheet Rate Calculator') => {
  rateCalcTargetId.value = targetId
  rateCalcState.value.title = defaultTitle
  rateCalcState.value.length = 8
  rateCalcState.value.width = 4
  rateCalcState.value.sqftRate = 65
  isRateCalcModalOpen.value = true
}

const applyCalculatedRate = () => {
  const rate = calculatedSheetRate.value
  if (rateCalcTargetId.value === 'custom_form') {
    customItemForm.value.rate = rate
  } else if (rateCalcTargetId.value && cart.value[rateCalcTargetId.value]) {
    cart.value[rateCalcTargetId.value].customPrice = rate
    cart.value[rateCalcTargetId.value].applyLastPrice = false
  }
  isRateCalcModalOpen.value = false
  rateCalcTargetId.value = null
}

// ── PRICE HISTORY MODAL ────────────────────────────────────────
const isPriceHistoryOpen = ref(false)
const phProductId = ref('')
const phProductName = ref('')
const phProductSku = ref('')

const openPriceHistory = (product: any) => {
  phProductId.value = product.id
  phProductName.value = product.name
  phProductSku.value = product.sku || ''
  isPriceHistoryOpen.value = true
}

const onApplyPriceHistory = (rate: number) => {
  if (phProductId.value) {
    if (!cart.value[phProductId.value]) {
      const p = (rawProducts.value || []).find(x => x.id === phProductId.value)
      if (p) addToCart(p, 1)
    }
    if (cart.value[phProductId.value]) {
      cart.value[phProductId.value].customPrice = rate
      cart.value[phProductId.value].applyLastPrice = true
    }
  }
  isPriceHistoryOpen.value = false
}

// ── CUSTOMER SELECTOR MODAL ────────────────────────────────────
const isCustomerModalOpen = ref(false)
const customerModalTab = ref<'db' | 'custom'>('db')
const customerSearchQuery = ref('')

const filteredDbCustomers = computed(() => {
  const q = customerSearchQuery.value.trim().toLowerCase()
  if (!q) return rawCustomers.value || []

  return (rawCustomers.value || []).filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(q)
    const compMatch = (c.company || '').toLowerCase().includes(q)
    const cityMatch = (c.city || '').toLowerCase().includes(q)
    const phoneMatch = (c.phone || '').includes(q)
    return nameMatch || compMatch || cityMatch || phoneMatch
  })
})

const selectDbCustomer = (cust: any) => {
  isCustomCustomer.value = false
  selectedCustomerId.value = cust.id
  deliveryAddress.value = cust.address || cust.city || ''
  if (cust.paymentTerms) {
    paymentTerms.value = cust.paymentTerms
  }
  isCustomerModalOpen.value = false
}

const saveCustomCustomer = () => {
  if (!customCustomer.value.name.trim()) {
    alert('Please enter a party / customer name')
    return
  }
  isCustomCustomer.value = true
  selectedCustomerId.value = ''
  deliveryAddress.value = customCustomer.value.city ? `${customCustomer.value.city} (Site Delivery)` : 'Counter Pickup'
  paymentTerms.value = 'Immediate / Cheque'
  isCustomerModalOpen.value = false
}

// ── STEP 2: DELIVERY & CHECKOUT ────────────────────────────────
const isCheckoutModalOpen = ref(false)
const transportMode = ref<'OUR_FLEET' | 'PARTY_VEHICLE' | 'THIRD_PARTY'>('OUR_FLEET')
const deliveryAddress = ref('')
const paymentTerms = ref('30 Days Credit')
const isUrgent = ref(false)
const orderNotes = ref('')
const isSubmitting = ref(false)

const proceedToCheckout = () => {
  if (totalItemsCount.value === 0) {
    alert('Your cart is empty. Please add items to proceed.')
    return
  }
  isCartDrawerOpen.value = false
  isCheckoutModalOpen.value = true
}

const confirmAndPlaceOrder = async () => {
  if (isSubmitting.value) return

  if (isCustomCustomer.value && !customCustomer.value.name.trim()) {
    alert('Please provide a valid custom customer name')
    return
  }

  if (!isCustomCustomer.value && !selectedCustomerId.value) {
    alert('Please select a customer for this order')
    return
  }

  const items = Object.keys(cart.value).map(id => {
    const c = cart.value[id]
    if (c.isCustom) {
      return {
        isCustom: true,
        customProductName: c.customName,
        unit: c.customUnit || 'PIECE',
        quantity: c.qty,
        unitPrice: c.customPrice,
        taxRate: 18,
        isTaxInclusive: c.isTaxInclusive,
        notes: c.customSpec || undefined
      }
    } else {
      const p = (rawProducts.value || []).find(x => x.id === id)
      return {
        productId: id,
        quantity: c.qty,
        unitPrice: c.customPrice,
        taxRate: p?.taxRate ?? 18,
        isTaxInclusive: c.isTaxInclusive,
        notes: c.customSpec || undefined
      }
    }
  })

  if (items.length === 0) {
    alert('No items in order')
    return
  }

  isSubmitting.value = true
  showSaving('Booking order into system...')

  try {
    const payload = {
      customerId: isCustomCustomer.value ? undefined : selectedCustomerId.value,
      isCustomCustomer: isCustomCustomer.value,
      customCustomer: isCustomCustomer.value ? customCustomer.value : undefined,
      deliveryAddress: deliveryAddress.value || 'Counter Delivery',
      vehicleMode: transportMode.value,
      paymentTerms: paymentTerms.value || '30 Days',
      isUrgent: isUrgent.value,
      notes: orderNotes.value || undefined,
      items
    }

    const res = await $fetch<any>('/api/orders', {
      method: 'POST',
      body: payload
    })

    showSaved('Order booked successfully!')
    isCheckoutModalOpen.value = false
    cart.value = {}

    // Redirect to orders list
    setTimeout(() => {
      router.push('/dashboard/orders')
    }, 700)
  } catch (err: any) {
    hide()
    console.error('Order creation error:', err)
    alert(err?.data?.message || err?.message || 'Failed to submit order. Please verify inputs.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <!-- Access Denied Guard for Non-Admin -->
  <div v-if="user?.role !== 'ADMIN'" class="p-6 md:p-12 flex flex-col items-center justify-center min-h-[60vh]">
    <AccessDenied pageName="Quick Stock Order (Admin Only Beta)" />
  </div>

  <div v-else class="max-w-4xl mx-auto space-y-4 pb-28">
    
    <!-- Top Header Bar (Admin Beta) -->
    <div class="bg-[#1b3b5f] text-white rounded-2xl p-4 shadow-lg space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-200 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Zap class="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-black tracking-tight">Stock-to-Cart Quick Order</h2>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">ADMIN BETA</span>
            </div>
            <p class="text-xs text-blue-200 mt-0.5">
              Live Warehouse Stock • {{ rawProducts?.length || 0 }} SKUs Active
            </p>
          </div>
        </div>

        <button 
          @click="openRateCalc(null, 'General Sq.ft Calculator')"
          class="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-1.5 text-xs text-blue-100 font-bold transition-all shadow-xs cursor-pointer"
        >
          <Calculator class="w-3.5 h-3.5 text-emerald-400" />
          <span class="hidden sm:inline">Sq.ft Calculator</span>
          <span class="sm:hidden">Calc</span>
        </button>
      </div>

      <!-- Customer / Party Context Bar -->
      <div class="bg-blue-950/70 border border-blue-400/30 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" @click="isCustomerModalOpen = true">
          <div class="w-7 h-7 rounded-lg bg-blue-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <User class="w-4 h-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-blue-300 block">Party (Customer):</span>
              <span 
                class="text-[9px] font-bold px-1.5 py-0.2 rounded"
                :class="isCustomCustomer ? 'bg-amber-400 text-amber-950' : 'bg-blue-400/20 text-blue-200 border border-blue-400/30'"
              >
                {{ isCustomCustomer ? 'Custom Walk-In' : 'BUSY Customer' }}
              </span>
            </div>
            <div class="font-bold text-white text-xs sm:text-sm truncate">
              {{ isCustomCustomer ? customCustomer.name : (selectedCustomer?.company || selectedCustomer?.name || 'Select Customer') }}
            </div>
          </div>
        </div>

        <button 
          @click="isCustomerModalOpen = true"
          class="bg-white/10 hover:bg-white/20 text-blue-100 rounded-lg py-1.5 px-3 text-xs border border-white/20 font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
        >
          <span>Change</span>
          <ChevronDown class="w-3.5 h-3.5 text-blue-300" />
        </button>
      </div>

      <!-- Search & Custom Item Quick Bar -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="w-4 h-4 text-blue-300 absolute left-3 top-2.5" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search plywood, brand, thickness, finish..." 
            class="w-full bg-blue-950/60 border border-blue-400/30 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-blue-300/60 focus:outline-hidden focus:border-blue-400"
          />
        </div>

        <button 
          @click="openCustomItemModal(searchQuery)"
          class="h-9 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
          title="Add Non-Catalog / Custom Item"
        >
          <Plus class="w-3.5 h-3.5 text-amber-300" />
          <span class="whitespace-nowrap">Custom Item</span>
        </button>
      </div>

      <!-- Category Filter Chips -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="selectedCategory = cat"
          class="px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer"
          :class="selectedCategory === cat ? 'bg-white text-slate-900 shadow-xs' : 'bg-blue-900/50 text-blue-200 hover:bg-blue-900'"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Product List View (Stock Catalog) -->
    <div class="space-y-2.5">
      <div v-if="loadingProducts" class="py-16 text-center text-slate-400 space-y-2">
        <Loader2 class="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p class="text-xs">Loading live warehouse inventory...</p>
      </div>

      <div v-else-if="filteredProducts.length === 0" class="py-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 space-y-3 p-6">
        <Package class="w-10 h-10 mx-auto text-slate-300" />
        <p class="text-xs text-slate-600">No catalog products match "{{ searchQuery }}"</p>
        <button 
          @click="openCustomItemModal(searchQuery)"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-4 py-2 rounded-xl transition cursor-pointer"
        >
          <Plus class="w-4 h-4 text-amber-700" />
          <span>Add "{{ searchQuery }}" as Custom Item</span>
        </button>
      </div>

      <div v-else class="space-y-2">
        <div 
          v-for="item in filteredProducts" 
          :key="item.id"
          class="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between gap-3"
        >
          <div class="flex-1 min-w-0">
            <!-- Brand & Badges -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span v-if="item.brand" class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                {{ item.brand }}
              </span>
              <span 
                class="text-[10px] font-semibold px-1.5 py-0.2 rounded border"
                :class="item.stock > 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
              >
                {{ item.stock }} in stock
              </span>

              <!-- Customer Last Price pill -->
              <button 
                v-if="customerLastPrices[item.id]?.lastPrice"
                @click="openPriceHistory(item)"
                class="text-[10px] font-medium px-1.5 py-0.2 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="View full customer price history"
              >
                <Clock class="w-3 h-3 text-purple-600" />
                <span>Last: ₹{{ Number(customerLastPrices[item.id].lastPrice).toLocaleString('en-IN') }}</span>
              </button>
            </div>

            <!-- Product Title & Details -->
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate" :title="item.name">
              {{ item.name }}
            </h4>
            <p v-if="item.sku || item.category?.name" class="text-[11px] text-slate-500 truncate">
              {{ [item.sku, item.category?.name].filter(Boolean).join(' • ') }}
            </p>

            <!-- Price & Tax -->
            <div class="flex items-center gap-2 mt-1">
              <div class="text-xs font-mono font-bold text-blue-900">
                ₹{{ (cart[item.id] ? cart[item.id].customPrice : Number(item.price)).toLocaleString('en-IN') }}
                <span class="text-[10px] font-normal text-slate-400 font-sans">/ {{ item.unit || 'Sheet' }}</span>
              </div>
              <span 
                v-if="cart[item.id]?.isTaxInclusive" 
                class="text-[9px] font-bold px-1 py-0.2 rounded bg-blue-100 text-blue-800"
              >
                Incl. Tax
              </span>
              <span v-else class="text-[9px] font-medium text-slate-400">
                + {{ item.taxRate ?? 18 }}% GST
              </span>
            </div>
          </div>

          <!-- Quantity Stepper with Direct Keyboard Typing -->
          <div class="shrink-0">
            <div 
              v-if="cart[item.id] && cart[item.id].qty > 0"
              class="flex items-center bg-emerald-50 border border-emerald-300 rounded-xl p-1 gap-1 shadow-2xs"
            >
              <button 
                @click="addToCart(item, -1)" 
                class="w-7 h-7 rounded-lg bg-white text-emerald-700 hover:bg-emerald-100 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                <Minus class="w-3.5 h-3.5" />
              </button>
              
              <input 
                type="number" 
                min="1"
                :value="cart[item.id].qty"
                @change="setDirectCartQty(item.id, ($event.target as HTMLInputElement).value)"
                class="w-14 h-7 text-center font-mono font-bold text-xs text-emerald-950 bg-white border border-emerald-200 rounded-md focus:outline-hidden focus:border-emerald-500"
                title="Type any quantity directly"
              />

              <button 
                @click="addToCart(item, 1)" 
                class="w-7 h-7 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>

            <button 
              v-else
              @click="addToCart(item, 1)"
              class="h-8 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <!-- Custom Item Card at bottom of catalog -->
        <div class="pt-3 text-center">
          <button 
            @click="openCustomItemModal()"
            class="text-xs font-bold text-slate-500 hover:text-blue-700 inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/50 transition-all cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5 text-amber-500" />
            <span>Item not in warehouse stock? Add Custom Item</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- FLOATING CART PILL -->
    <!-- ========================================================================= -->
    <div 
      v-if="totalItemsCount > 0"
      class="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40"
    >
      <div class="bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
        
        <div class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" @click="isCartDrawerOpen = true">
          <div class="relative">
            <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <ShoppingBag class="w-5 h-5" />
            </div>
            <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900">
              {{ totalUnitsCount }}
            </span>
          </div>

          <div class="min-w-0">
            <div class="text-[10px] text-slate-400 font-medium leading-none">ORDER TOTAL</div>
            <div class="text-sm font-bold font-mono text-emerald-400">
              ₹{{ cartTotals.grandTotal.toLocaleString('en-IN') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button 
            @click="isCartDrawerOpen = true"
            class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Review Cart
          </button>
          <button 
            @click="proceedToCheckout"
            class="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <span>Proceed</span>
            <ChevronDown class="w-3.5 h-3.5 rotate-270" />
          </button>
        </div>

      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- CART DRAWER (Slide-up Item Configurator) -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="isCartDrawerOpen" 
        class="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex flex-col justify-end"
        @click.self="isCartDrawerOpen = false"
      >
        <div class="bg-white rounded-t-3xl max-w-xl w-full mx-auto max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
          
          <!-- Header -->
          <div class="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                <ShoppingBag class="w-4 h-4" />
              </div>
              <div>
                <h3 class="font-bold text-slate-900 text-sm">Your Order Items</h3>
                <span class="text-[11px] text-slate-400 font-medium">
                  {{ totalItemsCount }} items ({{ totalUnitsCount }} units)
                </span>
              </div>
            </div>
            <button 
              @click="isCartDrawerOpen = false" 
              class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Items List -->
          <div class="flex-1 overflow-y-auto p-3.5 space-y-3">
            <div 
              v-for="c in cartItemsList" 
              :key="c.id"
              class="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span v-if="c.isCustom" class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      Custom Item
                    </span>
                    <h5 class="text-xs font-bold text-slate-900 truncate">
                      {{ c.isCustom ? c.customName : ((rawProducts || []).find(x => x.id === c.id)?.name || 'Product') }}
                    </h5>
                    <span v-if="c.applyLastPrice" class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                      Last Price
                    </span>
                    <span v-if="c.isTaxInclusive" class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                      Incl. Tax
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-500 font-mono mt-0.5">
                    ₹{{ c.customPrice.toLocaleString('en-IN') }} × {{ c.qty }} = 
                    <span class="font-bold text-slate-900 font-mono">₹{{ (c.customPrice * c.qty).toLocaleString('en-IN') }}</span>
                  </div>
                </div>

                <!-- Quantity Stepper -->
                <div class="flex items-center gap-2 shrink-0">
                  <div class="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                    <button 
                      @click="c.isCustom ? (c.qty > 1 ? c.qty-- : deleteCartItem(c.id)) : addToCart({ id: c.id }, -1)" 
                      class="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold cursor-pointer"
                    >
                      <Minus class="w-3 h-3" />
                    </button>
                    
                    <input 
                      type="number" 
                      min="1"
                      v-model.number="c.qty"
                      class="w-12 h-6 text-center font-mono font-bold text-xs text-slate-900 bg-transparent border-0 focus:outline-hidden"
                      title="Type any quantity directly"
                    />

                    <button 
                      @click="c.isCustom ? c.qty++ : addToCart({ id: c.id }, 1)" 
                      class="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                    >
                      <Plus class="w-3 h-3" />
                    </button>
                  </div>

                  <!-- Accordion toggle -->
                  <button 
                    @click="toggleItemAccordion(c.id)" 
                    class="text-slate-400 hover:text-blue-600 p-1 text-xs cursor-pointer" 
                    title="Edit Rate & Tax"
                  >
                    <ChevronUp v-if="c.isExpanded" class="w-4 h-4 text-blue-600" />
                    <ChevronDown v-else class="w-4 h-4" />
                  </button>

                  <!-- Delete -->
                  <button 
                    @click="deleteCartItem(c.id)" 
                    class="text-slate-300 hover:text-rose-600 p-1 text-xs cursor-pointer"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Expandable Pricing Controls -->
              <div v-if="c.isExpanded" class="pt-2.5 mt-2 border-t border-slate-200/80 space-y-2.5 text-xs animate-in fade-in duration-150">
                <div class="grid grid-cols-2 gap-2">
                  <!-- Rate override -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[10px] font-bold text-slate-600">Billing Rate (₹)</label>
                      <button 
                        @click="openRateCalc(c.id, c.isCustom ? c.customName : 'Sq.ft Calculator')"
                        class="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Calculator class="w-3 h-3" />
                        <span>Sq.ft Calc</span>
                      </button>
                    </div>
                    <div class="relative">
                      <span class="absolute left-2.5 top-1.5 text-slate-400 font-mono text-xs">₹</span>
                      <input 
                        type="number" 
                        v-model.number="c.customPrice"
                        class="w-full bg-white border border-slate-300 rounded-xl py-1.5 pl-6 pr-2 font-mono font-bold text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <!-- Tax Mode toggle -->
                  <div>
                    <label class="text-[10px] font-bold text-slate-600 block mb-1">Tax Status</label>
                    <div class="grid grid-cols-2 bg-slate-200/80 p-0.5 rounded-xl text-[10px] font-bold text-center">
                      <button 
                        type="button"
                        @click="c.isTaxInclusive = false"
                        class="py-1 rounded-lg transition-all cursor-pointer"
                        :class="!c.isTaxInclusive ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
                      >
                        + 18% GST
                      </button>
                      <button 
                        type="button"
                        @click="c.isTaxInclusive = true"
                        class="py-1 rounded-lg transition-all cursor-pointer"
                        :class="c.isTaxInclusive ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
                      >
                        Incl. Tax
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Price History Bar -->
                <div 
                  v-if="!c.isCustom && customerLastPrices[c.id]?.lastPrice"
                  class="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl text-[11px]"
                >
                  <div class="text-slate-600">
                    <span class="font-bold text-purple-700">Last: ₹{{ Number(customerLastPrices[c.id].lastPrice).toLocaleString('en-IN') }}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button 
                      @click="openPriceHistory((rawProducts || []).find(x => x.id === c.id))"
                      class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Clock class="w-3 h-3 text-purple-600" />
                      <span>History</span>
                    </button>
                    <button 
                      @click="applyLastPriceToItem(c.id)"
                      class="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Zap class="w-3 h-3 text-amber-500" />
                      <span>Apply Last</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Add Custom Item Inside Drawer -->
            <div class="pt-1">
              <button 
                @click="openCustomItemModal()"
                class="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5 text-blue-500" />
                <span>Add Non-Catalog / Custom Item</span>
              </button>
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
            <div class="space-y-1 text-xs">
              <div class="flex justify-between text-slate-500">
                <span>Taxable Subtotal</span>
                <span class="font-mono font-medium text-slate-800">₹{{ cartTotals.taxableTotal.toLocaleString('en-IN') }}</span>
              </div>
              <div class="flex justify-between text-slate-500">
                <span>GST (18% Estimated)</span>
                <span class="font-mono font-medium text-slate-800">₹{{ cartTotals.gstTotal.toLocaleString('en-IN') }}</span>
              </div>
              <div class="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Grand Total</span>
                <span class="font-mono text-base font-black text-blue-900">₹{{ cartTotals.grandTotal.toLocaleString('en-IN') }}</span>
              </div>
            </div>

            <button 
              @click="proceedToCheckout"
              class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Proceed to Delivery & Logistics</span>
              <ChevronDown class="w-3.5 h-3.5 rotate-270" />
            </button>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- ========================================================================= -->
    <!-- CUSTOMER SELECTOR MODAL -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="isCustomerModalOpen"
        class="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isCustomerModalOpen = false"
      >
        <div class="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
          
          <!-- Header -->
          <div class="p-3.5 bg-[#1b3b5f] text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Building2 class="w-4 h-4 text-amber-400" />
              <div>
                <h4 class="font-bold text-xs text-white">Select Customer / Party</h4>
                <p class="text-[10px] text-blue-200">Choose from BUSY or add custom walk-in</p>
              </div>
            </div>
            <button @click="isCustomerModalOpen = false" class="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Tabs -->
          <div class="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-center">
            <button 
              @click="customerModalTab = 'db'"
              class="py-1.5 rounded-xl transition-all"
              :class="customerModalTab === 'db' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
            >
              Database (BUSY)
            </button>
            <button 
              @click="customerModalTab = 'custom'"
              class="py-1.5 rounded-xl transition-all"
              :class="customerModalTab === 'custom' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
            >
              + Custom / Walk-In
            </button>
          </div>

          <!-- Content -->
          <div class="p-3.5 overflow-y-auto flex-1 space-y-3">
            
            <!-- View 1: Database Customers -->
            <div v-if="customerModalTab === 'db'" class="space-y-2">
              <div class="relative">
                <Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  v-model="customerSearchQuery"
                  type="text" 
                  placeholder="Search customer name, city, phone..." 
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500" 
                />
              </div>

              <div class="space-y-1.5 pt-1 max-h-72 overflow-y-auto">
                <div 
                  v-for="c in filteredDbCustomers" 
                  :key="c.id"
                  @click="selectDbCustomer(c)"
                  class="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center justify-between gap-2"
                  :class="selectedCustomerId === c.id && !isCustomCustomer ? 'border-blue-500 bg-blue-50/70' : ''"
                >
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-xs text-slate-900 truncate">{{ c.company || c.name }}</div>
                    <div class="text-[10px] text-slate-500 truncate">
                      {{ [c.city, c.phone, c.paymentTerms].filter(Boolean).join(' • ') }}
                    </div>
                  </div>
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    Active
                  </span>
                </div>
              </div>
            </div>

            <!-- View 2: Custom Customer Form -->
            <div v-else class="space-y-3 text-xs">
              <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug">
                <strong>Walk-in / Cash Party:</strong> Use for counter clients not in BUSY. Order booking is processed on an immediate cash/cheque settlement basis.
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Customer / Party Name *</label>
                <input 
                  v-model="customCustomer.name"
                  type="text" 
                  placeholder="e.g. Royal Interiors / Rajesh Patel" 
                  class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 font-bold focus:outline-hidden focus:border-amber-500" 
                />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[11px] font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input 
                    v-model="customCustomer.phone"
                    type="tel" 
                    placeholder="e.g. 9845012345" 
                    class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 font-medium focus:outline-hidden focus:border-amber-500" 
                  />
                </div>
                <div>
                  <label class="text-[11px] font-bold text-slate-700 block mb-1">City / Location</label>
                  <input 
                    v-model="customCustomer.city"
                    type="text" 
                    placeholder="e.g. Hubli / Dharwad" 
                    class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 font-medium focus:outline-hidden focus:border-amber-500" 
                  />
                </div>
              </div>

              <button 
                @click="saveCustomCustomer"
                class="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer mt-2"
              >
                Confirm & Select Custom Customer
              </button>
            </div>

          </div>

        </div>
      </div>
    </Teleport>

    <!-- ========================================================================= -->
    <!-- CUSTOM NON-CATALOG ITEM MODAL -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="isCustomItemModalOpen"
        class="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isCustomItemModalOpen = false"
      >
        <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-150">
          
          <div class="p-3.5 bg-amber-600 text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-amber-200" />
              <div>
                <h4 class="font-bold text-xs text-white">+ Add Non-Catalog / Custom Item</h4>
                <p class="text-[10px] text-amber-100">Special sizes, cut pieces, or manual billing</p>
              </div>
            </div>
            <button @click="isCustomItemModalOpen = false" class="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 space-y-3 text-xs">
            <div>
              <label class="text-[11px] font-bold text-slate-700 block mb-1">Item Title / Description *</label>
              <input 
                v-model="customItemForm.name"
                type="text" 
                placeholder="e.g. 19mm Calibrated Birch Plywood (Cut Size)" 
                class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-600" 
              />
            </div>

            <div>
              <label class="text-[11px] font-bold text-slate-700 block mb-1">Specification / Size Remarks</label>
              <input 
                v-model="customItemForm.spec"
                type="text" 
                placeholder="e.g. 8x2 ft edge-banded strip" 
                class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-700 focus:outline-hidden focus:border-amber-600" 
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Quantity</label>
                <div class="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-1 gap-1">
                  <button 
                    @click="customItemForm.qty > 1 ? customItemForm.qty-- : 1" 
                    class="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    <Minus class="w-3 h-3" />
                  </button>
                  <input 
                    type="number" 
                    v-model.number="customItemForm.qty"
                    min="1" 
                    class="w-full text-center font-mono font-bold text-xs text-slate-900 bg-transparent border-0 focus:outline-hidden" 
                  />
                  <button 
                    @click="customItemForm.qty++" 
                    class="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    <Plus class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Unit</label>
                <select v-model="customItemForm.unit" class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800">
                  <option>Sheets</option>
                  <option>Sq.ft</option>
                  <option>Pcs</option>
                  <option>Boxes</option>
                  <option>Rolls</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[11px] font-bold text-slate-700">Billing Rate (₹)</label>
                  <button 
                    @click="openRateCalc('custom_form', customItemForm.name || 'Custom Item Rate')"
                    class="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Calculator class="w-3 h-3" />
                    <span>Calc</span>
                  </button>
                </div>
                <div class="relative">
                  <span class="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">₹</span>
                  <input 
                    type="number" 
                    v-model.number="customItemForm.rate"
                    class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-6 pr-2 font-mono font-bold text-xs text-slate-900 focus:outline-hidden focus:border-amber-600" 
                  />
                </div>
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Tax Mode</label>
                <div class="grid grid-cols-2 bg-slate-200/80 p-0.5 rounded-xl text-[10px] font-bold text-center h-[38px] items-center">
                  <button 
                    type="button"
                    @click="customItemForm.isTaxInclusive = false"
                    class="py-1 rounded-lg transition-all cursor-pointer"
                    :class="!customItemForm.isTaxInclusive ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
                  >
                    +18% GST
                  </button>
                  <button 
                    type="button"
                    @click="customItemForm.isTaxInclusive = true"
                    class="py-1 rounded-lg transition-all cursor-pointer"
                    :class="customItemForm.isTaxInclusive ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
                  >
                    Incl. Tax
                  </button>
                </div>
              </div>
            </div>

            <button 
              @click="addCustomItemToCart"
              class="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer mt-2"
            >
              Add Custom Item to Cart
            </button>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- ========================================================================= -->
    <!-- SQ.FT RATE CALCULATOR MODAL -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="isRateCalcModalOpen"
        class="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isRateCalcModalOpen = false"
      >
        <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-150">
          
          <div class="p-3.5 bg-[#1b3b5f] text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Calculator class="w-4 h-4 text-emerald-400" />
              <div>
                <h4 class="font-bold text-xs text-white">Sq.ft Sheet Rate Calculator</h4>
                <p class="text-[10px] text-blue-200 truncate max-w-[200px]">{{ rateCalcState.title }}</p>
              </div>
            </div>
            <button @click="isRateCalcModalOpen = false" class="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 space-y-3.5 text-xs">
            <div>
              <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Standard Dimensions (Feet)</label>
              <div class="grid grid-cols-4 gap-1.5 font-bold text-center">
                <button 
                  v-for="preset in [[8,4], [7,4], [7,3], [6,4]]" 
                  :key="`${preset[0]}x${preset[1]}`"
                  type="button"
                  @click="rateCalcState.length = preset[0]; rateCalcState.width = preset[1]"
                  class="py-1.5 rounded-xl border transition-all cursor-pointer"
                  :class="rateCalcState.length === preset[0] && rateCalcState.width === preset[1] ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-slate-300 text-slate-700'"
                >
                  {{ preset[0] }} × {{ preset[1] }} {{ preset[0] === 8 ? '★' : '' }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] font-bold text-slate-600 block mb-1">Length (ft)</label>
                <input 
                  type="number" 
                  v-model.number="rateCalcState.length"
                  class="w-full bg-white border border-slate-300 rounded-lg py-1 pl-2.5 pr-2 font-bold text-xs text-slate-900 text-center" 
                />
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-600 block mb-1">Width (ft)</label>
                <input 
                  type="number" 
                  v-model.number="rateCalcState.width"
                  class="w-full bg-white border border-slate-300 rounded-lg py-1 pl-2.5 pr-2 font-bold text-xs text-slate-900 text-center" 
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-[10px] font-bold text-slate-600">Rate per Sq.ft (₹)</label>
                <span class="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                  {{ calculatedSheetArea }} sq.ft
                </span>
              </div>
              <div class="relative">
                <span class="absolute left-3 top-2 text-slate-400 font-mono text-sm">₹</span>
                <input 
                  type="number" 
                  v-model.number="rateCalcState.sqftRate"
                  class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-7 pr-3 font-mono font-bold text-sm text-slate-900 focus:outline-hidden focus:border-blue-500" 
                />
              </div>
            </div>

            <div class="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-3 text-center space-y-0.5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Calculated Sheet Rate</span>
              <div class="text-xl font-black font-mono text-emerald-700">₹{{ calculatedSheetRate.toLocaleString('en-IN') }}.00</div>
              <div class="text-[10px] text-emerald-600/80 font-mono">{{ calculatedSheetArea }} sq.ft × ₹{{ rateCalcState.sqftRate }} / sq.ft</div>
            </div>

            <button 
              @click="applyCalculatedRate"
              class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              Apply Rate to Item
            </button>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- ========================================================================= -->
    <!-- PRICE HISTORY MODAL (Reusing Existing Component) -->
    <!-- ========================================================================= -->
    <PriceHistoryModal
      v-model="isPriceHistoryOpen"
      :product-id="phProductId"
      :product-name="phProductName"
      :product-sku="phProductSku"
      :customer-id="selectedCustomerId"
      :customer-name="selectedCustomer?.company || selectedCustomer?.name"
      @apply-price="onApplyPriceHistory"
    />

    <!-- ========================================================================= -->
    <!-- STEP 2: DELIVERY & FINAL REVIEW MODAL -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="isCheckoutModalOpen" 
        class="fixed inset-0 bg-white z-50 flex flex-col"
      >
        <!-- Header -->
        <div class="p-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div class="flex items-center gap-2">
            <button 
              @click="isCheckoutModalOpen = false; isCartDrawerOpen = true" 
              class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center text-xs cursor-pointer shadow-2xs"
            >
              <ArrowLeft class="w-4 h-4" />
            </button>
            <div>
              <h3 class="font-bold text-slate-900 text-sm">Step 2: Dispatch & Review</h3>
              <p class="text-[10px] text-slate-500">Customer terms, logistics, and itemized confirmation</p>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Ready to Book
          </span>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
          
          <!-- SECTION 1: Customer Card with Live Credit Balance -->
          <div class="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-1">
            <div class="font-bold text-blue-950 flex items-center justify-between">
              <span>{{ isCustomCustomer ? `${customCustomer.name} (CUSTOM PARTY)` : (selectedCustomer?.company || selectedCustomer?.name) }}</span>
              <span 
                class="text-[10px] px-2 py-0.5 rounded-full font-bold border"
                :class="customerCreditInfo.badgeClass"
              >
                {{ customerCreditInfo.badgeText }}
              </span>
            </div>
            <div class="text-[11px] text-slate-600">
              {{ customerCreditInfo.description }}
            </div>
          </div>

          <!-- SECTION 2: Transport Mode -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-800">Dispatch & Transport Mode</label>
            <div class="grid grid-cols-3 gap-2 text-center text-xs">
              <div 
                @click="transportMode = 'OUR_FLEET'"
                class="p-2.5 rounded-xl border-2 transition-all cursor-pointer"
                :class="transportMode === 'OUR_FLEET' ? 'border-blue-600 bg-blue-50/60 text-blue-950 font-bold' : 'border-slate-200 hover:border-slate-300 text-slate-700 font-semibold'"
              >
                <Truck class="w-4 h-4 mx-auto mb-1" :class="transportMode === 'OUR_FLEET' ? 'text-blue-600' : 'text-slate-400'" />
                <span>Our Truck</span>
              </div>

              <div 
                @click="transportMode = 'PARTY_VEHICLE'"
                class="p-2.5 rounded-xl border-2 transition-all cursor-pointer"
                :class="transportMode === 'PARTY_VEHICLE' ? 'border-blue-600 bg-blue-50/60 text-blue-950 font-bold' : 'border-slate-200 hover:border-slate-300 text-slate-700 font-semibold'"
              >
                <User class="w-4 h-4 mx-auto mb-1" :class="transportMode === 'PARTY_VEHICLE' ? 'text-blue-600' : 'text-slate-400'" />
                <span>Self Pickup</span>
              </div>

              <div 
                @click="transportMode = 'THIRD_PARTY'"
                class="p-2.5 rounded-xl border-2 transition-all cursor-pointer"
                :class="transportMode === 'THIRD_PARTY' ? 'border-blue-600 bg-blue-50/60 text-blue-950 font-bold' : 'border-slate-200 hover:border-slate-300 text-slate-700 font-semibold'"
              >
                <Car class="w-4 h-4 mx-auto mb-1" :class="transportMode === 'THIRD_PARTY' ? 'text-blue-600' : 'text-slate-400'" />
                <span>Transporter</span>
              </div>
            </div>
          </div>

          <!-- Delivery Address -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Delivery Destination Address</span>
              <span class="text-[10px] text-blue-600 font-medium">Site / Destination</span>
            </label>
            <textarea 
              v-model="deliveryAddress"
              rows="2" 
              placeholder="Delivery address, site, or landmark..."
              class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium resize-none"
            ></textarea>
          </div>

          <!-- SECTION 3: Payment Terms (Clean, Dispatch Date Removed!) -->
          <div class="space-y-1 text-xs">
            <label class="text-[10px] font-bold text-slate-600 block">Payment Terms</label>
            <select 
              v-model="paymentTerms"
              class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
            >
              <option>30 Days Credit</option>
              <option>15 Days Credit</option>
              <option>Immediate / Cheque</option>
              <option>Advance RTGS / UPI</option>
            </select>
          </div>

          <!-- Urgent Priority Flag -->
          <div class="flex items-center gap-2 p-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
            <input 
              type="checkbox" 
              id="urgent-check-modal" 
              v-model="isUrgent"
              class="rounded text-amber-600 cursor-pointer" 
            />
            <label for="urgent-check-modal" class="font-bold text-amber-950 flex items-center gap-1 cursor-pointer">
              <Zap class="w-3.5 h-3.5 text-amber-500" />
              <span>Mark as High-Priority / Urgent Dispatch</span>
            </label>
          </div>

          <!-- Order Notes -->
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-600 block">Internal Order Remarks (Optional)</label>
            <input 
              v-model="orderNotes"
              type="text" 
              placeholder="e.g. Call before loading / Handle sheets with care..."
              class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
            />
          </div>

          <!-- SECTION 4: FULL ITEMIZED SUMMARY ON DELIVERY PAGE -->
          <div class="pt-2 border-t border-slate-200 space-y-2.5">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 class="w-4 h-4 text-blue-600" />
                <span>Order Items Summary</span>
              </h4>
              <span class="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {{ totalItemsCount }} items
              </span>
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              <div class="space-y-1.5 divide-y divide-slate-200/70 text-xs">
                <div 
                  v-for="(c, idx) in cartItemsList" 
                  :key="c.id"
                  class="py-1.5 flex items-start justify-between gap-2"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-bold text-slate-400 font-mono">#{{ idx + 1 }}</span>
                      <span class="font-bold text-slate-900 text-xs truncate">
                        {{ c.isCustom ? c.customName : ((rawProducts || []).find(x => x.id === c.id)?.name || 'Product') }}
                      </span>
                      <span v-if="c.isCustom" class="text-[8px] font-bold px-1 rounded bg-amber-100 text-amber-800">
                        Custom
                      </span>
                    </div>
                    <div class="text-[10px] text-slate-500 font-mono">
                      {{ c.qty }} {{ c.isCustom ? c.customUnit : ((rawProducts || []).find(x => x.id === c.id)?.unit || 'Sheet') }} × ₹{{ c.customPrice.toLocaleString('en-IN') }} 
                      <span v-if="c.isTaxInclusive" class="text-blue-700 font-bold">(Tax Incl)</span>
                      <span v-else>+ 18% GST</span>
                    </div>
                  </div>
                  <div class="font-mono font-bold text-xs text-slate-900 text-right shrink-0">
                    ₹{{ (c.qty * c.customPrice).toLocaleString('en-IN') }}
                  </div>
                </div>
              </div>

              <!-- Subtotal Breakdown -->
              <div class="pt-2 border-t border-slate-200 space-y-1 text-[11px]">
                <div class="flex justify-between text-slate-600">
                  <span>Taxable Amount</span>
                  <span class="font-mono font-medium">₹{{ cartTotals.taxableTotal.toLocaleString('en-IN') }}</span>
                </div>
                <div class="flex justify-between text-slate-600">
                  <span>Estimated GST (18%)</span>
                  <span class="font-mono font-medium">₹{{ cartTotals.gstTotal.toLocaleString('en-IN') }}</span>
                </div>
                <div class="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Grand Total (Payable)</span>
                  <span class="font-mono text-sm text-blue-900 font-black">₹{{ cartTotals.grandTotal.toLocaleString('en-IN') }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Sticky Confirmation Footer -->
        <div class="p-3.5 border-t border-slate-200 bg-white shrink-0">
          <div class="max-w-2xl mx-auto w-full">
            <button 
              @click="confirmAndPlaceOrder" 
              :disabled="isSubmitting"
              class="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <CheckCircle2 v-else class="w-4 h-4" />
              <span>{{ isSubmitting ? 'Booking Order...' : 'Confirm & Book Order' }}</span>
            </button>
          </div>
        </div>

      </div>
    </Teleport>

  </div>
</template>
