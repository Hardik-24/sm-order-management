<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Filter, Search, MoreHorizontal, Calendar, X, MapPin, Share2, Loader2, UserPlus, Truck, Check, CheckCircle2, ChevronRight, Zap, Plus } from 'lucide-vue-next'
import { formatDate } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
import type { Order } from '~/types'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import LiveTrackingMap from '~/components/ui/LiveTrackingMap.vue'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import { useSnackbar } from '~/composables/useSnackbar'

const getPrivilegeColor = (tier?: string) => {
  switch (tier) {
    case 'GOLD': return 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/40'
    case 'SILVER': return 'bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-300/40'
    default: return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}

const getItemsCountText = (order: any) => {
  const count = order.items?.length || 0
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

const getTotalNos = (order: any) => {
  if (!order.items || !order.items.length) return '0 nos.'
  const totalUnits = order.items.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0)
  return `${totalUnits} nos.`
}

const { showSaving, showSaved, showEditing } = useSnackbar()

const props = withDefaults(defineProps<{
  orders: Order[]
  isLoading?: boolean
  total: number
  page: number
  limit: number
  search: string
  startDate: string
  endDate: string
  status: string
  deliveryStatus: string
  billingStatus?: string
  packingStatus?: string
  selectedTripOrderIds?: string[]
}>(), {
  selectedTripOrderIds: () => []
})

const emit = defineEmits<{
  (e: 'update:page', val: number): void
  (e: 'update:limit', val: number): void
  (e: 'update:search', val: string): void
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:deliveryStatus', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'update:packingStatus', val: string): void
  (e: 'select', orderId: string): void
  (e: 'toggleTripOrder', orderId: string): void
  (e: 'refresh'): void
}>()

const { animateStagger } = useGsapAnimation()
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)
const tableScrollRef = ref<HTMLElement | null>(null)

let lastOrderIds = ''
const triggerRowAnimation = (force = false) => {
  nextTick(() => {
    if (!props.isLoading) {
      const currentIds = (props.orders || []).map((o: any) => o.id).join(',')
      if (force || currentIds !== lastOrderIds) {
        lastOrderIds = currentIds
        if (tbodyRef.value) {
          const rows = tbodyRef.value.querySelectorAll('tr')
          const targetRows = Array.from(rows).slice(0, 15)
          animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
        }
        if (mobileListRef.value) {
          const targetCards = Array.from(mobileListRef.value.children).slice(0, 15)
          animateStagger(targetCards, { duration: 0.18, stagger: 0.015, y: 4 })
        }
      }
    }
  })
}

watch([() => props.orders, () => props.isLoading], () => {
  triggerRowAnimation()
}, { immediate: false })

const tableRootRef = ref<HTMLElement | null>(null)

