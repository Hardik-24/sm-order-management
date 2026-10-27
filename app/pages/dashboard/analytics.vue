<template>
  <div class="space-y-6 max-w-[1600px] mx-auto pb-12 select-text">
    <!-- Header with Title, BUSY Sync Badge & Main Navigation Tabs -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5 flex-wrap">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Distribution Intelligence</h1>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live BUSY ERP Data
          </span>
          <span v-if="formattedLastSynced" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200" :title="'Server sync time: ' + (data?.lastSynced || '')">
            <Clock class="w-3.5 h-3.5 text-gray-400" />
            Last Synced: {{ formattedLastSynced }}
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          B2B sales performance, SKU movement velocity, dead stock audit, and vendor supply analytics
        </p>
      </div>

      <!-- Controls: Main Tab Switcher + Valuation Mode + Refresh -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Cost vs Sale Price Toggle -->
        <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80 shadow-2xs">
          <button
            @click="valuationMode = 'cost'"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            :class="valuationMode === 'cost' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
            title="Valuation based on actual Landed / Purchase Cost"
          >
            <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
            <span>Cost Price</span>
          </button>
          <button
            @click="valuationMode = 'sale'"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            :class="valuationMode === 'sale' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
            title="Valuation based on Selling Price / MRP"
          >
            <Tag class="w-3.5 h-3.5 text-sky-600" />
            <span>Sale Price</span>
          </button>
        </div>

        <button
          @click="fetchAnalytics(true)"
          :disabled="loading"
          class="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-xs transition-all duration-200 disabled:opacity-60 active:scale-95 shrink-0"
        >
          <RefreshCw class="w-4 h-4 text-gray-500" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">{{ loading ? 'Refreshing...' : 'Refresh' }}</span>
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
      <button @click="fetchAnalytics(true)" class="text-xs font-semibold text-red-700 underline hover:text-red-900">Try again</button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      <div v-for="i in 4" :key="i" class="h-32 bg-gray-200/70 rounded-2xl"></div>
    </div>

    <!-- MAIN PILLAR TABS (Sales, Movement, Purchases) -->
    <div v-if="data" class="border-b border-gray-200">
      <nav class="flex space-x-6 sm:space-x-8 overflow-x-auto no-scrollbar" aria-label="Tabs">
        <button
          @click="mainTab = 'sales'"
          class="py-3 px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 whitespace-nowrap transition-all"
          :class="mainTab === 'sales' ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          <IndianRupee class="w-4 h-4" />
          <span>Sales & Revenue Analysis</span>
          <span class="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-bold ml-1">
            {{ formatCrores(data.sales.totalRevenue) }}
          </span>
        </button>

        <button
          @click="mainTab = 'movement'"
          class="py-3 px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 whitespace-nowrap transition-all"
          :class="mainTab === 'movement' ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          <Activity class="w-4 h-4 text-sky-600" />
          <span>Inventory Movement & Velocity</span>
          <span v-if="data.movement.deadStock.length > 0" class="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold ml-1">
            {{ data.movement.deadStock.length }} Dead Stock
          </span>
        </button>

        <button
          @click="mainTab = 'purchases'"
          class="py-3 px-1 border-b-2 font-bold text-sm sm:text-base flex items-center gap-2 whitespace-nowrap transition-all"
          :class="mainTab === 'purchases' ? 'border-[#1b3b5f] text-[#1b3b5f]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          <Truck class="w-4 h-4 text-indigo-600" />
          <span>Purchase & Supply Chain</span>
          <span class="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 font-bold ml-1">
            {{ data.purchases.totalSuppliers }} Vendors
          </span>
        </button>
      </nav>
    </div>

    <!-- ========================================================================================= -->
    <!-- PILLAR 1: SALES & REVENUE ANALYSIS -->
    <!-- ========================================================================================= -->
    <div v-if="data && mainTab === 'sales'" class="space-y-6">
      <!-- Executive Sales KPIs (4 Cards) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Total Invoiced Revenue -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total B2B Revenue</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <IndianRupee class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCrores(data.sales.totalRevenue) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>{{ formatCurrency(data.sales.totalRevenue) }}</span>
              <span class="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">3,156 Vouchers</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        </div>

        <!-- 2. Wholesale GST Share (SMG) -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Wholesale Channel (SMG)</span>
            <div class="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Building2 class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCrores(channelSMG?.revenue || 0) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-sky-700 font-semibold">{{ channelSMG?.sharePercent || 0 }}% Share</span>
              <span>{{ formatNumber(channelSMG?.count || 0) }} B2B Invoices</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-sky-500"></div>
        </div>

        <!-- 3. Retail / Counter Share (RETAIL) -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Retail Channel (Cash/Counter)</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Users class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCrores(channelRetail?.revenue || 0) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-amber-700 font-semibold">{{ channelRetail?.sharePercent || 0 }}% Share</span>
              <span>{{ formatNumber(channelRetail?.count || 0) }} Cash Bills</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
        </div>

        <!-- 4. Average Invoice Value (AOV) -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Avg Invoice Value (AOV)</span>
            <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <TrendingUp class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCurrency(averageInvoiceValue) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>Per Transaction</span>
              <span class="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 text-[11px]">1,506 Accounts</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-indigo-500"></div>
        </div>
      </div>

      <!-- Channel Split Visual Comparison Banner -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
          <div>
            <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
              <Building2 class="w-5 h-5 text-sky-600" />
              B2B Wholesale vs Retail Sales Distribution
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">Comparative breakdown between GST registered wholesale series and counter retail sales</p>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- SMG Card -->
          <div class="p-4 rounded-xl bg-sky-50/60 border border-sky-100 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-sky-800">Series: SMG (GST Wholesale B2B)</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-extrabold bg-sky-100 text-sky-900">{{ channelSMG?.sharePercent || 0 }}% of Total</span>
              </div>
              <div class="text-2xl font-black text-gray-900 mt-2">{{ formatCurrency(channelSMG?.revenue || 0) }}</div>
            </div>
            <div class="mt-4 pt-3 border-t border-sky-200/60 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="text-gray-500 block text-[11px]">Invoices:</span>
                <span class="font-bold text-gray-800">{{ formatNumber(channelSMG?.count || 0) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[11px]">Taxable Amt:</span>
                <span class="font-bold text-gray-800">{{ formatCrores(channelSMG?.taxable || 0) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[11px]">GST Collected:</span>
                <span class="font-bold text-sky-700">{{ formatCrores(channelSMG?.tax || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- RETAIL Card -->
          <div class="p-4 rounded-xl bg-amber-50/60 border border-amber-100 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-800">Series: RETAIL (Counter / Cash)</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900">{{ channelRetail?.sharePercent || 0 }}% of Total</span>
              </div>
              <div class="text-2xl font-black text-gray-900 mt-2">{{ formatCurrency(channelRetail?.revenue || 0) }}</div>
            </div>
            <div class="mt-4 pt-3 border-t border-amber-200/60 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="text-gray-500 block text-[11px]">Vouchers:</span>
                <span class="font-bold text-gray-800">{{ formatNumber(channelRetail?.count || 0) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[11px]">Taxable Amt:</span>
                <span class="font-bold text-gray-800">{{ formatCrores(channelRetail?.taxable || 0) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[11px]">GST Collected:</span>
                <span class="font-bold text-amber-700">{{ formatCrores(channelRetail?.tax || 0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- High-Performing SKUs Explorer & Top Customers Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- High-Performing SKUs (Left 7 Cols) -->
        <div class="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs flex flex-col">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
            <div>
              <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
                <Flame class="w-5 h-5 text-amber-500" />
                High-Performing SKUs
              </h2>
              <p class="text-xs text-gray-500 mt-0.5">Top-selling products ranked by revenue and dispatch volume</p>
            </div>

            <!-- Sub-Toggle: Top Revenue vs Top Volume -->
            <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80 shrink-0">
              <button
                @click="skuRankingMode = 'revenue'"
                class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all"
                :class="skuRankingMode === 'revenue' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
              >
                Top Revenue (₹)
              </button>
              <button
                @click="skuRankingMode = 'volume'"
                class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all"
                :class="skuRankingMode === 'volume' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
              >
                Top Volume (Units)
              </button>
            </div>
          </div>

          <!-- SKU Search Bar -->
          <div class="mt-4 mb-2 relative">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="skuSearchQuery"
              type="text"
              placeholder="Search high-performing SKUs..."
              class="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <!-- SKUs Table -->
          <div class="flex-1 overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-gray-400 border-b border-gray-100 pb-2">
                  <th class="py-2.5 font-medium">Product / SKU</th>
                  <th class="py-2.5 font-medium text-right">Units Sold</th>
                  <th class="py-2.5 font-medium text-right">Total Revenue</th>
                  <th class="py-2.5 font-medium text-right">Avg Rate</th>
                  <th class="py-2.5 font-medium text-right">Warehouse Stock</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr 
                  v-for="(p, idx) in filteredSkus" 
                  :key="p.name"
                  class="hover:bg-gray-50/80 transition-colors"
                >
                  <td class="py-3 pr-2">
                    <div class="font-bold text-gray-900 truncate max-w-[220px]" :title="p.name">
                      <span class="text-gray-400 font-mono text-[11px] mr-1">#{{ idx + 1 }}</span>
                      {{ p.name }}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">{{ p.category }}</span>
                      <span v-if="p.sku && p.sku !== p.name" class="text-[10px] text-gray-400 truncate max-w-[120px]">{{ p.sku }}</span>
                    </div>
                  </td>
                  <td class="py-3 px-2 text-right">
                    <span class="font-bold text-gray-900">{{ formatNumber(p.qtySold) }}</span>
                    <span class="block text-[10px] text-gray-400">{{ p.voucherCount }} bills</span>
                  </td>
                  <td class="py-3 px-2 text-right font-extrabold text-emerald-700">
                    {{ formatCurrency(p.revenue) }}
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600 font-medium">
                    {{ formatCurrency(p.avgRate) }}
                  </td>
                  <td class="py-3 pl-2 text-right">
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                      :class="p.currentStock > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : p.currentStock > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'"
                    >
                      {{ formatNumber(p.currentStock) }} in stock
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top B2B Customers (Right 5 Cols) -->
        <div class="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs flex flex-col">
          <div class="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
                <Crown class="w-5 h-5 text-amber-500" />
                Top B2B Customer Accounts
              </h2>
              <p class="text-xs text-gray-500 mt-0.5">Highest spending wholesale & institutional clients</p>
            </div>
            <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              Top 20 Accounts
            </span>
          </div>

          <!-- Customer Search -->
          <div class="mt-4 mb-2 relative">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="customerSearchQuery"
              type="text"
              placeholder="Search customer accounts..."
              class="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          <!-- Customer Table -->
          <div class="flex-1 overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-gray-400 border-b border-gray-100 pb-2">
                  <th class="py-2.5 font-medium">Customer</th>
                  <th class="py-2.5 font-medium text-right">Bills</th>
                  <th class="py-2.5 font-medium text-right">Total Invoiced</th>
                  <th class="py-2.5 font-medium text-right">Tier</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr 
                  v-for="(c, idx) in filteredCustomers" 
                  :key="c.name"
                  class="hover:bg-indigo-50/40 transition-colors"
                >
                  <td class="py-3 pr-2">
                    <div class="font-bold text-gray-900 truncate max-w-[180px]" :title="c.name">
                      <span class="text-gray-400 font-mono text-[11px] mr-1">#{{ idx + 1 }}</span>
                      {{ c.name }}
                    </div>
                    <div class="text-[10.5px] text-indigo-600 font-mono font-medium">{{ c.customerCode }}</div>
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600">
                    <span class="font-bold text-gray-800">{{ c.invoiceCount }}</span>
                    <span class="block text-[10px] text-gray-400">bills</span>
                  </td>
                  <td class="py-3 px-2 text-right font-extrabold text-gray-900">
                    {{ formatCurrency(c.totalSpend) }}
                  </td>
                  <td class="py-3 pl-2 text-right">
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="idx < 3 ? 'bg-amber-100 text-amber-800 border border-amber-200' : idx < 10 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-700'"
                    >
                      {{ idx < 3 ? '⭐ VIP Tier' : idx < 10 ? 'Gold' : 'Silver' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================================= -->
    <!-- PILLAR 2: INVENTORY MOVEMENT & VELOCITY (User's Core Focus) -->
    <!-- ========================================================================================= -->
    <div v-if="data && mainTab === 'movement'" class="space-y-6">
      <!-- Movement Executive KPIs (4 Cards) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Active Turnover SKUs -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Moving Catalog</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Zap class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatNumber(data.inventory.inStockCount) }} <span class="text-sm font-medium text-gray-400">SKUs</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-emerald-700 font-semibold">{{ inStockPercentage }}% Catalog Circulating</span>
              <span>{{ formatNumber(data.inventory.totalProducts) }} Total</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        </div>

        <!-- 2. Non-Moving Dead Stock Capital -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-rose-700 font-bold">Dead Stock Capital Locked</span>
            <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
              {{ formatCrores(data.movement.totalDeadStockCapital) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-rose-600 font-bold">{{ data.movement.deadStock.length }} Zero-Sale SKUs</span>
              <span class="text-rose-700 underline cursor-pointer" @click="movementSubTab = 'dead'">View list &rarr;</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-600"></div>
        </div>

        <!-- 3. Stockout Risk (High Demand, Low Stock) -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-amber-700 font-bold">Stockout Risk (High Demand)</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Flame class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
              {{ data.movement.stockoutRisk.length }} <span class="text-sm font-medium text-gray-400">Depleted Items</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-amber-700 font-medium">Stock &le; 10 units</span>
              <span class="text-amber-700 underline cursor-pointer" @click="movementSubTab = 'risk'">Reorder items &rarr;</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
        </div>

        <!-- 4. Negative Stock Over-Dispatches -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Negative Stock Audit</span>
            <div class="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-200">
              <Clock class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ data.inventory.negativeStockCount }} <span class="text-sm font-medium text-gray-400">Items</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-rose-600 font-semibold">Over-Dispatched in ERP</span>
              <span class="text-gray-700 underline cursor-pointer" @click="movementSubTab = 'negative'">Inspect &rarr;</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-400 to-gray-600"></div>
        </div>
      </div>

      <!-- Monthly Movement Trendline (Inflow vs Outflow) -->
      <div v-if="data.movement.monthlyFlow && data.movement.monthlyFlow.length > 0" class="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
          <div>
            <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp class="w-5 h-5 text-sky-600" />
              Monthly Warehouse Movement Velocity (Inflow vs Outflow)
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
            v-for="m in data.movement.monthlyFlow" 
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

      <!-- Movement Explorer Card with Sub-Tabs (Fast-Moving, Dead Stock, Stockout Risk, Negative Stock) -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs flex flex-col">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
          <!-- Movement Sub-Tabs -->
          <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80 flex-wrap gap-1">
            <button
              @click="movementSubTab = 'fast'"
              class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              :class="movementSubTab === 'fast' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
            >
              <Zap class="w-3.5 h-3.5 text-emerald-600" />
              <span>Fast-Moving SKUs</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">{{ data.movement.fastMoving.length }}</span>
            </button>

            <button
              @click="movementSubTab = 'dead'"
              class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              :class="movementSubTab === 'dead' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
            >
              <AlertTriangle class="w-3.5 h-3.5 text-rose-600" />
              <span>Non-Moving Dead Stock</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">{{ data.movement.deadStock.length }}</span>
            </button>

            <button
              @click="movementSubTab = 'risk'"
              class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              :class="movementSubTab === 'risk' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
            >
              <Flame class="w-3.5 h-3.5 text-amber-600" />
              <span>Stockout Risk</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">{{ data.movement.stockoutRisk.length }}</span>
            </button>

            <button
              @click="movementSubTab = 'negative'"
              class="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              :class="movementSubTab === 'negative' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
            >
              <span>Negative Stock Audit</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700 font-bold">{{ data.movement.negativeStock.length }}</span>
            </button>
          </div>

          <!-- Search filter -->
          <div class="relative w-full sm:w-64">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="movementSearchQuery"
              type="text"
              placeholder="Search items in this view..."
              class="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <!-- 1. FAST MOVING SKUS VIEW -->
        <div v-if="movementSubTab === 'fast'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3 mb-3 bg-emerald-50 rounded-xl border border-emerald-200/70 text-xs text-emerald-900 flex items-center justify-between">
            <span class="font-medium">Top velocity products driving regular warehouse dispatches with estimated stock runway</span>
            <span class="font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-md">High Turnover</span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Product / SKU</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Units Sold</th>
                <th class="py-2.5 font-medium text-right">Revenue</th>
                <th class="py-2.5 font-medium text-right">Current Stock</th>
                <th class="py-2.5 font-medium text-right">Stock Cover (Runway)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="(p, idx) in filteredFastMoving" 
                :key="p.name"
                class="hover:bg-emerald-50/30 transition-colors"
              >
                <td class="py-3 pr-2">
                  <div class="font-bold text-gray-900 truncate max-w-[240px]" :title="p.name">
                    <span class="text-gray-400 font-mono text-[11px] mr-1">#{{ idx + 1 }}</span>
                    {{ p.name }}
                  </div>
                  <div class="text-[10.5px] text-gray-400 font-mono">{{ p.sku || '' }}</div>
                </td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right">
                  <span class="font-extrabold text-gray-900">{{ formatNumber(p.qtySold) }}</span>
                  <span class="block text-[10px] text-gray-400">{{ p.voucherCount }} vouchers</span>
                </td>
                <td class="py-3 px-2 text-right font-bold text-emerald-700">
                  {{ formatCurrency(p.revenue) }}
                </td>
                <td class="py-3 px-2 text-right font-extrabold text-gray-900">
                  {{ formatNumber(p.currentStock) }}
                </td>
                <td class="py-3 pl-2 text-right">
                  <span 
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold"
                    :class="p.daysOfSupply > 30 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : p.daysOfSupply > 10 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
                  >
                    {{ p.daysOfSupply > 0 ? `${p.daysOfSupply} Days Left` : 'Exhausted' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2. NON-MOVING DEAD STOCK VIEW -->
        <div v-if="movementSubTab === 'dead'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3.5 mb-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0" />
              <span><strong>Capital Drain Alert:</strong> SKUs sitting in the warehouse with high idle stock and <strong>0 sales recorded</strong>.</span>
            </div>
            <span class="font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md shrink-0">
              Total Locked: {{ formatCrores(data.movement.totalDeadStockCapital) }}
            </span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Dead Stock Product</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Landed Unit Cost</th>
                <th class="py-2.5 font-medium text-right">Idle Warehouse Stock</th>
                <th class="py-2.5 font-medium text-right text-rose-700">Capital Locked (₹)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="(p, idx) in filteredDeadStock" 
                :key="p.id"
                class="hover:bg-rose-50/40 transition-colors"
              >
                <td class="py-3 pr-2">
                  <div class="font-bold text-gray-900 truncate max-w-[240px]" :title="p.name">
                    <span class="text-gray-400 font-mono text-[11px] mr-1">#{{ idx + 1 }}</span>
                    {{ p.name }}
                  </div>
                  <div class="text-[10.5px] text-gray-400 font-mono">{{ p.sku }}</div>
                </td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right font-medium text-gray-700">
                  {{ formatCurrency(p.costPrice) }}
                </td>
                <td class="py-3 px-2 text-right font-black text-gray-900">
                  {{ formatNumber(p.stock) }} units
                </td>
                <td class="py-3 pl-2 text-right font-black text-rose-600 text-sm">
                  {{ formatCurrency(p.capitalLocked) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 3. STOCKOUT RISK VIEW -->
        <div v-if="movementSubTab === 'risk'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3 mb-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-900 flex items-center justify-between">
            <span class="font-medium">Products with high customer sales frequency but warehouse stock is &le; 10 units (Immediate reorder needed)</span>
            <span class="font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md">Urgent PO Candidates</span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Product Name</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Vouchers Sold</th>
                <th class="py-2.5 font-medium text-right">Units Sold</th>
                <th class="py-2.5 font-medium text-right text-rose-600">Current Stock</th>
                <th class="py-2.5 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="p in filteredStockoutRisk" 
                :key="p.id"
                class="hover:bg-amber-50/40 transition-colors"
              >
                <td class="py-3 pr-2 font-bold text-gray-900 truncate max-w-[240px]">
                  {{ p.name }}
                </td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right font-bold text-gray-800">{{ p.voucherCount }} bills</td>
                <td class="py-3 px-2 text-right font-extrabold text-gray-900">{{ formatNumber(p.qtySold) }}</td>
                <td class="py-3 px-2 text-right font-black text-rose-600 text-sm">
                  {{ p.stock }} units
                </td>
                <td class="py-3 pl-2 text-right">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {{ p.stock <= 0 ? 'CRITICAL OUT' : 'REORDER SOON' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 4. NEGATIVE STOCK AUDIT VIEW -->
        <div v-if="movementSubTab === 'negative'" class="mt-4 flex-1 overflow-x-auto">
          <div class="p-3 mb-3 bg-gray-100 rounded-xl border border-gray-200 text-xs text-gray-800 flex items-center justify-between">
            <span class="font-medium">Products with negative stock balance in ERP (Dispatches billed before inward GRN entry)</span>
            <span class="font-bold text-gray-900 bg-gray-200 px-2 py-0.5 rounded-md">{{ data.movement.negativeStock.length }} Over-Dispatches</span>
          </div>
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Product / SKU</th>
                <th class="py-2.5 font-medium">Category</th>
                <th class="py-2.5 font-medium text-right">Landed Cost</th>
                <th class="py-2.5 font-medium text-right">Sale Price</th>
                <th class="py-2.5 font-medium text-right text-rose-600">Negative Balance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="p in filteredNegativeStock" 
                :key="p.id"
                class="hover:bg-gray-50 transition-colors"
              >
                <td class="py-3 pr-2 font-bold text-gray-900 truncate max-w-[240px]">
                  {{ p.name }}
                </td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-[11px]">{{ p.category }}</span>
                </td>
                <td class="py-3 px-2 text-right text-gray-600">{{ formatCurrency(p.costPrice) }}</td>
                <td class="py-3 px-2 text-right text-gray-600">{{ formatCurrency(p.salePrice) }}</td>
                <td class="py-3 pl-2 text-right font-black text-rose-600 text-sm">
                  {{ p.stock }} units
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================================= -->
    <!-- PILLAR 3: PURCHASE & SUPPLY CHAIN ANALYSIS -->
    <!-- ========================================================================================= -->
    <div v-if="data && mainTab === 'purchases'" class="space-y-6">
      <!-- Purchase Executive KPIs (4 Cards) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Total Registered Suppliers -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Vendor Partners</span>
            <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Truck class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatNumber(data.purchases.totalSuppliers) }} <span class="text-sm font-medium text-gray-400">Suppliers</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-indigo-700 font-semibold">{{ data.purchases.gstRegistered }} GST Registered</span>
              <span class="text-gray-400">{{ Math.round((data.purchases.gstRegistered / data.purchases.totalSuppliers) * 100) }}% compliant</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-600"></div>
        </div>

        <!-- 2. Primary Credit Terms -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Standard Credit Terms</span>
            <div class="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Clock class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Net 30 Days
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-sky-700 font-semibold">Standard Industry Terms</span>
              <span class="text-gray-400">100% verified</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-sky-500"></div>
        </div>

        <!-- 3. Current Warehouse Book Capital (Cost) -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Warehouse Capital Investment</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <IndianRupee class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCrores(data.inventory.totalCostValue) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>Landed Purchase Cost</span>
              <span class="text-emerald-700 font-semibold">Book Value</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        </div>

        <!-- 4. Estimated Gross Retail Potential -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Retail Potential (Sale Value)</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Tag class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCrores(data.inventory.totalSaleValue) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-emerald-700 font-semibold">+{{ formatCrores(data.inventory.totalSaleValue - data.inventory.totalCostValue) }} Spread</span>
              <span class="text-amber-700 font-bold">+{{ grossMarginSpreadPercentage }}% Markup</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
        </div>
      </div>

      <!-- Category Procurement & Margin Spread Analysis -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs flex flex-col">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
          <div>
            <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
              <Boxes class="w-5 h-5 text-indigo-600" />
              Category Procurement Capital Allocation & Margin Spreads
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">Capital deployed across brands and product categories with cost-to-retail margin spread</p>
          </div>
          <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
            {{ data.purchases.categories.length }} Active Categories
          </span>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100 pb-2">
                <th class="py-2.5 font-medium">Category / Brand</th>
                <th class="py-2.5 font-medium text-right">SKUs</th>
                <th class="py-2.5 font-medium text-right">Warehouse Units</th>
                <th class="py-2.5 font-medium text-right">Landed Cost Value (Book)</th>
                <th class="py-2.5 font-medium text-right">Retail Potential (Sale)</th>
                <th class="py-2.5 font-medium text-right">Gross Margin Spread</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr 
                v-for="c in data.purchases.categories" 
                :key="c.name"
                class="hover:bg-indigo-50/30 transition-colors"
              >
                <td class="py-3 pr-2 font-bold text-gray-900 flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span>{{ c.name }}</span>
                </td>
                <td class="py-3 px-2 text-right text-gray-600 font-medium">{{ c.productCount }}</td>
                <td class="py-3 px-2 text-right font-bold text-gray-800">{{ formatNumber(c.totalUnits) }}</td>
                <td class="py-3 px-2 text-right font-extrabold text-gray-900">{{ formatCurrency(c.costValue) }}</td>
                <td class="py-3 px-2 text-right font-extrabold text-emerald-700">{{ formatCurrency(c.saleValue) }}</td>
                <td class="py-3 pl-2 text-right">
                  <span 
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                    :class="c.marginSpread >= 20 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'"
                  >
                    +{{ c.marginSpread }}% Spread
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
  IndianRupee, Boxes, Users, AlertTriangle, ShieldCheck, Tag, Clock, 
  RefreshCw, AlertCircle, Crown, Search, Building2, Truck, 
  TrendingUp, Flame, Zap, Activity 
} from 'lucide-vue-next'

const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<any | null>(null)

// Navigation state
const mainTab = ref<'sales' | 'movement' | 'purchases'>('sales')
const valuationMode = ref<'cost' | 'sale'>('cost')
const skuRankingMode = ref<'revenue' | 'volume'>('revenue')
const movementSubTab = ref<'fast' | 'dead' | 'risk' | 'negative'>('fast')

// Search filter state
const skuSearchQuery = ref('')
const customerSearchQuery = ref('')
const movementSearchQuery = ref('')

const fetchAnalytics = async (forceRefresh = false) => {
  loading.value = true
  error.value = null
  try {
    const url = forceRefresh ? '/api/analytics/summary?refresh=true' : '/api/analytics/summary'
    const res = await $fetch<any>(url)
    if (res && res.success) {
      data.value = res
    } else {
      throw new Error('Invalid response structure')
    }
  } catch (err: any) {
    console.error('Failed to fetch analytics:', err)
    error.value = err?.data?.message || err?.message || 'Server error loading analytics'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAnalytics()
})

// Channel computations
const channelSMG = computed(() => {
  return data.value?.sales?.channels?.find((ch: any) => ch.series === 'SMG')
})

const channelRetail = computed(() => {
  return data.value?.sales?.channels?.find((ch: any) => ch.series === 'RETAIL')
})

const averageInvoiceValue = computed(() => {
  const rev = data.value?.sales?.totalRevenue || 0
  const cnt = data.value?.sales?.totalVouchers || 1
  return Math.round(rev / cnt)
})

// Filtered SKUs for Sales Tab
const filteredSkus = computed(() => {
  if (!data.value?.sales) return []
  const list = skuRankingMode.value === 'revenue' 
    ? data.value.sales.highPerformingRevenue 
    : data.value.sales.highPerformingVolume

  if (!skuSearchQuery.value.trim()) return list

  const q = skuSearchQuery.value.toLowerCase().trim()
  return list.filter((p: any) => 
    p.name.toLowerCase().includes(q) || 
    (p.sku && p.sku.toLowerCase().includes(q)) ||
    (p.category && p.category.toLowerCase().includes(q))
  )
})

// Filtered Customers for Sales Tab
const filteredCustomers = computed(() => {
  if (!data.value?.sales?.topCustomers) return []
  const list = data.value.sales.topCustomers
  if (!customerSearchQuery.value.trim()) return list

  const q = customerSearchQuery.value.toLowerCase().trim()
  return list.filter((c: any) => 
    c.name.toLowerCase().includes(q) || 
    (c.customerCode && c.customerCode.toLowerCase().includes(q))
  )
})

// Filtered Items for Movement Tab
const filteredFastMoving = computed(() => {
  if (!data.value?.movement?.fastMoving) return []
  const list = data.value.movement.fastMoving
  if (!movementSearchQuery.value.trim()) return list
  const q = movementSearchQuery.value.toLowerCase().trim()
  return list.filter((p: any) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
})

const filteredDeadStock = computed(() => {
  if (!data.value?.movement?.deadStock) return []
  const list = data.value.movement.deadStock
  if (!movementSearchQuery.value.trim()) return list
  const q = movementSearchQuery.value.toLowerCase().trim()
  return list.filter((p: any) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
})

const filteredStockoutRisk = computed(() => {
  if (!data.value?.movement?.stockoutRisk) return []
  const list = data.value.movement.stockoutRisk
  if (!movementSearchQuery.value.trim()) return list
  const q = movementSearchQuery.value.toLowerCase().trim()
  return list.filter((p: any) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
})

const filteredNegativeStock = computed(() => {
  if (!data.value?.movement?.negativeStock) return []
  const list = data.value.movement.negativeStock
  if (!movementSearchQuery.value.trim()) return list
  const q = movementSearchQuery.value.toLowerCase().trim()
  return list.filter((p: any) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
})

// Stock percentages
const inStockPercentage = computed(() => {
  if (!data.value?.inventory?.totalProducts) return 0
  return Math.round((data.value.inventory.inStockCount / data.value.inventory.totalProducts) * 100)
})

const grossMarginSpreadPercentage = computed(() => {
  const cost = data.value?.inventory?.totalCostValue || 0
  const sale = data.value?.inventory?.totalSaleValue || 0
  if (cost === 0) return 0
  return Math.round(((sale - cost) / cost) * 100)
})

// Bar height calculator for Monthly Velocity Chart
const getBarHeight = (value: number) => {
  if (!data.value?.movement?.monthlyFlow || data.value.movement.monthlyFlow.length === 0) return 10
  const maxVal = Math.max(
    ...data.value.movement.monthlyFlow.map((m: any) => Math.max(m.inward || 0, m.outward || 0))
  )
  if (maxVal === 0) return 10
  return Math.max(8, Math.min(100, Math.round((value / maxVal) * 100)))
}

// Relative timestamp formatter
const formattedLastSynced = computed(() => {
  if (!data.value?.lastSynced) return null
  const d = new Date(data.value.lastSynced)
  if (isNaN(d.getTime())) return data.value.lastSynced
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

// Currency & Number Formatting Helpers
function formatNumber(num: number | string | undefined): string {
  if (num === undefined || num === null) return '0'
  return Number(num).toLocaleString('en-IN')
}

function formatCurrency(val: number | string | undefined): string {
  if (val === undefined || val === null) return '₹0'
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function formatCrores(val: number | string | undefined): string {
  if (val === undefined || val === null) return '₹0'
  const n = Number(val)
  if (n >= 10000000) {
    return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  }
  if (n >= 100000) {
    return '₹' + (n / 100000).toFixed(2) + ' L'
  }
  return formatCurrency(n)
}
</script>