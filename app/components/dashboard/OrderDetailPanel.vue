<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, MoreHorizontal, Lock, Edit, Package, PackageCheck, Truck, Check, Box, Plus, Trash2, MapPin, AlertCircle, AlertTriangle, Ban, CheckCheck, CheckCircle2, Zap, User, IndianRupee, Clock, Building2, Phone, FileText, Calendar, Copy, ChevronRight, Car, GitFork, SlidersHorizontal } from 'lucide-vue-next'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import GenerateBillModal from '~/components/dashboard/GenerateBillModal.vue'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import PartyVehicleHandoverModal from '~/components/dashboard/PartyVehicleHandoverModal.vue'
import AdminOrderStatusModal from '~/components/dashboard/AdminOrderStatusModal.vue'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { formatCurrency, formatDateTime, formatDate, formatTime, getDisplayStatus, getOverallColor, getStatusColor } from '~~/app/lib/utils'
import type { Order } from '~/types'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const isPinModalOpen = ref(false)
const isHandoverModalOpen = ref(false)
const isAdminStatusModalOpen = ref(false)

const openAdminStatusModal = () => {
  isAdminStatusModalOpen.value = true
}

const onAdminStatusUpdated = (updatedOrder: any) => {
  if (updatedOrder) {
    order.value = { ...order.value, ...updatedOrder }
  }
  emit('updated', updatedOrder)
}

const { showEditing, showSaving, showSaved, hide } = useSnackbar()
const { paymentTermsOptions } = useMasters()
const { notifyChange, onOrderSync } = useRealtimeSync()
const { animateStagger } = useGsapAnimation()
const itemsTbodyRef = ref<HTMLElement | null>(null)

const props = withDefaults(defineProps<{
  orderId: string | null
  isOpen: boolean
  context?: 'billing' | 'packing' | 'delivery' | 'overview' | 'approval' | 'orders'
}>(), {
  context: 'orders'
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', updatedOrder?: any): void
  (e: 'reviewApprove', order: Order): void
  (e: 'split-order', id: string): void
}>()

const { user, hasRole, canEditOrders, canCancelOrders, canEditOrderStatus } = useAuth()
const order = ref<Order | null>(null)
const isLoading = ref(false)
const activeTab = ref<'DETAILS' | 'TIMELINE' | 'NOTES'>('DETAILS')

const canCancelOrder = computed(() => {
  if (!order.value) return false
  if (order.value.overallStatus === 'CANCELLED' || order.value.overallStatus === 'DELIVERED') return false

  return canCancelOrders.value
})

const canGenerateBill = computed(() => {
  if (props.context !== 'billing') return false
  if (!order.value) return false
  if (order.value.overallStatus === 'CANCELLED') return false
  if (order.value.billingStatus?.status === 'GENERATED') return false
  return hasRole('ADMIN', 'BILLING')
})

const customerPhones = computed(() => {
  if (!order.value?.customer) return []
  const list: { display: string; number: string }[] = []
  const rawPhones = [order.value.customer.phone, (order.value.customer as any).alternatePhone].filter(Boolean)
  
  for (const raw of rawPhones) {
    const parts = String(raw).split(/[,;/|\n]+/).map(p => p.trim()).filter(Boolean)
    for (const p of parts) {
      const cleanDigits = p.replace(/[^\d+]/g, '')
      if (cleanDigits.length >= 5 && !list.some(item => item.number === cleanDigits)) {
        list.push({
          display: p,
          number: cleanDigits
        })
      }
    }
  }
  return list
})

const copiedOrderNumber = ref(false)
const copyOrderNumber = () => {
  if (!order.value?.orderNumber) return
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(order.value.orderNumber)
    copiedOrderNumber.value = true
    setTimeout(() => {
      copiedOrderNumber.value = false
    }, 2000)
  }
}

// Automatically refresh drawer if another user/tab updates this order
onOrderSync((event) => {
  if (props.isOpen && props.orderId && (!event.orderId || event.orderId === props.orderId)) {
    fetchOrder(props.orderId)
  }
})

// Inline form states
const showBillingForm = ref(false)
const billingForm = ref({ status: '', invoiceNumber: '', holdReason: '' })
const isGenerateModalOpen = ref(false)

const showPackingForm = ref(false)
const packingForm = ref({ status: '', items: [] as any[], holdReason: '' })

watch(() => props.orderId, async (newId) => {
  if (newId && props.isOpen) {
    await fetchOrder(newId)
  }
})

watch(() => props.isOpen, async (open) => {
  if (open && props.orderId) {
    await fetchOrder(props.orderId)
  }
})

const isDeleting = ref(false)

const deleteOrder = async () => {
  if (!order.value || !confirm('Are you sure you want to completely delete this order? This action cannot be undone.')) return
  isDeleting.value = true
  try {
    const deletedId = order.value.id
    await $fetch(`/api/orders/${deletedId}`, { method: 'DELETE' })
    notifyChange({ orderId: deletedId, action: 'ORDER_DELETED' })
    emit('updated')
    closePanel()
  } catch (err: any) {
    console.error(err)
    alert(err.data?.message || 'Failed to delete order')
  } finally {
    isDeleting.value = false
  }
}

const isCancelModalOpen = ref(false)
const cancelReason = ref('')
const isCancelling = ref(false)

const openCancelModal = () => {
  cancelReason.value = ''
  isCancelModalOpen.value = true
}

const confirmCancelOrder = async () => {
  if (!order.value) return
  if (!cancelReason.value.trim()) {
    alert('Please enter a cancellation reason')
    return
  }
  isCancelling.value = true
  try {
    await $fetch(`/api/orders/${order.value.id}/cancel`, {
      method: 'POST',
      body: { reason: cancelReason.value.trim() }
    })
    showSaved('Order cancelled and permanently logged in timeline')
    isCancelModalOpen.value = false
    notifyChange({ orderId: order.value.id, action: 'ORDER_CANCELLED' })
    emit('updated')
    await fetchOrder(order.value.id)
  } catch (err: any) {
    console.error(err)
    alert(err.data?.message || 'Failed to cancel order')
  } finally {
    isCancelling.value = false
  }
}

const fetchOrder = async (id: string) => {
  isLoading.value = true
  try {
    const data = await $fetch<Order>(`/api/orders/${id}`)
    order.value = data
    packingForm.value = {
      status: data.packingStatus?.status || 'PENDING',
      items: data.items?.map(i => {
        const approvedQty = i.approvedQuantity ?? i.quantity
        const isOrderAlreadyPacked = data.packingStatus?.status === 'PACKED'
        const dbPackedQty = i.packedQuantity !== undefined && i.packedQuantity !== null ? Number(i.packedQuantity) : null
        const isItemPacked = Boolean((i as any).isPacked) || (dbPackedQty !== null && dbPackedQty > 0) || isOrderAlreadyPacked

        const packedQty = dbPackedQty !== null ? dbPackedQty : 0
        const isPacked = isItemPacked

        return {
          id: i.id,
          packedQuantity: packedQty,
          isPacked,
          quantity: approvedQty,
          sku: i.product?.sku || i.product?.name
        }
      }) || [],
      holdReason: data.packingStatus?.holdReason || ''
    }
    nextTick(() => {
      if (itemsTbodyRef.value) {
        const rows = itemsTbodyRef.value.querySelectorAll('tr')
        animateStagger(rows, { duration: 0.18, stagger: 0.02, y: 4 })
      }
    })
  } catch (error) {
    console.error('Failed to fetch order:', error)
  } finally {
    isLoading.value = false
  }
}

const initBillingForm = () => {
  showBillingForm.value = !showBillingForm.value
  if (!showBillingForm.value) {
    hide()
    return
  }
  if (order.value) {
    billingForm.value = {
      status: order.value.billingStatus?.status || 'PENDING',
      invoiceNumber: order.value.invoiceNumber || '',
      holdReason: order.value.billingStatus?.holdReason || ''
    }
    showEditing()
  }
}

const initPackingForm = () => {
  showPackingForm.value = !showPackingForm.value
  if (!showPackingForm.value) {
    hide()
    return
  }
  if (order.value) {
    packingForm.value = {
      status: order.value.packingStatus?.status || 'PENDING',
      items: order.value.items?.map(i => {
        const approvedQty = i.approvedQuantity ?? i.quantity
        const isOrderAlreadyPacked = order.value?.packingStatus?.status === 'PACKED'
        const dbPackedQty = i.packedQuantity !== undefined && i.packedQuantity !== null ? Number(i.packedQuantity) : null
        const isItemPacked = Boolean((i as any).isPacked) || (dbPackedQty !== null && dbPackedQty > 0) || isOrderAlreadyPacked
        const packedQty = dbPackedQty !== null ? dbPackedQty : 0
        const isPacked = isItemPacked
        return {
          id: i.id,
          packedQuantity: packedQty,
          isPacked,
          quantity: approvedQty,
          sku: i.product?.sku || i.product?.name
        }
      }) || [],
      holdReason: order.value.packingStatus?.holdReason || ''
    }
    showEditing()
  }
}

const billingStatusOptions = [
  { label: 'PENDING', value: 'PENDING' },
  { label: 'GENERATED', value: 'GENERATED' },
  { label: 'ON HOLD', value: 'ON_HOLD' }
]

const packingStatusOptions = [
  { label: 'PENDING', value: 'PENDING' },
  { label: 'IN PROGRESS', value: 'IN_PROGRESS' },
  { label: 'PACKED', value: 'PACKED' },
  { label: 'ON HOLD', value: 'ON_HOLD' }
]

const customerOptions = computed(() => {
  return (customersList.value || []).map(c => ({
    label: c.name,
    value: c.id,
    subtitle: c.company || c.city || ''
  }))
})

const productOptions = computed(() => {
  return (productsList.value || []).map(p => ({
    label: `${p.sku} - ${p.name}`,
    value: p.id,
    subtitle: `Stock: ${p.stock}`
  }))
})

