<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { 
  RefreshCw, CheckCircle2, XCircle, Search, Package, AlertTriangle, 
  ChevronLeft, ChevronRight, X, Tag, Hash, Layers, IndianRupee, ShieldCheck,
  ShoppingBag, Receipt, TrendingUp
} from 'lucide-vue-next'
import { formatDateTime } from '~/lib/utils'
import { useAuth } from '~/composables/useAuth'

import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
import LoadingTopBar from '~/components/ui/LoadingTopBar.vue'
import { rankProducts } from '~/utils/search'

definePageMeta({ layout: 'dashboard' })

const { data: products, pending: productsLoading, refresh: refreshProducts } = useFetch('/api/products')
const { data: syncStatusData, refresh: refreshSyncStatus } = useFetch('/api/inventory/sync-status')
const { data: lastSyncedData, refresh: refreshLastSynced } = useFetch('/api/inventory/last-synced')

const { animateProgressBar, animateModalOpen, animateStagger, initContext } = useGsapAnimation()
const { onOrderSync } = useRealtimeSync()

onOrderSync((event) => {
  if (
    event?.type === 'DB_PRODUCT_CHANGE' || 
    event?.type === 'PRODUCT_CHANGE' || 
    event?.type === 'DB_ORDER_ITEM_CHANGE' ||
    event?.action === 'PRODUCT_SAVED' ||
    event?.action === 'ORDER_CREATED' ||
    event?.action === 'PACKING_UPDATED'
  ) {
    // 
    refreshProducts()
  }
})

const searchQuery = ref('')
const isSyncing = ref(false)
let pollingInterval: any = null

