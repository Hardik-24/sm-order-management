<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import DeliveryTable from '~/components/dashboard/DeliveryTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import { Truck, Clock, MapPin, PackageCheck, CheckCircle2, RefreshCw } from 'lucide-vue-next'
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

const activeTab = ref<'ALL' | 'WAITING' | 'DISPATCHED' | 'DELIVERED' | 'ON_HOLD'>('WAITING')

const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }
  
  if (deliveryStatus.value) {
    q.deliveryStatus = deliveryStatus.value
  } else if (activeTab.value !== 'ALL') {
    q.deliveryStatus = activeTab.value
  }

  if (search.value) q.search = search.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  return q
})

const statsQuery = computed(() => {
  const q: any = {}
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  return q
})

const isInitialLoading = ref(true)
const isSwitchingTab = ref(false)

const handleTabChange = (tab: any) => {
  if (activeTab.value === tab) return
  isSwitchingTab.value = true
  activeTab.value = tab
  page.value = 1
}

watch(queryObj, () => {
  isSwitchingTab.value = true
})

const { data: statsData, refresh: refreshStats } = useFetch('/api/orders/delivery-stats', {
  query: statsQuery,
  watch: [statsQuery]
})

const counts = computed(() => ({
  waiting: statsData.value?.waiting ?? 0,
  dispatched: statsData.value?.dispatched ?? 0,
  delivered: statsData.value?.delivered ?? 0,
  onHold: statsData.value?.onHold ?? 0,
  total: statsData.value?.total ?? 0
}))

const nuxtApp = useNuxtApp()
const { data, refresh, pending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

watch(data, (newVal) => {
  if (newVal) {
    isInitialLoading.value = false
    isSwitchingTab.value = false
  }
}, { immediate: true })

let syncChannel: BroadcastChannel | null = null
let silentSyncTimer: any = null

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

function performSilentSync(updatedOrder?: any) {
  if (updatedOrder) applyOrderUpdate(updatedOrder)
  
  if (typeof document !== 'undefined') {
    // Only sync if tab is currently visible
    if (document.visibilityState !== 'visible') return
    // Don't interrupt if typing in search or dropdown
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) return
  }
  refresh()
  refreshStats()
}

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) applyOrderUpdate(event.order)
  performSilentSync()
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
const numWaiting = ref<HTMLElement | null>(null)
const numDispatched = ref<HTMLElement | null>(null)
const numDelivered = ref<HTMLElement | null>(null)
const numTotal = ref<HTMLElement | null>(null)

const triggerStatAnimations = () => {
  if (!statsData.value) return
  nextTick(() => {
    animateNumber(numWaiting.value, counts.value.waiting, { duration: 0.6 })
    animateNumber(numDispatched.value, counts.value.dispatched, { duration: 0.65 })
    animateNumber(numDelivered.value, counts.value.delivered, { duration: 0.7 })
    animateNumber(numTotal.value, counts.value.total, { duration: 0.75 })
  })
}

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()

  // 1. Cross-tab instant 0ms broadcast sync from Driver portal
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      syncChannel = new BroadcastChannel('sm_delivery_channel')
      syncChannel.onmessage = (event) => {
        if (event.data?.type === 'DELIVERY_STATUS_CHANGED') {
          performSilentSync()
        }
      }
    } catch (e) {}
  }

  // 2. Gentle silent background poll (every 8 seconds)
  silentSyncTimer = setInterval(performSilentSync, 8000)
})

onUnmounted(() => {
  if (silentSyncTimer) clearInterval(silentSyncTimer)
  if (syncChannel) syncChannel.close()
})

watch(counts, () => {
  triggerStatAnimations()
}, { deep: true })
</script>

<template>
  <div class="space-y-8">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="p-2.5 rounded-xl bg-[#1a5c4c]/10 border border-[#1a5c4c]/20 text-[#1a5c4c]">
            <Truck class="w-5 h-5" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Delivery & Dispatch</h1>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Assign drivers, monitor live GPS transit, verify destination pins, and manage fulfillment.
        </p>
      </div>

      <div class="flex items-center gap-2.5">
        <button 
          @click="() => { refresh(); refreshStats(); }" 
          :disabled="pending"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending }" />
          <span>Refresh</span>
        </button>
        <a 
          href="/driver" 
          target="_blank"
          class="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1a5c4c] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#134336] transition-colors"
        >
          <Truck class="w-4 h-4" />
          <span>Open Driver App ↗</span>
        </a>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching Approve Orders & Billing Design) -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- 1. Awaiting Dispatch -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-amber-50 p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <Clock class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-amber-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Awaiting Dispatch</p>
            <h3 ref="numWaiting" class="text-2xl font-bold text-gray-900 mb-0.5 tabular-nums">{{ counts.waiting }}</h3>
            <p class="text-xs text-amber-600 font-medium truncate">Ready for driver</p>
          </div>
        </div>
      </div>

      <!-- 2. In Transit -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-blue-50 p-2.5 rounded-lg text-blue-600 border border-blue-100/50">
              <Truck class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-blue-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">In Transit</p>
            <h3 ref="numDispatched" class="text-2xl font-bold text-gray-900 mb-0.5 tabular-nums">{{ counts.dispatched }}</h3>
            <p class="text-xs text-blue-600 font-medium truncate">Live on GPS route</p>
          </div>
        </div>
      </div>

      <!-- 3. Delivered Today -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-emerald-50 p-2.5 rounded-lg text-emerald-600 border border-emerald-100/50">
              <CheckCircle2 class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-emerald-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Delivered</p>
            <h3 ref="numDelivered" class="text-2xl font-bold text-gray-900 mb-0.5 tabular-nums">{{ counts.delivered }}</h3>
            <p class="text-xs text-emerald-600 font-medium truncate">Completed orders</p>
          </div>
        </div>
      </div>

      <!-- 4. Total Orders -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm"
      >
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-[#1a5c4c]/10 p-2.5 rounded-lg text-[#1a5c4c] border border-[#1a5c4c]/20">
              <PackageCheck class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-[#1a5c4c] rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Orders</p>
            <h3 ref="numTotal" class="text-2xl font-bold text-gray-900 mb-0.5 tabular-nums">{{ counts.total }}</h3>
            <p class="text-xs text-[#1a5c4c] font-medium truncate">All delivery records</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Underline Tabs with Badges (Matching Billing & Packing) -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in (['WAITING', 'DISPATCHED', 'DELIVERED', 'ON_HOLD', 'ALL'] as const)" :key="tab"
          @click="handleTabChange(tab)"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span>
            {{ 
              tab === 'WAITING' ? 'Awaiting Dispatch' : 
              tab === 'DISPATCHED' ? 'In Transit' : 
              tab === 'DELIVERED' ? 'Delivered' : 
              tab === 'ON_HOLD' ? 'On Hold' : 'All Orders' 
            }}
          </span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeTab === tab
                ? 'bg-[#1a5c4c]/10 text-[#1a5c4c]'
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ 
              tab === 'WAITING' ? counts.waiting : 
              tab === 'DISPATCHED' ? counts.dispatched : 
              tab === 'DELIVERED' ? counts.delivered : 
              tab === 'ON_HOLD' ? counts.onHold : counts.total 
            }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Table -->
    <div class="relative">
      
      
      <DeliveryTable 
        :isLoading="isSwitchingTab || isInitialLoading"
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
        @refresh="() => { refresh(); refreshStats(); }"
      />
    </div>

    <!-- Detail Panel -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      context="delivery"
      @close="handlePanelClose"
      @updated="(updatedOrder) => { performSilentSync(updatedOrder); }"
    />
  </div>
</template>
