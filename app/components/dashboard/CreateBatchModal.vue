<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, Layers, AlertCircle, Check, Loader2, Plus, Minus, MapPin, Building2, Truck, Clock 
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const props = defineProps<{
  isOpen: boolean
  orderId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'batchCreated', result: any): void
}>()

const { showSaved, showError } = useSnackbar()
const { notifyChange } = useRealtimeSync()

const isLoading = ref(false)
const isSubmitting = ref(false)
const poolData = ref<any | null>(null)

interface BatchRow {
  orderItemId: string
  productId: string
  productName: string
  sku: string
  unitPrice: number
  discount: number
  taxRate: number
  isTaxInclusive: boolean
  orderedQty: number
  batchedQty: number
  pendingQty: number
  batchQty: number
}

const batchRows = ref<BatchRow[]>([])
const isOnHold = ref(false)
const batchNotes = ref('')
const customDeliveryAddress = ref('')
const selectedVehicleMode = ref<'OUR_FLEET' | 'PARTY_VEHICLE' | 'THIRD_PARTY'>('OUR_FLEET')

// Fetch pool data when opened
watch(() => [props.isOpen, props.orderId], async ([open, id]) => {
  if (open && id) {
    isLoading.value = true
    try {
      const data = await $fetch<any>(`/api/orders/${id}/pending-pool`)
      poolData.value = data
      isOnHold.value = false
      batchNotes.value = ''
      customDeliveryAddress.value = data.deliveryAddress || ''
      selectedVehicleMode.value = (data.vehicleMode === 'PARTY_VEHICLE' || data.vehicleMode === 'THIRD_PARTY') 
        ? data.vehicleMode 
        : 'OUR_FLEET'

      batchRows.value = (data.items || []).map((itm: any) => ({
        orderItemId: itm.orderItemId,
        productId: itm.productId,
        productName: itm.productName,
        sku: itm.sku,
        unitPrice: Number(itm.unitPrice || 0),
        discount: Number(itm.discount || 0),
        taxRate: Number(itm.taxRate || 0),
        isTaxInclusive: Boolean(itm.isTaxInclusive),
        orderedQty: itm.orderedQty,
        batchedQty: itm.batchedQty,
        pendingQty: itm.pendingQty,
        // Default to pending available quantity (or 0 if none left)
        batchQty: itm.pendingQty
      }))
    } catch (err: any) {
      console.error('Failed to load pending pool:', err)
      showError(err.data?.message || 'Failed to load order pending pool')
      emit('close')
    } finally {
      isLoading.value = false
    }
  } else {
    poolData.value = null
    batchRows.value = []
  }
})

const closeModal = () => {
  if (!isSubmitting.value) {
    emit('close')
  }
}

// Helpers for adjusting quantities safely
const updateQty = (row: BatchRow, delta: number) => {
  const current = Number(row.batchQty || 0)
  const next = current + delta
  row.batchQty = Math.max(0, Math.min(row.pendingQty, next))
}

const onQtyInput = (row: BatchRow, event: Event) => {
  const target = event.target as HTMLInputElement
  let val = parseInt(target.value, 10)
  if (isNaN(val) || val < 0) val = 0
  if (val > row.pendingQty) val = row.pendingQty
  row.batchQty = val
  target.value = String(val)
}

const setAllPending = (row: BatchRow) => {
  row.batchQty = row.pendingQty
}

const setZero = (row: BatchRow) => {
  row.batchQty = 0
}

// Summary computations
const totalBatchUnits = computed(() => {
  return batchRows.value.reduce((sum, r) => sum + (Number(r.batchQty) || 0), 0)
})

const totalBatchAmount = computed(() => {
  return batchRows.value.reduce((sum, r) => {
    const qty = Number(r.batchQty || 0)
    if (qty <= 0) return sum
    const subtotal = qty * r.unitPrice
    const discountAmt = subtotal * (r.discount / 100)
    const taxable = subtotal - discountAmt
    const taxAmt = r.isTaxInclusive ? 0 : taxable * (r.taxRate / 100)
    return sum + taxable + taxAmt
  }, 0)
})

const remainingPoolAfterBatch = computed(() => {
  const totalPending = poolData.value?.totalPendingUnits || 0
  return Math.max(0, totalPending - totalBatchUnits.value)
})

const nextBatchNumber = computed(() => poolData.value?.nextBatchNumber || 1)

