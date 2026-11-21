<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import gsap from 'gsap'
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

const isOrderCompleted = ref(false)

// Guard against non-admin direct access
onMounted(() => {
  if (user.value && user.value.role !== 'ADMIN') {
    router.replace('/dashboard/orders')
  }
})

// Prevent accidental exit when cart has active items
onBeforeRouteLeave((to, from, next) => {
  if (totalItemsCount.value > 0 && !isOrderCompleted.value) {
    const confirmLeave = window.confirm(`You have ${totalItemsCount.value} item(s) in your quick cart. Leave quick order?`)
    if (confirmLeave) {
      next()
    } else {
      next(false)
    }
  } else {
    next()
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
    const aliasMatch = (p.alias || '').toLowerCase().includes(q)
    return nameMatch || skuMatch || brandMatch || catMatch || aliasMatch
  })
})

// ── CATALOG PAGINATION & PROGRESSIVE SCROLL ───────────────────
const PAGE_BATCH_SIZE = 30
const visibleProductCount = ref(PAGE_BATCH_SIZE)

const displayedProducts = computed(() => {
  return filteredProducts.value.slice(0, visibleProductCount.value)
})

const hasMoreProducts = computed(() => {
  return visibleProductCount.value < filteredProducts.value.length
})

const loadMoreProducts = () => {
  if (hasMoreProducts.value) {
    visibleProductCount.value += PAGE_BATCH_SIZE
  }
}

// Reset visible count when search or category filter changes
watch([searchQuery, selectedCategory], () => {
  visibleProductCount.value = PAGE_BATCH_SIZE
  nextTick(() => {
    animateProductCards()
  })
})

const infiniteScrollSentinel = ref<HTMLElement | null>(null)
let scrollObserver: IntersectionObserver | null = null

const handleWindowScroll = () => {
  if (!hasMoreProducts.value) return
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const clientHeight = window.innerHeight || document.documentElement.clientHeight
  if (scrollHeight - (scrollTop + clientHeight) < 400) {
    loadMoreProducts()
  }
}

const setupScrollObserver = () => {
  if (typeof window === 'undefined') return
  if (scrollObserver) {
    scrollObserver.disconnect()
    scrollObserver = null
  }

  if ('IntersectionObserver' in window) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target && target.isIntersecting) {
          loadMoreProducts()
        }
      },
      {
        root: null,
        rootMargin: '400px',
        threshold: 0.05
      }
    )

    if (infiniteScrollSentinel.value) {
      scrollObserver.observe(infiniteScrollSentinel.value)
    }
  }
}

watch(infiniteScrollSentinel, (el) => {
  if (el && scrollObserver) {
    scrollObserver.disconnect()
    scrollObserver.observe(el)
  }
})

// ── UNIQUE ALIAS & TAX HELPERS ─────────────────────────────────
const getProductAlias = (item: any): string | null => {
  if (!item) return null
  const name = (item.name || item.customName || '').trim().toLowerCase()
  if (item.alias && item.alias.trim().toLowerCase() !== name) {
    return item.alias.trim()
  }
  if (item.sku && item.sku.trim().toLowerCase() !== name) {
    return item.sku.trim()
  }
  return null
}

const getItemTaxRate = (c: CartItem | any): number => {
  if (!c) return 18
  if (c.isCustom) return 18
  const p = (rawProducts.value || []).find(x => x.id === c.id)
  if (p && p.taxRate != null && !isNaN(Number(p.taxRate))) {
    return Number(p.taxRate)
  }
  return 18
}

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

    const taxRate = getItemTaxRate(c)
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

// ── GSAP ANIMATIONS ────────────────────────────────────────────
const animateProductCards = () => {
  nextTick(() => {
    const cards = document.querySelectorAll('.quick-product-card')
    if (cards.length > 0) {
      gsap.fromTo(cards, 
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.02, ease: 'power2.out', clearProps: 'transform,opacity' }
      )
    }
  })
}

const animateCartPill = () => {
  nextTick(() => {
    const pill = document.querySelector('.floating-cart-pill')
    if (pill) {
      gsap.fromTo(pill,
        { y: 35, opacity: 0, scale: 0.94 },
        { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.4)' }
      )
    }
  })
}

const animateModalEntry = (cardSelector: string, isDrawer = false) => {
  nextTick(() => {
    const card = document.querySelector(cardSelector)
    if (!card) return
    if (isDrawer && typeof window !== 'undefined' && window.innerWidth < 640) {
      gsap.fromTo(card,
        { y: '100%', opacity: 0 },
        { y: '0%', opacity: 1, duration: 0.32, ease: 'power3.out' }
      )
    } else {
      gsap.fromTo(card,
        { scale: 0.92, opacity: 0, y: 14 },
        { scale: 1, opacity: 1, y: 0, duration: 0.26, ease: 'back.out(1.2)' }
      )
    }
  })
}