const tbodyRef = ref<HTMLElement | null>(null)
const inventoryTableRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tbodyRef.value) {
      const rows = tbodyRef.value.querySelectorAll('tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
    if (mobileListRef.value) {
      const cards = Array.from(mobileListRef.value.children).slice(0, 15)
      animateStagger(cards, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

const { user } = useAuth()

// Selected product for detail popup
const selectedProduct = ref<any | null>(null)
const isDetailModalOpen = ref(false)
const modalRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
const progressBarRef = ref<HTMLElement | null>(null)

// Price & Transaction History (Admin only)
const priceHistory = ref<any>(null)
const loadingPriceHistory = ref(false)
const activePriceTab = ref<'purchases' | 'sales'>('purchases')

const formatShortDate = (dateVal: string | Date | null | undefined) => {
  if (!dateVal) return '-'
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fetchPriceHistory = async (productId: string) => {
  if (user.value?.role !== 'ADMIN') return
  loadingPriceHistory.value = true
  priceHistory.value = null
  try {
    const data: any = await $fetch(`/api/products/${productId}/price-history`)
    if (data?.success) {
      priceHistory.value = data
      if (data.purchases?.length === 0 && data.sales?.length > 0) {
        activePriceTab.value = 'sales'
      } else {
        activePriceTab.value = 'purchases'
      }
    }
  } catch (err) {
    console.error('Failed to load product price history:', err)
  } finally {
    loadingPriceHistory.value = false
  }
}

const openProductDetail = (product: any) => {
  selectedProduct.value = product
  isDetailModalOpen.value = true
  if (user.value?.role === 'ADMIN') {
    fetchPriceHistory(product.id)
  }
  nextTick(() => {
    animateModalOpen(modalRef.value, backdropRef.value, { duration: 0.26 })
  })
}

const closeProductDetail = () => {
  isDetailModalOpen.value = false
  selectedProduct.value = null
  priceHistory.value = null
  loadingPriceHistory.value = false
}

// Watch sync progress updates and tween bar smoothly
watch(() => syncStatusData.value?.progress?.progress, (newVal) => {
  if (newVal !== undefined && progressBarRef.value) {
    animateProgressBar(progressBarRef.value, newVal, { duration: 0.4 })
  }
})

const tableRootRef = ref<HTMLElement | null>(null)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)
const activeStockTab = ref<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL')

watch(currentPage, () => {
  nextTick(() => {
    tableRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

const tabCounts = computed(() => {
  if (!products.value) return { all: 0, inStock: 0, outOfStock: 0 }
  const list = products.value as any[]
  let inStock = 0
  let outOfStock = 0
  for (const p of list) {
    const qty = p.stock !== undefined ? p.stock : (p.stockQuantity || 0)
    if (qty > 0) inStock++
    else outOfStock++
  }
  return {
    all: list.length,
    inStock,
    outOfStock
  }
})

// Computed filtering with smart relevance ranking, tab filter, and exact-match prioritization
const filteredProducts = computed(() => {
  if (!products.value) return []
  let list = rankProducts(products.value as any[], searchQuery.value)
  if (activeStockTab.value === 'IN_STOCK') {
    list = list.filter((p: any) => (p.stock !== undefined ? p.stock : (p.stockQuantity || 0)) > 0)
  } else if (activeStockTab.value === 'OUT_OF_STOCK') {
    list = list.filter((p: any) => (p.stock !== undefined ? p.stock : (p.stockQuantity || 0)) <= 0)
  }
  return list
})

watch([searchQuery, activeStockTab], () => {
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
  <div class="max-w-7xl mx-auto space-y-5 sm:space-y-6 md:space-y-8 pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Package class="w-6 h-6 text-[#1b3b5f]" />
          Stock Status
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          Live inventory levels synced with Busy Accounting.
          <span v-if="lastSyncedData?.lastSynced" class="ml-1 text-[#1b3b5f] font-medium">
            Last synced: {{ formatDateTime(lastSyncedData.lastSynced) }}
          </span>
        </p>
      </div>
    </div>

    <!-- Real-Time Sync Progress Modal Popup (Centered in Active Viewport Screen) -->
    <Teleport to="body">
      <div 
        v-if="isSyncing || syncStatusData?.syncRequested" 
        class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] animate-in fade-in duration-200 overflow-y-auto"
      >
        <!-- Dark Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

        <!-- Centered Modal Card -->
        <div class="relative bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-gray-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          <div class="w-14 h-14 rounded-2xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center mb-4 shadow-sm">
            <RefreshCw class="w-7 h-7 animate-spin" />
          </div>
          
          <h3 class="text-lg font-bold text-gray-900 leading-snug">
            {{ syncStatusData?.progress?.message || 'Syncing with Busy Accounting...' }}
          </h3>

          <!-- Step Pill Badge -->
          <div class="flex items-center gap-2 mt-2 mb-5">
            <span 
              v-if="syncStatusData?.progress?.step && syncStatusData?.progress?.totalSteps" 
              class="px-3 py-1 rounded-full text-xs font-semibold bg-[#1b3b5f]/10 text-[#1b3b5f] border border-[#1b3b5f]/20"
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
              class="bg-gradient-to-r from-[#1b3b5f] to-[#4ecdc4] h-3 rounded-full transition-all duration-300 ease-out" 
              :style="{ width: `${syncStatusData?.progress?.progress || 10}%` }"
            ></div>
          </div>

          <div class="w-full flex justify-between text-xs text-gray-400 font-mono mb-6">
            <span>Overall Progress</span>
            <span class="font-bold text-[#1b3b5f]">{{ syncStatusData?.progress?.progress || 10 }}%</span>
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
    </Teleport>

    <!-- Tab Filters: All items / In stock / Out of stock -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in (['ALL', 'IN_STOCK', 'OUT_OF_STOCK'] as const)" 
          :key="tab"
          @click="activeStockTab = tab; currentPage = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
          :class="activeStockTab === tab ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          <span>{{ tab === 'ALL' ? 'All Items' : tab === 'IN_STOCK' ? 'In Stock' : 'Out of Stock' }}</span>
          <span 
            class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
            :class="[
              activeStockTab === tab
                ? (tab === 'OUT_OF_STOCK' ? 'bg-rose-100 text-rose-700' : tab === 'IN_STOCK' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#1b3b5f]/10 text-[#1b3b5f]')
                : 'bg-gray-100 text-gray-600'
            ]"
          >
            {{ tab === 'ALL' ? tabCounts.all : tab === 'IN_STOCK' ? tabCounts.inStock : tabCounts.outOfStock }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Main Content Card -->
    <div 
      ref="tableRootRef"
      class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
    >
      <!-- Toolbar -->
      <div class="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="relative w-full sm:w-80">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search items by name, alias, group..."
            class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] bg-white"
          />
        </div>
        
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <div class="flex items-center gap-2">
            <span>Rows:</span>
            <RowsPerPageSelect 
              :modelValue="pageSize" 
              @update:modelValue="val => { pageSize = val; currentPage = 1 }"
              :options="[10, 20, 50, -1]"
            />
          </div>
          <div>
            Total Items: <span class="font-bold text-gray-900">{{ filteredProducts.length }}</span>
          </div>
        </div>
      </div>

      <!-- Table Container -->
      <div ref="inventoryTableRef" class="hidden md:block overflow-x-auto no-scrollbar relative min-h-[350px]">
        <LoadingTopBar :loading="productsLoading || isSyncing" />

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
            <div class="w-12 h-12 rounded-2xl bg-[#1b3b5f]/10 flex items-center justify-center text-[#1b3b5f] shadow-sm animate-pulse">
              <RefreshCw class="w-6 h-6 animate-spin text-[#1b3b5f]" />
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
              <th class="px-5 py-3.5 min-w-[220px]">Item Name</th>
              <th class="px-5 py-3.5 w-44 min-w-[150px]">Group Name</th>
              <th class="px-5 py-3.5 w-44 min-w-[150px] max-w-[180px]">Product Alias</th>
              <th class="px-5 py-3.5 w-28 min-w-[100px] text-right">Stock</th>
              <th class="px-5 py-3.5 w-32 min-w-[120px] text-center">Status</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-100">
            <TableSkeletonRows v-if="productsLoading && paginatedProducts.length === 0" :rows="6" :cols="5" />

            <template v-else>
              <tr 
                v-for="product in paginatedProducts" 
                :key="product.id" 
                @click="openProductDetail(product)"
                class="hover:bg-[#1b3b5f]/5 cursor-pointer transition-colors group"
              >
              <!-- Item Name -->
              <td class="px-5 py-3 min-w-[220px] text-sm text-gray-800 font-medium">
                <span class="break-words line-clamp-2 group-hover:text-[#1b3b5f] transition-colors" :title="product.name">
                  {{ product.name }}
                </span>
              </td>

              <!-- Group Name -->
              <td class="px-5 py-3 w-44 min-w-[150px] text-sm text-gray-500">
                <span class="truncate block max-w-[160px]" :title="product.category?.name">
                  {{ product.category?.name || '-' }}
                </span>
              </td>

              <!-- Product Alias: Show only if exists and not identical to item name -->
              <td class="px-5 py-3 w-44 min-w-[150px] max-w-[180px] text-xs font-mono font-medium group-hover:text-[#1b3b5f]">
                <span 
                  v-if="product.sku && product.sku !== product.name" 
                  class="break-words line-clamp-2 text-gray-900" 
                  :title="product.sku"
                >
                  {{ product.sku }}
                </span>
                <span v-else class="text-gray-400 font-sans">-</span>
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
              <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                <div class="flex flex-col items-center justify-center">
                  <AlertTriangle class="w-8 h-8 text-gray-400 mb-2" />
                  <p class="text-sm font-medium text-gray-900">No items found</p>
                  <p class="text-xs text-gray-500 mt-1">Try adjusting your search query.</p>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="inventoryTableRef" />

      <!-- MOBILE VIEW: High-Density Inventory Stock Cards (md:hidden) -->
      <div ref="mobileListRef" class="md:hidden divide-y divide-gray-100 bg-white relative min-h-[250px]">
        <TableSkeletonRows v-if="productsLoading && paginatedProducts.length === 0" :rows="5" :cols="1" isMobile />

        <!-- Localized Mobile Blur Loading Animation -->
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
            class="absolute inset-0 z-20 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 py-16"
          >
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 flex items-center justify-center text-[#1b3b5f] shadow-sm animate-pulse">
              <RefreshCw class="w-5 h-5 animate-spin text-[#1b3b5f]" />
            </div>
            <span class="text-xs font-semibold text-gray-700">Loading Inventory...</span>
          </div>
        </Transition>

        <div v-if="filteredProducts.length === 0" class="p-8 text-center text-sm text-gray-500">
          <AlertTriangle class="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p class="font-medium text-gray-900">No items found</p>
          <p class="text-xs text-gray-500 mt-0.5">Try adjusting your search query.</p>
        </div>

        <div 
          v-for="product in paginatedProducts" 
          :key="'mob-inv-' + product.id"
          @click="openProductDetail(product)"
          class="p-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer flex items-start justify-between gap-3"
        >
          <!-- Left Column: Alias, Group, Item Name -->
          <div class="flex-1 min-w-0 space-y-1">
            <!-- Product Alias Tag (Only when distinct from item name) -->
            <div v-if="product.sku && product.sku !== product.name" class="flex items-center">
              <span class="text-xs font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                {{ product.sku }}
              </span>
            </div>

            <!-- Category / Group Name -->
            <div v-if="product.category?.name" class="flex items-center">
              <span class="text-[10px] font-semibold text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200/80">
                {{ product.category.name }}
              </span>
            </div>

            <!-- Item Name -->
            <h3 class="text-sm font-semibold text-gray-900 leading-snug break-words">
              {{ product.name }}
            </h3>
          </div>

          <!-- Right Column: In Stock badge, Quantity right below it -->
          <div class="flex flex-col items-end shrink-0 space-y-1.5 text-right pl-2">
            <!-- In Stock / Out of Stock badge -->
            <span 
              v-if="product.stock > 0" 
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200"
            >
              <CheckCircle2 class="w-3 h-3 text-green-600" />
              <span>In Stock</span>
            </span>
            <span 
              v-else 
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200"
            >
              <XCircle class="w-3 h-3 text-red-600" />
              <span>Out of Stock</span>
            </span>

            <!-- Quantity Number & Unit right below the badge -->
            <div 
              class="text-sm font-bold tabular-nums"
              :class="product.stock > 0 ? (product.stock < 10 ? 'text-amber-600' : 'text-gray-900') : 'text-rose-600'"
            >
              {{ product.stock }} <span class="text-xs font-semibold text-gray-500">{{ product.unit || '' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div v-if="filteredProducts.length > 0 && pageSize !== -1" class="p-3 sm:p-4 border-t border-gray-200 bg-white rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        <p class="text-[11px] sm:text-xs text-gray-500 whitespace-nowrap text-center sm:text-left">
          Showing <span class="font-medium text-gray-900">{{ startIndex }}</span> to <span class="font-medium text-gray-900">{{ endIndex }}</span> of <span class="font-medium text-gray-900">{{ filteredProducts.length }}</span> items
        </p>

        <div class="flex items-center justify-center gap-1.5 sm:gap-2">
          <button 
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage === 1"
            class="p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
            title="Previous Page"
          >
            <ChevronLeft class="w-4 h-4" />
            <span class="hidden sm:inline">Previous</span>
          </button>

          <span class="text-xs font-medium text-gray-700 px-1">
            {{ currentPage }} / {{ totalPages }}
          </span>

          <button 
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
            title="Next Page"
          >
            <span class="hidden sm:inline">Next</span>
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Product Detail Modal Popup (Untruncated) -->
    <Teleport to="body">
      <div 
        v-if="isDetailModalOpen && selectedProduct" 
        class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto"
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
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl sm:max-w-3xl max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] md:max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
      >
        <!-- Header -->
        <div class="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Package class="w-4 h-4 text-[#1b3b5f]" />
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
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
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
            <!-- Product Alias -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Hash class="w-3.5 h-3.5" />
                Product Alias
              </div>
              <div class="font-mono text-sm font-semibold text-gray-900 break-all select-all">
                {{ (selectedProduct.sku && selectedProduct.sku !== selectedProduct.name) ? selectedProduct.sku : 'None' }}
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

          <!-- ADMIN ONLY: Price Check & Transaction History -->
          <div v-if="user?.role === 'ADMIN'" class="pt-3 border-t border-gray-200/80 space-y-3.5">
            <!-- Section Title -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-md bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center">
                  <ShieldCheck class="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                    Price Check & Transaction History
                    <span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">ADMIN ONLY</span>
                  </h3>
                </div>
              </div>
              <span v-if="loadingPriceHistory" class="text-[11px] text-gray-400 flex items-center gap-1">
                <RefreshCw class="w-3 h-3 animate-spin text-sky-500" />
                Fetching BUSY rates...
              </span>
            </div>

            <!-- Loading Shimmer -->
            <div v-if="loadingPriceHistory" class="space-y-2.5">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div class="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                <div class="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                <div class="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
              </div>
              <div class="h-28 bg-gray-100 rounded-xl animate-pulse"></div>
            </div>

            <!-- Loaded Price Intelligence -->
            <div v-else-if="priceHistory" class="space-y-3">
              <!-- 3 Quick KPI Price Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <!-- 1. Last Purchase Rate (Buying Cost) -->
                <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
                  <div class="flex items-center justify-between text-[11px] text-amber-900 font-semibold">
                    <span class="flex items-center gap-1"><ShoppingBag class="w-3 h-3 text-amber-700" /> Last Purchase Rate</span>
                    <span v-if="priceHistory.summary?.lastPurchase" class="text-[10px] text-amber-700 font-normal">
                      {{ formatShortDate(priceHistory.summary.lastPurchase.voucherDate) }}
                    </span>
                  </div>
                  <div class="mt-1.5">
                    <div v-if="priceHistory.summary?.lastPurchase" class="text-base sm:text-lg font-extrabold text-amber-950 leading-tight">
                      ₹{{ Number(priceHistory.summary.lastPurchase.rate).toLocaleString('en-IN') }}
                      <span class="text-[10px] font-normal text-amber-700">/ {{ selectedProduct.unit || 'unit' }}</span>
                    </div>
                    <div v-else class="text-xs text-amber-700/80 font-medium italic">
                      No purchase bill yet
                    </div>
                    <div v-if="priceHistory.summary?.lastPurchase" class="text-[10px] text-amber-800 truncate mt-0.5" :title="priceHistory.summary.lastPurchase.supplierName">
                      From {{ priceHistory.summary.lastPurchase.supplierName }}
                    </div>
                  </div>
                </div>

                <!-- 2. Last Sold Rate (Selling Price) -->
                <div class="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 flex flex-col justify-between">
                  <div class="flex items-center justify-between text-[11px] text-sky-900 font-semibold">
                    <span class="flex items-center gap-1"><Receipt class="w-3 h-3 text-sky-700" /> Last Sold Rate</span>
                    <span v-if="priceHistory.summary?.lastSale" class="text-[10px] text-sky-700 font-normal">
                      {{ formatShortDate(priceHistory.summary.lastSale.voucherDate) }}
                    </span>
                  </div>
                  <div class="mt-1.5">
                    <div v-if="priceHistory.summary?.lastSale" class="text-base sm:text-lg font-extrabold text-sky-950 leading-tight">
                      ₹{{ Number(priceHistory.summary.lastSale.rate).toLocaleString('en-IN') }}
                      <span class="text-[10px] font-normal text-sky-700">/ {{ selectedProduct.unit || 'unit' }}</span>
                    </div>
                    <div v-else class="text-xs text-sky-700/80 font-medium italic">
                      No sales invoice yet
                    </div>
                    <div v-if="priceHistory.summary?.lastSale" class="text-[10px] text-sky-800 truncate mt-0.5" :title="priceHistory.summary.lastSale.customerName">
                      To {{ priceHistory.summary.lastSale.customerName }}
                    </div>
                  </div>
                </div>

                <!-- 3. Margin Spread -->
                <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
                  <div class="flex items-center justify-between text-[11px] text-emerald-900 font-semibold">
                    <span class="flex items-center gap-1"><TrendingUp class="w-3 h-3 text-emerald-700" /> Margin / Spread</span>
                    <span v-if="priceHistory.summary?.marginPercent !== null" class="px-1.5 py-0.2 rounded-full text-[9px] font-bold" :class="priceHistory.summary.marginAmount >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">
                      {{ priceHistory.summary.marginAmount >= 0 ? '+' : '' }}{{ priceHistory.summary.marginPercent }}%
                    </span>
                  </div>
                  <div class="mt-1.5">
                    <div v-if="priceHistory.summary?.marginAmount !== null" class="text-base sm:text-lg font-extrabold leading-tight" :class="priceHistory.summary.marginAmount >= 0 ? 'text-emerald-950' : 'text-red-700'">
                      {{ priceHistory.summary.marginAmount >= 0 ? '+' : '' }}₹{{ Number(priceHistory.summary.marginAmount).toLocaleString('en-IN') }}
                      <span class="text-[10px] font-normal text-emerald-700">/ unit</span>
                    </div>
                    <div v-else class="text-xs text-emerald-700/80 font-medium italic">
                      Requires purchase & sale
                    </div>
                    <div class="text-[10px] text-emerald-800/80 mt-0.5">
                      {{ priceHistory.summary?.marginAmount >= 0 ? 'Gross profit spread' : 'Negative markup' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sub-Tab Switcher: Purchases vs Sales -->
              <div class="flex items-center gap-2 border-b border-gray-200 pt-1">
                <button 
                  type="button"
                  @click="activePriceTab = 'purchases'"
                  class="pb-2 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer"
                  :class="activePriceTab === 'purchases' ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-800'"
                >
                  <ShoppingBag class="w-3.5 h-3.5 text-amber-600" />
                  <span>Recent Purchases (Vendor Bills)</span>
                  <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" :class="activePriceTab === 'purchases' ? 'bg-[#1b3b5f] text-white' : 'bg-gray-100 text-gray-600'">
                    {{ priceHistory.purchases?.length || 0 }}
                  </span>
                </button>
                <button 
                  type="button"
                  @click="activePriceTab = 'sales'"
                  class="pb-2 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 cursor-pointer"
                  :class="activePriceTab === 'sales' ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-800'"
                >
                  <Receipt class="w-3.5 h-3.5 text-sky-600" />
                  <span>Recent Sales (Customer Invoices)</span>
                  <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" :class="activePriceTab === 'sales' ? 'bg-[#1b3b5f] text-white' : 'bg-gray-100 text-gray-600'">
                    {{ priceHistory.sales?.length || 0 }}
                  </span>
                </button>
              </div>

              <!-- Purchases Table -->
              <div v-if="activePriceTab === 'purchases'">
                <div v-if="priceHistory.purchases?.length > 0" class="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-amber-50/40 text-gray-600 text-[10px] font-bold uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th class="px-3 py-2.5">Date</th>
                        <th class="px-3 py-2.5">Supplier Name</th>
                        <th class="px-3 py-2.5">Bill #</th>
                        <th class="px-3 py-2.5 text-right">Qty</th>
                        <th class="px-3 py-2.5 text-right font-bold text-amber-950">Buying Rate</th>
                        <th class="px-3 py-2.5 text-right">Bill Total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="(p, idx) in priceHistory.purchases" :key="'ph-p-' + idx" class="hover:bg-amber-50/30 transition-colors">
                        <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ formatShortDate(p.voucherDate) }}</td>
                        <td class="px-3 py-2 font-medium text-gray-900 max-w-[170px] truncate" :title="p.supplierName">{{ p.supplierName }}</td>
                        <td class="px-3 py-2 text-gray-500 font-mono text-[11px]">{{ p.voucherNo }}</td>
                        <td class="px-3 py-2 text-right text-gray-700 font-semibold">{{ p.qty }}</td>
                        <td class="px-3 py-2 text-right font-bold text-amber-900 whitespace-nowrap">₹{{ Number(p.rate).toLocaleString('en-IN') }}</td>
                        <td class="px-3 py-2 text-right text-gray-500 font-mono text-[11px]">₹{{ Number(p.amount).toLocaleString('en-IN') }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="text-center py-6 px-4 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                  <ShoppingBag class="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                  <p class="text-xs font-semibold text-gray-600">No BUSY Purchase Bills Found</p>
                  <p class="text-[11px] text-gray-400 mt-0.5">No vendor bills recorded in BUSY for this item.</p>
                </div>
              </div>

              <!-- Sales Table -->
              <div v-if="activePriceTab === 'sales'">
                <div v-if="priceHistory.sales?.length > 0" class="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-sky-50/40 text-gray-600 text-[10px] font-bold uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th class="px-3 py-2.5">Date</th>
                        <th class="px-3 py-2.5">Customer Name</th>
                        <th class="px-3 py-2.5">Invoice #</th>
                        <th class="px-3 py-2.5 text-right">Qty</th>
                        <th class="px-3 py-2.5 text-right font-bold text-sky-950">Sold Rate</th>
                        <th class="px-3 py-2.5 text-right">Inv Total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="(s, idx) in priceHistory.sales" :key="'ph-s-' + idx" class="hover:bg-sky-50/30 transition-colors">
                        <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ formatShortDate(s.voucherDate) }}</td>
                        <td class="px-3 py-2 font-medium text-gray-900 max-w-[170px] truncate" :title="s.customerName">{{ s.customerName }}</td>
                        <td class="px-3 py-2 text-gray-500 font-mono text-[11px]">{{ s.voucherNo }}</td>
                        <td class="px-3 py-2 text-right text-gray-700 font-semibold">{{ s.qty }}</td>
                        <td class="px-3 py-2 text-right font-bold text-sky-900 whitespace-nowrap">₹{{ Number(s.rate).toLocaleString('en-IN') }}</td>
                        <td class="px-3 py-2 text-right text-gray-500 font-mono text-[11px]">₹{{ Number(s.amount).toLocaleString('en-IN') }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="text-center py-6 px-4 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                  <Receipt class="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                  <p class="text-xs font-semibold text-gray-600">No BUSY Sales Invoices Found</p>
                  <p class="text-[11px] text-gray-400 mt-0.5">No customer invoices recorded in BUSY for this item.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex justify-end shrink-0">
          <button 
            @click="closeProductDetail" 
            class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </Teleport>

  </div>
</template>
