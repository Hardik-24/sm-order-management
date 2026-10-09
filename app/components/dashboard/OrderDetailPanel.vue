<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, MoreHorizontal, Lock, Edit, Package, Receipt, PackageCheck, Truck, Check, Box, Plus, Trash2, MapPin, AlertCircle, Ban, CheckCheck } from 'lucide-vue-next'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import GenerateBillModal from '~/components/dashboard/GenerateBillModal.vue'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { formatCurrency, formatDateTime, formatDate, formatTime, getDisplayStatus, getOverallColor, getStatusColor } from '~~/app/lib/utils'
import type { Order } from '~/types'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const isPinModalOpen = ref(false)

const { showEditing, showSaving, showSaved, hide } = useSnackbar()
const { notifyChange, onOrderSync } = useRealtimeSync()
const { animateStagger } = useGsapAnimation()
const itemsTbodyRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  orderId: string | null
  isOpen: boolean
  context?: 'billing' | 'packing' | 'delivery' | 'overview'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', updatedOrder?: any): void
}>()

const { user, hasRole } = useAuth()
const order = ref<Order | null>(null)
const isLoading = ref(false)
const activeTab = ref<'DETAILS' | 'TIMELINE' | 'NOTES'>('DETAILS')

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

const showDeliveryForm = ref(false)
const deliveryForm = ref({ status: '', driverName: '', dispatchDate: '', eta: '', holdReason: '' })

watch(() => props.orderId, async (newId) => {
  if (newId && props.isOpen) {
    await fetchOrder(newId)
    fetchDrivers()
  }
})