const animateButtonTap = (el?: HTMLElement | EventTarget | null) => {
  if (!el || !(el instanceof HTMLElement)) return
  gsap.fromTo(el,
    { scale: 0.85 },
    { scale: 1, duration: 0.18, ease: 'back.out(2.5)' }
  )
}

// ── MODAL NAVIGATION & BROWSER/MOBILE BACK BUTTON STACK ────────
let internalPopCounter = 0

const pushModalHistory = (name: string) => {
  if (typeof window !== 'undefined') {
    window.history.pushState({ quickOrderModal: name }, '')
  }
}

const popModalHistory = () => {
  if (typeof window !== 'undefined' && window.history.state?.quickOrderModal) {
    internalPopCounter++
    window.history.back()
  }
}

const onPopState = (e: PopStateEvent) => {
  if (internalPopCounter > 0) {
    internalPopCounter--
    return
  }

  // Handle hardware / browser back button in priority order of modal hierarchy:
  if (isPriceHistoryOpen.value) {
    isPriceHistoryOpen.value = false
    return
  }
  if (isRateCalcModalOpen.value) {
    isRateCalcModalOpen.value = false
    return
  }
  if (isCustomItemModalOpen.value) {
    isCustomItemModalOpen.value = false
    return
  }
  if (isCheckoutModalOpen.value) {
    // Stepping back from Step 2: return to Cart Drawer
    isCheckoutModalOpen.value = false
    isCartDrawerOpen.value = true
    animateModalEntry('.cart-drawer-card', true)
    return
  }
  if (isCustomerModalOpen.value) {
    isCustomerModalOpen.value = false
    return
  }
  if (isCartDrawerOpen.value) {
    isCartDrawerOpen.value = false
    return
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onPopState)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
    setupScrollObserver()
  }
  nextTick(() => {
    gsap.from('.quick-top-nav', {
      y: -10,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out'
    })
    gsap.from('.quick-order-header', {
      y: -14,
      opacity: 0,
      duration: 0.35,
      ease: 'power2.out'
    })
    animateProductCards()
  })
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('popstate', onPopState)
    window.removeEventListener('scroll', handleWindowScroll)
  }
  if (scrollObserver) {
    scrollObserver.disconnect()
    scrollObserver = null
  }
})

// Header / Page Back Button handler
const handlePageBack = () => {
  if (isPriceHistoryOpen.value) {
    closePriceHistory()
    return
  }
  if (isRateCalcModalOpen.value) {
    closeRateCalcModal()
    return
  }
  if (isCustomItemModalOpen.value) {
    closeCustomItemModal()
    return
  }
  if (isCheckoutModalOpen.value) {
    backToCartFromCheckout()
    return
  }
  if (isCustomerModalOpen.value) {
    closeCustomerModal()
    return
  }
  if (isCartDrawerOpen.value) {
    closeCartDrawer()
    return
  }

  if (totalItemsCount.value > 0) {
    const confirmLeave = window.confirm(`You have ${totalItemsCount.value} item(s) in your quick cart. Exit without placing order?`)
    if (!confirmLeave) return
  }
  router.push('/dashboard/orders')
}

// Modal Open / Close wrappers
const openCartDrawer = () => {
  isCartDrawerOpen.value = true
  pushModalHistory('cart')
  animateModalEntry('.cart-drawer-card', true)
}

const closeCartDrawer = () => {
  isCartDrawerOpen.value = false
  popModalHistory()
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
  pushModalHistory('custom-item')
  animateModalEntry('.custom-item-card', false)
}

const closeCustomItemModal = () => {
  isCustomItemModalOpen.value = false
  popModalHistory()
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
  popModalHistory()
  openCartDrawer()
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
  pushModalHistory('rate-calc')
  animateModalEntry('.rate-calc-card', false)
}

const closeRateCalcModal = () => {
  isRateCalcModalOpen.value = false
  rateCalcTargetId.value = null
  popModalHistory()
}

const applyCalculatedRate = () => {
  const rate = calculatedSheetRate.value
  if (rateCalcTargetId.value === 'custom_form') {
    customItemForm.value.rate = rate
  } else if (rateCalcTargetId.value && cart.value[rateCalcTargetId.value]) {
    cart.value[rateCalcTargetId.value].customPrice = rate
    cart.value[rateCalcTargetId.value].applyLastPrice = false
  }
  closeRateCalcModal()
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
  pushModalHistory('price-history')
}

