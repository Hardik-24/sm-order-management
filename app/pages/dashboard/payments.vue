<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { CreditCard, IndianRupee, AlertCircle, CheckCircle2, Clock, Search, ChevronRight, Filter, Loader2 } from 'lucide-vue-next'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import RecordPaymentModal from '~/components/dashboard/RecordPaymentModal.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import { formatCurrency, formatDate, formatDateTime, formatTime, getStatusColor } from '~/lib/utils'
import type { Order } from '~/types'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

definePageMeta({ layout: 'dashboard' })

const page = ref(1)
const limit = ref(10)
const search = ref('')
const startDate = ref('')
const endDate = ref('')
const status = ref('')
const billingStatus = ref('')
const packingStatus = ref('')
const deliveryStatus = ref('')
const paymentStatus = ref('')

const activeTab = ref<'ALL' | 'UNPAID' | 'PARTIAL' | 'OVERDUE' | 'PAID'>('ALL')

const selectedOrderId = ref<string | null>(null)
const isPanelOpen = ref(false)

const isPaymentModalOpen = ref(false)
const orderForPayment = ref<Order | null>(null)

const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }

  if (activeTab.value !== 'ALL') {
    q.paymentStatus = activeTab.value
  } else if (paymentStatus.value) {
    q.paymentStatus = paymentStatus.value
  }

  if (search.value) q.search = search.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  return q
})

const { data: statsData, refresh: refreshStats } = useFetch('/api/orders/payment-stats')

