<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, X, Plus, Trash2, Zap, MapPin, UserCheck, ShieldAlert, Award, FileText, IndianRupee, Truck, Car, AlertCircle, Package, PackageSearch, Loader2, Clock, Crown, Check, Tag, Calculator, ChevronRight, Database, Pencil, ChevronDown, ChevronUp, LayoutList } from 'lucide-vue-next'
import { formatCurrency, formatDate } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import SearchCombobox from '~/components/ui/SearchCombobox.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()
const { showSaving, showSaved, hide } = useSnackbar()
const { paymentTermsOptions, sheetSizesOptions } = useMasters()
const { animateModalOpen, initContext } = useGsapAnimation()

const customerBannerRef = ref<HTMLElement | null>(null)
const itemsContainerRef = ref<HTMLElement | null>(null)
const deliveryFieldRef = ref<HTMLElement | null>(null)
const deliveryTextareaRef = ref<HTMLTextAreaElement | null>(null)

// UI Mode State: 'modern' (Combobox + collapsing logistics + item sheet) vs 'classic' (Traditional full inline rows)
// Defaults to 'classic'. If user switches to 'modern', preference is saved to localStorage.
const uiMode = ref<'modern' | 'classic'>('classic')

onMounted(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sm_order_form_layout')
    if (saved === 'classic' || saved === 'modern') {
      uiMode.value = saved
    }
  }
})

const setUiMode = (mode: 'modern' | 'classic') => {
  uiMode.value = mode
  if (typeof window !== 'undefined') {
    localStorage.setItem('sm_order_form_layout', mode)
  }
}

// Auto-Collapsing Logistics (Customer, Transport & Address) in Modern Mode
const isLogisticsCollapsed = ref(false)

const onChangeDeliveryAddressClick = () => {
  isLogisticsCollapsed.value = false
  nextTick(() => {
    setTimeout(() => {
      if (deliveryFieldRef.value) {
        deliveryFieldRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      if (deliveryTextareaRef.value) {
        deliveryTextareaRef.value.focus()
      }
    }, 100)
  })
}

// Custom Customer State (Not in Busy)
const isCustomCustomer = ref(false)
const customCustomer = ref({
  name: '',
  phone: '',
  city: ''
})

const toggleCustomCustomer = () => {
  isCustomCustomer.value = !isCustomCustomer.value
  if (isCustomCustomer.value) {
    form.value.customerId = ''
    form.value.deliveryAddressId = ''
    if (!form.value.paymentTerms) {
      form.value.paymentTerms = '30 Days'
    }
  } else {
    customCustomer.value = { name: '', phone: '', city: '' }
  }
}

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
    isCustom?: boolean
    customProductName?: string
    customSku?: string
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
  return (customers.value as any[] || []).map(c => {
    const hasDistinctCompany = c.company && c.company.trim().toLowerCase() !== c.name?.trim().toLowerCase()
    const label = hasDistinctCompany ? `${c.name} (${c.company.trim()})` : (c.name || c.company || '')
    return {
      label,
      value: c.id,
      subtitle: c.company && c.company !== c.name ? c.company : '',
      city: c.city ? c.city.trim() : '',
      phone: c.phone || '',
      badge: c.privilegeTier,
      badgeClass: getPrivilegeBadgeStyle(c.privilegeTier || 'BRONZE'),
      isBusySynced: c.isBusySynced
    }
  })
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
    label: p.name,
    sku: p.sku,
    value: p.id,
    stock: p.stock ?? 0,
    unit: p.unit || '',
    hsnCode: p.hsnCode || '',
    subtitle: p.category?.name || '',
    isBusySynced: p.isBusySynced
  }))
})

