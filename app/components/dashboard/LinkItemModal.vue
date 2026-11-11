<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[370] flex items-center justify-center p-2 sm:p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeModal"></div>

      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[92vh] overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50/80 via-white to-blue-50/40 shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f] text-white flex items-center justify-center shadow-xs shrink-0">
              <Link2 class="w-5 h-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 truncate">
                <span>Link to Busy Product</span>
              </h2>
              <p class="text-xs text-gray-500 mt-0.5 truncate">
                Order <strong class="font-mono text-gray-800">{{ order?.orderNumber }}</strong>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              type="button" 
              @click="refreshProducts" 
              :disabled="isLoadingProducts"
              title="Refresh product catalog from Busy"
              class="p-2 text-gray-500 hover:text-[#1b3b5f] hover:bg-white rounded-lg border border-gray-200 transition cursor-pointer shadow-2xs flex items-center gap-1 text-xs font-semibold"
            >
              <RotateCw class="w-4 h-4" :class="{ 'animate-spin': isLoadingProducts }" />
              <span class="hidden sm:inline">Refresh Catalog</span>
            </button>
            <button 
              type="button" 
              @click="closeModal" 
              data-modal-close="true"
              title="Close (Esc)"
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          <!-- Current Unsynced Item Card -->
          <div class="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800">Current Item on Order</span>
              <span class="text-[9px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                Not in Busy
              </span>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-mono font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[11px]">
                  {{ item?.sku || 'NO-SKU' }}
                </span>
                <span class="font-extrabold text-sm text-gray-900 break-words">
                  {{ item?.productName || item?.name }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-gray-500 mt-1 flex-wrap text-[11px]">
                <span>Qty: <strong class="text-gray-800 font-bold">{{ item?.quantity }}</strong></span>
                <span>•</span>
                <span>Rate: <strong class="text-gray-800 font-bold">₹{{ Number(item?.unitPrice || 0).toLocaleString() }}</strong></span>
              </div>
            </div>
          </div>

          <!-- Advisory Notice in Plain English -->
          <div class="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
            <Info class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p class="text-[11px] leading-relaxed">
              Select the matching item from Busy below. Once linked, you will be able to generate the bill immediately.
            </p>
          </div>

          <!-- Product Picker -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Choose Busy Product *
            </label>
            <CustomSelect
              v-model="selectedProductId"
              :options="productOptions"
              searchable
              searchPlaceholder="Search product by SKU or name..."
              placeholder="Search & choose product..."
              class="w-full bg-white"
            />
          </div>

          <!-- Selected Product Preview -->
          <div v-if="chosenProduct" class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-150">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                <span>Selected Busy Product</span>
              </span>
              <span class="text-[9px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-300">
                Verified in Busy
              </span>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-mono font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[11px]">
                  {{ chosenProduct.sku }}
                </span>
                <span class="font-extrabold text-sm text-gray-900 break-words">
                  {{ chosenProduct.name }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-gray-600 mt-1 flex-wrap text-[11px]">
                <span v-if="chosenProduct.category?.name">{{ chosenProduct.category.name }} •</span>
                <span>Stock: <strong class="text-emerald-700 font-bold">{{ chosenProduct.stock ?? 0 }} {{ chosenProduct.unit || 'units' }}</strong></span>
                <span>•</span>
                <span>Tax: <strong>{{ chosenProduct.taxRate ?? 18 }}%</strong></span>
              </div>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span class="text-xs">{{ errorMessage }}</span>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="p-3.5 sm:p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5 shrink-0">
          <button 
            type="button" 
            @click="closeModal" 
            :disabled="isSubmitting"
            class="px-3.5 py-1.5 border border-gray-300 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition text-xs cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="submitLink" 
            :disabled="!selectedProductId || isSubmitting"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold shadow-md shadow-emerald-900/10 transition flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
            <Link2 v-else class="w-3.5 h-3.5" />
            <span>{{ isSubmitting ? 'Linking...' : 'Confirm & Link Product' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Link2, X, AlertCircle, Info, CheckCircle2, Loader2, RotateCw } from 'lucide-vue-next'
import CustomSelect from '~/components/ui/CustomSelect.vue'

const props = defineProps<{
  isOpen: boolean
  order: any
  item: any
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', val: boolean): void
  (e: 'close'): void
  (e: 'linked', updatedOrder: any): void
}>()

const productsList = ref<any[]>([])
const selectedProductId = ref('')
const isLoadingProducts = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

const fetchProducts = async (force = false) => {
  if (!force && productsList.value.length > 0) return
  isLoadingProducts.value = true
  try {
    const data = await $fetch<any[]>('/api/products')
    productsList.value = data || []
  } catch (err: any) {
    console.error('Failed to load products for linking:', err)
  } finally {
    isLoadingProducts.value = false
  }
}

const refreshProducts = () => {
  fetchProducts(true)
}

watch(() => props.isOpen, (open) => {
  if (open) {
    errorMessage.value = ''
    selectedProductId.value = ''
    fetchProducts(true)
  }
})

const productOptions = computed(() => {
  return productsList.value
    .filter(p => p.isBusySynced !== false) // Only verified Busy products
    .map(p => ({
      label: p.sku === p.name ? p.name : `${p.sku} - ${p.name}`,
      value: p.id,
      subtitle: `${p.category?.name || 'General'} • Stock: ${p.stock ?? 0} ${p.unit || ''}`
    }))
})

const chosenProduct = computed(() => {
  if (!selectedProductId.value) return null
  return productsList.value.find(p => p.id === selectedProductId.value) || null
})

const closeModal = () => {
  if (isSubmitting.value) return
  emit('update:isOpen', false)
  emit('close')
}

const submitLink = async () => {
  if (!props.order?.id || !props.item?.id || !selectedProductId.value) return

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const res = await $fetch<any>(`/api/orders/${props.order.id}/link-item`, {
      method: 'POST',
      body: {
        orderItemId: props.item.id,
        productId: selectedProductId.value
      }
    })

    if (res?.success && res?.order) {
      emit('linked', res.order)
      closeModal()
    } else {
      throw new Error(res?.error || 'Could not link product')
    }
  } catch (err: any) {
    console.error('Failed to link product:', err)
    errorMessage.value = err?.data?.message || err?.message || 'Failed to link item. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>
