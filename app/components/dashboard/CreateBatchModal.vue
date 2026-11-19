<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, Layers, AlertCircle, Check, Loader2, Plus, Minus, MapPin, Building2, Truck, Car, Package, Clock, Save, Trash2, Tag, IndianRupee
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import SearchCombobox from '~/components/ui/SearchCombobox.vue'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    orderId: string | null        // In create mode: masterOrderId. In edit mode: batchOrderId
    mode?: 'create' | 'edit'      // Default 'create'
    batchData?: any | null        // Existing batch object in edit mode
    parentOrderId?: string | null // Master order id in edit mode
  }>(),
  {
    mode: 'create',
    batchData: null,
    parentOrderId: null
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'batchCreated', result: any): void
  (e: 'batchUpdated', result: any): void
}>()

const { showSaved, showError } = useSnackbar()
const { notifyChange } = useRealtimeSync()

const isLoading = ref(false)
const isSubmitting = ref(false)
const poolData = ref<any | null>(null)

interface BatchRow {
  orderItemId?: string
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
  maxQty: number
  batchQty: number
  isNewProduct?: boolean
}

const batchRows = ref<BatchRow[]>([])
const isOnHold = ref(false)
const batchNotes = ref('')
const customDeliveryAddress = ref('')
const selectedVehicleMode = ref<'OUR_FLEET' | 'PARTY_VEHICLE' | 'THIRD_PARTY'>('OUR_FLEET')

// Extra product addition state
const isAddingExtraProduct = ref(false)
const allProducts = ref<any[]>([])
const newProductSelection = ref({
  productId: '',
  unitPrice: 0,
  quantity: 1,
  discount: 0,
  taxRate: 18,
  isTaxInclusive: false
})

const productOptions = computed(() => {
  return allProducts.value.map(p => ({
    value: p.id,
    label: p.name,
    sku: p.sku || '',
    subtitle: `${p.brand || ''} ${p.thickness || ''}`.trim(),
    stock: p.stock ?? 0,
    unit: p.unit || 'pcs'
  }))
})

const fetchProducts = async () => {
  if (allProducts.value.length > 0) return
  try {
    const res = await $fetch<any[]>('/api/products')
    allProducts.value = res || []
  } catch (err) {
    console.error('Failed to load products:', err)
  }
}

