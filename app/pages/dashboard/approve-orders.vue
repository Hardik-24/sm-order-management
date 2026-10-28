<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
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
    q.status = '!CANCELLED'
  } else if (activeTab.value === 'URGENT') {
    q.isUrgent = 'true'
    q.isApproved = 'false'
    q.status = '!CANCELLED'
  } else if (activeTab.value === 'APPROVED') {
    q.isApproved = 'true'
    q.status = '!CANCELLED'
  } else if (activeTab.value === 'ALL') {
    q.status = '!CANCELLED'
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
  const orderNumber = selectedOrder.value.orderNumber
  const orderId = selectedOrder.value.id
  isSubmittingApproval.value = true
  try {
    await $fetch(`/api/orders/${orderId}/approve`, {
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
    // 1. Immediately close modal upon success
    isReviewModalOpen.value = false
    selectedOrder.value = null

    // 2. Show proper snackbar
    showSnackbar(`Order ${orderNumber} approved successfully and sent to Packing & Billing!`, 'success')

    // 3. Broadcast websocket notification to all devices + tabs
    notifyChange({ action: 'ORDER_APPROVED', orderId })

    // 4. Refresh local table & stats
    await handleRefresh()
  } catch (err: any) {
    showSnackbar(err.data?.message || 'Failed to approve order', 'error')
  } finally {
    isSubmittingApproval.value = false
  }
}

const openCancelModal = (order: any) => {
  if (order.billingStatus?.status === 'GENERATED' || order.billingStatus?.invoiceNumber) {
    showSnackbar('This order cannot be cancelled because its bill/invoice has already been generated.', 'error')
    return
  }
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
  const orderNumber = orderToCancel.value.orderNumber
  const orderId = orderToCancel.value.id
  isSubmittingCancel.value = true
  try {
    await $fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      body: { reason: cancelReason.value.trim() }
    })
    isCancelModalOpen.value = false
    orderToCancel.value = null
    showSnackbar(`Order ${orderNumber} has been cancelled`, 'info')
    notifyChange({ action: 'ORDER_CANCELLED', orderId })
    await handleRefresh()
  } catch (err: any) {
    showSnackbar(err.data?.message || 'Failed to cancel order', 'error')
  } finally {
    isSubmittingCancel.value = false
  }
}

// GSAP Animation
const { animateStagger, animateModalOpen, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)
const reviewModalCardRef = ref<HTMLElement | null>(null)
const cancelModalCardRef = ref<HTMLElement | null>(null)

watch(isReviewModalOpen, (open) => {
  if (open) {
    nextTick(() => {
      if (reviewModalCardRef.value) animateModalOpen(reviewModalCardRef.value)
    })
  }
})

watch(isCancelModalOpen, (open) => {
  if (open) {
    nextTick(() => {
      if (cancelModalCardRef.value) animateModalOpen(cancelModalCardRef.value)
    })
  }
})

const counts = computed(() => {
  return {
    pending: statsData.value?.pending ?? 0,
    urgent: statsData.value?.urgent ?? 0,
    approved: statsData.value?.approved ?? 0,
    total: statsData.value?.total ?? 0
  }
})

const triggerRowAnimation = () => {
  nextTick(() => {
    if (!isLoading.value) {
      if (tbodyRef.value) {
        const rows = tbodyRef.value.querySelectorAll('tr')
        const targetRows = Array.from(rows).slice(0, 15)
        animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
      }
      if (mobileListRef.value) {
        const targetCards = Array.from(mobileListRef.value.children).slice(0, 15)
        animateStagger(targetCards, { duration: 0.18, stagger: 0.015, y: 4 })
      }
    }
  })
}

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerRowAnimation()

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      handleRefresh()
    }
  }
  window.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', handleRefresh)

  onUnmounted(() => {
    window.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', handleRefresh)
  })
})

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

const getItemsCountText = (order: any) => {
  const count = order.items?.length || 0
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

const getTotalNos = (order: any) => {
  if (!order.items || !order.items.length) return '0 nos.'
  const totalUnits = order.items.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0)
  return `${totalUnits} nos.`
}
</script>