const { data, refresh, pending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

const handleSelect = (id: string) => {
  selectedOrderId.value = id
  isPanelOpen.value = true
}

const handlePanelClose = () => {
  isPanelOpen.value = false
  selectedOrderId.value = null
}

const openPaymentModal = (order: Order, e?: Event) => {
  if (e) e.stopPropagation()
  orderForPayment.value = order
  isPaymentModalOpen.value = true
}

const onPaymentRecorded = () => {
  refresh()
  refreshStats()
}

const handleUpdate = () => {
  refresh()
  refreshStats()
}

// Real-time synchronization
const { onOrderSync } = useRealtimeSync()
onOrderSync(() => {
  refresh()
  refreshStats()
})

// Tab switching & loading state
const isSwitchingTab = ref(false)

const handleTabChange = (tab: 'ALL' | 'UNPAID' | 'PARTIAL' | 'OVERDUE' | 'PAID') => {
  if (activeTab.value === tab) return
  isSwitchingTab.value = true
  activeTab.value = tab
  page.value = 1
}

watch(queryObj, () => {
  isSwitchingTab.value = true
})

const isLoading = computed(() => pending.value || isSwitchingTab.value)
const tableContainerRef = ref<HTMLElement | null>(null)

// GSAP Animations
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numOutstanding = ref<HTMLElement | null>(null)
const numCollected = ref<HTMLElement | null>(null)
const numUnpaid = ref<HTMLElement | null>(null)
const numOverdue = ref<HTMLElement | null>(null)

const outstandingBillsCount = computed(() => {
  return (statsData.value?.unpaidCount || 0) + (statsData.value?.partialCount || 0) + (statsData.value?.overdueCount || 0)
})

const triggerStatAnimations = () => {
  if (!statsData.value) return
  nextTick(() => {
    animateNumber(numOutstanding.value, statsData.value?.totalOutstanding || 0, { duration: 0.6, isCurrency: true })
    animateNumber(numCollected.value, statsData.value?.collectedToday || 0, { duration: 0.65, isCurrency: true })
    animateNumber(numUnpaid.value, statsData.value?.unpaidCount || 0, { duration: 0.6 })
    animateNumber(numOverdue.value, statsData.value?.overdueCount || 0, { duration: 0.7 })
  })
}

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tableContainerRef.value && !isLoading.value) {
      const rows = tableContainerRef.value.querySelectorAll('tbody tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })

      const cards = tableContainerRef.value.querySelectorAll('.block.md\\:hidden > div')
      const targetCards = Array.from(cards).slice(0, 15)
      animateStagger(targetCards, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

watch(data, (newVal) => {
  if (newVal) {
    isSwitchingTab.value = false
    triggerRowAnimation()
  }
}, { immediate: true })

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()
  triggerRowAnimation()
})

watch(statsData, () => {
  triggerStatAnimations()
}, { deep: true })
</script>

<template>
  <div class="space-y-8">
    <RecordPaymentModal 
      :isOpen="isPaymentModalOpen"
      :order="orderForPayment"
      @close="isPaymentModalOpen = false"
      @recorded="onPaymentRecorded"
    />

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[#1a1a1a]">Payments & Receivables</h1>
        <p class="text-sm text-gray-500 mt-1">Track customer payments, outstanding invoices, and collection statuses.</p>
      </div>
    </div>

    <!-- Quick Stats -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <!-- Total Outstanding -->
      <div 
        @click="handleTabChange('UNPAID')"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <IndianRupee class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Outstanding</p>
            <!-- Desktop: Rupee amount -->
            <h3 ref="numOutstanding" class="hidden md:block text-2xl font-bold text-gray-900 mb-0.5 truncate">₹0</h3>
            <!-- Mobile: Number of bills remaining outstanding -->
            <div class="block md:hidden">
              <h3 class="text-xl font-bold text-gray-900 mb-0.5 truncate">
                {{ outstandingBillsCount }} <span class="text-xs font-semibold text-gray-500">bills</span>
              </h3>
            </div>
            <p class="text-xs text-gray-500 truncate hidden md:block">Uncollected balance</p>
            <p class="text-xs text-amber-600 font-medium truncate block md:hidden">Bills outstanding</p>
          </div>
        </div>
      </div>

      <!-- Collected Today -->
      <div 
        @click="handleTabChange('PAID')"
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
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Collected Today</p>
            <h3 ref="numCollected" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">₹0</h3>
            <p class="text-xs text-gray-500 truncate">Total payments cleared</p>
          </div>
        </div>
      </div>

      <!-- Unpaid Orders -->
      <div 
        @click="handleTabChange('UNPAID')"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-blue-50 p-2 sm:p-2.5 rounded-lg text-blue-600 border border-blue-100/50">
              <CreditCard class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-blue-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Unpaid Orders</p>
            <h3 ref="numUnpaid" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">0</h3>
            <p class="text-xs text-gray-500 truncate">Awaiting payment</p>
          </div>
        </div>
      </div>

      <!-- Overdue Accounts -->
      <div 
        @click="handleTabChange('OVERDUE')"
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-rose-50 p-2 sm:p-2.5 rounded-lg text-rose-600 border border-rose-100/50">
              <AlertCircle class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-rose-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Overdue Accounts</p>
            <h3 ref="numOverdue" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">0</h3>
            <p class="text-xs text-rose-500 font-medium truncate">Terms exceeded</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 tab-scroll-container">
      <nav class="-mb-px flex gap-6 sm:gap-8 min-w-max">
        <button 
          v-for="tab in ['ALL', 'UNPAID', 'PARTIAL', 'OVERDUE', 'PAID']" :key="tab"
          @click="handleTabChange(tab as any)"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors shrink-0"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          {{ tab === 'ALL' ? 'All Orders' : tab === 'UNPAID' ? 'Unpaid' : tab === 'PARTIAL' ? 'Partially Paid' : tab === 'OVERDUE' ? 'Overdue' : 'Fully Paid' }}
        </button>
      </nav>
    </div>

    <!-- Table Container -->
    <div ref="tableContainerRef" class="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col relative min-h-[300px]">
      <!-- Loading Overlay -->
      <div v-if="isLoading" class="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20 transition-opacity">
        <Loader2 class="w-8 h-8 animate-spin text-[#1a5c4c]" />
      </div>
      <!-- Search & Controls Top Bar -->
      <div class="p-4 border-b border-gray-200 bg-white rounded-t-xl relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex flex-col sm:flex-row gap-3 sm:items-center w-full md:w-auto">
          <div class="relative w-full md:w-80 lg:w-96">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search class="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              v-model="search"
              placeholder="Search by order #, customer..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] transition-colors"
            />
          </div>

          <TableFilterButtons
            v-model:startDate="startDate"
            v-model:endDate="endDate"
            v-model:status="status"
            v-model:billingStatus="billingStatus"
            v-model:packingStatus="packingStatus"
            v-model:deliveryStatus="deliveryStatus"
          />
        </div>

        <RowsPerPageSelect v-model="limit" :options="[10, 20, 50, -1]" @update:modelValue="page = 1" />
      </div>

      <!-- Desktop Table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-left">
          <thead class="bg-[#faf8f5]">
            <tr class="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th class="px-6 py-3.5">Order</th>
              <th class="px-6 py-3.5">Customer</th>
              <th class="px-6 py-3.5">Total Amount</th>
              <th class="px-6 py-3.5">Paid Amount</th>
              <th class="px-6 py-3.5">Balance Due</th>
              <th class="px-6 py-3.5">Payment Method</th>
              <th class="px-6 py-3.5">Status</th>
              <th class="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr 
              v-for="order in data?.orders || []" 
              :key="order.id"
              @click="handleSelect(order.id)"
              class="hover:bg-gray-50/80 cursor-pointer transition-colors group"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-semibold text-gray-900 group-hover:text-[#1a5c4c] transition-colors">
                  {{ order.orderNumber }}
                </span>
                <span class="block text-xs text-gray-400 mt-0.5">{{ formatDateTime(order.createdAt) }}</span>
              </td>

              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-900 block truncate max-w-[180px]">
                  {{ order.customer?.name || '—' }}
                </span>
                <span class="text-xs text-gray-400 block truncate max-w-[180px]">
                  {{ order.customer?.company || order.customer?.city || '—' }}
                </span>
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                {{ formatCurrency(order.totalAmount || 0) }}
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-700">
                {{ formatCurrency(order.paymentStatus?.amountPaid || 0) }}
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-sm font-bold" :class="Number(order.paymentStatus?.balanceDue || 0) > 0 ? 'text-amber-700' : 'text-gray-400'">
                {{ formatCurrency(order.paymentStatus?.balanceDue ?? (Number(order.totalAmount || 0) - Number(order.paymentStatus?.amountPaid || 0))) }}
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                <span v-if="order.paymentStatus?.paymentMethod" class="font-medium text-gray-700">
                  {{ order.paymentStatus.paymentMethod }}
                </span>
                <span v-else class="text-gray-400">—</span>
                <span v-if="order.paymentStatus?.referenceNo" class="block text-[10px] text-gray-400 font-mono">
                  {{ order.paymentStatus.referenceNo }}
                </span>
              </td>

              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                  :class="getStatusColor(order.paymentStatus?.status || 'UNPAID')"
                >
                  {{ order.paymentStatus?.status || 'UNPAID' }}
                </span>
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-right">
                <button 
                  v-if="(order.paymentStatus?.status || 'UNPAID') !== 'PAID'"
                  @click="openPaymentModal(order, $event)"
                  class="px-3 py-1.5 text-xs font-semibold text-[#1a5c4c] bg-[#e6f4f1] hover:bg-[#1a5c4c] hover:text-white rounded-lg border border-[#1a5c4c]/20 transition-all shadow-sm"
                >
                  Record Payment
                </button>
                <span v-else class="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                  <CheckCircle2 class="w-3.5 h-3.5" /> Settled
                </span>
              </td>
            </tr>

            <tr v-if="!data?.orders?.length">
              <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500">
                No orders matching the selected payment filter.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile List View -->
      <div class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in data?.orders || []" 
          :key="'mob-' + order.id"
          @click="handleSelect(order.id)"
          class="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors space-y-2.5"
        >
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm font-bold text-gray-900">{{ order.orderNumber }}</span>
              <span class="text-xs text-gray-500 block">{{ order.customer?.name }} • {{ formatDateTime(order.createdAt) }}</span>
            </div>
            <span 
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
              :class="getStatusColor(order.paymentStatus?.status || 'UNPAID')"
            >
              {{ order.paymentStatus?.status || 'UNPAID' }}
            </span>
          </div>

          <div class="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
            <div>
              <span class="text-gray-400">Total:</span>
              <span class="font-bold text-gray-900 ml-1">{{ formatCurrency(order.totalAmount || 0) }}</span>
            </div>
            <div>
              <span class="text-gray-400">Due:</span>
              <span class="font-bold text-amber-700 ml-1">{{ formatCurrency(order.paymentStatus?.balanceDue || 0) }}</span>
            </div>
            <button 
              v-if="(order.paymentStatus?.status || 'UNPAID') !== 'PAID'"
              @click="openPaymentModal(order, $event)"
              class="px-2.5 py-1 text-[11px] font-bold text-[#1a5c4c] bg-[#e6f4f1] rounded-md border border-[#1a5c4c]/20"
            >
              Pay
            </button>
          </div>
        </div>

        <div v-if="!data?.orders?.length" class="p-8 text-center text-sm text-gray-500">
          No orders found.
        </div>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between gap-4">
        <p class="text-xs text-gray-500 whitespace-nowrap">
          Showing <span class="font-medium text-gray-900">{{ (data?.orders?.length || 0) > 0 ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
          to <span class="font-medium text-gray-900">{{ limit === -1 ? (data?.total || 0) : Math.min(page * limit, data?.total || 0) }}</span>
          of <span class="font-medium text-gray-900">{{ data?.total || 0 }}</span> orders
        </p>

        <div class="flex items-center justify-center gap-2">
          <button
            :disabled="page <= 1"
            @click="page--"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (data?.totalPages || 1) }}</span>
          <button
            :disabled="limit === -1 || page >= (data?.totalPages || 1)"
            @click="page++"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Panel -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      context="payment"
      @close="handlePanelClose"
      @updated="handleUpdate"
    />
  </div>
</template>
