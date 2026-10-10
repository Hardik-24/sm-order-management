<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Inbox, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  Package, 
  AlertTriangle, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Trash2,
  Loader2
} from 'lucide-vue-next'
import { formatCurrency, formatDateTime, timeAgo } from '~/lib/utils'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useSnackbar } from '~/composables/useSnackbar'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import ConfirmOrderRequestModal from '~/components/dashboard/ConfirmOrderRequestModal.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user, hasRole } = useAuth()

// Shared sidebar state
const isSidebarCollapsed = useState<boolean>('sidebarCollapsed', () => false)
const desktopTableScrollRef = ref<HTMLElement | null>(null)

// Query filters
const page = ref(1)
const limit = ref(10)
const search = ref('')
const activeTab = ref<'ALL' | 'PENDING' | 'CONFIRMED' | 'DECLINED'>('ALL')

const queryObj = computed(() => {
  const q: any = {
    page: page.value,
    limit: limit.value
  }
  if (activeTab.value !== 'ALL') {
    q.status = activeTab.value
  }
  if (search.value.trim()) {
    q.search = search.value.trim()
  }
  return q
})

const { data, pending: isLoading, refresh } = useFetch('/api/order-requests', {
  query: queryObj,
  watch: [queryObj]
})

// Realtime sync
const { onOrderSync, notifyChange } = useRealtimeSync()
onOrderSync((event) => {
  refresh()
  if (selectedRequestId.value && isDrawerOpen.value) {
    openDetail(selectedRequestId.value, true)
  }
})

// Detail drawer state
const selectedRequestId = ref<string | null>(null)
const isDrawerOpen = ref(false)
const selectedRequest = ref<any | null>(null)
const matchedCustomer = ref<any | null>(null)
const isDetailLoading = ref(false)
const isConverting = ref(false)
const isDeclining = ref(false)
const showDeclineModal = ref(false)
const declineReason = ref('')
const actionError = ref('')

const openDetail = async (id: string, silent = false) => {
  selectedRequestId.value = id
  isDrawerOpen.value = true
  if (!silent) isDetailLoading.value = true
  actionError.value = ''
  
  try {
    const res = await $fetch<any>(`/api/order-requests/${id}`)
    selectedRequest.value = res.request
    matchedCustomer.value = res.matchedCustomer
  } catch (err: any) {
    actionError.value = err?.data?.message || 'Failed to load request details'
  } finally {
    if (!silent) isDetailLoading.value = false
  }
}

const closeDrawer = () => {
  isDrawerOpen.value = false
  selectedRequestId.value = null
  selectedRequest.value = null
  matchedCustomer.value = null
  showDeclineModal.value = false
  declineReason.value = ''
  actionError.value = ''
}

const isConfirmModalOpen = ref(false)

const openConfirmModal = () => {
  if (!selectedRequest.value) return
  isConfirmModalOpen.value = true
}

const quickConfirm = async (req: any) => {
  await openDetail(req.id)
  isConfirmModalOpen.value = true
}

const onOrderConverted = async (createdOrder: any) => {
  isConfirmModalOpen.value = false
  await refresh()
  if (selectedRequestId.value) {
    await openDetail(selectedRequestId.value)
  }
}

// Direct Convert fallback (if needed)
const handleConvert = async () => {
  if (!selectedRequest.value) return
  isConverting.value = true
  actionError.value = ''

  try {
    const res = await $fetch<any>(`/api/order-requests/${selectedRequest.value.id}/convert`, {
      method: 'POST',
      body: {
        customerId: matchedCustomer.value?.id || undefined,
        salesPersonId: user.value?.id
      }
    })

    if (res.success && res.order) {
      notifyChange({
        action: 'ORDER_CREATED',
        orderId: res.order.id,
        order: res.order
      })
      await refresh()
      closeDrawer()
      router.push({ path: '/dashboard/orders', query: { search: res.order.orderNumber } })
    }
  } catch (err: any) {
    actionError.value = err?.data?.message || 'Failed to convert request to order'
  } finally {
    isConverting.value = false
  }
}