const closePanel = () => {
  hide()
  showBillingForm.value = false
  emit('close')
}

watch(billingForm, () => { if (showBillingForm.value) showEditing() }, { deep: true })


const markBillGenerated = () => {
  if (!order.value) return
  isGenerateModalOpen.value = true
}

const handleBillGenerated = async () => {
  showSaved('Bill generated successfully')
  notifyChange({ orderId: order.value?.id, action: 'BILL_GENERATED' })
  emit('updated')
  if (order.value?.id) {
    await fetchOrder(order.value.id)
  }
}

const updateBilling = async () => {
  if (!order.value) return
  
  if (billingForm.value.status === 'GENERATED') {
    isGenerateModalOpen.value = true
    showBillingForm.value = false
    hide()
    return
  }

  // Optimistic UI update (0ms local response)
  if (order.value && billingForm.value.status) {
    if (!order.value.billingStatus) order.value.billingStatus = {} as any
    order.value.billingStatus.status = billingForm.value.status as any
    if (billingForm.value.invoiceNumber) order.value.billingStatus.invoiceNumber = billingForm.value.invoiceNumber
  }

  showSaving()
  try {
    await $fetch(`/api/orders/${order.value.id}/billing`, {
      method: 'PATCH',
      body: billingForm.value
    })
    showBillingForm.value = false
    showSaved('Billing updated successfully')
    notifyChange({ orderId: order.value.id, action: 'BILLING_UPDATED', status: billingForm.value.status })
    emit('updated')
    await fetchOrder(order.value.id)
  } catch (err) {
    console.error(err)
    hide()
  }
}

const updatePacking = async () => {
  if (!order.value) return
  showSaving()
  try {
    const itemsData = (packingForm.value.items || []).map(i => ({
      id: i.id,
      packedQuantity: Number(i.packedQuantity !== undefined ? i.packedQuantity : (i.isPacked ? i.quantity : 0))
    }))
    await $fetch(`/api/orders/${order.value.id}/packing`, {
      method: 'PATCH',
      body: {
        status: packingForm.value.status,
        items: itemsData,
        holdReason: packingForm.value.status === 'ON_HOLD' ? packingForm.value.holdReason : undefined
      }
    })
    showSaved('Packing updated successfully')
    notifyChange({ orderId: order.value.id, action: 'PACKING_UPDATED', status: packingForm.value.status })
    emit('updated')
    await fetchOrder(order.value.id)
  } catch (err: any) {
    console.error('Failed to update packing:', err)
    hide()
  }
}

let packingSyncTimer: any = null

const recalculatePackingStatus = () => {
  if (!packingForm.value.items || !packingForm.value.items.length) return
  // An order is considered fully packed when all line items have been confirmed/packed by the packer
  const allPacked = packingForm.value.items.length > 0 && packingForm.value.items.every(i => i.isPacked)
  const anyPacked = packingForm.value.items.some(i => i.isPacked || Number(i.packedQuantity || 0) > 0)

  if (allPacked) {
    packingForm.value.status = 'PACKED'
  } else if (anyPacked) {
    packingForm.value.status = 'IN_PROGRESS'
  } else {
    packingForm.value.status = 'PENDING'
  }

  if (order.value && order.value.packingStatus) {
    order.value.packingStatus.status = packingForm.value.status as any
  }
}

const syncPackingState = (immediate = false) => {
  if (!order.value) return

  // 1. Instant local optimistic update on order.value items (0ms latency)
  if (order.value.items && packingForm.value.items) {
    order.value.items.forEach(ordItem => {
      const match = packingForm.value.items.find(p => p.id === ordItem.id)
      if (match) {
        ordItem.packedQuantity = match.packedQuantity
        ;(ordItem as any).isPacked = Boolean(match.isPacked)
      }
    })
  }

  // 2. Broadcast immediately over local broadcast channel & websockets for instant cross-tab / device sync
  const optimisticOrder = {
    ...order.value,
    items: order.value.items ? order.value.items.map(it => ({ ...it })) : [],
    packingStatus: {
      ...(order.value.packingStatus || {}),
      status: packingForm.value.status
    }
  }

  // Optimistically inform parent table so row progress updates instantly
  emit('updated', optimisticOrder)

  notifyChange({
    orderId: order.value.id,
    action: 'PACKING_ITEM_UPDATED',
    status: packingForm.value.status,
    order: optimisticOrder
  })

  const runPatch = async () => {
    try {
      const itemsData = (packingForm.value.items || []).map(i => ({
        id: i.id,
        packedQuantity: Math.max(0, Number(i.packedQuantity || 0)),
        isPacked: Boolean(i.isPacked)
      }))
      const res = await $fetch<any>(`/api/orders/${order.value!.id}/packing`, {
        method: 'PATCH',
        body: {
          status: packingForm.value.status,
          items: itemsData,
          holdReason: packingForm.value.status === 'ON_HOLD' ? packingForm.value.holdReason : undefined
        }
      })
      // Broadcast verified backend update to everyone via WebSockets
      notifyChange({
        orderId: order.value!.id,
        action: 'PACKING_UPDATED',
        status: packingForm.value.status,
        order: res
      })
      emit('updated', res)
    } catch (err: any) {
      console.error('Failed to sync packing:', err)
    }
  }

  if (immediate) {
    if (packingSyncTimer) clearTimeout(packingSyncTimer)
    runPatch()
  } else {
    if (packingSyncTimer) clearTimeout(packingSyncTimer)
    packingSyncTimer = setTimeout(runPatch, 250)
  }
}

const isMismatchModalOpen = ref(false)
const mismatchModalItem = ref<{
  idx: number
  sku: string
  name: string
  approvedQty: number
  packedQty: number
} | null>(null)

const decrementPackedQty = (idx: number) => {
  const item = packingForm.value.items[idx]
  if (!item) return
  const current = Number(item.packedQuantity || 0)
  if (current <= 0) return
  item.packedQuantity = current - 1
  const target = Number(item.quantity || 0)
  if (item.packedQuantity === 0) {
    item.isPacked = false
  } else if (item.isPacked && item.packedQuantity !== target) {
    // If quantity was altered while checked to something not matching target, require explicit re-confirmation
    item.isPacked = false
  }
  recalculatePackingStatus()
  syncPackingState(false)
}

const incrementPackedQty = (idx: number) => {
  const item = packingForm.value.items[idx]
  if (!item) return
  const target = Number(item.quantity || 0)
  const current = Number(item.packedQuantity || 0)
  if (current >= target) return
  item.packedQuantity = current + 1
  if (item.packedQuantity === target) {
    // Reached 100% full match -> mark as packed
    item.isPacked = true
  } else if (item.isPacked) {
    // If adjusted to a count less than target while checked, require explicit re-confirmation
    item.isPacked = false
  }
  recalculatePackingStatus()
  syncPackingState(false)
}

const handlePackedQtyInput = (idx: number) => {
  const item = packingForm.value.items[idx]
  if (!item) return
  const target = Number(item.quantity || 0)
  let val = Number(item.packedQuantity)
  if (isNaN(val) || val < 0) val = 0
  if (val > target) val = target
  item.packedQuantity = val
  if (val === target) {
    item.isPacked = true
  } else {
    // Mismatch / partial: requires explicit confirmation via the checkbox
    item.isPacked = false
  }
  recalculatePackingStatus()
  syncPackingState(false)
}

const handlePackingCheckboxToggle = (idx: number, event: Event) => {
  const isChecked = (event.target as HTMLInputElement).checked
  const item = packingForm.value.items[idx]
  if (!item) return
  const target = Number(item.quantity || 0)
  const currentPacked = Number(item.packedQuantity || 0)

  if (!isChecked) {
    // Unchecking an already-checked item
    item.isPacked = false
    item.packedQuantity = 0
    recalculatePackingStatus()
    syncPackingState(true)
    return
  }

  // User is ticking the checkbox
  if (currentPacked === target && target > 0) {
    // Quantities match full approved quantity exactly
    item.isPacked = true
    recalculatePackingStatus()
    syncPackingState(true)
    return
  }

  // Quantity mismatch detected (either currentPacked === 0 or currentPacked < target)!
  // Revert the visual checkbox state until explicitly confirmed by the packer
  item.isPacked = false
  if (event.target) {
    (event.target as HTMLInputElement).checked = false
  }

  mismatchModalItem.value = {
    idx,
    sku: item.sku || order.value?.items?.[idx]?.product?.sku || 'Line Item',
    name: order.value?.items?.[idx]?.product?.name || item.sku || '',
    approvedQty: target,
    packedQty: currentPacked
  }
  isMismatchModalOpen.value = true
}

const confirmMismatchPacked = () => {
  if (!mismatchModalItem.value) return
  const idx = mismatchModalItem.value.idx
  const item = packingForm.value.items[idx]
  if (item) {
    item.isPacked = true
    item.packedQuantity = mismatchModalItem.value.packedQty
    recalculatePackingStatus()
    syncPackingState(true)
  }
  isMismatchModalOpen.value = false
  mismatchModalItem.value = null
}

const confirmFullPacked = () => {
  if (!mismatchModalItem.value) return
  const idx = mismatchModalItem.value.idx
  const item = packingForm.value.items[idx]
  if (item) {
    item.isPacked = true
    item.packedQuantity = mismatchModalItem.value.approvedQty
    recalculatePackingStatus()
    syncPackingState(true)
  }
  isMismatchModalOpen.value = false
  mismatchModalItem.value = null
}

const cancelMismatchModal = () => {
  isMismatchModalOpen.value = false
  mismatchModalItem.value = null
}

