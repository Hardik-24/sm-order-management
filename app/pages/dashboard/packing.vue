<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import PackingTable from '~/components/dashboard/PackingTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import { Package, Clock, Box, PlayCircle, Zap, CheckCircle2, RefreshCw } from 'lucide-vue-next'
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

const activeTab = ref<'PENDING' | 'URGENT' | 'IN_PROGRESS' | 'PACKED' | 'ALL'>('PENDING')

const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }
  
  if (packingStatus.value) {
    q.packingStatus = packingStatus.value
  } else if (activeTab.value === 'PENDING') {
    q.packingStatus = 'PENDING'
  } else if (activeTab.value === 'URGENT') {
    q.isUrgent = 'true'
  } else if (activeTab.value === 'IN_PROGRESS') {
    q.packingStatus = 'IN_PROGRESS'
  } else if (activeTab.value === 'PACKED') {
    q.packingStatus = 'PACKED'
  }

  if (search.value) q.search = search.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  
  return q
})

const { data, refresh, pending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

const statsQuery = computed(() => {
  const q: any = {}
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  return q
})

const { data: stats, refresh: refreshStats } = useFetch('/api/orders/packing-stats', {
  query: statsQuery,
  watch: [statsQuery]
})

const counts = computed(() => {
  return {
    pending: stats.value?.pending ?? 0,
    urgent: stats.value?.urgent ?? 0,
    inProgress: stats.value?.inProgress ?? 0,
    packed: stats.value?.packed ?? 0,
    total: stats.value?.total ?? 0
  }
})

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

const handleRefresh = async () => {
  await Promise.all([refresh(), refreshStats()])
}

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) applyOrderUpdate(event.order)
  refresh()
  refreshStats()
})

watch([search, status, billingStatus, packingStatus, deliveryStatus, startDate, endDate], () => {
  page.value = 1
})

const handleSelect = (id: string) => {
  selectedOrderId.value = id
  isPanelOpen.value = true
}

const handlePanelClose = () => {
  isPanelOpen.value = false
  selectedOrderId.value = null
}

// GSAP Animations
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numPending = ref<HTMLElement | null>(null)
const numUrgent = ref<HTMLElement | null>(null)
const numInProgress = ref<HTMLElement | null>(null)
const numPacked = ref<HTMLElement | null>(null)

const triggerStatAnimations = () => {
  if (!stats.value) return
  nextTick(() => {
    if (numPending.value) animateNumber(numPending.value, counts.value.pending, { duration: 0.55 })
    if (numUrgent.value) animateNumber(numUrgent.value, counts.value.urgent, { duration: 0.6 })
    if (numInProgress.value) animateNumber(numInProgress.value, counts.value.inProgress, { duration: 0.65 })
    if (numPacked.value) animateNumber(numPacked.value, counts.value.packed, { duration: 0.7 })
  })
}

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()
})

watch(() => counts.value, () => {
  triggerStatAnimations()
}, { deep: true })
</script>

<template>
  <div class="space-y-8 p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Packing Department</h1>
        <p class="text-sm text-gray-500 mt-1">
          Verify warehouse inventory, track SKU picking progress, and prepare orders for dispatch.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="handleRefresh" 
          :disabled="pending"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching Approve Orders & Billing Design) -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- 1. Pending Packing -->
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
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Pending Packing</p>
            <h3 ref="numPending" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.pending }}</h3>
            <p class="text-xs text-amber-600 font-medium">Awaiting picking</p>
          </div>
        </div>
      </div>

      <!-- 2. Urgent Orders -->
      <div 
        @click="activeTab = 'URGENT'; page = 1"
        class="bg-white rounded-xl border border-rose-200/80 p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
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

      <!-- 3. Currently Packing -->
      <div 
        @click="activeTab = 'IN_PROGRESS'; page = 1"
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-blue-50 p-2.5 rounded-lg text-blue-600 border border-blue-100/50">
              <PlayCircle class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-blue-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Currently Packing</p>
            <h3 ref="numInProgress" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.inProgress }}</h3>
            <p class="text-xs text-blue-600 font-medium">On warehouse floor</p>
          </div>
        </div>
      </div>

      <!-- 4. Ready / Packed -->
      <div 
        @click="activeTab = 'PACKED'; page = 1"
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
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Ready / Packed</p>
            <h3 ref="numPacked" class="text-2xl font-bold text-gray-900 mb-0.5">{{ counts.packed }}</h3>
            <p class="text-xs text-emerald-600 font-medium">Ready for dispatch</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Underline Tabs with Badges -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in (['PENDING', 'URGENT', 'IN_PROGRESS', 'PACKED', 'ALL'] as const)" :key="tab"
          @click="activeTab = tab; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span v-if="tab === 'URGENT'">⚡</span>
          <span>
            {{ tab === 'PENDING' ? 'Pending Packing' : tab === 'URGENT' ? 'Urgent Orders' : tab === 'IN_PROGRESS' ? 'Currently Packing' : tab === 'PACKED' ? 'Ready / Packed' : 'All Orders' }}
          </span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeTab === tab
                ? (tab === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-[#1a5c4c]/10 text-[#1a5c4c]')
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ tab === 'PENDING' ? counts.pending : tab === 'URGENT' ? counts.urgent : tab === 'IN_PROGRESS' ? counts.inProgress : tab === 'PACKED' ? counts.packed : counts.total }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Table -->
    <div class="relative">
      <PackingTable 
        :orders="data?.orders || []"
        :isLoading="pending"
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
      />
    </div>

    <!-- Detail Panel -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      context="packing"
      @close="handlePanelClose"
      @updated="handleUpdate"
    />
  </div>
</template>
