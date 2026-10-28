<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import BillingTable from '~/components/dashboard/BillingTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import GenerateBillModal from '~/components/dashboard/GenerateBillModal.vue'
import SplitOrderModal from '~/components/dashboard/SplitOrderModal.vue'
import { IndianRupee, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-vue-next'
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
const selectedOrderId = ref<string | null>(null)
const isPanelOpen = ref(false)

const activeTab = ref<'PENDING' | 'URGENT' | 'GENERATED' | 'ON_HOLD' | 'ALL'>('PENDING')

const queryObj = computed(() => {
  const q: any = { 
    page: page.value, 
    limit: limit.value,
    isApproved: 'true'
  }
  
  if (billingStatus.value) {
    q.billingStatus = billingStatus.value
  } else if (activeTab.value === 'PENDING') {
    q.billingStatus = 'PENDING'
  } else if (activeTab.value === 'URGENT') {
    q.billingStatus = 'PENDING'
    q.isUrgent = 'true'
  } else if (activeTab.value === 'GENERATED') {
    q.billingStatus = 'GENERATED'
  } else if (activeTab.value === 'ON_HOLD') {
    q.billingStatus = 'ON_HOLD'
  }

  if (search.value.trim()) q.search = search.value.trim()
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  return q
})

const statsQuery = computed(() => {
  const q: any = {}
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  return q
})

const { data: statsData, refresh: refreshStats } = useFetch('/api/orders/billing-stats', {
  query: statsQuery,
  watch: [statsQuery]
})

const { data, refresh, pending: isLoading } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

const counts = computed(() => ({
  pending: statsData.value?.pending || 0,
  urgent: statsData.value?.urgent || 0,
  generated: statsData.value?.generated || statsData.value?.generatedToday || 0,
  onHold: statsData.value?.onHold || 0,
  total: statsData.value?.total || 0,
}))

const handleRefresh = async () => {
  await Promise.all([refresh(), refreshStats()])
}

const handleSelect = (id: string) => {
  selectedOrderId.value = id
  isPanelOpen.value = true
}

const handlePanelClose = () => {
  isPanelOpen.value = false
  selectedOrderId.value = null
}

const applyOrderUpdate = (updatedOrder: any) => {
  if (!updatedOrder || !updatedOrder.id) return
  if (data.value && Array.isArray(data.value.orders)) {
    const idx = data.value.orders.findIndex((o: any) => o.id === updatedOrder.id)
    if (idx !== -1) {
      data.value.orders[idx] = { ...data.value.orders[idx], ...updatedOrder }
    }
  }
}

const handleUpdate = (updatedOrder?: any) => {
  if (updatedOrder) applyOrderUpdate(updatedOrder)
  refresh()
  refreshStats()
}

// Realtime sync
const { onOrderSync } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) applyOrderUpdate(event.order)
  refresh()
  refreshStats()
})

const isGenerateModalOpen = ref(false)
const generatingOrderId = ref<string | null>(null)

const openGenerateModal = (id: string) => {
  generatingOrderId.value = id
  isGenerateModalOpen.value = true
}

const onInvoiceGenerated = () => {
  handleUpdate()
}

const isSplitModalOpen = ref(false)
const splittingOrderId = ref<string | null>(null)

const openSplitModal = (id: string) => {
  splittingOrderId.value = id
  isSplitModalOpen.value = true
}

const onOrderSplit = () => {
  isSplitModalOpen.value = false
  splittingOrderId.value = null
  handleUpdate()
}

// GSAP Animations
const { animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto">
    <!-- Invoice Modal -->
    <GenerateBillModal 
      :isOpen="isGenerateModalOpen"
      :orderId="generatingOrderId"
      @close="isGenerateModalOpen = false"
      @generated="onInvoiceGenerated"
      @openSplit="openSplitModal"
    />

    <!-- Split Order Modal -->
    <SplitOrderModal
      :isOpen="isSplitModalOpen"
      :orderId="splittingOrderId"
      @close="isSplitModalOpen = false"
      @splitSuccess="onOrderSplit"
    />

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Billing & Invoicing</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Review orders, generate GST invoices, track SLA turnaround, and manage billing holds.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="handleRefresh" 
          :disabled="isLoading"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching Approve Orders Design) -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
      <!-- 1. Awaiting Billing -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <IndianRupee class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Awaiting Billing</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="counts.pending" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-amber-600 font-medium truncate">Pending creation</p>
          </div>
        </div>
      </div>

      <!-- 2. Urgent / SLA Breached -->
      <div class="bg-white rounded-xl border border-rose-200/80 p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-rose-50 p-2 sm:p-2.5 rounded-lg text-rose-600 border border-rose-100/50">
              <Zap class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-rose-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-0.5 truncate">⚡ Urgent Orders</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="counts.urgent" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-rose-500 font-medium truncate">High priority</p>
          </div>
        </div>
      </div>

      <!-- 3. Invoices Generated -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-[#1b3b5f]/10 p-2 sm:p-2.5 rounded-lg text-[#1b3b5f] border border-[#1b3b5f]/20">
              <CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1b3b5f] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Generated</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="counts.generated" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-emerald-600 font-medium truncate">Ready invoices</p>
          </div>
        </div>
      </div>

      <!-- 4. Flagged / On Hold -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-orange-50 p-2 sm:p-2.5 rounded-lg text-orange-600 border border-orange-100/50">
              <AlertCircle class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-orange-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">On Hold</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="counts.onHold" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-orange-500 font-medium truncate">Needs check</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Underline Tabs with Badges -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in (['PENDING', 'URGENT', 'GENERATED', 'ON_HOLD', 'ALL'] as const)" :key="tab"
          @click="activeTab = tab; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
          :class="activeTab === tab ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span v-if="tab === 'URGENT'">⚡</span>
          <span>
            {{ 
              tab === 'PENDING' ? 'Awaiting Billing' : 
              tab === 'URGENT' ? 'Urgent Orders' : 
              tab === 'GENERATED' ? 'Invoices Generated' : 
              tab === 'ON_HOLD' ? 'On Hold' : 'All Orders' 
            }}
          </span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeTab === tab
                ? (tab === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-[#1b3b5f]/10 text-[#1b3b5f]')
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ 
              tab === 'PENDING' ? counts.pending : 
              tab === 'URGENT' ? counts.urgent : 
              tab === 'GENERATED' ? counts.generated : 
              tab === 'ON_HOLD' ? counts.onHold : counts.total 
            }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Table Container -->
    <div class="relative">
      <BillingTable 
        :isLoading="isLoading"
        :orders="data?.orders || []"
        :total="data?.total || 0"
        v-model:page="page"
        v-model:limit="limit"
        v-model:search="search"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:status="status"
        v-model:billingStatus="billingStatus"
        v-model:packingStatus="packingStatus"
        v-model:deliveryStatus="deliveryStatus"
        @select="handleSelect"
        @generate-invoice="openGenerateModal"
        @split-order="openSplitModal"
      />
    </div>

    <!-- Order Detail Drawer -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      context="billing"
      @close="handlePanelClose"
      @updated="handleUpdate"
      @split-order="openSplitModal"
    />

  </div>
</template>
