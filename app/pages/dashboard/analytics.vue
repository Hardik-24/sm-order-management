<template>
  <div class="space-y-6 max-w-[1600px] mx-auto pb-12">
    <!-- Header with Title & Refresh Action -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Analytics & Insights</h1>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live BUSY Data
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          Real-time inventory valuation, stock health risk matrix, and customer distribution
        </p>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400 hidden sm:inline" v-if="lastRefreshed">
          Updated {{ lastRefreshed }}
        </span>
        <button
          @click="fetchAnalytics"
          :disabled="loading"
          class="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all duration-200 disabled:opacity-60 active:scale-95"
        >
          <RefreshCw class="w-4 h-4 text-gray-500" :class="{ 'animate-spin': loading }" />
          <span>{{ loading ? 'Updating...' : 'Refresh' }}</span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
      <AlertCircle class="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div class="flex-1 text-sm">
        <p class="font-medium">Failed to load analytics</p>
        <p class="mt-0.5 text-red-700">{{ error }}</p>
      </div>
      <button @click="fetchAnalytics" class="text-xs font-semibold text-red-700 underline hover:text-red-900">Try again</button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      <div v-for="i in 4" :key="i" class="h-32 bg-gray-200/70 rounded-2xl"></div>
    </div>

    <!-- Executive KPI Ribbon (4 Main Cards) -->
    <div v-if="data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 1. Total Inventory Valuation -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Warehouse Stock Value</span>
          <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <IndianRupee class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {{ formatCrores(data.inventory.totalInventoryValue) }}
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span>{{ formatCurrency(data.inventory.totalInventoryValue) }}</span>
            <span class="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              Active Capital
            </span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
      </div>

      <!-- 2. Stock Availability & Active SKUs -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Stock Availability</span>
          <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Boxes class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {{ formatNumber(data.inventory.inStockCount) }} <span class="text-sm font-medium text-gray-400">/ {{ formatNumber(data.inventory.totalProducts) }} SKUs</span>
          </div>
          <!-- Progress bar -->
          <div class="mt-2.5 w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
            <div 
              class="bg-emerald-500 h-full transition-all duration-500" 
              :style="{ width: inStockPercentage + '%' }" 
              title="In Stock"
            ></div>
            <div 
              class="bg-amber-400 h-full transition-all duration-500" 
              :style="{ width: lowStockPercentage + '%' }" 
              title="Low Stock"
            ></div>
            <div 
              class="bg-rose-400 h-full transition-all duration-500" 
              :style="{ width: negativeStockPercentage + '%' }" 
              title="Negative Stock"
            ></div>
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span class="text-emerald-700 font-medium">{{ inStockPercentage }}% In Stock</span>
            <span>{{ data.inventory.zeroStockCount }} Out of Stock</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
      </div>

      <!-- 3. Customer Base & GST Verification -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">B2B Customer Accounts</span>
          <div class="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Users class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {{ formatNumber(data.customers.total) }}
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span class="inline-flex items-center gap-1 text-sky-700 font-medium">
              <CheckCircle class="w-3.5 h-3.5 text-sky-500" />
              {{ data.customers.gstRegistered }} GST Registered
            </span>
            <span class="text-gray-400">{{ gstRatio }}% verified</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-sky-500"></div>
      </div>

      <!-- 4. Stock Risk & Audit Alerts -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Stock Risk Watchlist</span>
          <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <AlertTriangle class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="flex items-baseline gap-2">
            <span class="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
              {{ data.inventory.negativeStockCount }}
            </span>
            <span class="text-xs text-rose-600/80 font-medium uppercase tracking-wide">Negative Stock</span>
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span class="text-amber-700 font-medium">{{ data.inventory.lowStockCount }} items below reorder level (&le;10)</span>
            <span class="text-rose-600 font-medium cursor-pointer hover:underline" @click="activeTab = 'negative'">Inspect &rarr;</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-rose-500"></div>
      </div>
    </div>

    <!-- Main Content Section: Category Breakdown + Interactive Tables -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Category Capital Allocation (Left 5 Cols) -->
      <div class="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col">
        <div class="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 class="text-base font-bold text-gray-900">Capital by Category</h2>
            <p class="text-xs text-gray-500 mt-0.5">Top product categories holding warehouse valuation</p>
          </div>
          <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
            {{ data.inventory.categories.length }} Categories
          </span>
        </div>

        <!-- Category Horizontal Bars -->
        <div class="space-y-3.5 mt-5 flex-1 overflow-y-auto max-h-[500px] pr-1">
          <div 
            v-for="(cat, idx) in data.inventory.categories" 
            :key="cat.name"
            class="group p-2.5 rounded-xl hover:bg-gray-50/80 transition-colors border border-transparent hover:border-gray-100 cursor-pointer"
            @click="filterByCategory(cat.name)"
          >
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="font-semibold text-gray-800 flex items-center gap-2 truncate max-w-[220px]">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="getCategoryColorClass(idx)"></span>
                <span class="truncate">{{ cat.name }}</span>
              </span>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-bold text-gray-900">{{ formatCurrency(cat.totalValue) }}</span>
                <span class="text-[11px] text-gray-400">({{ getCategoryPercentage(cat.totalValue) }}%)</span>
              </div>
            </div>

            <!-- Bar -->
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-700" 
                :class="getCategoryBarColor(idx)"
                :style="{ width: getCategoryPercentage(cat.totalValue) + '%' }"
              ></div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-gray-400 mt-1">
              <span>{{ formatNumber(cat.productCount) }} SKUs</span>
              <span>{{ formatNumber(cat.totalUnits) }} Units in Stock</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Data Explorer (Right 7 Cols) -->
      <div class="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col">
        <!-- Tabs Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl w-fit">
            <button
              @click="activeTab = 'top'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              :class="activeTab === 'top' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            >
              Top Capital
            </button>
            <button
              @click="activeTab = 'low'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
              :class="activeTab === 'low' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            >
              <span>Low Stock</span>
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            </button>
            <button
              @click="activeTab = 'negative'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
              :class="activeTab === 'negative' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            >
              <span>Negative Stock</span>
              <span class="w-2 h-2 rounded-full bg-rose-500"></span>
            </button>
            <button
              @click="activeTab = 'customers'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              :class="activeTab === 'customers' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            >
              City Clusters
            </button>
          </div>

          <!-- Search Filter -->
          <div class="relative w-full sm:w-56" v-if="activeTab !== 'customers'">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search table..."
              class="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <!-- TAB 1: Top Capital-Heavy Products -->
        <div v-if="activeTab === 'top'" class="mt-4 flex-1 overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Product / SKU</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Rate</th>
                <th class="py-2.5 font-medium text-right">Stock</th>
                <th class="py-2.5 font-medium text-right">Total Value</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="p in filteredTopProducts" 
                :key="p.id"
                class="hover:bg-gray-50/80 transition-colors"
              >
                <td class="py-3 pr-2">
                  <div class="font-semibold text-gray-900 truncate max-w-[200px]" :title="p.name">{{ p.name }}</div>
                  <div class="text-[11px] text-gray-400 truncate max-w-[180px]">{{ p.sku !== p.name ? p.sku : '' }}</div>
                </td>
                <td class="py-3 px-2 text-gray-600">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right text-gray-700 font-medium">{{ formatCurrency(p.price) }}</td>
                <td class="py-3 px-2 text-right">
                  <span class="font-bold text-gray-900">{{ formatNumber(p.stock) }}</span>
                </td>
                <td class="py-3 pl-2 text-right font-extrabold text-gray-900">
                  {{ formatCurrency(p.totalValue) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 2: Low Stock Alerts -->
        <div v-if="activeTab === 'low'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3 mb-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-800 flex items-center justify-between">
            <span class="font-medium">Products with &le; 10 units in warehouse (Reorder candidates)</span>
            <span class="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">{{ data.inventory.lowStockItems.length }} Watchlisted</span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Product Name</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Sale Price</th>
                <th class="py-2.5 font-medium text-right">Current Stock</th>
                <th class="py-2.5 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="p in filteredLowStockItems" 
                :key="p.id"
                class="hover:bg-amber-50/40 transition-colors"
              >
                <td class="py-3 pr-2">
                  <div class="font-semibold text-gray-900 truncate max-w-[200px]" :title="p.name">{{ p.name }}</div>
                  <div class="text-[11px] text-gray-400 truncate max-w-[180px]">{{ p.sku !== p.name ? p.sku : '' }}</div>
                </td>
                <td class="py-3 px-2 text-gray-600">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right text-gray-700 font-medium">{{ formatCurrency(p.price) }}</td>
                <td class="py-3 px-2 text-right">
                  <span class="font-bold text-amber-700">{{ formatNumber(p.stock) }}</span>
                </td>
                <td class="py-3 pl-2 text-right">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                    Low Stock
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 3: Negative Stock Watchlist -->
        <div v-if="activeTab === 'negative'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3 mb-3 bg-rose-50 rounded-xl border border-rose-200/70 text-xs text-rose-800 flex items-center justify-between">
            <span class="font-medium">Items where dispatches exceed recorded inward receipts (Needs GRN audit)</span>
            <span class="font-bold text-rose-900 bg-rose-100 px-2 py-0.5 rounded-md">{{ data.inventory.negativeStockItems.length }} Highlighted</span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Product Name</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Price</th>
                <th class="py-2.5 font-medium text-right">Deficit Stock</th>
                <th class="py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="p in filteredNegativeStockItems" 
                :key="p.id"
                class="hover:bg-rose-50/40 transition-colors"
              >
                <td class="py-3 pr-2">
                  <div class="font-semibold text-gray-900 truncate max-w-[200px]" :title="p.name">{{ p.name }}</div>
                  <div class="text-[11px] text-gray-400 truncate max-w-[180px]">{{ p.sku !== p.name ? p.sku : '' }}</div>
                </td>
                <td class="py-3 px-2 text-gray-600">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right text-gray-700 font-medium">{{ formatCurrency(p.price) }}</td>
                <td class="py-3 px-2 text-right">
                  <span class="font-extrabold text-rose-600">{{ p.stock }}</span>
                </td>
                <td class="py-3 pl-2 text-right">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                    Physical Audit
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 4: Customer City Clusters -->
        <div v-if="activeTab === 'customers'" class="mt-4 flex-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              v-for="cluster in data.customers.topCities" 
              :key="cluster.city"
              class="p-4 rounded-xl bg-gray-50 border border-gray-200/70 flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                  {{ cluster.city.substring(0, 2).toUpperCase() }}
                </div>
                <div>
                  <h3 class="text-sm font-bold text-gray-900">{{ cluster.city }}</h3>
                  <p class="text-xs text-gray-400">Primary delivery cluster</p>
                </div>
              </div>
              <div class="text-right">
                <div class="text-lg font-extrabold text-gray-900">{{ formatNumber(cluster.count) }}</div>
                <div class="text-[11px] text-gray-400">Accounts</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  RefreshCw,
  AlertCircle,
  IndianRupee,
  Boxes,
  Users,
  AlertTriangle,
  CheckCircle,
  Search
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'

definePageMeta({
  layout: 'dashboard'
})

interface AnalyticsPayload {
  inventory: {
    totalProducts: number
    inStockCount: number
    zeroStockCount: number
    negativeStockCount: number
    lowStockCount: number
    totalInventoryValue: number
    categories: Array<{
      name: string
      productCount: number
      totalUnits: number
      totalValue: number
    }>
    topProducts: Array<{
      id: string
      name: string
      sku: string
      stock: number
      price: number
      category: string
      totalValue: number
    }>
    lowStockItems: Array<{
      id: string
      name: string
      sku: string
      stock: number
      price: number
      category: string
    }>
    negativeStockItems: Array<{
      id: string
      name: string
      sku: string
      stock: number
      price: number
      category: string
    }>
  }
  customers: {
    total: number
    gold: number
    silver: number
    bronze: number
    gstRegistered: number
    phoneVerified: number
    topCities: Array<{ city: string; count: number }>
  }
  orders: {
    totalOrders: number
    totalRevenue: number
    delivered: number
    dispatched: number
    ready: number
    processing: number
    confirmed: number
    cancelled: number
  }
}

const data = ref<AnalyticsPayload | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const lastRefreshed = ref('')
const activeTab = ref<'top' | 'low' | 'negative' | 'customers'>('top')
const searchQuery = ref('')

const fetchAnalytics = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<any>('/api/analytics/summary')
    if (res.success) {
      data.value = res
      const d = new Date()
      lastRefreshed.value = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to fetch analytics'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAnalytics()
})

// Percentages and ratios
const inStockPercentage = computed(() => {
  if (!data.value || !data.value.inventory.totalProducts) return 0
  return Math.round((data.value.inventory.inStockCount / data.value.inventory.totalProducts) * 100)
})

const lowStockPercentage = computed(() => {
  if (!data.value || !data.value.inventory.totalProducts) return 0
  return Math.round((data.value.inventory.lowStockCount / data.value.inventory.totalProducts) * 100)
})

const negativeStockPercentage = computed(() => {
  if (!data.value || !data.value.inventory.totalProducts) return 0
  return Math.round((data.value.inventory.negativeStockCount / data.value.inventory.totalProducts) * 100)
})

const gstRatio = computed(() => {
  if (!data.value || !data.value.customers.total) return 0
  return Math.round((data.value.customers.gstRegistered / data.value.customers.total) * 100)
})

// Formatting helpers
function formatCrores(amount: number): string {
  if (amount >= 10000000) {
    const cr = (amount / 10000000).toFixed(2)
    return `₹${cr} Cr`
  }
  if (amount >= 100000) {
    const lk = (amount / 100000).toFixed(2)
    return `₹${lk} L`
  }
  return formatCurrency(amount)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num || 0)
}

