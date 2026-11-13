<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  ShoppingBag,
  Search,
  Filter,
  Calendar,
  X,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Clock,
  IndianRupee,
  ShieldCheck,
  Building2,
  Package,
  Layers,
  FileSpreadsheet
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth'
})

useHead({
  title: 'Purchase Invoices - SM OMS'
})

// Query State
const search = ref('')
const selectedSeries = ref('ALL')
const selectedDatePreset = ref<'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('all')
const customDateFrom = ref('')
const customDateTo = ref('')
const currentPage = ref(1)
const pageSize = ref(25)
const sortBy = ref('voucherDate')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Data State
const purchases = ref<any[]>([])
const stats = ref<any>(null)
const seriesList = ref<string[]>([])
const pagination = ref({
  total: 0,
  page: 1,
  limit: 25,
  totalPages: 1
})
const isLoading = ref(false)

// Drawer State
const isDrawerOpen = ref(false)
const selectedPurchase = ref<any>(null)

// Formatters
const formatCurrency = (val: number | string | null | undefined) => {
  const num = Number(val) || 0
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

const formatDate = (val: string | null | undefined) => {
  if (!val) return '-'
  try {
    const d = new Date(val)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return val
  }
}

// Active filters check
const hasActiveFilters = computed(() => {
  return (
    search.value.trim() !== '' ||
    selectedSeries.value !== 'ALL' ||
    selectedDatePreset.value !== 'all'
  )
})

// Build API Query
const queryParams = computed(() => {
  const p: any = {
    page: currentPage.value,
    limit: pageSize.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value
  }

  if (search.value.trim()) p.search = search.value.trim()
  if (selectedSeries.value !== 'ALL') p.series = selectedSeries.value

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (selectedDatePreset.value === 'today') {
    p.dateFrom = todayStr
    p.dateTo = todayStr
  } else if (selectedDatePreset.value === 'yesterday') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    const yestStr = yest.toISOString().split('T')[0]
    p.dateFrom = yestStr
    p.dateTo = yestStr
  } else if (selectedDatePreset.value === 'last7') {
    const d7 = new Date(now)
    d7.setDate(d7.getDate() - 6)
    p.dateFrom = d7.toISOString().split('T')[0]
    p.dateTo = todayStr
  } else if (selectedDatePreset.value === 'thisMonth') {
    const startM = new Date(now.getFullYear(), now.getMonth(), 1)
    p.dateFrom = startM.toISOString().split('T')[0]
    p.dateTo = todayStr
  } else if (selectedDatePreset.value === 'custom') {
    if (customDateFrom.value) p.dateFrom = customDateFrom.value
    if (customDateTo.value) p.dateTo = customDateTo.value
  }

  return p
})

// Fetch Purchases
const fetchPurchases = async (resetPage = false) => {
  if (resetPage) currentPage.value = 1
  isLoading.value = true

  try {
    const res = await $fetch<any>('/api/purchases', {
      query: queryParams.value
    })

    purchases.value = res.purchases || []
    stats.value = res.stats || null
    seriesList.value = res.seriesList || []
    pagination.value = {
      total: res.total || 0,
      page: res.page || 1,
      limit: res.limit || 25,
      totalPages: res.totalPages || 1
    }
  } catch (err: any) {
    console.error('Error fetching purchases:', err)
  } finally {
    isLoading.value = false
  }
}

// Analytics summary
const analyticsData = ref<any>(null)
const fetchAnalytics = async () => {
  try {
    const res = await $fetch<any>('/api/purchases/stats')
    analyticsData.value = res
  } catch (err) {
    console.error('Error fetching purchase analytics:', err)
  }
}

// Watchers
let debounceTimer: any = null
watch(search, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    fetchPurchases(true)
  }, 350)
})

watch([selectedSeries, selectedDatePreset], () => {
  fetchPurchases(true)
})

watch(currentPage, () => {
  fetchPurchases(false)
})

// Actions
const resetAllFilters = () => {
  search.value = ''
  selectedSeries.value = 'ALL'
  selectedDatePreset.value = 'all'
  customDateFrom.value = ''
  customDateTo.value = ''
  fetchPurchases(true)
}

const openDrawer = (purchase: any) => {
  selectedPurchase.value = purchase
  isDrawerOpen.value = true
}

const closeDrawer = () => {
  isDrawerOpen.value = false
  selectedPurchase.value = null
}

const onPageSizeChange = (size: number) => {
  pageSize.value = size
  fetchPurchases(true)
}

// Realtime sync
const { onOrderSync } = useRealtimeSync()
onOrderSync(() => {
  fetchPurchases(false)
  fetchAnalytics()
})

