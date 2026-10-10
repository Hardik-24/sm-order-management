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
  IndianRupee,
  Loader2,
  Award,
  Ban
} from 'lucide-vue-next'
import { formatCurrency, formatDateTime } from '~/lib/utils'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useSnackbar } from '~/composables/useSnackbar'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()
const { showSnackbar } = useSnackbar()

// Filters
const page = ref(1)
const limit = ref(10)
const approveTableRef = ref<HTMLElement | null>(null)
const search = ref('')
const startDate = ref('')
const endDate = ref('')
const activeTab = ref<'PENDING' | 'URGENT' | 'APPROVED' | 'ALL'>('PENDING')

// Reset page on search or date change
watch([search, startDate, endDate], () => {
  page.value = 1
})

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
  if (startDate.value) {
    q.startDate = startDate.value
  }
  if (endDate.value) {
    q.endDate = endDate.value
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

// Universal approval statistics
const { data: statsData, refresh: refreshStats } = useFetch('/api/orders/approval-stats')

const handleRefresh = async () => {
  await Promise.all([refresh(), refreshStats()])
}

// Realtime sync
const { onOrderSync, notifyChange } = useRealtimeSync()
onOrderSync(() => {
  refresh()
  refreshStats()
})

// Drawer state
const selectedDrawerOrderId = ref<string | null>(null)
const isDrawerOpen = ref(false)

const openDrawer = (order: any) => {
  selectedDrawerOrderId.value = order.id
  isDrawerOpen.value = true
}

const handleDrawerClose = () => {
  isDrawerOpen.value = false
  selectedDrawerOrderId.value = null
}

const handleDrawerUpdate = () => {
  refresh()
  refreshStats()
}

const onDrawerReviewApprove = (order: any) => {
  openReview(order)
}

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
    refreshStats()
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
    refreshStats()
  } catch (err: any) {
    showSnackbar(err.data?.message || 'Failed to cancel order', 'error')
  } finally {
    isSubmittingCancel.value = false
  }
}

// GSAP Animation
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const tbodyRef = ref<HTMLElement | null>(null)
const numPending = ref<HTMLElement | null>(null)
const numUrgent = ref<HTMLElement | null>(null)
const numApproved = ref<HTMLElement | null>(null)
const numTotal = ref<HTMLElement | null>(null)

const counts = computed(() => {
  return {
    pending: statsData.value?.pending ?? 0,
    urgent: statsData.value?.urgent ?? 0,
    approved: statsData.value?.approved ?? 0,
    total: statsData.value?.total ?? 0
  }
})

const triggerStatAnimations = () => {
  nextTick(() => {
    if (numPending.value) animateNumber(numPending.value, counts.value.pending, { duration: 0.55 })
    if (numUrgent.value) animateNumber(numUrgent.value, counts.value.urgent, { duration: 0.6 })
    if (numApproved.value) animateNumber(numApproved.value, counts.value.approved, { duration: 0.65 })
    if (numTotal.value) animateNumber(numTotal.value, counts.value.total, { duration: 0.5 })
  })
}