const closePriceHistory = () => {
  isPriceHistoryOpen.value = false
  popModalHistory()
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
  closePriceHistory()
}

// ── CUSTOMER SELECTOR MODAL ────────────────────────────────────
const isCustomerModalOpen = ref(false)
const customerModalTab = ref<'db' | 'custom'>('db')
const customerSearchQuery = ref('')

const openCustomerModal = () => {
  isCustomerModalOpen.value = true
  pushModalHistory('customer')
  animateModalEntry('.customer-modal-card', false)
}

const closeCustomerModal = () => {
  isCustomerModalOpen.value = false
  popModalHistory()
}

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
  closeCustomerModal()
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
  closeCustomerModal()
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
  pushModalHistory('checkout')
  animateModalEntry('.checkout-modal-card', false)
}

const backToCartFromCheckout = () => {
  isCheckoutModalOpen.value = false
  isCartDrawerOpen.value = true
  animateModalEntry('.cart-drawer-card', true)
}

const handleAddToCart = (product: any, change: number = 1, event?: MouseEvent) => {
  if (event?.currentTarget) animateButtonTap(event.currentTarget)
  addToCart(product, change)
}

// Watchers for GSAP reactive animations
watch(selectedCategory, () => {
  animateProductCards()
})

watch(() => totalItemsCount.value > 0, (hasItems, wasHaving) => {
  if (hasItems && !wasHaving) {
    animateCartPill()
  }
})