watch(() => props.page, () => {
  nextTick(() => {
    tableRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

onMounted(() => {
  triggerRowAnimation(true)
})


import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const trackingModalOrder = ref<any | null>(null)
const trackingData = ref<any | null>(null)
const isTrackingLoading = ref(false)
let trackingPollTimer: ReturnType<typeof setInterval> | null = null
let trackingRealtimeChannel: RealtimeChannel | null = null

const fetchTrackingData = async (orderNumber: string, silent = false) => {
  if (!silent) isTrackingLoading.value = true
  try {
    const data = await $fetch<any>(`/api/track/${orderNumber}`)
    
    // Prevent stale REST data from overwriting fresh WebSocket data
    if (
      trackingData.value?.trip?.currentLocation?.timestamp &&
      data?.trip?.currentLocation?.timestamp &&
      trackingData.value.trip.currentLocation.timestamp > data.trip.currentLocation.timestamp
    ) {
      // Keep local fresh data
      data.trip.currentLocation = { ...trackingData.value.trip.currentLocation }
      if (trackingData.value.trip.totalDistanceKm !== undefined) {
        data.trip.totalDistanceKm = trackingData.value.trip.totalDistanceKm
      }
    }
    
    trackingData.value = data
  } catch (e) {
    console.error('Failed to load tracking data:', e)
  } finally {
    if (!silent) isTrackingLoading.value = false
  }
}

const openTrackingModal = async (order: any) => {
  trackingModalOrder.value = order
  await fetchTrackingData(order.orderNumber || order.id)
  
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseKey

  if (trackingPollTimer) clearInterval(trackingPollTimer)
  if (trackingRealtimeChannel) {
    trackingRealtimeChannel.unsubscribe()
    trackingRealtimeChannel = null
  }

  if (supabaseUrl && supabaseKey) {
    // 🚀 USE REALTIME WEBSOCKETS
    const supabase = createClient(supabaseUrl, supabaseKey)
    trackingRealtimeChannel = supabase.channel(`trip_${order.id}`)
      .on('broadcast', { event: 'LOCATION_UPDATE' }, (payload) => {
        if (trackingData.value && trackingData.value.trip) {
          const { coords, distanceKm } = payload.payload
          trackingData.value.trip.currentLocation = coords
          if (distanceKm !== undefined) {
            trackingData.value.trip.totalDistanceKm = distanceKm
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_routes', filter: `orderId=eq.${order.id}` }, () => {
        // Trigger silent refresh instantly when GPS updates in DB
        fetchTrackingData(trackingModalOrder.value?.orderNumber || trackingModalOrder.value?.id, true)
      })
      .subscribe()
  } else {
    // 🐌 FALLBACK TO POLLING
    trackingPollTimer = setInterval(() => {
      if (trackingModalOrder.value) {
        fetchTrackingData(trackingModalOrder.value.orderNumber || trackingModalOrder.value.id, true)
      }
    }, 5000)
  }
}

const closeTrackingModal = () => {
  if (trackingPollTimer) {
    clearInterval(trackingPollTimer)
    trackingPollTimer = null
  }
  if (trackingRealtimeChannel) {
    trackingRealtimeChannel.unsubscribe()
    trackingRealtimeChannel = null
  }
  trackingModalOrder.value = null
  trackingData.value = null
}

const shareOnWhatsApp = (order: any) => {
  if (typeof window === 'undefined') return
  const origin = window.location.origin
  const trackUrl = `${origin}/track/${order.orderNumber}`
  const customerName = order.customer?.name || 'Customer'
  const driverName = order.deliveryStatus?.driverName || order.deliveryDriver || 'our delivery partner'
  
  const text = `Hello ${customerName}! Your Silicon Marketing order #${order.orderNumber} is out for delivery with driver ${driverName}. You can track your delivery live here: ${trackUrl}`
  
  const phone = order.customer?.phone ? order.customer.phone.replace(/[^0-9]/g, '') : ''
  const waUrl = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`
    
  window.open(waUrl, '_blank')
}

// Set Delivery Pin Modal
const isPinModalOpen = ref(false)
const selectedPinOrder = ref<any | null>(null)

const openPinModal = (order: any) => {
  selectedPinOrder.value = order
  isPinModalOpen.value = true
}

const onPinSaved = (pin: any) => {
  if (selectedPinOrder.value) {
    selectedPinOrder.value.destinationCoords = pin
    selectedPinOrder.value.hasDestinationPin = !!pin
    if (selectedPinOrder.value.customer) {
      selectedPinOrder.value.customer.latitude = pin ? pin.lat : null
      selectedPinOrder.value.customer.longitude = pin ? pin.lng : null
      selectedPinOrder.value.customer.landmark = pin ? pin.landmark : null
    }
  }
  if (pin) {
    showSaved(`Delivery pin saved for ${selectedPinOrder.value?.customer?.company || selectedPinOrder.value?.customer?.name || 'Customer'}`)
  } else {
    showSaved(`Delivery pin removed for ${selectedPinOrder.value?.customer?.company || selectedPinOrder.value?.customer?.name || 'Customer'}`)
  }
  const { notifyChange } = useRealtimeSync()
  notifyChange({ orderId: selectedPinOrder.value?.id, action: 'PIN_SAVED' })
  emit('refresh')
}

// Quick Driver Assignment
const assignModalOrder = ref<any | null>(null)
const selectedDriverName = ref('')
const isAssigning = ref(false)
const driversList = ref<any[]>([])

const driverOptions = computed(() => [
  { label: '-- Unassigned (Remove Driver) --', value: '' },
  ...(driversList.value || []).map(driver => ({
    label: `${driver.name} (${driver.role})`,
    value: driver.name
  }))
])

const fetchDrivers = async () => {
  if (driversList.value.length) return
  try {
    const data = await $fetch<any[]>('/api/drivers')
    driversList.value = data
  } catch (e) {
    console.error('Failed to fetch drivers:', e)
  }
}

const openAssignModal = async (order: any) => {
  assignModalOrder.value = order
  selectedDriverName.value = order.deliveryDriver || order.deliveryStatus?.driverName || ''
  await fetchDrivers()
}

const closeAssignModal = () => {
  assignModalOrder.value = null
  selectedDriverName.value = ''
}

const saveDriverAssignment = async () => {
  if (!assignModalOrder.value) return
  isAssigning.value = true
  const orderNumber = assignModalOrder.value.orderNumber
  const driverName = selectedDriverName.value

  showSaving(`Assigning driver to ${orderNumber}...`)

  try {
    const orderId = assignModalOrder.value.id
    const newStatus = driverName ? 'ASSIGNED' : 'WAITING'
    const payload: any = {
      driverName: driverName || null,
      status: newStatus
    }

    // 1. Wait for database to successfully persist the update
    await $fetch(`/api/orders/${orderId}/delivery`, {
      method: 'PATCH',
      body: payload
    })

    // 2. Immediately update local row state so the row already has the new status READY before modal closes
    const targetOrder = (props.orders || []).find((o: any) => o.id === orderId) as any
    if (targetOrder) {
      targetOrder.deliveryDriver = driverName || null
      if (!targetOrder.deliveryStatus) targetOrder.deliveryStatus = {}
      targetOrder.deliveryStatus.driverName = driverName || null
      targetOrder.deliveryStatus.status = newStatus
    }

    // 3. Multi-device instant WebSocket broadcast
    const { notifyChange } = useRealtimeSync()
    notifyChange({ type: 'DELIVERY_STATUS_CHANGED', orderId, driverName, action: 'DRIVER_ASSIGNED' })

    // 4. Trigger background refresh to keep parent completely in sync
    emit('refresh')

    // 5. Close modal now that the row already reflects the new data
    closeAssignModal()

    // 6. Show beautiful floating Snackbar
    if (driverName) {
      showSaved(`Driver ${driverName} assigned to #${orderNumber}!`)
    } else {
      showSaved(`Driver unassigned from #${orderNumber}`)
    }
  } catch (e) {
    console.error('Failed to assign driver:', e)
    showEditing('Failed to assign driver. Please try again.')
  } finally {
    isAssigning.value = false
  }
}
</script>

<template>
  <div ref="tableRootRef" class="bg-white rounded-xl shadow-sm border border-[#e5e2dc] overflow-visible">
    <!-- Top Bar -->
    <div class="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <!-- Search -->
      <div class="relative w-full md:w-80 lg:w-96">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search class="h-4 w-4 text-gray-400" />
        </div>
        <input 
          :value="search"
          @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Search by order ID, customer, driver..." 
          class="block w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all shadow-sm"
        />
        <button 
          v-if="search"
          @click="emit('update:search', '')"
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <TableFilterButtons
          :startDate="startDate"
          :endDate="endDate"
          :status="status"
          :billingStatus="billingStatus"
          :packingStatus="packingStatus"
          :deliveryStatus="deliveryStatus"
          @update:startDate="val => emit('update:startDate', val)"
          @update:endDate="val => emit('update:endDate', val)"
          @update:status="val => emit('update:status', val)"
          @update:billingStatus="val => emit('update:billingStatus', val)"
          @update:packingStatus="val => emit('update:packingStatus', val)"
          @update:deliveryStatus="val => emit('update:deliveryStatus', val)"
        />
        <RowsPerPageSelect 
          :modelValue="limit" 
          :options="[10, 20, 50, -1]"
          @update:modelValue="val => { emit('update:limit', val); emit('update:page', 1) }"
        />
      </div>
    </div>

    <!-- Table Area -->
    <div class="relative min-h-[200px]">
      <Transition name="fade">
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse pointer-events-none"></div>
      </Transition>

      <!-- DESKTOP / TABLET VIEW: Full Multi-column Table -->
      <div ref="tableScrollRef" class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th class="px-5 py-3.5 whitespace-nowrap">Order</th>
              <th class="px-5 py-3.5">Customer & Destination</th>
              <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
              <th class="px-5 py-3.5 whitespace-nowrap text-center">Driver</th>
              <th class="px-5 py-3.5 whitespace-nowrap text-center">Status</th>
              <th class="px-5 py-3.5 whitespace-nowrap text-right pr-6">Action</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-200 bg-white relative">
            <tr 
              v-for="order in orders" 
              :key="order.id"
              @click="emit('select', order.id)"
              class="cursor-pointer transition-colors duration-150 group"
              :class="[
                selectedTripOrderIds?.includes(order.id)
                  ? 'bg-emerald-50/70 hover:bg-emerald-100/60 ring-1 ring-emerald-500/40 border-l-4 border-l-[#1a5c4c]'
                  : (order.overallStatus === 'CANCELLED' 
                    ? 'bg-gray-100/60 hover:bg-gray-100/80 text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
                    : (order.isUrgent ? 'bg-rose-50/25 hover:bg-rose-50/40 border-l-4 border-l-rose-500' : 'hover:bg-gray-50/80'))
              ]"
            >
              <!-- 1. Order ID -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-gray-900 group-hover:text-[#1a5c4c] transition-colors">
                    {{ order.orderNumber }}
                  </span>
                  <span v-if="order.isUrgent && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <Zap class="w-2.5 h-2.5 fill-rose-600" /> Urgent
                  </span>
                  <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 !text-gray-600 border border-rose-500">
                    CANCELLED
                  </span>
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                  {{ formatDate(order.createdAt) }}
                </div>
              </td>

              <!-- 2. Customer & Destination -->
              <td class="px-5 py-3.5 min-w-[200px] max-w-[280px]">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-gray-900 truncate">{{ order.customer?.name || 'Walk-in Customer' }}</span>
                  <span 
                    v-if="order.customer?.privilegeTier" 
                    class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border shadow-2xs"
                    :class="getPrivilegeColor(order.customer.privilegeTier)"
                  >
                    {{ order.customer.privilegeTier }}
                  </span>
                  <span v-if="order.customer?.isPriorityClient" class="text-amber-500 font-bold text-xs shrink-0" title="Priority Client">★</span>
                </div>
                <p class="text-[11px] text-gray-500 truncate mt-0.5 flex items-center gap-1" :title="order.deliveryAddress || order.customer?.city || '—'">
                  <MapPin class="w-3 h-3 text-gray-400 shrink-0" />
                  <span class="truncate">{{ order.deliveryAddress || order.customer?.city || 'No address' }}</span>
                </p>
                <!-- GPS Pin Indicator -->
                <div class="mt-1">
                  <button
                    v-if="(order as any).hasDestinationPin || (order as any).destinationCoords"
                    @click.stop="openPinModal(order)"
                    class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition cursor-pointer"
                    title="Verified GPS destination pin. Click to change pin."
                  >
                    <MapPin class="w-2.5 h-2.5 text-emerald-600" />
                    <span>Pin Set</span>
                  </button>
                  <button
                    v-else-if="order.overallStatus !== 'CANCELLED' && order.deliveryStatus?.status !== 'DELIVERED'"
                    @click.stop="openPinModal(order)"
                    class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 transition animate-pulse cursor-pointer shadow-2xs"
                    title="⚠️ Missing GPS Pin! Click to set map pin."
                  >
                    <MapPin class="w-2.5 h-2.5 text-amber-600" />
                    <span>+ Set Pin</span>
                  </button>
                </div>
              </td>

              <!-- 3. Items -->
              <td class="px-5 py-3.5 whitespace-nowrap text-center">
                <div class="text-xs font-bold text-gray-800">
                  {{ getItemsCountText(order) }}
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                  {{ getTotalNos(order) }}
                </p>
              </td>

              <!-- 4. Driver -->
              <td class="px-5 py-3.5 whitespace-nowrap text-center">
                <div 
                  v-if="order.deliveryDriver || order.deliveryStatus?.driverName"
                  class="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900 shadow-2xs"
                  :title="order.deliveryDriver || order.deliveryStatus?.driverName"
                >
                  <div class="w-5 h-5 rounded-full bg-[#1a5c4c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {{ (order.deliveryDriver || order.deliveryStatus?.driverName || 'D')[0]?.toUpperCase() }}
                  </div>
                  <span class="truncate max-w-[110px]">{{ order.deliveryDriver || order.deliveryStatus?.driverName }}</span>
                </div>
                <span v-else class="text-gray-400 text-xs font-mono">—</span>
              </td>

              <!-- 5. Status -->
              <td class="px-5 py-3.5 whitespace-nowrap text-center">
                <StatusBadge v-if="order.deliveryStatus?.status" :status="order.deliveryStatus.status" class="mx-auto" />
                <span v-else class="text-gray-400 text-xs block text-center">—</span>
              </td>

              <!-- 7. Action -->
              <td class="px-5 py-3.5 whitespace-nowrap text-right pr-6">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Live GPS Tracking (Dispatched) -->
                  <button 
                    v-if="order.deliveryStatus?.status === 'DISPATCHED'"
                    @click.stop="openTrackingModal(order)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1a5c4c] text-white hover:bg-[#14473b] rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                    title="View Live GPS Driver Route"
                  >
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <MapPin class="w-3.5 h-3.5" />
                    <span>Track Live</span>
                  </button>

                  <!-- Completed Route Map (Delivered) -->
                  <button 
                    v-else-if="order.deliveryStatus?.status === 'DELIVERED'"
                    @click.stop="openTrackingModal(order)"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all cursor-pointer"
                    title="View Completed Delivery Route Map"
                  >
                    <MapPin class="w-3.5 h-3.5" />
                    <span>Route Map</span>
                  </button>

                  <!-- Trip Selection Button (For orders waiting/ready for trip) -->
                  <template v-else-if="order.deliveryStatus?.status === 'WAITING' || !order.deliveryStatus || order.deliveryStatus?.status === 'PENDING' || order.deliveryStatus?.status === 'ASSIGNED'">
                    <!-- Selected in Trip draft -->
                    <button
                      v-if="selectedTripOrderIds?.includes(order.id)"
                      type="button"
                      @click.stop="emit('toggleTripOrder', order.id)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1a5c4c] text-white rounded-lg shadow-sm hover:bg-[#134336] transition-all cursor-pointer ring-2 ring-[#1a5c4c]/30"
                      title="Click to remove from trip draft"
                    >
                      <Check class="w-3.5 h-3.5" />
                      <span>Added</span>
                    </button>

                    <!-- Add to Trip (when draft has at least 1 order) -->
                    <button
                      v-else-if="(selectedTripOrderIds?.length || 0) > 0"
                      type="button"
                      @click.stop="emit('toggleTripOrder', order.id)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-lg shadow-2xs transition-all cursor-pointer"
                      title="Add this order to the trip draft"
                    >
                      <Plus class="w-3.5 h-3.5 text-emerald-700" />
                      <span>Add to Trip</span>
                    </button>

                    <!-- Create Trip (normal state) -->
                    <button
                      v-else
                      type="button"
                      @click.stop="emit('toggleTripOrder', order.id)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1a5c4c]/10 text-[#1a5c4c] hover:bg-[#1a5c4c] hover:text-white border border-[#1a5c4c]/30 rounded-lg transition-all shadow-2xs cursor-pointer"
                      title="Create a new trip with this order"
                    >
                      <Plus class="w-3.5 h-3.5" />
                      <span>Create Trip</span>
                    </button>
                  </template>

                  <!-- WhatsApp Quick Share -->
                  <button 
                    v-if="order.deliveryStatus?.status === 'DISPATCHED' || (order as any).hasDestinationPin"
                    @click.stop="shareOnWhatsApp(order)"
                    class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                    title="Share Tracking Link on WhatsApp"
                  >
                    <Share2 class="w-3.5 h-3.5" />
                  </button>

                  <!-- Inspect Arrow -->
                  <button 
                    @click.stop="emit('select', order.id)" 
                    class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    title="Inspect Order Details"
                  >
                    <ChevronRight class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!orders?.length">
              <td colspan="10" class="px-6 py-12 text-center text-sm text-gray-400">
                <Truck class="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p class="font-semibold text-gray-700">No delivery orders found</p>
                <p class="text-xs text-gray-400 mt-0.5">Try adjusting your filters or search criteria.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="tableScrollRef" />

      <!-- MOBILE VIEW: 2-Line High-Density Non-Scrollable Rows -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in orders" 
          :key="'mob-deliv-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-3 cursor-pointer transition-colors flex flex-col gap-1.5"
          :class="[
            selectedTripOrderIds?.includes(order.id)
              ? 'bg-emerald-50/70 border-l-4 border-l-[#1a5c4c]'
              : (order.overallStatus === 'CANCELLED' 
                ? 'bg-gray-100/75 active:bg-gray-200/60 text-gray-400 [&_span]:!text-gray-400 [&_p]:!text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
                : 'hover:bg-gray-50 active:bg-gray-100')
          ]"
        >
          <!-- LINE 1: Identity & Delivery Status -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span class="text-xs font-bold text-gray-900 shrink-0">
                {{ order.orderNumber }}
              </span>
              <span v-if="order.isUrgent && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <Zap class="w-2.5 h-2.5 fill-rose-600" /> Urgent
              </span>
              <span v-if="order.overallStatus === 'CANCELLED'" class="text-[9px] font-bold text-gray-600 bg-gray-200 px-1 py-0.2 rounded border border-rose-500">
                CANCELLED
              </span>
              <span class="text-gray-300 text-xs shrink-0">•</span>
              <span class="text-xs font-medium text-gray-700 truncate" :title="order.customer?.name || ''">
                {{ order.customer?.name || 'Walk-in Customer' }}
              </span>
              <span 
                v-if="order.customer?.privilegeTier" 
                class="text-[9px] px-1 py-0.2 rounded font-bold uppercase border"
                :class="getPrivilegeColor(order.customer.privilegeTier)"
              >
                {{ order.customer.privilegeTier }}
              </span>
            </div>
            
            <!-- Delivery Status Badge -->
            <StatusBadge 
              v-if="order.deliveryStatus?.status" 
              :status="order.deliveryStatus.status" 
              class="!text-[10px] !py-0.5 !px-2 shrink-0 min-w-[85px] text-center"
            />
            <span v-else class="text-gray-400 text-xs shrink-0">—</span>
          </div>

          <!-- LINE 2: Driver Info, Destination & Direct 1-Tap Action -->
          <div class="flex items-center justify-between gap-2 min-w-0 pt-0.5">
            <div class="flex items-center gap-1.5 shrink-0 truncate max-w-[55%]">
              <span 
                v-if="order.deliveryDriver || order.deliveryStatus?.driverName" 
                class="text-xs font-medium text-gray-800 flex items-center gap-1 truncate"
              >
                <Truck class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span class="truncate">{{ order.deliveryDriver || order.deliveryStatus?.driverName }}</span>
              </span>
              <span 
                v-else 
                class="text-xs font-medium text-amber-600 flex items-center gap-1 shrink-0"
              >
                <UserPlus class="w-3.5 h-3.5 shrink-0" />
                <span>No Driver</span>
              </span>

              <span class="text-gray-300 text-xs shrink-0">•</span>

              <!-- Destination Address & Pin Status Indicator -->
              <div class="flex items-center gap-1 truncate min-w-0">
                <span class="text-[11px] text-gray-400 truncate" :title="order.deliveryAddress || order.customer?.city || ''">
                  {{ order.deliveryAddress ? order.deliveryAddress.split(',')[0] : (order.customer?.city || 'Local') }}
                </span>

                <!-- Pin Verified (Green) -->
                <button
                  v-if="(order as any).hasDestinationPin || (order as any).destinationCoords"
                  @click.stop="openPinModal(order)"
                  class="inline-flex items-center text-emerald-600 hover:text-emerald-700 shrink-0"
                  title="Destination Pin Verified (tap to change)"
                >
                  <MapPin class="w-3.5 h-3.5 fill-emerald-100" />
                </button>

                <!-- Pin Missing (Pulsing Amber) -->
                <button
                  v-else
                  @click.stop="openPinModal(order)"
                  class="inline-flex items-center text-amber-500 hover:text-amber-600 animate-pulse shrink-0"
                  title="⚠️ Pin Missing! Tap to set destination pin"
                >
                  <MapPin class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Direct 1-Tap Action Button -->
            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Live Tracking if In Transit / Dispatched -->
              <button 
                v-if="order.deliveryStatus?.status === 'DISPATCHED'"
                @click.stop="openTrackingModal(order)"
                class="px-2.5 py-1 bg-[#1a5c4c] text-white text-[11px] font-semibold rounded-md hover:bg-[#154a3d] active:scale-95 transition-all shadow-xs flex items-center gap-1"
              >
                <MapPin class="w-3 h-3" />
                <span>Track Live</span>
              </button>

              <!-- Route Map if Delivered -->
              <button 
                v-else-if="order.deliveryStatus?.status === 'DELIVERED'"
                @click.stop="openTrackingModal(order)"
                class="px-2.5 py-1 border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1"
              >
                <MapPin class="w-3 h-3" />
                <span>Route</span>
              </button>

              <!-- Trip Selection / Unassigned Actions -->
              <template v-else-if="(!order.deliveryDriver && (!order.deliveryStatus || order.deliveryStatus.status === 'WAITING' || order.deliveryStatus.status === 'PENDING')) && order.overallStatus !== 'CANCELLED'">
                <!-- Added (in current trip selection) -->
                <button
                  v-if="selectedTripOrderIds?.includes(order.id)"
                  type="button"
                  @click.stop="emit('toggleTripOrder', order.id)"
                  class="px-2.5 py-1 bg-[#1a5c4c] text-white text-[11px] font-bold rounded-md hover:bg-[#134336] active:scale-95 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check class="w-3 h-3" />
                  <span>Added</span>
                </button>

                <!-- Add to Trip (selection in progress) -->
                <button
                  v-else-if="(selectedTripOrderIds?.length || 0) > 0"
                  type="button"
                  @click.stop="emit('toggleTripOrder', order.id)"
                  class="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-bold active:scale-95 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus class="w-3 h-3 text-emerald-700" />
                  <span>+ Add</span>
                </button>

                <!-- Create Trip -->
                <button
                  v-else
                  type="button"
                  @click.stop="emit('toggleTripOrder', order.id)"
                  class="px-2 py-1 bg-[#1a5c4c]/10 text-[#1a5c4c] border border-[#1a5c4c]/30 rounded-md text-[11px] font-bold active:scale-95 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus class="w-3 h-3" />
                  <span>+ Trip</span>
                </button>
              </template>
              
              <ChevronRight class="w-4 h-4 text-gray-300 shrink-0 -mr-1" />
            </div>
          </div>
        </div>

        <div v-if="!orders?.length" class="px-4 py-8 text-center text-sm text-gray-500">
          No delivery orders found.
        </div>
      </div>
    </div>

    <!-- Pagination Bottom -->
    <div class="p-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between gap-4">
      <p class="text-xs text-gray-500 whitespace-nowrap">
        Showing <span class="font-medium text-gray-900">{{ orders.length ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
        to <span class="font-medium text-gray-900">{{ limit === -1 ? total : Math.min(page * limit, total) }}</span>
        of <span class="font-medium text-gray-900">{{ total }}</span> orders
      </p>

      <div class="flex items-center justify-center gap-2">
        <button
          :disabled="page <= 1"
          @click="emit('update:page', Math.max(1, page - 1))"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (Math.ceil(total / limit) || 1) }}</span>
        <button
          :disabled="limit === -1 || page * limit >= total"
          @click="emit('update:page', page + 1)"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Quick Assign Driver Modal -->
    <Teleport to="body">
      <div v-if="assignModalOrder" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 class="text-sm font-bold text-gray-900">Assign Delivery Driver</h3>
            <p class="text-xs text-gray-500 font-mono mt-0.5">{{ assignModalOrder.orderNumber }} • {{ assignModalOrder.customer?.name }}</p>
          </div>
          <button @click="closeAssignModal" class="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3.5">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1.5">Select Delivery Driver</label>
            <CustomSelect 
              :modelValue="selectedDriverName"
              @update:modelValue="val => selectedDriverName = val"
              :options="driverOptions"
              searchable
              searchPlaceholder="Search driver by name..."
              placeholder="Select Delivery Driver"
              class="w-full"
            />
            <p class="text-[11px] text-gray-500 mt-2">
              💡 Selecting a driver will automatically mark this order as <strong class="text-emerald-700 font-bold">ASSIGNED</strong> and send it directly to the driver's phone.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button 
            @click="closeAssignModal" 
            class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button 
            @click="saveDriverAssignment" 
            :disabled="isAssigning"
            class="px-4 py-2 text-xs font-bold bg-[#1a5c4c] hover:bg-[#15463a] text-white rounded-lg transition shadow flex items-center gap-1.5 disabled:opacity-50"
          >
            <Loader2 v-if="isAssigning" class="w-3.5 h-3.5 animate-spin" />
            <span>Save & Assign</span>
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Live Tracking & Route Snapshot Modal -->
    <Teleport to="body">
      <div v-if="trackingModalOrder" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <!-- Modal Header -->
        <div class="p-4 bg-[#1a5c4c] text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white">
              <MapPin class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold">
                  {{ trackingData?.deliveryStatus === 'DELIVERED' ? 'Completed Route Snapshot' : 'Live Fleet Tracking' }}
                </h3>
                <span class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded text-white font-mono">
                  {{ trackingModalOrder.orderNumber }}
                </span>
              </div>
              <p class="text-xs text-white/80">
                Customer: {{ trackingModalOrder.customer?.name }} • Driver: {{ trackingData?.driverName || trackingModalOrder.deliveryDriver || 'Assigned' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button 
              v-if="trackingData?.deliveryStatus === 'DISPATCHED'"
              @click="shareOnWhatsApp(trackingModalOrder)"
              class="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
              title="Share Link via WhatsApp"
            >
              <Share2 class="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button @click="closeTrackingModal" class="p-1 rounded-full bg-white/10 hover:bg-white/20 transition">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isTrackingLoading" class="h-80 flex flex-col items-center justify-center gap-2 text-gray-400">
          <Loader2 class="w-8 h-8 animate-spin text-[#1a5c4c]" />
          <p class="text-xs">Fetching GPS coordinates & route...</p>
        </div>

        <!-- Map Container -->
        <div v-else class="h-96 w-full relative">
          <LiveTrackingMap
            :driverLocation="trackingData?.trip?.currentLocation || null"
            :startLocation="trackingData?.trip?.startLocation || (trackingData?.trip?.route?.length ? trackingData.trip.route[0] : null)"
            :destinationLocation="trackingData?.trip?.destinationCoords"
            :routeCoordinates="trackingData?.trip?.route || []"
            :isLive="trackingData?.deliveryStatus === 'DISPATCHED'"
            :isSnapshot="trackingData?.deliveryStatus === 'DELIVERED'"
            :distanceKm="trackingData?.trip?.totalDistanceKm"
            :durationMin="trackingData?.trip?.durationMinutes"
            :payout="trackingData?.trip?.calculatedPayout"
          />
        </div>

        <!-- Footer / Trip Summary -->
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <span class="text-gray-400 block font-medium">Destination Address:</span>
            <span class="font-semibold text-gray-800">{{ trackingModalOrder.deliveryAddress || 'No address specified' }}</span>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto">
            <a 
              :href="`/track/${trackingModalOrder.orderNumber}`" 
              target="_blank"
              class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
            >
              Public Customer Link ↗
            </a>
            <button 
              @click="closeTrackingModal" 
              class="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Set Customer Delivery Pin Modal -->
    <SetDeliveryPinModal
      :isOpen="isPinModalOpen"
      :customerId="selectedPinOrder?.customerId || selectedPinOrder?.customer?.id"
      :customerName="selectedPinOrder?.customer?.name || 'Customer'"
      :customerCompany="selectedPinOrder?.customer?.company"
      :deliveryAddress="selectedPinOrder?.deliveryAddress"
      :initialLat="selectedPinOrder?.destinationCoords?.lat || selectedPinOrder?.customer?.latitude"
      :initialLng="selectedPinOrder?.destinationCoords?.lng || selectedPinOrder?.customer?.longitude"
      :initialLandmark="selectedPinOrder?.destinationCoords?.landmark || selectedPinOrder?.customer?.landmark"
      @close="isPinModalOpen = false"
      @saved="onPinSaved"
    />
  </div>
</template>
 
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