// Decline Request
const handleDecline = async () => {
  if (!selectedRequest.value) return
  isDeclining.value = true
  actionError.value = ''

  try {
    const res = await $fetch<any>(`/api/order-requests/${selectedRequest.value.id}/status`, {
      method: 'PATCH',
      body: {
        status: 'DECLINED',
        declinedReason: declineReason.value || 'Declined by sales representative'
      }
    })

    if (res.success) {
      notifyChange({
        action: 'ORDER_REQUEST_UPDATED',
        requestId: selectedRequest.value.id
      })
      await refresh()
      closeDrawer()
    }
  } catch (err: any) {
    actionError.value = err?.data?.message || 'Failed to decline request'
  } finally {
    isDeclining.value = false
    showDeclineModal.value = false
  }
}

const snackbar = useSnackbar()
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)
const requestToDelete = ref<any>(null)

const confirmDelete = (req: any) => {
  requestToDelete.value = req
  showDeleteConfirm.value = true
}

const executeDelete = async () => {
  if (!requestToDelete.value) return
  isDeleting.value = true
  
  try {
    await $fetch(`/api/order-requests/${requestToDelete.value.id}`, {
      method: 'DELETE'
    })
    
    snackbar.showSaved(`Order request ${requestToDelete.value.requestNumber} has been deleted.`)
    
    if (selectedRequestId.value === requestToDelete.value.id) {
      closeDrawer()
    }
    
    showDeleteConfirm.value = false
    requestToDelete.value = null
    await refresh()
  } catch (err: any) {
    snackbar.showEditing(err?.data?.message || 'Failed to delete order request.')
  } finally {
    isDeleting.value = false
  }
}

// KPI counts
const counts = computed(() => {
  return data.value?.counts || { pending: 0, confirmed: 0, declined: 0, all: 0 }
})

const requestsList = computed(() => {
  return data.value?.requests || []
})

const totalPages = computed(() => {
  return data.value?.totalPages || 1
})

const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numPending = ref<HTMLElement | null>(null)
const numConfirmed = ref<HTMLElement | null>(null)
const numDeclined = ref<HTMLElement | null>(null)
const numAll = ref<HTMLElement | null>(null)

const triggerStatAnimations = () => {
  if (!data.value?.counts) return
  nextTick(() => {
    animateNumber(numPending.value, data.value?.counts?.pending || 0, { duration: 0.6 })
    animateNumber(numConfirmed.value, data.value?.counts?.confirmed || 0, { duration: 0.65 })
    animateNumber(numDeclined.value, data.value?.counts?.declined || 0, { duration: 0.7 })
    animateNumber(numAll.value, data.value?.counts?.all || 0, { duration: 0.55 })
  })
}

const tbodyRef = ref<HTMLElement | null>(null)

