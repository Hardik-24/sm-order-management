<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  CheckCheck, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap,
  ArrowRight, 
  X, 
  Phone, 
  MapPin, 
  Building2, 
  Package, 
  AlertTriangle, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  UserCheck,
  DollarSign,
  Loader2,
  Award
} from 'lucide-vue-next'
import { formatCurrency, formatDateTime } from '~/lib/utils'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useSnackbar } from '~/composables/useSnackbar'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()
const { showSnackbar } = useSnackbar()

// Filters
const page = ref(1)
const limit = ref(10)
const search = ref('')
const activeTab = ref<'PENDING' | 'URGENT' | 'APPROVED' | 'ALL'>('PENDING')

const queryObj = computed(() => {
  const q: any = {
    page: page.value,
    limit: limit.value
  }
  if (activeTab.value === 'PENDING') {
    q.isApproved = 'false'
    q.status = 'CONFIRMED'
  } else if (activeTab.value === 'URGENT') {
    q.isUrgent = 'true'
    q.isApproved = 'false'
  } else if (activeTab.value === 'APPROVED') {
    q.isApproved = 'true'
  }
  if (search.value.trim()) {
    q.search = search.value.trim()
  }
  return q
})

const { data, pending: isLoading, refresh } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

// Realtime sync
const { onOrderSync, notifyChange } = useRealtimeSync()
onOrderSync(() => {
  refresh()
})

// Modal / Review state
const isReviewModalOpen = ref(false)
const selectedOrder = ref<any | null>(null)
const editableItems = ref<any[]>([])
const approvalNotes = ref('')
const isSubmittingApproval = ref(false)

// Cancel Modal state
const isCancelModalOpen = ref(false)
const orderToCancel = ref<any | null>(null)
const cancelReason = ref('')
const isSubmittingCancel = ref(false)

const openReview = (order: any) => {
  selectedOrder.value = order
  approvalNotes.value = ''
  editableItems.value = (order.items || []).map((item: any) => ({
    id: item.id,
    sku: item.sku || item.product?.sku,
    productName: item.productName || item.product?.name,
    quantity: item.quantity,
    approvedQuantity: item.approvedQuantity !== null && item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity,
    unitPrice: Number(item.unitPrice || item.product?.price || 0),
    isTaxInclusive: item.isTaxInclusive || false,
    applyLastPrice: item.applyLastPrice || false,
    itemNotes: item.itemNotes || ''
  }))
  isReviewModalOpen.value = true
}

const computedOrderTotal = computed(() => {
  return editableItems.value.reduce((sum, itm) => {
    return sum + (Number(itm.approvedQuantity || 0) * Number(itm.unitPrice || 0))
  }, 0)
})

const submitApproval = async () => {
  if (!selectedOrder.value) return
  isSubmittingApproval.value = true
  try {
    await $fetch(`/api/orders/${selectedOrder.value.id}/approve`, {
      method: 'PATCH',
      body: {
        approvalNotes: approvalNotes.value,
        items: editableItems.value.map(i => ({
          id: i.id,
          approvedQuantity: Number(i.approvedQuantity),
          unitPrice: Number(i.unitPrice)
        }))
      }
    })
    showSnackbar('Order approved successfully and sent to Packing & Billing!', 'success')
    isReviewModalOpen.value = false
    selectedOrder.value = null
    notifyChange('order_approved')
    refresh()
  } catch (err: any) {
    showSnackbar(err.data?.message || 'Failed to approve order', 'error')
  } finally {
    isSubmittingApproval.value = false
  }
}

const openCancelModal = (order: any) => {
  orderToCancel.value = order
  cancelReason.value = ''
  isCancelModalOpen.value = true
}

const submitCancel = async () => {
  if (!orderToCancel.value) return
  if (!cancelReason.value.trim()) {
    showSnackbar('Please enter a cancellation reason', 'error')
    return
  }
  isSubmittingCancel.value = true
  try {
    await $fetch(`/api/orders/${orderToCancel.value.id}/cancel`, {
      method: 'POST',
      body: { reason: cancelReason.value.trim() }
    })
    showSnackbar(`Order ${orderToCancel.value.orderNumber} has been cancelled`, 'info')
    isCancelModalOpen.value = false
    orderToCancel.value = null
    notifyChange('order_cancelled')
    refresh()
  } catch (err: any) {
    showSnackbar(err.data?.message || 'Failed to cancel order', 'error')
  } finally {
    isSubmittingCancel.value = false
  }
}

// GSAP Animation
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numPending = ref<HTMLElement | null>(null)
const numUrgent = ref<HTMLElement | null>(null)
const numApproved = ref<HTMLElement | null>(null)
const numTotal = ref<HTMLElement | null>(null)

