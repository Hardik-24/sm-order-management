<template>
  <div class="min-h-screen bg-gray-50 flex flex-col font-sans">
    <!-- Branded Header -->
    <header class="bg-[#1a1a1a] text-white px-4 py-3.5 shadow-md sticky top-0 z-30">
      <div class="max-w-2xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#1a5c4c] flex items-center justify-center font-extrabold text-white text-sm shadow-inner tracking-wider">
            SM
          </div>
          <div>
            <h1 class="text-xs uppercase tracking-widest text-[#e8e0d4] font-semibold">Silicon Marketing</h1>
            <p class="text-sm font-bold text-white">Delivery Tracking</p>
          </div>
        </div>

        <span 
          class="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5"
          :class="statusBadgeClass"
        >
          <span v-if="trackingData?.deliveryStatus === 'DISPATCHED'" class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          {{ statusBadgeLabel }}
        </span>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-2xl mx-auto w-full p-4 space-y-4 pb-12">
      <!-- Loading State -->
      <div v-if="isLoading" class="py-20 text-center text-gray-400">
        <Loader2 class="w-10 h-10 animate-spin mx-auto mb-3 text-[#1a5c4c]" />
        <p class="text-sm font-medium">Connecting to tracking server...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm space-y-3">
        <AlertCircle class="w-10 h-10 text-rose-500 mx-auto" />
        <h2 class="text-base font-bold text-gray-800">Order Not Found</h2>
        <p class="text-xs text-gray-500">We could not find tracking information for this order. Please verify your link.</p>
      </div>

      <!-- Loaded Tracking State -->
      <div v-else-if="trackingData" class="space-y-4">
        <!-- Order Header Card -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex items-start justify-between">
          <div>
            <span class="text-xs font-bold font-mono text-[#1a5c4c] bg-emerald-50 px-2 py-0.5 rounded">
              Order #{{ trackingData.orderNumber }}
            </span>
            <h2 class="text-lg font-bold text-gray-900 mt-1">{{ trackingData.customerName }}</h2>
            <p class="text-xs text-gray-500">{{ trackingData.customerCompany }}</p>
          </div>

          <div class="text-right">
            <span class="text-[10px] uppercase font-bold text-gray-400 block">Status</span>
            <span class="text-xs font-extrabold text-[#1a5c4c]">{{ trackingData.overallStatus }}</span>
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────────────
             DYNAMIC STATE CARDS (Switches instantly without reload)
        ────────────────────────────────────────────────────────────── -->
        <Transition name="state-fade" mode="out-in">
          <div :key="trackingData.deliveryStatus" class="space-y-4">
            <!-- STATE 1: DISPATCHED — LIVE FLEET GPS TRACKING -->
            <div v-if="trackingData.deliveryStatus === 'DISPATCHED'" class="space-y-4">
              <!-- Live Map Card -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="h-80 sm:h-96 w-full relative">
                  <LiveTrackingMap
                    :driverLocation="trackingData.trip?.currentLocation || null"
                    :startLocation="trackingData.trip?.startLocation || null"
                    :destinationLocation="trackingData.trip?.destinationCoords || null"
                    :routeCoordinates="trackingData.trip?.route || []"
                    :isLive="true"
                    :isSnapshot="false"
                    :distanceKm="trackingData.trip?.totalDistanceKm"
                    :durationMin="trackingData.trip?.durationMinutes"
                  />
                </div>

                <!-- Driver Info Bar -->
                <div class="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-[#1a5c4c] text-white flex items-center justify-center font-bold">
                      {{ trackingData.driverName?.charAt(0) || 'D' }}
                    </div>
                    <div>
                      <p class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        En Route to You
                      </p>
                      <h3 class="text-sm font-bold text-gray-900">{{ trackingData.driverName || 'Delivery Partner' }}</h3>
                    </div>
                  </div>

                  <a 
                    v-if="trackingData.driverPhone" 
                    :href="`tel:${trackingData.driverPhone}`"
                    class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                  >
                    <Phone class="w-3.5 h-3.5" />
                    Call Driver
                  </a>
                </div>
              </div>
            </div>

            <!-- STATE 2: DELIVERED — SUCCESSFUL DELIVERY ROUTE SNAPSHOT -->
            <div v-else-if="trackingData.deliveryStatus === 'DELIVERED'" class="space-y-4">
              <!-- Delivered Success Card -->
              <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
                <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 class="w-7 h-7" />
                </div>
                <h2 class="text-base font-bold text-emerald-950">Shipment Delivered Successfully</h2>
                <p class="text-xs text-emerald-800">
                  Your order was delivered on {{ trackingData.deliveredAt ? new Date(trackingData.deliveredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'today' }}.
                </p>
              </div>

              <!-- Frozen Route Snapshot Map if recorded -->
              <div v-if="trackingData.trip?.route?.length" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
                  <span class="font-bold text-gray-700">Delivered Route Map</span>
                  <span class="text-gray-500">{{ trackingData.trip.totalDistanceKm || 0 }} km driven</span>
                </div>
                <div class="h-72 w-full">
                  <LiveTrackingMap
                    :driverLocation="trackingData.trip?.route[trackingData.trip.route.length - 1]"
                    :startLocation="trackingData.trip?.startLocation || null"
                    :destinationLocation="trackingData.trip?.destinationCoords || null"
                    :routeCoordinates="trackingData.trip?.route || []"
                    :isLive="false"
                    :isSnapshot="true"
                    :distanceKm="trackingData.trip?.totalDistanceKm"
                    :durationMin="trackingData.trip?.durationMinutes"
                  />
                </div>
              </div>
            </div>

            <!-- STATE 3: ON_HOLD — DELIVERY PAUSED NOTICE -->
            <div v-else-if="trackingData.deliveryStatus === 'ON_HOLD'" class="space-y-4">
              <div class="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3 shadow-xs">
                <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <AlertTriangle class="w-7 h-7" />
                </div>
                <div>
                  <h2 class="text-base font-bold text-amber-950">Delivery Temporarily Paused</h2>
                  <p class="text-xs text-amber-800 mt-1 max-w-md mx-auto leading-relaxed">
                    This shipment has been paused by our Mysuru dispatch office. Live GPS tracking will reactivate automatically as soon as the vehicle resumes travel.
                  </p>
                  <p v-if="trackingData.holdReason" class="text-xs font-semibold text-amber-900 bg-amber-100/70 px-3 py-1.5 rounded-lg inline-block mt-2">
                    Notice: {{ trackingData.holdReason }}
                  </p>
                </div>
                <div class="pt-2">
                  <a 
                    href="tel:+919876543210" 
                    class="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <Phone class="w-3.5 h-3.5" />
                    Contact Dispatch Office
                  </a>
                </div>
              </div>
            </div>

            <!-- STATE 4: ASSIGNED — DRIVER ASSIGNED & AWAITING DISPATCH -->
            <div v-else-if="trackingData.deliveryStatus === 'ASSIGNED'" class="space-y-4">
              <div class="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-3">
                <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                  <Truck class="w-7 h-7" />
                </div>
                <div>
                  <h2 class="text-base font-bold text-blue-950">Assigned to Delivery Partner</h2>
                  <p class="text-xs text-blue-800 mt-1 max-w-md mx-auto leading-relaxed">
                    Driver <strong class="text-blue-950 font-bold">{{ trackingData.driverName || 'Assigned Driver' }}</strong> has been allocated to your shipment and is preparing for departure at our Mysuru warehouse.
                  </p>
                  <p class="text-[11px] text-blue-600 mt-2 font-medium">
                    Live GPS route map will appear on this screen the moment the driver departs.
                  </p>
                </div>
              </div>
            </div>

            <!-- STATE 5: WAITING / PROCESSING / CONFIRMED -->
            <div v-else class="space-y-4">
              <div class="bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-3 shadow-xs">
                <div class="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mx-auto">
                  <Clock class="w-6 h-6 text-[#1a5c4c]" />
                </div>
                <div>
                  <h2 class="text-base font-bold text-gray-900">Order Confirmed & Preparing</h2>
                  <p class="text-xs text-gray-600 mt-1 max-w-md mx-auto leading-relaxed">
                    Your order is currently being processed and packed at the Silicon Marketing facility. Live delivery tracking will activate as soon as your items are dispatched.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Order Fulfillment Progress Stepper -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
          <h3 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Shipment Progress</h3>
          <div class="grid grid-cols-4 gap-2 text-center text-[10px]">
            <div class="space-y-1.5">
              <div class="h-2 rounded-full" :class="stepIndex >= 1 ? 'bg-[#1a5c4c]' : 'bg-gray-200'"></div>
              <span class="font-bold block" :class="stepIndex >= 1 ? 'text-[#1a5c4c]' : 'text-gray-400'">Confirmed</span>
            </div>
            <div class="space-y-1.5">
              <div class="h-2 rounded-full" :class="stepIndex >= 2 ? 'bg-[#1a5c4c]' : 'bg-gray-200'"></div>
              <span class="font-bold block" :class="stepIndex >= 2 ? 'text-[#1a5c4c]' : 'text-gray-400'">Packed</span>
            </div>
            <div class="space-y-1.5">
              <div class="h-2 rounded-full" :class="stepIndex >= 3 ? (trackingData.deliveryStatus === 'ON_HOLD' ? 'bg-amber-500' : 'bg-[#1a5c4c]') : 'bg-gray-200'"></div>
              <span class="font-bold block" :class="stepIndex >= 3 ? (trackingData.deliveryStatus === 'ON_HOLD' ? 'text-amber-600' : 'text-[#1a5c4c]') : 'text-gray-400'">
                {{ trackingData.deliveryStatus === 'ON_HOLD' ? 'Paused' : (trackingData.deliveryStatus === 'DISPATCHED' ? 'En Route' : 'Assigned') }}
              </span>
            </div>
            <div class="space-y-1.5">
              <div class="h-2 rounded-full" :class="stepIndex >= 4 ? 'bg-emerald-600' : 'bg-gray-200'"></div>
              <span class="font-bold block" :class="stepIndex >= 4 ? 'text-emerald-700' : 'text-gray-400'">Delivered</span>
            </div>
          </div>
        </div>

        <!-- Delivery Address -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-1">
          <span class="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Delivery Destination</span>
          <div class="flex items-start gap-2 text-xs text-gray-700">
            <MapPin class="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span class="leading-relaxed font-medium">{{ trackingData.deliveryAddress }}</span>
          </div>
        </div>

        <!-- Items Manifest -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
          <div class="flex items-center justify-between border-b border-gray-100 pb-2">
            <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Box class="w-4 h-4 text-[#1a5c4c]" />
              Shipment Contents ({{ trackingData.items?.length || 0 }})
            </span>
          </div>

          <div class="divide-y divide-gray-100 text-xs">
            <div v-for="item in trackingData.items" :key="item.id" class="py-2.5 flex items-center justify-between">
              <div>
                <p class="font-bold text-gray-900">{{ item.sku }}</p>
                <p class="text-[11px] text-gray-500">{{ item.productName }}</p>
              </div>
              <span class="font-extrabold text-gray-900 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
                {{ item.quantity }} {{ item.unit }}
              </span>
            </div>
          </div>
        </div>

        <!-- Support Footer -->
        <div class="text-center text-xs text-gray-400 py-3 space-y-1">
          <p class="font-medium text-gray-500">Silicon Marketing OMS • Live Tracking System</p>
          <p>Need support? Contact us at <a href="tel:+919876543210" class="text-[#1a5c4c] font-semibold underline">+91 98765 43210</a></p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Loader2, AlertCircle, Phone, MapPin, Box, CheckCircle2, AlertTriangle, Truck, Clock } from 'lucide-vue-next'