onMounted(() => {
  fetchPurchases(true)
  fetchAnalytics()
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12">
    <!-- Header with Title, Live Badge & Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Purchase Invoices</h1>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            BUSY Live Mirror
          </span>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Review vendor purchase invoices, track procurement spend, and inspect GST input credits.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="fetchPurchases(true); fetchAnalytics()"
          :disabled="isLoading"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh purchase records"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 select-none">
      <!-- 1. Total Purchases -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-xs">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-[#1b3b5f]/10 p-2 sm:p-2.5 rounded-lg text-[#1b3b5f] border border-[#1b3b5f]/20">
              <ShoppingBag class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1b3b5f] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Invoices</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="stats?.totalCount || pagination.total || 0" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-gray-500 font-medium truncate">Synced purchase vouchers</p>
          </div>
        </div>
      </div>

      <!-- 2. Total Purchase Value -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-xs">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-emerald-50 p-2 sm:p-2.5 rounded-lg text-emerald-600 border border-emerald-100/50">
              <IndianRupee class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-emerald-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5 truncate">Total Purchase Spend</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="stats?.totalAmount || 0" prefix="₹" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-emerald-600 font-medium truncate">Gross invoice amount</p>
          </div>
        </div>
      </div>

      <!-- 3. GST Input Tax Credit -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-xs">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-sky-50 p-2 sm:p-2.5 rounded-lg text-sky-600 border border-sky-100/50">
              <ShieldCheck class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-sky-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5 truncate">GST Input Credit</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="stats?.totalTax || 0" prefix="₹" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-sky-600 font-medium truncate">Taxable: {{ formatCurrency(stats?.totalTaxable || 0) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Suppliers Spend Banner -->
    <div v-if="analyticsData?.topSuppliers?.length" class="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-xs">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <Building2 class="w-4 h-4 text-[#1b3b5f]" />
          <h2 class="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider">Top Suppliers by Procurement Spend</h2>
        </div>
        <span class="text-xs text-gray-500">Total Suppliers: {{ analyticsData.topSuppliers.length }}</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div 
          v-for="s in analyticsData.topSuppliers.slice(0, 5)" 
          :key="s.supplierName"
          @click="search = s.supplierName"
          class="p-2.5 rounded-lg bg-gray-50 hover:bg-sky-50 border border-gray-100 hover:border-sky-200 transition-all cursor-pointer group"
        >
          <p class="text-xs font-bold text-gray-800 truncate group-hover:text-[#1b3b5f]">{{ s.supplierName }}</p>
          <div class="flex items-center justify-between mt-1 text-[11px]">
            <span class="text-emerald-700 font-semibold">{{ formatCurrency(s.totalAmount) }}</span>
            <span class="text-gray-400 font-medium">{{ s.invoiceCount }} bills</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Search & Filter Controls Toolbar -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-4 flex flex-col sm:flex-row justify-between items-center gap-3.5 bg-gray-50/50">
        <!-- Search Input -->
        <div class="relative w-full sm:w-80">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="search"
            type="text"
            placeholder="Search by invoice number or supplier..."
            class="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f] focus:border-[#1b3b5f] transition"
          />
          <button
            v-if="search"
            @click="search = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Series Filter Dropdown -->
        <div v-if="seriesList.length > 1" class="flex items-center gap-2 self-start sm:self-auto">
          <span class="text-xs text-gray-500 font-medium">Series:</span>
          <select
            v-model="selectedSeries"
            class="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
          >
            <option value="ALL">All Series</option>
            <option v-for="s in seriesList" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
      </div>

      <!-- Date Presets & Filter Actions Row -->
      <div class="px-4 py-2.5 border-t border-gray-200 bg-white flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-gray-400 text-[11px] font-medium mr-1 flex items-center gap-1">
            <Calendar class="w-3 h-3 text-gray-400" />
            Date:
          </span>
          <button
            v-for="p in ([
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ] as const)"
            :key="p.id"
            @click="selectedDatePreset = p.id"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer"
            :class="[
              selectedDatePreset === p.id
                ? 'bg-[#1b3b5f] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            {{ p.label }}
          </button>
        </div>

        <!-- Custom Date Range -->
        <div v-if="selectedDatePreset === 'custom'" class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1 text-xs text-gray-500">
            <span>From:</span>
            <input
              v-model="customDateFrom"
              @change="fetchPurchases(true)"
              type="date"
              class="px-2 py-1 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
            />
          </div>
          <div class="flex items-center gap-1 text-xs text-gray-500">
            <span>To:</span>
            <input
              v-model="customDateTo"
              @change="fetchPurchases(true)"
              type="date"
              class="px-2 py-1 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
            />
          </div>
        </div>

        <!-- Reset Filters -->
        <button
          v-if="hasActiveFilters"
          @click="resetAllFilters"
          class="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition cursor-pointer"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>
    </div>

    <!-- Main Purchases Table Container -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative">
      <LoadingTopBar :loading="isLoading" />

      <!-- Toolbar Header -->
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <div>
          Showing <span class="font-bold text-gray-900">{{ purchases.length }}</span> of
          <span class="font-bold text-gray-900">{{ pagination.total.toLocaleString() }}</span> purchase invoices
          <span v-if="hasActiveFilters" class="text-sky-600 ml-1 font-semibold">(filtered)</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span>Rows:</span>
            <RowsPerPageSelect
              :modelValue="pageSize"
              @update:modelValue="onPageSizeChange"
              :options="[15, 25, 50, 100]"
            />
          </div>
        </div>
      </div>

      <!-- Skeletons when initial loading -->
      <div v-if="isLoading && purchases.length === 0">
        <div class="hidden md:block overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th class="px-5 py-3.5 whitespace-nowrap">Invoice No</th>
                <th class="px-5 py-3.5 whitespace-nowrap">Date</th>
                <th class="px-5 py-3.5">Supplier</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right">Taxable</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right">Invoice Total</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
              </tr>
            </thead>
            <TableSkeletonRows :cols="7" :rows="5" />
          </table>
        </div>
        <TableSkeletonRows :cols="7" :rows="5" :isMobileOnly="true" :renderMobile="true" />
      </div>

      <!-- Empty State -->
      <div v-else-if="purchases.length === 0" class="py-14 text-center text-gray-400">
        <ShoppingBag class="w-8 h-8 mx-auto text-gray-300 mb-2" />
        <p class="text-sm font-semibold text-gray-700">No purchase invoices found</p>
        <p class="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
          No BUSY purchase invoices matching your search or filters were found.
        </p>
        <button
          v-if="hasActiveFilters"
          @click="resetAllFilters"
          class="mt-3 px-3 py-1.5 text-xs font-semibold text-[#1b3b5f] bg-sky-50 hover:bg-sky-100 rounded-lg transition cursor-pointer"
        >
          Reset All Filters
        </button>
      </div>

      <!-- Desktop Table View -->
      <div v-else>
        <div class="hidden md:block overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th class="px-5 py-3.5 whitespace-nowrap">Invoice No</th>
                <th class="px-5 py-3.5 whitespace-nowrap">Date</th>
                <th class="px-5 py-3.5">Supplier Name</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right">Taxable Amount</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right">Total Amount</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-normal">
              <tr
                v-for="p in purchases"
                :key="p.id"
                @click="openDrawer(p)"
                class="hover:bg-gray-50/80 transition-colors cursor-pointer group"
              >
                <!-- Invoice No -->
                <td class="px-5 py-3.5 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-gray-900 group-hover:text-[#1b3b5f]">{{ p.voucherNo }}</span>
                    <span v-if="p.series && p.series !== 'Main'" class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                      {{ p.series }}
                    </span>
                  </div>
                </td>

                <!-- Date -->
                <td class="px-5 py-3.5 whitespace-nowrap text-xs text-gray-600">
                  {{ formatDate(p.voucherDate) }}
                </td>

                <!-- Supplier -->
                <td class="px-5 py-3.5">
                  <div class="flex flex-col min-w-0">
                    <span class="font-semibold text-gray-900 group-hover:text-[#1b3b5f] truncate max-w-xs sm:max-w-md">
                      {{ p.supplierName }}
                    </span>
                    <span v-if="p.supplierCode" class="text-[11px] text-gray-400">
                      {{ p.supplierCode }}
                    </span>
                  </div>
                </td>

                <!-- Item Count -->
                <td class="px-5 py-3.5 whitespace-nowrap text-center">
                  <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {{ p.itemCount }}
                  </span>
                </td>

                <!-- Taxable Amount -->
                <td class="px-5 py-3.5 whitespace-nowrap text-right font-mono text-xs text-gray-600">
                  {{ formatCurrency(p.taxableAmount) }}
                </td>

                <!-- Total Amount -->
                <td class="px-5 py-3.5 whitespace-nowrap text-right font-mono font-bold text-gray-900">
                  {{ formatCurrency(p.totalAmount) }}
                </td>

                <!-- Action -->
                <td class="px-5 py-3.5 whitespace-nowrap text-right pr-5">
                  <span class="inline-flex items-center gap-1 text-xs font-semibold text-[#1b3b5f] group-hover:underline">
                    <span>Inspect</span>
                    <ChevronRight class="w-3.5 h-3.5" />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Cards View -->
        <div class="md:hidden divide-y divide-gray-100">
          <div
            v-for="p in purchases"
            :key="p.id"
            @click="openDrawer(p)"
            class="p-4 hover:bg-gray-50 transition active:bg-gray-100 cursor-pointer space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-gray-900 text-sm">#{{ p.voucherNo }}</span>
              <span class="font-mono font-bold text-sm text-gray-900">{{ formatCurrency(p.totalAmount) }}</span>
            </div>
            <div class="text-xs font-semibold text-gray-800 line-clamp-1">
              {{ p.supplierName }}
            </div>
            <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>{{ formatDate(p.voucherDate) }}</span>
              <span class="bg-gray-100 px-2 py-0.5 rounded font-medium text-gray-600">{{ p.itemCount }} item(s)</span>
            </div>
          </div>
        </div>

        <!-- Pagination Bar -->
        <div class="px-5 py-3.5 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div>
            Page <span class="font-bold text-gray-900">{{ pagination.page }}</span> of
            <span class="font-bold text-gray-900">{{ pagination.totalPages }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="currentPage > 1 && (currentPage--)"
              :disabled="currentPage <= 1 || isLoading"
              class="px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              @click="currentPage < pagination.totalPages && (currentPage++)"
              :disabled="currentPage >= pagination.totalPages || isLoading"
              class="px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Slide-over Voucher Detail Drawer -->
    <Teleport to="body">
      <div v-if="isDrawerOpen" class="fixed inset-0 z-50 overflow-hidden">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" @click="closeDrawer"></div>

        <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-2xl bg-white shadow-2xl flex flex-col">
            <!-- Drawer Header -->
            <div class="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-bold text-gray-900">Purchase Invoice #{{ selectedPurchase?.voucherNo }}</h3>
                  <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-[#1b3b5f]/10 text-[#1b3b5f]">
                    {{ selectedPurchase?.series || 'Main' }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">{{ formatDate(selectedPurchase?.voucherDate) }}</p>
              </div>
              <button
                @click="closeDrawer"
                class="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Drawer Body -->
            <div class="flex-1 overflow-y-auto p-5 space-y-6">
              <!-- Supplier Details Card -->
              <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Supplier</span>
                <h4 class="text-base font-bold text-gray-900">{{ selectedPurchase?.supplierName }}</h4>
                <p v-if="selectedPurchase?.supplierCode" class="text-xs text-gray-500 font-mono">Code: {{ selectedPurchase?.supplierCode }}</p>
              </div>

              <!-- Financial Summary Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span class="text-[10px] text-gray-500 font-bold uppercase block">Taxable</span>
                  <span class="text-sm font-mono font-bold text-gray-900">{{ formatCurrency(selectedPurchase?.taxableAmount) }}</span>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span class="text-[10px] text-gray-500 font-bold uppercase block">Total GST</span>
                  <span class="text-sm font-mono font-bold text-sky-700">{{ formatCurrency(selectedPurchase?.taxAmount) }}</span>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span class="text-[10px] text-gray-500 font-bold uppercase block">CGST / SGST</span>
                  <span class="text-xs font-mono font-semibold text-gray-700 block">{{ formatCurrency(selectedPurchase?.cgstAmount) }} / {{ formatCurrency(selectedPurchase?.sgstAmount) }}</span>
                </div>
                <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span class="text-[10px] text-emerald-700 font-bold uppercase block">Grand Total</span>
                  <span class="text-sm font-mono font-bold text-emerald-800">{{ formatCurrency(selectedPurchase?.totalAmount) }}</span>
                </div>
              </div>

              <!-- Line Items List -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <Package class="w-4 h-4 text-gray-500" />
                    <span>Purchased Items ({{ selectedPurchase?.items?.length || selectedPurchase?.itemCount || 0 }})</span>
                  </h4>
                </div>

                <div v-if="selectedPurchase?.items?.length" class="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  <div
                    v-for="(item, idx) in selectedPurchase.items"
                    :key="idx"
                    class="p-3.5 hover:bg-gray-50/50 flex items-start justify-between gap-4"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-bold text-gray-900 leading-snug">{{ item.name }}</p>
                      <p v-if="item.sku" class="text-[11px] text-gray-400 font-mono mt-0.5">SKU: {{ item.sku }}</p>
                      <div class="flex items-center gap-3 mt-1 text-[11px] text-gray-600">
                        <span>Qty: <strong class="text-gray-900">{{ item.qty }}</strong></span>
                        <span>Rate: <strong class="text-gray-900">{{ formatCurrency(item.rate) }}</strong></span>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="text-xs font-mono font-bold text-gray-900 block">{{ formatCurrency(item.amount) }}</span>
                    </div>
                  </div>
                </div>

                <div v-else class="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Line items not recorded for this voucher summary.
                </div>
              </div>
            </div>

            <!-- Drawer Footer -->
            <div class="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
              <button
                @click="closeDrawer"
                class="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
