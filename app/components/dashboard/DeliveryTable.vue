<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Filter, Search, MoreHorizontal, Calendar, X, MapPin, Share2, Loader2, UserPlus, Truck } from 'lucide-vue-next'
import { formatDate } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import type { Order } from '~/types'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import LiveTrackingMap from '~/components/ui/LiveTrackingMap.vue'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import { useSnackbar } from '~/composables/useSnackbar'

const { showSaving, showSaved, showEditing } = useSnackbar()

const props = defineProps<{
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
}>()

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
  (e: 'refresh'): void
}>()

const { animateStagger } = useGsapAnimation()
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)

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
      <div class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse min-w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th class="px-6 py-4 whitespace-nowrap">Order ID</th>
              <th class="px-6 py-4 whitespace-nowrap">Customer & Address</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Driver</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Dispatch / ETA</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Status</th>
              <th class="px-6 py-4 whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-200 bg-white relative">
            <tr 
              v-for="order in orders" 
              :key="order.id"
              @click="emit('select', order.id)"
              class="hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ order.orderNumber }}</td>
              <td class="px-6 py-4 text-sm text-gray-900 max-w-[250px] truncate">
                <span class="font-medium block">{{ order.customer?.name || '-' }}</span>
                <span class="text-xs text-gray-500 block truncate">{{ order.deliveryAddress || '-' }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                <button 
                  v-if="!order.deliveryDriver && (!order.deliveryStatus || order.deliveryStatus.status === 'WAITING')"
                  @click.stop="openAssignModal(order)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300/80 rounded-lg text-xs font-bold transition active:scale-95 shadow-xs"
                  title="Click to assign a driver"
                >
                  <UserPlus class="w-3.5 h-3.5 text-amber-600" />
                  <span>Assign Driver</span>
                </button>
                <button 
                  v-else
                  @click.stop="openAssignModal(order)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#1a5c4c] border border-emerald-200 rounded-lg text-xs font-semibold transition active:scale-95"
                  title="Click to change driver"
                >
                  <Truck class="w-3.5 h-3.5 text-emerald-600" />
                  <span>{{ order.deliveryDriver || order.deliveryStatus?.driverName || 'Assigned' }}</span>
                </button>
              </td>
              
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                <span class="block text-gray-900">{{ order.dispatchDate ? formatDate(order.dispatchDate) : 'TBD' }}</span>
                <span class="block text-[10px] text-gray-400">ETA: {{ order.eta ? formatDate(order.eta) : '-' }}</span>
              </td>
              
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <StatusBadge v-if="order.deliveryStatus?.status" :status="order.deliveryStatus.status" class="mx-auto" />
                <span v-else class="text-gray-400 block text-center">-</span>
              </td>
              
              <td class="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- WhatsApp Share (Dispatched) -->
                  <button 
                    v-if="order.deliveryStatus?.status === 'DISPATCHED'"
                    @click.stop="shareOnWhatsApp(order)"
                    title="Share Live Tracking on WhatsApp"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                  >
                    <Share2 class="w-3.5 h-3.5" />
                    <span class="hidden xl:inline">WhatsApp</span>
                  </button>

                  <!-- Live Map (Dispatched) -->
                  <button 
                    v-if="order.deliveryStatus?.status === 'DISPATCHED'"
                    @click.stop="openTrackingModal(order)"
                    title="View Live GPS"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-[#1a5c4c] text-white hover:bg-[#134336] rounded transition-colors shadow-sm"
                  >
                    <MapPin class="w-3.5 h-3.5" />
                    <span>Track Live</span>
                  </button>

                  <!-- Route Snapshot (Delivered) -->
                  <button 
                    v-else-if="order.deliveryStatus?.status === 'DELIVERED'"
                    @click.stop="openTrackingModal(order)"
                    title="View Completed Route Snapshot"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                  >
                    <MapPin class="w-3.5 h-3.5" />
                    <span>Route Map</span>
                  </button>

                  <!-- Change Pin Button (If pin already set) -->
                  <button 
                    v-if="order.deliveryStatus?.status !== 'DELIVERED' && ((order as any).hasDestinationPin || (order as any).destinationCoords)"
                    @click.stop="openPinModal(order)"
                    title="Customer pin is verified. Click to change pin on map."
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors bg-emerald-50 text-[#1a5c4c] hover:bg-emerald-100 border-emerald-200"
                  >
                    <MapPin class="w-3.5 h-3.5 text-[#1a5c4c]" />
                    <span class="hidden xl:inline">Change Pin</span>
                  </button>

                  <!-- Set Pin Button (If pin is missing) -->
                  <button 
                    v-else-if="order.deliveryStatus?.status !== 'DELIVERED'"
                    @click.stop="openPinModal(order)"
                    title="⚠️ Pin missing! Click to drop destination pin on map."
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded border transition-colors bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300 shadow-sm animate-pulse"
                  >
                    <MapPin class="w-3.5 h-3.5 text-amber-600" />
                    <span class="hidden xl:inline">Set Pin</span>
                  </button>

                  <!-- Update Button -->
                  <button 
                    @click.stop="emit('select', order.id)" 
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    Manage
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!orders?.length">
              <td colspan="10" class="px-6 py-8 text-center text-sm text-gray-500">
                No orders found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MOBILE VIEW: 2-Line High-Density Non-Scrollable Rows -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in orders" 
          :key="'mob-deliv-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors flex flex-col gap-1.5"
        >
          <!-- LINE 1: Identity & Delivery Status -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-sm font-semibold text-gray-900 shrink-0">
                {{ order.orderNumber }}
              </span>
              <span class="text-gray-300 text-xs shrink-0">•</span>
              <span class="text-xs font-medium text-gray-700 truncate" :title="order.customer?.name || ''">
                {{ order.customer?.name || 'Walk-in Customer' }}
              </span>
            </div>
            
            <!-- Delivery Status Badge -->
            <StatusBadge 
              v-if="order.deliveryStatus?.status" 
              :status="order.deliveryStatus.status" 
              class="!text-[10px] !py-0.5 !px-2.5 shrink-0 min-w-[95px] text-center"
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

              <!-- Assign Driver if unassigned -->
              <button 
                v-else-if="!order.deliveryDriver && (!order.deliveryStatus || order.deliveryStatus.status === 'WAITING')"
                @click.stop="openAssignModal(order)"
                class="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-md text-[11px] font-bold active:scale-95 transition-all shadow-xs"
              >
                Assign
              </button>

              <!-- Manage / Details otherwise -->
              <button 
                v-else
                @click.stop="emit('select', order.id)"
                class="px-2.5 py-1 border border-gray-200 bg-gray-50 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                Manage
              </button>
              
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