import LiveTrackingMap from '~/components/ui/LiveTrackingMap.vue'

definePageMeta({ layout: false })

const route = useRoute()
const orderNumber = route.params.orderNumber as string

const isLoading = ref(true)
const error = ref<string | null>(null)
const trackingData = ref<any | null>(null)
let pollTimer: any = null
let realtimeChannel: any = null

const statusBadgeLabel = computed(() => {
  const status = trackingData.value?.deliveryStatus
  if (status === 'DISPATCHED') return 'Out for Delivery'
  if (status === 'DELIVERED') return 'Delivered'
  if (status === 'ON_HOLD') return 'Delivery Paused'
  if (status === 'ASSIGNED') return 'Driver Assigned'
  return trackingData.value?.overallStatus || 'Processing'
})

const statusBadgeClass = computed(() => {
  const status = trackingData.value?.deliveryStatus
  if (status === 'DISPATCHED') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
  if (status === 'DELIVERED') return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
  if (status === 'ON_HOLD') return 'bg-red-500/20 text-red-300 border border-red-500/30'
  if (status === 'ASSIGNED') return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
  return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
})

const stepIndex = computed(() => {
  const deliveryStatus = trackingData.value?.deliveryStatus
  const overallStatus = trackingData.value?.overallStatus
  if (deliveryStatus === 'DELIVERED') return 4
  if (deliveryStatus === 'DISPATCHED' || deliveryStatus === 'ON_HOLD') return 3
  if (deliveryStatus === 'ASSIGNED') return 3
  if (overallStatus === 'READY' || overallStatus === 'PROCESSING') return 2
  return 1
})