function getCategoryPercentage(val: number): number {
  if (!data.value || !data.value.inventory.totalInventoryValue) return 0
  return Math.round((val / data.value.inventory.totalInventoryValue) * 100)
}

function filterByCategory(catName: string) {
  searchQuery.value = catName
  activeTab.value = 'top'
}

// Filtered lists based on search query
const filteredTopProducts = computed(() => {
  if (!data.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return data.value.inventory.topProducts
  return data.value.inventory.topProducts.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.sku.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q)
  )
})

const filteredLowStockItems = computed(() => {
  if (!data.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return data.value.inventory.lowStockItems
  return data.value.inventory.lowStockItems.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.sku.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q)
  )
})

const filteredNegativeStockItems = computed(() => {
  if (!data.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return data.value.inventory.negativeStockItems
  return data.value.inventory.negativeStockItems.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.sku.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q)
  )
})

// Color helpers for categories
const categoryColors = [
  { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { dot: 'bg-sky-500', bar: 'bg-sky-500' },
  { dot: 'bg-amber-500', bar: 'bg-amber-500' },
  { dot: 'bg-purple-500', bar: 'bg-purple-500' },
  { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  { dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
  { dot: 'bg-rose-500', bar: 'bg-rose-500' },
  { dot: 'bg-teal-500', bar: 'bg-teal-500' },
  { dot: 'bg-orange-500', bar: 'bg-orange-500' },
  { dot: 'bg-cyan-500', bar: 'bg-cyan-500' }
]

function getCategoryColorClass(idx: number): string {
  return categoryColors[idx % categoryColors.length].dot
}

function getCategoryBarColor(idx: number): string {
  return categoryColors[idx % categoryColors.length].bar
}
</script>