const isFirstOrderForCustomer = computed(() => {
  if (isCustomCustomer.value) return true
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

// ── Item Modal State (Mobile Bottom Sheet / Desktop Modal) ──────────────────
const isItemModalOpen = ref(false)
const editingItemIndex = ref<number | null>(null) // null = adding new item; number = editing index
const currentItem = ref({
  productId: '',
  productSku: '',
  isCustom: false,
  customProductName: '',
  customSku: '',
  quantity: 1,
  unitPrice: 0,
  taxRate: 18,
  isTaxInclusive: false,
  applyLastPrice: false,
  itemNotes: ''
})

const openAddItemModal = (isCustom = false) => {
  editingItemIndex.value = null
  currentItem.value = {
    productId: '',
    productSku: '',
    isCustom,
    customProductName: '',
    customSku: '',
    quantity: 1,
    unitPrice: 0,
    taxRate: 18,
    isTaxInclusive: false,
    applyLastPrice: false,
    itemNotes: ''
  }
  isItemModalOpen.value = true
}

const openEditItemModal = (index: number) => {
  if (index < 0 || index >= form.value.items.length) return
  editingItemIndex.value = index
  const src = form.value.items[index]
  currentItem.value = { ...src }
  if (form.value.customerId && src.productId && !src.isCustom) {
    if (historicalPricesMap.value[src.productId] === undefined) {
      fetchHistoricalPrice(form.value.customerId, src.productId)
    }
  }
  isItemModalOpen.value = true
}

const closeItemModal = () => {
  isItemModalOpen.value = false
  editingItemIndex.value = null
}

const addClassicItem = (isCustom = false) => {
  form.value.items.push({ 
    productId: '', 
    productSku: '',
    isCustom,
    customProductName: '',
    customSku: '',
    quantity: 1, 
    unitPrice: 0,
    taxRate: 18,
    isTaxInclusive: false,
    applyLastPrice: false,
    itemNotes: ''
  })

  nextTick(() => {
    const el = itemsContainerRef.value?.lastElementChild as HTMLElement | null
    if (el) {
      animateModalOpen(el, null, { duration: 0.25 })
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    }
  })
}

const addItem = (isCustom = false) => {
  if (uiMode.value === 'classic') {
    addClassicItem(isCustom)
  } else {
    openAddItemModal(isCustom)
  }
}

const onModalProductChange = () => {
  const item = currentItem.value
  if (item.isCustom) return
  item.applyLastPrice = false
  const p = (products.value as any[])?.find((prod: any) => prod.id === item.productId)
  if (p) {
    item.unitPrice = Number(p.price) || 0
    item.productSku = p.sku || ''
    const dbTaxRate = p.taxRate !== null && p.taxRate !== undefined && !isNaN(Number(p.taxRate))
      ? Number(p.taxRate)
      : 18
    item.taxRate = dbTaxRate

    if (form.value.customerId && item.productId) {
      fetchHistoricalPrice(form.value.customerId, item.productId)
    }
  }
}

const applyModalHistoricalPrice = (hp: any) => {
  if (!hp) return
  if (currentItem.value.isTaxInclusive) {
    currentItem.value.unitPrice = Number(hp.unitPrice)
  } else {
    currentItem.value.unitPrice = Number(hp.basePrice)
  }
  if (hp.taxRate !== undefined && hp.taxRate !== null) {
    currentItem.value.taxRate = Number(hp.taxRate)
  }
  currentItem.value.applyLastPrice = true
}

const onModalTaxInclusiveToggle = () => {
  const hp = historicalPricesMap.value[currentItem.value.productId]
  if (currentItem.value.applyLastPrice && hp) {
    if (currentItem.value.isTaxInclusive) {
      currentItem.value.unitPrice = Number(hp.unitPrice)
    } else {
      currentItem.value.unitPrice = Number(hp.basePrice)
    }
  }
}

const validateCurrentItem = (): boolean => {
  const item = currentItem.value
  if (item.isCustom) {
    if (!item.customProductName || !item.customProductName.trim()) {
      alert('Please enter a product name for the custom item')
      return false
    }
  } else {
    if (!item.productId) {
      alert('Please select a catalog product')
      return false
    }
  }
  if (!item.quantity || item.quantity <= 0) {
    alert('Quantity must be at least 1')
    return false
  }
  return true
}

const saveItemFromModal = (closeAfter = true) => {
  if (!validateCurrentItem()) return false

  const itemToSave = { ...currentItem.value }
  
  if (editingItemIndex.value !== null) {
    form.value.items[editingItemIndex.value] = itemToSave
    showSaved('Item updated successfully')
  } else {
    form.value.items.push(itemToSave)
    showSaved('Item added to order')
  }

  if (closeAfter) {
    isItemModalOpen.value = false
    editingItemIndex.value = null
  } else {
    // Reset for next item while keeping modal open
    editingItemIndex.value = null
    const wasCustom = currentItem.value.isCustom
    currentItem.value = {
      productId: '',
      productSku: '',
      isCustom: wasCustom,
      customProductName: '',
      customSku: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 18,
      isTaxInclusive: false,
      applyLastPrice: false,
      itemNotes: ''
    }
  }
  return true
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
  if (item.isCustom) return
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

// ── Price History Modal State ────────────────────────────────────────────────
const isPriceHistoryOpen = ref(false)
const priceHistoryTargetIndex = ref<number | null>(null)
const priceHistoryProductId = ref<string | null>(null)
const priceHistoryProductName = ref<string>('')
const priceHistoryProductSku = ref<string>('')

const openPriceHistoryModal = (item: any, idx: number | 'modal') => {
  if (item.isCustom || !item.productId) return
  priceHistoryTargetIndex.value = idx === 'modal' ? -1 : idx
  priceHistoryProductId.value = item.productId
  const p = (products.value as any[])?.find((prod: any) => prod.id === item.productId)
  priceHistoryProductName.value = p?.name || item.name || 'Product'
  priceHistoryProductSku.value = p?.sku || ''
  isPriceHistoryOpen.value = true
}

const onApplyPriceHistory = (data: { rate: number; isTaxInclusive?: boolean; voucherNo?: string }) => {
  if (priceHistoryTargetIndex.value === -1) {
    currentItem.value.unitPrice = data.rate
    if (data.isTaxInclusive !== undefined) {
      currentItem.value.isTaxInclusive = data.isTaxInclusive
    }
    currentItem.value.applyLastPrice = true
    showSaved(`Applied historical rate ₹${data.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  } else if (priceHistoryTargetIndex.value !== null && form.value.items[priceHistoryTargetIndex.value]) {
    const item = form.value.items[priceHistoryTargetIndex.value]
    item.unitPrice = data.rate
    if (data.isTaxInclusive !== undefined) {
      item.isTaxInclusive = data.isTaxInclusive
    }
    item.applyLastPrice = true
    showSaved(`Applied historical rate ₹${data.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
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

// ── Rate Calculator State (A × B × Rate per sq.ft) ──────────────────────────
const isRateCalcOpen = ref(false)
const calcItemIndex = ref<number | null>(null)
const calcLength = ref<number>(8)
const calcWidth = ref<number>(4)
const calcSqftRate = ref<number>(0)

const setCalcSize = (l: number, w: number) => {
  calcLength.value = l
  calcWidth.value = w
}

const calcSqftArea = computed(() => {
  const l = Number(calcLength.value || 0)
  const w = Number(calcWidth.value || 0)
  return Number((l * w).toFixed(3))
})

const calcTotalRate = computed(() => {
  const area = calcSqftArea.value
  const rate = Number(calcSqftRate.value || 0)
  return Number((area * rate).toFixed(2))
})

const openRateCalculator = (target: number | 'modal') => {
  const defaultSize = sheetSizesOptions.value.find(s => s.isDefault) || sheetSizesOptions.value[0]
  calcLength.value = defaultSize?.length || 8
  calcWidth.value = defaultSize?.width || 4
  const currentArea = calcLength.value * calcWidth.value

  if (target === 'modal') {
    calcItemIndex.value = -1
    if (currentItem.value && currentItem.value.unitPrice > 0) {
      calcSqftRate.value = currentArea > 0 ? Number((currentItem.value.unitPrice / currentArea).toFixed(2)) : 0
    } else {
      calcSqftRate.value = 0
    }
  } else {
    calcItemIndex.value = target
    const it = form.value.items[target]
    if (it && it.unitPrice > 0) {
      calcSqftRate.value = currentArea > 0 ? Number((it.unitPrice / currentArea).toFixed(2)) : 0
    } else {
      calcSqftRate.value = 0
    }
  }
  isRateCalcOpen.value = true
}

const applyCalculatedRate = () => {
  if (calcItemIndex.value === -1) {
    currentItem.value.unitPrice = calcTotalRate.value
    showSaved(`Applied rate ₹${calcTotalRate.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  } else if (calcItemIndex.value !== null && form.value.items[calcItemIndex.value]) {
    form.value.items[calcItemIndex.value].unitPrice = calcTotalRate.value
    showSaved(`Applied rate ₹${calcTotalRate.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
  }
  isRateCalcOpen.value = false
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
  if (isCustomCustomer.value) {
    if (!customCustomer.value.name.trim()) {
      alert('Please enter a custom customer / party name')
      return
    }
    // Neither phone number nor place/city is required; fallback delivery address gracefully
    if (!form.value.deliveryAddress?.trim()) {
      form.value.deliveryAddress = customCustomer.value.city?.trim() || 'Address to be verified'
    }
  } else {
    if (!form.value.customerId) {
      alert('Please select a customer')
      return
    }
  }

  if (!form.value.paymentTerms) {
    alert('Please select payment terms for this order')
    return
  }
  if (!form.value.items.length) {
    alert('Please add at least one product')
    return
  }

  for (let i = 0; i < form.value.items.length; i++) {
    const item = form.value.items[i]
    if (item.isCustom) {
      if (!item.customProductName || !item.customProductName.trim()) {
        alert(`Please enter a product name for custom item #${i + 1}`)
        return
      }
    } else {
      if (!item.productId) {
        alert(`Please select a catalog product for item #${i + 1}`)
        return
      }
    }
    if (!item.quantity || item.quantity <= 0) {
      alert(`Quantity for item #${i + 1} must be at least 1`)
      return
    }
  }

  showSaving()
  try {
    const payload = {
      ...form.value,
      isCustomCustomer: isCustomCustomer.value,
      customCustomer: isCustomCustomer.value ? customCustomer.value : undefined
    }

    const res = await $fetch<any>('/api/orders', {
      method: 'POST',
      body: payload
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
  const clean = name.replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = clean.split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-3.5 sm:space-y-6 md:space-y-8 pb-32 sm:pb-12">
    <!-- Mobile Top Header (100% Mockup Screen 1 Match) -->
    <div class="sm:hidden flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <NuxtLink to="/dashboard/orders" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0">
          <ArrowLeft class="w-4 h-4" />
        </NuxtLink>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h1 class="text-sm font-black text-slate-900 leading-tight">Create Order</h1>
            <span v-if="uiMode === 'classic'" class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 font-mono">#Draft</span>
          </div>
          <p class="text-[10px] text-slate-400 truncate">Customer, items & delivery</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <!-- UI Mode Toggle: Modern vs Classic -->
        <div class="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/90 text-[10px] font-bold select-none">
          <button
            type="button"
            @click="setUiMode('modern')"
            class="px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
            :class="uiMode === 'modern' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            title="Modern View (Comboboxes + Item sheet)"
          >
            <Zap class="w-3 h-3" :class="uiMode === 'modern' ? 'text-amber-300 fill-amber-300' : 'text-slate-400'" />
            <span>Modern</span>
          </button>
          <button
            type="button"
            @click="setUiMode('classic')"
            class="px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
            :class="uiMode === 'classic' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            title="Classic View (Traditional inline rows)"
          >
            <LayoutList class="w-3 h-3" :class="uiMode === 'classic' ? 'text-white' : 'text-slate-400'" />
            <span>Classic</span>
          </button>
        </div>

        <label class="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border cursor-pointer select-none transition-all shadow-2xs shrink-0"
          :class="form.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'"
        >
          <input type="checkbox" v-model="form.isUrgent" class="sr-only" />
          <Zap class="w-3 h-3" :class="form.isUrgent ? 'text-rose-600 fill-rose-600' : 'text-slate-400'" />
          <span>Urgent</span>
        </label>
      </div>
    </div>

    <!-- Desktop Header -->
    <div class="hidden sm:flex sm:items-center justify-between gap-4 mb-6 sm:mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <span>Create New Order</span>
          <span v-if="uiMode === 'classic'" class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#1b3b5f]/10 text-[#1b3b5f]">Draft</span>
        </h1>
        <p class="text-xs text-gray-500 mt-1">Capture customer requirements, choose delivery destinations, and specify rates.</p>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- UI Mode Toggle: Modern vs Classic -->
        <div class="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs select-none">
          <button
            type="button"
            @click="setUiMode('modern')"
            class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            :class="uiMode === 'modern' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            title="Modern View (Comboboxes + Item sheet)"
          >
            <Zap class="w-3.5 h-3.5" :class="uiMode === 'modern' ? 'text-amber-300 fill-amber-300' : 'text-slate-400'" />
            <span>Modern UI</span>
          </button>
          <button
            type="button"
            @click="setUiMode('classic')"
            class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            :class="uiMode === 'classic' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            title="Classic View (Traditional inline rows)"
          >
            <LayoutList class="w-3.5 h-3.5" :class="uiMode === 'classic' ? 'text-white' : 'text-slate-400'" />
            <span>Classic UI</span>
          </button>
        </div>

        <!-- Urgent Order Toggle Header -->
        <label class="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border cursor-pointer select-none transition-all shadow-xs self-start sm:self-auto shrink-0"
          :class="form.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
        >
          <input type="checkbox" v-model="form.isUrgent" class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" />
          <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
            <Zap class="w-4 h-4 text-rose-600" />
            <span>Urgent Order</span>
          </div>
        </label>
      </div>
    </div>

    <form @submit.prevent="submitOrder" class="space-y-3.5 sm:space-y-6">
      
      <!-- ── Section 1: Customer Profile & Order Info ────────────────────── -->
      
      <!-- Mode A: Collapsed Customer & Logistics Summary Card (Only in Modern mode) -->
      <div 
        v-if="uiMode === 'modern' && isLogisticsCollapsed && (selectedCustomer || (isCustomCustomer && customCustomer.name.trim()))"
        @click="isLogisticsCollapsed = false"
        class="bg-gradient-to-r from-slate-50 via-white to-blue-50/30 rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-[#1b3b5f]/30 transition-all select-none cursor-pointer"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1b3b5f] text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-xs shrink-0 tracking-wider">
              {{ isCustomCustomer ? getCustomerInitials(customCustomer.name) : getCustomerInitials(selectedCustomer.name) }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h3 class="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {{ isCustomCustomer ? customCustomer.name : selectedCustomer.name }}
                </h3>
                <span 
                  v-if="!isCustomCustomer"
                  class="px-1.5 py-0.2 rounded font-extrabold text-[9px] uppercase tracking-wider border shadow-2xs"
                  :class="getPrivilegeBadgeStyle(selectedCustomer.privilegeTier || 'BRONZE')"
                >
                  {{ selectedCustomer.privilegeTier || 'BRONZE' }}
                </span>
                <span 
                  v-else 
                  class="px-1.5 py-0.2 rounded font-extrabold text-[9px] uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                >
                  Not in Busy
                </span>
                <span v-if="!isCustomCustomer && selectedCustomer.isPriorityClient" class="px-1.5 py-0.2 rounded font-extrabold text-[9px] uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                  Priority
                </span>
              </div>
              <p class="text-[10px] sm:text-xs text-slate-500 truncate mt-0.5">
                <span v-if="!isCustomCustomer && selectedCustomer.city">{{ selectedCustomer.city }}</span>
                <span v-else-if="isCustomCustomer && customCustomer.city">{{ customCustomer.city }}</span>
                <span v-if="(!isCustomCustomer && selectedCustomer.city) || (isCustomCustomer && customCustomer.city)"> • </span>
                <span class="font-medium text-slate-700">
                  {{ form.vehicleMode === 'OUR_FLEET' ? 'Fleet Delivery' : (form.vehicleMode === 'PARTY_VEHICLE' ? 'Party Vehicle' : 'Third Party') }}
                </span>
                <span> • </span>
                <span>{{ form.paymentTerms || '30 Days Credit' }}</span>
              </p>
            </div>
          </div>

          <button 
            type="button" 
            @click="isLogisticsCollapsed = false" 
            class="text-[10px] sm:text-[11px] font-bold text-[#1b3b5f] bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>Edit</span>
            <ChevronDown class="w-3.5 h-3.5 text-[#1b3b5f]" />
          </button>
        </div>
      </div>

      <!-- Mode B: Expanded Customer & Logistics Form (When not collapsed or no customer picked yet) -->
      <div 
        v-else 
        class="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in duration-150"
      >
        <div class="border-b border-gray-100 pb-2 mb-4 flex items-center justify-between">
          <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Customer & Delivery Details
          </h3>
          <button 
            v-if="uiMode === 'modern' && (selectedCustomer || (isCustomCustomer && customCustomer.name.trim()))"
            type="button" 
            @click="isLogisticsCollapsed = true" 
            class="text-xs font-bold text-[#1b3b5f] bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Done</span>
            <ChevronUp class="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <!-- Customer Picker / Custom Customer Entry -->
          <div class="md:col-span-2">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap shrink-0">Customer *</label>
              <button 
                type="button"
                @click="toggleCustomCustomer"
                class="text-xs font-bold text-[#1b3b5f] hover:text-[#132c49] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <component :is="isCustomCustomer ? Database : Plus" class="w-3.5 h-3.5 text-[#1b3b5f]" />
                <span>{{ isCustomCustomer ? 'Choose from Database' : 'Custom Customer (Not in Busy)' }}</span>
              </button>
            </div>

            <!-- Mode A: Database Customer Picker -->
            <div v-if="!isCustomCustomer">
              <SearchCombobox 
                :modelValue="form.customerId"
                @update:modelValue="val => { form.customerId = val; onCustomerChange() }"
                @select="onCustomerChange"
                :options="customerOptions"
                placeholder="Search customers by name, company, city, phone..."
                class="w-full"
              />

              <!-- Selected Customer Info Banner (Enhanced & Mobile-Optimized) -->
              <div v-if="selectedCustomer" ref="customerBannerRef" class="mt-3.5 bg-gradient-to-r from-slate-50 via-white to-sky-50/20 rounded-2xl border border-gray-200 shadow-2xs transition-all overflow-hidden">
                <!-- Mobile Compact Card -->
                <div class="sm:hidden p-3">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-[#1b3b5f] text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0 tracking-wider">
                      {{ getCustomerInitials(selectedCustomer.name) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <h4 class="text-xs font-black text-gray-900 truncate">
                          {{ selectedCustomer.name }}
                        </h4>
                        <span 
                          class="px-1.5 py-0.2 rounded font-extrabold text-[9px] uppercase tracking-wider border shadow-2xs"
                          :class="getPrivilegeBadgeStyle(selectedCustomer.privilegeTier || 'BRONZE')"
                        >
                          {{ selectedCustomer.privilegeTier || 'BRONZE' }}
                        </span>
                        <span v-if="selectedCustomer.isPriorityClient" class="px-1.5 py-0.2 rounded font-extrabold text-[9px] uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                          Priority
                        </span>
                      </div>
                      <p class="text-[10px] text-gray-500 truncate mt-0.5">
                        <span v-if="selectedCustomer.city">{{ selectedCustomer.city }}</span>
                        <span v-if="selectedCustomer.city && selectedCustomer.phone"> • </span>
                        <span v-if="selectedCustomer.phone" class="font-mono">{{ selectedCustomer.phone }}</span>
                        <span v-if="selectedCustomer.company && selectedCustomer.company !== selectedCustomer.name"> • {{ selectedCustomer.company }}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Desktop Full Banner -->
                <div class="hidden sm:block p-4 sm:p-5">
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
                            <MapPin class="w-3 h-3 text-gray-400 shrink-0" />
                            {{ selectedCustomer.city }}
                          </span>
                          <span v-if="selectedCustomer.phone" class="text-gray-500 font-mono">{{ selectedCustomer.phone }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Bottom Meta Row: Account Manager -->
                  <div v-if="selectedCustomer.customerManager" class="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-1.5 text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs text-[11px]">
                      <UserCheck class="w-3.5 h-3.5 text-[#1b3b5f]" />
                      <span>Account Manager: <strong class="text-gray-900 font-bold">{{ selectedCustomer.customerManager.name }}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mode B: Custom Customer Input (Not in Busy) -->
            <div v-else class="p-4 sm:p-5 bg-amber-50/60 border border-amber-200/90 rounded-2xl space-y-3.5 shadow-2xs">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                  <AlertCircle class="w-3.5 h-3.5 text-amber-700" />
                  <span>Custom Customer &bull; Not in Busy</span>
                </span>
                <button 
                  type="button" 
                  @click="toggleCustomCustomer" 
                  class="text-xs font-bold text-gray-500 hover:text-gray-800 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Customer / Party Name *</label>
                <input 
                  type="text" 
                  v-model="customCustomer.name" 
                  required
                  placeholder="e.g. Royal Interiors / Rajesh Patel" 
                  class="w-full border border-amber-300 rounded-lg p-2.5 bg-white text-sm font-bold text-gray-900 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Phone Number</span>
                    <span class="text-gray-400 font-normal text-[11px]">(Optional)</span>
                  </label>
                  <input 
                    type="tel" 
                    v-model="customCustomer.phone" 
                    placeholder="e.g. 9876543210" 
                    class="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm font-medium text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Place / City</span>
                    <span class="text-gray-400 font-normal text-[11px]">(Optional)</span>
                  </label>
                  <input 
                    type="text" 
                    v-model="customCustomer.city" 
                    placeholder="e.g. Mysuru / Bengaluru" 
                    class="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm font-medium text-gray-900 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  />
                </div>
              </div>

              <p class="text-[11px] text-amber-800 leading-relaxed font-medium">
                💡 Creates a provisional customer record tagged with <strong>Not in Busy</strong>. The order can be processed and tracked immediately; billing staff will link it to an official Busy customer ledger before generating the invoice.
              </p>
            </div>
          </div>
          
          <!-- Placed By (Hidden on mobile to save vertical space) -->
          <div class="hidden md:block">
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

            <!-- Mobile Segmented Selector (Ultra-clean, saves 250px) -->
            <div class="md:hidden grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs select-none">
              <button
                type="button"
                @click="form.vehicleMode = 'OUR_FLEET'"
                class="py-2.5 px-1 rounded-lg font-bold text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                :class="form.vehicleMode === 'OUR_FLEET'
                  ? 'bg-[#1b3b5f] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
              >
                <Truck class="w-4 h-4" />
                <span class="text-[10px] leading-tight">Our Fleet</span>
              </button>
              <button
                type="button"
                @click="form.vehicleMode = 'PARTY_VEHICLE'"
                class="py-2.5 px-1 rounded-lg font-bold text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                :class="form.vehicleMode === 'PARTY_VEHICLE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
              >
                <Car class="w-4 h-4" />
                <span class="text-[10px] leading-tight">Party Vehicle</span>
              </button>
              <button
                type="button"
                @click="form.vehicleMode = 'THIRD_PARTY'"
                class="py-2.5 px-1 rounded-lg font-bold text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                :class="form.vehicleMode === 'THIRD_PARTY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
              >
                <Package class="w-4 h-4" />
                <span class="text-[10px] leading-tight">Third Party</span>
              </button>
            </div>

            <!-- Desktop 3-Card Grid -->
            <div class="hidden md:grid md:grid-cols-3 gap-3">
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
          <div class="md:col-span-2" ref="deliveryFieldRef">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <span class="sm:hidden">{{ isCustomCustomer ? 'Delivery Address' : 'Delivery Address *' }}</span>
              <span class="hidden sm:inline">{{ isCustomCustomer ? 'Delivery Address (Site / Destination - Optional)' : 'Delivery Address (Site / Destination) *' }}</span>
            </label>
            <textarea ref="deliveryTextareaRef" v-model="form.deliveryAddress" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none" :required="!isCustomCustomer" placeholder="Delivery address, site or landmark..."></textarea>
          </div>

          <!-- Internal Order Notes -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <span class="sm:hidden">Internal Dispatch Notes</span>
              <span class="hidden sm:inline">Internal Order Instructions / Dispatch Notes</span>
            </label>
            <textarea v-model="form.notes" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none" placeholder="e.g. Call before arrival, gate timing, site contact..."></textarea>
          </div>

          <!-- Done Button below Internal Dispatch Notes to close/collapse Customer Details (Only in Modern Mode) -->
          <div v-if="uiMode === 'modern' && (selectedCustomer || (isCustomCustomer && customCustomer.name.trim()))" class="md:col-span-2 pt-2 flex justify-end">
            <button 
              type="button" 
              @click="isLogisticsCollapsed = true" 
              class="w-full sm:w-auto py-2.5 px-6 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Check class="w-4 h-4 text-white" />
              <span>Done</span>
              <ChevronUp class="w-3.5 h-3.5 text-white/80" />
            </button>
          </div>
        </div>
      </div>

      <!-- Section 2: Items -->
      <div class="bg-white p-3.5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3.5">
        <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-2 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <h3 class="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              Order Items <span v-if="form.items.length">({{ form.items.length }})</span>
            </h3>
            <span v-if="uiMode === 'modern'" class="text-[10px] text-slate-400 font-medium hidden sm:inline">• Tap item to edit</span>
          </div>
          <span v-if="uiMode === 'modern'" class="text-[10px] font-medium text-slate-400">Tap item to edit</span>
          <div v-else class="flex items-center gap-2">
            <button type="button" @click="addItem(false)" class="text-xs font-bold text-[#1b3b5f] flex items-center gap-1 hover:underline cursor-pointer">
              <Plus class="w-3.5 h-3.5" /> Add Product
            </button>
            <button type="button" @click="addItem(true)" class="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs">
              <Plus class="w-3.5 h-3.5 text-amber-700" /> Custom Item (Not in Busy)
            </button>
          </div>
        </div>

        <!-- Mode A: Modern Item Summary Cards -->
        <template v-if="uiMode === 'modern'">
          <div ref="itemsContainerRef" class="space-y-2.5">
            <!-- Items Summary Cards List (100% Mockup Match) -->
            <div 
              v-for="(item, idx) in form.items" 
              :key="idx" 
              @click="openEditItemModal(idx)"
              class="group bg-white hover:bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 hover:border-[#1b3b5f]/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative select-none"
            >
              <!-- Line 1: Item # + Name + Badges + Trash button -->
              <div class="flex items-start justify-between gap-2 mb-1.5">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                      #{{ idx + 1 }}
                    </span>
                    <h4 class="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                      {{ item.isCustom ? item.customProductName : (getSelectedProduct(item.productId)?.name || 'Product #' + (idx + 1)) }}
                    </h4>
                    <span v-if="!item.isCustom && getSelectedProduct(item.productId)?.sku && getSelectedProduct(item.productId)?.sku !== getSelectedProduct(item.productId)?.name" class="text-[10px] font-mono text-gray-400">
                      ({{ getSelectedProduct(item.productId)?.sku }})
                    </span>
                  </div>

                  <!-- Badges Row -->
                  <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <!-- Live Stock badge for catalog item -->
                    <span 
                      v-if="!item.isCustom && getSelectedProduct(item.productId)"
                      class="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md border"
                      :class="[
                        Number(getSelectedProduct(item.productId)?.stock ?? 0) <= 0 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : Number(getSelectedProduct(item.productId)?.stock ?? 0) < 10 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      ]"
                    >
                      <span 
                        class="w-1.5 h-1.5 rounded-full"
                        :class="[
                          Number(getSelectedProduct(item.productId)?.stock ?? 0) <= 0 
                            ? 'bg-rose-500' 
                            : Number(getSelectedProduct(item.productId)?.stock ?? 0) < 10 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                        ]"
                      ></span>
                      <span>In Stock ({{ getSelectedProduct(item.productId)?.stock ?? 0 }})</span>
                    </span>

                    <!-- Not in Busy badge -->
                    <span 
                      v-if="item.isCustom || getSelectedProduct(item.productId)?.isBusySynced === false"
                      class="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs"
                    >
                      <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                      Not in Busy
                    </span>

                    <!-- UoM badge -->
                    <span v-if="!item.isCustom && getSelectedProduct(item.productId)?.unit" class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                      {{ getSelectedProduct(item.productId)?.unit }}
                    </span>

                    <!-- Category -->
                    <span v-if="!item.isCustom && getSelectedProduct(item.productId)?.category?.name" class="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      {{ getSelectedProduct(item.productId)?.category?.name }}
                    </span>
                  </div>
                </div>

                <!-- Trash button (stops propagation so modal doesn't open) -->
                <button 
                  type="button" 
                  @click.stop="removeItem(idx)" 
                  class="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  title="Remove Item"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>

              <!-- Line 2: Pricing Math & Line Total (100% Mockup Match) -->
              <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div class="text-slate-600 text-[11px] font-semibold flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-slate-900">{{ item.quantity }} {{ !item.isCustom && getSelectedProduct(item.productId)?.unit ? getSelectedProduct(item.productId)?.unit : 'units' }}</span>
                  <span>×</span>
                  <span class="font-bold text-slate-900">{{ formatCurrency(item.unitPrice) }}</span>
                  <span v-if="item.isTaxInclusive" class="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                    INCL
                  </span>
                  <span v-else class="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                    +{{ item.taxRate }}% Tax
                  </span>
                </div>

                <div class="text-right">
                  <div class="font-black text-slate-900 text-xs sm:text-sm">
                    {{ formatCurrency(calculateItemTotals(item).total) }}
                  </div>
                  <div class="text-[9px] text-slate-400">
                    {{ item.isTaxInclusive ? 'GST incl.' : `+${formatCurrency(calculateItemTotals(item).taxAmount)} GST` }}
                  </div>
                </div>
              </div>

              <!-- Line 3: Item Note (if any) -->
              <div v-if="item.itemNotes?.trim()" class="mt-2 pt-1.5 border-t border-dashed border-gray-100 text-[11px] text-gray-500 flex items-center gap-1.5">
                <span class="font-bold text-gray-600 shrink-0">Note:</span>
                <span class="truncate italic text-gray-700">{{ item.itemNotes }}</span>
              </div>
            </div>

            <!-- Empty State Box -->
            <div 
              v-if="!form.items.length" 
              class="my-3 px-4 py-8 sm:py-10 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center transition-all"
            >
              <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-slate-400 mb-3">
                <PackageSearch class="w-6 h-6 text-[#1b3b5f]/70" />
              </div>
              <p class="text-sm font-bold text-gray-800">No products added yet</p>
              <p class="text-xs text-gray-500 mt-1 max-w-xs">
                Tap below to search catalog or add custom items to your order.
              </p>
              <div class="mt-4 flex items-center gap-2.5 flex-wrap justify-center">
                <button
                  type="button"
                  @click="openAddItemModal(false)"
                  class="px-4 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
                <button
                  type="button"
                  @click="openAddItemModal(true)"
                  class="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                >
                  <Plus class="w-3.5 h-3.5 text-amber-700" />
                  <span>Add Custom Item (Not in Busy)</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Add Item Buttons directly below items in Modern Mode -->
          <div v-if="form.items.length > 0" class="pt-2 flex items-center gap-2">
            <button
              type="button"
              @click="openAddItemModal(false)"
              class="flex-1 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
            <button
              type="button"
              @click="openAddItemModal(true)"
              class="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Plus class="w-3.5 h-3.5 text-amber-700" />
              <span>Add Custom Item (Not in Busy)</span>
            </button>
          </div>
        </template>

        <!-- Mode B: Classic Inline Items Layout (Traditional full inline rows) -->
        <template v-else>
          <div ref="itemsContainerRef" class="space-y-4">
            <div 
              v-for="(item, idx) in form.items" 
              :key="idx" 
              class="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200 space-y-3"
            >
              <!-- Row Header: Index tag + Remove action -->
              <div class="flex items-center justify-between pb-1.5 border-b border-gray-200/60">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold font-mono text-gray-600 bg-gray-200/70 px-2 py-0.5 rounded">
                    #{{ idx + 1 }} Item
                  </span>
                  <span 
                    v-if="item.isCustom || getSelectedProduct(item.productId)?.isBusySynced === false"
                    class="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs"
                  >
                    <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                    Not in Busy
                  </span>
                </div>
                <button 
                  type="button" 
                  @click="removeItem(idx)" 
                  class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  title="Remove Item"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>

              <div class="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                <!-- Product Select / Custom Item Entry -->
                <div v-if="item.isCustom" class="flex-1 w-full min-w-0 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <label class="block text-[10px] uppercase font-bold text-amber-800">Custom Item Name *</label>
                      <span class="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300 shadow-2xs">
                        <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                        Not in Busy
                      </span>
                    </div>
                    <button 
                      type="button" 
                      @click="item.isCustom = false; item.productId = ''" 
                      class="text-[10px] font-bold text-[#1b3b5f] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Database class="w-3 h-3" />
                      <span>Choose from Catalog</span>
                    </button>
                  </div>
                  <input 
                    type="text" 
                    v-model="item.customProductName" 
                    required
                    placeholder="e.g. Custom Profile Handle 200mm / Labour Charges" 
                    class="w-full border border-amber-300 rounded-lg p-2.5 bg-amber-50/30 text-sm font-semibold text-gray-900 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
                  />
                  <div class="flex items-center gap-2 text-[11px] text-gray-500">
                    <span>SKU / Code:</span>
                    <input 
                      type="text" 
                      v-model="item.customSku" 
                      placeholder="Auto-generated if empty" 
                      class="font-mono text-xs border border-gray-200 rounded px-2 py-0.5 w-48 bg-white text-gray-800"
                    />
                  </div>
                </div>

                <!-- Catalog Product Select with Direct SearchCombobox -->
                <div v-else class="flex-1 w-full min-w-0">
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="block text-[10px] uppercase font-bold text-gray-500">Product *</label>
                    <button 
                      type="button" 
                      @click="item.isCustom = true; item.productId = ''; item.customProductName = ''" 
                      class="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <Plus class="w-3 h-3" />
                      <span>Custom Item (Not in Busy)</span>
                    </button>
                  </div>
                  <SearchCombobox 
                    :modelValue="item.productId"
                    @update:modelValue="val => { item.productId = val; onProductChange(idx) }"
                    :options="productOptions"
                    placeholder="Search product by SKU, name, brand..."
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

                    <span 
                      v-if="getSelectedProduct(item.productId)?.isBusySynced === false"
                      class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 shadow-2xs"
                    >
                      <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                      Not in Busy
                    </span>

                    <span v-if="getSelectedProduct(item.productId)?.category?.name" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      {{ getSelectedProduct(item.productId)?.category?.name }}
                    </span>

                    <span v-if="getSelectedProduct(item.productId)?.unit" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                      {{ getSelectedProduct(item.productId)?.unit }}
                    </span>
                  </div>
                </div>

                <!-- Numerical Fields: Mobile has 2 columns (Qty & Rate in line 1, Tax & Total in line 2) -->
                <div class="grid grid-cols-2 md:flex md:items-start gap-3 w-full md:w-auto">
                  <!-- Qty Stepper -->
                <div class="w-full md:w-28 shrink-0">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Quantity *</label>
                  <div class="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                    <button 
                      type="button" 
                      @click="item.quantity = Math.max(1, (item.quantity || 1) - 1)" 
                      class="w-8 h-9 bg-gray-50 hover:bg-gray-100 font-bold text-gray-700 flex items-center justify-center text-sm active:bg-gray-200 select-none cursor-pointer"
                    >-</button>
                    <input 
                      type="number" 
                      v-model.number="item.quantity" 
                      min="1" 
                      required 
                      class="w-full text-center font-bold text-gray-900 text-sm focus:outline-none p-1" 
                    />
                    <button 
                      type="button" 
                      @click="item.quantity = (item.quantity || 0) + 1" 
                      class="w-8 h-9 bg-gray-50 hover:bg-gray-100 font-bold text-gray-700 flex items-center justify-center text-sm active:bg-gray-200 select-none cursor-pointer"
                    >+</button>
                  </div>
                </div>

                <!-- Unit Price with Sq.ft Sheet Rate Calculator -->
                <div class="w-full md:w-36 shrink-0">
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 truncate">
                      <IndianRupee class="w-3 h-3 text-gray-400 shrink-0" />
                      <span>Rate *</span>
                    </label>
                    <button 
                      type="button" 
                      tabindex="-1"
                      @click="openRateCalculator(idx)" 
                      class="text-[9px] bg-[#1b3b5f] hover:bg-[#132c49] text-white font-bold flex items-center gap-1 px-2 py-0.5 rounded shadow-2xs transition-colors cursor-pointer"
                      title="Calculate rate by Sheet Sq.ft (A × B × Rate)"
                    >
                      <Calculator class="w-2.5 h-2.5 text-white" />
                      <span>Sq.ft Calc</span>
                    </button>
                  </div>
                  <div class="relative flex items-center">
                    <IndianRupee class="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input 
                      type="number" 
                      v-model.number="item.unitPrice" 
                      min="0" 
                      step="0.01" 
                      required 
                      class="w-full pl-6 pr-8 border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
                    />
                    <button 
                      type="button"
                      tabindex="-1"
                      @click="openRateCalculator(idx)"
                      class="absolute right-1 px-1.5 py-1 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-md transition-colors cursor-pointer shadow-2xs"
                      title="Sq.ft Sheet Rate Calculator"
                    >
                      <Calculator class="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>

                <!-- Tax % -->
                <div class="w-full md:w-20 shrink-0">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Tax %</label>
                  <div class="relative flex items-center">
                    <input type="number" v-model.number="item.taxRate" min="0" max="100" step="0.1" class="w-full pr-5 border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f] text-right" />
                    <span class="absolute right-1.5 text-xs font-semibold text-gray-400 pointer-events-none">%</span>
                  </div>
                </div>

                <!-- Line Total -->
                <div class="w-full md:w-28 shrink-0">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center justify-between">
                    <span>Total</span>
                    <span v-if="item.isTaxInclusive" class="text-[8px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">INCL</span>
                    <span v-else class="text-[8px] font-bold text-gray-600 bg-gray-100 px-1 py-0.2 rounded border border-gray-200">+TAX</span>
                  </label>
                  <div class="p-2 bg-white text-gray-900 rounded-lg font-bold text-sm border border-gray-200 text-right">
                    {{ formatCurrency(calculateItemTotals(item).total) }}
                  </div>
                </div>
                </div>
              </div>

              <!-- Item-Level Options & Notes -->
              <div class="flex flex-wrap items-center gap-3 sm:gap-4 pt-2.5 border-t border-gray-200/60 text-xs">
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
                  <span v-else class="text-[10px] text-gray-500">(+{{ item.taxRate }}% Tax)</span>
                </label>

                <!-- Last Billed Price Pill -->
                <div v-if="form.customerId && item.productId && !item.isCustom" class="flex items-center">
                  <div 
                    v-if="historicalPricesMap[item.productId]" 
                    @click="openPriceHistoryModal(item, idx)"
                    class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition border cursor-pointer hover:shadow-xs select-none"
                    :class="item.applyLastPrice 
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs ring-1 ring-emerald-400/30' 
                      : 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100/80'"
                    title="Click to view complete price history for Current Party & All Parties"
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

                    <span class="text-[10px] text-sky-700 font-bold hover:underline flex items-center gap-0.5 ml-0.5">
                      <span>History</span>
                      <ChevronRight class="w-3 h-3 text-sky-700" />
                    </span>

                    <button
                      type="button"
                      @click.stop="applyHistoricalPrice(item, historicalPricesMap[item.productId])"
                      class="ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition cursor-pointer select-none"
                      :class="item.applyLastPrice 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-amber-200 text-amber-900 hover:bg-amber-300'"
                    >
                      {{ item.applyLastPrice ? '✓ Applied' : 'Apply' }}
                    </button>
                  </div>

                  <div v-else-if="loadingPrices[item.productId]" class="text-[11px] text-gray-400 flex items-center gap-1.5 italic">
                    <Loader2 class="w-3 h-3 animate-spin text-gray-400" />
                    <span>Checking price history...</span>
                  </div>

                  <div v-else-if="historicalPricesMap[item.productId] === null" class="text-[11px] text-gray-400 italic">
                    First time ordering this item
                  </div>
                </div>

                <!-- Item Notes Input -->
                <div class="flex-1 min-w-[200px]">
                  <input 
                    type="text" 
                    v-model="item.itemNotes" 
                    placeholder="Optional item note: e.g. 10% rate agreed, custom edge-banding..."
                    class="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-[#1b3b5f]"
                  />
                </div>
              </div>
            </div>

            <div v-if="!form.items.length" class="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              No products added yet. Click "+ Add Product" or "+ Custom Item" above to add items to this order.
            </div>
          </div>

          <!-- Add Item Buttons directly below items in Classic Mode -->
          <div class="pt-2 flex items-center gap-2">
            <button
              type="button"
              @click="addItem(false)"
              class="py-2.5 px-4 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
            <button
              type="button"
              @click="addItem(true)"
              class="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Plus class="w-3.5 h-3.5 text-amber-700" />
              <span>Add Custom Item (Not in Busy)</span>
            </button>
          </div>
        </template>

        <!-- Order Totals & Tax Summary -->
        <div 
          class="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-5 border-t border-gray-200 mt-6 gap-4"
          :class="uiMode === 'classic' ? 'flex' : 'hidden sm:flex'"
        >
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

      <!-- Actions: Visible on Desktop, and also on Mobile in Classic Mode -->
      <div 
        class="justify-end gap-3 pt-4"
        :class="uiMode === 'classic' ? 'flex flex-col sm:flex-row' : 'hidden sm:flex'"
      >
        <NuxtLink to="/dashboard/orders" class="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors text-center">
          Cancel
        </NuxtLink>
        <button type="submit" :disabled="!form.items.length" class="px-6 py-2.5 bg-[#1b3b5f] text-white text-sm font-bold rounded-lg hover:bg-[#1b3b5f]/90 disabled:opacity-50 transition-colors shadow-sm cursor-pointer text-center">
          Submit Order
        </button>
      </div>

    </form>

    <!-- ── Mobile Sticky Bottom Bar (Total & Submit - Only in Modern Mode) ── -->
    <div 
      v-if="uiMode === 'modern' && form.items.length > 0" 
      class="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg flex items-center justify-between z-[200] transition-all"
    >
      <div class="min-w-0 pr-2">
        <div class="text-[10px] font-semibold text-slate-400">
          Total ({{ form.items.length }} {{ form.items.length === 1 ? 'item' : 'items' }})
        </div>
        <div class="text-base font-black text-[#1b3b5f] leading-none">
          {{ formatCurrency(orderSummary.grandTotal) }}
        </div>
        <div class="text-[9px] text-slate-500 mt-0.5">
          Taxable {{ formatCurrency(orderSummary.subtotal) }} • GST {{ formatCurrency(orderSummary.totalTax) }}
        </div>
      </div>
      <button 
        type="button" 
        @click="submitOrder" 
        class="px-5 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
      >
        <span>Submit Order</span>
        <ChevronRight class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- ── Add / Edit Item Bottom Sheet Modal ────────────────────────────── -->
    <Teleport to="body">
      <div 
        v-if="isItemModalOpen" 
        data-modal-container 
        class="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        @click.self="closeItemModal"
      >
        <div 
          class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden animate-in slide-in-from-bottom duration-200 sm:zoom-in-95"
        >
          <!-- Mobile Grab Handle -->
          <div class="sm:hidden w-full pt-2.5 pb-1 flex justify-center shrink-0">
            <div class="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>

          <!-- Modal Header -->
          <div class="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center border border-[#1b3b5f]/20">
                <component :is="currentItem.isCustom ? Tag : Package" class="w-4 h-4 text-[#1b3b5f]" />
              </div>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                  {{ editingItemIndex !== null ? `Edit Item #${editingItemIndex + 1}` : (currentItem.isCustom ? 'Add Custom Item' : 'Add Product to Order') }}
                </h3>
                <p class="text-[11px] text-gray-500">
                  {{ currentItem.isCustom ? 'Non-catalog item not tracked in Busy' : 'Select product, quantity, and pricing' }}
                </p>
              </div>
            </div>
            <button 
              type="button" 
              @click="closeItemModal"
              aria-label="Close"
              class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer text-xs"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
            
            <!-- 1. Product Field / Custom Product -->
            <div v-if="currentItem.isCustom" class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <label class="block text-[10px] uppercase font-bold text-amber-800">Custom Item Name *</label>
                  <span class="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300 shadow-2xs">
                    <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                    Not in Busy
                  </span>
                </div>
                <button 
                  type="button" 
                  @click="currentItem.isCustom = false; currentItem.productId = ''" 
                  class="text-[10px] font-bold text-[#1b3b5f] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Database class="w-3 h-3" />
                  <span>Choose from Catalog</span>
                </button>
              </div>
              <input 
                type="text" 
                v-model="currentItem.customProductName" 
                required
                placeholder="e.g. Custom Profile Handle 200mm / Labour Charges" 
                class="w-full border border-amber-300 rounded-lg p-2.5 bg-amber-50/30 text-sm font-semibold text-gray-900 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
              />
              <div class="flex items-center gap-2 text-[11px] text-gray-500">
                <span>SKU / Code:</span>
                <input 
                  type="text" 
                  v-model="currentItem.customSku" 
                  placeholder="Auto-generated if empty" 
                  class="font-mono text-xs border border-gray-200 rounded px-2 py-0.5 w-48 bg-white text-gray-800"
                />
              </div>
            </div>

            <!-- Catalog Product Select -->
            <div v-else class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="block text-[10px] uppercase font-bold text-gray-500">Product *</label>
                <button 
                  type="button" 
                  @click="currentItem.isCustom = true; currentItem.productId = ''; currentItem.customProductName = ''" 
                  class="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 hover:underline cursor-pointer"
                >
                  <Plus class="w-3 h-3" />
                  <span>Custom Item (Not in Busy)</span>
                </button>
              </div>

              <SearchCombobox 
                :modelValue="currentItem.productId"
                @update:modelValue="val => { currentItem.productId = val; onModalProductChange() }"
                @select="onModalProductChange"
                :options="productOptions"
                placeholder="Search product by SKU, name, brand..."
                class="w-full"
              />

              <!-- Live Stock Badge right below the product name -->
              <div v-if="getSelectedProduct(currentItem.productId)" class="mt-2 flex flex-wrap items-center gap-2">
                <span 
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border shadow-2xs transition-colors"
                  :class="[
                    Number(getSelectedProduct(currentItem.productId)?.stock ?? 0) <= 0 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : Number(getSelectedProduct(currentItem.productId)?.stock ?? 0) < 10 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  ]"
                >
                  <span 
                    class="w-2 h-2 rounded-full"
                    :class="[
                      Number(getSelectedProduct(currentItem.productId)?.stock ?? 0) <= 0 
                        ? 'bg-rose-500' 
                        : Number(getSelectedProduct(currentItem.productId)?.stock ?? 0) < 10 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    ]"
                  ></span>
                  <span>
                    Stock: <strong class="font-bold">{{ getSelectedProduct(currentItem.productId)?.stock ?? 0 }}</strong> {{ getSelectedProduct(currentItem.productId)?.unit || 'units' }}
                  </span>
                  <span v-if="Number(getSelectedProduct(currentItem.productId)?.stock ?? 0) <= 0" class="text-[10px] font-bold text-rose-600 uppercase tracking-wide">
                    (Out of Stock)
                  </span>
                  <span v-else-if="Number(getSelectedProduct(currentItem.productId)?.stock ?? 0) < 10" class="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                    (Low Stock)
                  </span>
                </span>

                <span 
                  v-if="getSelectedProduct(currentItem.productId)?.isBusySynced === false"
                  class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 shadow-2xs"
                  title="Product not yet created in Busy. Operations & delivery are unaffected."
                >
                  <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                  Not in Busy
                </span>

                <span v-if="getSelectedProduct(currentItem.productId)?.category?.name" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  {{ getSelectedProduct(currentItem.productId)?.category?.name }}
                </span>

                <!-- UoM Badge -->
                <span v-if="getSelectedProduct(currentItem.productId)?.unit" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                  {{ getSelectedProduct(currentItem.productId)?.unit }}
                </span>
              </div>
            </div>

            <!-- 2. Quantity & Unit Price Grid -->
            <div class="grid grid-cols-2 gap-3">
              <!-- Quantity Stepper -->
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Quantity *</label>
                <div class="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button 
                    type="button" 
                    @click="currentItem.quantity = Math.max(1, (currentItem.quantity || 1) - 1)" 
                    class="w-9 h-9 bg-gray-50 hover:bg-gray-100 font-bold text-gray-700 flex items-center justify-center text-sm active:bg-gray-200 select-none cursor-pointer"
                  >-</button>
                  <input 
                    type="number" 
                    v-model.number="currentItem.quantity" 
                    min="1" 
                    required 
                    class="w-full text-center font-bold text-gray-900 text-sm focus:outline-none p-1.5" 
                  />
                  <button 
                    type="button" 
                    @click="currentItem.quantity = (currentItem.quantity || 0) + 1" 
                    class="w-9 h-9 bg-gray-50 hover:bg-gray-100 font-bold text-gray-700 flex items-center justify-center text-sm active:bg-gray-200 select-none cursor-pointer"
                  >+</button>
                </div>
              </div>

              <!-- Unit Price (Rate) -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 truncate">
                    <IndianRupee class="w-3 h-3 text-gray-400 shrink-0" />
                    <span>Rate *</span>
                  </label>
                  <button 
                    type="button" 
                    tabindex="-1"
                    @click="openRateCalculator('modal')" 
                    class="text-[9px] bg-[#1b3b5f] hover:bg-[#132c49] text-white font-bold flex items-center gap-1 px-2 py-0.5 rounded shadow-2xs transition-colors cursor-pointer"
                    title="Calculate rate by Sheet Sq.ft (A × B × Rate)"
                  >
                    <Calculator class="w-2.5 h-2.5 text-white" />
                    <span>Sq.ft Calc</span>
                  </button>
                </div>
                <div class="relative flex items-center">
                  <IndianRupee class="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input 
                    type="number" 
                    v-model.number="currentItem.unitPrice" 
                    min="0" 
                    step="0.01" 
                    required 
                    class="w-full pl-6 pr-8 border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
                  />
                  <button 
                    type="button"
                    tabindex="-1"
                    @click="openRateCalculator('modal')"
                    class="absolute right-1 px-1.5 py-1 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-md transition-colors cursor-pointer shadow-2xs"
                    title="Sq.ft Sheet Rate Calculator"
                  >
                    <Calculator class="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. Last Billed Price Interactive Pill -->
            <div v-if="form.customerId && currentItem.productId && !currentItem.isCustom" class="space-y-1">
              <!-- If Price History Exists -->
              <div 
                v-if="historicalPricesMap[currentItem.productId]" 
                @click="openPriceHistoryModal(currentItem, 'modal')"
                class="flex items-center justify-between p-2 rounded-lg text-xs transition border cursor-pointer hover:shadow-xs select-none"
                :class="currentItem.applyLastPrice 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs ring-1 ring-emerald-400/30' 
                  : 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100/80'"
              >
                <div class="flex items-center gap-1.5 min-w-0 truncate">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="currentItem.applyLastPrice ? 'bg-emerald-600' : 'bg-amber-500'"></span>
                  <span class="truncate">
                    Last Billed: 
                    <strong class="font-bold text-gray-900">
                      {{ formatCurrency(currentItem.isTaxInclusive ? historicalPricesMap[currentItem.productId].unitPrice : historicalPricesMap[currentItem.productId].basePrice) }}
                    </strong>
                    <span class="text-[10px] text-gray-500 ml-1">
                      ({{ currentItem.isTaxInclusive ? 'Incl. Tax' : '+Tax' }} • {{ historicalPricesMap[currentItem.productId].daysAgo }}d ago)
                    </span>
                  </span>
                  <span class="text-[10px] text-sky-700 font-bold hover:underline flex items-center gap-0.5 ml-1 shrink-0">
                    <span>History</span>
                    <ChevronRight class="w-3 h-3 text-sky-700" />
                  </span>
                </div>

                <button
                  type="button"
                  @click.stop="applyModalHistoricalPrice(historicalPricesMap[currentItem.productId])"
                  class="ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition cursor-pointer select-none shrink-0"
                  :class="currentItem.applyLastPrice 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'bg-amber-200 text-amber-900 hover:bg-amber-300'"
                >
                  {{ currentItem.applyLastPrice ? '✓ Applied' : 'Apply' }}
                </button>
              </div>

              <!-- If Loading -->
              <div v-else-if="loadingPrices[currentItem.productId]" class="text-[11px] text-gray-400 flex items-center gap-1.5 italic">
                <Loader2 class="w-3 h-3 animate-spin text-gray-400" />
                <span>Checking price history...</span>
              </div>

              <!-- If First Time Item -->
              <div v-else-if="historicalPricesMap[currentItem.productId] === null" class="text-[11px] text-gray-400 italic">
                First time ordering this item
              </div>
            </div>

            <!-- 4. Tax Inclusive Toggle & Tax Rate % Grid -->
            <div class="grid grid-cols-2 gap-3 pt-1 items-center">
              <div>
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    v-model="currentItem.isTaxInclusive" 
                    @change="onModalTaxInclusiveToggle"
                    class="w-4 h-4 rounded text-[#1b3b5f] focus:ring-[#1b3b5f]" 
                  />
                  <span class="text-xs font-bold text-gray-800">Tax Inclusive Rate</span>
                </label>
                <p class="text-[10px] text-gray-400 mt-0.5">
                  {{ currentItem.isTaxInclusive ? '(Rate includes GST)' : '(GST added to rate)' }}
                </p>
              </div>

              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tax Rate %</label>
                <div class="relative flex items-center">
                  <input 
                    type="number" 
                    v-model.number="currentItem.taxRate" 
                    min="0" 
                    max="100" 
                    step="0.1" 
                    placeholder="18"
                    class="w-full pr-6 border border-gray-300 rounded-lg shadow-xs p-1.5 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f] text-right" 
                  />
                  <span class="absolute right-2 text-xs font-semibold text-gray-400 pointer-events-none">%</span>
                </div>
              </div>
            </div>

            <!-- 5. Item Notes Input -->
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Item Note (Optional)</label>
              <input 
                type="text" 
                v-model="currentItem.itemNotes" 
                placeholder="Note (e.g. edge-banding, batch, cut size)..."
                class="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-[#1b3b5f]"
              />
            </div>

            <!-- 6. Computed Line Total Preview Box -->
            <div class="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
              <div>
                <span class="text-gray-500 font-semibold">Item Total</span>
                <div class="text-[10px] text-gray-400">
                  Taxable: {{ formatCurrency(calculateItemTotals(currentItem).taxable) }} • Tax: {{ formatCurrency(calculateItemTotals(currentItem).taxAmount) }}
                </div>
              </div>
              <span class="text-lg font-black text-[#1b3b5f]">
                {{ formatCurrency(calculateItemTotals(currentItem).total) }}
              </span>
            </div>

          </div>

          <!-- Modal Footer Actions -->
          <div class="p-3 sm:p-4 bg-gray-50/80 border-t border-gray-100 flex items-center gap-2 shrink-0">
            <button 
              type="button" 
              @click="saveItemFromModal(false)" 
              class="flex-1 py-2.5 px-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5 text-gray-600" />
              <span>Save & Add Another</span>
            </button>
            <button 
              type="button" 
              @click="saveItemFromModal(true)" 
              class="flex-1 py-2.5 px-4 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Check class="w-3.5 h-3.5 text-white" />
              <span>{{ editingItemIndex !== null ? 'Save Changes' : 'Done' }}</span>
            </button>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- ── Rate Calculator Modal (A × B × Rate per Sq.ft) ────────────────────── -->
    <Teleport to="body">
      <div v-if="isRateCalcOpen" data-modal-container class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[650] flex items-center justify-center p-3 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-5 border border-gray-100 space-y-3 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] overflow-y-auto">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center border border-[#1b3b5f]/20">
                <Calculator class="w-4 h-4 text-[#1b3b5f]" />
              </div>
              <div>
                <h4 class="text-sm sm:text-base font-bold text-gray-900">Sq.ft Sheet Rate Calculator</h4>
                <p class="text-[11px] text-gray-500">Calculate unit rate: Size (A × B) × Sq.ft Rate</p>
              </div>
            </div>
            <button 
              type="button" 
              @click="isRateCalcOpen = false" 
              data-modal-close="true"
              aria-label="Close"
              class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Quick Size Presets -->
          <div v-if="sheetSizesOptions.length > 0" class="space-y-1">
            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quick Sheet Sizes</label>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="qs in sheetSizesOptions"
                :key="qs.label"
                type="button"
                @click="setCalcSize(qs.length, qs.width)"
                class="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1"
                :class="calcLength === qs.length && calcWidth === qs.width
                  ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'"
              >
                <span>{{ qs.label }}</span>
                <span v-if="qs.isDefault" class="text-[9px] opacity-75">★</span>
              </button>
            </div>
          </div>

          <!-- Dimensions & Area (Inline Compact Group) -->
          <div class="p-2.5 sm:p-3 bg-slate-50/90 rounded-xl border border-gray-200/90 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Sheet Dimensions</span>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  type="number"
                  v-model.number="calcLength"
                  min="0.1"
                  step="0.1"
                  class="w-full pl-3 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 bg-white shadow-2xs focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  placeholder="Length"
                />
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">ft</span>
              </div>

              <span class="text-gray-400 font-bold text-xs shrink-0">×</span>

              <div class="relative flex-1">
                <input
                  type="number"
                  v-model.number="calcWidth"
                  min="0.1"
                  step="0.1"
                  class="w-full pl-3 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 bg-white shadow-2xs focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  placeholder="Width"
                />
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">ft</span>
              </div>
            </div>
          </div>

          <!-- Rate per Sqft Input (No autofocus on mobile) -->
          <div class="space-y-1">
            <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">Rate per Sq.ft (₹) *</label>
            <div class="relative flex items-center">
              <IndianRupee class="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="number"
                v-model.number="calcSqftRate"
                min="0"
                step="0.01"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-base font-black text-gray-900 focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] bg-white shadow-2xs"
                placeholder="e.g. 75.00"
                @keyup.enter="applyCalculatedRate"
              />
            </div>
          </div>

          <!-- Live Calculated Preview Box -->
          <div class="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl text-center space-y-0.5">
            <span class="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Calculated Total Sheet Rate</span>
            <div class="text-2xl font-mono font-black text-[#1b3b5f]">
              ₹{{ calcTotalRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
            <p class="text-[10px] text-emerald-700 font-medium">
              {{ calcSqftArea }} sq.ft × ₹{{ Number(calcSqftRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} / sq.ft
            </p>
          </div>

          <!-- Modal Action Buttons -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              @click="isRateCalcOpen = false"
              data-modal-close="true"
              class="px-3.5 py-1.5 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="applyCalculatedRate"
              :disabled="calcTotalRate <= 0"
              class="px-4 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Check class="w-3.5 h-3.5" />
              <span>Apply Rate (₹{{ calcTotalRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }})</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Price History Modal (Current Party & All Parties) ──────────── -->
    <PriceHistoryModal
      v-model="isPriceHistoryOpen"
      :product-id="priceHistoryProductId"
      :product-name="priceHistoryProductName"
      :product-sku="priceHistoryProductSku"
      :customer-id="form.customerId"
      :customer-name="selectedCustomer?.name"
      @apply-price="onApplyPriceHistory"
    />
  </div>
</template>
