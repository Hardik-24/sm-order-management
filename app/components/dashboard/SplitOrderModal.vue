<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, GitFork, AlertCircle, Check, Loader2, ArrowRight, 
  Package, IndianRupee, Plus, Minus, RotateCcw, MapPin, Building2, Clock, Layers 
} from 'lucide-vue-next'
import { formatCurrency } from '~~/app/lib/utils'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const props = defineProps<{
  isOpen: boolean
  orderId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'splitSuccess', result: any): void
}>()

const { showSaved } = useSnackbar()
const { notifyChange } = useRealtimeSync()

const isLoadingOrder = ref(false)
const isSubmitting = ref(false)
const order = ref<any | null>(null)
const splitNotes = ref('')
const holdBatch2 = ref(true)
const selectedAddressId = ref<string>('')
const customAddressText = ref<string>('')
const selectedVehicleMode = ref<'OUR_FLEET' | 'PARTY_VEHICLE' | 'THIRD_PARTY'>('OUR_FLEET')

interface SplitRow {
  id: string
  productId: string
  productName: string
  sku: string
  unitPrice: number
  discount: number
  taxRate: number
  isTaxInclusive: boolean
  totalQty: number
  keepQty: number
  moveQty: number
  packedQty: number
}

const splitRows = ref<SplitRow[]>([])

// Batch Labels computation
const isRecursiveSplit = computed(() => Boolean(order.value?.parentOrderId))
const batch1Label = computed(() => {
  if (isRecursiveSplit.value) {
    return `Batch ${order.value?.batchNumber || 1} (Remaining)`
  }
  return 'Batch 1 (Immediate Dispatch)'
})

const batch2Label = computed(() => {
  if (isRecursiveSplit.value) {
    const nextNum = (order.value?.batchCount || order.value?.batchNumber || 1) + 1
    return `Batch ${nextNum} (New Batch)`
  }
  return 'Batch 2 (Scheduled / Pending)'
})

// Fetch order and initialize items
watch(() => [props.isOpen, props.orderId], async ([open, id]) => {
  if (open && id) {
    isLoadingOrder.value = true
    try {
      const data = await $fetch<any>(`/api/orders/${id}`)
      order.value = data
      splitNotes.value = ''
      holdBatch2.value = true
      selectedAddressId.value = data.deliveryAddressId || ''
      customAddressText.value = data.deliveryAddress || ''
      selectedVehicleMode.value = (data.vehicleMode === 'PARTY_VEHICLE' || data.vehicleMode === 'THIRD_PARTY') ? data.vehicleMode : 'OUR_FLEET'

      splitRows.value = (data.items || []).map((item: any) => {
        const total = item.approvedQuantity ?? item.quantity
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName || item.product?.name || 'Item',
          sku: item.sku || item.product?.sku || 'SKU',
          unitPrice: Number(item.unitPrice || 0),
          discount: Number(item.discount || 0),
          taxRate: Number(item.taxRate || 0),
          isTaxInclusive: Boolean(item.isTaxInclusive),
          totalQty: total,
          keepQty: total,
          moveQty: 0,
          packedQty: Number(item.packedQuantity || 0)
        }
      })
    } catch (err: any) {
      console.error('Failed to load order for batch split:', err)
      alert(err.data?.message || 'Failed to load order details')
      closeModal()
    } finally {
      isLoadingOrder.value = false
    }
  } else {
    order.value = null
    splitRows.value = []
  }
})

const closeModal = (force = false) => {
  if (force || !isSubmitting.value) {
    emit('close')
  }
}

// Helpers to update quantities safely
const setRowQuantities = (row: SplitRow, keep: number, move: number) => {
  row.keepQty = Math.max(0, Math.min(row.totalQty, keep))
  row.moveQty = row.totalQty - row.keepQty
}

const onKeepQtyInput = (row: SplitRow, event: Event) => {
  const val = parseInt((event.target as HTMLInputElement).value, 10)
  if (isNaN(val)) return
  setRowQuantities(row, val, row.totalQty - val)
}

const onMoveQtyInput = (row: SplitRow, event: Event) => {
  const val = parseInt((event.target as HTMLInputElement).value, 10)
  if (isNaN(val)) return
  setRowQuantities(row, row.totalQty - val, val)
}

const moveOneToNew = (row: SplitRow) => {
  if (row.keepQty > 0) {
    setRowQuantities(row, row.keepQty - 1, row.moveQty + 1)
  }
}