const markAsPacked = async () => {
  const hasMismatched = packingForm.value.items.some(i => (i.packedQuantity || 0) > 0 && (i.packedQuantity || 0) < i.quantity)
  if (hasMismatched) {
    const confirmShortages = confirm("Some items have packed quantities less than approved. Mark all items as packed with these quantities?")
    if (!confirmShortages) return
  }
  packingForm.value.status = 'PACKED'
  packingForm.value.items.forEach(i => {
    i.isPacked = true
    // If an item already has a custom packed quantity (e.g. 7 due to stock shortage), keep it!
    // Only default to full approved quantity if untouched (0)
    if (!i.packedQuantity || i.packedQuantity <= 0) {
      i.packedQuantity = i.quantity
    }
  })
  recalculatePackingStatus()
  syncPackingState(true)
}

const getItemTotal = (item: any) => {
  if (item.total) return Number(item.total)
  const price = Number(item.unitPrice || 0)
  const approvedQty = Number(item.approvedQuantity ?? item.quantity ?? 0)
  if (props.context === 'billing') {
    if (item.billedQuantity !== undefined && item.billedQuantity !== null) {
      return price * Number(item.billedQuantity)
    }
    if (order.value?.packingStatus?.status === 'PACKED' && item.packedQuantity !== undefined && item.packedQuantity !== null) {
      return price * Number(item.packedQuantity)
    }
  }
  return price * approvedQty
}

const getStepStatus = (step: string) => {
  if (!order.value) return 'PENDING'
  switch(step) {
    case 'SALES': return 'COMPLETED'
    case 'APPROVAL': return (order.value as any).isApproved ? 'APPROVED' : 'PENDING'
    case 'PACKING': return order.value.packingStatus?.status || 'NOT_STARTED'
    case 'BILLING': return order.value.billingStatus?.status || 'PENDING'
    case 'DELIVERY': return order.value.deliveryStatus?.status || 'NOT_STARTED'
    default: return 'PENDING'
  }
}

const getStepColor = (step: string) => {
  const status = getStepStatus(step)
  if (['COMPLETED', 'APPROVED', 'GENERATED', 'PACKED', 'DELIVERED'].includes(status)) return 'text-emerald-700 border-emerald-600 bg-emerald-50'
  if (status === 'IN_PROGRESS' || status === 'WAITING' || status === 'DISPATCHED') return 'text-blue-600 border-blue-600 bg-blue-50'
  if (status === 'ON_HOLD') return 'text-orange-600 border-orange-600 bg-orange-50'
  if (status === 'PENDING' && step === 'APPROVAL') return 'text-amber-600 border-amber-500 bg-amber-50'
  return 'text-gray-400 border-gray-300 bg-white'
}

const isEditModalOpen = ref(false)
const isEditLoading = ref(false)
const editForm = ref({ 
  orderNumber: '', 
  customerId: '', 
  deliveryAddress: '', 
  paymentTerms: '', 
  notes: '', 
  isUrgent: false,
  vehicleMode: 'OUR_FLEET',
  items: [] as any[] 
})
const customersList = ref<any[]>([])
const productsList = ref<any[]>([])

const initialFormState = ref('')

const cancelEdit = () => {
  isEditModalOpen.value = false
  hide()
}

const openEditModal = async () => {
  if (!order.value) return
  isEditModalOpen.value = true
  isEditLoading.value = true
  
  try {
    if (!customersList.value.length) {
      customersList.value = await $fetch('/api/customers') as any[]
    }
    if (!productsList.value.length) {
      productsList.value = await $fetch('/api/products') as any[]
    }
  } catch (err) {
    console.error("Failed to fetch dropdowns", err)
  }

  const newForm = {
    orderNumber: order.value.orderNumber,
    customerId: order.value.customerId,
    deliveryAddress: order.value.deliveryAddress || '',
    paymentTerms: order.value.paymentTerms || '',
    notes: order.value.notes || '',
    isUrgent: Boolean(order.value.isUrgent),
    vehicleMode: order.value.vehicleMode || 'OUR_FLEET',
    items: order.value.items.map(i => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      productSku: i.product?.sku,
      isTaxInclusive: Boolean(i.isTaxInclusive),
      applyLastPrice: Boolean(i.applyLastPrice),
      itemNotes: i.itemNotes || ''
    }))
  }
  
  editForm.value = newForm
  initialFormState.value = JSON.stringify(newForm)
  isEditLoading.value = false
}

const addEditItem = () => {
  editForm.value.items.push({ 
    productId: '', 
    quantity: 1, 
    unitPrice: 0,
    isTaxInclusive: false,
    applyLastPrice: false,
    itemNotes: ''
  })
}

const removeEditItem = (idx: number) => {
  editForm.value.items.splice(idx, 1)
}

const onEditCustomerChange = () => {
  const c = customersList.value.find((c: any) => c.id === editForm.value.customerId)
  if (c) {
    const fullAddress = [c.address, c.city, c.state].filter(Boolean).join(', ')
    editForm.value.deliveryAddress = `${fullAddress}${c.pincode ? ' - ' + c.pincode : ''}`
    editForm.value.paymentTerms = c.paymentTerms || 'Net 30'
  }
}

const onEditProductChange = (idx: number) => {
  const item = editForm.value.items[idx]
  const product = productsList.value.find(p => p.id === item.productId)
  if (product) {
    item.unitPrice = Number(product.price)
    item.productSku = product.sku
  }
}

const editOrderTotal = computed(() => {
  return editForm.value.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
})

const saveEdit = async () => {
  if (!order.value) return
  if (!editForm.value.items.length) {
    alert("Order must have at least one item.")
    return
  }
  showSaving('Saving Changes...')
  try {
    const updatedOrder = await $fetch<any>(`/api/orders/${order.value.id}`, {
      method: 'PATCH',
      body: editForm.value
    })
    showSaved('Order updated successfully')
    isEditModalOpen.value = false
    notifyChange({ orderId: order.value.id, action: 'ORDER_EDITED', order: updatedOrder })
    emit('updated', updatedOrder)
    await fetchOrder(order.value.id)
  } catch (err) {
    console.error(err)
    alert('Failed to update order')
  }
}

watch(editForm, () => { 
  if (isEditModalOpen.value) {
    if (JSON.stringify(editForm.value) !== initialFormState.value) {
      showEditing('Unsaved changes', saveEdit, cancelEdit)
    } else {
      hide()
    }
  }
}, { deep: true })


</script>