<template>
  <div class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Approve Orders</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-0.5">
          Verify product rates, inspect custom notes, and approve orders before fulfillment.
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <button 
          @click="handleRefresh" 
          :disabled="isLoading"
          class="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
        >
          <RefreshCw class="w-3.5 h-3.5 sm:w-4 sm:h-4" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
      <!-- Pending Approval -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <Clock class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Pending</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
              <OdometerNumber :value="counts.pending" :loading="isLoading" />
            </h3>
            <p class="text-[10px] sm:text-xs text-amber-600 font-medium truncate">Awaiting review</p>
          </div>
        </div>
      </div>

      <!-- Urgent Orders -->
      <div class="bg-white rounded-xl border border-rose-200/80 p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-rose-50 p-2 sm:p-2.5 rounded-lg text-rose-600 border border-rose-100/50">
              <Zap class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-rose-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[9px] sm:text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-0.5 truncate">⚡ Urgent</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
              <OdometerNumber :value="counts.urgent" :loading="isLoading" />
            </h3>
            <p class="text-[10px] sm:text-xs text-rose-500 font-medium truncate">High priority</p>
          </div>
        </div>
      </div>

      <!-- Approved -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-[#1b3b5f]/10 p-2 sm:p-2.5 rounded-lg text-[#1b3b5f] border border-[#1b3b5f]/20">
              <CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1b3b5f] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Approved</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
              <OdometerNumber :value="counts.approved" :loading="isLoading" />
            </h3>
            <p class="text-[10px] sm:text-xs text-emerald-600 font-medium truncate">Approved</p>
          </div>
        </div>
      </div>

      <!-- Total Orders -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-gray-100 p-2 sm:p-2.5 rounded-lg text-gray-600 border border-gray-200/50">
              <Package class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-gray-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
              <OdometerNumber :value="counts.total" :loading="isLoading" />
            </h3>
            <p class="text-[10px] sm:text-xs text-gray-500 truncate">Total listed</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Underline Tabs with Badges -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in (['PENDING', 'URGENT', 'APPROVED', 'ALL'] as const)" :key="tab"
          @click="activeTab = tab; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
          :class="activeTab === tab ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span v-if="tab === 'URGENT'">⚡</span>
          <span>
            {{ tab === 'PENDING' ? 'Pending Approval' : tab === 'URGENT' ? 'Urgent Orders' : tab === 'APPROVED' ? 'Approved Orders' : 'All Orders' }}
          </span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeTab === tab
                ? (tab === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-[#1b3b5f]/10 text-[#1b3b5f]')
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
            class="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition-all"
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
        <div class="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-nowrap">
          <TableFilterButtons
            v-model:startDate="startDate"
            v-model:endDate="endDate"
          />
          <RowsPerPageSelect v-model="limit" />
        </div>
      </div>

      <!-- Table Area with Shimmer Skeletons & Top Loading Bar -->
      <div class="relative min-h-[220px]">
        <LoadingTopBar :active="isLoading" />
        <div v-if="isLoading && data?.orders?.length > 0" class="absolute inset-0 bg-white/40 pointer-events-none z-10 transition-opacity"></div>

        <!-- Orders Table (Desktop Only - 100% Unchanged) -->
        <div ref="approveTableRef" class="hidden md:block overflow-x-auto no-scrollbar">
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
              <!-- Skeleton Shimmer Rows when loading and no data -->
              <TableSkeletonRows v-if="isLoading && (!data?.orders || data.orders.length === 0)" :rows="6" :cols="5" />

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
                  <span class="text-xs font-bold text-gray-900 group-hover:text-[#1b3b5f] transition-colors">
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

              <!-- 3. ITEMS / QTY: First line n items, second line n nos. -->
              <td class="px-5 py-3.5 whitespace-nowrap" :title="order.items?.map((i: any) => i.sku || i.product?.sku || i.productName || i.product?.name).filter(Boolean).join(', ') || '—'">
                <div class="text-xs font-bold text-gray-800">
                  {{ getItemsCountText(order) }}
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5">
                  {{ getTotalNos(order) }}
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
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1b3b5f] text-white hover:bg-[#132c49] shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCheck class="w-3.5 h-3.5" />
                    <span>Review & Approve</span>
                  </button>
                  <button 
                    v-if="order.overallStatus !== 'CANCELLED' && order.overallStatus !== 'DELIVERED' && order.billingStatus?.status !== 'GENERATED' && !order.billingStatus?.invoiceNumber"
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

      <!-- Mobile Card List View (Mobile Only: md:hidden) -->
      <div ref="mobileListRef" class="md:hidden divide-y divide-gray-100 bg-white">
        <!-- Mobile Skeleton Shimmer Loading -->
        <TableSkeletonRows v-if="isLoading && (!data?.orders || data.orders.length === 0)" :rows="5" :cols="1" isMobile />

        <!-- Mobile Empty State -->
        <div v-else-if="!isLoading && (!data?.orders || data.orders.length === 0)" class="py-12 px-4 text-center text-gray-400">
          <CheckCheck class="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
          <p class="text-sm font-semibold text-gray-700">No orders pending approval</p>
          <p class="text-xs text-gray-400 mt-0.5">All orders matching criteria have been reviewed.</p>
        </div>

        <!-- Mobile Order Cards -->
        <div
          v-else
          v-for="order in data.orders"
          :key="'mob-' + order.id"
          @click="openDrawer(order)"
          class="p-3.5 space-y-2.5 cursor-pointer transition-colors active:bg-gray-100/70"
          :class="order.overallStatus === 'CANCELLED' 
            ? 'bg-gray-100/60 opacity-60 border-l-4 border-l-gray-400' 
            : (order.isUrgent ? 'bg-rose-50/25 border-l-4 border-l-rose-500' : 'hover:bg-gray-50/80')"
        >
          <!-- Line 1: Order #, Tag, Date, and Status Badge -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-wrap min-w-0">
              <span class="text-xs font-bold text-gray-900 tracking-tight">
                {{ order.orderNumber }}
              </span>
              <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-200 !text-gray-600 border border-rose-500">
                🚫 CANCELLED
              </span>
              <span v-else-if="order.isUrgent" class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                ⚡ URGENT
              </span>
              <span class="text-gray-300 text-xs">•</span>
              <span class="text-[10px] text-gray-400 tabular-nums">
                {{ formatDateTime(order.createdAt) }}
              </span>
            </div>

            <!-- Approval Status Pill -->
            <div v-if="order.isApproved" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <CheckCircle2 class="w-3 h-3 text-emerald-600" />
              <span>Approved</span>
            </div>
            <div v-else-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
              <XCircle class="w-3 h-3 text-rose-600" />
              <span>Cancelled</span>
            </div>
            <div v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              <Clock class="w-3 h-3 text-amber-600" />
              <span>Pending</span>
            </div>
          </div>

          <!-- Line 2: Customer Name, Tier Badge & Items / Units Summary -->
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-gray-900 truncate">
                  {{ order.customer?.name || 'Walk-in Customer' }}
                </span>
                <span 
                  v-if="order.customer?.privilegeTier" 
                  class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border shadow-2xs"
                  :class="getPrivilegeColor(order.customer.privilegeTier)"
                >
                  {{ order.customer.privilegeTier }}
                </span>
                <span v-if="order.customer?.isPriorityClient" class="text-amber-500 font-bold text-xs shrink-0" title="Priority Client">★</span>
              </div>
              <p class="text-[11px] text-gray-500 truncate mt-0.5">
                {{ [order.customer?.company, order.customer?.city || order.customer?.phone].filter(Boolean).join(' • ') || '—' }}
              </p>
            </div>

            <div class="text-right shrink-0">
              <div class="text-xs font-bold text-gray-800">
                {{ getItemsCountText(order) }}
              </div>
              <div class="text-[10px] text-gray-400">
                {{ getTotalNos(order) }}
              </div>
            </div>
          </div>

          <!-- Line 3: Touch-Friendly Action Buttons -->
          <div class="flex items-center gap-2 pt-1 border-t border-gray-100">
            <button 
              v-if="!order.isApproved && order.overallStatus !== 'CANCELLED'"
              @click.stop="openReview(order)"
              class="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#1b3b5f] text-white hover:bg-[#132c49] shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
            >
              <CheckCheck class="w-3.5 h-3.5" />
              <span>Review & Approve</span>
            </button>
            <button 
              v-if="order.overallStatus !== 'CANCELLED' && order.overallStatus !== 'DELIVERED' && order.billingStatus?.status !== 'GENERATED' && !order.billingStatus?.invoiceNumber"
              @click.stop="openCancelModal(order)"
              class="px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200 flex items-center justify-center gap-1 cursor-pointer"
              title="Cancel Order"
            >
              <Ban class="w-3.5 h-3.5 text-rose-500" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="approveTableRef" />
    </div>

      <!-- Pagination -->
      <div v-if="data?.totalPages > 1" class="p-3 sm:p-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 bg-gray-50/30">
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
      <div 
        v-if="isReviewModalOpen" 
        class="fixed inset-0 z-[350] flex items-center justify-center p-2 sm:p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="isReviewModalOpen = false"></div>
        
        <div 
          ref="reviewModalCardRef" 
          class="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[90vh] overflow-hidden border border-gray-100"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50 shrink-0">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCheck class="w-5 h-5 text-[#1b3b5f]" />
                <span>Review & Approve Order</span>
              </h2>
              <p class="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Order: {{ selectedOrder?.orderNumber }}</p>
            </div>
            <button @click="isReviewModalOpen = false" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors cursor-pointer">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <!-- Customer Details Row -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
              <div>
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Customer Details</p>
                <p class="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>{{ selectedOrder?.customer?.company || selectedOrder?.customer?.name }}</span>
                  <span 
                    v-if="selectedOrder?.customer?.privilegeTier" 
                    class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border shadow-2xs" 
                    :class="getPrivilegeColor(selectedOrder?.customer?.privilegeTier)"
                  >
                    {{ selectedOrder?.customer?.privilegeTier }}
                  </span>
                  <span 
                    v-if="selectedOrder?.customer?.isPriorityClient" 
                    class="text-[9px] px-1.5 py-0.5 rounded font-bold text-amber-700 bg-amber-50 border border-amber-200 shadow-2xs"
                  >
                    ★ Priority
                  </span>
                </p>
                <p v-if="selectedOrder?.customer?.name && selectedOrder?.customer?.company" class="text-xs text-gray-600 mt-0.5">{{ selectedOrder?.customer?.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                  <MapPin class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{{ selectedOrder?.deliveryAddress || selectedOrder?.customer?.address || 'Direct Delivery' }}</span>
                </p>
                <p v-if="selectedOrder?.customer?.phone" class="text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
                  <Phone class="w-3 h-3" /> {{ selectedOrder?.customer?.phone }}
                </p>
              </div>
              
              <div class="space-y-2">
                <div class="grid grid-cols-2 gap-2">
                  <div class="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Order Date</span>
                    <span class="text-xs font-semibold text-gray-800">{{ formatDateTime(selectedOrder?.createdAt) }}</span>
                  </div>
                  <div class="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Payment Terms</span>
                    <span class="text-xs font-semibold text-gray-800">{{ selectedOrder?.customer?.paymentTerms || 'Standard' }}</span>
                  </div>
                </div>
                <div v-if="selectedOrder?.isUrgent" class="p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <Zap class="w-4 h-4 fill-rose-600 shrink-0" />
                  <span>⚡ Urgent Priority Order - Expedited Processing</span>
                </div>
              </div>
            </div>

            <!-- Items Verification Table (Scrollable on mobile, unified clean layout without plus/minus) -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-bold text-gray-900 uppercase tracking-widest">
                  Item Verification & Rate Adjustment
                </h3>
                <span class="text-xs text-gray-500">
                  {{ editableItems.length }} item{{ editableItems.length > 1 ? 's' : '' }}
                </span>
              </div>

              <div class="border border-gray-200 rounded-xl overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[700px] text-xs">
                  <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 font-bold text-gray-500 uppercase tracking-widest text-[10px]">
                      <th class="px-3 py-3">Item / SKU</th>
                      <th class="px-3 py-3 text-center w-20">Ordered</th>
                      <th class="px-3 py-3 text-center w-28">Approved Qty</th>
                      <th class="px-3 py-3 text-right w-32">Rate (₹)</th>
                      <th class="px-3 py-3 text-center w-24">Tax Mode</th>
                      <th class="px-3 py-3 text-right w-28">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white">
                    <tr v-for="item in editableItems" :key="item.id" class="hover:bg-gray-50/50">
                      <td class="px-3 py-2.5">
                        <p class="font-bold text-gray-900">{{ item.productName }}</p>
                        <p class="text-[11px] text-gray-500 mt-0.5 font-mono">
                          SKU: {{ item.sku }}
                        </p>
                        <div class="flex flex-wrap items-center gap-1.5 mt-1">
                          <span 
                            v-if="item.applyLastPrice" 
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                            title="Applied Customer's Last Agreed Price"
                          >
                            Last Price
                          </span>
                          <span 
                            v-if="item.itemNotes" 
                            class="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 truncate max-w-[220px]" 
                            :title="item.itemNotes"
                          >
                            💬 {{ item.itemNotes }}
                          </span>
                        </div>
                      </td>
                      <td class="px-3 py-2.5 text-center text-gray-600 font-semibold">{{ item.quantity }}</td>
                      <td class="px-3 py-2.5 text-center">
                        <input 
                          type="number" 
                          min="0"
                          v-model.number="item.approvedQuantity" 
                          class="w-20 text-center font-bold text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] bg-white outline-none" 
                        />
                      </td>
                      <td class="px-3 py-2.5 text-right">
                        <div class="relative inline-flex items-center">
                          <span class="absolute left-2 text-gray-400 text-xs">₹</span>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            v-model.number="item.unitPrice" 
                            class="w-28 text-right pl-5 pr-2 text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] bg-white font-medium outline-none" 
                          />
                        </div>
                      </td>
                      <td class="px-3 py-2.5 text-center">
                        <span 
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          :class="item.isTaxInclusive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600'"
                        >
                          {{ item.isTaxInclusive ? 'Tax Incl.' : 'Tax Excl.' }}
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-right font-bold text-gray-900">
                        {{ formatCurrency(Number(item.approvedQuantity || 0) * Number(item.unitPrice || 0)) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Approval Notes & Summary Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Approval Notes (Optional)</label>
                <textarea 
                  v-model="approvalNotes" 
                  rows="3"
                  placeholder="e.g. Special rate approved for volume discount, priority truck dispatch authorized..."
                  class="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:ring-[#1b3b5f] focus:border-[#1b3b5f] outline-none resize-none bg-white"
                ></textarea>
              </div>

              <div class="flex justify-end">
                <div class="w-full sm:w-80 bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
                  <div class="flex justify-between items-center text-gray-600">
                    <span>Total Items</span>
                    <span class="font-semibold">{{ editableItems.length }}</span>
                  </div>
                  <div class="flex justify-between items-center text-gray-600">
                    <span>Total Approved Units</span>
                    <span class="font-semibold">{{ editableItems.reduce((sum, itm) => sum + Number(itm.approvedQuantity || 0), 0) }}</span>
                  </div>
                  <div class="pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span class="text-xs font-bold text-gray-900 uppercase tracking-widest">Total Approved Value</span>
                    <span class="text-xl font-black text-[#1b3b5f]">{{ formatCurrency(computedOrderTotal) }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 shrink-0">
            <button 
              @click="isReviewModalOpen = false" 
              type="button"
              class="w-full sm:w-auto text-center px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              @click="submitApproval" 
              :disabled="isSubmittingApproval"
              type="button"
              class="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-2 bg-[#1b3b5f] text-white text-xs font-bold rounded-lg hover:bg-[#132c49] transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Loader2 v-if="isSubmittingApproval" class="w-4 h-4 animate-spin" />
              <CheckCheck v-else class="w-4 h-4" />
              <span>Confirm & Approve Order</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Mandatory Cancellation Modal -->
    <Teleport to="body">
      <div v-if="isCancelModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div ref="cancelModalCardRef" class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200">
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