// Submit Batch Creation
const submitCreateBatch = async () => {
  if (totalBatchUnits.value === 0) {
    alert('Please allocate at least 1 unit to create this batch.')
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      notes: batchNotes.value,
      isOnHold: isOnHold.value,
      deliveryAddress: customDeliveryAddress.value,
      vehicleMode: selectedVehicleMode.value,
      items: batchRows.value
        .filter(r => r.batchQty > 0)
        .map(r => ({
          orderItemId: r.orderItemId,
          quantity: r.batchQty
        }))
    }

    const res = await $fetch<any>(`/api/orders/${props.orderId}/create-batch`, {
      method: 'POST',
      body: payload
    })

    showSaved(res.message || `Batch ${nextBatchNumber.value} created successfully!`)
    notifyChange({ action: 'BATCH_CREATED', orderId: props.orderId || '' })
    emit('batchCreated', res)
    emit('close')
  } catch (err: any) {
    console.error('Failed to create batch:', err)
    showError(err.data?.message || 'Failed to create fulfillment batch')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="isOpen" 
      data-modal-container="create-batch-modal"
      class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[600] flex items-center justify-center p-2 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
        @click="closeModal"
        data-modal-backdrop="true"
      ></div>

      <!-- Modal Card -->
      <div 
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] md:max-h-[92vh] overflow-hidden border border-gray-200"
        @click.stop
      >
        <!-- Loading Overlay -->
        <div v-if="isLoading" class="p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 class="w-8 h-8 text-[#1b3b5f] animate-spin" />
          <p class="text-xs font-semibold text-gray-500">Loading order pending pool...</p>
        </div>

        <template v-else-if="poolData">
          <!-- Modal Header (Matching Admin & Invoice Modals) -->
          <div class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-[#faf8f5] shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center font-bold shrink-0">
                <Layers class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                    Create Fulfillment Batch
                  </h2>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-[#1b3b5f] text-white tracking-wider uppercase">
                    Batch {{ nextBatchNumber }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap truncate">
                  <span class="font-mono font-bold text-gray-900">{{ poolData.orderNumber }}</span>
                  <span>&bull;</span>
                  <span class="truncate">{{ poolData.customer?.company || poolData.customer?.name || 'Customer' }}</span>
                  <span>&bull;</span>
                  <span class="font-bold text-[#1b3b5f]">{{ poolData.totalPendingUnits }} pcs available</span>
                </p>
              </div>
            </div>

            <button 
              @click="closeModal" 
              data-modal-close="true" 
              title="Close" 
              class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors cursor-pointer shrink-0 ml-2"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Pending Pool Ribbon -->
          <div class="bg-blue-50/70 border-b border-blue-100 px-5 sm:px-6 py-3 flex items-center justify-between gap-4 text-xs shrink-0 flex-wrap">
            <div class="flex items-center gap-3 sm:gap-4 flex-wrap text-gray-600">
              <span>Total Ordered: <strong class="text-gray-900 font-bold">{{ poolData.totalOrderedUnits }} pcs</strong></span>
              <span class="text-gray-300 hidden sm:inline">&bull;</span>
              <span>Batched: <strong class="text-[#1b3b5f] font-bold">{{ poolData.totalBatchedUnits }} pcs</strong></span>
              <span class="text-gray-300 hidden sm:inline">&bull;</span>
              <span class="text-emerald-800 font-bold bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md">
                Available in Pool: {{ poolData.totalPendingUnits }} pcs
              </span>
            </div>
            <span class="text-[11px] font-semibold text-[#1b3b5f] hidden md:inline-block">
              Draw quantities for this fulfillment batch below
            </span>
          </div>

          <!-- Scrollable Body -->
          <div class="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">

            <!-- Items Table -->
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200 font-bold text-gray-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th class="p-3">Product Name & SKU</th>
                    <th class="p-3 text-center">Ordered</th>
                    <th class="p-3 text-center">Batched</th>
                    <th class="p-3 text-center text-emerald-800 bg-emerald-50/50">Available</th>
                    <th class="p-3 text-center w-40 sm:w-48 bg-blue-50/40 text-[#1b3b5f]">Batch Quantity</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr 
                    v-for="row in batchRows" 
                    :key="row.orderItemId"
                    class="hover:bg-gray-50/70 transition-colors"
                    :class="row.pendingQty === 0 ? 'bg-gray-50/80 opacity-60' : ''"
                  >
                    <!-- Product Info -->
                    <td class="p-3">
                      <p class="font-bold text-gray-900 leading-snug">{{ row.productName }}</p>
                      <div class="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        <span class="font-mono text-gray-600">{{ row.sku }}</span>
                        <span>&bull;</span>
                        <span class="font-semibold text-gray-700">{{ formatCurrency(row.unitPrice) }}</span>
                      </div>
                    </td>

                    <!-- Total Ordered -->
                    <td class="p-3 text-center font-semibold text-gray-700">
                      {{ row.orderedQty }}
                    </td>

                    <!-- Already Batched -->
                    <td class="p-3 text-center font-semibold text-[#1b3b5f]">
                      {{ row.batchedQty }}
                    </td>

                    <!-- Available in Pool -->
                    <td class="p-3 text-center font-bold text-emerald-700 bg-emerald-50/30">
                      {{ row.pendingQty }}
                    </td>

                    <!-- Batch Quantity Stepper -->
                    <td class="p-3 text-center bg-blue-50/20">
                      <div v-if="row.pendingQty > 0" class="inline-flex items-center gap-1.5 justify-center">
                        <div class="inline-flex items-center border border-gray-300 rounded-lg bg-white shadow-2xs overflow-hidden">
                          <button 
                            type="button"
                            @click="updateQty(row, -1)"
                            :disabled="row.batchQty <= 0"
                            class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer active:scale-95 transition-all"
                            title="Decrease quantity"
                          >
                            <Minus class="w-3.5 h-3.5" />
                          </button>
                          
                          <input 
                            type="number"
                            :value="row.batchQty"
                            @input="onQtyInput(row, $event)"
                            min="0"
                            :max="row.pendingQty"
                            class="w-12 h-7 text-center font-bold text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f] border-x border-gray-200"
                          />

                          <button 
                            type="button"
                            @click="updateQty(row, 1)"
                            :disabled="row.batchQty >= row.pendingQty"
                            class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer active:scale-95 transition-all"
                            title="Increase quantity"
                          >
                            <Plus class="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <!-- All Chip -->
                        <button 
                          type="button"
                          @click="setAllPending(row)"
                          class="px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                          :class="row.batchQty === row.pendingQty ? 'bg-[#1b3b5f] text-white shadow-2xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                          title="Fulfill all available units for this SKU"
                        >
                          All
                        </button>
                      </div>
                      <div v-else class="text-[11px] font-bold text-gray-400">
                        100% Fulfilled
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Batch Hold Toggle & Transport Customization -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Active / On Hold Toggle -->
              <div 
                class="border rounded-xl p-3.5 transition-colors" 
                :class="isOnHold ? 'bg-amber-50/80 border-amber-300' : 'bg-gray-50/80 border-gray-200'"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span class="text-lg">{{ isOnHold ? '⏸️' : '▶️' }}</span>
                    <div>
                      <label class="text-xs font-bold text-gray-900 cursor-pointer" @click="isOnHold = !isOnHold">
                        {{ isOnHold ? 'Batch is On Hold' : 'Batch is Active (Ready for Packing)' }}
                      </label>
                      <p class="text-[11px] text-gray-500 mt-0.5">
                        {{ isOnHold ? 'Paused from packing queue until released' : 'Moves to warehouse packing queue immediately' }}
                      </p>
                    </div>
                  </div>
                  <!-- Switch Toggle -->
                  <button 
                    type="button"
                    @click="isOnHold = !isOnHold"
                    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                    :class="isOnHold ? 'bg-amber-500' : 'bg-emerald-600'"
                  >
                    <span 
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                      :class="isOnHold ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </div>

              <!-- Transport Mode -->
              <div class="border border-gray-200 bg-gray-50/80 rounded-xl p-3.5 space-y-1.5">
                <label class="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Truck class="w-3.5 h-3.5 text-gray-500" />
                  <span>Transport Mode for this Batch</span>
                </label>
                <div class="flex items-center gap-1.5 text-xs">
                  <button 
                    type="button"
                    @click="selectedVehicleMode = 'OUR_FLEET'"
                    class="flex-1 py-1.5 px-2 rounded-lg font-bold border text-center transition-all cursor-pointer text-[11px]"
                    :class="selectedVehicleMode === 'OUR_FLEET' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-2xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
                  >
                    Our Fleet
                  </button>
                  <button 
                    type="button"
                    @click="selectedVehicleMode = 'PARTY_VEHICLE'"
                    class="flex-1 py-1.5 px-2 rounded-lg font-bold border text-center transition-all cursor-pointer text-[11px]"
                    :class="selectedVehicleMode === 'PARTY_VEHICLE' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-2xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
                  >
                    Customer Pickup
                  </button>
                  <button 
                    type="button"
                    @click="selectedVehicleMode = 'THIRD_PARTY'"
                    class="flex-1 py-1.5 px-2 rounded-lg font-bold border text-center transition-all cursor-pointer text-[11px]"
                    :class="selectedVehicleMode === 'THIRD_PARTY' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-2xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
                  >
                    Third Party
                  </button>
                </div>
              </div>
            </div>

            <!-- Batch Internal Note -->
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Batch Notes (Optional)</label>
              <input 
                v-model="batchNotes" 
                type="text" 
                placeholder="e.g. Priority dispatch for morning shift, or partial stock arriving Tuesday..."
                class="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f]"
              />
            </div>
          </div>

          <!-- Modal Action Footer -->
          <div class="px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <!-- Left: Batch Allocation Preview -->
            <div class="text-xs">
              <span class="text-gray-600">Batch {{ nextBatchNumber }} Total: </span>
              <strong class="text-gray-900 font-extrabold">{{ totalBatchUnits }} pcs</strong>
              <span class="text-gray-300 mx-1.5">&bull;</span>
              <strong class="text-[#1b3b5f] font-black">{{ formatCurrency(totalBatchAmount) }}</strong>
              <span class="block text-[11px] text-gray-500 mt-0.5">
                Pending pool after this batch: <strong>{{ remainingPoolAfterBatch }} pcs</strong>
              </span>
            </div>

            <!-- Right: Action Buttons -->
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                type="button"
                @click="closeModal" 
                :disabled="isSubmitting"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 disabled:opacity-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                @click="submitCreateBatch" 
                :disabled="isSubmitting || totalBatchUnits === 0"
                class="px-5 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
                <Plus v-else class="w-3.5 h-3.5" />
                <span>Create Batch {{ nextBatchNumber }}</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
