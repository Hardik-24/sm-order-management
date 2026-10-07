<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, MoreHorizontal, Lock, Edit, Package, Receipt, PackageCheck, Truck, Check, Box, Plus, Trash2, MapPin, CreditCard, AlertCircle, Ban } from 'lucide-vue-next'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import GenerateBillModal from '~/components/dashboard/GenerateBillModal.vue'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import RecordPaymentModal from '~/components/dashboard/RecordPaymentModal.vue'
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
  context?: 'billing' | 'packing' | 'delivery' | 'overview' | 'payment'
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
const isPaymentModalOpen = ref(false)

const showPaymentForm = ref(false)
const paymentForm = ref({
  status: 'UNPAID',
  amountPaid: 0,
  paymentMethod: 'UPI',
  referenceNo: '',
  dueDate: '',
  notes: ''
})

const onPaymentRecorded = async () => {
  if (props.orderId) {
    await fetchOrder(props.orderId)
    emit('updated', order.value)
  }
}

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
  } catch (err) {
    console.error(err)
    alert('Failed to delete order')
  } finally {
    isDeleting.value = false
  }
}

const fetchOrder = async (id: string) => {
  isLoading.value = true
  try {
    const data = await $fetch<Order>(`/api/orders/${id}`)
    order.value = data
    packingForm.value = {
      status: data.packingStatus?.status || 'PENDING',
      items: data.items?.map(i => ({ 
        id: i.id, 
        isPacked: i.packedQuantity === i.quantity,
        quantity: i.quantity,
        sku: i.product?.sku || i.product?.name
      })) || [],
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

const paymentStatusOptions = [
  { label: 'UNPAID', value: 'UNPAID' },
  { label: 'PARTIAL', value: 'PARTIAL' },
  { label: 'PAID', value: 'PAID' },
  { label: 'OVERDUE', value: 'OVERDUE' }
]

const paymentMethodOptions = [
  { label: 'UPI / QR', value: 'UPI' },
  { label: 'NEFT / RTGS', value: 'NEFT' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Other', value: 'OTHER' }
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

const initialPaymentState = ref('')

const cancelPaymentForm = () => {
  if (initialPaymentState.value) {
    try {
      paymentForm.value = JSON.parse(initialPaymentState.value)
    } catch {}
  }
  showPaymentForm.value = false
  hide()
}

const initPaymentForm = () => {
  showPaymentForm.value = !showPaymentForm.value
  if (!showPaymentForm.value) {
    cancelPaymentForm()
    return
  }
  if (order.value) {
    paymentForm.value = {
      status: order.value.paymentStatus?.status || 'UNPAID',
      amountPaid: Number(order.value.paymentStatus?.amountPaid || 0),
      paymentMethod: order.value.paymentStatus?.paymentMethod || 'UPI',
      referenceNo: order.value.paymentStatus?.referenceNo || '',
      dueDate: order.value.paymentStatus?.dueDate ? new Date(order.value.paymentStatus.dueDate).toISOString().split('T')[0] : '',
      notes: order.value.paymentStatus?.notes || ''
    }
    initialPaymentState.value = JSON.stringify(paymentForm.value)
    showEditing('Unsaved payment changes', updatePayment, cancelPaymentForm)
  }
}

const updatePayment = async () => {
  if (!order.value) return
  showSaving()
  try {
    const isUnpaid = paymentForm.value.status === 'UNPAID'
    await $fetch(`/api/orders/${order.value.id}/payment`, {
      method: 'PATCH',
      body: {
        status: paymentForm.value.status,
        amountPaid: isUnpaid ? 0 : (paymentForm.value.status === 'PARTIAL' ? Number(paymentForm.value.amountPaid) : undefined),
        paymentMethod: isUnpaid ? null : (paymentForm.value.paymentMethod || null),
        referenceNo: isUnpaid ? null : (paymentForm.value.referenceNo?.trim() || null),
        dueDate: paymentForm.value.dueDate || null,
        notes: paymentForm.value.notes?.trim() || null
      }
    })
    showPaymentForm.value = false
    showSaved('Payment status updated successfully')
    notifyChange({ orderId: order.value.id, action: 'PAYMENT_UPDATED', status: paymentForm.value.status })
    emit('updated')
    await fetchOrder(order.value.id)
  } catch (err: any) {
    console.error('Failed to update payment status:', err)
    alert(err?.data?.message || err?.message || 'Failed to update payment status')
    hide()
  }
}

const activePaymentRecords = computed(() => {
  return (order.value?.paymentRecords || []).filter((r: any) => !r.isVoided)
})

const voidedPaymentRecords = computed(() => {
  return (order.value?.paymentRecords || []).filter((r: any) => r.isVoided)
})

const isVoidingReceipt = ref<string | null>(null)

const voidReceipt = async (recordId: string, amount: number) => {
  if (!order.value) return
  const confirmed = confirm(`Are you sure you want to VOID this payment receipt of ${formatCurrency(amount)}?\n\nThis will mark the receipt as voided and restore the outstanding balance due on this order.`)
  if (!confirmed) return

  const reason = prompt('Optional reason for voiding this payment (e.g., bounced cheque, entered by mistake):', 'Entered in error')
  if (reason === null) return // user hit cancel on prompt

  isVoidingReceipt.value = recordId
  showSaving()
  try {
    const res: any = await $fetch(`/api/orders/${order.value.id}/payment-records/${recordId}`, {
      method: 'DELETE',
      body: { reason: reason?.trim() || 'Voided by user' }
    })
    showSaved('Payment receipt voided')
    notifyChange({ orderId: order.value.id, action: 'PAYMENT_RECEIPT_VOIDED' })
    if (res?.order) {
      order.value = res.order
    } else {
      await fetchOrder(order.value.id)
    }
    emit('updated', order.value)
  } catch (err: any) {
    console.error('Failed to void receipt:', err)
    alert(err?.data?.message || err?.message || 'Failed to void payment receipt')
    hide()
  } finally {
    isVoidingReceipt.value = null
  }
}

const closePanel = () => {
  hide()
  showBillingForm.value = false
  showDeliveryForm.value = false
  showPaymentForm.value = false
  emit('close')
}

watch(billingForm, () => { if (showBillingForm.value) showEditing() }, { deep: true })
watch(deliveryForm, () => { if (showDeliveryForm.value) showEditing() }, { deep: true })

watch(paymentForm, (newVal) => {
  if (showPaymentForm.value) {
    if (newVal.status === 'UNPAID') {
      newVal.paymentMethod = ''
      newVal.referenceNo = ''
      newVal.amountPaid = 0
    } else if (newVal.status === 'PAID') {
      newVal.amountPaid = Number(order.value?.totalAmount || 0)
      if (!newVal.paymentMethod) newVal.paymentMethod = 'UPI'
    }

    if (JSON.stringify(newVal) !== initialPaymentState.value) {
      showEditing('Unsaved payment changes', updatePayment, cancelPaymentForm)
    } else {
      hide()
    }
  }
}, { deep: true })

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

  const handlePackingChange = async (idx: number, event: Event) => {
    const isChecked = (event.target as HTMLInputElement).checked
    packingForm.value.items[idx].isPacked = isChecked
    
    const anyPacked = packingForm.value.items.some(i => i.isPacked)
    
    if (anyPacked && packingForm.value.status !== 'PACKED') {
      packingForm.value.status = 'IN_PROGRESS'
    } else if (!anyPacked && packingForm.value.status !== 'PACKED') {
      packingForm.value.status = 'PENDING'
    }
    
    await updatePacking()
  }

  const markAsPacked = async () => {
    packingForm.value.status = 'PACKED'
    await updatePacking()
  }

  
const getStepStatus = (step) => {
  if (!order.value) return 'PENDING'
  switch(step) {
    case 'SALES': return 'COMPLETED'
    case 'BILLING': return order.value.billingStatus?.status || 'PENDING'
    case 'PACKING': return order.value.packingStatus?.status || 'NOT_STARTED'
    case 'DELIVERY': return order.value.deliveryStatus?.status || 'NOT_STARTED'
    case 'PAYMENT': return order.value.paymentStatus?.status || 'UNPAID'
    default: return 'PENDING'
  }
}

const getStepColor = (step) => {
  const status = getStepStatus(step)
  if (step === 'PAYMENT') {
    if (status === 'PAID') return 'text-green-600 border-green-600 bg-green-50'
    if (status === 'PARTIAL') return 'text-blue-600 border-blue-600 bg-blue-50'
    if (status === 'OVERDUE') return 'text-rose-600 border-rose-600 bg-rose-50'
    return 'text-amber-600 border-amber-400 bg-amber-50'
  }
  if (['COMPLETED', 'GENERATED', 'PACKED', 'DELIVERED', 'DISPATCHED'].includes(status)) return 'text-green-600 border-green-600 bg-green-50'
  if (status === 'IN_PROGRESS' || status === 'WAITING') return 'text-blue-600 border-blue-600 bg-blue-50'
  if (status === 'ON_HOLD') return 'text-orange-600 border-orange-600 bg-orange-50'
  return 'text-gray-400 border-gray-300 bg-white'
}

const isEditModalOpen = ref(false)
const isEditLoading = ref(false)
const editForm = ref({ orderNumber: '', customerId: '', deliveryAddress: '', paymentTerms: '', notes: '', items: [] as any[] })
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
    items: order.value.items.map(i => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      productSku: i.product?.sku
    }))
  }
  
  editForm.value = newForm
  initialFormState.value = JSON.stringify(newForm)
  isEditLoading.value = false
}

const addEditItem = () => {
  editForm.value.items.push({ productId: '', quantity: 1, unitPrice: 0 })
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

const updatePacking = async () => {
    if (!order.value) return

    // Optimistic UI update (0ms local response)
    if (order.value && packingForm.value.status) {
      if (!order.value.packingStatus) order.value.packingStatus = {} as any
      order.value.packingStatus.status = packingForm.value.status as any
    }

    showSaving()
    try {
      const payload = {
        status: packingForm.value.status,
        holdReason: packingForm.value.holdReason,
        items: packingForm.value.items.map(i => ({
          id: i.id,
          packedQuantity: i.isPacked ? i.quantity : 0
        }))
      }
      await $fetch(`/api/orders/${order.value.id}/packing`, {
        method: 'PATCH',
        body: payload
      })
      showSaved('Packing updated successfully')
      notifyChange({ orderId: order.value.id, action: 'PACKING_UPDATED', status: packingForm.value.status })
      emit('updated')
      await fetchOrder(order.value.id)
    } catch (err) {
      console.error(err)
      hide()
    }
  }

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

  <RecordPaymentModal
    :isOpen="isPaymentModalOpen"
    :order="order"
    @close="isPaymentModalOpen = false"
    @recorded="onPaymentRecorded"
  />

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
              <StatusBadge 
                :status="order.overallStatus" 
                :display="getDisplayStatus(order)" 
                :class="getOverallColor(order)" 
              />
              <span 
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                :class="getStatusColor(order.paymentStatus?.status || 'UNPAID')"
              >
                {{ order.paymentStatus?.status || 'UNPAID' }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                v-if="hasRole('ADMIN', 'SALES')"
                @click="deleteOrder" 
                :disabled="isDeleting"
                title="Delete Order"
                class="p-1.5 text-red-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 class="w-5 h-5" />
              </button>
              <button @click="closePanel" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 ml-2">
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
              <p v-if="(order.paymentStatus?.status || 'UNPAID') !== 'PAID'" class="text-[11px] text-amber-700 font-medium mt-0.5">
                Due: {{ formatCurrency(order.paymentStatus?.balanceDue ?? order.totalAmount) }}
              </p>
              <p v-else class="text-[11px] text-emerald-700 font-medium mt-0.5">
                Fully Paid
              </p>
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

            <!-- Payment Summary & Action Card -->
            <div v-if="context === 'payment'" class="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <CreditCard class="w-4 h-4 text-[#1a5c4c]" />
                  <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Payment Status</h3>
                </div>
                <div class="flex items-center gap-2" v-if="hasRole('ADMIN', 'SALES', 'BILLING')">
                  <button 
                    v-if="(order.paymentStatus?.status || 'UNPAID') !== 'PAID'"
                    @click="isPaymentModalOpen = true"
                    class="px-2.5 py-1 text-xs font-semibold bg-[#1a5c4c] text-white rounded-lg hover:bg-[#1a5c4c]/90 transition shadow-sm flex items-center gap-1"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    Record Payment
                  </button>
                  <button 
                    @click="initPaymentForm" 
                    class="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition shadow-xs flex items-center gap-1"
                  >
                    <Edit class="w-3 h-3 text-gray-500" />
                    {{ showPaymentForm ? 'Close' : 'Change Status' }}
                  </button>
                </div>
              </div>
              
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-200/80 text-xs">
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-400">Status</span>
                  <span 
                    class="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold border"
                    :class="getStatusColor(order.paymentStatus?.status || 'UNPAID')"
                  >
                    {{ order.paymentStatus?.status || 'UNPAID' }}
                  </span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-400">Paid Amount</span>
                  <span class="font-semibold text-emerald-700 mt-0.5 block">
                    {{ formatCurrency(order.paymentStatus?.amountPaid || 0) }}
                  </span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-400">Balance Due</span>
                  <span class="font-bold text-amber-700 mt-0.5 block">
                    {{ formatCurrency(order.paymentStatus?.balanceDue ?? order.totalAmount) }}
                  </span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-400">Payment Terms</span>
                  <span class="font-medium text-gray-700 mt-0.5 block">
                    {{ order.paymentTerms || '30 Days' }}
                  </span>
                </div>
              </div>

              <!-- Inline Payment Status Form -->
              <div v-if="showPaymentForm && hasRole('ADMIN', 'SALES', 'BILLING')" class="p-3.5 bg-white border border-gray-200 rounded-xl mt-3 space-y-3 shadow-xs">
                <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span class="text-xs font-bold text-gray-800 uppercase tracking-wider">Modify Payment Status</span>
                  <span class="text-[10px] text-gray-400">Save via snackbar or button below</span>
                </div>

                <!-- Status & Due Date / Method row -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                    <CustomSelect 
                      :modelValue="paymentForm.status"
                      @update:modelValue="val => paymentForm.status = val"
                      :options="paymentStatusOptions"
                      placeholder="Select Status"
                      class="w-full"
                    />
                  </div>

                  <div v-if="paymentForm.status !== 'UNPAID'">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Method</label>
                    <CustomSelect 
                      :modelValue="paymentForm.paymentMethod"
                      @update:modelValue="val => paymentForm.paymentMethod = val"
                      :options="paymentMethodOptions"
                      placeholder="Select Method"
                      class="w-full"
                    />
                  </div>

                  <div v-else>
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Due Date</label>
                    <input 
                      type="date" 
                      v-model="paymentForm.dueDate" 
                      class="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white text-gray-900" 
                    />
                  </div>
                </div>

                <!-- UNPAID Info Alert (when UNPAID, hide method/reference/amount) -->
                <div v-if="paymentForm.status === 'UNPAID'" class="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle class="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Order marked as <strong>UNPAID</strong>. Total due is {{ formatCurrency(order.totalAmount) }}. Payment method and transaction references are cleared.</span>
                </div>

                <!-- Transaction Details (Only editable when NOT UNPAID) -->
                <div v-if="paymentForm.status !== 'UNPAID'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div v-if="paymentForm.status === 'PARTIAL'">
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Amount Paid (₹)</label>
                    <input 
                      type="number" 
                      v-model.number="paymentForm.amountPaid" 
                      min="0"
                      :max="order.totalAmount"
                      class="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white text-gray-900" 
                      placeholder="Enter amount paid" 
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Reference / Cheque #</label>
                    <input 
                      type="text" 
                      v-model="paymentForm.referenceNo" 
                      class="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white text-gray-900" 
                      placeholder="e.g. UTR-19823410 / Chq #1029" 
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Due Date</label>
                    <input 
                      type="date" 
                      v-model="paymentForm.dueDate" 
                      class="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white text-gray-900" 
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Remarks / Notes</label>
                  <textarea 
                    v-model="paymentForm.notes" 
                    rows="2" 
                    class="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white text-gray-900 resize-none" 
                    placeholder="Transaction remarks or payment notes..."
                  ></textarea>
                </div>

                <div class="flex justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    @click="cancelPaymentForm" 
                    class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    @click="updatePayment" 
                    class="px-4 py-1.5 text-xs font-semibold bg-[#1a5c4c] text-white rounded-lg hover:bg-[#1a5c4c]/90 transition shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              <!-- Installment receipts breakdown -->
              <div v-if="order.paymentRecords && order.paymentRecords.length > 0" class="pt-3 border-t border-gray-200/80">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                      Payment Receipts ({{ activePaymentRecords.length }})
                    </span>
                    <span v-if="voidedPaymentRecords.length > 0" class="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-md border border-rose-200/80 font-semibold flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      {{ voidedPaymentRecords.length }} voided
                    </span>
                  </div>
                  <span class="text-[11px] font-semibold text-emerald-700">
                    {{ formatCurrency(order.paymentStatus?.amountPaid || 0) }} collected
                  </span>
                </div>

                <div class="space-y-2">
                  <div 
                    v-for="(record, rIdx) in order.paymentRecords" 
                    :key="record.id || rIdx"
                    class="p-2.5 rounded-xl text-xs transition"
                    :class="record.isVoided 
                      ? 'bg-rose-50/30 border border-dashed border-rose-200 text-gray-400' 
                      : 'bg-white border border-gray-200 hover:border-gray-300 shadow-xs'"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span 
                          class="font-bold text-sm"
                          :class="record.isVoided ? 'line-through text-gray-400' : 'text-emerald-700'"
                        >
                          {{ formatCurrency(record.amount) }}
                        </span>
                        <span 
                          v-if="record.isVoided" 
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200"
                        >
                          VOIDED
                        </span>
                        <span 
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                          :class="record.isVoided ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-gray-100 text-gray-700 border border-gray-200'"
                        >
                          {{ record.paymentMethod }}
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-400">
                          {{ formatDateTime(record.createdAt) }}
                        </span>
                        <button 
                          v-if="!record.isVoided && hasRole('ADMIN', 'BILLING', 'SALES')"
                          type="button"
                          @click="voidReceipt(record.id, record.amount)"
                          :disabled="isVoidingReceipt === record.id"
                          class="text-gray-400 hover:text-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-50 transition flex items-center gap-1 border border-transparent hover:border-rose-200"
                          title="Void this receipt"
                        >
                          <Ban class="w-3 h-3 text-rose-500" />
                          <span class="text-[10px] font-semibold text-rose-600">Void</span>
                        </button>
                      </div>
                    </div>

                    <div class="mt-1.5 flex items-center justify-between text-[11px]" :class="record.isVoided ? 'text-gray-400' : 'text-gray-500'">
                      <span v-if="record.referenceNo" class="font-mono truncate max-w-[200px]" :title="record.referenceNo">
                        Ref: {{ record.referenceNo }}
                      </span>
                      <span v-else class="italic">No reference</span>
                      
                      <span v-if="record.recordedBy?.name" class="text-[10px]">
                        by {{ record.recordedBy.name }}
                      </span>
                    </div>

                    <div v-if="record.notes" class="mt-1.5 text-[11px] p-1.5 rounded-lg border italic" :class="record.isVoided ? 'bg-rose-50/40 border-rose-100 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-600'">
                      "{{ record.notes }}"
                    </div>

                    <!-- Void audit information -->
                    <div v-if="record.isVoided" class="mt-2 pt-1.5 border-t border-rose-200/60 flex items-center justify-between text-[10px] text-rose-600">
                      <span>Void Reason: <strong class="text-rose-700 font-medium">{{ record.voidReason || 'Order status reset to UNPAID' }}</strong></span>
                      <span v-if="record.voidedAt" class="text-gray-400">{{ formatDate(record.voidedAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Fallback if no payment records yet but legacy method/reference exists -->
              <div v-else-if="order.paymentStatus?.paymentMethod || order.paymentStatus?.referenceNo" class="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
                <span v-if="order.paymentStatus?.paymentMethod">
                  Method: <strong class="text-gray-700">{{ order.paymentStatus.paymentMethod }}</strong>
                </span>
                <span v-if="order.paymentStatus?.referenceNo" class="font-mono">
                  Ref: {{ order.paymentStatus.referenceNo }}
                </span>
              </div>
            </div>

            <!-- 2. Order Items and Context-Aware Action Area -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Items</h3>
                <StatusBadge v-if="context === 'packing' && order.packingStatus?.status" :status="order.packingStatus.status" />
                <StatusBadge v-else-if="context === 'billing' && order.billingStatus?.status" :status="order.billingStatus.status" />
                <StatusBadge v-else-if="context === 'delivery' && order.deliveryStatus?.status" :status="order.deliveryStatus.status" />
                <StatusBadge v-else-if="context === 'payment' && order.paymentStatus?.status" :status="order.paymentStatus.status" />
              </div>
              
              <div class="border border-gray-200 rounded-lg bg-white">
                <div class="overflow-x-auto rounded-t-lg">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th class="px-4 py-2 font-medium">Product</th>
                        <th class="px-4 py-2 font-medium text-right">Qty</th>
                        <th v-if="context === 'packing'" class="px-4 py-2 font-medium text-center">Packed</th>
                      </tr>
                    </thead>
                    <tbody ref="itemsTbodyRef" class="divide-y divide-gray-200">
                      <tr v-for="(item, idx) in order.items" :key="item.id" class="bg-white transition-colors" :class="{ 'bg-green-50/30': context === 'packing' && packingForm.items[idx]?.isPacked }">
                        <td class="px-4 py-3">
                          <div class="font-medium truncate max-w-[150px]" :class="context === 'packing' && packingForm.items[idx]?.isPacked ? 'text-gray-400 line-through' : 'text-gray-900'">
                            {{ item.product?.sku }}
                          </div>
                          <div class="text-xs text-gray-400 truncate max-w-[150px]">{{ item.product?.name }}</div>
                        </td>
                        <td class="px-4 py-3 text-right font-medium text-gray-900">{{ item.quantity }}</td>
                        <td v-if="context === 'packing'" class="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            :checked="packingForm.items[idx]?.isPacked" 
                            @change="e => handlePackingChange(idx, e)" 
                            class="rounded border-gray-300 text-[#1a5c4c] focus:ring-[#1a5c4c] w-5 h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                            :disabled="!hasRole('ADMIN', 'PACKING')"
                          />
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

                <!-- Action Area: Payment -->
                <div v-if="context === 'payment' && hasRole('ADMIN', 'SALES', 'BILLING')" class="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg relative">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Payment Action</p>
                      <p class="text-xs text-gray-500 mt-1">
                        Outstanding: <span class="font-bold text-amber-700">{{ formatCurrency(order.paymentStatus?.balanceDue ?? order.totalAmount) }}</span>
                      </p>
                    </div>
                    
                    <div class="flex flex-col gap-2 items-end">
                      <button 
                        v-if="(order.paymentStatus?.status || 'UNPAID') !== 'PAID'"
                        @click="isPaymentModalOpen = true" 
                        class="px-3 py-1.5 text-xs font-semibold bg-[#1a5c4c] text-white rounded-lg hover:bg-[#1a5c4c]/90 shadow-sm flex items-center gap-1.5 transition"
                      >
                        <CreditCard class="w-3.5 h-3.5" /> Record Payment
                      </button>
                      <button 
                        v-if="!showPaymentForm" 
                        @click="initPaymentForm" 
                        class="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:underline"
                      >
                        Advanced Options...
                      </button>
                    </div>
                  </div>

                  <!-- Advanced Payment Form in Action Area -->
                  <div v-if="showPaymentForm" class="mt-4 pt-4 border-t border-gray-200">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                        <CustomSelect 
                          :modelValue="paymentForm.status"
                          @update:modelValue="val => paymentForm.status = val"
                          :options="paymentStatusOptions"
                          placeholder="Select Status"
                          class="w-full"
                        />
                      </div>

                      <div v-if="paymentForm.status !== 'UNPAID'">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Method</label>
                        <CustomSelect 
                          :modelValue="paymentForm.paymentMethod"
                          @update:modelValue="val => paymentForm.paymentMethod = val"
                          :options="paymentMethodOptions"
                          placeholder="Select Method"
                          class="w-full"
                        />
                      </div>

                      <div v-else>
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Due Date</label>
                        <input 
                          type="date" 
                          v-model="paymentForm.dueDate" 
                          class="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] bg-white text-gray-900" 
                        />
                      </div>
                    </div>

                    <!-- UNPAID Info Alert -->
                    <div v-if="paymentForm.status === 'UNPAID'" class="mb-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                      <AlertCircle class="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Order marked as <strong>UNPAID</strong>. Total due is {{ formatCurrency(order.totalAmount) }}. Payment method and transaction references are cleared.</span>
                    </div>

                    <!-- Non-UNPAID fields -->
                    <div v-if="paymentForm.status !== 'UNPAID'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div v-if="paymentForm.status === 'PARTIAL'">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Amount Paid (₹)</label>
                        <input 
                          type="number" 
                          v-model.number="paymentForm.amountPaid" 
                          min="0"
                          :max="order.totalAmount"
                          class="w-full text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white text-gray-900" 
                          placeholder="Enter partial amount" 
                        />
                      </div>
                      <div>
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Reference / Cheque #</label>
                        <input 
                          type="text" 
                          v-model="paymentForm.referenceNo" 
                          class="w-full text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white text-gray-900" 
                          placeholder="e.g. UTR-19823410" 
                        />
                      </div>
                      <div>
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Due Date</label>
                        <input 
                          type="date" 
                          v-model="paymentForm.dueDate" 
                          class="w-full text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white text-gray-900" 
                        />
                      </div>
                    </div>

                    <div class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Remarks / Notes</label>
                      <textarea 
                        v-model="paymentForm.notes" 
                        rows="2" 
                        class="w-full text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white text-gray-900 resize-none" 
                        placeholder="Transaction remarks or payment notes..."
                      ></textarea>
                    </div>

                    <div class="flex justify-end gap-2">
                      <button @click="cancelPaymentForm" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                      <button @click="updatePayment" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
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
                    { id: 'SALES', label: 'Sales', icon: 'FileText' },
                    { id: 'BILLING', label: 'Billing', icon: 'Receipt' },
                    { id: 'PACKING', label: 'Packing', icon: 'Box' },
                    { id: 'DELIVERY', label: 'Delivery', icon: 'Truck' },
                    { id: 'PAYMENT', label: 'Payment', icon: 'CreditCard' }
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
                    <Receipt v-else-if="step.id === 'BILLING'" class="w-4 h-4" />
                    <Box v-else-if="step.id === 'PACKING'" class="w-4 h-4" />
                    <Truck v-else-if="step.id === 'DELIVERY'" class="w-4 h-4" />
                    <CreditCard v-else-if="step.id === 'PAYMENT'" class="w-4 h-4" />
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
          <button @click="isEditModalOpen = false; hide()" class="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X class="w-5 h-5" />
          </button>
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
              
              <div class="space-y-3">
                <div v-for="(item, idx) in editForm.items" :key="idx" class="flex flex-col sm:flex-row gap-2.5 sm:gap-4 sm:items-end bg-gray-50 p-3 sm:p-3.5 rounded-lg border border-gray-200/80">
                  <div class="flex-grow min-w-0 w-full sm:w-auto">
                    <div class="flex items-center justify-between sm:hidden mb-1">
                      <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Item #{{ idx + 1 }}</span>
                      <button type="button" @click="removeEditItem(idx)" class="text-red-500 text-xs font-semibold flex items-center gap-1 hover:text-red-700">
                        <Trash2 class="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                    <label class="hidden sm:block text-[10px] uppercase font-bold text-gray-500 mb-1">Product</label>
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
                  <div class="grid grid-cols-3 sm:flex items-end gap-2 sm:gap-3 w-full sm:w-auto">
                    <div class="w-full sm:w-20 lg:w-24">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Qty</label>
                      <input type="number" v-model.number="item.quantity" min="1" required class="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm" />
                    </div>
                    <div class="w-full sm:w-24 lg:w-28">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Price</label>
                      <input type="number" v-model.number="item.unitPrice" min="0" required class="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm" />
                    </div>
                    <div class="w-full sm:w-28 lg:w-32">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Total</label>
                      <div class="p-2 bg-white text-gray-900 rounded-lg font-semibold text-xs sm:text-sm border border-gray-200 truncate">
                        {{ formatCurrency(item.quantity * item.unitPrice) }}
                      </div>
                    </div>
                    <button type="button" @click="removeEditItem(idx)" class="hidden sm:block p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg mb-0.5 transition-colors shrink-0" title="Remove item">
                      <Trash2 class="w-4 h-4" />
                    </button>
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
