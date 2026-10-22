<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import DeliveryTable from '~/components/dashboard/DeliveryTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import CreateTripModal from '~/components/dashboard/CreateTripModal.vue'
import {
  Truck, Clock, MapPin, PackageCheck, CheckCircle2, RefreshCw,
  Plus, ArrowUp, ArrowDown, ChevronRight, User, ExternalLink, Calendar, AlertTriangle
} from 'lucide-vue-next'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

definePageMeta({ layout: 'dashboard' })

const viewMode = ref<'TRIPS' | 'ORDERS'>('TRIPS')
const isCreateTripModalOpen = ref(false)

// Trips Fetching
const { data: tripsData, refresh: refreshTrips, pending: pendingTrips } = useFetch<any>('/api/trips')
const tripCounts = computed(() => ({
  total: tripsData.value?.counts?.total ?? 0,
  planned: tripsData.value?.counts?.planned ?? 0,
  inTransit: tripsData.value?.counts?.inTransit ?? 0,
  completed: tripsData.value?.counts?.completed ?? 0,
}))
const isInitialTripsLoading = computed(() => {
  return pendingTrips.value && (!tripsData.value?.trips || tripsData.value.trips.length === 0)
})

const isReorderingStop = ref(false)
const handleReorderStop = async (trip: any, stopIndex: number, direction: number) => {
  const targetIndex = stopIndex + direction
  if (targetIndex < 0 || targetIndex >= trip.stops.length) return

  isReorderingStop.value = true
  try {
    const newStops = [...trip.stops]
    const temp = newStops[stopIndex]
    newStops[stopIndex] = newStops[targetIndex]
    newStops[targetIndex] = temp

    const stopOrder = newStops.map((s, idx) => ({
      stopId: s.id,
      stopSequence: idx + 1
    }))

    await $fetch(`/api/trips/${trip.id}/reorder`, {
      method: 'PATCH',
      body: { stopOrder }
    })
    try {
      notifyChange({ type: 'TRIP_CHANGE', action: 'REORDER_STOPS', tripId: trip.id, stopOrder })
    } catch (e) {}
    await refreshTrips()
  } catch (e: any) {
    console.error('Failed to reorder stop', e)
    alert(e.data?.message || 'Failed to reorder stop sequence')
  } finally {
    isReorderingStop.value = false
  }
}

const selectedTripOrderIds = ref<string[]>([])

const handleToggleTripOrder = (orderId: string) => {
  const ord = data.value?.orders?.find((o: any) => o.id === orderId)
  if (ord && ord.vehicleMode === 'PARTY_VEHICLE') {
    return
  }
  const idx = selectedTripOrderIds.value.indexOf(orderId)
  if (idx > -1) {
    selectedTripOrderIds.value.splice(idx, 1)
  } else {
    selectedTripOrderIds.value.push(orderId)
  }
}

const handleClearTripSelection = () => {
  selectedTripOrderIds.value = []
}

const onTripCreated = (createdTrip?: any) => {
  selectedTripOrderIds.value = []
  refresh()
  refreshStats()
  refreshTrips()
  try {
    notifyChange({ type: 'TRIP_CREATED', action: 'TRIP_CREATED', trip: createdTrip })
  } catch (e) {}
}

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
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null

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

function triggerSilentSync(updatedOrder?: any) {
  if (updatedOrder) applyOrderUpdate(updatedOrder)
  
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer)
  syncDebounceTimer = setTimeout(() => {
    performSilentSync()
  }, 400)
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
  refreshTrips()
}

// Realtime instant synchronization across all devices
const { onOrderSync, notifyChange } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) applyOrderUpdate(event.order)
  triggerSilentSync()
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
          triggerSilentSync()
        }
      }
    } catch (e) {}
  }

  // 2. Gentle silent background poll fallback (every 30 seconds, only when tab is visible)
  silentSyncTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      triggerSilentSync()
    }
  }, 30000)
})

onUnmounted(() => {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer)
  if (silentSyncTimer) clearInterval(silentSyncTimer)
  if (syncChannel) syncChannel.close()
})

let lastCounts = { waiting: -1, dispatched: -1, delivered: -1, onHold: -1, total: -1 }