// Fetch pool data and initialize batchRows
watch(() => [props.isOpen, props.orderId, props.mode], async ([open, id, mode]) => {
  if (open && id) {
    isLoading.value = true
    isAddingExtraProduct.value = false
    try {
      fetchProducts()
      const masterId = mode === 'edit'
        ? (props.parentOrderId || props.batchData?.parentOrderId || props.batchData?.parentOrder?.id || id)
        : id

      const data = await $fetch<any>(`/api/orders/${masterId}/pending-pool`)
      poolData.value = data

      if (mode === 'edit') {
        let b = props.batchData || {}
        if (!b.items || b.items.length === 0) {
          try {
            const fetched = await $fetch<any>(`/api/orders/${props.orderId}`)
            if (fetched) b = fetched
          } catch (e) {
            b = props.batchData || {}
          }
        }
        isOnHold.value = Boolean(b.isBatchOnHold)
        batchNotes.value = b.notes || ''
        customDeliveryAddress.value = b.deliveryAddress || data.deliveryAddress || ''
        selectedVehicleMode.value = (b.vehicleMode === 'PARTY_VEHICLE' || b.vehicleMode === 'THIRD_PARTY') 
          ? b.vehicleMode 
          : 'OUR_FLEET'

        const existingItems = b.items || []
        const matchedItemIds = new Set<string>()

        // 1. Map master order pool items
        const rows: BatchRow[] = (data.items || []).map((itm: any) => {
          const matched = existingItems.find((bi: any) => 
            (bi.productId && itm.productId && bi.productId === itm.productId) ||
            (bi.productName && itm.productName && bi.productName.trim().toLowerCase() === itm.productName.trim().toLowerCase())
          )

          const currentBatchQty = Number(matched?.quantity || 0)
          if (matched) matchedItemIds.add(matched.id || matched.productId)

          const otherBatchesQty = Math.max(0, Number(itm.batchedQty || 0) - currentBatchQty)
          const poolRemaining = Math.max(0, itm.orderedQty - otherBatchesQty - currentBatchQty)
          const maxAllowable = currentBatchQty + poolRemaining

          return {
            orderItemId: matched?.id,
            productId: itm.productId,
            productName: itm.productName,
            sku: itm.sku,
            unitPrice: Number(matched?.unitPrice ?? itm.unitPrice ?? 0),
            discount: Number(matched?.discount ?? itm.discount ?? 0),
            taxRate: Number(matched?.taxRate ?? itm.taxRate ?? 0),
            isTaxInclusive: Boolean(matched?.isTaxInclusive ?? itm.isTaxInclusive),
            orderedQty: itm.orderedQty,
            batchedQty: otherBatchesQty,
            pendingQty: poolRemaining,
            maxQty: maxAllowable,
            batchQty: currentBatchQty,
            isNewProduct: false
          }
        })

        // 2. Include any items in the batch that are NOT in the master pool (custom/added products)
        for (const bi of existingItems) {
          if (!matchedItemIds.has(bi.id || bi.productId)) {
            rows.push({
              orderItemId: bi.id,
              productId: bi.productId,
              productName: bi.product?.name || bi.productName || 'Added Item',
              sku: bi.product?.sku || bi.sku || '',
              unitPrice: Number(bi.unitPrice || 0),
              discount: Number(bi.discount || 0),
              taxRate: Number(bi.taxRate || 0),
              isTaxInclusive: Boolean(bi.isTaxInclusive),
              orderedQty: Number(bi.quantity || 0),
              batchedQty: 0,
              pendingQty: 0,
              maxQty: 99999,
              batchQty: Number(bi.quantity || 0),
              isNewProduct: true
            })
          }
        }

        batchRows.value = rows
      } else {
        // Create mode
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
          maxQty: itm.pendingQty,
          batchQty: itm.pendingQty,
          isNewProduct: false
        }))
      }
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

// Adjust quantities safely
const updateQty = (row: BatchRow, delta: number) => {
  const current = Number(row.batchQty || 0)
  const next = current + delta
  row.batchQty = Math.max(0, Math.min(row.maxQty, next))
}

const onQtyInput = (row: BatchRow, event: Event) => {
  const target = event.target as HTMLInputElement
  let val = parseInt(target.value, 10)
  if (isNaN(val) || val < 0) val = 0
  if (val > row.maxQty) val = row.maxQty
  row.batchQty = val
  target.value = String(val)
}

// Extra Product Handling
const onExtraProductSelect = (opt: any) => {
  if (!opt) return
  const prod = allProducts.value.find(p => p.id === opt.value)
  if (prod) {
    newProductSelection.value.unitPrice = Number(prod.basePrice || prod.price || 0)
  }
}

const addExtraProductToBatch = () => {
  if (!newProductSelection.value.productId) {
    alert('Please select a product.')
    return
  }
  if (newProductSelection.value.quantity <= 0) {
    alert('Please enter a valid quantity.')
    return
  }

  const prod = allProducts.value.find(p => p.id === newProductSelection.value.productId)
  batchRows.value.push({
    productId: newProductSelection.value.productId,
    productName: prod?.name || 'New Item',
    sku: prod?.sku || '',
    unitPrice: Number(newProductSelection.value.unitPrice || 0),
    discount: Number(newProductSelection.value.discount || 0),
    taxRate: Number(newProductSelection.value.taxRate || 18),
    isTaxInclusive: Boolean(newProductSelection.value.isTaxInclusive),
    orderedQty: newProductSelection.value.quantity,
    batchedQty: 0,
    pendingQty: 0,
    maxQty: 99999,
    batchQty: newProductSelection.value.quantity,
    isNewProduct: true
  })

  // Reset form
  newProductSelection.value = {
    productId: '',
    unitPrice: 0,
    quantity: 1,
    discount: 0,
    taxRate: 18,
    isTaxInclusive: false
  }
  isAddingExtraProduct.value = false
}

const removeExtraRow = (idx: number) => {
  batchRows.value.splice(idx, 1)
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
  if (props.mode === 'edit') {
    return batchRows.value
      .filter(r => !r.isNewProduct)
      .reduce((sum, r) => sum + Math.max(0, r.maxQty - r.batchQty), 0)
  }
  const totalPending = poolData.value?.totalPendingUnits || 0
  return Math.max(0, totalPending - totalBatchUnits.value)
})

const currentBatchNumber = computed(() => {
  if (props.mode === 'edit') {
    return props.batchData?.batchNumber || '1'
  }
  return poolData.value?.nextBatchNumber || 1
})

