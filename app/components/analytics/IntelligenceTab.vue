<template>
  <div class="space-y-6">
    <!-- Header with Live Sync Status & Primary PO Simulator CTA -->
    <div class="bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-200/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-300 text-purple-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <Sparkles class="w-5 h-5 text-purple-700" />
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-base sm:text-lg font-bold text-gray-900">Distribution Intelligence Suite</h2>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Deterministic Math Core
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live BUSY + Tally Cross-Check
            </span>
          </div>
          <p class="text-xs sm:text-sm text-gray-600 mt-1">
            Data-driven operations: Reorder Points, 7/15/30-day forecast, profit quadrants, credit-safe customer cross-sell, and PO simulation.
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5 shrink-0 self-end md:self-center">
        <!-- PO Simulator CTA -->
        <button
          @click="openPOSimulator(suggestedReorderItems)"
          class="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl text-white bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-600/20 transition-all cursor-pointer active:scale-95"
        >
          <Sparkles class="w-4 h-4" />
          <span>PO Pre-Flight Auditor</span>
        </button>

        <!-- Refresh Button -->
        <button
          @click="fetchData(true)"
          :disabled="loading"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5 text-gray-500" :class="{ 'animate-spin': loading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
      <AlertCircle class="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div class="flex-1 text-sm">
        <p class="font-medium">Failed to calculate intelligence</p>
        <p class="mt-0.5 text-red-700">{{ error }}</p>
      </div>
      <button @click="fetchData(true)" class="text-xs font-semibold text-red-700 underline hover:text-red-900">Try again</button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !data" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-3 animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-28"></div>
          <div class="h-8 bg-gray-200 rounded w-36"></div>
          <div class="h-3 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
      <div class="h-96 rounded-2xl bg-white border border-gray-200 p-6 animate-pulse"></div>
    </div>

    <!-- Data Loaded -->
    <div v-if="data" class="space-y-6">
      <!-- 4 Executive KPI Metric Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Urgent Reorders Due -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-rose-700">Reorders Required</span>
            <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight flex items-baseline gap-1">
              <OdometerNumber :value="data.kpis.criticalReordersCount" :loading="loading" />
              <span class="text-sm font-medium text-gray-400">SKUs</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-rose-600 font-semibold">Stock &le; Reorder Point</span>
              <button 
                @click="subEngineTab = 'replenishment'" 
                class="text-rose-700 underline font-semibold cursor-pointer"
              >
                View SKUs &rarr;
              </button>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-600"></div>
        </div>

        <!-- 2. Dead Stock Capital Locked -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-amber-700">Dead Stock Capital</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Lock class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight flex items-baseline">
              <OdometerNumber 
                :value="data.kpis.totalCapitalLockedDead >= 10000000 ? Number((data.kpis.totalCapitalLockedDead / 10000000).toFixed(2)) : data.kpis.totalCapitalLockedDead" 
                prefix="₹" 
                :suffix="data.kpis.totalCapitalLockedDead >= 10000000 ? ' Cr' : ''" 
                :decimals="data.kpis.totalCapitalLockedDead >= 10000000 ? 2 : 0" 
                :loading="loading" 
              />
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>{{ formatCurrency(data.kpis.totalCapitalLockedDead) }}</span>
              <span class="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">0-Sale Inventory</span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
        </div>

        <!-- 3. Demand Momentum Ratio -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-emerald-700">Demand Momentum</span>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <TrendingUp class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-baseline gap-2">
              <span class="text-emerald-600 font-black">+{{ data.kpis.growingCount }}</span>
              <span class="text-gray-300 font-normal">/</span>
              <span class="text-rose-500 font-bold">-{{ data.kpis.decliningCount }}</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-emerald-700 font-semibold">Growing vs Declining</span>
              <button 
                @click="subEngineTab = 'trends'" 
                class="text-indigo-700 underline font-semibold cursor-pointer"
              >
                Forecasts &rarr;
              </button>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
        </div>

        <!-- 4. Active Anomaly Watchdog -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-purple-700">Risk & Anomaly Alerts</span>
            <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <ShieldAlert class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-purple-900 tracking-tight flex items-baseline gap-1">
              <OdometerNumber :value="data.kpis.activeAnomaliesCount" :loading="loading" />
              <span class="text-sm font-medium text-gray-400">Triggers</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="text-purple-700 font-medium">Surges, Churn & Leaks</span>
              <button 
                @click="subEngineTab = 'anomalies'" 
                class="text-purple-700 underline font-semibold cursor-pointer"
              >
                Review &rarr;
              </button>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
        </div>
      </div>

      <!-- Sub-Engine Navigation Switcher -->
      <div class="border-b border-gray-200">
        <nav class="flex space-x-2 sm:space-x-4 overflow-x-auto no-scrollbar" aria-label="Engines">
          <!-- Engine 1 -->
          <button
            @click="subEngineTab = 'replenishment'"
            class="py-2.5 px-3 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
            :class="subEngineTab === 'replenishment' ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <Truck class="w-4 h-4 text-purple-600" />
            <span>1. Replenishment & Runway</span>
            <span class="px-2 py-0.5 text-[11px] rounded-full bg-rose-100 text-rose-800 font-bold ml-1">
              {{ data.kpis.criticalReordersCount }}
            </span>
          </button>

          <!-- Engine 2 -->
          <button
            @click="subEngineTab = 'trends'"
            class="py-2.5 px-3 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
            :class="subEngineTab === 'trends' ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <TrendingUp class="w-4 h-4 text-emerald-600" />
            <span>2. Trends & Demand Forecast</span>
          </button>

          <!-- Engine 3 -->
          <button
            @click="subEngineTab = 'profitability'"
            class="py-2.5 px-3 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
            :class="subEngineTab === 'profitability' ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <IndianRupee class="w-4 h-4 text-amber-600" />
            <span>3. Profit & Capital Quadrants</span>
          </button>

          <!-- Engine 4 -->
          <button
            @click="subEngineTab = 'customers'"
            class="py-2.5 px-3 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
            :class="subEngineTab === 'customers' ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <Users class="w-4 h-4 text-indigo-600" />
            <span>4. Credit-Safe Cross-Sell</span>
          </button>

          <!-- Engine 5 -->
          <button
            @click="subEngineTab = 'anomalies'"
            class="py-2.5 px-3 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
            :class="subEngineTab === 'anomalies' ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <ShieldAlert class="w-4 h-4 text-rose-600" />
            <span>5. Anomaly Watchdog</span>
            <span v-if="data.kpis.activeAnomaliesCount > 0" class="px-2 py-0.5 text-[11px] rounded-full bg-purple-100 text-purple-800 font-bold ml-1">
              {{ data.kpis.activeAnomaliesCount }}
            </span>
          </button>
        </nav>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-ENGINE 1: REPLENISHMENT & STOCK RUNWAY -->
      <!-- ========================================================================= -->
      <div v-if="subEngineTab === 'replenishment'" class="space-y-4">
        <!-- Filter Controls -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              v-for="st in ['ALL', 'CRITICAL', 'REORDER', 'STOCKOUT', 'OVERSTOCKED']"
              :key="st"
              @click="replenishmentFilter = st"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              :class="replenishmentFilter === st ? 'bg-purple-600 text-white shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >
              {{ st === 'ALL' ? 'All Items' : st === 'CRITICAL' ? 'Critical (<7d)' : st === 'REORDER' ? 'Reorder Due' : st === 'STOCKOUT' ? 'Out of Stock' : 'Overstocked (>60d)' }}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative w-full sm:w-64">
              <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                v-model="replenishmentSearch"
                type="text"
                placeholder="Search SKU or Category..."
                class="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <button
              @click="openPOSimulator(filteredReplenishment.filter(i => i.suggestedPOQty > 0))"
              :disabled="filteredReplenishment.filter(i => i.suggestedPOQty > 0).length === 0"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              title="Audit filtered items in PO Simulator"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>Audit in PO Simulator</span>
            </button>
          </div>
        </div>

        <!-- Replenishment Table -->
        <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs divide-y divide-gray-200">
              <thead class="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-3">Product Name</th>
                  <th class="py-3 px-2">Category</th>
                  <th class="py-3 px-2 text-right">In Stock</th>
                  <th class="py-3 px-2 text-right">Daily Sales (ADS)</th>
                  <th class="py-3 px-2 text-center">Runway</th>
                  <th class="py-3 px-2 text-right">Safety Stock</th>
                  <th class="py-3 px-2 text-right">Reorder Point (ROP)</th>
                  <th class="py-3 px-2 text-right">Suggested Order</th>
                  <th class="py-3 px-2 text-center">Status</th>
                  <th class="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr 
                  v-for="item in filteredReplenishment" 
                  :key="item.id"
                  class="hover:bg-purple-50/30 transition-colors"
                >
                  <td class="py-3 px-3 font-semibold text-gray-900 max-w-[220px] truncate" :title="item.name">
                    {{ item.name }}
                  </td>
                  <td class="py-3 px-2 text-gray-500">
                    {{ item.category }}
                  </td>
                  <td class="py-3 px-2 text-right font-bold" :class="item.stock <= 0 ? 'text-red-600' : 'text-gray-900'">
                    {{ item.stock }}
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600 font-medium">
                    {{ item.activeAds }} /day
                  </td>
                  <td class="py-3 px-2 text-center">
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
                      :class="item.runwayDays < 7 ? 'bg-rose-100 text-rose-800' : item.runwayDays <= 14 ? 'bg-amber-100 text-amber-800' : item.runwayDays > 60 ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'"
                    >
                      {{ item.runwayDays >= 999 ? 'Dead' : item.runwayDays + ' d' }}
                    </span>
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600">
                    {{ item.safetyStock }}
                  </td>
                  <td class="py-3 px-2 text-right font-bold text-gray-900">
                    {{ item.reorderPoint }}
                  </td>
                  <td class="py-3 px-2 text-right font-black text-purple-700">
                    {{ item.suggestedPOQty > 0 ? item.suggestedPOQty + ' units' : '—' }}
                  </td>
                  <td class="py-3 px-2 text-center">
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                      :class="item.status === 'STOCKOUT' ? 'bg-red-100 text-red-800' : item.status === 'CRITICAL_RUNOUT' ? 'bg-rose-100 text-rose-800' : item.status === 'REORDER_DUE' ? 'bg-amber-100 text-amber-800' : item.status === 'OVERSTOCKED' ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-700'"
                    >
                      {{ item.status.replace('_', ' ') }}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-center">
                    <button
                      v-if="item.suggestedPOQty > 0"
                      @click="openPOSimulator([item])"
                      class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer transition-colors"
                      title="Test this item in simulator"
                    >
                      Audit
                    </button>
                    <span v-else class="text-gray-300 text-[11px]">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-ENGINE 2: TRENDS & DEMAND FORECASTING -->
      <!-- ========================================================================= -->
      <div v-if="subEngineTab === 'trends'" class="space-y-4">
        <!-- LIVE WEEKLY FORECAST VALIDATION SCORECARD (Improvement #5) -->
        <div v-if="data?.weeklyScorecard" class="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0">
                <Target class="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm sm:text-base font-bold text-gray-900">Weekly Forecast Validation Scorecard</h3>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Live Realized Tracking
                  </span>
                </div>
                <p class="text-xs text-gray-600 mt-0.5">
                  Validates the past 7-day predicted demand against actual invoices received this week to verify algorithm precision.
                </p>
              </div>
            </div>

            <!-- Toggle Audit Table -->
            <button
              @click="showScorecardAudit = !showScorecardAudit"
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer shrink-0 shadow-2xs self-end sm:self-center"
            >
              <span>{{ showScorecardAudit ? 'Hide Audit Details' : 'View Item-by-Item Audit' }}</span>
              <ChevronUp v-if="showScorecardAudit" class="w-3.5 h-3.5" />
              <ChevronDown v-else class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 4 Scorecard KPI Metrics -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <!-- 1. Catalog Accuracy -->
            <div class="bg-white rounded-xl p-3 border border-emerald-200 shadow-2xs">
              <span class="text-[10px] font-bold text-gray-500 uppercase">Catalog Volume Accuracy</span>
              <div class="mt-1 text-xl sm:text-2xl font-black text-emerald-700">
                {{ data.weeklyScorecard.catalogAccuracy }}%
              </div>
              <span class="text-[10px] text-gray-400">Past 7 days aggregate</span>
            </div>

            <!-- 2. Predicted Units -->
            <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-2xs">
              <span class="text-[10px] font-bold text-gray-500 uppercase">Predicted 7-Day Units</span>
              <div class="mt-1 text-xl sm:text-2xl font-black text-indigo-900">
                {{ formatNumber(data.weeklyScorecard.totalPredictedUnits) }}
              </div>
              <span class="text-[10px] text-indigo-600 font-medium">Prior baseline pace</span>
            </div>

            <!-- 3. Actual Units Sold -->
            <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-2xs">
              <span class="text-[10px] font-bold text-gray-500 uppercase">Actual Realized Units</span>
              <div class="mt-1 text-xl sm:text-2xl font-black text-gray-900">
                {{ formatNumber(data.weeklyScorecard.totalActualUnits) }}
              </div>
              <span class="text-[10px] text-gray-500">Live BUSY invoices</span>
            </div>

            <!-- 4. Demand Matches -->
            <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-2xs">
              <span class="text-[10px] font-bold text-gray-500 uppercase">On-Target SKUs</span>
              <div class="mt-1 text-xl sm:text-2xl font-black text-teal-800">
                {{ data.weeklyScorecard.matchCount }}
              </div>
              <span class="text-[10px] text-teal-600 font-medium">Within target runway</span>
            </div>
          </div>

          <!-- Expandable Line-by-Line Audit Table -->
          <div v-if="showScorecardAudit" class="bg-white rounded-xl border border-emerald-200 overflow-hidden shadow-2xs animate-in fade-in duration-200">
            <div class="p-3 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
              <span class="text-xs font-bold uppercase text-emerald-900">Top Validated Products This Week</span>
              <span class="text-[11px] text-gray-500">Predicted (prior pace) vs Actual (billed this week)</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs divide-y divide-gray-100">
                <thead class="bg-gray-50/70 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th class="py-2 px-3">Product</th>
                    <th class="py-2 px-3 text-right">Predicted</th>
                    <th class="py-2 px-3 text-right">Actual Realized</th>
                    <th class="py-2 px-3 text-right">Variance</th>
                    <th class="py-2 px-3 text-center">Accuracy %</th>
                    <th class="py-2 px-3 text-center">Status Signal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(it, iIdx) in data.weeklyScorecard.topValidatedItems" :key="iIdx" class="hover:bg-emerald-50/30">
                    <td class="py-2.5 px-3 font-semibold text-gray-900 max-w-[200px] truncate" :title="it.name">
                      {{ it.name }}
                    </td>
                    <td class="py-2.5 px-3 text-right font-medium text-indigo-700">
                      {{ formatNumber(it.predicted) }}
                    </td>
                    <td class="py-2.5 px-3 text-right font-bold text-gray-900">
                      {{ formatNumber(it.actual) }}
                    </td>
                    <td class="py-2.5 px-3 text-right font-bold" :class="it.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'">
                      {{ it.variance > 0 ? '+' : '' }}{{ formatNumber(it.variance) }}
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <span 
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black"
                        :class="it.accuracyPct >= 80 ? 'bg-emerald-100 text-emerald-800' : it.accuracyPct >= 50 ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-700'"
                      >
                        {{ it.accuracyPct }}%
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <span 
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                        :class="it.status === 'EXACT_MATCH' ? 'bg-emerald-100 text-emerald-800' : it.status === 'CLOSE' ? 'bg-teal-100 text-teal-800' : it.status === 'DEMAND_SURGE' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'"
                      >
                        <CheckCircle2 v-if="it.status === 'EXACT_MATCH'" class="w-3 h-3" />
                        <span>{{ it.status.replace('_', ' ') }}</span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Trend Filters -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              v-for="tr in ['ALL', 'GROWING', 'STABLE', 'DECLINING', 'NOT_MOVING']"
              :key="tr"
              @click="trendFilter = tr"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              :class="trendFilter === tr ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >
              {{ tr === 'ALL' ? 'All Trends' : tr === 'GROWING' ? '⚡ Growing (+25%)' : tr === 'STABLE' ? 'Stable' : tr === 'DECLINING' ? '🔻 Declining (-25%)' : 'Non-Moving' }}
            </button>
          </div>

          <div class="relative w-full sm:w-64">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="trendSearch"
              type="text"
              placeholder="Search product..."
              class="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <!-- Trends Table -->
        <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs divide-y divide-gray-200">
              <thead class="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-3">Product Name</th>
                  <th class="py-3 px-2">Category</th>
                  <th class="py-3 px-2 text-center">Trend Signal</th>
                  <th class="py-3 px-2 text-right">Velocity Ratio</th>
                  <th class="py-3 px-2 text-right">14d Daily Rate</th>
                  <th class="py-3 px-2 text-right">60d Daily Rate</th>
                  <th class="py-3 px-2 text-right font-bold text-indigo-700">7-Day Forecast</th>
                  <th class="py-3 px-2 text-right font-bold text-indigo-800">15-Day Forecast</th>
                  <th class="py-3 px-3 text-right font-bold text-purple-900">30-Day Forecast</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr 
                  v-for="item in filteredTrends" 
                  :key="item.id"
                  class="hover:bg-emerald-50/30 transition-colors"
                >
                  <td class="py-3 px-3 font-semibold text-gray-900 max-w-[220px] truncate" :title="item.name">
                    {{ item.name }}
                  </td>
                  <td class="py-3 px-2 text-gray-500">
                    {{ item.category }}
                  </td>
                  <td class="py-3 px-2 text-center">
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                      :class="item.trend === 'GROWING' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : item.trend === 'STABLE' ? 'bg-sky-50 text-sky-700 border border-sky-200' : item.trend === 'DECLINING' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-gray-100 text-gray-600'"
                    >
                      {{ item.trend.replace('_', ' ') }}
                    </span>
                  </td>
                  <td class="py-3 px-2 text-right font-bold" :class="item.velocityRatio >= 1.25 ? 'text-emerald-700' : item.velocityRatio <= 0.75 && item.velocityRatio > 0 ? 'text-rose-700' : 'text-gray-700'">
                    {{ item.velocityRatio }}x
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600">
                    {{ item.ads14 }} /d
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600">
                    {{ item.ads60 }} /d
                  </td>
                  <td class="py-3 px-2 text-right font-bold text-indigo-700">
                    {{ item.forecast7d }} units
                  </td>
                  <td class="py-3 px-2 text-right font-bold text-indigo-800">
                    {{ item.forecast15d }} units
                  </td>
                  <td class="py-3 px-3 text-right font-black text-purple-900">
                    {{ item.forecast30d }} units
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-ENGINE 3: PROFITABILITY & CAPITAL QUADRANTS -->
      <!-- ========================================================================= -->
      <div v-if="subEngineTab === 'profitability'" class="space-y-4">
        <!-- 4 Quadrant Explainer Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div 
            @click="quadrantFilter = 'STAR'"
            class="p-4 rounded-xl border cursor-pointer transition-all"
            :class="quadrantFilter === 'STAR' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20' : 'bg-white border-gray-200 hover:border-emerald-300'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-black uppercase text-emerald-800">⭐ Stars</span>
              <span class="text-xs font-bold text-emerald-700">High Vol + High Margin</span>
            </div>
            <p class="text-[11px] text-gray-600 mt-1">Primary profit drivers. Never allow stockouts.</p>
          </div>

          <div 
            @click="quadrantFilter = 'CASH_COW'"
            class="p-4 rounded-xl border cursor-pointer transition-all"
            :class="quadrantFilter === 'CASH_COW' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20' : 'bg-white border-gray-200 hover:border-blue-300'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-black uppercase text-blue-800">🐄 Cash Cows</span>
              <span class="text-xs font-bold text-blue-700">High Vol + Low Margin</span>
            </div>
            <p class="text-[11px] text-gray-600 mt-1">High volume turnover. Optimize logistics & cost.</p>
          </div>

          <div 
            @click="quadrantFilter = 'NICHE_GEM'"
            class="p-4 rounded-xl border cursor-pointer transition-all"
            :class="quadrantFilter === 'NICHE_GEM' ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-500/20' : 'bg-white border-gray-200 hover:border-purple-300'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-black uppercase text-purple-800">💎 Niche Gems</span>
              <span class="text-xs font-bold text-purple-700">Low Vol + High Margin</span>
            </div>
            <p class="text-[11px] text-gray-600 mt-1">High profitability. Actively cross-sell to clients.</p>
          </div>

          <div 
            @click="quadrantFilter = 'DRAIN'"
            class="p-4 rounded-xl border cursor-pointer transition-all"
            :class="quadrantFilter === 'DRAIN' ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/20' : 'bg-white border-gray-200 hover:border-rose-300'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-black uppercase text-rose-800">⚠️ Drains</span>
              <span class="text-xs font-bold text-rose-700">Low Vol + Low Margin</span>
            </div>
            <p class="text-[11px] text-gray-600 mt-1">Capital drags. Discount or liquidate immediately.</p>
          </div>
        </div>

        <!-- Profitability Table -->
        <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <div class="p-3 border-b border-gray-200 flex items-center justify-between">
            <span class="text-xs font-bold uppercase text-gray-700">Catalog Profitability & Working Capital</span>
            <button 
              v-if="quadrantFilter !== 'ALL'"
              @click="quadrantFilter = 'ALL'"
              class="text-xs font-semibold text-purple-700 underline cursor-pointer"
            >
              Reset to All SKUs
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs divide-y divide-gray-200">
              <thead class="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-3">Product Name</th>
                  <th class="py-3 px-2">Category</th>
                  <th class="py-3 px-2 text-center">Quadrant</th>
                  <th class="py-3 px-2 text-right">Cost Price</th>
                  <th class="py-3 px-2 text-right">Selling Price</th>
                  <th class="py-3 px-2 text-right">Gross Margin %</th>
                  <th class="py-3 px-2 text-right">30d Sold Units</th>
                  <th class="py-3 px-3 text-right">Capital Locked</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr 
                  v-for="item in filteredProfitability" 
                  :key="item.id"
                  class="hover:bg-amber-50/20 transition-colors"
                >
                  <td class="py-3 px-3 font-semibold text-gray-900 max-w-[220px] truncate" :title="item.name">
                    {{ item.name }}
                  </td>
                  <td class="py-3 px-2 text-gray-500">
                    {{ item.category }}
                  </td>
                  <td class="py-3 px-2 text-center">
                    <span 
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                      :class="item.quadrant === 'STAR' ? 'bg-emerald-100 text-emerald-800' : item.quadrant === 'CASH_COW' ? 'bg-blue-100 text-blue-800' : item.quadrant === 'NICHE_GEM' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'"
                    >
                      {{ item.quadrant.replace('_', ' ') }}
                    </span>
                  </td>
                  <td class="py-3 px-2 text-right text-gray-600">
                    ₹{{ formatNumber(item.costPrice) }}
                  </td>
                  <td class="py-3 px-2 text-right font-medium text-gray-900">
                    ₹{{ formatNumber(item.salePrice) }}
                  </td>
                  <td class="py-3 px-2 text-right font-bold" :class="item.grossMarginPct >= 12 ? 'text-emerald-700' : item.grossMarginPct <= 3 ? 'text-rose-700' : 'text-gray-800'">
                    {{ item.grossMarginPct }}%
                  </td>
                  <td class="py-3 px-2 text-right text-gray-700 font-semibold">
                    {{ item.qty30 }}
                  </td>
                  <td class="py-3 px-3 text-right font-bold text-gray-900">
                    ₹{{ formatNumber(item.capitalLocked) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-ENGINE 4: CREDIT-SAFE CUSTOMER PUSH & CROSS-SELLING -->
      <!-- ========================================================================= -->
      <div v-if="subEngineTab === 'customers'" class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left: Customer RFM Segmentation with Credit Filter -->
          <div class="lg:col-span-7 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col">
            <div class="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">RFM Customer Engagement</h3>
                <p class="text-[11px] text-gray-500">Recency & Frequency segmentation with Tally overdue flags</p>
              </div>
              <span class="text-xs text-gray-400">{{ data.customers.length }} Accounts</span>
            </div>

            <div class="overflow-x-auto flex-1">
              <table class="w-full text-left text-xs divide-y divide-gray-200">
                <thead class="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th class="py-2.5 px-3">Customer</th>
                    <th class="py-2.5 px-2 text-center">Segment</th>
                    <th class="py-2.5 px-2 text-right">Recency</th>
                    <th class="py-2.5 px-2 text-right">Invoices</th>
                    <th class="py-2.5 px-2 text-right">Total Revenue</th>
                    <th class="py-2.5 px-3 text-center">Credit Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr 
                    v-for="c in data.customers" 
                    :key="c.customerCode"
                    class="hover:bg-indigo-50/20 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-semibold text-gray-900 max-w-[160px] truncate" :title="c.customerName">
                      {{ c.customerName }}
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      <span 
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black"
                        :class="c.segment === 'CHAMPION' ? 'bg-emerald-100 text-emerald-800' : c.segment === 'LOYAL' ? 'bg-indigo-100 text-indigo-800' : c.segment === 'AT_RISK' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'"
                      >
                        {{ c.segment }}
                      </span>
                    </td>
                    <td class="py-2.5 px-2 text-right text-gray-600 font-medium">
                      {{ c.recencyDays }}d ago
                    </td>
                    <td class="py-2.5 px-2 text-right text-gray-700 font-bold">
                      {{ c.frequency }}
                    </td>
                    <td class="py-2.5 px-2 text-right font-black text-gray-900">
                      ₹{{ formatNumber(c.monetary) }}
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <span 
                        v-if="c.isCreditRisky"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                        :title="'Pending balance: ₹' + formatNumber(c.overdueBalance)"
                      >
                        <AlertTriangle class="w-3 h-3" />
                        Hold Credit
                      </span>
                      <span 
                        v-else
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        Push Safe
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right: Market Basket Product Affinity Pairs -->
          <div class="lg:col-span-5 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col">
            <div class="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">Top Cross-Selling Affinities</h3>
                <p class="text-[11px] text-gray-500">Co-purchased pairs from historical invoice baskets</p>
              </div>
              <span class="text-xs font-semibold text-purple-700">Market Basket Math</span>
            </div>

            <div class="overflow-x-auto flex-1">
              <table class="w-full text-left text-xs divide-y divide-gray-200">
                <thead class="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th class="py-2.5 px-3">When Buying Product A</th>
                    <th class="py-2.5 px-3">Also Pitch Product B</th>
                    <th class="py-2.5 px-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr 
                    v-for="(pair, pIdx) in data.crossSellingPairs" 
                    :key="pIdx"
                    class="hover:bg-purple-50/20 transition-colors"
                  >
                    <td class="py-2.5 px-3 font-medium text-gray-900 max-w-[130px] truncate" :title="pair.itemA">
                      {{ pair.itemA }}
                    </td>
                    <td class="py-2.5 px-3 font-bold text-purple-900 max-w-[130px] truncate" :title="pair.itemB">
                      👉 {{ pair.itemB }}
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800">
                        {{ pair.confidence }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- SUB-ENGINE 5: ANOMALY & RISK WATCHDOG -->
      <!-- ========================================================================= -->
      <div v-if="subEngineTab === 'anomalies'" class="space-y-3">
        <div 
          v-for="(alert, aIdx) in data.anomalies" 
          :key="aIdx"
          class="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
          :class="alert.severity === 'CRITICAL' ? 'bg-rose-50/80 border-rose-200' : alert.severity === 'HIGH' ? 'bg-amber-50/80 border-amber-200' : 'bg-purple-50/80 border-purple-200'"
        >
          <div class="flex items-start gap-3">
            <div 
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border"
              :class="alert.severity === 'CRITICAL' ? 'bg-rose-100 border-rose-300 text-rose-700' : alert.severity === 'HIGH' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-purple-100 border-purple-300 text-purple-700'"
            >
              <ShieldAlert class="w-4 h-4" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-black uppercase tracking-wider" :class="alert.severity === 'CRITICAL' ? 'text-rose-900' : alert.severity === 'HIGH' ? 'text-amber-900' : 'text-purple-900'">
                  {{ alert.title }}
                </span>
                <span 
                  class="text-[10px] font-black px-2 py-0.2 rounded-full uppercase"
                  :class="alert.severity === 'CRITICAL' ? 'bg-rose-200 text-rose-900' : alert.severity === 'HIGH' ? 'bg-amber-200 text-amber-900' : 'bg-purple-200 text-purple-900'"
                >
                  {{ alert.severity }}
                </span>
              </div>
              <p class="text-xs text-gray-700 mt-1 leading-relaxed">
                {{ alert.detail }}
              </p>
            </div>
          </div>

          <div class="self-end sm:self-center shrink-0">
            <span class="text-xs font-bold px-3 py-1.5 rounded-xl border bg-white shadow-2xs text-gray-800">
              Action: {{ alert.action }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- PO Pre-Flight Auditor & Simulator Modal -->
    <POSimulatorModal 
      :is-open="isPOSimulatorOpen" 
      :suggested-items="activePOSimulatorItems"
      @close="isPOSimulatorOpen = false" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Lock,
  TrendingUp,
  ShieldAlert,
  Truck,
  IndianRupee,
  Users,
  Search,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-vue-next'
import POSimulatorModal from './POSimulatorModal.vue'

const loading = ref(false)
const error = ref<string | null>(null)
const data = ref<any>(null)
const showScorecardAudit = ref(false)

// Sub-Engine Tab State
const subEngineTab = ref<'replenishment' | 'trends' | 'profitability' | 'customers' | 'anomalies'>('replenishment')

// Search & Filter States
const replenishmentFilter = ref('ALL')
const replenishmentSearch = ref('')

const trendFilter = ref('ALL')
const trendSearch = ref('')

const quadrantFilter = ref('ALL')

// PO Simulator Modal State
const isPOSimulatorOpen = ref(false)
const activePOSimulatorItems = ref<any[]>([])

async function fetchData(forceRefresh = false) {
  loading.value = true
  error.value = null
  try {
    const url = forceRefresh ? '/api/analytics/intelligence?refresh=true' : '/api/analytics/intelligence'
    const res = await $fetch<any>(url)
    if (res && res.success) {
      data.value = res
    } else {
      throw new Error('Invalid response structure from intelligence API')
    }
  } catch (err: any) {
    console.error('Failed to load distribution intelligence:', err)
    error.value = err?.data?.message || err?.message || 'Server error computing intelligence'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// Suggested items for PO Simulator
const suggestedReorderItems = computed(() => {
  if (!data.value?.replenishment) return []
  return data.value.replenishment.filter((i: any) => i.suggestedPOQty > 0)
})

function openPOSimulator(itemsToTest?: any[]) {
  activePOSimulatorItems.value = itemsToTest || suggestedReorderItems.value
  isPOSimulatorOpen.value = true
}

// Filtered Replenishment Table
const filteredReplenishment = computed(() => {
  if (!data.value?.replenishment) return []
  let list = data.value.replenishment

  if (replenishmentFilter.value === 'CRITICAL') {
    list = list.filter((i: any) => i.status === 'CRITICAL_RUNOUT' || i.runwayDays < 7)
  } else if (replenishmentFilter.value === 'REORDER') {
    list = list.filter((i: any) => i.suggestedPOQty > 0)
  } else if (replenishmentFilter.value === 'STOCKOUT') {
    list = list.filter((i: any) => i.status === 'STOCKOUT')
  } else if (replenishmentFilter.value === 'OVERSTOCKED') {
    list = list.filter((i: any) => i.status === 'OVERSTOCKED')
  }

  if (!replenishmentSearch.value.trim()) return list
  const q = replenishmentSearch.value.toLowerCase().trim()
  return list.filter((i: any) => 
    i.name.toLowerCase().includes(q) || 
    (i.category && i.category.toLowerCase().includes(q))
  )
})

// Filtered Trends Table
const filteredTrends = computed(() => {
  if (!data.value?.trends) return []
  let list = data.value.trends

  if (trendFilter.value !== 'ALL') {
    list = list.filter((i: any) => i.trend === trendFilter.value)
  }

  if (!trendSearch.value.trim()) return list
  const q = trendSearch.value.toLowerCase().trim()
  return list.filter((i: any) => 
    i.name.toLowerCase().includes(q) || 
    (i.category && i.category.toLowerCase().includes(q))
  )
})

// Filtered Profitability Table
const filteredProfitability = computed(() => {
  if (!data.value?.profitability) return []
  let list = data.value.profitability

  if (quadrantFilter.value !== 'ALL') {
    list = list.filter((i: any) => i.quadrant === quadrantFilter.value)
  }

  return list
})

// Helpers
function formatNumber(val: number | string | undefined): string {
  if (val === undefined || val === null) return '0'
  return Number(val).toLocaleString('en-IN')
}

function formatCurrency(val: number | string | undefined): string {
  if (val === undefined || val === null) return '₹0'
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
</script>