watch(() => props.isOpen, async (open) => {
  if (open && props.orderId) {
    await fetchOrder(props.orderId)
    fetchDrivers()
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
        const packedQty = i.packedQuantity !== undefined && i.packedQuantity !== null ? i.packedQuantity : approvedQty
        return {
          id: i.id,
          packedQuantity: packedQty,
          isPacked: packedQty >= approvedQty,
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
      items: order.value.items?.map(i => ({ 
        id: i.id, 
        isPacked: i.packedQuantity === i.quantity,
        quantity: i.quantity 
      })) || [],
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

const deliveryStatusOptions = [
  { label: 'WAITING', value: 'WAITING' },
  { label: 'ASSIGNED', value: 'ASSIGNED' },
  { label: 'DISPATCHED', value: 'DISPATCHED' },
  { label: 'DELIVERED', value: 'DELIVERED' },
  { label: 'ON HOLD', value: 'ON_HOLD' }
]


const driversList = ref<any[]>([])
const driverOptions = computed(() => [
  { label: '-- Unassigned (Select Driver) --', value: '' },
  ...(driversList.value || []).map(d => ({ label: `${d.name} (${d.role})`, value: d.name }))
])

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

const fetchDrivers = async () => {
  if (driversList.value.length) return
  try {
    const data = await $fetch<any[]>('/api/drivers')
    driversList.value = data
  } catch (e) {
    console.error('Failed to fetch drivers:', e)
  }
}

const initDeliveryForm = async () => {
  showDeliveryForm.value = !showDeliveryForm.value
  if (!showDeliveryForm.value) {
    hide()
    return
  }
  await fetchDrivers()
  if (order.value) {
    deliveryForm.value = {
      status: order.value.deliveryStatus?.status || 'WAITING',
      driverName: order.value.deliveryDriver || order.value.deliveryStatus?.driverName || '',
      dispatchDate: order.value.dispatchDate ? new Date(order.value.dispatchDate).toISOString().split('T')[0] : '',
      eta: order.value.eta ? new Date(order.value.eta).toISOString().split('T')[0] : '',
      holdReason: order.value.deliveryStatus?.holdReason || ''
    }
    showEditing()
  }
}

const closePanel = () => {
  hide()
  showBillingForm.value = false
  showDeliveryForm.value = false
  emit('close')
}

watch(billingForm, () => { if (showBillingForm.value) showEditing() }, { deep: true })
watch(deliveryForm, () => { if (showDeliveryForm.value) showEditing() }, { deep: true })

watch(() => deliveryForm.value.driverName, (newVal) => {
  if (newVal && deliveryForm.value.status === 'WAITING') {
    deliveryForm.value.status = 'ASSIGNED'
  } else if (!newVal && deliveryForm.value.status === 'ASSIGNED') {
    deliveryForm.value.status = 'WAITING'
  }
})


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

const handlePackedQtyChange = async (idx: number) => {
  const item = packingForm.value.items[idx]
  if (!item) return
  const approvedQty = Number(item.quantity || 0)
  const currentPacked = Number(item.packedQuantity || 0)
  item.isPacked = currentPacked >= approvedQty

  const anyPacked = packingForm.value.items.some(i => (i.packedQuantity || 0) > 0)
  const allFull = packingForm.value.items.every(i => (i.packedQuantity || 0) >= (i.quantity || 0))

  if (allFull) {
    packingForm.value.status = 'PACKED'
  } else if (anyPacked) {
    packingForm.value.status = 'IN_PROGRESS'
  } else {
    packingForm.value.status = 'PENDING'
  }

  await updatePacking()
}

const handlePackingChange = async (idx: number, event: Event) => {
  const isChecked = (event.target as HTMLInputElement).checked
  packingForm.value.items[idx].isPacked = isChecked
  packingForm.value.items[idx].packedQuantity = isChecked ? packingForm.value.items[idx].quantity : 0
  
  const anyPacked = packingForm.value.items.some(i => i.isPacked)
  const allFull = packingForm.value.items.every(i => i.isPacked)
  
  if (allFull) {
    packingForm.value.status = 'PACKED'
  } else if (anyPacked) {
    packingForm.value.status = 'IN_PROGRESS'
  } else {
    packingForm.value.status = 'PENDING'
  }
  
  await updatePacking()
}

const markAsPacked = async () => {
  packingForm.value.status = 'PACKED'
  packingForm.value.items.forEach(i => {
    i.isPacked = true
    i.packedQuantity = i.quantity
  })
  await updatePacking()
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


const updateDelivery = async () => {
  if (!order.value) return
  showSaving()
  try {
    if (deliveryForm.value.driverName && deliveryForm.value.status === 'WAITING') {
      deliveryForm.value.status = 'ASSIGNED'
    } else if (!deliveryForm.value.driverName && deliveryForm.value.status === 'ASSIGNED') {
      deliveryForm.value.status = 'WAITING'
    }

    // Optimistic UI update (0ms local response)
    if (order.value) {
      if (!order.value.deliveryStatus) order.value.deliveryStatus = {} as any
      order.value.deliveryStatus.driverName = deliveryForm.value.driverName || null
      order.value.deliveryStatus.status = deliveryForm.value.status as any
      order.value.deliveryDriver = deliveryForm.value.driverName || null
    }

    await $fetch(`/api/orders/${order.value.id}/delivery`, {
      method: 'PATCH',
      body: deliveryForm.value
    })

    showDeliveryForm.value = false
    showSaved('Delivery updated successfully')
    notifyChange({
      orderId: order.value.id,
      action: 'DELIVERY_UPDATED',
      status: deliveryForm.value.status,
      driverName: deliveryForm.value.driverName
    })
    emit('updated')
    await fetchOrder(order.value.id)
  } catch (err) {
    console.error(err)
    hide()
  }
}
</script>



<template>
  <GenerateBillModal 
    :isOpen="isGenerateModalOpen"
    :orderId="order?.id || null"
    @close="isGenerateModalOpen = false"
    @generated="handleBillGenerated"
  />


  <!-- Mandatory Order Cancellation Modal -->
  <Teleport to="body">
    <div v-if="isCancelModalOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
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

  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
      <div class="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto transition-opacity" @click="closePanel"></div>
      
      <div class="absolute inset-y-0 right-0 max-w-full sm:max-w-[450px] w-full bg-white shadow-2xl pointer-events-auto flex flex-col h-full overflow-hidden transform transition-transform duration-300">
      
      <template v-if="order">
        <!-- Loading Overlay -->
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 pointer-events-auto animate-pulse transition-all duration-300"></div>

        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg font-bold text-gray-900">{{ order.orderNumber }}</h2>
              <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700 border border-rose-500 uppercase tracking-wider">
                🚫 CANCELLED
              </span>
              <StatusBadge 
                :status="order.overallStatus" 
                :display="getDisplayStatus(order)" 
                :class="getOverallColor(order)" 
              />
              <span v-if="order.isUrgent && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 uppercase tracking-wider">
                <Zap class="w-3 h-3 text-rose-600" />
                Urgent
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                v-if="order.overallStatus !== 'CANCELLED' && order.overallStatus !== 'DELIVERED' && hasRole('ADMIN', 'SALES')"
                @click="openCancelModal" 
                title="Cancel Order (Mandatory Reason Required)"
                class="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1"
              >
                <Ban class="w-3.5 h-3.5" /> Cancel
              </button>
              <button 
                v-if="hasRole('ADMIN')"
                @click="deleteOrder" 
                :disabled="isDeleting"
                title="Delete Order (Admin Only)"
                class="p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 class="w-5 h-5" />
              </button>
              <button @click="closePanel" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 ml-1">
                <X class="w-5 h-5" />
              </button>
            </div>
        </div>

        <!-- Sub-header -->
        <div class="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div class="flex justify-between items-end">
            <div>
              <p class="text-sm font-medium text-gray-900">{{ order.customer?.name }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ order.items?.length || 0 }} items</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-[#1a5c4c]">{{ formatCurrency(order.totalAmount || 0) }}</p>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 border-b border-gray-200 flex gap-6 text-sm font-medium text-gray-500 flex-shrink-0">
          <button 
            v-for="tab in ['DETAILS', 'TIMELINE', 'NOTES']" 
            :key="tab"
            @click="activeTab = tab as any"
            :class="[
              'py-3 border-b-2 transition-colors',
              activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-grow overflow-y-auto bg-white p-6 pb-40">
          
          <!-- DETAILS TAB -->
          <div v-if="activeTab === 'DETAILS'" class="space-y-8 flex flex-col">
            
            <!-- 1. Order Information Grid -->
            <div>
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Information</h3>
                <button v-if="hasRole('ADMIN', 'SALES')" @click="openEditModal" class="text-xs font-medium text-[#1a5c4c] flex items-center gap-1 hover:underline">
                  <Edit class="w-3 h-3" /> Edit
                </button>
              </div>
              <div class="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Customer</span>
                  <span class="font-medium text-gray-900">{{ order.customer?.name || '—' }}</span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Phone</span>
                  <span class="text-gray-900">{{ order.customer?.phone || '—' }}</span>
                </div>
                <div class="col-span-2">
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Delivery Address</span>
                  <span class="text-gray-900">{{ order.deliveryAddress || '—' }}</span>
                </div>
              </div>
            </div>

            <!-- 2. Order Items and Context-Aware Action Area -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Items</h3>
                <StatusBadge v-if="context === 'packing' && order.packingStatus?.status" :status="order.packingStatus.status" />
                <StatusBadge v-else-if="context === 'billing' && order.billingStatus?.status" :status="order.billingStatus.status" />
                <StatusBadge v-else-if="context === 'delivery' && order.deliveryStatus?.status" :status="order.deliveryStatus.status" />
              </div>
              
              <div class="border border-gray-200 rounded-lg bg-white">
                <div class="overflow-x-auto rounded-t-lg">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th class="px-4 py-2 font-medium">Product</th>
                        <th class="px-4 py-2 font-medium text-right">{{ (order as any)?.isApproved ? 'Approved Qty' : 'Qty' }}</th>
                        <th v-if="context === 'packing'" class="px-4 py-2 font-medium text-center">Packed Qty</th>
                      </tr>
                    </thead>
                    <tbody ref="itemsTbodyRef" class="divide-y divide-gray-200">
                      <tr v-for="(item, idx) in order.items" :key="item.id" class="bg-white transition-colors" :class="{ 'bg-amber-50/30': context === 'packing' && ((packingForm.items[idx]?.packedQuantity || 0) < (item.approvedQuantity ?? item.quantity)) }">
                        <td class="px-4 py-3">
                          <div class="font-medium truncate max-w-[150px] text-gray-900">
                            {{ item.product?.sku }}
                          </div>
                          <div class="text-xs text-gray-400 truncate max-w-[150px]">{{ item.product?.name }}</div>
                          <div class="flex flex-wrap items-center gap-1 mt-1.5">
                            <span v-if="(item as any)?.isTaxInclusive" class="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200" title="Tax Inclusive Rate">
                              Tax Inc.
                            </span>
                            <span v-if="(item as any)?.applyLastPrice" class="text-[9px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200" title="Apply Last Price">
                              Last Price
                            </span>
                            <div v-if="(item as any)?.itemNotes" class="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block truncate max-w-[200px]" :title="(item as any)?.itemNotes">
                              💬 {{ (item as any)?.itemNotes }}
                            </div>
                          </div>
                        </td>
                        <td class="px-4 py-3 text-right font-bold text-gray-900">{{ item.approvedQuantity ?? item.quantity }}</td>
                        <td v-if="context === 'packing'" class="px-4 py-3 text-center">
                          <div class="flex items-center justify-center gap-2">
                            <input 
                              type="number" 
                              min="0"
                              :max="item.approvedQuantity ?? item.quantity"
                              v-model.number="packingForm.items[idx].packedQuantity" 
                              @change="handlePackedQtyChange(idx)" 
                              class="w-16 px-2 py-1 text-xs border border-gray-300 rounded font-bold text-center focus:ring-[#1a5c4c]" 
                              :disabled="!hasRole('ADMIN', 'PACKING')"
                            />
                            <span 
                              v-if="(packingForm.items[idx]?.packedQuantity || 0) < (item.approvedQuantity ?? item.quantity)" 
                              class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap"
                              title="Shortage alert"
                            >
                              -{{ (item.approvedQuantity ?? item.quantity) - (packingForm.items[idx]?.packedQuantity || 0) }}
                            </span>
                            <span 
                              v-else 
                              class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-green-100 text-green-700 border border-green-200"
                            >
                              ✓
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Action Area: Billing -->
                <div v-if="context === 'billing'" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Billing Action</p>
                      <p class="text-xs text-gray-500 mt-1" v-if="order.billingStatus?.invoiceNumber">
                        Invoice: <span class="font-mono text-gray-900">{{ order.billingStatus.invoiceNumber }}</span>
                      </p>
                    </div>
                    
                    <div class="flex flex-col gap-2 items-end" v-if="hasRole('ADMIN', 'BILLING')">
                      <button 
                        v-if="order.billingStatus?.status !== 'GENERATED'"
                        @click="markBillGenerated" 
                        class="px-3 py-1.5 text-xs font-medium bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90 shadow-sm flex items-center gap-1.5"
                      >
                        <Receipt class="w-3.5 h-3.5" /> Mark as Generated
                      </button>
                      <button 
                        v-if="!showBillingForm" 
                        @click="showBillingForm = true" 
                        class="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:underline"
                      >
                        Advanced Options...
                      </button>
                    </div>
                  </div>
                  
                  <!-- Advanced Billing Form -->
                  <div v-if="showBillingForm && hasRole('ADMIN', 'BILLING')" class="mt-4 pt-4 border-t border-gray-200">
                    <div class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                      <CustomSelect 
                        :modelValue="billingForm.status"
                        @update:modelValue="val => billingForm.status = val"
                        :options="billingStatusOptions"
                        placeholder="Select Status"
                        class="w-full"
                      />
                    </div>
                    <div v-if="billingForm.status === 'GENERATED'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Invoice Number</label>
                      <input type="text" v-model="billingForm.invoiceNumber" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white" placeholder="e.g. INV-2026-001" />
                    </div>
                    <div v-if="billingForm.status === 'ON_HOLD'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Hold Reason</label>
                      <textarea v-model="billingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white resize-none" placeholder="Reason..."></textarea>
                    </div>
                    <div class="flex justify-end gap-2">
                      <button @click="showBillingForm = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                      <button @click="updateBilling" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                    </div>
                  </div>
                </div>

                <!-- Action Area: Packing -->
                <div v-if="context === 'packing' && hasRole('ADMIN', 'PACKING')" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Finalize Packing</p>
                      <p class="text-xs text-gray-500 mt-1">Tick all items to activate</p>
                    </div>
                    
                    <div class="flex flex-col gap-2 items-end">
                      <button 
                        @click="markAsPacked" 
                        :disabled="!packingForm.items.every(i => i.isPacked) || packingForm.status === 'PACKED'"
                        class="px-4 py-2 text-xs font-semibold bg-[#1a5c4c] text-white rounded-md transition-all shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
                      >
                        {{ packingForm.status === 'PACKED' ? 'Packing Completed' : 'Mark as Packed' }}
                      </button>
                      <button 
                        v-if="!showPackingForm" 
                        @click="showPackingForm = true" 
                        class="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:underline"
                      >
                        Advanced Options...
                      </button>
                    </div>
                  </div>

                  <!-- Advanced Packing Form -->
                  <div v-if="showPackingForm" class="mt-4 pt-4 border-t border-gray-200">
                    <div class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                      <CustomSelect 
                        :modelValue="packingForm.status"
                        @update:modelValue="val => packingForm.status = val"
                        :options="packingStatusOptions"
                        placeholder="Select Status"
                        class="w-full"
                      />
                    </div>
                    <div v-if="packingForm.status === 'ON_HOLD'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Hold Reason</label>
                      <textarea v-model="packingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white resize-none" placeholder="Reason..."></textarea>
                    </div>
                    <div class="flex justify-end gap-2">
                      <button @click="showPackingForm = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                      <button @click="updatePacking" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                    </div>
                  </div>
                </div>

                <!-- Action Area: Delivery -->
                <div v-if="context === 'delivery' && hasRole('ADMIN', 'DELIVERY')" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative">
                  <div class="flex items-center gap-2 mb-3">
                    <button 
                      v-if="(order as any)?.hasDestinationPin || (order as any)?.destinationCoords"
                      @click="isPinModalOpen = true"
                      class="flex-1 py-2 text-xs font-semibold border border-emerald-300 text-[#1a5c4c] bg-emerald-50 hover:bg-emerald-100 rounded-lg shadow-sm flex justify-center items-center gap-1.5 transition"
                    >
                      <MapPin class="w-3.5 h-3.5 text-[#1a5c4c]" /> Change Pin
                    </button>
                    <button 
                      v-else
                      @click="isPinModalOpen = true"
                      class="flex-1 py-2 text-xs font-bold border border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg shadow-sm flex justify-center items-center gap-1.5 transition animate-pulse"
                    >
                      <MapPin class="w-3.5 h-3.5 text-amber-600" /> Set Pin
                    </button>
                    <button 
                      v-if="!showDeliveryForm" 
                      @click="initDeliveryForm" 
                      class="flex-1 py-2 text-xs font-semibold border border-[#1a5c4c] text-[#1a5c4c] bg-white rounded-lg hover:bg-gray-50 shadow-sm flex justify-center items-center gap-1.5 transition"
                    >
                      <Truck class="w-3.5 h-3.5" /> Delivery Details
                    </button>
                  </div>
                  
                  <div v-if="showDeliveryForm">
                    <div class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Assign Driver</label>
                      <CustomSelect 
                        :modelValue="deliveryForm.driverName"
                        @update:modelValue="val => deliveryForm.driverName = val"
                        :options="driverOptions"
                        searchable
                        searchPlaceholder="Search driver by name..."
                        placeholder="Select Driver"
                        class="w-full"
                      />
                    </div>
                    <div class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                      <CustomSelect 
                        :modelValue="deliveryForm.status"
                        @update:modelValue="val => deliveryForm.status = val"
                        :options="deliveryStatusOptions"
                        placeholder="Select Status"
                        class="w-full"
                      />
                    </div>
                    <div v-if="deliveryForm.status === 'ON_HOLD'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Hold Reason</label>
                      <textarea v-model="deliveryForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white resize-none"></textarea>
                    </div>
                    <div class="flex justify-end gap-2">
                      <button @click="showDeliveryForm = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                      <button @click="updateDelivery" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                    </div>
                  </div>
                </div>



              </div>
            </div>

            <!-- 3. Read-only Order Flow Visualizer -->
            <div class="pt-4 border-t border-gray-100">
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 text-center">Order Flow Status</h3>
              
              <div class="relative flex items-start justify-between px-4">
                <!-- Background Line -->
                <div class="absolute top-4 left-[15%] right-[15%] h-0.5 bg-gray-200 -z-10"></div>
                
                <!-- Steps -->
                <div 
                  v-for="step in [
                    { id: 'SALES', label: 'Sales' },
                    { id: 'APPROVAL', label: 'Approval' },
                    { id: 'PACKING', label: 'Packing' },
                    { id: 'BILLING', label: 'Billing' },
                    { id: 'DELIVERY', label: 'Delivery' }
                  ]" 
                  :key="step.id"
                  class="flex flex-col items-center gap-2 bg-white px-1 sm:px-2"
                >
                  <!-- Icon Circle -->
                  <div 
                    class="w-8 h-8 rounded-full flex items-center justify-center border-2"
                    :class="getStepColor(step.id)"
                  >
                    <Check v-if="step.id === 'SALES'" class="w-4 h-4" />
                    <CheckCheck v-else-if="step.id === 'APPROVAL'" class="w-4 h-4" />
                    <Box v-else-if="step.id === 'PACKING'" class="w-4 h-4" />
                    <Receipt v-else-if="step.id === 'BILLING'" class="w-4 h-4" />
                    <Truck v-else-if="step.id === 'DELIVERY'" class="w-4 h-4" />
                  </div>
                  <!-- Label -->
                  <div class="text-center">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-700">
                      {{ step.label }}
                    </span>
                    <span class="block text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">
                      {{ getStepStatus(step.id).replace('_', ' ') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
          <!-- END DETAILS TAB -->

          <!-- TIMELINE TAB (Placeholder) -->
          <div v-else-if="activeTab === 'TIMELINE'" class="text-sm text-gray-500">
            <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Timeline</h3>
            <ul class="space-y-4 border-l border-gray-200 ml-2 pl-4">
              <li v-for="t in order.timeline" :key="t.id" class="relative">
                <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-[#1a5c4c] rounded-full ring-4 ring-white"></span>
                <p class="font-medium text-gray-900">{{ t.action }}</p>
                <p v-if="t.description" class="mt-1 text-gray-600">{{ t.description }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ formatDateTime(t.timestamp) }} <span v-if="t.performedBy">by {{ t.performedBy.name }}</span></p>
              </li>
            </ul>
          </div>

          <!-- NOTES TAB (Placeholder) -->
          <div v-else-if="activeTab === 'NOTES'" class="text-sm text-gray-500">
            <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Internal Notes</h3>
            <p v-if="order.notes">{{ order.notes }}</p>
            <p v-else class="italic text-gray-400">No internal notes for this order.</p>
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
    <div v-if="isEditModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isEditModalOpen = false; hide()"></div>
      
      <div class="relative bg-[#faf8f5] w-full max-w-4xl rounded-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transform transition-all border border-gray-200">
        <div class="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <h2 class="text-base sm:text-lg font-bold text-gray-900 truncate">Edit Order: {{ order?.orderNumber }}</h2>
          <div class="flex items-center gap-3">
            <label class="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer select-none transition-all shadow-xs"
              :class="editForm.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            >
              <input type="checkbox" v-model="editForm.isUrgent" class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" />
              <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
                <Zap class="w-4 h-4 text-rose-600" />
                <span>⚡ Mark as Urgent Order</span>
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
              <Zap class="w-4 h-4 text-rose-600" />
              <span>⚡ Mark as Urgent Order</span>
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
                  <input v-model="editForm.orderNumber" required class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
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
                    :options="[
                      { label: 'Net 30', value: 'Net 30' },
                      { label: 'Net 60', value: 'Net 60' },
                      { label: 'Due on Receipt', value: 'Due on Receipt' },
                      { label: 'Advanced Payment', value: 'Advanced Payment' },
                      { label: 'COD', value: 'COD' }
                    ]"
                    placeholder="Select Terms"
                    class="w-full"
                  />
                </div>
                <div class="col-span-1 sm:col-span-2">
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Delivery Address</label>
                  <textarea v-model="editForm.deliveryAddress" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none"></textarea>
                </div>
                <div class="col-span-1 sm:col-span-2">
                  <label class="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Internal Notes</label>
                  <textarea v-model="editForm.notes" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none"></textarea>
                </div>
              </div>
            </div>

            <!-- Section 2: Items -->
            <div class="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div class="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 class="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items ({{ editForm.items.length }})</h3>
                <button type="button" @click="addEditItem" class="text-xs font-bold text-[#1a5c4c] flex items-center gap-1 hover:underline">
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
                      <input type="number" v-model.number="item.quantity" min="1" required class="w-full border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
                    </div>

                    <!-- Unit Price -->
                    <div class="w-full md:w-28 shrink-0">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Rate (₹) *</label>
                      <input type="number" v-model.number="item.unitPrice" min="0" step="0.01" required class="w-full border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
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
                      <input type="checkbox" v-model="item.isTaxInclusive" class="w-3.5 h-3.5 rounded text-[#1a5c4c] focus:ring-[#1a5c4c]" />
                      <span class="text-gray-700 font-medium">Tax Inclusive Rate</span>
                    </label>

                    <!-- Apply Last Price Checkbox -->
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" v-model="item.applyLastPrice" class="w-3.5 h-3.5 rounded text-[#1a5c4c] focus:ring-[#1a5c4c]" />
                      <span class="text-gray-700 font-medium">Apply Last Price</span>
                    </label>

                    <!-- Item Notes Input -->
                    <div class="flex-1 min-w-[200px]">
                      <input 
                        type="text" 
                        v-model="item.itemNotes" 
                        placeholder="Optional item note: e.g. 10% rate agreed, custom edge-banding..."
                        class="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-[#1a5c4c]"
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
              <span class="font-bold text-[#1a5c4c] text-sm sm:text-base">{{ formatCurrency(editOrderTotal) }}</span>
            </div>
            <button 
              type="button" 
              @click="saveEdit" 
              class="px-5 py-2 text-xs sm:text-sm font-bold bg-[#1a5c4c] hover:bg-[#154a3d] text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
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
  </Teleport>
</template>
