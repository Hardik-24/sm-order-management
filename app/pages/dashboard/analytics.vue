<template>
  <div class="space-y-6 max-w-[1600px] mx-auto pb-12">
    <!-- Header with Title, Period Selector & Valuation Mode Toggle -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Analytics & Intelligence</h1>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live BUSY Data
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          Landed cost inventory valuation, monthly stock movement velocity, and B2B client performance
        </p>
      </div>

      <!-- Controls: Valuation Mode Toggle + Period Selector + Refresh -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Cost vs Sale Price Toggle (Fix #1) -->
        <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80">
          <button
            @click="valuationMode = 'cost'"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            :class="valuationMode === 'cost' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
            title="Valuation based on actual Landed / Purchase Cost"
          >
            <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
            <span>Book Value (Cost)</span>
          </button>
          <button
            @click="valuationMode = 'sale'"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            :class="valuationMode === 'sale' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
            title="Valuation based on Selling Price / MRP"
          >
            <Tag class="w-3.5 h-3.5 text-sky-600" />
            <span>Retail (Sale Price)</span>
          </button>
        </div>

        <!-- Period Selector (Fix #2) -->
        <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80">
          <button
            v-for="p in periods"
            :key="p.id"
            @click="selectedPeriod = p.id"
            class="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
            :class="selectedPeriod === p.id ? 'bg-white text-gray-900 font-semibold shadow-sm' : 'text-gray-500 hover:text-gray-900'"
          >
            {{ p.label }}
          </button>
        </div>

        <button
          @click="fetchAnalytics"
          :disabled="loading"
          class="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all duration-200 disabled:opacity-60 active:scale-95 shrink-0"
        >
          <RefreshCw class="w-4 h-4 text-gray-500" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">{{ loading ? 'Updating...' : 'Refresh' }}</span>
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
      <!-- 1. Total Inventory Valuation (Cost vs Sale toggleable) -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {{ valuationMode === 'cost' ? 'Inventory Book Value (Cost)' : 'Inventory Potential (Retail)' }}
          </span>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center border" :class="valuationMode === 'cost' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'">
            <IndianRupee class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {{ formatCrores(currentValuation) }}
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span>{{ formatCurrency(currentValuation) }}</span>
            <span class="font-semibold px-2 py-0.5 rounded-full border text-[11px]" :class="valuationMode === 'cost' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'">
              {{ valuationMode === 'cost' ? 'Landed Purchase Cost' : 'Selling Price / MRP' }}
            </span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1" :class="valuationMode === 'cost' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'"></div>
      </div>

      <!-- 2. Stock Availability & Active SKUs -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Stock Availability</span>
          <div class="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Boxes class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {{ formatNumber(data.inventory.inStockCount) }} <span class="text-sm font-medium text-gray-400">/ {{ formatNumber(data.inventory.totalProducts) }} SKUs</span>
          </div>
          <!-- Multi-segment progress bar -->
          <div class="mt-2.5 w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
            <div class="bg-emerald-500 h-full transition-all duration-500" :style="{ width: inStockPercentage + '%' }" title="Healthy In-Stock"></div>
            <div class="bg-amber-400 h-full transition-all duration-500" :style="{ width: lowStockPercentage + '%' }" title="Low Stock"></div>
            <div class="bg-rose-400 h-full transition-all duration-500" :style="{ width: negativeStockPercentage + '%' }" title="Negative Stock"></div>
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span class="text-emerald-700 font-semibold">{{ inStockPercentage }}% Active Stock</span>
            <span>{{ data.inventory.zeroStockCount }} Out of Stock</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-sky-500"></div>
      </div>

      <!-- 3. Customer Base & GST Verification -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">B2B Customer Accounts</span>
          <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Users class="w-5 h-5" />
          </div>
        </div>
        <div class="mt-3">
          <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {{ formatNumber(data.customers.total) }}
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span class="inline-flex items-center gap-1 text-indigo-700 font-semibold">
              <CheckCircle class="w-3.5 h-3.5 text-indigo-500" />
              {{ data.customers.gstRegistered }} GST Accounts
            </span>
            <span class="text-gray-400">{{ gstRatio }}% verified</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-indigo-500"></div>
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
            <span class="text-xs text-rose-600/80 font-semibold uppercase tracking-wide">Negative Stock</span>
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
            <span class="text-amber-700 font-medium">{{ data.inventory.lowStockCount }} below reorder (&le;10)</span>
            <span class="text-rose-600 font-bold cursor-pointer hover:underline" @click="activeTab = 'negative'">Inspect &rarr;</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-rose-500"></div>
      </div>
    </div>

    <!-- Monthly Movement Trendline (Fix #2: Time-Series Visualizer) -->
    <div v-if="data && data.inventory.monthlyFlow && data.inventory.monthlyFlow.length > 0" class="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
        <div>
          <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp class="w-5 h-5 text-sky-600" />
            Monthly Inventory Velocity (FY 2026-27)
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">Month-by-month warehouse inflow (purchases/returns) vs outflow (sales/dispatches)</p>
        </div>
        <div class="flex items-center gap-4 text-xs font-semibold">
          <span class="flex items-center gap-1.5 text-emerald-700">
            <span class="w-3 h-3 rounded-sm bg-emerald-500"></span> Inward Receipts
          </span>
          <span class="flex items-center gap-1.5 text-rose-700">
            <span class="w-3 h-3 rounded-sm bg-rose-500"></span> Outward Dispatches
          </span>
        </div>
      </div>

      <!-- Visual Grouped Bar Chart -->
      <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        <div 
          v-for="m in data.inventory.monthlyFlow" 
          :key="m.label"
          class="flex flex-col items-center p-3 rounded-xl bg-gray-50/70 border border-gray-100 hover:bg-gray-100/60 transition-all text-center"
        >
          <span class="text-xs font-bold text-gray-700 mb-2">{{ m.label }}</span>
          
          <!-- Bar container -->
          <div class="w-full flex items-end justify-center gap-2 h-28 pb-1 border-b border-gray-200">
            <!-- Inward Bar -->
            <div class="w-4 bg-emerald-500 rounded-t-sm transition-all duration-500 relative group flex items-end justify-center" :style="{ height: getBarHeight(m.inward) + '%' }">
              <span class="opacity-0 group-hover:opacity-100 absolute -top-7 text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 transition-opacity">
                +{{ formatNumber(m.inward) }}
              </span>
            </div>
            <!-- Outward Bar -->
            <div class="w-4 bg-rose-400 rounded-t-sm transition-all duration-500 relative group flex items-end justify-center" :style="{ height: getBarHeight(m.outward) + '%' }">
              <span class="opacity-0 group-hover:opacity-100 absolute -top-7 text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 transition-opacity">
                -{{ formatNumber(m.outward) }}
              </span>
            </div>
          </div>

          <!-- Month Stats -->
          <div class="mt-2 text-[11px] space-y-0.5 w-full">
            <div class="flex justify-between text-gray-500">
              <span>In:</span> <span class="font-semibold text-emerald-700">{{ formatNumber(m.inward) }}</span>
            </div>
            <div class="flex justify-between text-gray-500">
              <span>Out:</span> <span class="font-semibold text-rose-700">{{ formatNumber(m.outward) }}</span>
            </div>
            <div class="flex justify-between font-bold pt-1 border-t border-gray-200" :class="m.net >= 0 ? 'text-emerald-700' : 'text-rose-600'">
              <span>Net:</span> <span>{{ m.net >= 0 ? '+' : '' }}{{ formatNumber(m.net) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid: Category Capital + Interactive Tabs Explorer -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Category Capital Allocation (Left 5 Cols) -->
      <div class="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col">
        <div class="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 class="text-base font-bold text-gray-900">Capital by Category</h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Valued by {{ valuationMode === 'cost' ? 'Landed Purchase Cost' : 'Retail Selling Price' }}
            </p>
          </div>
          <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
            {{ data.inventory.categories.length }} Categories
          </span>
        </div>

        <!-- Category Horizontal Bars -->
        <div class="space-y-3.5 mt-5 flex-1 overflow-y-auto max-h-[520px] pr-1">
          <div 
            v-for="(cat, idx) in sortedCategories" 
            :key="cat.name"
            class="group p-2.5 rounded-xl hover:bg-gray-50/80 transition-colors border border-transparent hover:border-gray-100 cursor-pointer"
            @click="filterByCategory(cat.name)"
          >
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="font-semibold text-gray-800 flex items-center gap-2 truncate max-w-[210px]">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="getCategoryColorClass(idx)"></span>
                <span class="truncate">{{ cat.name }}</span>
              </span>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-extrabold text-gray-900">{{ formatCurrency(getCatValue(cat)) }}</span>
                <span class="text-[11px] text-gray-400 font-medium">({{ getCategoryPercentage(getCatValue(cat)) }}%)</span>
              </div>
            </div>

            <!-- Bar -->
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-700" 
                :class="getCategoryBarColor(idx)"
                :style="{ width: getCategoryPercentage(getCatValue(cat)) + '%' }"
              ></div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-gray-400 mt-1">
              <span>{{ formatNumber(cat.productCount) }} Active SKUs</span>
              <span>{{ formatNumber(cat.totalUnits) }} Units Stocked</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Data Explorer (Right 7 Cols) -->
      <div class="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex flex-col">
        <!-- Tabs Header (Fix #5: Added Top Billed B2B Customers) -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
            <button
              @click="activeTab = 'top'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              :class="activeTab === 'top' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            >
              Capital Leaders
            </button>
            <button
              @click="activeTab = 'clients'"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
              :class="activeTab === 'clients' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
            >
              <Crown class="w-3.5 h-3.5 text-amber-500" />
              <span>Top B2B Clients</span>
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
              <span>Audit Watch</span>
              <span class="w-2 h-2 rounded-full bg-rose-500"></span>
            </button>
          </div>

          <!-- Search Filter -->
          <div class="relative w-full sm:w-52" v-if="activeTab !== 'clients'">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search items..."
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
                <th class="py-2.5 font-medium text-right">{{ valuationMode === 'cost' ? 'Cost Price' : 'Sale Price' }}</th>
                <th class="py-2.5 font-medium text-right">Stock</th>
                <th class="py-2.5 font-medium text-right">Valuation</th>
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
                <td class="py-3 px-2 text-right text-gray-700 font-medium">
                  {{ formatCurrency(valuationMode === 'cost' ? p.costPrice : p.salePrice) }}
                </td>
                <td class="py-3 px-2 text-right">
                  <span class="font-bold text-gray-900">{{ formatNumber(p.stock) }}</span>
                </td>
                <td class="py-3 pl-2 text-right font-extrabold text-gray-900">
                  {{ formatCurrency(valuationMode === 'cost' ? p.totalCostValue : p.totalSaleValue) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 2: Top B2B Clients (Fix #5: Customer Billed Sales from BUSY) -->
        <div v-if="activeTab === 'clients'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3 mb-3 bg-indigo-50 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 flex items-center justify-between">
            <span class="font-medium">Top B2B accounts by total invoiced sales in 2026 (from BUSY live vouchers)</span>
            <span class="font-bold text-indigo-950 bg-indigo-100 px-2 py-0.5 rounded-md">{{ data.customers.topBilledCustomers.length }} VIP Accounts</span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Account Code / Client Name</th>
                <th class="py-2.5 font-medium text-right">Invoices Billed</th>
                <th class="py-2.5 font-medium text-right">Total Sales Volume</th>
                <th class="py-2.5 font-medium text-right">Tier</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="(c, idx) in data.customers.topBilledCustomers" 
                :key="c.customerCode"
                class="hover:bg-indigo-50/40 transition-colors"
              >
                <td class="py-3 pr-2">
                  <div class="font-bold text-gray-900 truncate max-w-[240px]" :title="c.name">
                    <span class="text-gray-400 font-mono text-[11px] mr-1.5">#{{ idx + 1 }}</span>
                    {{ c.name }}
                  </div>
                  <div class="text-[11px] text-indigo-600 font-mono font-medium">{{ c.customerCode }}</div>
                </td>
                <td class="py-3 px-2 text-right">
                  <span class="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{{ c.invoiceCount }} Bills</span>
                </td>
                <td class="py-3 px-2 text-right font-extrabold text-gray-900">
                  {{ formatCurrency(c.totalBilled) }}
                </td>
                <td class="py-3 pl-2 text-right">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" :class="idx < 3 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700'">
                    {{ idx < 3 ? '⭐ VIP Tier' : 'Active B2B' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- TAB 3: Low Stock Alerts -->
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
                <th class="py-2.5 font-medium text-right">Cost Price</th>
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
                <td class="py-3 px-2 text-right text-gray-700 font-medium">{{ formatCurrency(p.costPrice || p.salePrice) }}</td>
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

        <!-- TAB 4: Negative Stock Watchlist -->
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
                <th class="py-2.5 font-medium text-right">Cost Price</th>
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
                <td class="py-3 px-2 text-right text-gray-700 font-medium">{{ formatCurrency(p.costPrice || p.salePrice) }}</td>
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
  Search,
  TrendingUp,
  ShieldCheck,
  Tag,
  Crown
} from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'

definePageMeta({
  layout: 'dashboard'
})

interface MonthlyFlowItem {
  month: number
  year: number
  label: string
  inward: number
  outward: number
  net: number
}

interface TopBilledCustomer {
  customerCode: string
  name: string
  invoiceCount: number
  totalBilled: number
}

interface AnalyticsPayload {
  period: string
  inventory: {
    totalProducts: number
    inStockCount: number
    zeroStockCount: number
    negativeStockCount: number
    lowStockCount: number
    totalCostValue: number
    totalSaleValue: number
    categories: Array<{
      name: string
      productCount: number
      totalUnits: number
      costValue: number
      saleValue: number
    }>
    topProducts: Array<{
      id: string
      name: string
      sku: string
      stock: number
      salePrice: number
      costPrice: number
      category: string
      totalCostValue: number
      totalSaleValue: number
    }>
    lowStockItems: Array<{
      id: string
      name: string
      sku: string
      stock: number
      salePrice: number
      costPrice: number
      category: string
    }>
    negativeStockItems: Array<{
      id: string
      name: string
      sku: string
      stock: number
      salePrice: number
      costPrice: number
      category: string
    }>
    monthlyFlow: MonthlyFlowItem[]
  }
  customers: {
    total: number
    gold: number
    silver: number
    bronze: number
    gstRegistered: number
    phoneVerified: number
    topCities: Array<{ city: string; count: number }>
    topBilledCustomers: TopBilledCustomer[]
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
const activeTab = ref<'top' | 'clients' | 'low' | 'negative'>('top')
const searchQuery = ref('')

// Fix #1: Cost vs Sale Price Valuation Mode Toggle
const valuationMode = ref<'cost' | 'sale'>('cost')

// Fix #2: Period Filter Selector
const selectedPeriod = ref('fy')
const periods = [
  { id: 'fy', label: 'FY 2026-27' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'month', label: 'October' }
]

const fetchAnalytics = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<any>('/api/analytics/summary', {
      params: { period: selectedPeriod.value }
    })
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

// Current active valuation based on mode
const currentValuation = computed(() => {
  if (!data.value) return 0
  return valuationMode.value === 'cost' 
    ? data.value.inventory.totalCostValue 
    : data.value.inventory.totalSaleValue
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

// Category valuation and sorting based on mode
function getCatValue(cat: any): number {
  return valuationMode.value === 'cost' ? cat.costValue : cat.saleValue
}

const sortedCategories = computed(() => {
  if (!data.value) return []
  return [...data.value.inventory.categories].sort((a, b) => getCatValue(b) - getCatValue(a))
})

// Bar height for monthly velocity chart
function getBarHeight(val: number): number {
  if (!data.value?.inventory.monthlyFlow?.length) return 10
  const max = Math.max(...data.value.inventory.monthlyFlow.map(m => Math.max(m.inward, m.outward))) || 1
  return Math.max(8, Math.round((val / max) * 100))
}

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
  const total = currentValuation.value
  if (!total) return 0
  return Math.round((val / total) * 100)
}

function filterByCategory(catName: string) {
  searchQuery.value = catName
  activeTab.value = 'top'
}

// Filtered lists based on search query
const filteredTopProducts = computed(() => {
  if (!data.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  const list = data.value.inventory.topProducts
  if (!q) return list
  return list.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.sku.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q)
  )
})

const filteredLowStockItems = computed(() => {
  if (!data.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  const list = data.value.inventory.lowStockItems
  if (!q) return list
  return list.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.sku.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q)
  )
})

const filteredNegativeStockItems = computed(() => {
  if (!data.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  const list = data.value.inventory.negativeStockItems
  if (!q) return list
  return list.filter(p => 
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