const triggerRowAnimation = () => {
  nextTick(() => {
    if (!isLoading.value && tbodyRef.value) {
      const rows = tbodyRef.value.querySelectorAll('tr')
      animateStagger(rows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

watch([() => data.value?.requests, () => isLoading.value], () => {
  triggerRowAnimation()
}, { immediate: false })

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()
  triggerRowAnimation()
})

watch(() => data.value?.counts, () => {
  triggerStatAnimations()
})
</script>

<template>
  <div class="space-y-8">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Inbox class="w-5 h-5" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Storefront Order Requests</h1>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Review incoming customer inquiries and cart requests from the digital storefront.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button 
          @click="refresh()" 
          class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-xs"
          :disabled="isLoading"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <!-- Pending Review -->
      <div 
        @click="activeTab = 'PENDING'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <Clock class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Pending Review</p>
            <h3 ref="numPending" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">0</h3>
            <p class="text-xs text-amber-600 font-medium truncate">Action needed</p>
          </div>
        </div>
      </div>

      <!-- Converted Orders -->
      <div 
        @click="activeTab = 'CONFIRMED'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-[#1a5c4c]/10 p-2 sm:p-2.5 rounded-lg text-[#1a5c4c] border border-[#1a5c4c]/20">
              <CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1a5c4c] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Converted Orders</p>
            <h3 ref="numConfirmed" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">0</h3>
            <p class="text-xs text-gray-500 truncate">Confirmed</p>
          </div>
        </div>
      </div>

      <!-- Declined -->
      <div 
        @click="activeTab = 'DECLINED'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-rose-50 p-2 sm:p-2.5 rounded-lg text-rose-600 border border-rose-100/50">
              <XCircle class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-rose-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Declined</p>
            <h3 ref="numDeclined" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">0</h3>
            <p class="text-xs text-rose-500 font-medium truncate">Rejected</p>
          </div>
        </div>
      </div>

      <!-- Total Inquiries -->
      <div 
        @click="activeTab = 'ALL'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-gray-100 p-2 sm:p-2.5 rounded-lg text-gray-600 border border-gray-200/50">
              <Inbox class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-gray-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Inquiries</p>
            <h3 ref="numAll" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">0</h3>
            <p class="text-xs text-gray-500 truncate">All time</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs (Underline style matching billing/payments) -->
    <div class="border-b border-gray-200 tab-scroll-container">
      <nav class="-mb-px flex gap-6 sm:gap-8 min-w-max">
        <button 
          v-for="tab in (['ALL', 'PENDING', 'CONFIRMED', 'DECLINED'] as const)" :key="tab"
          @click="activeTab = tab; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors shrink-0"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          {{ tab === 'ALL' ? 'All Requests' : tab === 'PENDING' ? 'Pending Review' : tab === 'CONFIRMED' ? 'Converted' : 'Declined' }}
        </button>
      </nav>
    </div>

    <!-- Filters & Table Container -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <!-- Controls Toolbar -->
      <div class="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50/50">

        <!-- Search Bar -->
        <div class="relative w-full md:w-72">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            v-model="search"
            placeholder="Search by Request #, Customer..."
            class="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]"
          />
        </div>

        <RowsPerPageSelect v-model="limit" :options="[10, 20, 50, -1]" @update:modelValue="page = 1" />
      </div>

      <!-- Table Content -->
      <div class="relative min-h-[200px]">
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse"></div>
        <div ref="desktopTableScrollRef" class="hidden md:block no-scrollbar" :class="isSidebarCollapsed ? 'overflow-hidden' : 'overflow-x-auto'" style="scrollbar-width: none; -ms-overflow-style: none;">
          <table 
            class="w-full text-left border-collapse"
            :class="isSidebarCollapsed ? 'table-fixed' : 'min-w-[1000px]'"
          >
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th class="w-[14%] px-2.5 py-3.5 whitespace-nowrap">Request #</th>
                <th class="w-[12%] px-2.5 py-3.5 whitespace-nowrap">Received</th>
                <th class="w-[26%] px-2.5 py-3.5">Customer</th>
                <th class="w-[24%] px-2.5 py-3.5">Items Summary</th>
                <th class="w-[10%] px-2.5 py-3.5 text-center whitespace-nowrap">Status</th>
                <th class="w-[14%] px-2.5 py-3.5 text-right whitespace-nowrap pr-3">Action</th>
              </tr>
            </thead>
            <tbody ref="tbodyRef" class="divide-y divide-gray-200 bg-white">
              <tr v-if="requestsList.length === 0 && !isLoading" class="text-center">
                <td colspan="6" class="py-16 text-gray-400">
                  <Inbox class="w-10 h-10 mx-auto text-gray-300 mb-2 stroke-1" />
                  <p class="font-medium text-gray-600">No order requests found</p>
                  <p class="text-xs text-gray-400 mt-0.5">Customer requests submitted on the storefront will appear here instantly.</p>
                </td>
              </tr>

              <tr 
                v-else 
                v-for="req in requestsList" 
                :key="req.id"
                @click="openDetail(req.id)"
                class="hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                <td class="px-2.5 py-3 whitespace-nowrap text-xs font-semibold text-gray-900 group-hover:text-[#1a5c4c]">
                  {{ req.requestNumber }}
                </td>
                <td class="px-2.5 py-3 whitespace-nowrap text-xs text-gray-500">
                  <div class="font-medium text-gray-700">{{ timeAgo(req.createdAt) }} ago</div>
                  <div class="text-[11px] text-gray-400">{{ formatDateTime(req.createdAt) }}</div>
                </td>
                <td class="px-2.5 py-3 min-w-0">
                  <div class="text-xs font-semibold text-gray-900 truncate" :title="req.customerName">{{ req.customerName }}</div>
                  <div class="text-[11px] text-gray-500 truncate mt-0.5" :title="(req.companyName ? req.companyName + ' • ' : '') + req.phone + (req.city ? ' • ' + req.city : '')">
                    <span v-if="req.companyName">{{ req.companyName }} • </span>
                    <span>{{ req.phone }}</span>
                    <span v-if="req.city"> • {{ req.city }}</span>
                  </div>
                </td>
                <td class="px-2.5 py-3 min-w-0">
                  <div class="text-xs font-semibold text-gray-800">
                    {{ req.items.length }} {{ req.items.length === 1 ? 'item' : 'items' }}
                  </div>
                  <div class="text-[11px] text-gray-400 truncate block mt-0.5" :title="req.items.map((i: any) => `${i.productName} (${i.quantity})`).join(', ')">
                    {{ req.items.map((i: any) => `${i.productName} (${i.quantity})`).join(', ') }}
                  </div>
                </td>
                <td class="px-2.5 py-3 whitespace-nowrap text-center">
                  <span 
                    v-if="req.status === 'PENDING'"
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Pending
                  </span>
                  <span 
                    v-else-if="req.status === 'CONFIRMED'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                  >
                    <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                    {{ req.convertedOrder?.orderNumber ? req.convertedOrder.orderNumber : 'Confirmed' }}
                  </span>
                  <span 
                    v-else-if="req.status === 'DECLINED'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80"
                  >
                    <XCircle class="w-3 h-3 text-rose-600" />
                    Declined
                  </span>
                </td>
                <td class="px-2.5 py-3 whitespace-nowrap text-right pr-3">
                  <div class="flex items-center justify-end gap-1.5">
                    <button 
                      class="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition shadow-xs"
                      @click.stop="openDetail(req.id)"
                      title="Review"
                    >
                      <span>Review</span>
                    </button>
                    <button
                      v-if="hasRole('ADMIN')"
                      class="inline-flex items-center text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-1.5 py-1 rounded-md transition shadow-xs"
                      @click.stop="confirmDelete(req)"
                      title="Delete Request"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Floating Horizontal Scrollbar (Desktop only) -->
        <FloatingHorizontalScrollbar :target="desktopTableScrollRef" />

        <!-- MOBILE VIEW: Stacked Cards (Hidden on desktop) -->
        <div class="md:hidden flex flex-col divide-y divide-gray-100 bg-white">
          <div v-if="requestsList.length === 0 && !isLoading" class="p-10 text-center text-gray-400">
            <Inbox class="w-8 h-8 mx-auto text-gray-300 mb-2 stroke-1" />
            <p class="font-medium text-gray-600 text-sm">No order requests found</p>
          </div>
          
          <div 
            v-else
            v-for="req in requestsList" 
            :key="req.id"
            @click="openDetail(req.id)"
            class="p-4 bg-white active:bg-gray-50 transition-colors cursor-pointer space-y-3"
          >
            <!-- 1. Header: Request ID & Status Badge -->
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-900">{{ req.requestNumber }}</span>
              
              <span 
                v-if="req.status === 'PENDING'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Pending
              </span>
              <span 
                v-else-if="req.status === 'CONFIRMED'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80"
              >
                <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                Confirmed
              </span>
              <span 
                v-else-if="req.status === 'DECLINED'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80"
              >
                <XCircle class="w-3 h-3 text-rose-600" />
                Declined
              </span>
            </div>

            <!-- 2. Body: Customer & Items -->
            <div>
              <p class="text-sm font-medium text-gray-900">{{ req.customerName }}</p>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                <span class="font-medium">{{ req.items.length }} {{ req.items.length === 1 ? 'item' : 'items' }}</span>
                <span class="text-gray-300">•</span>
                <span class="truncate max-w-[150px]">{{ req.items.map((i: any) => i.productName).join(', ') }}</span>
              </div>
            </div>

            <!-- 3. Footer: Date & Details Action -->
            <div class="flex items-center justify-between pt-2.5 border-t border-gray-50">
              <span class="text-xs text-gray-500 font-medium">
                {{ formatDateTime(req.createdAt) }}
              </span>
              <span class="text-xs font-medium text-gray-400 flex items-center gap-1">
                {{ timeAgo(req.createdAt) }} ago <ArrowRight class="w-3.5 h-3.5 ml-1 text-gray-300" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between gap-4">
        <p class="text-xs text-gray-500 whitespace-nowrap">
          Showing <span class="font-medium text-gray-900">{{ requestsList.length ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
          to <span class="font-medium text-gray-900">{{ limit === -1 ? (data?.total || 0) : Math.min(page * limit, data?.total || 0) }}</span>
          of <span class="font-medium text-gray-900">{{ data?.total || 0 }}</span> requests
        </p>

        <div class="flex items-center justify-center gap-2">
          <button
            :disabled="page <= 1"
            @click="page = Math.max(1, page - 1)"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (totalPages || 1) }}</span>
          <button
            :disabled="limit === -1 || page >= totalPages"
            @click="page = Math.min(totalPages, page + 1)"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Review & Convert Slide-Over Modal -->
    <Teleport to="body">
      <div 
        v-if="isDrawerOpen" 
        class="fixed inset-0 z-[100] flex justify-end"
      >
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          @click="closeDrawer"
        ></div>

        <!-- Slide Drawer Panel -->
        <div class="relative bg-white w-full max-w-2xl h-full shadow-2xl z-10 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <template v-if="isDetailLoading">
            <!-- Loading Overlay (Visible against the skeleton) -->
            <div class="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-50 pointer-events-auto animate-pulse transition-all duration-300"></div>
            
            <!-- Header Skeleton -->
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
              <div class="flex items-center gap-3">
                <div class="h-6 w-32 bg-gray-200 rounded"></div>
                <div class="h-5 w-24 bg-gray-200 rounded-full"></div>
              </div>
              <div class="h-6 w-6 bg-gray-200 rounded"></div>
            </div>

            <!-- Sub-header Skeleton -->
            <div class="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div class="flex justify-between items-end">
                <div class="space-y-2">
                  <div class="h-5 w-40 bg-gray-200 rounded"></div>
                  <div class="h-3 w-32 bg-gray-200 rounded"></div>
                </div>
                <div class="space-y-2 flex flex-col items-end">
                  <div class="h-6 w-24 bg-gray-200 rounded"></div>
                  <div class="h-3 w-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>

            <!-- Body Skeleton -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              <!-- Customer Details Card Skeleton -->
              <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                <div class="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div class="h-3 w-32 bg-gray-200 rounded"></div>
                  <div class="h-4 w-24 bg-gray-200 rounded-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-2"><div class="h-2.5 w-20 bg-gray-200 rounded"></div><div class="h-4 w-32 bg-gray-200 rounded"></div></div>
                  <div class="space-y-2"><div class="h-2.5 w-20 bg-gray-200 rounded"></div><div class="h-4 w-32 bg-gray-200 rounded"></div></div>
                  <div class="space-y-2"><div class="h-2.5 w-20 bg-gray-200 rounded"></div><div class="h-4 w-32 bg-gray-200 rounded"></div></div>
                  <div class="space-y-2"><div class="h-2.5 w-20 bg-gray-200 rounded"></div><div class="h-4 w-32 bg-gray-200 rounded"></div></div>
                </div>
              </div>
              
              <!-- Items Table Skeleton -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="h-3 w-48 bg-gray-200 rounded"></div>
                  <div class="h-3 w-16 bg-gray-200 rounded"></div>
                </div>
                <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <div class="bg-gray-50 h-9 border-b border-gray-100"></div>
                  <div class="divide-y divide-gray-100">
                    <div v-for="i in 3" :key="i" class="p-3 flex items-center justify-between bg-white">
                       <div class="space-y-1"><div class="h-4 w-40 bg-gray-200 rounded"></div><div class="h-2.5 w-24 bg-gray-200 rounded"></div></div>
                       <div class="h-4 w-8 bg-gray-200 rounded"></div>
                       <div class="h-4 w-20 bg-gray-200 rounded-full"></div>
                       <div class="h-4 w-16 bg-gray-200 rounded"></div>
                       <div class="h-4 w-16 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-if="isConverting || isDeclining" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 pointer-events-auto animate-pulse transition-all duration-300"></div>

            <!-- Drawer Header -->
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg font-bold text-gray-900">{{ selectedRequest?.requestNumber }}</h2>
              <span 
                v-if="selectedRequest?.status === 'PENDING'"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Pending Review
              </span>
              <span 
                v-else-if="selectedRequest?.status === 'CONFIRMED'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80"
              >
                <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                {{ selectedRequest.convertedOrder?.orderNumber ? `Converted: ${selectedRequest.convertedOrder.orderNumber}` : 'Converted' }}
              </span>
              <span 
                v-else-if="selectedRequest?.status === 'DECLINED'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80"
              >
                <XCircle class="w-3 h-3 text-rose-600" />
                Declined
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button @click="closeDrawer" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 ml-2">
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Sub-header -->
          <div class="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div class="flex justify-between items-end">
              <div>
                <p class="text-sm font-medium text-gray-900">{{ selectedRequest?.customerName }}</p>
                <p class="text-xs text-gray-500 mt-1">Received {{ selectedRequest?.createdAt ? formatDateTime(selectedRequest.createdAt) : '' }}</p>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold text-[#1a5c4c]">{{ formatCurrency(selectedRequest?.totalEstimated || 0) }}</p>
                <p class="text-[11px] text-gray-500 font-medium mt-0.5">{{ selectedRequest?.items?.length || 0 }} items</p>
              </div>
            </div>
          </div>

          <!-- Drawer Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div v-if="actionError" class="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle class="w-4 h-4 shrink-0 text-red-600" />
              <span>{{ actionError }}</span>
            </div>

            <!-- Customer Details Card -->
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div class="flex items-center justify-between border-b border-gray-200 pb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Customer Details</span>
                <span 
                  v-if="matchedCustomer"
                  class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1"
                >
                  <ShieldCheck class="w-3 h-3 text-emerald-600" /> Registered Customer
                </span>
                <span 
                  v-else 
                  class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700"
                >
                  New Lead
                </span>
              </div>

              <div class="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Contact Person</span>
                  <span class="font-bold text-gray-900 text-sm">{{ selectedRequest?.customerName }}</span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Company Name</span>
                  <span class="font-bold text-gray-900">{{ selectedRequest?.companyName || '—' }}</span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Phone Number</span>
                  <a :href="`tel:${selectedRequest?.phone}`" class="font-mono font-semibold text-[#1a5c4c] flex items-center gap-1 hover:underline">
                    <Phone class="w-3 h-3" /> {{ selectedRequest?.phone }}
                  </a>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Email</span>
                  <span class="text-gray-700">{{ selectedRequest?.email || '—' }}</span>
                </div>
              </div>

              <div v-if="selectedRequest?.deliveryAddress" class="pt-3 border-t border-gray-200 text-sm">
                <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Delivery Address</span>
                <p class="text-gray-800 flex items-start gap-1">
                  <MapPin class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{{ selectedRequest.deliveryAddress }}<span v-if="selectedRequest.city">, {{ selectedRequest.city }}</span><span v-if="selectedRequest.pincode"> - {{ selectedRequest.pincode }}</span></span>
                </p>
              </div>

              <div v-if="selectedRequest?.notes" class="pt-3 border-t border-gray-200 text-sm">
                <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Customer Notes / Instructions</span>
                <p class="text-gray-700 italic bg-white p-2.5 rounded-lg border border-gray-200 text-xs">
                  "{{ selectedRequest.notes }}"
                </p>
              </div>
            </div>

            <!-- Requested Items Table & Live Stock Verification -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Requested Items & Stock Verification</span>
                <span class="text-xs font-bold text-gray-400">{{ selectedRequest?.items?.length || 0 }} items</span>
              </div>

              <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500">
                    <tr>
                      <th class="py-2.5 px-3">Product</th>
                      <th class="py-2.5 px-3 text-center">Qty</th>
                      <th class="py-2.5 px-3">Warehouse Stock</th>
                      <th class="py-2.5 px-3 text-right">Price</th>
                      <th class="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="item in selectedRequest?.items" :key="item.id" class="hover:bg-gray-50">
                      <td class="py-3 px-3">
                        <div class="font-semibold text-gray-900">{{ item.productName }}</div>
                        <div class="text-[10px] font-mono text-gray-400">SKU: {{ item.sku }}</div>
                      </td>
                      <td class="py-3 px-3 text-center font-bold text-gray-900">
                        {{ item.quantity }} <span class="text-[10px] text-gray-400 font-normal">{{ item.unit }}</span>
                      </td>
                      <td class="py-3 px-3">
                        <template v-if="item.product">
                          <span 
                            v-if="item.product.stock >= item.quantity"
                            class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded"
                          >
                            <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                            {{ item.product.stock }} in stock
                          </span>
                          <span 
                            v-else-if="item.product.stock > 0"
                            class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded"
                          >
                            <AlertTriangle class="w-3 h-3 text-amber-600" />
                            Low stock ({{ item.product.stock }} left)
                          </span>
                          <span 
                            v-else
                            class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded"
                          >
                            <XCircle class="w-3 h-3 text-rose-600" />
                            Out of stock
                          </span>
                        </template>
                        <span v-else class="text-[10px] text-gray-400 italic">Unlinked product</span>
                      </td>
                      <td class="py-3 px-3 text-right font-mono text-gray-600">
                        {{ formatCurrency(item.estimatedPrice) }}
                      </td>
                      <td class="py-3 px-3 text-right font-mono font-bold text-gray-900">
                        {{ formatCurrency(item.estimatedPrice * item.quantity) }}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot class="bg-gray-50/75 border-t border-gray-200">
                    <tr>
                      <td colspan="4" class="py-3 px-3 text-right font-bold text-gray-700 text-xs uppercase tracking-wider">
                        Total Estimated Value:
                      </td>
                      <td class="py-3 px-3 text-right font-mono font-black text-sm text-[#1a5c4c]">
                        {{ formatCurrency(selectedRequest?.totalEstimated || 0) }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <!-- Conversion Status Banner -->
            <div 
              v-if="selectedRequest?.status === 'CONFIRMED' && selectedRequest.convertedOrder"
              class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 class="w-4 h-4 text-emerald-600" />
                  Successfully Converted to Sales Order
                </span>
                <button 
                  @click="router.push({ path: '/dashboard/orders', query: { search: selectedRequest.convertedOrder.orderNumber } })"
                  class="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
                >
                  View Order {{ selectedRequest.convertedOrder.orderNumber }} <ExternalLink class="w-3 h-3" />
                </button>
              </div>
              <p class="text-xs text-emerald-700">
                Created by {{ selectedRequest.confirmedBy?.name || 'Sales Staff' }}. Order is now in the active fulfillment pipeline.
              </p>
            </div>

            <div 
              v-if="selectedRequest?.status === 'DECLINED'"
              class="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1"
            >
              <span class="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <XCircle class="w-4 h-4 text-rose-600" />
                This Request was Declined
              </span>
              <p class="text-xs text-rose-700 italic">
                Reason: {{ selectedRequest.declinedReason || 'No reason provided' }}
              </p>
            </div>
          </div>

          <!-- Drawer Footer Actions -->
          <div 
            v-if="selectedRequest?.status === 'PENDING' || hasRole('ADMIN')"
            class="p-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3 shrink-0"
          >
            <div class="flex items-center gap-2">
              <button 
                v-if="hasRole('ADMIN')"
                @click="confirmDelete(selectedRequest)"
                class="px-3 py-2 text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg transition flex items-center gap-1.5"
              >
                <Trash2 class="w-4 h-4" />
                <span class="hidden sm:inline">Delete</span>
              </button>
              
              <button 
                v-if="selectedRequest?.status === 'PENDING'"
                @click="showDeclineModal = true"
                class="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                :disabled="isConverting"
              >
                Decline Request
              </button>
            </div>

            <button 
              v-if="selectedRequest?.status === 'PENDING'"
              @click="openConfirmModal"
              class="flex items-center gap-2 px-5 py-2.5 bg-[#1a5c4c] hover:bg-[#14473b] text-white rounded-lg text-xs font-bold shadow-md transition"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>Review & Confirm Order</span>
            </button>
          </div>
          </template>
        </div>

      </div>
      
      <!-- Decline Confirmation Prompt Modal -->
      <div 
        v-if="showDeclineModal" 
        class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/80">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-base font-bold text-gray-900">Decline Order Request</h2>
                <p class="text-xs text-gray-500 mt-0.5">Request {{ selectedRequest?.requestNumber }}</p>
              </div>
            </div>
            <button 
              @click="showDeclineModal = false"
              class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="p-5 space-y-4">
            <p class="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to decline this request? The customer will not be automatically notified.
            </p>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Reason for decline (Optional)</label>
              <textarea 
                v-model="declineReason"
                rows="2"
                placeholder="e.g., Out of stock, customer requested cancellation..."
                class="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
            <button 
              @click="showDeclineModal = false"
              class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="handleDecline"
              :disabled="isDeclining"
              class="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Loader2 v-if="isDeclining" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isDeclining ? 'Declining...' : 'Confirm Decline' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Prompt Modal -->
      <div 
        v-if="showDeleteConfirm" 
        class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      >
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/80">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-base font-bold text-gray-900">Delete Order Request</h2>
                <p class="text-xs text-gray-500 mt-0.5">Request {{ requestToDelete?.requestNumber }}</p>
              </div>
            </div>
            <button 
              @click="showDeleteConfirm = false"
              class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Content -->
          <div class="p-5 space-y-4">
            <p class="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to completely delete this order request? 
              <br><br>
              <strong class="text-rose-600 font-bold text-sm">This action cannot be undone.</strong>
            </p>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
            <button 
              @click="showDeleteConfirm = false"
              class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="executeDelete"
              :disabled="isDeleting"
              class="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Loader2 v-if="isDeleting" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isDeleting ? 'Deleting...' : 'Delete Permanently' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Prefilled Create Order / Confirmation Modal -->
    <ConfirmOrderRequestModal 
      :isOpen="isConfirmModalOpen"
      :orderRequest="selectedRequest"
      :matchedCustomer="matchedCustomer"
      @close="isConfirmModalOpen = false"
      @converted="onOrderConverted"
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
