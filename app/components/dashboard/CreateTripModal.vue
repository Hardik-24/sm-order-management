<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        <!-- Header -->
        <div class="px-6 py-4.5 bg-[#1a1a1a] text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#1a5c4c] flex items-center justify-center text-white">
              <Truck class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-base text-[#e8e0d4] flex items-center gap-2">
                <span>Create Delivery Trip Manifest</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1a5c4c] text-emerald-100 border border-emerald-400/30">
                  {{ stops.length }} Stop{{ stops.length === 1 ? '' : 's' }}
                </span>
              </h3>
              <p class="text-xs text-gray-400">Assign a driver, vehicle, and sequence multi-stop customer deliveries</p>
            </div>
          </div>
          <button @click="$emit('close')" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-gray-50/50">
          <!-- Step 1: Fleet & Driver Assignment -->
          <div class="bg-white p-5 rounded-xl border border-[#e5e2dc] shadow-xs space-y-4">
            <div class="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h4 class="font-bold text-gray-900 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500">
                <UserCheck class="w-4 h-4 text-[#1a5c4c]" />
                1. Driver & Vehicle Assignment
              </h4>
              <span class="text-[11px] text-gray-400">Required</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1.5">Assign Driver *</label>
                <select
                  v-model="form.driverId"
                  @change="onDriverChange"
                  class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c]"
                >
                  <option value="" disabled>Select delivery driver</option>
                  <option v-for="d in availableDrivers" :key="d.id" :value="d.id">
                    {{ d.name }} ({{ d.role }})
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1.5">Vehicle Number / Type</label>
                <input
                  v-model="form.vehicleNumber"
                  type="text"
                  placeholder="e.g. KA-09-EA-1234 (Tata Ace)"
                  class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c]"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5">Trip Notes (Optional)</label>
              <input
                v-model="form.notes"
                type="text"
                placeholder="e.g. Route through Ring Road first, urgent site delivery"
                class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c]"
              />
            </div>
          </div>

          <!-- Step 2: Stops Manifest & Sequence -->
          <div class="bg-white p-5 rounded-xl border border-[#e5e2dc] shadow-xs space-y-4">
            <div class="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h4 class="font-bold text-gray-900 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500">
                <MapPin class="w-4 h-4 text-[#1a5c4c]" />
                2. Delivery Sequence & Customer Addresses
              </h4>
              <button
                type="button"
                @click="showOrderPicker = !showOrderPicker"
                class="text-xs font-bold text-[#1a5c4c] hover:text-[#134336] flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>{{ showOrderPicker ? 'Done Adding Orders' : 'Add Orders to Trip' }}</span>
              </button>
            </div>

            <!-- Available Orders Selection Drawer -->
            <div v-if="showOrderPicker" class="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-emerald-950">Select Orders Ready for Delivery:</span>
                <span class="text-[11px] text-emerald-700">{{ unassignedOrders.length }} orders available</span>
              </div>

              <div v-if="unassignedOrders.length === 0" class="text-xs text-gray-500 py-3 text-center bg-white rounded-lg border border-dashed border-gray-200">
                No waiting or packed orders available for dispatch.
              </div>

              <div v-else class="max-h-52 overflow-y-auto space-y-2 pr-1">
                <div
                  v-for="order in unassignedOrders"
                  :key="order.id"
                  class="p-2.5 bg-white rounded-lg border border-gray-200 flex items-center justify-between hover:border-emerald-300 transition"
                >
                  <div class="min-w-0 pr-3">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-xs text-gray-900">{{ order.orderNumber }}</span>
                      <span class="text-[11px] text-gray-500 truncate">{{ order.customer?.company || order.customer?.name }}</span>
                    </div>
                    <div class="text-[11px] text-gray-400 truncate mt-0.5">
                      {{ order.deliveryAddress || 'No address' }} • ₹{{ Number(order.totalAmount || 0).toLocaleString('en-IN') }}
                    </div>
                  </div>
                  <button
                    type="button"
                    @click="addOrderToTrip(order)"
                    :disabled="isOrderAlreadyInTrip(order.id)"
                    class="px-2.5 py-1 text-xs font-bold rounded-lg transition shrink-0"
                    :class="isOrderAlreadyInTrip(order.id)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#1a5c4c] text-white hover:bg-[#134336]'"
                  >
                    {{ isOrderAlreadyInTrip(order.id) ? 'Added' : '+ Add' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Empty state if no stops added -->
            <div v-if="stops.length === 0" class="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2">
              <PackageCheck class="w-8 h-8 text-gray-400 mx-auto" />
              <p class="text-xs font-bold text-gray-700">No Orders in this Trip Manifest</p>
              <p class="text-[11px] text-gray-400 max-w-sm mx-auto">Click "Add Orders to Trip" above to choose orders to deliver in this run.</p>
            </div>

            <!-- Ordered Stops List -->
            <div v-else class="space-y-3">
              <div
                v-for="(stop, sIdx) in stops"
                :key="stop.orderId"
                class="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-3 transition-colors hover:border-gray-300"
              >
                <!-- Top Row: Sequence Badge, Order info, Reorder and Remove buttons -->
                <div class="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 h-6 rounded-full bg-[#1a5c4c] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                      {{ sIdx + 1 }}
                    </span>
                    <div class="min-w-0">
                      <span class="font-bold text-xs text-gray-900 mr-2">{{ stop.orderNumber }}</span>
                      <span class="text-xs font-semibold text-gray-700 truncate">{{ stop.customerName }}</span>
                      <span v-if="stop.customerCompany" class="text-[11px] text-gray-400 ml-1">({{ stop.customerCompany }})</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <!-- Move Up Button -->
                    <button
                      type="button"
                      @click="moveStop(sIdx, -1)"
                      :disabled="sIdx === 0"
                      class="p-1 rounded-md border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                      title="Move up in sequence"
                    >
                      <ArrowUp class="w-3.5 h-3.5" />
                    </button>

                    <!-- Move Down Button -->
                    <button
                      type="button"
                      @click="moveStop(sIdx, 1)"
                      :disabled="sIdx === stops.length - 1"
                      class="p-1 rounded-md border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
                      title="Move down in sequence"
                    >
                      <ArrowDown class="w-3.5 h-3.5" />
                    </button>

                    <!-- Remove Button -->
                    <button
                      type="button"
                      @click="removeStop(sIdx)"
                      class="p-1 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition ml-1"
                      title="Remove order from trip"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Middle Row: Customer Address Selection Dropdown -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div class="sm:col-span-5">
                    <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Deliver To Which Address?
                    </label>
                    <select
                      v-model="stop.selectedAddressId"
                      @change="onStopAddressSelect(stop)"
                      class="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#1a5c4c]"
                    >
                      <option
                        v-for="addr in stop.customerAddresses"
                        :key="addr.id"
                        :value="addr.id"
                      >
                        {{ addr.label || 'Address' }} {{ addr.isDefault ? '(Default)' : '' }}
                      </option>
                      <option value="CUSTOM">Custom / One-Time Site Address</option>
                    </select>
                  </div>

                  <div class="sm:col-span-7">
                    <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Target Address & Landmark
                    </label>
                    <input
                      v-model="stop.addressLine"
                      type="text"
                      placeholder="Street address, site name, area..."
                      class="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#1a5c4c]"
                    />
                  </div>
                </div>

                <!-- Bottom Row: Pin Status & Action -->
                <div class="flex items-center justify-between pt-1">
                  <div class="flex items-center gap-2">
                    <span
                      v-if="hasValidPin(stop)"
                      class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200"
                    >
                      <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                      <span>GPS Pin Verified ({{ stop.latitude.toFixed(4) }}, {{ stop.longitude.toFixed(4) }})</span>
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200"
                    >
                      <AlertTriangle class="w-3.5 h-3.5 text-rose-600" />
                      <span>GPS Pin Missing (Required for Navigation)</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    @click="openStopPinModal(stop, sIdx)"
                    class="px-2.5 py-1 text-xs font-bold rounded-lg border transition flex items-center gap-1.5"
                    :class="hasValidPin(stop)
                      ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500 shadow-xs'"
                  >
                    <MapPin class="w-3.5 h-3.5" :class="hasValidPin(stop) ? 'text-[#1a5c4c]' : 'text-white'" />
                    <span>{{ hasValidPin(stop) ? 'Edit Pin' : 'Set Pin Now' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div class="text-xs text-gray-500">
            <span v-if="hasPinErrors" class="text-rose-600 font-bold flex items-center gap-1">
              <AlertTriangle class="w-3.5 h-3.5" />
              All stops must have a verified GPS pin before dispatching.
            </span>
            <span v-else-if="stops.length > 0" class="text-emerald-700 font-medium">
              ✓ All {{ stops.length }} stop pins verified and sequenced.
            </span>
            <span v-else>
              Add at least one order to create trip.
            </span>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg text-xs hover:bg-gray-100 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              @click="submitTrip"
              :disabled="isSubmitting || stops.length === 0 || !form.driverId || hasPinErrors"
              class="px-5 py-2 bg-[#1a5c4c] hover:bg-[#134336] text-white font-bold rounded-lg text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
              <Truck v-else class="w-3.5 h-3.5" />
              <span>{{ isSubmitting ? 'Creating Manifest...' : 'Dispatch Trip' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Nested Set Delivery Pin Modal for individual stop -->
    <SetDeliveryPinModal
      :isOpen="isPinModalOpen"
      :customerId="activeStopForPin?.customerId"
      :addressId="activeStopForPin?.selectedAddressId"
      :addressLabel="activeStopForPin?.addressLabel || `Stop #${(activeStopIndex || 0) + 1}`"
      :customerName="activeStopForPin?.customerName || 'Customer'"
      :customerCompany="activeStopForPin?.customerCompany"
      :deliveryAddress="activeStopForPin?.addressLine"
      :initialLat="activeStopForPin?.latitude"
      :initialLng="activeStopForPin?.longitude"
      :initialLandmark="activeStopForPin?.landmark"
      @close="isPinModalOpen = false"
      @saved="onStopPinSaved"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Truck, X, Plus, Trash2, ArrowUp, ArrowDown, MapPin,
  CheckCircle2, AlertTriangle, UserCheck, PackageCheck, Loader2
} from 'lucide-vue-next'
import SetDeliveryPinModal from './SetDeliveryPinModal.vue'

const props = defineProps<{
  isOpen: boolean
  preselectedOrderIds?: string[]
}>()

const emit = defineEmits(['close', 'created'])

// Form State
const form = ref({
  driverId: '',
  driverName: '',
  driverPhone: '',
  vehicleNumber: '',
  notes: ''
})

const isSubmitting = ref(false)
const showOrderPicker = ref(false)
const availableDrivers = ref<any[]>([])
const unassignedOrders = ref<any[]>([])

// Stops in current manifest
interface StopItem {
  orderId: string
  orderNumber: string
  customerId: string
  customerName: string
  customerCompany?: string
  customerPhone?: string
  customerAddresses: any[]
  selectedAddressId: string
  addressLabel?: string
  addressLine: string
  city?: string
  landmark?: string
  latitude: number
  longitude: number
}

const stops = ref<StopItem[]>([])

// Pin modal state for a stop
const isPinModalOpen = ref(false)
const activeStopForPin = ref<StopItem | null>(null)
const activeStopIndex = ref<number | null>(null)

const hasValidPin = (stop: StopItem) => {
  return typeof stop.latitude === 'number' && typeof stop.longitude === 'number' && stop.latitude !== 0 && stop.longitude !== 0 && !isNaN(stop.latitude) && !isNaN(stop.longitude)
}

const hasPinErrors = computed(() => {
  if (stops.value.length === 0) return false
  return stops.value.some(s => !hasValidPin(s))
})

// Fetch drivers and available orders
const loadInitialData = async () => {
  try {
    const [usersRes, ordersRes] = await Promise.all([
      $fetch<any[]>('/api/users').catch(() => []),
      $fetch<any>('/api/orders', {
        query: {
          limit: 100,
          deliveryStatus: 'WAITING'
        }
      }).catch(() => ({ orders: [] }))
    ])

    // Filter drivers
    const allUsers = Array.isArray(usersRes) ? usersRes : []
    const drivers = allUsers.filter(u => u.role === 'DELIVERY' && u.isActive)
    availableDrivers.value = drivers.length > 0 ? drivers : allUsers.filter(u => u.isActive)

    // Pre-select first delivery driver if available
    if (availableDrivers.value.length > 0 && !form.value.driverId) {
      form.value.driverId = availableDrivers.value[0].id
      form.value.driverName = availableDrivers.value[0].name
      form.value.driverPhone = availableDrivers.value[0].phone || ''
    }

    // Set available orders
    const ords = Array.isArray(ordersRes.orders) ? ordersRes.orders : []
    unassignedOrders.value = ords.filter((o: any) =>
      o.deliveryStatus?.status === 'WAITING' ||
      o.deliveryStatus?.status === 'ASSIGNED' ||
      (o.billingStatus?.status === 'GENERATED' && o.packingStatus?.status === 'PACKED' && o.deliveryStatus?.status !== 'DELIVERED')
    )

    // If preselected order IDs passed, add them
    if (props.preselectedOrderIds && props.preselectedOrderIds.length > 0) {
      for (const oid of props.preselectedOrderIds) {
        let found = unassignedOrders.value.find(o => o.id === oid)
        if (!found) {
          try {
            found = await $fetch<any>(`/api/orders/${oid}`)
            if (found) unassignedOrders.value.push(found)
          } catch (e) {}
        }
        if (found) addOrderToTrip(found)
      }
    }
  } catch (e) {
    console.error('Failed to load initial trip creation data', e)
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    stops.value = []
    loadInitialData()
  }
})

const onDriverChange = () => {
  const d = availableDrivers.value.find(u => u.id === form.value.driverId)
  if (d) {
    form.value.driverName = d.name
    form.value.driverPhone = d.phone || ''
  }
}

const isOrderAlreadyInTrip = (orderId: string) => {
  return stops.value.some(s => s.orderId === orderId)
}

const addOrderToTrip = (order: any) => {
  if (isOrderAlreadyInTrip(order.id)) return

  // Resolve customer addresses
  const addrs = (order.customer?.addresses && order.customer.addresses.length > 0)
    ? order.customer.addresses
    : [{
        id: 'DEFAULT',
        label: 'Primary Address',
        addressLine: order.deliveryAddress || order.customer?.address || '',
        city: order.customer?.city || 'Mysuru',
        latitude: order.customer?.latitude || null,
        longitude: order.customer?.longitude || null,
        landmark: order.customer?.landmark || null,
        isDefault: true
      }]

  const defaultAddr = addrs.find((a: any) => a.isDefault) || addrs[0]

  const newStop: StopItem = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId || order.customer?.id,
    customerName: order.customer?.name || 'Customer',
    customerCompany: order.customer?.company || '',
    customerPhone: order.customer?.phone || '',
    customerAddresses: addrs,
    selectedAddressId: defaultAddr.id,
    addressLabel: defaultAddr.label,
    addressLine: defaultAddr.addressLine || order.deliveryAddress || '',
    city: defaultAddr.city || order.customer?.city || '',
    landmark: defaultAddr.landmark || '',
    latitude: defaultAddr.latitude || (order.customer?.latitude ?? 0),
    longitude: defaultAddr.longitude || (order.customer?.longitude ?? 0)
  }

  stops.value.push(newStop)
}

const onStopAddressSelect = (stop: StopItem) => {
  if (stop.selectedAddressId === 'CUSTOM') {
    stop.addressLabel = 'Custom Address'
    return
  }
  const addr = stop.customerAddresses.find(a => a.id === stop.selectedAddressId)
  if (addr) {
    stop.addressLabel = addr.label
    stop.addressLine = addr.addressLine
    stop.city = addr.city
    stop.landmark = addr.landmark || ''
    stop.latitude = addr.latitude || 0
    stop.longitude = addr.longitude || 0
  }
}

const removeStop = (index: number) => {
  stops.value.splice(index, 1)
}

const moveStop = (index: number, direction: number) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= stops.value.length) return
  const temp = stops.value[index]
  stops.value[index] = stops.value[targetIndex]
  stops.value[targetIndex] = temp
}

const openStopPinModal = (stop: StopItem, index: number) => {
  activeStopForPin.value = stop
  activeStopIndex.value = index
  isPinModalOpen.value = true
}

const onStopPinSaved = (pin: any) => {
  if (activeStopForPin.value && activeStopIndex.value !== null) {
    const s = stops.value[activeStopIndex.value]
    if (s && pin) {
      s.latitude = pin.lat
      s.longitude = pin.lng
      s.landmark = pin.landmark || s.landmark
    }
  }
  isPinModalOpen.value = false
}

const submitTrip = async () => {
  if (!form.value.driverId || !form.value.driverName) {
    alert('Please select a driver for this trip')
    return
  }

  if (stops.value.length === 0) {
    alert('Please add at least one order to the trip')
    return
  }

  if (hasPinErrors.value) {
    alert('Every stop must have a valid GPS pin. Please set pin on flagged stops before dispatching.')
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      driverId: form.value.driverId,
      driverName: form.value.driverName,
      driverPhone: form.value.driverPhone,
      vehicleNumber: form.value.vehicleNumber || 'Standard Delivery',
      notes: form.value.notes,
      stops: stops.value.map((s, idx) => ({
        orderId: s.orderId,
        stopSequence: idx + 1,
        customerAddressId: s.selectedAddressId !== 'CUSTOM' ? s.selectedAddressId : null,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        addressLine: s.addressLine,
        city: s.city,
        landmark: s.landmark,
        latitude: s.latitude,
        longitude: s.longitude
      }))
    }

    const res = await $fetch('/api/trips', {
      method: 'POST',
      body: payload
    })

    emit('created', res)
    emit('close')
  } catch (e: any) {
    console.error('Failed to create trip', e)
    alert(e.data?.message || 'Failed to create trip manifest')
  } finally {
    isSubmitting.value = false
  }
}
</script>
