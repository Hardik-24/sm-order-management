<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { refDebounced } from '@vueuse/core'
import PackingTable from '~/components/dashboard/PackingTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import { Package, Clock, Box, PlayCircle, Zap, CheckCircle2, RefreshCw } from 'lucide-vue-next'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

definePageMeta({ layout: 'dashboard' })

const page = ref(1)
const limit = ref(10)
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const startDate = ref('')
const endDate = ref('')
const status = ref('')
const billingStatus = ref('')
const packingStatus = ref('')
const deliveryStatus = ref('')
const salesPersonId = ref('')
const selectedOrderId = ref<string | null>(null)
const isPanelOpen = ref(false)

const activeTab = ref<'PENDING' | 'URGENT' | 'IN_PROGRESS' | 'PACKED' | 'ALL'>('PENDING')

const queryObj = computed(() => {
  const q: any = { 
    page: page.value, 
    limit: limit.value,
    isApproved: 'true'
  }
  
  if (packingStatus.value) {
    q.packingStatus = packingStatus.value
  } else if (activeTab.value === 'PENDING') {
    q.packingStatus = 'PENDING'
  } else if (activeTab.value === 'URGENT') {
    q.isUrgent = 'true'
    q.packingStatus = '!PACKED'
  } else if (activeTab.value === 'IN_PROGRESS') {
    q.packingStatus = 'IN_PROGRESS'
  } else if (activeTab.value === 'PACKED') {
    q.packingStatus = 'PACKED'
  }

  if (debouncedSearch.value) q.search = debouncedSearch.value.trim()
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  if (salesPersonId.value) q.salesPersonId = salesPersonId.value
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
      data.value.orders[idx] = { 
        ...data.value.orders[idx], 
        ...updatedOrder,
        items: updatedOrder.items ? updatedOrder.items.map((i: any) => ({ ...i })) : data.value.orders[idx].items
      }
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
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Packing Department</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Verify warehouse inventory, track SKU picking progress, and prepare orders for dispatch.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="handleRefresh" 
          :disabled="pending"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching Approve Orders & Billing Design) -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 select-none">
      <!-- 1. Pending Packing -->
      <div 
        @click="activeTab = activeTab === 'PENDING' ? 'ALL' : 'PENDING'; page = 1"
        class="rounded-xl border p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        :class="activeTab === 'PENDING' 
          ? '!bg-amber-100/90 !border-amber-500 ring-2 ring-amber-500/30 shadow-md' 
          : 'bg-white border-[#e5e2dc] hover:border-amber-300 hover:bg-amber-50/20'"
        title="Click to toggle Pending Packing filter"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="p-2 sm:p-2.5 rounded-lg border transition-colors" :class="activeTab === 'PENDING' ? 'bg-amber-500 text-white border-amber-600 shadow-xs' : 'bg-amber-50 text-amber-600 border-amber-100/50'">
              <Clock class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate" :class="activeTab === 'PENDING' ? 'text-amber-900' : 'text-gray-500'">Pending Packing</p>
            <h3 class="text-xl sm:text-2xl font-bold mb-0.5 truncate" :class="activeTab === 'PENDING' ? 'text-amber-950' : 'text-gray-900'">
              <OdometerNumber :value="counts.pending" :loading="pending" />
            </h3>
            <p class="text-[11px] sm:text-xs font-medium truncate" :class="activeTab === 'PENDING' ? 'text-amber-800' : 'text-amber-600'">Awaiting picking</p>
          </div>
        </div>
      </div>

      <!-- 2. Urgent Orders -->
      <div 
        @click="activeTab = activeTab === 'URGENT' ? 'ALL' : 'URGENT'; page = 1"
        class="rounded-xl border p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        :class="activeTab === 'URGENT' 
          ? '!bg-rose-100/90 !border-rose-500 ring-2 ring-rose-500/30 shadow-md' 
          : 'bg-white border-rose-200/80 hover:border-rose-400 hover:bg-rose-50/20'"
        title="Click to toggle Urgent Orders filter"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="p-2 sm:p-2.5 rounded-lg border transition-colors" :class="activeTab === 'URGENT' ? 'bg-rose-500 text-white border-rose-600 shadow-xs' : 'bg-rose-50 text-rose-600 border-rose-100/50'">
              <Zap class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-rose-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate" :class="activeTab === 'URGENT' ? 'text-rose-900' : 'text-rose-600'">⚡ Urgent (Not Packed)</p>
            <h3 class="text-xl sm:text-2xl font-bold mb-0.5 truncate" :class="activeTab === 'URGENT' ? 'text-rose-950' : 'text-gray-900'">
              <OdometerNumber :value="counts.urgent" :loading="pending" />
            </h3>
            <p class="text-[11px] sm:text-xs font-medium truncate" :class="activeTab === 'URGENT' ? 'text-rose-800' : 'text-rose-500'">Needs packing</p>
          </div>
        </div>
      </div>

      <!-- 3. Currently Packing -->
      <div 
        @click="activeTab = activeTab === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'; page = 1"
        class="rounded-xl border p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        :class="activeTab === 'IN_PROGRESS' 
          ? '!bg-blue-100/90 !border-blue-500 ring-2 ring-blue-500/30 shadow-md' 
          : 'bg-white border-[#e5e2dc] hover:border-blue-300 hover:bg-blue-50/20'"
        title="Click to toggle Currently Packing filter"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="p-2 sm:p-2.5 rounded-lg border transition-colors" :class="activeTab === 'IN_PROGRESS' ? 'bg-blue-600 text-white border-blue-700 shadow-xs' : 'bg-blue-50 text-blue-600 border-blue-100/50'">
              <PlayCircle class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-blue-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate" :class="activeTab === 'IN_PROGRESS' ? 'text-blue-900' : 'text-gray-500'">Currently Packing</p>
            <h3 class="text-xl sm:text-2xl font-bold mb-0.5 truncate" :class="activeTab === 'IN_PROGRESS' ? 'text-blue-950' : 'text-gray-900'">
              <OdometerNumber :value="counts.inProgress" :loading="pending" />
            </h3>
            <p class="text-[11px] sm:text-xs font-medium truncate" :class="activeTab === 'IN_PROGRESS' ? 'text-blue-800' : 'text-blue-600'">On floor</p>
          </div>
        </div>
      </div>

      <!-- 4. Ready / Packed -->
      <div 
        @click="activeTab = activeTab === 'PACKED' ? 'ALL' : 'PACKED'; page = 1"
        class="rounded-xl border p-3.5 sm:p-5 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        :class="activeTab === 'PACKED' 
          ? '!bg-emerald-100/90 !border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' 
          : 'bg-white border-[#e5e2dc] hover:border-emerald-300 hover:bg-emerald-50/20'"
        title="Click to toggle Ready / Packed filter"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="p-2 sm:p-2.5 rounded-lg border transition-colors" :class="activeTab === 'PACKED' ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-emerald-50 text-emerald-600 border-emerald-100/50'">
              <CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-emerald-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-0.5 truncate" :class="activeTab === 'PACKED' ? 'text-emerald-900' : 'text-gray-500'">Ready / Packed</p>
            <h3 class="text-xl sm:text-2xl font-bold mb-0.5 truncate" :class="activeTab === 'PACKED' ? 'text-emerald-950' : 'text-gray-900'">
              <OdometerNumber :value="counts.packed" :loading="pending" />
            </h3>
            <p class="text-[11px] sm:text-xs font-medium truncate" :class="activeTab === 'PACKED' ? 'text-emerald-800' : 'text-emerald-600'">Ready for dispatch</p>
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
          :class="activeTab === tab ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span v-if="tab === 'URGENT'">⚡</span>
          <span>
            {{ tab === 'PENDING' ? 'Pending Packing' : tab === 'URGENT' ? 'Urgent (Not Packed)' : tab === 'IN_PROGRESS' ? 'Currently Packing' : tab === 'PACKED' ? 'Ready / Packed' : 'All Orders' }}
          </span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeTab === tab
                ? (tab === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-[#1b3b5f]/10 text-[#1b3b5f]')
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ tab === 'PENDING' ? counts.pending : tab === 'URGENT' ? counts.urgent : tab === 'IN_PROGRESS' ? counts.inProgress : tab === 'PACKED' ? counts.packed : counts.total }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Table -->
    <div class="relative z-20">
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
        v-model:salesPersonId="salesPersonId"
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