<template>
  <GenerateBillModal 
    :isOpen="isGenerateModalOpen"
    :orderId="order?.id || null"
    @close="isGenerateModalOpen = false"
    @generated="handleBillGenerated"
  />

  <!-- Admin Department Status Override Modal -->
  <AdminOrderStatusModal
    :isOpen="isAdminStatusModalOpen"
    :order="order"
    @close="isAdminStatusModalOpen = false"
    @updated="onAdminStatusUpdated"
  />


  <!-- Mandatory Order Cancellation Modal -->
  <Teleport to="body">
    <div v-if="isCancelModalOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200">
        <div class="p-6">
          <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
            <Ban class="w-6 h-6" />
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-1">Cancel Order {{ order?.orderNumber }}?</h3>
          <p class="text-xs text-gray-500 mb-4">
            Under company policy, orders cannot be deleted without audit. This will permanently mark the order as Cancelled and record your audit log in the timeline.
          </p>

          <label class="block text-xs font-bold text-gray-700 mb-1">Mandatory Cancellation Reason *</label>
          <textarea 
            v-model="cancelReason" 
            rows="3"
            placeholder="e.g. Client requested cancellation due to site delay, duplicate entry, out of stock..."
            class="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
          ></textarea>
        </div>

        <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button 
            @click="isCancelModalOpen = false"
            class="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Go Back
          </button>
          <button 
            @click="confirmCancelOrder" 
            :disabled="isCancelling || !cancelReason.trim()"
            class="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <span>Confirm Cancellation</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Explicit Confirmation for Quantity Mismatch Modal -->
  <Teleport to="body">
    <div v-if="isMismatchModalOpen && mismatchModalItem" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200">
        <div class="p-6">
          <div 
            class="w-12 h-12 rounded-full flex items-center justify-center mb-4 border"
            :class="mismatchModalItem.packedQty === 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'"
          >
            <AlertCircle v-if="mismatchModalItem.packedQty === 0" class="w-6 h-6" />
            <AlertTriangle v-else class="w-6 h-6" />
          </div>

          <h3 class="text-lg font-bold text-gray-900 mb-1">
            {{ mismatchModalItem.packedQty === 0 ? 'Confirm 0 Packed (Out of Stock)?' : 'Confirm Packing with Shortage?' }}
          </h3>
          <p class="text-xs text-gray-500 mb-4">
            <span v-if="mismatchModalItem.packedQty === 0">
              The packing quantity is 0 of {{ mismatchModalItem.approvedQty }} approved units. If this item is completely unavailable, confirm 0 packed so billing reconciles it. Or pack the full quantity if all {{ mismatchModalItem.approvedQty }} units are available.
            </span>
            <span v-else>
              The packing quantity ({{ mismatchModalItem.packedQty }}) does not match the approved quantity ({{ mismatchModalItem.approvedQty }}). Please confirm if you want to mark this item as packed with the available count.
            </span>
          </p>

          <div 
            class="border rounded-xl p-3.5 space-y-2 mb-4"
            :class="mismatchModalItem.packedQty === 0 ? 'bg-rose-50/60 border-rose-200/80' : 'bg-amber-50/70 border-amber-200/80'"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-gray-700">Item / SKU:</span>
              <span class="font-mono font-bold text-gray-900">{{ mismatchModalItem.sku }}</span>
            </div>
            <div v-if="mismatchModalItem.name" class="text-xs text-gray-600 truncate">
              {{ mismatchModalItem.name }}
            </div>
            <div 
              class="border-t pt-2 flex items-center justify-between text-xs"
              :class="mismatchModalItem.packedQty === 0 ? 'border-rose-200/60' : 'border-amber-200/60'"
            >
              <div>
                <span class="text-gray-500">Approved:</span>
                <span class="font-bold text-gray-900 ml-1">{{ mismatchModalItem.approvedQty }}</span>
              </div>
              <div>
                <span class="text-gray-500">Packed:</span>
                <span 
                  class="font-bold ml-1"
                  :class="mismatchModalItem.packedQty === 0 ? 'text-rose-600' : 'text-amber-700'"
                >
                  {{ mismatchModalItem.packedQty }}
                </span>
              </div>
              <div>
                <span class="text-gray-500">Shortage:</span>
                <span class="font-bold text-rose-600 ml-1">-{{ mismatchModalItem.approvedQty - mismatchModalItem.packedQty }}</span>
              </div>
            </div>
          </div>

          <p class="text-[11px] text-gray-500">
            Billing will be alerted to this difference and will reconcile the invoice to charge for only the {{ mismatchModalItem.packedQty }} packed units.
          </p>
        </div>

        <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap justify-end gap-2 sm:gap-3">
          <button 
            type="button"
            @click="cancelMismatchModal"
            class="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <!-- When 0 packed: Option to Confirm 0 Packed (Out of stock) -->
          <button 
            v-if="mismatchModalItem.packedQty === 0"
            type="button"
            @click="confirmMismatchPacked" 
            class="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Ban class="w-3.5 h-3.5" />
            <span>Confirm 0 Packed (Out of Stock)</span>
          </button>

          <!-- When > 0 packed: Confirm that partial quantity -->
          <button 
            v-else
            type="button"
            @click="confirmMismatchPacked" 
            class="px-3.5 py-2 text-xs font-bold text-white bg-[#1b3b5f] hover:bg-[#132c49] rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check class="w-3.5 h-3.5" />
            <span>Mark as Packed ({{ mismatchModalItem.packedQty }})</span>
          </button>

          <!-- Always available: Option to Pack Full Quantity -->
          <button 
            type="button"
            @click="confirmFullPacked" 
            class="px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            :class="mismatchModalItem.packedQty === 0 ? 'bg-[#1b3b5f] hover:bg-[#132c49] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          >
            <CheckCheck class="w-3.5 h-3.5" />
            <span>Pack Full ({{ mismatchModalItem.approvedQty }})</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[100] overflow-hidden pointer-events-none">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-auto transition-opacity" @click="closePanel"></div>
      
      <div 
        class="absolute inset-y-0 right-0 max-w-full w-full bg-white shadow-2xl pointer-events-auto flex flex-col h-full overflow-hidden transform transition-all duration-300 border-l border-gray-200/80"
        :class="context === 'packing' ? 'sm:max-w-[760px] md:max-w-[880px] lg:max-w-[960px] xl:max-w-[1020px]' : 'sm:max-w-[500px] md:max-w-[540px]'"
      >
      
      <template v-if="order">
        <!-- Loading Overlay -->
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 pointer-events-auto animate-pulse transition-all duration-300"></div>

        <!-- 1. Header Bar -->
        <div class="px-5 sm:px-6 py-3.5 border-b border-gray-200/80 flex items-center justify-between bg-white flex-shrink-0 z-10">
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            <div class="flex items-center gap-1.5">
              <h2 class="text-base sm:text-lg font-bold font-mono tracking-tight text-gray-950">
                {{ order.orderNumber }}
              </h2>
              <button 
                @click="copyOrderNumber" 
                class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition cursor-pointer" 
                :title="copiedOrderNumber ? 'Copied to clipboard!' : 'Copy Order Number'"
              >
                <Check v-if="copiedOrderNumber" class="w-3.5 h-3.5 text-emerald-600" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>

            <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 uppercase tracking-wider">
              <Ban class="w-3 h-3 text-rose-600" /> CANCELLED
            </span>
            <StatusBadge 
              v-else
              :status="order.overallStatus" 
              :display="getDisplayStatus(order)" 
              :class="getOverallColor(order)" 
            />
            <span v-if="order.isUrgent && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
              <Zap class="w-3 h-3 text-rose-600 fill-rose-600" />
              <span>Urgent</span>
            </span>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button 
              v-if="canEditOrderStatus"
              @click="openAdminStatusModal" 
              title="Edit Status Across Departments"
              class="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Edit Status</span>
            </button>

            <button 
              v-if="canCancelOrder"
              @click="openCancelModal" 
              title="Cancel Order (Mandatory Reason Required)"
              class="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Ban class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Cancel</span>
            </button>
            <button 
              v-if="hasRole('ADMIN')"
              @click="deleteOrder" 
              :disabled="isDeleting"
              title="Delete Order (Admin Only)"
              class="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button 
              @click="closePanel" 
              class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- 2. Sub-header Quick Snapshot -->
        <div class="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-b from-gray-50/90 to-gray-50/40 border-b border-gray-200/80 flex-shrink-0">
          <div class="flex items-center justify-between gap-3 sm:gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <Building2 class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <h3 class="text-sm font-bold text-gray-900 truncate">
                  {{ order.customer?.company || order.customer?.name || 'Customer' }}
                </h3>
              </div>
              <div class="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 mt-0.5">
                <span v-if="order.customer?.company && order.customer?.name" class="font-medium text-gray-700 truncate max-w-[120px] sm:max-w-none">
                  {{ order.customer.name }}
                </span>
                <span 
                  v-if="order.customer?.company && order.customer?.name" 
                  class="w-1 h-1 rounded-full bg-gray-400 shrink-0 self-center" 
                  aria-hidden="true" 
                />
                <span class="whitespace-nowrap shrink-0">Placed on {{ formatDate(order.createdAt) }}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div v-if="context !== 'delivery'" class="text-sm sm:text-lg font-black text-[#1b3b5f] tracking-tight tabular-nums">
                {{ formatCurrency(order.totalAmount || 0) }}
              </div>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200/70 text-gray-700 mt-0.5">
                {{ order.items?.length || 0 }} {{ (order.items?.length === 1) ? 'item' : 'items' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 3. Navigation Tabs -->
        <div class="px-5 sm:px-6 border-b border-gray-200/80 bg-white flex gap-6 text-xs sm:text-sm font-semibold text-gray-500 flex-shrink-0">
          <button 
            v-for="tab in ([
              { id: 'DETAILS', label: 'Details', badge: order.items?.length },
              { id: 'TIMELINE', label: 'Timeline', badge: order.timeline?.length },
              { id: 'NOTES', label: 'Notes', badge: order.notes ? '•' : null }
            ] as const)" 
            :key="tab.id"
            @click="activeTab = tab.id as any"
            :class="[
              'py-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer',
              activeTab === tab.id 
                ? 'border-[#1b3b5f] text-[#1b3b5f] font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            ]"
          >
            <span>{{ tab.label }}</span>
            <span 
              v-if="tab.badge" 
              class="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
              :class="activeTab === tab.id ? 'bg-[#1b3b5f]/10 text-[#1b3b5f]' : 'bg-gray-100 text-gray-500'"
            >
              {{ tab.badge }}
            </span>
          </button>
        </div>

        <!-- 4. Scrollable Drawer Body -->
        <div class="flex-grow overflow-y-auto bg-white p-5 sm:p-6 pb-36 space-y-6">
          
          <!-- DETAILS TAB -->
          <div v-if="activeTab === 'DETAILS'" class="space-y-6 flex flex-col">
            
            <!-- A. Order Flow Visualizer (Top of Details) -->
            <div class="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/70">
              <div class="flex items-center justify-between mb-3.5">
                <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock class="w-3.5 h-3.5 text-gray-400" />
                  Workflow Pipeline
                </span>
                <span class="text-[11px] font-semibold text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                  {{ getDisplayStatus(order) }}
                </span>
              </div>
              
              <div class="relative flex items-start justify-between px-2">
                <!-- Background Connecting Line -->
                <div class="absolute top-4 left-[10%] right-[10%] h-0.5 bg-gray-200/90 z-0"></div>
                
                <!-- Steps -->
                <div 
                  v-for="step in [
                    { id: 'SALES', label: 'Sales' },
                    { id: 'APPROVAL', label: 'Approval' },
                    { id: 'PACKING', label: 'Packing' },
                    { id: 'BILLING', label: 'Billing' },
                    { id: 'DELIVERY', label: 'Dispatch' }
                  ]" 
                  :key="step.id"
                  class="relative z-10 flex flex-col items-center gap-1.5 bg-transparent"
                >
                  <!-- Icon Circle -->
                  <div 
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 bg-white transition-all shadow-2xs"
                    :class="getStepColor(step.id)"
                  >
                    <Check v-if="step.id === 'SALES'" class="w-3.5 h-3.5" />
                    <CheckCheck v-else-if="step.id === 'APPROVAL'" class="w-3.5 h-3.5" />
                    <Box v-else-if="step.id === 'PACKING'" class="w-3.5 h-3.5" />
                    <IndianRupee v-else-if="step.id === 'BILLING'" class="w-3 h-3" />
                    <Truck v-else-if="step.id === 'DELIVERY'" class="w-3.5 h-3.5" />
                  </div>
                  <!-- Label -->
                  <div class="text-center">
                    <span class="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-800">
                      {{ step.label }}
                    </span>
                    <span class="block text-[9px] text-gray-500 uppercase tracking-tight mt-0.5 whitespace-nowrap">
                      {{ getStepStatus(step.id).replace(/_/g, ' ') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- B. Customer & Order Information Grid -->
            <div class="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs">
              <div class="flex justify-between items-center mb-3 pb-2.5 border-b border-gray-100">
                <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User class="w-3.5 h-3.5 text-gray-400" />
                  Customer & Order Details
                </h3>
                <button 
                  v-if="canEditOrders" 
                  @click="openEditModal" 
                  class="text-xs font-semibold text-[#1b3b5f] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Edit class="w-3 h-3" /> Edit
                </button>
              </div>
              
              <div class="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs sm:text-sm">
                <div>
                  <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Customer</span>
                  <span class="font-semibold text-gray-900">{{ order.customer?.name || '—' }}</span>
                  <span v-if="order.customer?.company" class="block text-xs text-gray-500">{{ order.customer.company }}</span>
                </div>

                <div>
                  <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Placed By</span>
                  <div class="flex items-center gap-1.5 font-medium text-gray-900">
                    <User class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span class="truncate">{{ order.salesPerson?.name || order.timeline?.find(t => t.action?.includes('Created'))?.performedBy?.name || '—' }}</span>
                  </div>
                </div>

                <!-- Contact Phone (Full width on mobile so multiple numbers never collide) -->
                <div class="col-span-2 sm:col-span-1">
                  <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-1">Contact Phone</span>
                  <div v-if="customerPhones.length > 0" class="flex flex-wrap items-center gap-1.5">
                    <a 
                      v-for="ph in customerPhones" 
                      :key="ph.number"
                      :href="`tel:${ph.number}`" 
                      class="inline-flex items-center gap-1 font-medium text-gray-900 hover:text-[#1b3b5f] bg-gray-50 hover:bg-[#1b3b5f]/5 px-2 py-0.5 rounded border border-gray-200/80 transition-colors text-xs"
                      :title="`Call ${ph.display}`"
                    >
                      <Phone class="w-3 h-3 text-gray-400 shrink-0" />
                      <span class="font-mono">{{ ph.display }}</span>
                    </a>
                  </div>
                  <span v-else class="text-gray-400">—</span>
                </div>

                <!-- Payment Terms -->
                <div class="col-span-1">
                  <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-1">Payment Terms</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                    {{ order.paymentTerms || order.customer?.paymentTerms || '—' }}
                  </span>
                </div>

                <!-- Transport Mode -->
                <div class="col-span-1">
                  <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-1">Transport Mode</span>
                  <span 
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
                    :class="order.vehicleMode === 'PARTY_VEHICLE' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-[#1b3b5f]/10 text-[#1b3b5f] border-[#1b3b5f]/20'"
                  >
                    <Car v-if="order.vehicleMode === 'PARTY_VEHICLE'" class="w-3 h-3 text-amber-600 shrink-0" />
                    <Truck v-else class="w-3 h-3 text-[#1b3b5f] shrink-0" />
                    <span class="truncate">{{ order.vehicleMode === 'PARTY_VEHICLE' ? 'Party Vehicle / Pickup' : 'Our Delivery Fleet' }}</span>
                  </span>
                </div>

                <div class="col-span-2 pt-2 border-t border-gray-100">
                  <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Delivery Address</span>
                  <p class="text-xs sm:text-sm text-gray-800 leading-relaxed flex items-start gap-1.5">
                    <MapPin class="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <span>{{ order.deliveryAddress || 'No delivery address specified' }}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- C1. Party Vehicle Transport Mode -->
            <div v-if="order.vehicleMode === 'PARTY_VEHICLE'" class="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
              <div class="flex justify-between items-center pb-2.5 border-b border-gray-100">
                <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Car class="w-3.5 h-3.5 text-amber-600" />
                  Party Vehicle Transport
                </h3>
                <span 
                  class="font-mono text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded border"
                  :class="order.deliveryStatus?.status === 'DELIVERED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'"
                >
                  {{ order.deliveryStatus?.status === 'DELIVERED' ? 'HANDED OVER' : 'CUSTOMER PICKUP' }}
                </span>
              </div>

              <!-- Delivered State -->
              <div v-if="order.deliveryStatus?.status === 'DELIVERED'" class="space-y-3">
                <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-xs sm:text-sm">
                  <div>
                    <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Handover Info</span>
                    <div class="flex items-center gap-1.5 font-bold text-gray-900">
                      <Car class="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{{ order.deliveryStatus?.driverName || 'Party Vehicle' }}</span>
                    </div>
                  </div>

                  <div>
                    <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Delivered At</span>
                    <span class="font-semibold text-gray-800 block text-xs">
                      {{ order.deliveryStatus?.deliveredAt ? formatDateTime(order.deliveryStatus.deliveredAt) : 'Recorded' }}
                    </span>
                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                      <CheckCircle2 class="w-3 h-3 text-emerald-600" /> Handover Complete
                    </span>
                  </div>
                </div>
              </div>

              <!-- Pending Handover State -->
              <div v-else class="text-xs text-gray-600 bg-amber-50/60 rounded-xl p-3.5 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div class="space-y-0.5">
                  <div class="font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertCircle class="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Customer-Arranged Pickup</span>
                  </div>
                  <p class="text-amber-900/80 text-[11px] leading-relaxed">
                    This order is picked up via the customer's vehicle. It is not bundled into fleet trips.
                  </p>
                </div>

                <button
                  type="button"
                  @click="isHandoverModalOpen = true"
                  class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <PackageCheck class="w-4 h-4" />
                  <span>Hand Over</span>
                </button>
              </div>
            </div>

            <!-- C2. Trip & Driver Manifest Assignment (Read-Only for Our Fleet) -->
            <div v-else class="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
              <div class="flex justify-between items-center pb-2.5 border-b border-gray-100">
                <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck class="w-3.5 h-3.5 text-gray-400" />
                  Fleet Trip & Driver
                </h3>
                <span 
                  v-if="(order as any).assignedTrip?.tripNumber"
                  class="font-mono text-xs font-bold text-[#1b3b5f] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                >
                  {{ (order as any).assignedTrip.tripNumber }}
                </span>
                <span v-else class="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Not Assigned to Trip
                </span>
              </div>

              <!-- When assigned to a trip -->
              <div v-if="(order as any).assignedTrip" class="space-y-3">
                <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-xs sm:text-sm">
                  <div>
                    <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Driver</span>
                    <div class="flex items-center gap-1.5 font-bold text-gray-900">
                      <User class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{{ (order as any).assignedTrip.driverName }}</span>
                    </div>
                    <a
                      v-if="(order as any).assignedTrip.driverPhone"
                      :href="`tel:${(order as any).assignedTrip.driverPhone}`"
                      class="text-[11px] text-[#1b3b5f] font-medium hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Phone class="w-3 h-3 text-[#1b3b5f]" />
                      <span>{{ (order as any).assignedTrip.driverPhone }}</span>
                    </a>
                  </div>

                  <div>
                    <span class="block text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Vehicle / Status</span>
                    <span class="font-semibold text-gray-800 block">
                      {{ (order as any).assignedTrip.vehicleNumber || 'Standard Delivery' }}
                    </span>
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1"
                      :class="[
                        (order as any).assignedTrip.status === 'IN_TRANSIT'
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : (order as any).assignedTrip.status === 'COMPLETED'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-blue-50 text-blue-800'
                      ]"
                    >
                      Trip: {{ (order as any).assignedTrip.status }}
                    </span>
                  </div>

                  <div class="col-span-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div>
                      <span class="text-gray-500 font-medium">Manifest Sequence: </span>
                      <span class="font-bold text-gray-900">Stop #{{ (order as any).assignedTrip.stopSequence }}</span>
                      <span class="text-gray-400 mx-1.5">•</span>
                      <span class="text-gray-500 font-medium">Stop Status: </span>
                      <span 
                        class="font-bold"
                        :class="[
                          (order as any).assignedTrip.stopStatus === 'DELIVERED'
                            ? 'text-emerald-700'
                            : (order as any).assignedTrip.stopStatus === 'IN_TRANSIT'
                            ? 'text-blue-700'
                            : 'text-gray-700'
                        ]"
                      >
                        {{ (order as any).assignedTrip.stopStatus }}
                      </span>
                    </div>

                    <a
                      v-if="order.deliveryStatus?.status === 'DISPATCHED' || (order as any).assignedTrip.status === 'IN_TRANSIT'"
                      :href="`/track/${order.orderNumber}`"
                      target="_blank"
                      class="text-xs font-bold text-[#1b3b5f] hover:underline flex items-center gap-1"
                    >
                      <MapPin class="w-3.5 h-3.5" />
                      <span>Live Track ↗</span>
                    </a>
                  </div>
                </div>
              </div>

              <!-- When legacy driver assigned (before trips) -->
              <div v-else-if="order.deliveryDriver || order.deliveryStatus?.driverName" class="text-xs">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-[10px] uppercase font-bold text-gray-400 block tracking-wider mb-0.5">Assigned Driver</span>
                    <span class="font-bold text-gray-900 flex items-center gap-1.5">
                      <User class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{{ order.deliveryDriver || order.deliveryStatus?.driverName }}</span>
                    </span>
                  </div>
                  <StatusBadge v-if="order.deliveryStatus?.status" :status="order.deliveryStatus.status" />
                </div>
              </div>

              <!-- When NOT assigned to any trip yet -->
              <div v-else class="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-center justify-between gap-3">
                <p class="leading-relaxed">
                  This order has not been assigned to a delivery trip yet. Driver assignment and dispatch are managed through <strong>Fleet Trips</strong>.
                </p>
                <button
                  type="button"
                  @click="isPinModalOpen = true"
                  class="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition cursor-pointer shrink-0"
                >
                  {{ (order as any)?.hasDestinationPin ? '📍 Pin Verified' : '📍 Set Pin' }}
                </button>
              </div>
            </div>

            <!-- D. Line Items Table -->
            <div>
              <div class="flex items-center justify-between mb-2.5">
                <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package class="w-3.5 h-3.5 text-gray-400" />
                  Line Items ({{ order.items?.length || 0 }})
                </h3>
                <StatusBadge v-if="context === 'packing' && order.packingStatus?.status" :status="order.packingStatus.status" />
                <StatusBadge v-else-if="context === 'billing' && order.billingStatus?.status" :status="order.billingStatus.status" />
                <StatusBadge v-else-if="context === 'delivery' && order.deliveryStatus?.status" :status="order.deliveryStatus.status" />
              </div>
              
              <div class="border border-gray-200/80 rounded-xl bg-white shadow-2xs overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs sm:text-sm">
                    <thead class="bg-gray-50/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200/70">
                      <tr>
                        <th class="px-3.5 py-2.5 font-semibold" :class="context === 'packing' ? 'min-w-[240px]' : ''">Product</th>
                        <th v-if="context !== 'packing' && context !== 'delivery'" class="px-3 py-2.5 font-semibold text-right">Rate</th>
                        <th 
                          class="px-3 py-2.5 font-semibold" 
                          :class="context === 'packing' ? 'text-center whitespace-nowrap w-28' : 'text-right'"
                        >
                          {{ context === 'approval' && (order as any)?.isApproved ? 'Approved Qty' : (context === 'packing' ? 'Approved Qty' : 'Qty') }}
                        </th>
                        <th v-if="context !== 'packing' && context !== 'delivery'" class="px-3.5 py-2.5 font-semibold text-right">Total</th>
                        <th v-if="context === 'packing'" class="px-3 py-2.5 font-semibold text-center whitespace-nowrap w-40">Packing Qty</th>
                        <th v-if="context === 'packing'" class="px-3.5 py-2.5 font-semibold text-center whitespace-nowrap w-24">Packed</th>
                      </tr>
                    </thead>
                    <tbody ref="itemsTbodyRef" class="divide-y divide-gray-100">
                      <tr 
                        v-for="(item, idx) in order.items" 
                        :key="item.id" 
                        class="bg-white hover:bg-gray-50/60 transition-colors" 
                        :class="{ 
                          'bg-rose-50/40': context === 'packing' && packingForm.items[idx]?.isPacked && (packingForm.items[idx]?.packedQuantity || 0) === 0,
                          'bg-amber-50/30': context === 'packing' && ((packingForm.items[idx]?.packedQuantity || 0) < (item.approvedQuantity ?? item.quantity)) && (packingForm.items[idx]?.packedQuantity || 0) > 0,
                          'bg-emerald-50/20': context === 'packing' && packingForm.items[idx]?.isPacked && (packingForm.items[idx]?.packedQuantity || 0) >= (item.approvedQuantity ?? item.quantity)
                        }"
                      >
                        <td class="px-3.5 py-3">
                          <div 
                            class="font-mono font-bold text-xs sm:text-sm text-gray-900"
                            :class="context === 'packing' ? 'break-words' : 'truncate max-w-[150px] sm:max-w-[180px]'"
                          >
                            {{ item.product?.sku }}
                          </div>
                          <div 
                            class="text-[11px] sm:text-xs text-gray-600 mt-0.5 leading-snug"
                            :class="context === 'packing' ? 'break-words whitespace-normal' : 'truncate max-w-[150px] sm:max-w-[180px]'"
                          >
                            {{ item.product?.name }}
                          </div>
                          <div class="flex flex-wrap items-center gap-1 mt-1.5">
                            <span v-if="(item as any)?.isTaxInclusive && context !== 'delivery'" class="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/70" title="Tax Inclusive Rate">
                              Tax Inc.
                            </span>
                            <span v-if="(item as any)?.applyLastPrice && context !== 'delivery'" class="text-[9px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200/70" title="Apply Last Price">
                              Last Price
                            </span>
                            <div 
                              v-if="(item as any)?.itemNotes" 
                              class="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 inline-block" 
                              :class="context === 'packing' ? 'break-words' : 'truncate max-w-[180px]'"
                              :title="(item as any)?.itemNotes"
                            >
                              💬 {{ (item as any)?.itemNotes }}
                            </div>
                          </div>
                        </td>

                        <!-- Rate Column (Hidden in Packing and Delivery) -->
                        <td v-if="context !== 'packing' && context !== 'delivery'" class="px-3 py-3 text-right font-medium text-gray-600 tabular-nums whitespace-nowrap">
                          {{ formatCurrency(item.unitPrice || 0) }}
                        </td>

                        <!-- Approved Qty Column -->
                        <td 
                          class="px-3 py-3 font-bold tabular-nums whitespace-nowrap" 
                          :class="context === 'packing' ? 'text-center' : 'text-right text-gray-900'"
                        >
                          <span 
                            v-if="context === 'packing'" 
                            class="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-xs font-bold border border-gray-200/60"
                          >
                            {{ item.approvedQuantity ?? item.quantity }}
                          </span>
                          <div v-else class="flex flex-col items-end">
                            <span>{{ item.approvedQuantity ?? item.quantity }}</span>
                            <span 
                              v-if="context === 'billing' && item.packedQuantity !== undefined && item.packedQuantity !== null && item.packedQuantity !== (item.approvedQuantity ?? item.quantity) && (order.packingStatus?.status === 'PACKED' || order.packingStatus?.status === 'IN_PROGRESS' || Number(item.packedQuantity) > 0)" 
                              class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 mt-1"
                              title="Packed quantity differs from approved quantity due to stock availability"
                            >
                              Packed: {{ item.packedQuantity }}
                              <span v-if="item.packedQuantity < (item.approvedQuantity ?? item.quantity)" class="text-amber-600">
                                (-{{ (item.approvedQuantity ?? item.quantity) - item.packedQuantity }})
                              </span>
                            </span>
                          </div>
                        </td>

                        <!-- Total Column (Hidden in Packing and Delivery) -->
                        <td v-if="context !== 'packing' && context !== 'delivery'" class="px-3.5 py-3 text-right font-bold text-[#1b3b5f] tabular-nums whitespace-nowrap">
                          {{ formatCurrency(getItemTotal(item)) }}
                        </td>

                        <!-- Packing Qty with - and + buttons (Shown only in Packing) -->
                        <td v-if="context === 'packing'" class="px-3 py-3 text-center whitespace-nowrap">
                          <div class="inline-flex flex-col items-center">
                            <div class="inline-flex items-center justify-center gap-1 bg-gray-50 border border-gray-200/80 rounded-lg p-0.5 shadow-2xs">
                              <button 
                                type="button"
                                @click.stop="decrementPackedQty(idx)" 
                                :disabled="!hasRole('ADMIN', 'PACKING') || (packingForm.items[idx]?.packedQuantity || 0) <= 0"
                                class="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-sm select-none cursor-pointer shadow-2xs"
                                title="Decrease packed quantity"
                              >
                                -
                              </button>
                              <input 
                                type="number" 
                                min="0"
                                :max="item.approvedQuantity ?? item.quantity"
                                v-model.number="packingForm.items[idx].packedQuantity" 
                                @change="handlePackedQtyInput(idx)" 
                                class="w-12 h-7 px-1 text-xs sm:text-sm font-bold text-center bg-transparent border-0 text-gray-900 focus:outline-none focus:ring-0 tabular-nums" 
                                :disabled="!hasRole('ADMIN', 'PACKING')"
                              />
                              <button 
                                type="button"
                                @click.stop="incrementPackedQty(idx)" 
                                :disabled="!hasRole('ADMIN', 'PACKING') || (packingForm.items[idx]?.packedQuantity || 0) >= (item.approvedQuantity ?? item.quantity)"
                                class="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-sm select-none cursor-pointer shadow-2xs"
                                title="Increase packed quantity"
                              >
                                +
                              </button>
                            </div>
                            <span 
                              v-if="packingForm.items[idx]?.isPacked && (packingForm.items[idx]?.packedQuantity || 0) === 0" 
                              class="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-1 whitespace-nowrap"
                            >
                              Out of Stock (0 packed)
                            </span>
                            <span 
                              v-else-if="(packingForm.items[idx]?.packedQuantity || 0) < (item.approvedQuantity ?? item.quantity) && (packingForm.items[idx]?.packedQuantity || 0) > 0" 
                              class="text-[10px] font-bold text-amber-600 mt-1 whitespace-nowrap"
                            >
                              -{{ (item.approvedQuantity ?? item.quantity) - (packingForm.items[idx]?.packedQuantity || 0) }} short
                            </span>
                          </div>
                        </td>

                        <!-- Packed Checkbox Column (Shown only in Packing) -->
                        <td v-if="context === 'packing'" class="px-3.5 py-3 text-center whitespace-nowrap">
                          <label class="inline-flex items-center justify-center cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              :checked="packingForm.items[idx]?.isPacked"
                              @change="handlePackingCheckboxToggle(idx, $event)"
                              class="w-5 h-5 rounded text-[#1b3b5f] border-gray-300 focus:ring-[#1b3b5f] focus:ring-offset-0 transition-all cursor-pointer accent-[#1b3b5f]"
                              :disabled="!hasRole('ADMIN', 'PACKING')"
                              title="Check to mark item as packed"
                            />
                          </label>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Action Area: Approval -->
                <div 
                  v-if="context === 'approval'" 
                  class="p-4 bg-amber-50/50 border-t border-amber-200/60 rounded-b-lg relative"
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full" :class="order.isApproved ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'"></span>
                        <p class="text-sm font-bold text-gray-900">
                          {{ order.isApproved ? 'Order Approved' : 'Approval Required' }}
                        </p>
                      </div>
                      <p class="text-xs text-gray-500 mt-0.5">
                        {{ order.isApproved 
                          ? `Approved by ${(order as any).approvedBy?.name || 'Administrator'} on ${formatDateTime((order as any).approvedAt || order.updatedAt)}` 
                          : 'Inspect line items, verify agreed rates, and authorize before dispatch.' 
                        }}
                      </p>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <button 
                        v-if="canCancelOrder"
                        @click="openCancelModal"
                        class="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Ban class="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>

                      <button 
                        v-if="!order.isApproved && order.overallStatus !== 'CANCELLED'"
                        @click="emit('reviewApprove', order)"
                        class="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1b3b5f] hover:bg-[#132c49] rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCheck class="w-4 h-4" />
                        <span>Review & Approve</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Action Area: Billing -->
                <div v-if="context === 'billing'" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Billing Action</p>
                      <p class="text-xs text-gray-500 mt-1" v-if="order.billingStatus?.invoiceNumber">
                        Invoice: <span class="font-mono text-gray-900">{{ order.billingStatus.invoiceNumber }}</span>
                      </p>
                    </div>
                    
                    <div class="flex items-center gap-2" v-if="hasRole('ADMIN', 'BILLING')">
                      <button 
                        v-if="order.billingStatus?.status !== 'GENERATED'"
                        @click="markBillGenerated" 
                        class="px-3 py-1.5 text-xs font-medium bg-[#1b3b5f] text-white rounded hover:bg-[#1b3b5f]/90 shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <IndianRupee class="w-3.5 h-3.5" /> Mark as Generated
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Action Area: Packing -->
                <div v-if="context === 'packing' && hasRole('ADMIN', 'PACKING')" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-bold text-gray-900">Packing Progress</p>
                      <p class="text-xs text-gray-500 mt-1">
                        {{ packingForm.items.filter(i => i.isPacked).length }} of {{ packingForm.items.length }} items packed
                      </p>
                    </div>
                    
                    <div class="flex items-center gap-2">
                      <button 
                        @click="markAsPacked" 
                        :disabled="packingForm.status === 'PACKED'"
                        class="px-4 py-2 text-xs font-semibold bg-[#1b3b5f] text-white rounded-md transition-all shadow-sm hover:bg-[#132c49] active:scale-95 disabled:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400 cursor-pointer"
                      >
                        {{ packingForm.status === 'PACKED' ? '✓ All Items Packed' : 'Pack All Items' }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Action Area: Delivery (Read-Only Pin & Tracking) -->
                <div v-if="context === 'delivery'" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <!-- Party Vehicle Handover Actions -->
                  <template v-if="order.vehicleMode === 'PARTY_VEHICLE'">
                    <span 
                      v-if="order.deliveryStatus?.status === 'DELIVERED'"
                      class="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1.5"
                    >
                      <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                      <span>Handed Over to Party Vehicle</span>
                    </span>
                    <button 
                      v-else-if="order.overallStatus !== 'CANCELLED'"
                      @click="isHandoverModalOpen = true"
                      class="px-4 py-2 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <PackageCheck class="w-3.5 h-3.5 text-white" />
                      <span>Hand Over to Party Vehicle</span>
                    </button>
                  </template>

                  <!-- Fleet Multi-Stop Route & GPS Tracking -->
                  <template v-else>
                    <div class="flex items-center gap-2">
                      <button 
                        v-if="(order as any)?.hasDestinationPin || (order as any)?.destinationCoords"
                        @click="isPinModalOpen = true"
                        class="px-3.5 py-2 text-xs font-semibold border border-[#1b3b5f]/30 text-[#1b3b5f] bg-[#1b3b5f]/5 hover:bg-[#1b3b5f]/10 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <MapPin class="w-3.5 h-3.5 text-[#1b3b5f]" /> Change Destination Pin
                      </button>
                      <button 
                        v-else
                        @click="isPinModalOpen = true"
                        class="px-3.5 py-2 text-xs font-bold border border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition animate-pulse cursor-pointer"
                      >
                        <MapPin class="w-3.5 h-3.5 text-amber-600" /> Set Destination Pin
                      </button>
                    </div>

                    <a 
                      v-if="order.deliveryStatus?.status === 'DISPATCHED' || (order as any)?.assignedTrip?.status === 'IN_TRANSIT'"
                      :href="`/track/${order.orderNumber}`"
                      target="_blank"
                      class="px-4 py-2 text-xs font-bold bg-[#1b3b5f] text-white rounded-lg hover:bg-[#132c49] shadow-sm flex items-center justify-center gap-1.5 transition"
                    >
                      <MapPin class="w-3.5 h-3.5 text-white" />
                      <span>Track Live GPS ↗</span>
                    </a>
                  </template>
                </div>

              </div>
            </div>

          </div>
          <!-- END DETAILS TAB -->

          <!-- TIMELINE TAB -->
          <div v-else-if="activeTab === 'TIMELINE'" class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock class="w-3.5 h-3.5 text-gray-400" />
                Order Activity Log
              </h3>
              <span class="text-xs text-gray-400 font-medium">{{ order.timeline?.length || 0 }} entries</span>
            </div>

            <div v-if="order.timeline && order.timeline.length > 0" class="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              <div v-for="t in order.timeline" :key="t.id" class="relative group">
                <span class="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#1b3b5f] ring-4 ring-white shadow-2xs"></span>
                <div class="bg-gray-50/70 hover:bg-gray-50 rounded-xl p-3 border border-gray-100 transition-colors">
                  <p class="text-xs sm:text-sm font-semibold text-gray-900">{{ t.action }}</p>
                  <p v-if="t.description" class="text-xs text-gray-600 mt-1 leading-relaxed">{{ t.description }}</p>
                  <div class="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                    <span class="flex items-center gap-1">
                      <Clock class="w-3 h-3 text-gray-400" />
                      {{ formatDateTime(t.timestamp) }}
                    </span>
                    <span v-if="t.performedBy" class="text-gray-500 font-medium">&bull; {{ t.performedBy.name }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div v-else class="text-center py-12 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <Clock class="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p class="text-xs font-medium text-gray-500">No activity recorded for this order yet.</p>
            </div>
          </div>

          <!-- NOTES TAB -->
          <div v-else-if="activeTab === 'NOTES'" class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText class="w-3.5 h-3.5 text-gray-400" />
                Internal Notes
              </h3>
              <button 
                v-if="canEditOrders" 
                @click="openEditModal" 
                class="text-xs font-semibold text-[#1b3b5f] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit class="w-3 h-3" /> Edit Notes
              </button>
            </div>

            <div v-if="order.notes" class="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4 text-amber-950 text-xs sm:text-sm leading-relaxed shadow-2xs">
              <div class="flex items-start gap-2.5">
                <FileText class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div class="whitespace-pre-line">{{ order.notes }}</div>
              </div>
            </div>

            <div v-else class="text-center py-12 px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <FileText class="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p class="text-xs font-medium text-gray-500">No internal notes for this order.</p>
              <button 
                v-if="canEditOrders" 
                @click="openEditModal" 
                class="mt-3 text-xs font-semibold text-[#1b3b5f] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Edit class="w-3 h-3" /> Add Internal Note
              </button>
            </div>
          </div>

        </div>

        <!-- 5. Sticky Bottom Action Footer (Responsive Multi-Line on Mobile, Never Crops Buttons) -->
        <div 
          v-if="order"
          class="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-white border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-lg z-20"
        >
          <div class="flex items-center justify-between sm:block">
            <template v-if="context !== 'delivery'">
              <span class="text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider block">Grand Total</span>
              <span class="text-base sm:text-xl font-black text-[#1b3b5f] tracking-tight tabular-nums">
                {{ formatCurrency(order.totalAmount || 0) }}
              </span>
            </template>
            <template v-else>
              <span class="text-[10px] sm:text-[11px] uppercase font-bold text-gray-400 tracking-wider block">Total Quantity</span>
              <span class="text-base sm:text-xl font-black text-[#1b3b5f] tracking-tight tabular-nums">
                {{ order.items?.reduce((sum, i) => sum + (Number(i.approvedQuantity ?? i.quantity) || 0), 0) }} nos.
              </span>
            </template>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <!-- Edit Status across departments -->
            <button 
              v-if="canEditOrderStatus"
              @click="openAdminStatusModal"
              title="Edit status across all departments"
              class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <SlidersHorizontal class="w-3.5 h-3.5" />
              <span>Edit Status</span>
            </button>

            <!-- Split Order button (Strictly Billing context only) -->
            <button 
              v-if="context === 'billing' && hasRole('ADMIN', 'BILLING') && order.billingStatus?.status !== 'GENERATED' && order.overallStatus !== 'CANCELLED' && order.deliveryStatus?.status !== 'DISPATCHED' && order.deliveryStatus?.status !== 'DELIVERED'"
              @click="emit('split-order', order.id)"
              class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <GitFork class="w-3.5 h-3.5 text-[#1b3b5f]" />
              <span>Split Order</span>
            </button>

            <!-- Generate Bill button (Strictly Billing context only) -->
            <button 
              v-if="context === 'billing' && canGenerateBill"
              @click="markBillGenerated"
              class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white bg-[#1b3b5f] hover:bg-[#132c49] rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <IndianRupee class="w-3.5 h-3.5" />
              <span>Generate Bill</span>
            </button>
            <div 
              v-else-if="context === 'billing' && order.billingStatus?.status === 'GENERATED'"
              class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"
            >
              <CheckCircle2 class="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600" />
              <span>Bill Generated</span>
            </div>

            <button 
              v-if="canCancelOrder"
              @click="openCancelModal"
              class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <Ban class="w-3.5 h-3.5" />
              <span>Cancel Order</span>
            </button>

            <!-- Approval desk actions only -->
            <template v-if="context === 'approval'">
              <button 
                v-if="!order.isApproved && order.overallStatus !== 'CANCELLED'"
                @click="emit('reviewApprove', order)"
                class="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white bg-[#1b3b5f] hover:bg-[#132c49] rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck class="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span>Review & Approve</span>
              </button>

              <div 
                v-else-if="order.isApproved" 
                class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <CheckCircle2 class="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600" />
                <span>Approved</span>
              </div>
            </template>
          </div>
        </div>
      </template>
      
      <!-- Skeleton State (Shown during initial fetch) -->
      <template v-else-if="isLoading">
        <div class="h-full flex flex-col w-full relative">
          <!-- Loading Overlay (Visible against the skeleton) -->
          <div class="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-50 pointer-events-auto animate-pulse transition-all duration-300"></div>
          
          <!-- Header Skeleton -->
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="h-6 w-32 bg-gray-200 rounded"></div>
              <div class="h-5 w-20 bg-gray-200 rounded-full"></div>
            </div>
            <div class="h-6 w-6 bg-gray-200 rounded"></div>
          </div>

          <!-- Tabs Skeleton -->
          <div class="border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div class="flex gap-6 px-6 pt-2">
              <div class="h-8 w-16 bg-gray-200 border-b-2 border-transparent"></div>
              <div class="h-8 w-20 bg-gray-200 border-b-2 border-transparent"></div>
            </div>
          </div>

          <!-- Body Skeleton -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
            <div class="space-y-4">
              <div class="h-4 bg-gray-200 rounded w-1/4"></div>
              <div class="h-4 bg-gray-200 rounded w-1/2"></div>
              <div class="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
            
            <div class="space-y-4 pt-4 border-t border-gray-100">
              <div class="h-4 bg-gray-200 rounded w-1/5"></div>
              <div class="h-4 bg-gray-200 rounded w-3/4"></div>
              <div class="h-4 bg-gray-200 rounded w-2/3"></div>
              <div class="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            
            <div class="space-y-4 pt-4 border-t border-gray-100">
              <div v-for="i in 3" :key="i" class="flex gap-4">
                <div class="h-4 bg-gray-200 rounded w-full"></div>
                <div class="h-4 bg-gray-200 rounded w-24"></div>
                <div class="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
  </Teleport>

  <!-- Edit Order Modal -->
  <Teleport to="body">
    <div v-if="isEditModalOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[220] flex items-center justify-center p-2 sm:p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isEditModalOpen = false; hide()"></div>
      
      <div class="relative bg-[#faf8f5] w-full max-w-4xl rounded-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-4.5rem)] md:max-h-[92vh] overflow-hidden transform transition-all border border-gray-200">
        <div class="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <h2 class="text-base sm:text-lg font-bold text-gray-900 truncate">Edit Order: {{ order?.orderNumber }}</h2>
          <div class="flex items-center gap-3">
            <label class="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer select-none transition-all shadow-xs"
              :class="editForm.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            >
              <input type="checkbox" v-model="editForm.isUrgent" class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" />
              <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
                <Zap class="w-4 h-4 text-rose-600 fill-rose-600" />
                <span>Mark as Urgent Order</span>
              </div>
            </label>
            <button @click="isEditModalOpen = false; hide()" class="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <!-- Mobile Urgent Toggle (visible only on small screens) -->
        <div class="sm:hidden px-3.5 pt-3.5 pb-0 bg-[#faf8f5]">
          <label class="flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer select-none transition-all shadow-xs w-full"
            :class="editForm.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-700'"
          >
            <input type="checkbox" v-model="editForm.isUrgent" class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" />
            <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
              <Zap class="w-4 h-4 text-rose-600 fill-rose-600" />
              <span>Mark as Urgent Order</span>
            </div>
          </label>
        </div>

        <div class="relative p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
          <template v-if="isEditLoading">
            <!-- Section 1 Sleek Skeleton -->
            <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-pulse">
              <div class="h-5 bg-gray-200 rounded w-32"></div>
              <div class="space-y-4 pt-2">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div class="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
            
            <!-- Section 2 Sleek Skeleton -->
            <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-pulse">
              <div class="flex items-center justify-between">
                <div class="h-5 bg-gray-200 rounded w-32"></div>
                <div class="h-5 bg-gray-200 rounded w-24"></div>
              </div>
              <div class="space-y-3 pt-2">
                <div v-for="i in 2" :key="i" class="h-16 bg-gray-100 rounded-lg w-full"></div>
              </div>
            </div>
          </template>

          <template v-else>
            <!-- Section 1: Order Info -->
            <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 class="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Order Info</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Order Number</label>
                  <input v-model="editForm.orderNumber" required class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" />
                </div>
                <div>
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Placed By</label>
                  <input :value="order?.salesPerson?.name || 'Unknown'" disabled class="w-full text-sm border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Customer</label>
                  <CustomSelect 
                    :modelValue="editForm.customerId"
                    @update:modelValue="val => { editForm.customerId = val; onEditCustomerChange() }"
                    :options="customerOptions"
                    searchable
                    searchPlaceholder="Search customer..."
                    placeholder="Select Customer"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Terms</label>
                  <CustomSelect 
                    :modelValue="editForm.paymentTerms"
                    @update:modelValue="val => editForm.paymentTerms = val"
                    :options="paymentTermsOptions"
                    placeholder="Select Terms"
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transport Mode</label>
                  <CustomSelect 
                    :modelValue="editForm.vehicleMode"
                    @update:modelValue="val => editForm.vehicleMode = val"
                    :options="[
                      { label: '🚚 Our Delivery Fleet', value: 'OUR_FLEET' },
                      { label: '🚗 Party Vehicle / Customer Pickup', value: 'PARTY_VEHICLE' }
                    ]"
                    placeholder="Select Transport Mode"
                    class="w-full"
                  />
                </div>
                <div class="col-span-1 sm:col-span-2">
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Delivery Address</label>
                  <textarea v-model="editForm.deliveryAddress" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"></textarea>
                </div>
                <div class="col-span-1 sm:col-span-2">
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Internal Notes</label>
                  <textarea v-model="editForm.notes" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"></textarea>
                </div>
              </div>
            </div>

            <!-- Section 2: Items -->
            <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div class="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 class="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items ({{ editForm.items.length }})</h3>
                <button type="button" @click="addEditItem" class="text-xs font-bold text-[#1b3b5f] flex items-center gap-1 hover:underline">
                  <Plus class="w-3.5 h-3.5" /> Add Product
                </button>
              </div>
              
              <div class="space-y-4">
                <div v-for="(item, idx) in editForm.items" :key="idx" class="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div class="flex flex-wrap md:flex-nowrap gap-4 items-end">
                    <!-- Product Select -->
                    <div class="flex-1 w-full min-w-0">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Product *</label>
                      <CustomSelect 
                        :modelValue="item.productId"
                        @update:modelValue="val => { item.productId = val; onEditProductChange(idx) }"
                        :options="productOptions"
                        searchable
                        searchPlaceholder="Search product by SKU or name..."
                        placeholder="Select Product"
                        class="w-full"
                      />
                    </div>

                    <!-- Qty -->
                    <div class="w-full md:w-24 shrink-0">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Qty *</label>
                      <input type="number" v-model.number="item.quantity" min="1" required class="w-full border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" />
                    </div>

                    <!-- Unit Price -->
                    <div class="w-full md:w-28 shrink-0">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                        <IndianRupee class="w-3 h-3 text-gray-500" />
                        <span>Rate *</span>
                      </label>
                      <div class="relative flex items-center">
                        <IndianRupee class="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input type="number" v-model.number="item.unitPrice" min="0" step="0.01" required class="w-full pl-7 border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" />
                      </div>
                    </div>

                    <!-- Line Total -->
                    <div class="w-full md:w-28 shrink-0">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Subtotal</label>
                      <div class="p-2 bg-white text-gray-900 rounded-lg font-bold text-sm border border-gray-200">
                        {{ formatCurrency(item.quantity * item.unitPrice) }}
                      </div>
                    </div>

                    <!-- Remove -->
                    <button type="button" @click="removeEditItem(idx)" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0 transition-colors" title="Remove Item">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Item-Level Options & Notes -->
                  <div class="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200/60 text-xs">
                    <!-- Tax Inclusive Toggle -->
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" v-model="item.isTaxInclusive" class="w-3.5 h-3.5 rounded text-[#1b3b5f] focus:ring-[#1b3b5f]" />
                      <span class="text-gray-700 font-medium">Tax Inclusive Rate</span>
                    </label>

                    <!-- Apply Last Price Checkbox -->
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" v-model="item.applyLastPrice" class="w-3.5 h-3.5 rounded text-[#1b3b5f] focus:ring-[#1b3b5f]" />
                      <span class="text-gray-700 font-medium">Apply Last Price</span>
                    </label>

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
                <div v-if="!editForm.items.length" class="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  No items added.
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Sticky Footer with Save & Total -->
        <div class="px-4 py-3 sm:px-6 sm:py-4 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
          <button 
            type="button" 
            @click="cancelEdit" 
            class="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
          >
            Cancel
          </button>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <span class="text-xs text-gray-500 hidden sm:inline">Total: </span>
              <span class="font-bold text-[#1b3b5f] text-sm sm:text-base">{{ formatCurrency(editOrderTotal) }}</span>
            </div>
            <button 
              type="button" 
              @click="saveEdit" 
              class="px-5 py-2 text-xs sm:text-sm font-bold bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Set Customer Delivery Pin Modal -->
    <SetDeliveryPinModal
      :isOpen="isPinModalOpen"
      :customerId="order?.customerId || order?.customer?.id"
      :customerName="order?.customer?.name || 'Customer'"
      :customerCompany="order?.customer?.company"
      :deliveryAddress="order?.deliveryAddress"
      :initialLat="order?.destinationCoords?.lat || order?.customer?.latitude"
      :initialLng="order?.destinationCoords?.lng || order?.customer?.longitude"
      :initialLandmark="order?.destinationCoords?.landmark || order?.customer?.landmark"
      @close="isPinModalOpen = false"
      @saved="(pin) => {
        if (order) {
          order.destinationCoords = pin
          order.hasDestinationPin = !!pin
          if (order.customer) {
            order.customer.latitude = pin ? pin.lat : null
            order.customer.longitude = pin ? pin.lng : null
            order.customer.landmark = pin ? pin.landmark : null
          }
        }
        if (pin) {
          showSaved('Customer delivery pin saved!')
        } else {
          showSaved('Customer delivery pin removed!')
        }
        if (order) {
          notifyChange({ orderId: order.id, action: 'PIN_CHANGED' })
        }
        emit('updated')
      }"
    />

    <!-- Party Vehicle Handover Modal -->
    <PartyVehicleHandoverModal
      :isOpen="isHandoverModalOpen"
      :order="order"
      @close="isHandoverModalOpen = false"
      @handedOver="() => {
        if (order?.id) fetchOrder(order.id);
        emit('updated');
      }"
    />
  </Teleport>
</template>