const moveOneToKeep = (row: SplitRow) => {
  if (row.moveQty > 0) {
    setRowQuantities(row, row.keepQty + 1, row.moveQty - 1)
  }
}

const keepAll = (row: SplitRow) => {
  setRowQuantities(row, row.totalQty, 0)
}

const moveAll = (row: SplitRow) => {
  setRowQuantities(row, 0, row.totalQty)
}

const split5050 = (row: SplitRow) => {
  const half = Math.ceil(row.totalQty / 2)
  setRowQuantities(row, half, row.totalQty - half)
}

const resetAllToKeep = () => {
  splitRows.value.forEach(row => keepAll(row))
}

const moveUnpackedItems = () => {
  splitRows.value.forEach(row => {
    if (row.packedQty > 0 && row.packedQty < row.totalQty) {
      setRowQuantities(row, row.packedQty, row.totalQty - row.packedQty)
    } else if (row.packedQty === 0 && row.totalQty > 0) {
      setRowQuantities(row, 0, row.totalQty)
    }
  })
}

// Financial calculations per item
const computeTotal = (qty: number, price: number, discountPct: number, taxRatePct: number, isTaxInc: boolean) => {
  const subtotal = qty * price
  const discountAmt = subtotal * (discountPct / 100)
  const taxable = subtotal - discountAmt
  const taxAmt = isTaxInc ? 0 : taxable * (taxRatePct / 100)
  return taxable + taxAmt
}

// Summary metrics
const totalKeepUnits = computed(() => splitRows.value.reduce((sum, r) => sum + r.keepQty, 0))
const totalMoveUnits = computed(() => splitRows.value.reduce((sum, r) => sum + r.moveQty, 0))

const keepLineItemsCount = computed(() => splitRows.value.filter(r => r.keepQty > 0).length)
const moveLineItemsCount = computed(() => splitRows.value.filter(r => r.moveQty > 0).length)

const keepTotalAmount = computed(() => {
  return splitRows.value.reduce((sum, r) => {
    return sum + computeTotal(r.keepQty, r.unitPrice, r.discount, r.taxRate, r.isTaxInclusive)
  }, 0)
})

const moveTotalAmount = computed(() => {
  return splitRows.value.reduce((sum, r) => {
    return sum + computeTotal(r.moveQty, r.unitPrice, r.discount, r.taxRate, r.isTaxInclusive)
  }, 0)
})

// Validation
const validationError = computed(() => {
  if (totalKeepUnits.value <= 0) {
    return `You must keep at least one unit in ${batch1Label.value}.`
  }
  if (totalMoveUnits.value <= 0) {
    return `You must allocate at least one unit to ${batch2Label.value}.`
  }
  return null
})

const isFormValid = computed(() => !validationError.value)

// Address selection change
const onAddressSelect = (addrId: string) => {
  selectedAddressId.value = addrId
  if (addrId) {
    const found = order.value?.customer?.addresses?.find((a: any) => a.id === addrId)
    if (found) {
      customAddressText.value = [found.addressLine, found.city, found.pincode].filter(Boolean).join(', ')
    }
  } else {
    customAddressText.value = order.value?.deliveryAddress || ''
  }
}