watch(counts, (newVal) => {
  if (
    newVal.waiting !== lastCounts.waiting ||
    newVal.dispatched !== lastCounts.dispatched ||
    newVal.delivered !== lastCounts.delivered ||
    newVal.onHold !== lastCounts.onHold ||
    newVal.total !== lastCounts.total
  ) {
    lastCounts = { ...newVal }
    triggerStatAnimations()
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto">
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

      <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <button 
          @click="() => { refresh(); refreshStats(); refreshTrips(); }" 
          :disabled="pending"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': pending || pendingTrips }" />
          <span>Refresh</span>
        </button>

        <button 
          @click="isCreateTripModalOpen = true"
          class="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 bg-[#1a5c4c] hover:bg-[#134336] text-white rounded-lg text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Create Trip</span>
        </button>

        <a 
          href="/driver" 
          target="_blank"
          class="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-black transition-colors"
        >
          <Truck class="w-4 h-4" />
          <span>Driver App ↗</span>
        </a>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching Approve Orders & Billing Design) -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
      <!-- 1. Awaiting Dispatch -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <Clock class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Awaiting Dispatch</p>
            <h3 ref="numWaiting" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 tabular-nums truncate">{{ counts.waiting }}</h3>
            <p class="text-[11px] sm:text-xs text-amber-600 font-medium truncate">Ready for driver</p>
          </div>
        </div>
      </div>

      <!-- 2. In Transit -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-blue-50 p-2 sm:p-2.5 rounded-lg text-blue-600 border border-blue-100/50">
              <Truck class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-blue-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">In Transit</p>
            <h3 ref="numDispatched" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 tabular-nums truncate">{{ counts.dispatched }}</h3>
            <p class="text-[11px] sm:text-xs text-blue-600 font-medium truncate">Live on GPS</p>
          </div>
        </div>
      </div>

      <!-- 3. Delivered Today -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-emerald-50 p-2 sm:p-2.5 rounded-lg text-emerald-600 border border-emerald-100/50">
              <CheckCircle2 class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-emerald-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Delivered</p>
            <h3 ref="numDelivered" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 tabular-nums truncate">{{ counts.delivered }}</h3>
            <p class="text-[11px] sm:text-xs text-emerald-600 font-medium truncate">Completed orders</p>
          </div>
        </div>
      </div>

      <!-- 4. Total Orders -->
      <div 
        class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm"
      >
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-[#1a5c4c]/10 p-2 sm:p-2.5 rounded-lg text-[#1a5c4c] border border-[#1a5c4c]/20">
              <PackageCheck class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1a5c4c] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Orders</p>
            <h3 ref="numTotal" class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 tabular-nums truncate">{{ counts.total }}</h3>
            <p class="text-[11px] sm:text-xs text-[#1a5c4c] font-medium truncate">All records</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Primary Mode Switcher: Trips & Fleet Manifests vs Individual Orders -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
      <div class="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          type="button"
          @click="viewMode = 'TRIPS'"
          class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          :class="viewMode === 'TRIPS' ? 'bg-white text-[#1a5c4c] shadow-xs' : 'text-gray-600 hover:text-gray-900'"
        >
          <Truck class="w-4 h-4" />
          <span>Trips & Fleet Manifests</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-[#1a5c4c]/10 text-[#1a5c4c] font-extrabold">
            {{ tripCounts.total }}
          </span>
        </button>

        <button
          type="button"
          @click="viewMode = 'ORDERS'"
          class="px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          :class="viewMode === 'ORDERS' ? 'bg-white text-[#1a5c4c] shadow-xs' : 'text-gray-600 hover:text-gray-900'"
        >
          <PackageCheck class="w-4 h-4" />
          <span>Individual Orders</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-700 font-extrabold">
            {{ counts.total }}
          </span>
        </button>
      </div>

      <div v-if="viewMode === 'TRIPS'" class="text-xs text-gray-500 flex items-center gap-2">
        <span v-if="pendingTrips && !isInitialTripsLoading" class="inline-flex items-center gap-1 text-[11px] text-[#1a5c4c] font-semibold">
          <RefreshCw class="w-3 h-3 animate-spin" /> Syncing...
        </span>
        <span>
          <span class="font-bold text-gray-900">{{ tripCounts.inTransit }}</span> active trips • 
          <span class="font-bold text-gray-900">{{ tripCounts.planned }}</span> planned • 
          <span class="font-bold text-gray-900">{{ tripCounts.completed }}</span> completed
        </span>
      </div>
    </div>

    <!-- VIEW 1: TRIPS & FLEET MANIFESTS -->
    <div v-if="viewMode === 'TRIPS'" class="space-y-4">
      <!-- Initial Loading (only when trips have never loaded yet) -->
      <div v-if="isInitialTripsLoading" class="py-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
        <RefreshCw class="w-6 h-6 animate-spin mx-auto text-gray-400 mb-2" />
        <p class="text-xs font-semibold">Loading fleet trips...</p>
      </div>

      <div v-else-if="!tripsData?.trips || tripsData.trips.length === 0" class="py-16 text-center bg-white rounded-xl border border-dashed border-gray-300 space-y-3">
        <Truck class="w-10 h-10 text-gray-300 mx-auto" />
        <h3 class="text-base font-bold text-gray-800">No Trips Created Yet</h3>
        <p class="text-xs text-gray-500 max-w-sm mx-auto">
          Bundle multiple orders into a single trip, assign driver, choose specific customer delivery addresses, set pins, and sequence driver stops.
        </p>
        <button
          type="button"
          @click="isCreateTripModalOpen = true"
          class="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#1a5c4c] hover:bg-[#134336] text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Create First Trip Manifest</span>
        </button>
      </div>

      <!-- Trips List -->
      <div v-else class="space-y-4">
        <div
          v-for="trip in tripsData.trips"
          :key="trip.id"
          class="bg-white rounded-xl border border-[#e5e2dc] shadow-xs overflow-hidden transition hover:shadow-sm"
        >
          <!-- Trip Card Header -->
          <div class="p-4 sm:p-5 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                :class="trip.status === 'IN_TRANSIT' ? 'bg-emerald-500 text-white animate-pulse' : trip.status === 'COMPLETED' ? 'bg-gray-100 text-gray-600' : 'bg-[#1a5c4c]/10 text-[#1a5c4c]'"
              >
                <Truck class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2.5 flex-wrap">
                  <h3 class="font-extrabold text-sm text-gray-900 tracking-tight font-mono">{{ trip.tripNumber }}</h3>
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    :class="trip.status === 'IN_TRANSIT'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : trip.status === 'COMPLETED'
                      ? 'bg-gray-100 text-gray-700 border border-gray-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'"
                  >
                    {{ trip.status === 'IN_TRANSIT' ? '🟢 In Transit (Live GPS)' : trip.status === 'COMPLETED' ? '✓ Completed' : 'Planned' }}
                  </span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span class="font-medium text-gray-700">Driver: <strong>{{ trip.driverName }}</strong></span>
                  <span v-if="trip.vehicleNumber">• Vehicle: {{ trip.vehicleNumber }}</span>
                  <span>• {{ trip.stops?.length || 0 }} Stops Manifest</span>
                </div>
              </div>
            </div>

            <!-- Progress Bar & Summary -->
            <div class="flex items-center gap-3 shrink-0">
              <div class="text-right">
                <span class="text-[11px] font-bold text-gray-600 block">
                  {{ trip.stops?.filter((s: any) => s.status === 'DELIVERED').length || 0 }} of {{ trip.stops?.length || 0 }} Delivered
                </span>
                <div class="w-28 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div
                    class="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    :style="{ width: `${((trip.stops?.filter((s: any) => s.status === 'DELIVERED').length || 0) / Math.max(1, trip.stops?.length || 1)) * 100}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Stops Table / Manifest Breakdown -->
          <div class="p-4 sm:p-5 space-y-3">
            <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
              <span>Delivery Sequence & Stops Manifest</span>
              <span class="text-gray-400 text-[10px] font-normal">Use arrows (▲ / ▼) to reorder sequence</span>
            </div>

            <div class="space-y-2">
              <div
                v-for="(stop, sIdx) in trip.stops"
                :key="stop.id"
                class="p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <!-- Stop Number + Reorder Arrows + Customer Info -->
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <!-- Sequence Number -->
                  <div class="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-gray-200">
                    {{ stop.stopSequence }}
                  </div>

                  <!-- Reorder Sequence Controls -->
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      @click="handleReorderStop(trip, sIdx, -1)"
                      :disabled="sIdx === 0 || trip.status === 'COMPLETED' || isReorderingStop"
                      class="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-20 transition cursor-pointer"
                      title="Move stop earlier in sequence"
                    >
                      <ArrowUp class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      @click="handleReorderStop(trip, sIdx, 1)"
                      :disabled="sIdx === trip.stops.length - 1 || trip.status === 'COMPLETED' || isReorderingStop"
                      class="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-20 transition cursor-pointer"
                      title="Move stop later in sequence"
                    >
                      <ArrowDown class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <!-- Customer / Address Info -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        @click="handleSelect(stop.orderId)"
                        class="font-bold text-gray-900 hover:text-[#1a5c4c] underline cursor-pointer"
                      >
                        {{ stop.order?.orderNumber || 'Order' }}
                      </button>
                      <span class="font-semibold text-gray-800">{{ stop.customerName }}</span>
                      <span v-if="stop.order?.customer?.company" class="text-gray-400">({{ stop.order.customer.company }})</span>
                    </div>
                    <div class="text-[11px] text-gray-500 truncate mt-0.5">
                      📍 {{ stop.addressLine }} {{ stop.city ? `• ${stop.city}` : '' }}
                      <span v-if="stop.landmark" class="text-gray-400">({{ stop.landmark }})</span>
                    </div>
                  </div>
                </div>

                <!-- Stop Status & Track Button -->
                <div class="flex items-center gap-2.5 shrink-0 justify-end">
                  <!-- Status Badge -->
                  <span
                    class="px-2.5 py-1 rounded-md text-[11px] font-bold"
                    :class="stop.status === 'DELIVERED'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : stop.status === 'IN_TRANSIT'
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'"
                  >
                    {{ stop.status === 'DELIVERED' ? '✓ Delivered' : stop.status === 'IN_TRANSIT' ? '🚚 Next Delivery' : '⏳ Pending' }}
                  </span>

                  <!-- Live Tracking Link -->
                  <a
                    v-if="stop.order?.orderNumber"
                    :href="`/track/${stop.order.orderNumber}`"
                    target="_blank"
                    class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-[#1a5c4c] transition"
                    title="Open Customer Live GPS Tracking Page"
                  >
                    <ExternalLink class="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- VIEW 2: INDIVIDUAL ORDERS QUEUE -->
    <div v-else class="space-y-4">
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

      <!-- Orders Table -->
      <div class="relative">
        <DeliveryTable 
          :isLoading="isSwitchingTab || isInitialLoading"
          :orders="data?.orders || []"
          :total="data?.total || 0"
          :selectedTripOrderIds="selectedTripOrderIds"
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
          @toggleTripOrder="handleToggleTripOrder"
          @refresh="() => { refresh(); refreshStats(); refreshTrips(); }"
        />
      </div>
    </div>

    <!-- Detail Panel -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      context="delivery"
      @close="handlePanelClose"
      @updated="(updatedOrder) => { performSilentSync(updatedOrder); }"
    />

    <!-- Create Trip Manifest Modal -->
    <CreateTripModal
      :isOpen="isCreateTripModalOpen"
      :preselectedOrderIds="selectedTripOrderIds"
      @close="isCreateTripModalOpen = false"
      @created="onTripCreated"
    />

    <!-- Floating Bottom Trip Draft Confirmation Bar -->
    <Transition
      enter-active-class="transition duration-300 ease-out transform"
      enter-from-class="translate-y-20 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in transform"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-20 opacity-0"
    >
      <div 
        v-if="selectedTripOrderIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-3 sm:px-4 pointer-events-auto"
      >
        <div class="bg-gray-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-gray-700/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <!-- Row 1 on mobile, Left side on desktop -->
          <div class="flex items-center justify-between sm:justify-start gap-3 min-w-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1a5c4c] flex items-center justify-center shrink-0 shadow-sm text-white">
                <Truck class="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs sm:text-sm font-bold text-white tracking-tight">Trip Draft</span>
                  <span class="inline-flex items-center justify-center text-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-emerald-400 text-gray-950 leading-none select-none tracking-normal shrink-0">
                    {{ selectedTripOrderIds.length }} {{ selectedTripOrderIds.length === 1 ? 'order' : 'orders' }}
                  </span>
                </div>
                <p class="text-[11px] text-gray-300 truncate hidden sm:block">
                  Select more orders from table or proceed to assign driver & manifest.
                </p>
              </div>
            </div>

            <!-- Clear button on mobile (top right) -->
            <button
              type="button"
              @click="handleClearTripSelection"
              class="sm:hidden px-2.5 py-1 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer shrink-0"
            >
              Clear
            </button>
          </div>

          <!-- Row 2 on mobile (Full-width action button), Right side on desktop -->
          <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <!-- Clear button on desktop -->
            <button
              type="button"
              @click="handleClearTripSelection"
              class="hidden sm:block px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              @click="isCreateTripModalOpen = true"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a5c4c] hover:bg-[#154a3d] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Confirm & Create Trip</span>
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