async function fetchTracking(silent = false) {
  if (!silent) isLoading.value = true
  try {
    const data = await $fetch<any>(`/api/track/${orderNumber}`, {
      params: { _t: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    })
    trackingData.value = data
    error.value = null
  } catch (e: any) {
    if (!silent) {
      error.value = e.statusMessage || 'Order not found'
    }
  } finally {
    if (!silent) isLoading.value = false
  }
}

let broadcastChannel: any = null

onMounted(async () => {
  await fetchTracking(false)

  // 1. Cross-tab instant 0ms broadcast channel (testing & same-device updates)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel('sm_delivery_channel')
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'DELIVERY_STATUS_CHANGED') {
          fetchTracking(true)
        }
      }
    } catch (e) {}
  }

  // 2. Continuous Auto-Poll: Keep checking actively every 5 seconds as long as order is not delivered
  pollTimer = setInterval(async () => {
    if (trackingData.value?.deliveryStatus !== 'DELIVERED') {
      await fetchTracking(true)
    }
  }, 5000)

  // 3. Instant 0ms Supabase Realtime Push: If orders, delivery status, or trip changes in DB, refresh immediately
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseKey

  if (supabaseUrl && supabaseKey) {
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(supabaseUrl, supabaseKey)
      realtimeChannel = supabase.channel(`public-track-${orderNumber}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchTracking(true)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_statuses' }, () => {
          fetchTracking(true)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_routes' }, () => {
          fetchTracking(true)
        })
        .subscribe()
    }).catch(err => {
      console.warn('Realtime subscription not initialized, relying on poll:', err)
    })
  }
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
  if (realtimeChannel) {
    realtimeChannel.unsubscribe()
    realtimeChannel = null
  }
})
</script>

<style scoped>
.state-fade-enter-active,
.state-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.state-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.state-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