// Submit Batch Creation or Edit
const submitBatch = async () => {
  if (totalBatchUnits.value === 0) {
    alert('Please allocate at least 1 unit to this batch.')
    return
  }

  isSubmitting.value = true
  try {
    if (props.mode === 'edit') {
      const batchId = props.orderId || props.batchData?.id
      const payload = {
        notes: batchNotes.value,
        isOnHold: isOnHold.value,
        deliveryAddress: customDeliveryAddress.value,
        vehicleMode: selectedVehicleMode.value,
        items: batchRows.value
          .filter(r => r.batchQty > 0)
          .map(r => ({
            id: r.orderItemId,
            orderItemId: r.orderItemId,
            productId: r.productId,
            productName: r.productName,
            sku: r.sku,
            unitPrice: r.unitPrice,
            discount: r.discount,
            taxRate: r.taxRate,
            isTaxInclusive: r.isTaxInclusive,
            quantity: r.batchQty
          }))
      }

      const res = await $fetch<any>(`/api/orders/${batchId}`, {
        method: 'PATCH',
        body: payload
      })

      showSaved(`Batch ${currentBatchNumber.value} updated successfully!`)
      notifyChange({ action: 'BATCH_UPDATED', orderId: batchId })
      emit('batchUpdated', res)
      emit('batchCreated', res)
      emit('close')
    } else {
      // Create mode
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

      showSaved(res.message || `Batch ${currentBatchNumber.value} created successfully!`)
      notifyChange({ action: 'BATCH_CREATED', orderId: props.orderId || '' })
      emit('batchCreated', res)
      emit('close')
    }
  } catch (err: any) {
    console.error('Failed to save batch:', err)
    showError(err.data?.message || 'Failed to save fulfillment batch')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="isOpen" 
      data-modal-container="batch-modal"
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
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-[#faf8f5] shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center font-bold shrink-0">
                <Layers class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                    {{ mode === 'edit' ? 'Edit Fulfillment Batch' : 'Create Fulfillment Batch' }}
                  </h2>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-[#1b3b5f] text-white tracking-wider uppercase">
                    Batch {{ currentBatchNumber }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap truncate">
                  <span class="font-bold text-gray-900">{{ poolData.orderNumber }}</span>
                  <span>&bull;</span>
                  <span class="truncate">{{ poolData.customer?.company || poolData.customer?.name || 'Customer' }}</span>
                  <span>&bull;</span>
                  <span class="font-bold text-[#1b3b5f]">
                    {{ mode === 'edit' ? 'Adjusting allocation slice' : `${poolData.totalPendingUnits} pcs available` }}
                  </span>
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
              <span>Master Ordered: <strong class="text-gray-900 font-bold tabular-nums">{{ poolData.totalOrderedUnits }} pcs</strong></span>
              <span class="text-gray-300 hidden sm:inline">&bull;</span>
              <span>
                {{ mode === 'edit' ? 'Other Batches:' : 'Batched:' }}
                <strong class="text-[#1b3b5f] font-bold tabular-nums">
                  {{ mode === 'edit' ? Math.max(0, poolData.totalBatchedUnits - (props.batchData?.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)) : poolData.totalBatchedUnits }} pcs
                </strong>
              </span>
              <span class="text-gray-300 hidden sm:inline">&bull;</span>
              <span class="text-emerald-800 font-bold bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                {{ mode === 'edit' ? 'Live Pool Remaining:' : 'Available in Pool:' }} {{ remainingPoolAfterBatch }} pcs
              </span>
            </div>
            <span class="text-[11px] font-semibold text-[#1b3b5f] hidden md:inline-block">
              {{ mode === 'edit' ? 'Adjust batch quantities or add new items below' : 'Draw quantities for this fulfillment batch below' }}
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
                    <th class="p-3 text-center">{{ mode === 'edit' ? 'Other Batches' : 'Batched' }}</th>
                    <th class="p-3 text-center text-emerald-800 bg-emerald-50/50">{{ mode === 'edit' ? 'Max Available' : 'Available' }}</th>
                    <th class="p-3 text-center w-40 sm:w-48 bg-blue-50/40 text-[#1b3b5f]">This Batch Qty</th>
                    <th v-if="mode === 'edit'" class="p-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr 
                    v-for="(row, rIdx) in batchRows" 
                    :key="row.orderItemId || row.productId || rIdx"
                    class="hover:bg-gray-50/70 transition-colors"
                    :class="row.maxQty === 0 && row.batchQty === 0 ? 'bg-gray-50/80 opacity-60' : ''"
                  >
                    <!-- Product Info -->
                    <td class="p-3">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <p class="font-bold text-gray-900 leading-snug break-words whitespace-normal">{{ row.productName }}</p>
                        <span 
                          v-if="row.isNewProduct"
                          class="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-sky-100 text-sky-800 border border-sky-300 shrink-0"
                          title="New product will be added to this batch and automatically appended to the Master Order"
                        >
                          + Added to Master
                        </span>
                      </div>
                      <div class="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        <span v-if="row.sku" class="text-gray-600">{{ row.sku }}</span>
                        <span v-if="row.sku">&bull;</span>
                        <span class="font-semibold text-gray-700 tabular-nums">{{ formatCurrency(row.unitPrice) }}</span>
                      </div>
                    </td>

                    <!-- Total Ordered in Master -->
                    <td class="p-3 text-center font-semibold text-gray-700 tabular-nums">
                      {{ row.orderedQty }}
                    </td>

                    <!-- Already Batched in Other Batches -->
                    <td class="p-3 text-center font-semibold text-[#1b3b5f] tabular-nums">
                      {{ row.batchedQty }}
                    </td>

                    <!-- Available / Max allowable -->
                    <td class="p-3 text-center font-bold text-emerald-700 bg-emerald-50/30 tabular-nums">
                      {{ mode === 'edit' ? row.maxQty : row.pendingQty }}
                    </td>

                    <!-- Batch Quantity Stepper -->
                    <td class="p-3 text-center bg-blue-50/20">
                      <div v-if="row.maxQty > 0 || row.batchQty > 0" class="inline-flex items-center gap-1.5 justify-center">
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
                            :max="row.maxQty"
                            class="w-12 h-7 text-center font-bold text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f] border-x border-gray-200 tabular-nums"
                          />

                          <button 
                            type="button"
                            @click="updateQty(row, 1)"
                            :disabled="row.batchQty >= row.maxQty"
                            class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer active:scale-95 transition-all"
                            title="Increase quantity"
                          >
                            <Plus class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div v-else class="text-[11px] font-bold text-gray-400">
                        100% Fulfilled
                      </div>
                    </td>

                    <!-- Remove new row button (in edit mode) -->
                    <td v-if="mode === 'edit'" class="p-3 text-center">
                      <button
                        v-if="row.isNewProduct"
                        type="button"
                        @click="removeExtraRow(rIdx)"
                        class="p-1 text-gray-400 hover:text-red-600 rounded transition cursor-pointer"
                        title="Remove this extra product"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Add Item Not in Master Order Button & Inline Form -->
            <div class="p-3.5 bg-gray-50/80 rounded-xl border border-dashed border-gray-300 space-y-3">
              <div v-if="!isAddingExtraProduct" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Tag class="w-4 h-4 text-[#1b3b5f]" />
                  <span class="text-xs font-bold text-gray-800">Need to add another product to this batch?</span>
                  <span class="text-[10px] text-gray-500 hidden sm:inline">(Will automatically append to Master Order)</span>
                </div>
                <button
                  type="button"
                  @click="isAddingExtraProduct = true"
                  class="px-3 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Add Product to Batch</span>
                </button>
              </div>

              <!-- Inline Add Form -->
              <div v-else class="space-y-3 bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs">
                <div class="flex items-center justify-between pb-1.5 border-b border-gray-100">
                  <span class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Add Product (Will append to Master Order & Batch)
                  </span>
                  <button 
                    type="button" 
                    @click="isAddingExtraProduct = false" 
                    class="text-gray-400 hover:text-gray-600 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <!-- Product Selection -->
                  <div class="sm:col-span-2 space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">Select Product *</label>
                    <SearchCombobox
                      v-model="newProductSelection.productId"
                      :options="productOptions"
                      placeholder="Search product by name or SKU..."
                      @select="onExtraProductSelect"
                    />
                  </div>

                  <!-- Rate & Quantity -->
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase">Rate (₹) *</label>
                      <input 
                        v-model.number="newProductSelection.unitPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="w-full text-xs font-bold p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f] tabular-nums"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase">Qty (pcs) *</label>
                      <input 
                        v-model.number="newProductSelection.quantity"
                        type="number"
                        min="1"
                        placeholder="1"
                        class="w-full text-xs font-bold p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f] tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    @click="isAddingExtraProduct = false"
                    class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="addExtraProductToBatch"
                    class="px-4 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>Append to Batch</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Batch Hold Toggle & Transport Customization -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Active / On Hold Toggle -->
              <div 
                class="border rounded-xl p-3.5 transition-colors" 
                :class="isOnHold ? 'bg-amber-50/80 border-amber-300' : 'bg-gray-50/80 border-gray-200'"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-xs font-bold text-gray-900 cursor-pointer" @click="isOnHold = !isOnHold">
                      {{ isOnHold ? 'Batch is On Hold' : 'Batch is Active (Ready for Packing)' }}
                    </label>
                    <p class="text-[11px] text-gray-500 mt-0.5">
                      {{ isOnHold ? 'Paused from packing queue until released' : 'Moves to warehouse packing queue immediately' }}
                    </p>
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

              <!-- Transport Mode (Matching Order Creation) -->
              <div class="border border-gray-200 bg-gray-50/80 rounded-xl p-3.5 space-y-2">
                <label class="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Truck class="w-3.5 h-3.5 text-gray-500" />
                  <span>Transport Mode for this Batch</span>
                </label>
                <div class="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs select-none">
                  <button
                    type="button"
                    @click="selectedVehicleMode = 'OUR_FLEET'"
                    class="py-2.5 px-1 rounded-lg font-bold text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                    :class="selectedVehicleMode === 'OUR_FLEET'
                      ? 'bg-[#1b3b5f] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
                  >
                    <Truck class="w-4 h-4" />
                    <span class="text-[10px] leading-tight">Our Fleet</span>
                  </button>
                  <button
                    type="button"
                    @click="selectedVehicleMode = 'PARTY_VEHICLE'"
                    class="py-2.5 px-1 rounded-lg font-bold text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                    :class="selectedVehicleMode === 'PARTY_VEHICLE'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
                  >
                    <Car class="w-4 h-4" />
                    <span class="text-[10px] leading-tight">Party Vehicle</span>
                  </button>
                  <button
                    type="button"
                    @click="selectedVehicleMode = 'THIRD_PARTY'"
                    class="py-2.5 px-1 rounded-lg font-bold text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                    :class="selectedVehicleMode === 'THIRD_PARTY'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
                  >
                    <Package class="w-4 h-4" />
                    <span class="text-[10px] leading-tight">Third Party</span>
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
          <div class="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <!-- Left: Batch Allocation Preview (Done in 2 Lines) -->
            <div class="text-xs min-w-0 flex-1 leading-snug">
              <!-- Line 1: Batch Total & Amount -->
              <div class="truncate text-gray-700">
                <span class="text-gray-500 font-medium">Batch {{ currentBatchNumber }} Total: </span>
                <strong class="text-gray-950 font-extrabold tabular-nums">{{ totalBatchUnits }} pcs</strong>
                <span class="text-gray-300 mx-1">&bull;</span>
                <strong class="text-[#1b3b5f] font-black tabular-nums">{{ formatCurrency(totalBatchAmount) }}</strong>
              </div>
              <!-- Line 2: Pending Pool Remaining -->
              <div class="text-[11px] text-gray-500 mt-0.5 truncate">
                <span class="hidden sm:inline">{{ mode === 'edit' ? 'Units remaining in master pool:' : 'Pending pool after this batch:' }} </span>
                <span class="sm:hidden">{{ mode === 'edit' ? 'Pool remaining:' : 'Pending pool:' }} </span>
                <strong class="tabular-nums text-gray-800 font-bold">{{ remainingPoolAfterBatch }} pcs</strong>
              </div>
            </div>

            <!-- Right: Action Buttons (Cancel + Save/Create) -->
            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button 
                type="button"
                @click="closeModal" 
                :disabled="isSubmitting"
                class="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 rounded-xl text-xs font-bold disabled:opacity-50 transition cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button 
                type="button"
                @click="submitBatch" 
                :disabled="isSubmitting || totalBatchUnits === 0"
                class="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] active:bg-[#0e2035] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
                <template v-else>
                  <Save v-if="mode === 'edit'" class="w-3.5 h-3.5 shrink-0" />
                  <Plus v-else class="w-3.5 h-3.5 shrink-0" />
                </template>
                <span class="sm:hidden">{{ mode === 'edit' ? 'Save' : 'Create' }}</span>
                <span class="hidden sm:inline">{{ mode === 'edit' ? `Save Batch ${currentBatchNumber} Changes` : `Create Batch ${currentBatchNumber}` }}</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
