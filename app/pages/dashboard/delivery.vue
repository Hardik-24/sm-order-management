<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import DeliveryTable from '~/components/dashboard/DeliveryTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import { Truck, Clock, MapPin, PackageCheck } from 'lucide-vue-next'

definePageMeta({ layout: 'dashboard' })

const page = ref(1)
const limit = ref(10)
const search = ref('')
const startDate = ref('')
const endDate = ref('')
const status = ref('')
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

function performSilentSync() {
  if (typeof document !== 'undefined') {
    // Only sync if tab is currently visible
    if (document.visibilityState !== 'visible') return
    // Don't interrupt if order drawer is open
    if (isPanelOpen.value) return
    // Don't interrupt if typing in search or dropdown
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) return
  }
  refresh()
  refreshStats()
}

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync(() => {
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
import { useGsapAnimation } from '~/composables/useGsapAnimation'
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numWaiting = ref<HTMLElement | null>(null)
const numDispatched = ref<HTMLElement | null>(null)
const numDelivered = ref<HTMLElement | null>(null)
const numTotal = ref<HTMLElement | null>(null)

const triggerStatAnimations = () => {
  if (!statsData.value) return
  nextTick(() => {
    animateNumber(numWaiting.value, statsData.value?.waiting || 0, { duration: 0.6 })
    animateNumber(numDispatched.value, statsData.value?.dispatched || 0, { duration: 0.65 })
    animateNumber(numDelivered.value, statsData.value?.delivered || 0, { duration: 0.7 })
    animateNumber(numTotal.value, statsData.value?.total || 0, { duration: 0.75 })
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

watch(statsData, () => {
  triggerStatAnimations()
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[#1a1a1a]">Delivery Management</h1>
        <p class="text-sm text-gray-500 mt-1">Assign drivers, update ETAs, and track deliveries</p>
      </div>

      <div class="flex items-center gap-3">
        <a 
          href="/driver" 
          target="_blank"
          class="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1a5c4c] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#134336] transition-colors"
        >
          <Truck class="w-4 h-4" />
          Open Driver App ↗
        </a>
      </div>
    </div>

    <!-- Quick Stats -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
        <div class="bg-amber-100 p-3 rounded-lg text-amber-600">
          <Clock class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Waiting</p>
          <h3 ref="numWaiting" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
        <div class="bg-blue-100 p-3 rounded-lg text-blue-600">
          <Truck class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Dispatched</p>
          <h3 ref="numDispatched" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
        <div class="bg-green-100 p-3 rounded-lg text-green-600">
          <MapPin class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Delivered</p>
          <h3 ref="numDelivered" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
        <div class="bg-[#e5f6f4] p-3 rounded-lg text-[#1a5c4c]">
          <PackageCheck class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Total Orders</p>
          <h3 ref="numTotal" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 overflow-x-auto">
        <button 
          v-for="tab in ['WAITING', 'DISPATCHED', 'DELIVERED', 'ON_HOLD', 'ALL']" :key="tab"
          @click="handleTabChange(tab)"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          {{ tab === 'ALL' ? 'All Orders' : tab === 'WAITING' ? 'Awaiting Dispatch' : tab === 'ON_HOLD' ? 'On Hold' : tab === 'DISPATCHED' ? 'In Transit' : 'Delivered' }}
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
      @updated="() => { refresh(); refreshStats(); }"
    />
  </div>
</template>