const triggerRowAnimation = () => {
  nextTick(() => {
    if (!isLoading.value && tbodyRef.value) {
      const rows = tbodyRef.value.querySelectorAll('tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()
  triggerRowAnimation()
})

watch(() => counts.value, () => {
  triggerStatAnimations()
}, { deep: true })

watch([() => data.value?.orders, () => isLoading.value], () => {
  triggerRowAnimation()
}, { immediate: false })

const getPrivilegeColor = (tier: string) => {
  switch (tier) {
    case 'GOLD': return 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/40'
    case 'SILVER': return 'bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-300/40'
    default: return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}

const getItemsTotalQuantity = (order: any) => {
  if (!order.items || !order.items.length) return '0 items'
  const totalUnits = order.items.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0)
  const unit = (order.items[0] as any)?.product?.unit || 'units'
  return `${totalUnits} ${unit.toLowerCase()}`
}
</script>

<template>
  <div class="space-y-8 p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Approve Orders</h1>
        <p class="text-sm text-gray-500 mt-1">
          Verify product rates, inspect custom notes, and approve orders before fulfillment.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="handleRefresh" 
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
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
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
      <div class="bg-white rounded-xl border border-rose-200/80 p-5 shadow-sm">
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
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
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
            <p class="text-xs text-emerald-600 font-medium">Approved orders</p>
          </div>
        </div>
      </div>

      <!-- Total Orders -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
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

    <!-- Underline Tabs with Badges -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in (['PENDING', 'URGENT', 'APPROVED', 'ALL'] as const)" :key="tab"
          @click="activeTab = tab; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span v-if="tab === 'URGENT'">⚡</span>
          <span>
            {{ tab === 'PENDING' ? 'Pending Approval' : tab === 'URGENT' ? 'Urgent Orders' : tab === 'APPROVED' ? 'Approved Orders' : 'All Orders' }}
          </span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeTab === tab
                ? (tab === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-[#1a5c4c]/10 text-[#1a5c4c]')
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ tab === 'PENDING' ? counts.pending : tab === 'URGENT' ? counts.urgent : tab === 'APPROVED' ? counts.approved : counts.total }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Table Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3.5 bg-gray-50/50">
        <!-- Search -->
        <div class="relative w-full sm:w-80">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input 
            v-model="search"
            type="text"
            placeholder="Search order #, customer..." 
            class="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all"
          />
          <button 
            v-if="search" 
            @click="search = ''" 
            class="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Filter Controls -->
        <div class="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
          <TableFilterButtons
            v-model:startDate="startDate"
            v-model:endDate="endDate"
          />
          <RowsPerPageSelect v-model="limit" />
        </div>
      </div>

      <!-- Table Area with Pulsing Blur and Skeleton Support -->
      <div class="relative min-h-[220px]">
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse pointer-events-none"></div>

        <!-- Orders Table -->
        <div ref="approveTableRef" class="overflow-x-auto no-scrollbar">
          <table class="w-full text-left text-sm text-gray-600">
            <thead class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th class="px-5 py-3.5 whitespace-nowrap">Order</th>
                <th class="px-5 py-3.5">Customer & Tier</th>
                <th class="px-5 py-3.5">Items</th>
                <th class="px-5 py-3.5">Status & Approval</th>
                <th class="px-5 py-3.5 text-right whitespace-nowrap pr-5">Actions</th>
              </tr>
            </thead>
            <tbody ref="tbodyRef" class="divide-y divide-gray-100 bg-white">
              <!-- Skeleton Rows when loading and no data -->
              <template v-if="isLoading && (!data?.orders || data.orders.length === 0)">
                <tr v-for="i in 6" :key="'skel-' + i" class="animate-pulse hover:bg-transparent">
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="h-4 bg-gray-200 rounded w-24 mb-1.5"></div>
                    <div class="h-3 bg-gray-100 rounded w-16"></div>
                  </td>
                  <td class="px-5 py-4">
                    <div class="h-4 bg-gray-200 rounded w-36 mb-1.5"></div>
                    <div class="h-3 bg-gray-100 rounded w-24"></div>
                  </td>
                  <td class="px-5 py-4">
                    <div class="h-4 bg-gray-200 rounded w-44 mb-1.5"></div>
                    <div class="h-3 bg-gray-100 rounded w-20"></div>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="h-6 bg-gray-200 rounded-full w-28"></div>
                  </td>
                  <td class="px-5 py-4 text-right whitespace-nowrap pr-5">
                    <div class="flex flex-col items-end gap-1.5">
                      <div class="h-7 bg-gray-200 rounded-lg w-28"></div>
                      <div class="h-6 bg-gray-100 rounded-lg w-20"></div>
                    </div>
                  </td>
                </tr>
              </template>

              <!-- Empty state -->
              <tr v-else-if="!isLoading && (!data?.orders || data.orders.length === 0)" class="text-center py-8">
                <td colspan="5" class="py-14 text-center text-gray-400">
                  <CheckCheck class="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
                  <p class="text-sm font-semibold text-gray-700">No orders pending approval</p>
                  <p class="text-xs text-gray-400 mt-0.5">All orders matching criteria have been reviewed.</p>
                </td>
              </tr>
            <tr 
              v-else 
              v-for="order in data.orders" 
              :key="order.id"
              @click="openDrawer(order)"
              class="cursor-pointer transition-colors duration-150 group"
              :class="order.overallStatus === 'CANCELLED' 
                ? 'bg-gray-100/60 hover:bg-gray-100/80 text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
                : (order.isUrgent ? 'bg-rose-50/25 hover:bg-rose-50/40 border-l-4 border-l-rose-500' : 'hover:bg-gray-50/80')"
            >
              <!-- 1. ORDER: Order ID (not clickable link), urgent/cancelled badge, then created at -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-gray-900 group-hover:text-[#1a5c4c] transition-colors">
                    {{ order.orderNumber }}
                  </span>
                  <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 !text-gray-600 border border-rose-500">
                    🚫 CANCELLED
                  </span>
                  <span v-else-if="order.isUrgent" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                    ⚡ URGENT
                  </span>
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                  {{ formatDateTime(order.createdAt) }}
                </p>
              </td>

              <!-- 2. CUSTOMER & TIER: Name, Tier, Company • City/Phone (no address) -->
              <td class="px-5 py-3.5 min-w-0">
                <div class="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5" :title="order.customer?.name || 'Walk-in Customer'">
                  <span class="truncate">{{ order.customer?.name || 'Walk-in Customer' }}</span>
                  <span 
                    v-if="order.customer?.privilegeTier" 
                    class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border shadow-2xs"
                    :class="getPrivilegeColor(order.customer.privilegeTier)"
                  >
                    {{ order.customer.privilegeTier }}
                  </span>
                  <span v-if="order.customer?.isPriorityClient" class="text-amber-500 font-bold text-xs shrink-0" title="Priority Client">★</span>
                </div>
                <p class="text-[11px] text-gray-500 truncate mt-0.5" :title="[order.customer?.company, order.customer?.city || order.customer?.phone].filter(Boolean).join(' • ') || '—'">
                  {{ [order.customer?.company, order.customer?.city || order.customer?.phone].filter(Boolean).join(' • ') || '—' }}
                </p>
              </td>

              <!-- 3. ITEMS / QTY: First line SKUs, second line total nos -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div 
                  class="text-xs font-bold text-gray-800 truncate max-w-[200px]" 
                  :title="order.items?.map((i: any) => i.sku || i.product?.sku || i.productName || i.product?.name).filter(Boolean).join(', ') || '—'"
                >
                  {{ order.items?.map((i: any) => i.sku || i.product?.sku || i.productName || i.product?.name).filter(Boolean).join(', ') || '—' }}
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5">
                  {{ getItemsTotalQuantity(order) }}
                </p>
              </td>

              <!-- 4. STATUS & APPROVAL -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div v-if="order.isApproved" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approved {{ order.approvedBy ? `by ${order.approvedBy.name}` : '' }}</span>
                </div>
                <div v-else-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <XCircle class="w-3.5 h-3.5 text-rose-600" />
                  <span>Cancelled</span>
                </div>
                <div v-else class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock class="w-3.5 h-3.5 text-amber-600" />
                  <span>Pending Approval</span>
                </div>
              </td>

              <!-- 5. ACTIONS: Review & Approve above, Cancel Order below -->
              <td class="px-5 py-3.5 text-right whitespace-nowrap pr-5">
                <div class="flex flex-col items-end gap-1.5">
                  <button 
                    v-if="!order.isApproved && order.overallStatus !== 'CANCELLED'"
                    @click.stop="openReview(order)"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a5c4c] text-white hover:bg-[#14473b] shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCheck class="w-3.5 h-3.5" />
                    <span>Review & Approve</span>
                  </button>
                  <button 
                    v-if="order.overallStatus !== 'CANCELLED' && order.overallStatus !== 'DELIVERED'"
                    @click.stop="openCancelModal(order)"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Cancel Order"
                  >
                    <Ban class="w-3 h-3 text-rose-500" />
                    <span>Cancel Order</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="approveTableRef" />
    </div>

      <!-- Pagination -->
      <div v-if="data?.totalPages > 1" class="p-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 bg-gray-50/30">
        <div>Showing page <span class="font-semibold text-gray-900">{{ page }}</span> of <span class="font-semibold text-gray-900">{{ data.totalPages }}</span></div>
        <div class="flex gap-2">
          <button 
            :disabled="page <= 1" 
            @click="page--"
            class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <button 
            :disabled="page >= data.totalPages" 
            @click="page++"
            class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Review & Approve Modal -->
    <Teleport to="body">
      <div v-if="isReviewModalOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200/80">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#1c1c1c] text-white shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCheck class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-bold">Approve Order: {{ selectedOrder?.orderNumber }}</h3>
              <p class="text-xs text-gray-400">Customer: {{ selectedOrder?.customer?.name }} ({{ selectedOrder?.customer?.company || 'Direct' }})</p>
            </div>
          </div>
          <button @click="isReviewModalOpen = false" class="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto flex-1 space-y-6">
          <!-- Client & Delivery Card -->
          <div class="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center text-xs">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#1a5c4c] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                {{ (selectedOrder?.customer?.company || selectedOrder?.customer?.name || 'C')[0]?.toUpperCase() }}
              </div>
              <div>
                <div class="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span>{{ selectedOrder?.customer?.company || selectedOrder?.customer?.name }}</span>
                  <span 
                    v-if="selectedOrder?.customer?.privilegeTier" 
                    class="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase border shadow-2xs"
                    :class="getPrivilegeColor(selectedOrder?.customer?.privilegeTier)"
                  >
                    {{ selectedOrder?.customer?.privilegeTier }}
                  </span>
                  <span 
                    v-if="selectedOrder?.customer?.isPriorityClient"
                    class="text-[9px] px-1.5 py-0.5 rounded-md font-bold text-amber-700 bg-amber-50 border border-amber-200 shadow-2xs"
                  >
                    ★ Priority Client
                  </span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span v-if="selectedOrder?.customer?.name && selectedOrder?.customer?.company">{{ selectedOrder?.customer?.name }}</span>
                  <span v-if="selectedOrder?.customer?.phone" class="text-gray-400 flex items-center gap-1">
                    <Phone class="w-3 h-3" /> {{ selectedOrder?.customer?.phone }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:items-end gap-1 text-xs text-gray-600">
              <div class="flex items-center gap-1.5">
                <span v-if="selectedOrder?.isUrgent" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  ⚡ URGENT ORDER
                </span>
                <span v-if="selectedOrder?.customer?.paymentTerms" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  {{ selectedOrder?.customer?.paymentTerms }}
                </span>
              </div>
              <div class="flex items-center gap-1 text-gray-500 text-xs truncate max-w-xs mt-0.5">
                <MapPin class="w-3 h-3 text-gray-400 shrink-0" />
                <span class="truncate">{{ selectedOrder?.deliveryAddress || 'Registered Location' }}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <div>
                <h4 class="text-sm font-bold text-gray-900">Item Verification & Rate Adjustment</h4>
                <p class="text-xs text-gray-500 mt-0.5">Adjust approved quantities or rates if volume discounts apply</p>
              </div>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {{ editableItems.length }} item{{ editableItems.length > 1 ? 's' : '' }}
              </span>
            </div>

            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table class="w-full text-left text-xs">
                <thead class="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th class="py-2.5 px-3.5">Item & SKU</th>
                    <th class="py-2.5 px-3 text-center">Ordered</th>
                    <th class="py-2.5 px-3">Approved Qty</th>
                    <th class="py-2.5 px-3">Unit Rate (₹)</th>
                    <th class="py-2.5 px-3 text-center">Tax Mode</th>
                    <th class="py-2.5 px-3.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr v-for="item in editableItems" :key="item.id" class="hover:bg-gray-50/60 transition-colors">
                    <td class="py-3 px-3.5">
                      <div class="font-semibold text-gray-900 text-xs sm:text-sm">{{ item.productName }}</div>
                      <div class="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span class="font-mono bg-gray-100 px-1.5 py-0.2 rounded text-gray-600">SKU: {{ item.sku }}</span>
                        <span v-if="item.applyLastPrice" class="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                          Last Price Applied
                        </span>
                      </div>
                      <div v-if="item.itemNotes" class="mt-1.5 text-xs text-amber-800 bg-amber-50/90 p-2 rounded-lg border border-amber-200/80 flex items-start gap-1.5">
                        <span class="font-bold shrink-0">Note:</span>
                        <span>{{ item.itemNotes }}</span>
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center font-semibold text-gray-600">
                      {{ item.quantity }}
                    </td>
                    <td class="py-3 px-3">
                      <input 
                        v-model.number="item.approvedQuantity" 
                        type="number" 
                        min="0"
                        class="w-20 px-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-900 text-xs focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none transition-all"
                      />
                    </td>
                    <td class="py-3 px-3">
                      <div class="relative flex items-center w-28">
                        <IndianRupee class="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input 
                          v-model.number="item.unitPrice" 
                          type="number" 
                          step="0.01" 
                          min="0"
                          class="w-full pl-7 pr-2.5 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-900 text-xs focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none transition-all"
                        />
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="item.isTaxInclusive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600'">
                        {{ item.isTaxInclusive ? 'Tax Incl.' : 'Tax Excl.' }}
                      </span>
                    </td>
                    <td class="py-3 px-3.5 text-right font-bold text-gray-900">
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
              class="w-full p-3 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/90 rounded-b-2xl shrink-0">
          <div>
            <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Total Approved Order Value</span>
            <span class="text-2xl font-extrabold text-[#1a5c4c]">{{ formatCurrency(computedOrderTotal) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <button 
              @click="isReviewModalOpen = false" 
              class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              @click="submitApproval" 
              :disabled="isSubmittingApproval"
              class="px-6 py-2.5 text-xs font-bold text-white bg-[#1a5c4c] hover:bg-[#14473b] rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isSubmittingApproval" class="w-4 h-4 animate-spin" />
              <CheckCheck v-else class="w-4 h-4" />
              <span>Confirm & Approve Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Mandatory Cancellation Modal -->
    <Teleport to="body">
      <div v-if="isCancelModalOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200">
          <div class="p-6">
            <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 ring-4 ring-rose-50/50">
              <AlertTriangle class="w-6 h-6" />
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">Cancel Order {{ orderToCancel?.orderNumber }}?</h3>
            <p class="text-xs text-gray-500 mb-4 leading-relaxed">
              Under company policy, orders cannot be deleted without audit. This will mark the order as Cancelled and record your audit log permanently.
            </p>

            <label class="block text-xs font-bold text-gray-700 mb-1.5">Mandatory Cancellation Reason *</label>
            <textarea 
              v-model="cancelReason" 
              rows="3"
              placeholder="e.g. Client requested cancellation due to project delay, duplicate entry, out of stock..."
              class="w-full p-3 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all resize-none"
            ></textarea>
          </div>

          <div class="px-6 py-3.5 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-2.5 rounded-b-2xl">
            <button 
              @click="isCancelModalOpen = false"
              class="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Go Back
            </button>
            <button 
              @click="submitCancel" 
              :disabled="isSubmittingCancel || !cancelReason.trim()"
              class="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isSubmittingCancel" class="w-4 h-4 animate-spin" />
              <span>Confirm Cancellation</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Order Detail Panel (Slide-over drawer at the right) -->
    <OrderDetailPanel 
      :orderId="selectedDrawerOrderId"
      :isOpen="isDrawerOpen"
      context="approval"
      @close="handleDrawerClose"
      @updated="handleDrawerUpdate"
      @review-approve="onDrawerReviewApprove"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
.no-scrollbar {
  -ms-overflow-style: none !important;
  scrollbar-width: none !important;
}
</style>