// Submit Split into Batches
const confirmSplit = async () => {
  if (!isFormValid.value || isSubmitting.value) return

  isSubmitting.value = true
  try {
    const payload = {
      notes: splitNotes.value.trim() || undefined,
      holdBatch2: holdBatch2.value,
      deliveryAddress: customAddressText.value.trim() || undefined,
      deliveryAddressId: selectedAddressId.value || undefined,
      vehicleMode: selectedVehicleMode.value,
      items: splitRows.value.map(r => ({
        orderItemId: r.id,
        keepQuantity: r.keepQty,
        moveQuantity: r.moveQty
      }))
    }

    const res = await $fetch<any>(`/api/orders/${order.value.id}/split`, {
      method: 'POST',
      body: payload
    })

    showSaved(res.message || 'Order split into batches successfully!')
    notifyChange({ orderId: order.value.id, action: 'ORDER_SPLIT' })
    isSubmitting.value = false
    closeModal(true)
    emit('splitSuccess', res)
  } catch (err: any) {
    console.error('Failed to split order into batches:', err)
    alert(err.data?.message || 'Failed to split into batches. Please check inputs.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" data-modal-container class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[650] flex items-center justify-center p-2 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeModal"></div>

      <!-- Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] md:max-h-[92vh] overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-150 bg-[#faf8f5] shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center font-bold shrink-0">
              <Layers class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 class="text-sm sm:text-base font-bold text-gray-900 truncate">
                  Split into Batches: {{ order?.orderNumber || 'Loading...' }}
                </h2>
                <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                  Phased Fulfillment
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 truncate">
                <span class="font-medium text-gray-700">{{ order?.customer?.company || order?.customer?.name }}</span>
                <span class="text-gray-300">•</span>
                <span class="font-mono text-gray-600">Total: {{ formatCurrency(order?.totalAmount || 0) }}</span>
              </p>
            </div>
          </div>
          <button 
            @click="closeModal" 
            :disabled="isSubmitting"
            data-modal-close="true"
            title="Close"
            class="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 transition-colors cursor-pointer shrink-0 ml-1"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body Content -->
        <div class="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          <div v-if="isLoadingOrder" class="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
            <p class="text-xs text-gray-500 font-medium">Loading line items...</p>
          </div>

          <template v-else-if="order">
            <!-- Instructions & Fast Action Toolbar -->
            <div class="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-start gap-2.5">
                <AlertCircle class="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p class="text-xs text-blue-900 leading-relaxed">
                  Allocate quantities between <strong>{{ batch1Label }}</strong> and <strong>{{ batch2Label }}</strong>. Both batches progress through packing, separate billing invoices, and independent deliveries.
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button 
                  type="button" 
                  @click="resetAllToKeep" 
                  class="px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw class="w-3 h-3 text-gray-500" />
                  <span>Reset All</span>
                </button>
                <button 
                  type="button" 
                  @click="moveUnpackedItems" 
                  title="Move un-packed quantities to the second batch"
                  class="px-2.5 py-1 text-[11px] font-semibold text-[#1b3b5f] bg-white border border-[#1b3b5f]/30 rounded-lg hover:bg-[#1b3b5f]/10 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Package class="w-3 h-3" />
                  <span>Split Unpacked</span>
                </button>
              </div>
            </div>

            <!-- DUAL LIVE SUMMARY CARDS -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <!-- Left Card: Batch 1 -->
              <div class="bg-white rounded-xl border-2 border-emerald-500/40 p-3 sm:p-4 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                  {{ batch1Label }}
                </div>
                <div class="flex items-center gap-1.5">
                  <Package class="w-4 h-4 text-emerald-700 shrink-0" />
                  <span class="text-xs font-bold text-gray-900 truncate">Immediate Dispatch</span>
                </div>
                <div class="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span class="text-xl sm:text-2xl font-black text-emerald-800 tabular-nums">
                      {{ formatCurrency(keepTotalAmount) }}
                    </span>
                    <span class="text-xs text-gray-500 block mt-0.5">
                      {{ keepLineItemsCount }} line(s) • {{ totalKeepUnits }} nos. total
                    </span>
                  </div>
                  <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                    Active for Packing
                  </span>
                </div>
              </div>

              <!-- Right Card: Batch 2 -->
              <div class="bg-white rounded-xl border-2 border-[#1b3b5f]/40 p-3 sm:p-4 shadow-sm relative overflow-hidden bg-radial from-transparent to-[#1b3b5f]/5">
                <div class="absolute top-0 right-0 bg-[#1b3b5f] text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                  {{ batch2Label }}
                </div>
                <div class="flex items-center gap-1.5">
                  <Clock class="w-4 h-4 text-[#1b3b5f] shrink-0" />
                  <span class="text-xs font-bold text-gray-900 truncate">Second Batch</span>
                </div>
                <div class="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span class="text-xl sm:text-2xl font-black text-[#1b3b5f] tabular-nums">
                      {{ formatCurrency(moveTotalAmount) }}
                    </span>
                    <span class="text-xs text-gray-500 block mt-0.5">
                      {{ moveLineItemsCount }} line(s) • {{ totalMoveUnits }} nos. total
                    </span>
                  </div>
                  <span 
                    class="text-[11px] font-bold px-2 py-0.5 rounded-md border transition-colors shrink-0"
                    :class="totalMoveUnits > 0 ? (holdBatch2 ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-[#1b3b5f]/10 text-[#1b3b5f] border-[#1b3b5f]/20') : 'bg-gray-100 text-gray-400 border-gray-200'"
                  >
                    {{ totalMoveUnits > 0 ? (holdBatch2 ? 'On Hold' : 'Immediate') : 'Allocate Items' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- BATCH 2 HOLD OPTION TOGGLE -->
            <div class="p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <Clock class="w-4 h-4 text-amber-700 shrink-0" />
                <div class="min-w-0">
                  <label for="hold-batch-toggle" class="text-xs font-bold text-amber-950 cursor-pointer block truncate">
                    Hold {{ batch2Label }} until stock arrives
                  </label>
                  <p class="text-[11px] text-amber-700 mt-0.5 leading-snug">
                    {{ batch2Label }} will stay on hold and will NOT appear in the warehouse packing queue until manually released.
                  </p>
                </div>
              </div>
              <input 
                id="hold-batch-toggle" 
                v-model="holdBatch2" 
                type="checkbox" 
                class="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer shrink-0" 
              />
            </div>

            <!-- ITEMS ALLOCATION: DESKTOP TABLE (md:block) -->
            <div class="hidden md:block border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <div class="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                <h3 class="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Line Items & Quantities Allocation
                </h3>
                <span class="text-[11px] text-gray-500 font-medium">
                  {{ splitRows.length }} line items
                </span>
              </div>

              <div class="overflow-x-auto max-h-[340px]">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="sticky top-0 bg-gray-50 z-10 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th class="px-4 py-2.5">Item Description</th>
                      <th class="px-3 py-2.5 text-right w-24">Rate (₹)</th>
                      <th class="px-3 py-2.5 text-center w-20">Total Qty</th>
                      <th class="px-3 py-2.5 text-center w-40 bg-emerald-50/60 border-x border-emerald-100">
                        {{ batch1Label }}
                      </th>
                      <th class="px-3 py-2.5 text-center w-40 bg-[#1b3b5f]/5 border-r border-[#1b3b5f]/10">
                        {{ batch2Label }}
                      </th>
                      <th class="px-3 py-2.5 text-center w-28">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white">
                    <tr 
                      v-for="row in splitRows" 
                      :key="row.id" 
                      class="hover:bg-gray-50/60 transition-colors"
                      :class="{ 'opacity-70': row.moveQty === row.totalQty }"
                    >
                      <!-- Item Description -->
                      <td class="px-4 py-3">
                        <div class="font-bold text-gray-900 break-words">{{ row.productName }}</div>
                        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                          <span class="font-mono">{{ row.sku }}</span>
                          <span v-if="row.packedQty > 0" class="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-amber-200">
                            Packed: {{ row.packedQty }}/{{ row.totalQty }}
                          </span>
                        </div>
                      </td>

                      <!-- Rate -->
                      <td class="px-3 py-3 text-right font-medium text-gray-700 tabular-nums">
                        {{ formatCurrency(row.unitPrice) }}
                      </td>

                      <!-- Total Qty -->
                      <td class="px-3 py-3 text-center">
                        <span class="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {{ row.totalQty }}
                        </span>
                      </td>

                      <!-- Keep Qty Column -->
                      <td class="px-3 py-3 bg-emerald-50/20 border-x border-emerald-100">
                        <div class="flex items-center justify-center gap-1.5">
                          <button 
                            type="button" 
                            @click="moveOneToNew(row)"
                            :disabled="row.keepQty <= 0"
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition cursor-pointer"
                          >
                            <Minus class="w-3 h-3" />
                          </button>
                          <input 
                            type="number" 
                            :min="0" 
                            :max="row.totalQty"
                            :value="row.keepQty" 
                            @input="e => onKeepQtyInput(row, e)"
                            class="w-14 text-center font-bold text-xs border border-emerald-300 rounded-md py-1 bg-white focus:ring-1 focus:ring-emerald-500 text-emerald-900"
                          />
                          <button 
                            type="button" 
                            @click="moveOneToKeep(row)"
                            :disabled="row.keepQty >= row.totalQty"
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition cursor-pointer"
                          >
                            <Plus class="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <!-- Move Qty Column -->
                      <td class="px-3 py-3 bg-[#1b3b5f]/5 border-r border-[#1b3b5f]/10">
                        <div class="flex items-center justify-center gap-1.5">
                          <button 
                            type="button" 
                            @click="moveOneToKeep(row)"
                            :disabled="row.moveQty <= 0"
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition cursor-pointer"
                          >
                            <Minus class="w-3 h-3" />
                          </button>
                          <input 
                            type="number" 
                            :min="0" 
                            :max="row.totalQty"
                            :value="row.moveQty" 
                            @input="e => onMoveQtyInput(row, e)"
                            class="w-14 text-center font-bold text-xs border border-[#1b3b5f]/40 rounded-md py-1 bg-white focus:ring-1 focus:ring-[#1b3b5f] text-[#1b3b5f]"
                          />
                          <button 
                            type="button" 
                            @click="moveOneToNew(row)"
                            :disabled="row.moveQty >= row.totalQty"
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition cursor-pointer"
                          >
                            <Plus class="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <!-- Quick Action Buttons -->
                      <td class="px-3 py-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button 
                            type="button" 
                            @click="moveAll(row)"
                            class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-[#1b3b5f] hover:text-white rounded text-gray-700 transition cursor-pointer"
                            title="Allocate all to second batch"
                          >
                            All 2
                          </button>
                          <button 
                            type="button" 
                            @click="split5050(row)"
                            v-if="row.totalQty > 1"
                            class="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition cursor-pointer"
                            title="Split 50% / 50%"
                          >
                            ½
                          </button>
                          <button 
                            type="button" 
                            @click="keepAll(row)"
                            class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-emerald-700 hover:text-white rounded text-gray-700 transition cursor-pointer"
                            title="Keep all in first batch"
                          >
                            All 1
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ITEMS ALLOCATION: MOBILE CARDS (md:hidden) -->
            <div class="block md:hidden space-y-2.5">
              <div class="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                <span>Items Allocation</span>
                <span class="text-[11px] text-gray-500 font-normal">{{ splitRows.length }} items</span>
              </div>

              <div 
                v-for="row in splitRows" 
                :key="'mob-' + row.id"
                class="bg-white rounded-xl border border-gray-200 p-3 shadow-2xs space-y-2.5"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <h4 class="text-xs font-bold text-gray-900 break-words leading-snug">
                      {{ row.productName }}
                    </h4>
                    <p class="text-[10px] text-gray-500 font-mono mt-0.5">{{ row.sku }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                      Total: {{ row.totalQty }}
                    </span>
                    <span class="text-[10px] text-gray-500 block mt-0.5">{{ formatCurrency(row.unitPrice) }}</span>
                  </div>
                </div>

                <!-- 2 Batch Counters Row -->
                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                  <!-- Batch 1 Counter -->
                  <div class="bg-emerald-50/40 border border-emerald-200 rounded-lg p-2 text-center">
                    <span class="text-[10px] font-bold text-emerald-800 uppercase block truncate">
                      {{ isRecursiveSplit ? 'Batch ' + (order?.batchNumber || 1) : 'Batch 1' }}
                    </span>
                    <div class="flex items-center justify-center gap-1.5 mt-1">
                      <button 
                        type="button" 
                        @click="moveOneToNew(row)"
                        :disabled="row.keepQty <= 0"
                        class="w-7 h-7 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-xs active:scale-95 disabled:opacity-30 cursor-pointer"
                      >
                        <Minus class="w-3.5 h-3.5" />
                      </button>
                      <input 
                        type="number" 
                        :min="0" 
                        :max="row.totalQty"
                        :value="row.keepQty" 
                        @input="e => onKeepQtyInput(row, e)"
                        class="w-12 text-center font-bold text-xs border border-emerald-300 rounded-md py-1 bg-white text-emerald-900"
                      />
                      <button 
                        type="button" 
                        @click="moveOneToKeep(row)"
                        :disabled="row.keepQty >= row.totalQty"
                        class="w-7 h-7 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-xs active:scale-95 disabled:opacity-30 cursor-pointer"
                      >
                        <Plus class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <!-- Batch 2 Counter -->
                  <div class="bg-[#1b3b5f]/5 border border-[#1b3b5f]/20 rounded-lg p-2 text-center">
                    <span class="text-[10px] font-bold text-[#1b3b5f] uppercase block truncate">
                      {{ isRecursiveSplit ? 'Batch ' + ((order?.batchCount || 1) + 1) : 'Batch 2' }}
                    </span>
                    <div class="flex items-center justify-center gap-1.5 mt-1">
                      <button 
                        type="button" 
                        @click="moveOneToKeep(row)"
                        :disabled="row.moveQty <= 0"
                        class="w-7 h-7 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-xs active:scale-95 disabled:opacity-30 cursor-pointer"
                      >
                        <Minus class="w-3.5 h-3.5" />
                      </button>
                      <input 
                        type="number" 
                        :min="0" 
                        :max="row.totalQty"
                        :value="row.moveQty" 
                        @input="e => onMoveQtyInput(row, e)"
                        class="w-12 text-center font-bold text-xs border border-[#1b3b5f]/40 rounded-md py-1 bg-white text-[#1b3b5f]"
                      />
                      <button 
                        type="button" 
                        @click="moveOneToNew(row)"
                        :disabled="row.moveQty >= row.totalQty"
                        class="w-7 h-7 rounded-md bg-white border border-gray-300 text-gray-700 flex items-center justify-center text-xs active:scale-95 disabled:opacity-30 cursor-pointer"
                      >
                        <Plus class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Quick Action Chips -->
                <div class="flex items-center justify-end gap-1.5 pt-0.5">
                  <button 
                    type="button" 
                    @click="keepAll(row)"
                    class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer"
                  >
                    All in 1
                  </button>
                  <button 
                    type="button" 
                    @click="split5050(row)"
                    v-if="row.totalQty > 1"
                    class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition cursor-pointer"
                  >
                    ½ Split
                  </button>
                  <button 
                    type="button" 
                    @click="moveAll(row)"
                    class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded hover:bg-[#1b3b5f]/10 hover:text-[#1b3b5f] transition cursor-pointer"
                  >
                    All in 2
                  </button>
                </div>
              </div>
            </div>

            <!-- METADATA & DELIVERY DETAILS -->
            <div class="bg-gray-50/80 p-3.5 sm:p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              <!-- Left: Delivery Address -->
              <div class="space-y-3">
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Delivery Address for {{ batch2Label }}
                  </label>
                  <select 
                    v-if="order.customer?.addresses?.length"
                    :value="selectedAddressId"
                    @change="e => onAddressSelect((e.target as HTMLSelectElement).value)"
                    class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f] mb-1.5"
                  >
                    <option value="">Current Order Delivery Address</option>
                    <option 
                      v-for="addr in order.customer.addresses" 
                      :key="addr.id" 
                      :value="addr.id"
                    >
                      {{ addr.label }}: {{ addr.addressLine }} ({{ addr.city || 'Karnataka' }})
                    </option>
                  </select>
                  <textarea 
                    rows="2" 
                    v-model="customAddressText" 
                    placeholder="Delivery destination for the second batch..."
                    class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  ></textarea>
                </div>
              </div>

              <!-- Right: Transport Mode & Split Notes -->
              <div class="space-y-3">
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Transport Mode for {{ batch2Label }} *
                  </label>
                  <div class="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      @click="selectedVehicleMode = 'OUR_FLEET'"
                      class="px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition cursor-pointer text-center"
                      :class="selectedVehicleMode === 'OUR_FLEET' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                    >
                      <span class="truncate">🚚 Fleet</span>
                    </button>
                    <button
                      type="button"
                      @click="selectedVehicleMode = 'PARTY_VEHICLE'"
                      class="px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition cursor-pointer text-center"
                      :class="selectedVehicleMode === 'PARTY_VEHICLE' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                    >
                      <span class="truncate">🚗 Party</span>
                    </button>
                    <button
                      type="button"
                      @click="selectedVehicleMode = 'THIRD_PARTY'"
                      class="px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition cursor-pointer text-center"
                      :class="selectedVehicleMode === 'THIRD_PARTY' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                    >
                      <span class="truncate">📦 3rd Party</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Notes for Batches (Optional)
                  </label>
                  <textarea 
                    rows="2" 
                    v-model="splitNotes" 
                    placeholder="e.g. Batch 1 tempo dispatch; Batch 2 awaiting factory delivery next week..."
                    class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  ></textarea>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="px-4 sm:px-6 py-3 sm:py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <p v-if="validationError" class="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{{ validationError }}</span>
            </p>
            <p v-else class="text-xs text-gray-600 flex items-center gap-1.5">
              <Check class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{{ totalKeepUnits }} units in {{ batch1Label }}, {{ totalMoveUnits }} units in {{ batch2Label }}</span>
            </p>
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              @click="closeModal" 
              data-modal-close="true"
              :disabled="isSubmitting"
              class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button" 
              @click="confirmSplit"
              :disabled="!isFormValid || isSubmitting"
              class="px-5 py-2 text-xs font-bold text-white bg-[#1b3b5f] hover:bg-[#132c49] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
              <Layers v-else class="w-3.5 h-3.5" />
              <span>Confirm & Create Batches</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
