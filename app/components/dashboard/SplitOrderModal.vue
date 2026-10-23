<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, GitFork, AlertCircle, Check, Loader2, ArrowRight, 
  Package, IndianRupee, Plus, Minus, RotateCcw, MapPin, Building2 
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
const newOrderNumber = ref('')
const splitNotes = ref('')
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

// Fetch order and initialize items
watch(() => [props.isOpen, props.orderId], async ([open, id]) => {
  if (open && id) {
    isLoadingOrder.value = true
    try {
      const data = await $fetch<any>(`/api/orders/${id}`)
      order.value = data

      // Auto-generate candidate split number by checking existing related splits
      const baseNum = data.orderNumber.replace(/-[A-Z]$/, '')
      try {
        const relatedRes = await $fetch<any>('/api/orders', {
          query: { search: baseNum, limit: 50 }
        })
        const existingNumbers = new Set<string>(
          (relatedRes?.orders || []).map((o: any) => String(o.orderNumber).toUpperCase())
        )
        existingNumbers.add(data.orderNumber.toUpperCase())

        const alphabet = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'
        let nextSuffix = 'B'
        for (let i = 0; i < alphabet.length; i++) {
          const candidate = `${baseNum}-${alphabet[i]}`
          if (!existingNumbers.has(candidate.toUpperCase())) {
            nextSuffix = alphabet[i]
            break
          }
        }
        newOrderNumber.value = `${baseNum}-${nextSuffix}`
      } catch {
        const match = data.orderNumber.match(/-([A-Z])$/)
        if (match) {
          const nextChar = String.fromCharCode(match[1].charCodeAt(0) + 1)
          newOrderNumber.value = `${baseNum}-${nextChar}`
        } else {
          newOrderNumber.value = `${baseNum}-B`
        }
      }
      splitNotes.value = ''
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
      console.error('Failed to load order for split:', err)
      alert(err.data?.message || 'Failed to load order details')
      closeModal()
    } finally {
      isLoadingOrder.value = false
    }
  } else {
    order.value = null
    splitRows.value = []
    newOrderNumber.value = ''
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
      // Keep what's packed, move what's unpacked
      setRowQuantities(row, row.packedQty, row.totalQty - row.packedQty)
    } else if (row.packedQty === 0 && row.totalQty > 0) {
      // If none packed, move all to split
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
    return 'You must keep at least one unit in the original order.'
  }
  if (totalMoveUnits.value <= 0) {
    return 'You must allocate at least one unit to the new split order.'
  }
  if (!newOrderNumber.value.trim()) {
    return 'Please provide a valid order number for the new split order.'
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

// Submit Split
const confirmSplit = async () => {
  if (!isFormValid.value || isSubmitting.value) return

  isSubmitting.value = true
  try {
    const payload = {
      newOrderNumber: newOrderNumber.value.trim(),
      notes: splitNotes.value.trim() || undefined,
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

    showSaved(`Order split into ${order.value.orderNumber} & ${res.newOrder.orderNumber}!`)
    notifyChange({ orderId: order.value.id, action: 'ORDER_SPLIT' })
    isSubmitting.value = false
    closeModal(true)
    emit('splitSuccess', res)
  } catch (err: any) {
    console.error('Failed to split order:', err)
    alert(err.data?.message || 'Failed to split order. Please check inputs.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeModal"></div>

      <!-- Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[calc(100vh-4.5rem)] md:max-h-[92vh] overflow-hidden border border-gray-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#faf8f5] shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center font-bold">
              <GitFork class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-gray-900">Split Order: {{ order?.orderNumber || 'Loading...' }}</h2>
                <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Billing Reconciliation
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                <span>{{ order?.customer?.name }}</span>
                <span v-if="order?.customer?.company" class="text-gray-400">•</span>
                <span v-if="order?.customer?.company">{{ order.customer.company }}</span>
                <span class="text-gray-400">•</span>
                <span class="font-mono text-gray-600">Total: {{ formatCurrency(order?.totalAmount || 0) }}</span>
              </p>
            </div>
          </div>
          <button 
            @click="closeModal" 
            :disabled="isSubmitting"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body Content -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          <div v-if="isLoadingOrder" class="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
            <p class="text-xs text-gray-500 font-medium">Loading order line items...</p>
          </div>

          <template v-else-if="order">
            <!-- Instructions & Fast Action Toolbar -->
            <div class="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-start gap-2.5">
                <AlertCircle class="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p class="text-xs text-blue-900 leading-relaxed">
                  Allocate quantities below between <strong>{{ order.orderNumber }}</strong> and the <strong>New Split Order</strong>. Both orders will receive separate invoices, packing manifests, and independent delivery routing.
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button 
                  type="button" 
                  @click="resetAllToKeep" 
                  class="px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw class="w-3 h-3 text-gray-500" />
                  <span>Reset All</span>
                </button>
                <button 
                  type="button" 
                  @click="moveUnpackedItems" 
                  title="Move un-packed quantities to the new split order"
                  class="px-2.5 py-1.5 text-[11px] font-semibold text-[#1b3b5f] bg-white border border-[#1b3b5f]/30 rounded-lg hover:bg-[#1b3b5f]/10 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Package class="w-3 h-3" />
                  <span>Split Unpacked</span>
                </button>
              </div>
            </div>

            <!-- DUAL LIVE SUMMARY CARDS -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Left Card: Original Order (Remaining) -->
              <div class="bg-white rounded-xl border-2 border-emerald-500/40 p-4 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                  Order A (Original)
                </div>
                <div class="flex items-center gap-2">
                  <Package class="w-4 h-4 text-emerald-700" />
                  <span class="text-xs font-bold text-gray-900">{{ order.orderNumber }}</span>
                </div>
                <div class="mt-3 flex items-baseline justify-between">
                  <div>
                    <span class="text-2xl font-black text-emerald-800 tabular-nums">
                      {{ formatCurrency(keepTotalAmount) }}
                    </span>
                    <span class="text-xs text-gray-500 block mt-0.5">
                      {{ keepLineItemsCount }} line(s) • {{ totalKeepUnits }} nos. total
                    </span>
                  </div>
                  <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Remains in current bill
                  </span>
                </div>
              </div>

              <!-- Right Card: New Split Order -->
              <div class="bg-white rounded-xl border-2 border-[#1b3b5f]/40 p-4 shadow-sm relative overflow-hidden bg-radial from-transparent to-[#1b3b5f]/5">
                <div class="absolute top-0 right-0 bg-[#1b3b5f] text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                  Order B (New Split)
                </div>
                <div class="flex items-center gap-2">
                  <GitFork class="w-4 h-4 text-[#1b3b5f]" />
                  <span class="text-xs font-bold text-gray-900 font-mono">{{ newOrderNumber || 'SO-YYYY-NNNN-B' }}</span>
                </div>
                <div class="mt-3 flex items-baseline justify-between">
                  <div>
                    <span class="text-2xl font-black text-[#1b3b5f] tabular-nums">
                      {{ formatCurrency(moveTotalAmount) }}
                    </span>
                    <span class="text-xs text-gray-500 block mt-0.5">
                      {{ moveLineItemsCount }} line(s) • {{ totalMoveUnits }} nos. total
                    </span>
                  </div>
                  <span 
                    class="text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors"
                    :class="totalMoveUnits > 0 ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] border-[#1b3b5f]/20' : 'bg-gray-100 text-gray-400 border-gray-200'"
                  >
                    {{ totalMoveUnits > 0 ? 'Ready to create' : 'Add items to move' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- ITEMS SPLIT ALLOCATION TABLE -->
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <div class="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                <h3 class="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Line Items & Quantities Allocation
                </h3>
                <span class="text-[11px] text-gray-500 font-medium">
                  Total items: {{ splitRows.length }}
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
                        Keep in {{ order.orderNumber }}
                      </th>
                      <th class="px-3 py-2.5 text-center w-40 bg-[#1b3b5f]/5 border-r border-[#1b3b5f]/10">
                        Move to {{ newOrderNumber || 'Split' }}
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
                        <div class="font-bold text-gray-900">{{ row.productName }}</div>
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
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition"
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
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition"
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
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition"
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
                            class="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition"
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
                            class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-[#1b3b5f] hover:text-white rounded text-gray-700 transition"
                            title="Move all units of this line item to split order"
                          >
                            Move All
                          </button>
                          <button 
                            type="button" 
                            @click="split5050(row)"
                            v-if="row.totalQty > 1"
                            class="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition"
                            title="Split 50% / 50%"
                          >
                            ½
                          </button>
                          <button 
                            type="button" 
                            @click="keepAll(row)"
                            class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-[#1b3b5f] hover:text-white rounded text-gray-700 transition"
                            title="Keep all units in current order"
                          >
                            Keep All
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- SPLIT SETTINGS / METADATA -->
            <div class="bg-gray-50/80 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Left: New Order Number & Delivery Address -->
              <div class="space-y-3">
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    New Order Number *
                  </label>
                  <input 
                    type="text" 
                    v-model="newOrderNumber" 
                    placeholder="e.g. SO-2026-1045-B" 
                    class="w-full text-xs font-mono font-bold border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
                  />
                  <p class="text-[10px] text-gray-400 mt-0.5">Recommended format: SO-YYYY-NNNN-B</p>
                </div>

                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Delivery Address for New Order
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
                    placeholder="Delivery destination for the split order..."
                    class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  ></textarea>
                </div>
              </div>

              <!-- Right: Transport Mode & Split Notes -->
              <div class="space-y-3">
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Transport Mode for New Order *
                  </label>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      @click="selectedVehicleMode = 'OUR_FLEET'"
                      class="px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer"
                      :class="selectedVehicleMode === 'OUR_FLEET' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                    >
                      <span>🚚 Our Fleet</span>
                    </button>
                    <button
                      type="button"
                      @click="selectedVehicleMode = 'PARTY_VEHICLE'"
                      class="px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer"
                      :class="selectedVehicleMode === 'PARTY_VEHICLE' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                    >
                      <span>🚗 Party Vehicle</span>
                    </button>
                    <button
                      type="button"
                      @click="selectedVehicleMode = 'THIRD_PARTY'"
                      class="px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer"
                      :class="selectedVehicleMode === 'THIRD_PARTY' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
                    >
                      <span>📦 3rd Party (Porter/Rapido)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Reason / Split Notes (Optional)
                  </label>
                  <textarea 
                    rows="2" 
                    v-model="splitNotes" 
                    placeholder="e.g. Split for partial dispatch on tempo; remaining sheets will be delivered tomorrow..."
                    class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]"
                  ></textarea>
                  <p class="text-[10px] text-gray-400 mt-1">
                    These notes will appear on the new order's timeline and manifest.
                  </p>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <p v-if="validationError" class="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{{ validationError }}</span>
            </p>
            <p v-else class="text-xs text-gray-500 flex items-center gap-1.5">
              <Check class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Ready: {{ totalKeepUnits }} units stay in {{ order?.orderNumber }}, {{ totalMoveUnits }} units move to {{ newOrderNumber }}</span>
            </p>
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              @click="closeModal" 
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
              <GitFork v-else class="w-3.5 h-3.5" />
              <span>Confirm & Split Order</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