watch(() => cartTotals.value.grandTotal, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    nextTick(() => {
      const totalEl = document.querySelector('.cart-pill-total')
      if (totalEl) {
        gsap.fromTo(totalEl,
          { scale: 1.15 },
          { scale: 1, duration: 0.25, ease: 'power2.out' }
        )
      }
    })
  }
})

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

    isOrderCompleted.value = true
    showSaved('Order booked successfully!')
    isCheckoutModalOpen.value = false
    popModalHistory()
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

  <div v-else class="max-w-4xl mx-auto space-y-4 pb-36 sm:pb-32">
    
    <!-- Top Action / Back Navigation Bar -->
    <div class="quick-top-nav flex items-center justify-between gap-3 pt-1">
      <button 
        @click="handlePageBack" 
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
        title="Back to Orders List"
      >
        <ArrowLeft class="w-4 h-4 text-slate-500" />
        <span>Back to Orders</span>
      </button>

      <div class="flex items-center gap-2">
        <span class="text-[11px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
          {{ filteredProducts.length }} Products
        </span>
        <span class="text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
          Admin Beta
        </span>
      </div>
    </div>

    <!-- Customer & Catalog Search Bar -->
    <div class="quick-order-header bg-[#1b3b5f] text-white rounded-2xl p-3 sm:p-4 shadow-lg space-y-3">
      
      <!-- Customer / Party Context Banner -->
      <div class="customer-context-banner bg-blue-950/70 border border-blue-400/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" @click="openCustomerModal">
          <div class="w-10 h-10 rounded-xl bg-blue-500/20 text-amber-400 border border-blue-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <User class="w-5 h-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="font-bold text-white text-xs sm:text-sm md:text-base break-words leading-snug">
              {{ isCustomCustomer ? customCustomer.name : (selectedCustomer?.company || selectedCustomer?.name || 'Select Customer') }}
            </h2>
            <div class="flex items-center gap-2 text-[10px] text-blue-200 mt-0.5 flex-wrap">
              <span v-if="selectedCustomer?.city || customCustomer.city" class="flex items-center gap-1">
                <MapPin class="w-3 h-3 text-blue-300 shrink-0" />
                <span>{{ isCustomCustomer ? customCustomer.city : selectedCustomer?.city }}</span>
              </span>
              <span v-if="!isCustomCustomer && customerCreditInfo.status === 'OVERDUE'" class="text-amber-300 font-bold">
                • Overdue
              </span>
            </div>
          </div>
        </div>

        <!-- Right Side: Badge ABOVE Change Button -->
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <span 
            class="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
            :class="isCustomCustomer ? 'bg-amber-400 text-amber-950' : 'bg-blue-400/20 text-blue-200 border border-blue-400/30'"
          >
            {{ isCustomCustomer ? 'Custom Walk-In' : 'BUSY Customer' }}
          </span>

          <button 
            @click="openCustomerModal"
            class="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-blue-100 border border-white/20 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Change</span>
            <ChevronDown class="w-3.5 h-3.5 text-blue-300" />
          </button>
        </div>
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
          v-for="item in displayedProducts" 
          :key="item.id"
          class="quick-product-card bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between gap-3"
        >
          <div class="flex-1 min-w-0">
            <!-- Line 1: Group Name Badge next to Stock Badge -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- Group Name Badge -->
              <span 
                v-if="item.category?.name || item.categoryName || item.brand" 
                class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide"
              >
                {{ item.category?.name || item.categoryName || item.brand }}
              </span>

              <!-- Stock Badge -->
              <span 
                class="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                :class="item.stock > 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (item.stock > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')"
              >
                {{ item.stock > 0 ? `${item.stock} in stock` : 'Out of stock' }}
              </span>

              <!-- Customer Last Price pill -->
              <button 
                v-if="customerLastPrices[item.id]?.lastPrice"
                @click="openPriceHistory(item)"
                class="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="View full customer price history"
              >
                <Clock class="w-3 h-3 text-purple-600" />
                <span>Last: ₹{{ Number(customerLastPrices[item.id].lastPrice).toLocaleString('en-IN') }}</span>
              </button>
            </div>

            <!-- Line 2: Product Name Full -->
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm mt-1.5 break-words leading-snug">
              {{ item.name }}
            </h4>

            <!-- Line 3: Unique Alias (show only if distinct from product name) -->
            <div v-if="getProductAlias(item)" class="mt-1">
              <span class="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                <span class="text-slate-400 font-sans">Alias:</span>
                <span>{{ getProductAlias(item) }}</span>
              </span>
            </div>

            <!-- Price & Tax -->
            <div class="flex items-center gap-2 mt-1.5">
              <div class="text-sm sm:text-base font-mono font-bold text-blue-950">
                ₹{{ (cart[item.id] ? cart[item.id].customPrice : Number(item.price)).toLocaleString('en-IN') }}
                <span class="text-xs font-normal text-slate-500 font-sans">/ {{ item.unit || 'Sheet' }}</span>
              </div>
              <span 
                v-if="cart[item.id]?.isTaxInclusive" 
                class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800"
              >
                Incl. Tax
              </span>
              <span v-else class="text-[10px] font-medium text-slate-400">
                + {{ item.taxRate != null ? Number(item.taxRate) : 18 }}% GST
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
                @click="handleAddToCart(item, -1, $event)" 
                class="w-8 h-8 rounded-lg bg-white text-emerald-800 hover:bg-emerald-100 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                <Minus class="w-4 h-4" />
              </button>
              
              <input 
                type="number" 
                min="1"
                :value="cart[item.id].qty"
                @change="setDirectCartQty(item.id, ($event.target as HTMLInputElement).value)"
                class="w-14 sm:w-16 h-8 text-center font-mono font-bold text-sm sm:text-base text-emerald-950 bg-white border border-emerald-300 rounded-md focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                title="Type any quantity directly"
              />

              <button 
                @click="handleAddToCart(item, 1, $event)" 
                class="w-8 h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                <Plus class="w-4 h-4" />
              </button>
            </div>

            <button 
              v-else
              @click="handleAddToCart(item, 1, $event)"
              class="h-9 px-4 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Plus class="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <!-- Progressive Infinite Scroll Sentinel -->
        <div v-if="hasMoreProducts" ref="infiniteScrollSentinel" class="py-4 text-center">
          <button 
            type="button" 
            @click="loadMoreProducts"
            class="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs cursor-pointer inline-flex items-center gap-2 active:scale-95 transition-all"
          >
            <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
            <span>Loading more products ({{ displayedProducts.length }} of {{ filteredProducts.length }})...</span>
          </button>
        </div>

        <div v-else-if="filteredProducts.length > 30" class="py-3 text-center text-xs text-slate-400 font-medium">
          ✓ Showing all {{ filteredProducts.length }} products
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
      class="floating-cart-pill fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 inset-x-4 max-w-lg mx-auto z-[450]"
    >
      <div class="bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
        
        <div class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" @click="openCartDrawer">
          <div class="relative">
            <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <ShoppingBag class="w-5 h-5" />
            </div>
            <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-slate-900 shadow-xs">
              {{ totalUnitsCount }}
            </span>
          </div>

          <div class="min-w-0">
            <div class="text-[10px] text-slate-400 font-medium leading-none">ORDER TOTAL</div>
            <div class="cart-pill-total text-base sm:text-lg font-black font-mono text-emerald-400 tracking-tight">
              ₹{{ cartTotals.grandTotal.toLocaleString('en-IN') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button 
            @click="openCartDrawer"
            class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Review Cart
          </button>
          <button 
            @click="proceedToCheckout"
            class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
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
        class="fixed inset-0 bg-slate-900/60 z-[850] backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4"
        @click.self="closeCartDrawer"
      >
        <div class="cart-drawer-card bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full mx-auto max-h-[85vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
          
          <!-- Header -->
          <div class="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <button 
                @click="closeCartDrawer" 
                class="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs cursor-pointer transition-colors sm:hidden"
                title="Back to Catalog"
              >
                <ArrowLeft class="w-4 h-4" />
              </button>
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 sm:flex hidden items-center justify-center font-bold text-xs">
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
              @click="closeCartDrawer" 
              class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs cursor-pointer"
              title="Close drawer"
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
                    <h5 class="text-xs sm:text-sm font-bold text-slate-900 break-words leading-snug">
                      {{ c.isCustom ? c.customName : ((rawProducts || []).find(x => x.id === c.id)?.name || 'Product') }}
                    </h5>
                    <span v-if="c.applyLastPrice" class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                      Last Price
                    </span>
                    <span v-if="c.isTaxInclusive" class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                      Incl. Tax
                    </span>
                  </div>

                  <!-- Unique Alias in Cart Review (only if unique and distinct from name) -->
                  <div v-if="getProductAlias(c.isCustom ? c : (rawProducts || []).find(x => x.id === c.id))" class="mt-0.5">
                    <span class="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      <span class="text-slate-400 font-sans">Alias:</span>
                      <span>{{ getProductAlias(c.isCustom ? c : (rawProducts || []).find(x => x.id === c.id)) }}</span>
                    </span>
                  </div>
                  <div class="text-xs sm:text-sm text-slate-600 font-mono mt-1">
                    ₹{{ c.customPrice.toLocaleString('en-IN') }} × {{ c.qty }} = 
                    <span class="font-bold text-blue-950 font-mono text-sm sm:text-base">₹{{ (c.customPrice * c.qty).toLocaleString('en-IN') }}</span>
                  </div>
                </div>

                <!-- Quantity Stepper -->
                <div class="flex items-center gap-2 shrink-0">
                  <div class="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
                    <button 
                      @click="c.isCustom ? (c.qty > 1 ? c.qty-- : deleteCartItem(c.id)) : addToCart({ id: c.id }, -1)" 
                      class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
                    >
                      <Minus class="w-3.5 h-3.5" />
                    </button>
                    
                    <input 
                      type="number" 
                      min="1"
                      v-model.number="c.qty"
                      class="w-14 h-7 text-center font-mono font-bold text-sm sm:text-base text-slate-950 bg-transparent border-0 focus:outline-hidden"
                      title="Type any quantity directly"
                    />

                    <button 
                      @click="c.isCustom ? c.qty++ : addToCart({ id: c.id }, 1)" 
                      class="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
                    >
                      <Plus class="w-3.5 h-3.5" />
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
                      <span class="absolute left-2.5 top-2 text-slate-400 font-mono text-xs font-bold">₹</span>
                      <input 
                        type="number" 
                        v-model.number="c.customPrice"
                        class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-6 pr-2 font-mono font-bold text-sm text-slate-900 focus:outline-hidden focus:border-blue-500"
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
                        + {{ getItemTaxRate(c) }}% GST
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
          <div class="p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
            <div class="space-y-1.5 text-xs sm:text-sm">
              <div class="flex justify-between text-slate-500">
                <span>Taxable Subtotal</span>
                <span class="font-mono font-medium text-slate-800">₹{{ cartTotals.taxableTotal.toLocaleString('en-IN') }}</span>
              </div>
              <div class="flex justify-between text-slate-500">
                <span>GST</span>
                <span class="font-mono font-medium text-slate-800">₹{{ cartTotals.gstTotal.toLocaleString('en-IN') }}</span>
              </div>
              <div class="flex justify-between text-sm sm:text-base font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Grand Total</span>
                <span class="font-mono text-lg sm:text-xl font-black text-blue-950">₹{{ cartTotals.grandTotal.toLocaleString('en-IN') }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <button 
                type="button"
                @click="closeCartDrawer" 
                class="py-3.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                title="Back to Catalog"
              >
                <ArrowLeft class="w-4 h-4 text-slate-500" />
                <span class="hidden sm:inline">Back to</span> <span>Catalog</span>
              </button>
              <button 
                @click="proceedToCheckout"
                class="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Proceed to Delivery & Logistics</span>
                <ChevronDown class="w-4 h-4 rotate-270" />
              </button>
            </div>
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
        class="fixed inset-0 bg-slate-900/60 z-[900] backdrop-blur-xs flex items-center justify-center p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        @click.self="closeCustomerModal"
      >
        <div class="customer-modal-card bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
          
          <!-- Header -->
          <div class="p-3.5 bg-[#1b3b5f] text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <button 
                v-if="customerModalTab === 'custom'" 
                @click="customerModalTab = 'db'" 
                class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer transition-colors mr-0.5"
                title="Back to Database list"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
              </button>
              <Building2 class="w-4 h-4 text-amber-400" />
              <div>
                <h4 class="font-bold text-xs text-white">Select Customer / Party</h4>
                <p class="text-[10px] text-blue-200">Choose from BUSY or add custom walk-in</p>
              </div>
            </div>
            <button @click="closeCustomerModal" class="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs cursor-pointer">
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
                  class="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all flex items-start justify-between gap-2.5"
                  :class="selectedCustomerId === c.id && !isCustomCustomer ? 'border-blue-500 bg-blue-50/70' : ''"
                >
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-xs sm:text-sm text-slate-900 break-words leading-snug">{{ c.company || c.name }}</div>
                    <div class="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 break-words">
                      {{ [c.city, c.phone, c.paymentTerms].filter(Boolean).join(' • ') }}
                    </div>
                  </div>
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
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

              <div class="flex items-center gap-2 mt-2">
                <button 
                  type="button"
                  @click="customerModalTab = 'db'"
                  class="py-2.5 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer shrink-0"
                >
                  Back
                </button>
                <button 
                  @click="saveCustomCustomer"
                  class="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Confirm & Select Custom Customer
                </button>
              </div>
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
        class="fixed inset-0 bg-slate-900/60 z-[900] backdrop-blur-xs flex items-center justify-center p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        @click.self="closeCustomItemModal"
      >
        <div class="custom-item-card bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
          
          <div class="p-3.5 bg-amber-600 text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-amber-200" />
              <div>
                <h4 class="font-bold text-xs text-white">+ Add Non-Catalog / Custom Item</h4>
                <p class="text-[10px] text-amber-100">Special sizes, cut pieces, or manual billing</p>
              </div>
            </div>
            <button @click="closeCustomItemModal" class="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 space-y-3.5 text-xs sm:text-sm">
            <div>
              <label class="text-[11px] font-bold text-slate-700 block mb-1">Item Title / Description *</label>
              <input 
                v-model="customItemForm.name"
                type="text" 
                placeholder="e.g. 19mm Calibrated Birch Plywood (Cut Size)" 
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:border-amber-600" 
              />
            </div>

            <div>
              <label class="text-[11px] font-bold text-slate-700 block mb-1">Specification / Size Remarks</label>
              <input 
                v-model="customItemForm.spec"
                type="text" 
                placeholder="e.g. 8x2 ft edge-banded strip" 
                class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm text-slate-700 focus:outline-hidden focus:border-amber-600" 
              />
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Quantity</label>
                <div class="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-1 gap-1">
                  <button 
                    @click="customItemForm.qty > 1 ? customItemForm.qty-- : 1" 
                    class="w-8 h-8 rounded-lg bg-white text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer shadow-2xs"
                  >
                    <Minus class="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="number" 
                    v-model.number="customItemForm.qty"
                    min="1" 
                    class="w-full text-center font-mono font-bold text-sm sm:text-base text-slate-900 bg-transparent border-0 focus:outline-hidden" 
                  />
                  <button 
                    @click="customItemForm.qty++" 
                    class="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm cursor-pointer shadow-2xs"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Unit</label>
                <select v-model="customItemForm.unit" class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-bold text-slate-800 cursor-pointer">
                  <option>Sheets</option>
                  <option>Sq.ft</option>
                  <option>Pcs</option>
                  <option>Boxes</option>
                  <option>Rolls</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
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
                  <span class="absolute left-2.5 top-2.5 text-slate-400 font-mono text-sm font-bold">₹</span>
                  <input 
                    type="number" 
                    v-model.number="customItemForm.rate"
                    class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-6 pr-2 font-mono font-bold text-sm sm:text-base text-slate-900 focus:outline-hidden focus:border-amber-600" 
                  />
                </div>
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-700 block mb-1">Tax Mode</label>
                <div class="grid grid-cols-2 bg-slate-200/80 p-0.5 rounded-xl text-[10px] sm:text-[11px] font-bold text-center h-[42px] items-center">
                  <button 
                    type="button"
                    @click="customItemForm.isTaxInclusive = false"
                    class="py-1.5 rounded-lg transition-all cursor-pointer"
                    :class="!customItemForm.isTaxInclusive ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
                  >
                    +18% GST
                  </button>
                  <button 
                    type="button"
                    @click="customItemForm.isTaxInclusive = true"
                    class="py-1.5 rounded-lg transition-all cursor-pointer"
                    :class="customItemForm.isTaxInclusive ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'"
                  >
                    Incl. Tax
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-2">
              <button 
                type="button"
                @click="closeCustomItemModal"
                class="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0"
              >
                Back
              </button>
              <button 
                @click="addCustomItemToCart"
                class="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus class="w-4 h-4" />
                <span>Add Custom Item</span>
              </button>
            </div>
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
        class="fixed inset-0 bg-slate-900/60 z-[920] backdrop-blur-xs flex items-center justify-center p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        @click.self="closeRateCalcModal"
      >
        <div class="rate-calc-card bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
          
          <div class="p-3.5 bg-[#1b3b5f] text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Calculator class="w-4 h-4 text-emerald-400" />
              <div>
                <h4 class="font-bold text-xs text-white">Sq.ft Sheet Rate Calculator</h4>
                <p class="text-[10px] text-blue-200 truncate max-w-[200px]">{{ rateCalcState.title }}</p>
              </div>
            </div>
            <button @click="closeRateCalcModal" class="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs cursor-pointer">
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

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="text-[10px] font-bold text-slate-600 block mb-1">Length (ft)</label>
                <input 
                  type="number" 
                  v-model.number="rateCalcState.length"
                  class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-2.5 pr-2 font-bold text-sm sm:text-base text-slate-900 text-center" 
                />
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-600 block mb-1">Width (ft)</label>
                <input 
                  type="number" 
                  v-model.number="rateCalcState.width"
                  class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-2.5 pr-2 font-bold text-sm sm:text-base text-slate-900 text-center" 
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
                <span class="absolute left-3 top-2 text-slate-400 font-mono text-sm font-bold">₹</span>
                <input 
                  type="number" 
                  v-model.number="rateCalcState.sqftRate"
                  class="w-full bg-white border border-slate-300 rounded-xl py-2 pl-7 pr-3 font-mono font-bold text-sm sm:text-base text-slate-900 focus:outline-hidden focus:border-blue-500" 
                />
              </div>
            </div>

            <div class="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-3 text-center space-y-0.5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Calculated Sheet Rate</span>
              <div class="text-2xl font-black font-mono text-emerald-700">₹{{ calculatedSheetRate.toLocaleString('en-IN') }}.00</div>
              <div class="text-xs text-emerald-600/80 font-mono">{{ calculatedSheetArea }} sq.ft × ₹{{ rateCalcState.sqftRate }} / sq.ft</div>
            </div>

            <div class="flex items-center gap-2">
              <button 
                type="button"
                @click="closeRateCalcModal"
                class="py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0"
              >
                Back
              </button>
              <button 
                @click="applyCalculatedRate"
                class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check class="w-4 h-4" />
                <span>Apply Rate to Item</span>
              </button>
            </div>
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
        class="fixed inset-0 bg-slate-900/60 z-[900] backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 md:p-6"
        @click.self="backToCartFromCheckout"
      >
        <div class="checkout-modal-card bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full mx-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
          
          <!-- Header -->
          <div class="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
            <div class="flex items-center gap-2.5">
              <button 
                @click="backToCartFromCheckout" 
                class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center text-xs cursor-pointer shadow-2xs transition-colors"
                title="Back to items"
              >
                <ArrowLeft class="w-4 h-4" />
              </button>
              <div>
                <h3 class="font-bold text-slate-900 text-sm">Step 2: Dispatch & Review</h3>
                <p class="text-[10px] text-slate-500">Customer terms, logistics, and itemized confirmation</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Ready to Book
              </span>
              <button 
                @click="backToCartFromCheckout" 
                class="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs cursor-pointer transition-colors sm:flex hidden"
                title="Close"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Scrollable Body -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
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
              class="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:border-blue-500 font-medium resize-none"
            ></textarea>
          </div>

          <!-- SECTION 3: Payment Terms (Clean, Dispatch Date Removed!) -->
          <div class="space-y-1 text-xs">
            <label class="text-[10px] font-bold text-slate-600 block">Payment Terms</label>
            <select 
              v-model="paymentTerms"
              class="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-800 font-bold cursor-pointer"
            >
              <option>30 Days Credit</option>
              <option>15 Days Credit</option>
              <option>Immediate / Cheque</option>
              <option>Advance RTGS / UPI</option>
            </select>
          </div>

          <!-- Urgent Priority Flag -->
          <div class="flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs sm:text-sm">
            <input 
              type="checkbox" 
              id="urgent-check-modal" 
              v-model="isUrgent"
              class="rounded text-amber-600 cursor-pointer w-4 h-4" 
            />
            <label for="urgent-check-modal" class="font-bold text-amber-950 flex items-center gap-1.5 cursor-pointer">
              <Zap class="w-4 h-4 text-amber-500 fill-amber-500" />
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
              class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <!-- SECTION 4: FULL ITEMIZED SUMMARY ON DELIVERY PAGE -->
          <div class="pt-2 border-t border-slate-200 space-y-2.5">
            <div class="flex items-center justify-between">
              <h4 class="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 class="w-4 h-4 text-blue-600" />
                <span>Order Items Summary</span>
              </h4>
              <span class="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                {{ totalItemsCount }} items
              </span>
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2.5">
              <div class="space-y-2 divide-y divide-slate-200/70 text-xs">
                <div 
                  v-for="(c, idx) in cartItemsList" 
                  :key="c.id"
                  class="py-2 flex items-start justify-between gap-3"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-[10px] font-bold text-slate-400 font-mono">#{{ idx + 1 }}</span>
                      <span class="font-bold text-slate-900 text-xs sm:text-sm break-words leading-snug">
                        {{ c.isCustom ? c.customName : ((rawProducts || []).find(x => x.id === c.id)?.name || 'Product') }}
                      </span>
                      <span v-if="c.isCustom" class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Custom
                      </span>
                    </div>

                    <!-- Unique Alias in Step 2 Review -->
                    <div v-if="getProductAlias(c.isCustom ? c : (rawProducts || []).find(x => x.id === c.id))" class="mt-0.5">
                      <span class="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        <span class="text-slate-400 font-sans">Alias:</span>
                        <span>{{ getProductAlias(c.isCustom ? c : (rawProducts || []).find(x => x.id === c.id)) }}</span>
                      </span>
                    </div>

                    <div class="text-xs text-slate-600 font-mono mt-0.5">
                      {{ c.qty }} {{ c.isCustom ? c.customUnit : ((rawProducts || []).find(x => x.id === c.id)?.unit || 'Sheet') }} × ₹{{ c.customPrice.toLocaleString('en-IN') }} 
                      <span v-if="c.isTaxInclusive" class="text-blue-700 font-bold">(Tax Incl)</span>
                      <span v-else class="text-slate-400">+ {{ getItemTaxRate(c) }}% GST</span>
                    </div>
                  </div>
                  <div class="font-mono font-bold text-sm sm:text-base text-blue-950 text-right shrink-0">
                    ₹{{ (c.qty * c.customPrice).toLocaleString('en-IN') }}
                  </div>
                </div>
              </div>

              <!-- Subtotal Breakdown -->
              <div class="pt-2.5 border-t border-slate-200 space-y-1.5 text-xs sm:text-sm">
                <div class="flex justify-between text-slate-600">
                  <span>Taxable Amount</span>
                  <span class="font-mono font-medium text-slate-800">₹{{ cartTotals.taxableTotal.toLocaleString('en-IN') }}</span>
                </div>
                <div class="flex justify-between text-slate-600">
                  <span>GST</span>
                  <span class="font-mono font-medium text-slate-800">₹{{ cartTotals.gstTotal.toLocaleString('en-IN') }}</span>
                </div>
                <div class="flex justify-between text-sm sm:text-base font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Grand Total (Payable)</span>
                  <span class="font-mono text-base sm:text-lg text-blue-950 font-black">₹{{ cartTotals.grandTotal.toLocaleString('en-IN') }}</span>
                </div>
              </div>
            </div>
          </div>

          </div>

          <!-- Sticky Confirmation Footer -->
          <div class="p-3.5 sm:p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-slate-200 bg-slate-50/80 shrink-0 flex items-center gap-2.5">
            <button 
              type="button"
              @click="backToCartFromCheckout"
              class="py-3.5 px-4 rounded-2xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title="Return to Cart Review"
            >
              <ArrowLeft class="w-4 h-4 text-slate-500" />
              <span>Back to Cart</span>
            </button>
            <button 
              @click="confirmAndPlaceOrder" 
              :disabled="isSubmitting"
              class="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
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
