<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { 
  RefreshCw, CheckCircle2, XCircle, Search, Package, AlertTriangle, 
  ChevronLeft, ChevronRight, X, Tag, Hash, Layers, IndianRupee, ShieldCheck
} from 'lucide-vue-next'
import { formatDateTime } from '~/lib/utils'

import { useGsapAnimation } from '~/composables/useGsapAnimation'

definePageMeta({ layout: 'dashboard' })

const { data: products, pending: productsLoading, refresh: refreshProducts } = useFetch('/api/products')
const { data: syncStatusData, refresh: refreshSyncStatus } = useFetch('/api/inventory/sync-status')
const { data: lastSyncedData, refresh: refreshLastSynced } = useFetch('/api/inventory/last-synced')

const { animateProgressBar, animateModalOpen, animateStagger, initContext } = useGsapAnimation()

const searchQuery = ref('')
const isSyncing = ref(false)
let pollingInterval: any = null

const tbodyRef = ref<HTMLElement | null>(null)

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tbodyRef.value) {
      const rows = tbodyRef.value.querySelectorAll('tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

// Selected product for detail popup
const selectedProduct = ref<any | null>(null)
const isDetailModalOpen = ref(false)
const modalRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
const progressBarRef = ref<HTMLElement | null>(null)

const openProductDetail = (product: any) => {
  selectedProduct.value = product
  isDetailModalOpen.value = true
  nextTick(() => {
    animateModalOpen(modalRef.value, backdropRef.value, { duration: 0.26 })
  })
}

const closeProductDetail = () => {
  isDetailModalOpen.value = false
  selectedProduct.value = null
}

// Watch sync progress updates and tween bar smoothly
watch(() => syncStatusData.value?.progress?.progress, (newVal) => {
  if (newVal !== undefined && progressBarRef.value) {
    animateProgressBar(progressBarRef.value, newVal, { duration: 0.4 })
  }
})

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)

// Computed filtering with multi-token fuzzy word matching
const filteredProducts = computed(() => {
  if (!products.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return products.value as any[]
  
  const terms = q.split(/\s+/).filter(Boolean)
  
  return (products.value as any[]).filter(p => {
    const searchableText = `${p.name || ''} ${p.sku || ''} ${p.hsnCode || ''} ${p.category?.name || ''}`.toLowerCase()
    return terms.every(term => searchableText.includes(term))
  })
})

watch(searchQuery, () => {
  currentPage.value = 1
})

const totalPages = computed(() => {
  if (pageSize.value === -1) return 1
  return Math.ceil(filteredProducts.value.length / pageSize.value) || 1
})

const paginatedProducts = computed(() => {
  if (pageSize.value === -1) return filteredProducts.value
  const start = (currentPage.value - 1) * pageSize.value
  return filteredProducts.value.slice(start, start + pageSize.value)
})

watch([paginatedProducts, productsLoading], () => {
  if (!productsLoading.value) {
    triggerRowAnimation()
  }
}, { immediate: false })

const startIndex = computed(() => {
  if (filteredProducts.value.length === 0) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const endIndex = computed(() => {
  if (pageSize.value === -1) return filteredProducts.value.length
  return Math.min(currentPage.value * pageSize.value, filteredProducts.value.length)
})

const requestSync = async () => {
  isSyncing.value = true
  try {
    await $fetch('/api/inventory/request-sync', { method: 'POST' })
    startPolling()
  } catch (e) {
    console.error('Failed to request sync:', e)
    isSyncing.value = false
    alert('Failed to request sync. Check permissions.')
  }
}

const cancelSync = async () => {
  try {
    await $fetch('/api/inventory/cancel-sync', { method: 'POST' })
    if (pollingInterval) clearInterval(pollingInterval)
    isSyncing.value = false
    await refreshSyncStatus()
  } catch (e) {
    console.error('Failed to cancel sync:', e)
  }
}

const startPolling = () => {
  if (pollingInterval) clearInterval(pollingInterval)
  
  const checkStatus = async () => {
    try {
      const liveData: any = await $fetch('/api/inventory/sync-status', {
        params: { t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' }
      })
      syncStatusData.value = liveData
      if (liveData?.syncRequested === false) {
        if (pollingInterval) clearInterval(pollingInterval)
        isSyncing.value = false
        await Promise.all([refreshProducts(), refreshLastSynced()])
      }
    } catch (e) {
      console.error('Polling error:', e)
    }
  }

  // Poll immediately, then every 700ms for instant real-time updates
  checkStatus()
  pollingInterval = setInterval(checkStatus, 700)
}

onMounted(() => {
  if (syncStatusData.value?.syncRequested) {
    isSyncing.value = true
    startPolling()
  }
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Package class="w-6 h-6 text-[#1a5c4c]" />
          Stock Status
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          Live inventory levels synced with Busy Accounting.
          <span v-if="lastSyncedData?.lastSynced" class="ml-1 text-[#1a5c4c] font-medium">
            Last synced: {{ formatDateTime(lastSyncedData.lastSynced) }}
          </span>
        </p>
      </div>

      <button 
        @click="(isSyncing || syncStatusData?.syncRequested) ? cancelSync() : requestSync()" 
        class="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap"
        :class="(isSyncing || syncStatusData?.syncRequested) ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1a5c4c] hover:bg-[#1a5c4c]/90'"
      >
        <RefreshCw v-if="!(isSyncing || syncStatusData?.syncRequested)" class="w-4 h-4" />
        <XCircle v-else class="w-4 h-4" />
        {{ (isSyncing || syncStatusData?.syncRequested) ? 'Cancel Sync' : 'Load Stock from Busy' }}
      </button>
    </div>

    <!-- Real-Time Sync Progress Modal Popup (Centered in Active Viewport Screen) -->
    <div 
      v-if="isSyncing || syncStatusData?.syncRequested" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <!-- Dark Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

      <!-- Centered Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <div class="w-14 h-14 rounded-2xl bg-[#1a5c4c]/10 text-[#1a5c4c] flex items-center justify-center mb-4 shadow-sm">
          <RefreshCw class="w-7 h-7 animate-spin" />
        </div>
        
        <h3 class="text-lg font-bold text-gray-900 leading-snug">
          {{ syncStatusData?.progress?.message || 'Syncing with Busy Accounting...' }}
        </h3>

        <!-- Step Pill Badge -->
        <div class="flex items-center gap-2 mt-2 mb-5">
          <span 
            v-if="syncStatusData?.progress?.step && syncStatusData?.progress?.totalSteps" 
            class="px-3 py-1 rounded-full text-xs font-semibold bg-[#1a5c4c]/10 text-[#1a5c4c] border border-[#1a5c4c]/20"
          >
            Step {{ syncStatusData.progress.step }} of {{ syncStatusData.progress.totalSteps }}
            <span class="text-gray-400 font-normal">({{ Math.max(0, syncStatusData.progress.totalSteps - syncStatusData.progress.step) }} steps remaining)</span>
          </span>
          <span v-else class="text-xs text-gray-500 font-medium">Connecting to Office PC automation worker...</span>
        </div>

        <!-- Liquid GSAP Progress Bar -->
        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-2 shadow-inner">
          <div 
            ref="progressBarRef"
            class="bg-gradient-to-r from-[#1a5c4c] to-[#4ecdc4] h-3 rounded-full transition-all duration-300 ease-out" 
            :style="{ width: `${syncStatusData?.progress?.progress || 10}%` }"
          ></div>
        </div>

        <div class="w-full flex justify-between text-xs text-gray-400 font-mono mb-6">
          <span>Overall Progress</span>
          <span class="font-bold text-[#1a5c4c]">{{ syncStatusData?.progress?.progress || 10 }}%</span>
        </div>

        <!-- Abort Button -->
        <button 
          @click="cancelSync" 
          class="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <XCircle class="w-4 h-4" />
          Cancel / Abort Sync
        </button>
      </div>
    </div>

    <!-- Main Content Card -->
    <div 
      class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
    >
      <!-- Toolbar -->
      <div class="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="relative w-full sm:w-80">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search items by name, SKU, HSN, group..."
            class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] bg-white"
          />
        </div>
        
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <div class="flex items-center gap-2">
            <span>Rows:</span>
            <select 
              v-model.number="pageSize" 
              @change="currentPage = 1"
              class="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-[#4ecdc4]"
            >
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
              <option :value="-1">All ({{ filteredProducts.length }})</option>
            </select>
          </div>
          <div>
            Total Items: <span class="font-bold text-gray-900">{{ filteredProducts.length }}</span>
          </div>
        </div>
      </div>

      <!-- Table Container -->
      <div class="overflow-x-auto relative min-h-[350px]">

        <!-- Localized Table Blur Loading Animation -->
        <Transition
          enter-active-class="transition-opacity duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div 
            v-if="productsLoading" 
            class="absolute inset-0 z-20 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
          >
            <div class="w-12 h-12 rounded-2xl bg-[#1a5c4c]/10 flex items-center justify-center text-[#1a5c4c] shadow-sm animate-pulse">
              <RefreshCw class="w-6 h-6 animate-spin text-[#1a5c4c]" />
            </div>
            <div class="flex flex-col items-center gap-0.5">
              <span class="text-sm font-semibold text-gray-800 tracking-tight">Loading Inventory...</span>
              <span class="text-xs text-gray-400">Fetching live stock from database</span>
            </div>
          </div>
        </Transition>

        <table class="w-full text-left border-collapse table-auto">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th class="px-5 py-3.5 w-44 min-w-[150px] max-w-[180px]">SKU / Code</th>
              <th class="px-5 py-3.5 min-w-[220px]">Item Name</th>
              <th class="px-5 py-3.5 w-44 min-w-[150px]">Group Name</th>
              <th class="px-5 py-3.5 w-28 min-w-[100px]">HSN Code</th>
              <th class="px-5 py-3.5 w-28 min-w-[100px] text-right">Stock</th>
              <th class="px-5 py-3.5 w-32 min-w-[120px] text-center">Status</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-100">
            <tr 
              v-for="product in paginatedProducts" 
              :key="product.id" 
              @click="openProductDetail(product)"
              class="hover:bg-teal-50/40 cursor-pointer transition-colors group"
            >
              <!-- SKU / Code: Fixed width, wraps to max 2 lines -->
              <td class="px-5 py-3 w-44 min-w-[150px] max-w-[180px] text-xs font-mono font-medium text-gray-900 group-hover:text-[#1a5c4c]">
                <span class="break-words line-clamp-2" :title="product.sku">
                  {{ product.sku }}
                </span>
              </td>

              <!-- Item Name -->
              <td class="px-5 py-3 min-w-[220px] text-sm text-gray-800 font-medium">
                <span class="break-words line-clamp-2 group-hover:text-[#1a5c4c] transition-colors" :title="product.name">
                  {{ product.name }}
                </span>
              </td>

              <!-- Group Name -->
              <td class="px-5 py-3 w-44 min-w-[150px] text-sm text-gray-500">
                <span class="truncate block max-w-[160px]" :title="product.category?.name">
                  {{ product.category?.name || '-' }}
                </span>
              </td>

              <!-- HSN Code -->
              <td class="px-5 py-3 w-28 min-w-[100px] text-xs font-mono text-gray-500 whitespace-nowrap">
                {{ product.hsnCode || '-' }}
              </td>

              <!-- Stock -->
              <td class="px-5 py-3 w-28 min-w-[100px] text-sm text-right font-bold whitespace-nowrap" :class="product.stock > 0 ? 'text-gray-900' : 'text-red-600'">
                {{ product.stock }}
              </td>

              <!-- Status -->
              <td class="px-5 py-3 w-32 min-w-[120px] text-center whitespace-nowrap">
                <span v-if="product.stock > 0" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  In Stock
                </span>
                <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                  <XCircle class="w-3.5 h-3.5" />
                  Out of Stock
                </span>
              </td>
            </tr>

            <tr v-if="filteredProducts.length === 0">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                <div class="flex flex-col items-center justify-center">
                  <AlertTriangle class="w-8 h-8 text-gray-400 mb-2" />
                  <p class="text-sm font-medium text-gray-900">No items found</p>
                  <p class="text-xs text-gray-500 mt-1">Try adjusting your search query.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div v-if="filteredProducts.length > 0 && pageSize !== -1" class="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="text-xs text-gray-500">
          Showing <span class="font-medium text-gray-900">{{ startIndex }}</span> to <span class="font-medium text-gray-900">{{ endIndex }}</span> of <span class="font-medium text-gray-900">{{ filteredProducts.length }}</span> items
        </div>

        <div class="flex items-center gap-2">
          <button 
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
            Previous
          </button>

          <span class="text-xs text-gray-600 px-2">
            Page <span class="font-semibold text-gray-900">{{ currentPage }}</span> of <span class="font-semibold text-gray-900">{{ totalPages }}</span>
          </span>

          <button 
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
          >
            Next
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Product Detail Modal Popup (Untruncated) -->
    <div 
      v-if="isDetailModalOpen && selectedProduct" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div 
        ref="backdropRef"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        @click="closeProductDetail"
      ></div>

      <!-- Modal Card -->
      <div 
        ref="modalRef"
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
      >
        <!-- Header -->
        <div class="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Package class="w-4 h-4 text-[#1a5c4c]" />
            Item Details
          </div>
          <button 
            @click="closeProductDetail" 
            class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
            title="Close"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- Full Untruncated Name -->
          <div>
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Product Description</span>
            <h2 class="text-xl font-bold text-gray-900 leading-snug break-words">
              {{ selectedProduct.name }}
            </h2>
          </div>

          <!-- Status & Quantity Banner -->
          <div class="p-4 rounded-xl flex items-center justify-between" :class="selectedProduct.stock > 0 ? 'bg-green-50/70 border border-green-100' : 'bg-red-50/70 border border-red-100'">
            <div>
              <span class="text-xs text-gray-500 block font-medium">Live Inventory</span>
              <div class="text-2xl font-bold mt-0.5" :class="selectedProduct.stock > 0 ? 'text-green-800' : 'text-red-700'">
                {{ selectedProduct.stock }} <span class="text-sm font-normal text-gray-600">{{ selectedProduct.unit || 'Units' }}</span>
              </div>
            </div>
            <div class="text-right">
              <span 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                :class="selectedProduct.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              >
                <CheckCircle2 v-if="selectedProduct.stock > 0" class="w-3.5 h-3.5" />
                <XCircle v-else class="w-3.5 h-3.5" />
                {{ selectedProduct.stock > 0 ? 'In Stock' : 'Out of Stock' }}
              </span>
            </div>
          </div>

          <!-- Details Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- SKU / Alias -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Hash class="w-3.5 h-3.5" />
                SKU / Item Code
              </div>
              <div class="font-mono text-sm font-semibold text-gray-900 break-all select-all">
                {{ selectedProduct.sku }}
              </div>
            </div>

            <!-- Group / Category -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Layers class="w-3.5 h-3.5" />
                Parent Group / Category
              </div>
              <div class="text-sm font-semibold text-gray-900 break-words">
                {{ selectedProduct.category?.name || 'General' }}
              </div>
            </div>

            <!-- HSN Code -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <ShieldCheck class="w-3.5 h-3.5" />
                HSN Code
              </div>
              <div class="font-mono text-sm font-semibold text-gray-900">
                {{ selectedProduct.hsnCode || 'Not Specified' }}
              </div>
            </div>

            <!-- Price -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <IndianRupee class="w-3.5 h-3.5" />
                Sale Price / Unit
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedProduct.price > 0 ? `₹${Number(selectedProduct.price).toLocaleString('en-IN')}` : 'Not Specified' }}
                <span v-if="selectedProduct.price > 0 && selectedProduct.unit" class="text-xs text-gray-500 font-normal">/ {{ selectedProduct.unit }}</span>
              </div>
            </div>

            <!-- GST Rate -->
            <div v-if="selectedProduct.taxRate" class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Tag class="w-3.5 h-3.5" />
                GST Tax Rate
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedProduct.taxRate }}%
              </div>
            </div>

            <!-- Measurement Unit -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Package class="w-3.5 h-3.5" />
                Measurement Unit
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedProduct.unit || 'PIECE' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex justify-end">
          <button 
            @click="closeProductDetail" 
            class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