const counts = computed(() => {
  const orders = data.value?.orders || []
  const pendingCount = orders.filter((o: any) => !o.isApproved && o.overallStatus !== 'CANCELLED').length
  const urgentCount = orders.filter((o: any) => o.isUrgent && !o.isApproved).length
  const approvedCount = orders.filter((o: any) => o.isApproved).length
  return {
    pending: pendingCount,
    urgent: urgentCount,
    approved: approvedCount,
    total: data.value?.total || 0
  }
})

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
})

const getPrivilegeColor = (tier: string) => {
  switch (tier) {
    case 'GOLD': return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'SILVER': return 'bg-slate-100 text-slate-800 border-slate-300'
    default: return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}
</script>

<template>
  <div class="space-y-8 p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Approve Orders</h1>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1a5c4c]/10 text-[#1a5c4c] border border-[#1a5c4c]/20">
            <CheckCheck class="w-3.5 h-3.5" /> Department Desk
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          Verify product rates, inspect custom notes, and approve orders before fulfillment.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="() => refresh()" 
          :disabled="isLoading"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Pending Approval -->
      <div 
        @click="activeTab = 'PENDING'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-amber-50 p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <Clock class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-amber-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Pending Approval</p>
            <h3 ref="numPending" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.pending }}</h3>
            <p class="text-xs text-amber-600 font-medium">Awaiting rate review</p>
          </div>
        </div>
      </div>

      <!-- Urgent Orders -->
      <div 
        @click="activeTab = 'URGENT'; page = 1"
        class="bg-white rounded-xl border border-rose-200 p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-rose-50 p-2.5 rounded-lg text-rose-600 border border-rose-100/50">
              <Zap class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-rose-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-0.5">⚡ Urgent Orders</p>
            <h3 ref="numUrgent" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.urgent }}</h3>
            <p class="text-xs text-rose-500 font-medium">High priority dispatch</p>
          </div>
        </div>
      </div>

      <!-- Approved -->
      <div 
        @click="activeTab = 'APPROVED'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-[#1a5c4c]/10 p-2.5 rounded-lg text-[#1a5c4c] border border-[#1a5c4c]/20">
              <CheckCircle2 class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-[#1a5c4c] rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Approved</p>
            <h3 ref="numApproved" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.approved }}</h3>
            <p class="text-xs text-emerald-600 font-medium">Ready for dispatch</p>
          </div>
        </div>
      </div>

      <!-- Total Orders -->
      <div 
        @click="activeTab = 'ALL'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-gray-100 p-2.5 rounded-lg text-gray-600 border border-gray-200/50">
              <Package class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-gray-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Total Listed</p>
            <h3 ref="numTotal" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.total }}</h3>
            <p class="text-xs text-gray-500">Orders in database</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Underline Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-8">
        <button 
          v-for="tab in (['PENDING', 'URGENT', 'APPROVED', 'ALL'] as const)" :key="tab"
          @click="activeTab = tab; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span v-if="tab === 'URGENT'">⚡</span>
          <span>
            {{ tab === 'PENDING' ? 'Pending Approval' : tab === 'URGENT' ? 'Urgent Only' : tab === 'APPROVED' ? 'Approved Orders' : 'All Orders' }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Table Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
        <div class="relative w-full sm:w-80">
          <Search class="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input 
            v-model="search"
            type="text"
            placeholder="Search order #, customer..." 
            class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]"
          />
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
          <RowsPerPageSelect v-model="limit" />
        </div>
      </div>

      <!-- Orders Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-600">
          <thead class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Order #</th>
              <th class="py-3 px-4">Customer & Tier</th>
              <th class="py-3 px-4">Items / Qty</th>
              <th class="py-3 px-4">Total Amount</th>
              <th class="py-3 px-4">Status & Approval</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-if="isLoading" class="text-center py-8">
              <td colspan="6" class="py-12 text-center text-gray-400">
                <Loader2 class="w-6 h-6 animate-spin mx-auto text-[#1a5c4c] mb-2" />
                Loading orders...
              </td>
            </tr>
            <tr v-else-if="!data?.orders || data.orders.length === 0" class="text-center py-8">
              <td colspan="6" class="py-12 text-center text-gray-400">
                <CheckCheck class="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-50" />
                No orders pending approval matching criteria.
              </td>
            </tr>
            <tr 
              v-else 
              v-for="order in data.orders" 
              :key="order.id"
              class="hover:bg-gray-50/80 transition-colors"
              :class="{ 'bg-rose-50/20': order.isUrgent }"
            >
              <!-- Order # -->
              <td class="py-3 px-4 font-medium text-gray-900">
                <div class="flex items-center gap-2">
                  <NuxtLink :to="`/dashboard/orders/${order.id}`" class="text-[#1a5c4c] hover:underline font-semibold">
                    {{ order.orderNumber }}
                  </NuxtLink>
                  <span v-if="order.isUrgent" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                    ⚡ URGENT
                  </span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">
                  {{ formatDateTime(order.createdAt) }}
                </div>
              </td>

              <!-- Customer -->
              <td class="py-3 px-4">
                <div class="font-medium text-gray-900 flex items-center gap-2">
                  <span>{{ order.customer?.name }}</span>
                  <span 
                    v-if="order.customer?.privilegeTier" 
                    class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border"
                    :class="getPrivilegeColor(order.customer.privilegeTier)"
                  >
                    {{ order.customer.privilegeTier }}
                  </span>
                </div>
                <div class="text-xs text-gray-500 truncate max-w-xs">
                  {{ order.customer?.company || order.deliveryAddress }}
                </div>
              </td>

              <!-- Items -->
              <td class="py-3 px-4">
                <div class="font-medium text-gray-800">
                  {{ order.items?.length || 0 }} items
                </div>
                <div class="text-xs text-gray-400 truncate max-w-xs">
                  {{ order.items?.map((i: any) => i.productName || i.product?.name).filter(Boolean).join(', ') }}
                </div>
              </td>

              <!-- Total Amount -->
              <td class="py-3 px-4 font-semibold text-gray-900">
                {{ formatCurrency(order.totalAmount) }}
              </td>

              <!-- Approval Status -->
              <td class="py-3 px-4">
                <div v-if="order.isApproved" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  Approved {{ order.approvedBy ? `by ${order.approvedBy.name}` : '' }}
                </div>
                <div v-else-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <XCircle class="w-3.5 h-3.5" />
                  Cancelled
                </div>
                <div v-else class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock class="w-3.5 h-3.5" />
                  Pending Approval
                </div>
              </td>

              <!-- Actions -->
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button 
                    v-if="!order.isApproved && order.overallStatus !== 'CANCELLED'"
                    @click="openReview(order)"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a5c4c] text-white hover:bg-[#14473b] shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCheck class="w-3.5 h-3.5" />
                    Review & Approve
                  </button>
                  <button 
                    v-if="order.overallStatus !== 'CANCELLED' && order.overallStatus !== 'DELIVERED'"
                    @click="openCancelModal(order)"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200"
                    title="Cancel Order"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="data?.totalPages > 1" class="p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
        <div>Showing page {{ page }} of {{ data.totalPages }}</div>
        <div class="flex gap-2">
          <button 
            :disabled="page <= 1" 
            @click="page--"
            class="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Prev
          </button>
          <button 
            :disabled="page >= data.totalPages" 
            @click="page++"
            class="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Review & Approve Modal -->
    <div v-if="isReviewModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-[#1c1c1c] text-white">
          <div class="flex items-center gap-3">
            <CheckCheck class="w-5 h-5 text-emerald-400" />
            <div>
              <h3 class="text-lg font-bold">Approve Order: {{ selectedOrder?.orderNumber }}</h3>
              <p class="text-xs text-gray-400">Customer: {{ selectedOrder?.customer?.name }} ({{ selectedOrder?.customer?.company || 'Direct' }})</p>
            </div>
          </div>
          <button @click="isReviewModalOpen = false" class="text-gray-400 hover:text-white p-1 rounded-lg">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto flex-1 space-y-6">
          <!-- Client & Delivery Banner -->
          <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-wrap gap-4 justify-between items-center text-xs">
            <div>
              <span class="text-gray-400 block font-medium">Privilege Tier</span>
              <span class="font-bold text-gray-800 uppercase">{{ selectedOrder?.customer?.privilegeTier || 'BRONZE' }}</span>
            </div>
            <div>
              <span class="text-gray-400 block font-medium">Priority Client</span>
              <span class="font-bold" :class="selectedOrder?.customer?.isPriorityClient ? 'text-amber-600' : 'text-gray-600'">
                {{ selectedOrder?.customer?.isPriorityClient ? '★ Priority Customer' : 'Standard' }}
              </span>
            </div>
            <div>
              <span class="text-gray-400 block font-medium">Urgent Order Tag</span>
              <span class="font-bold" :class="selectedOrder?.isUrgent ? 'text-rose-600' : 'text-gray-600'">
                {{ selectedOrder?.isUrgent ? '⚡ Marked Urgent' : 'Normal Fulfillment' }}
              </span>
            </div>
            <div class="max-w-xs">
              <span class="text-gray-400 block font-medium">Destination Address</span>
              <span class="font-semibold text-gray-800 truncate block">{{ selectedOrder?.deliveryAddress || 'Registered Location' }}</span>
            </div>
          </div>

          <!-- Items Table -->
          <div>
            <h4 class="text-sm font-bold text-gray-900 mb-3 flex items-center justify-between">
              <span>Item Verification & Price Adjustment</span>
              <span class="text-xs font-normal text-gray-500">Modify approved qty or final price if needed</span>
            </h4>
            <div class="border border-gray-200 rounded-xl overflow-hidden">
              <table class="w-full text-left text-xs">
                <thead class="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                  <tr>
                    <th class="py-2.5 px-3">Item / SKU</th>
                    <th class="py-2.5 px-3">Ordered Qty</th>
                    <th class="py-2.5 px-3">Approved Qty</th>
                    <th class="py-2.5 px-3">Final Rate (₹)</th>
                    <th class="py-2.5 px-3">Tax Mode</th>
                    <th class="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(item, idx) in editableItems" :key="item.id" class="hover:bg-gray-50/50">
                    <td class="py-2.5 px-3 font-medium text-gray-900">
                      <div>{{ item.productName }}</div>
                      <div class="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span>SKU: {{ item.sku }}</span>
                        <span v-if="item.applyLastPrice" class="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-semibold border border-emerald-200">
                          Last Price Applied
                        </span>
                      </div>
                      <div v-if="item.itemNotes" class="mt-1 text-[11px] text-amber-700 bg-amber-50/80 p-1 rounded border border-amber-200">
                        💬 Note: {{ item.itemNotes }}
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-gray-600 font-semibold">
                      {{ item.quantity }}
                    </td>
                    <td class="py-2.5 px-3">
                      <input 
                        v-model.number="item.approvedQuantity" 
                        type="number" 
                        min="0"
                        class="w-20 px-2 py-1 border border-gray-300 rounded font-bold text-gray-900 focus:ring-1 focus:ring-[#1a5c4c]"
                      />
                    </td>
                    <td class="py-2.5 px-3">
                      <input 
                        v-model.number="item.unitPrice" 
                        type="number" 
                        step="0.01" 
                        min="0"
                        class="w-24 px-2 py-1 border border-gray-300 rounded font-bold text-gray-900 focus:ring-1 focus:ring-[#1a5c4c]"
                      />
                    </td>
                    <td class="py-2.5 px-3">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-medium" :class="item.isTaxInclusive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600'">
                        {{ item.isTaxInclusive ? 'Tax Incl.' : 'Tax Excl.' }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-bold text-gray-900">
                      {{ formatCurrency(Number(item.approvedQuantity || 0) * Number(item.unitPrice || 0)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Approval Notes -->
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Approval Notes (Optional)</label>
            <textarea 
              v-model="approvalNotes" 
              rows="2"
              placeholder="e.g. Special rate approved for volume discount, priority truck dispatch authorized..."
              class="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1a5c4c]"
            ></textarea>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <span class="text-xs text-gray-500 block">Total Approved Order Value:</span>
            <span class="text-xl font-extrabold text-[#1a5c4c]">{{ formatCurrency(computedOrderTotal) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <button 
              @click="isReviewModalOpen = false" 
              class="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              @click="submitApproval" 
              :disabled="isSubmittingApproval"
              class="px-5 py-2 text-xs font-bold text-white bg-[#1a5c4c] hover:bg-[#14473b] rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="isSubmittingApproval" class="w-4 h-4 animate-spin" />
              <CheckCheck v-else class="w-4 h-4" />
              Confirm & Approve Order
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mandatory Cancellation Modal -->
    <div v-if="isCancelModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200">
        <div class="p-6">
          <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
            <AlertTriangle class="w-6 h-6" />
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-1">Cancel Order {{ orderToCancel?.orderNumber }}?</h3>
          <p class="text-xs text-gray-500 mb-4">
            Under company policy, orders cannot be deleted without audit. This will mark the order as Cancelled and record your audit log permanently.
          </p>

          <label class="block text-xs font-bold text-gray-700 mb-1">Mandatory Cancellation Reason *</label>
          <textarea 
            v-model="cancelReason" 
            rows="3"
            placeholder="e.g. Client requested cancellation due to project delay, duplicate entry, out of stock..."
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
            @click="submitCancel" 
            :disabled="isSubmittingCancel || !cancelReason.trim()"
            class="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2 v-if="isSubmittingCancel" class="w-4 h-4 animate-spin" />
            <span>Confirm Cancellation</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
