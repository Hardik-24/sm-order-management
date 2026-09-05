<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import PackingTable from '~/components/dashboard/PackingTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import { Package, Clock, Box, PlayCircle } from 'lucide-vue-next'

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

const activeTab = ref<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'PACKED' | 'ON_HOLD'>('PENDING')

const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }
  
  if (packingStatus.value) {
    q.packingStatus = packingStatus.value
  } else if (activeTab.value !== 'ALL') {
    q.packingStatus = activeTab.value
  }

  if (search.value) q.search = search.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  
  return q
})

const nuxtApp = useNuxtApp()
const { data, refresh, pending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj],
  getCachedData(key) {
    return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
  }
})

const { data: stats, refresh: refreshStats } = useFetch('/api/orders/packing-stats')

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync(() => {
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
import { useGsapAnimation } from '~/composables/useGsapAnimation'
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numPending = ref<HTMLElement | null>(null)
const numInProgress = ref<HTMLElement | null>(null)
const numPacked = ref<HTMLElement | null>(null)
const numTotal = ref<HTMLElement | null>(null)

const triggerStatAnimations = () => {
  if (!stats.value) return
  nextTick(() => {
    animateNumber(numPending.value, stats.value?.pending || 0, { duration: 0.6 })
    animateNumber(numInProgress.value, stats.value?.inProgress || 0, { duration: 0.65 })
    animateNumber(numPacked.value, stats.value?.packed || 0, { duration: 0.7 })
    animateNumber(numTotal.value, stats.value?.total || 0, { duration: 0.75 })
  })
}

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()
})

watch(stats, () => {
  triggerStatAnimations()
}, { deep: true })
</script>

<template>
  <div class="space-y-6 max-w-[1600px] mx-auto w-full pb-8">
    
    <!-- Header & Stat Cards -->
    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-gray-900">Packing Department</h1>
          <p class="text-sm text-gray-500 mt-1">Manage order fulfillment, item verification, and packaging.</p>
        </div>
      </div>

      <!-- Quick Stats -->
      <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
          <div class="bg-amber-100 p-3 rounded-lg text-amber-600">
            <Clock class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Pending</p>
            <h3 ref="numPending" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
          <div class="bg-blue-100 p-3 rounded-lg text-blue-600">
            <PlayCircle class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">In Progress</p>
            <h3 ref="numInProgress" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
          <div class="bg-green-100 p-3 rounded-lg text-green-600">
            <Box class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Packed</p>
            <h3 ref="numPacked" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm flex items-center gap-4">
          <div class="bg-[#e5f6f4] p-3 rounded-lg text-[#1a5c4c]">
            <Package class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Total Orders</p>
            <h3 ref="numTotal" class="text-2xl font-bold text-gray-900 mt-1">0</h3>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 overflow-x-auto">
        <button 
          v-for="tab in ['PENDING', 'IN_PROGRESS', 'PACKED', 'ON_HOLD', 'ALL']" :key="tab"
          @click="activeTab = tab as any; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          {{ tab === 'ALL' ? 'All Orders' : tab === 'PENDING' ? 'Pending Validation' : tab === 'ON_HOLD' ? 'On Hold' : tab === 'IN_PROGRESS' ? 'Currently Packing' : 'Ready / Packed' }}
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
      @updated="refresh(); refreshStats()"
    />
  </div>
</template>
