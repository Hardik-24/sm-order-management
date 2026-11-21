<template>
  <div class="space-y-6">
    <!-- Top Sync & Connection Status Banner -->
    <div class="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck class="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-base sm:text-lg font-bold text-gray-900">Tally Prime Financial Intelligence</h2>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <Lock class="w-3 h-3" />
              Strictly Read-Only
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Building2 class="w-3 h-3" />
              {{ tallyData?.company || 'SRI LAKSHMI PLYWOODS 2627' }}
            </span>
          </div>
          <p class="text-xs sm:text-sm text-gray-600 mt-1">
            Complete 360° financial overview: Total Billed, Total Paid Receipts, Net Pending Balance, and Live BUSY ERP Cross-Reconciliation.
          </p>
        </div>
      </div>

      <!-- Action & Timestamp -->
      <div class="flex items-center gap-3 shrink-0 self-end md:self-center">
        <button
          @click="refreshAllData"
          :disabled="loading || reconLoading"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5 text-gray-500" :class="{ 'animate-spin': loading || reconLoading }" />
          <span>Refresh</span>
        </button>

        <div class="text-right">
          <div class="text-[11px] text-gray-500">Last Synced</div>
          <div class="text-xs font-semibold text-gray-800 flex items-center gap-1 justify-end">
            <Clock class="w-3.5 h-3.5 text-gray-400" />
            {{ formattedSyncTime }}
          </div>
        </div>
      </div>
    </div>

    <!-- TOP ENTITY TOGGLE: Sales & Debtors vs Purchases & Creditors -->
    <div class="bg-gray-100/90 p-1.5 rounded-2xl flex items-center gap-1.5 border border-gray-200/90 shadow-2xs">
      <button
        type="button"
        @click="switchEntityMode('debtors')"
        class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
        :class="activeEntityMode === 'debtors' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/80' : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'"
      >
        <Users class="w-4 h-4 text-blue-600 shrink-0" />
        <span class="truncate">Sales & Debtors (Customers / Receivables)</span>
        <span
          class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 hidden sm:inline-flex"
          :class="activeEntityMode === 'debtors' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-200 text-gray-600'"
        >
          {{ debtorsData?.summary?.totalParties || 354 }} Parties
        </span>
      </button>

      <button
        type="button"
        @click="switchEntityMode('creditors')"
        class="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
        :class="activeEntityMode === 'creditors' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/80' : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'"
      >
        <Building2 class="w-4 h-4 text-purple-600 shrink-0" />
        <span class="truncate">Purchases & Creditors (Suppliers / Payables)</span>
        <span
          class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 hidden sm:inline-flex"
          :class="activeEntityMode === 'creditors' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-gray-200 text-gray-600'"
        >
          {{ creditorsData?.summary?.totalParties || 202 }} Suppliers
        </span>
      </button>
    </div>

    <!-- MAIN SEGMENT SWITCHER: Accounts vs Busy-Tally Reconciliation -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-2">
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          @click="activeMainView = 'debtors'"
          class="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
          :class="activeMainView === 'debtors' ? 'bg-[#1b3b5f] text-white shadow-sm' : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'"
        >
          <component :is="activeEntityMode === 'debtors' ? Users : Building2" class="w-4 h-4" />
          <span>{{ activeEntityMode === 'debtors' ? 'Sundry Debtors Accounts' : 'Sundry Creditors Accounts' }}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="activeMainView === 'debtors' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'">
            {{ tallyData?.summary?.totalParties || (activeEntityMode === 'debtors' ? 354 : 202) }}
          </span>
        </button>

        <button
          type="button"
          @click="activeMainView = 'reconciliation'"
          class="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
          :class="activeMainView === 'reconciliation' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-900 hover:bg-amber-50/60 border border-amber-300'"
        >
          <Scale class="w-4 h-4" />
          <span>{{ activeEntityMode === 'debtors' ? 'BUSY ↔ Tally Sales Reconciliation' : 'BUSY ↔ Tally Purchases Reconciliation' }}</span>
          <span
            v-if="reconData?.summary?.netDiscrepancy"
            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
            :class="activeMainView === 'reconciliation' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-800 border border-rose-200'"
          >
            {{ formatCrores(Math.abs(reconData.summary.netDiscrepancy)) }} Gap
          </span>
        </button>
      </div>

      <div v-if="activeMainView === 'reconciliation' && reconData" class="flex items-center gap-2 text-xs text-gray-500 self-end sm:self-center">
        <span class="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
          <AlertCircle class="w-3.5 h-3.5" />
          {{ reconData.summary.unpostedVouchersCount }} Unposted {{ activeEntityMode === 'debtors' ? 'Invoices' : 'Purchases' }}
        </span>
      </div>
    </div>

    <!-- ========================================================================================= -->
    <!-- VIEW 1: SUNDRY LEDGER ACCOUNTS (DEBTORS OR CREDITORS) -->
    <!-- ========================================================================================= -->
    <div v-if="activeMainView === 'debtors'" class="space-y-6">
      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs h-32 animate-pulse"></div>
      </div>

      <!-- Content when loaded -->
      <div v-else-if="tallyData" class="space-y-6">
        <!-- 4 Executive KPI Cards (Billed/Purchased vs Paid vs Pending) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- 1. Total Invoiced (Billed / Purchased) -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ activeEntityMode === 'debtors' ? 'Total Billed (Debits)' : 'Total Purchased (Credits)' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/80">
                <IndianRupee class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatCrores(activeEntityMode === 'debtors' ? (tallyData.summary.totalBilled || tallyData.summary.totalOutstanding) : (tallyData.summary.totalPurchased || tallyData.summary.totalBilled)) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(activeEntityMode === 'debtors' ? (tallyData.summary.totalBilled || tallyData.summary.totalOutstanding) : (tallyData.summary.totalPurchased || tallyData.summary.totalBilled)) }}</span>
                <span class="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                  {{ activeEntityMode === 'debtors' ? 'Invoiced Sales' : 'Invoiced Purchases' }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          </div>

          <!-- 2. Total Paid (Receipts / Disbursements) -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ activeEntityMode === 'debtors' ? 'Total Collected (Paid)' : 'Total Paid (Disbursed)' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
                <CheckCircle2 class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
                {{ formatCrores(tallyData.summary.totalPaid) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(tallyData.summary.totalPaid) }}</span>
                <span class="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                  {{ activeEntityMode === 'debtors' ? (tallyData.summary.overallCollectionRate + '% Collected') : (tallyData.summary.overallPaymentRate + '% Paid') }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          </div>

          <!-- 3. Net Pending Balance -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ activeEntityMode === 'debtors' ? 'Net Receivables Pending' : 'Net Payables Pending' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
                <AlertTriangle class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">
                {{ formatCrores(tallyData.summary.totalNetPending || tallyData.summary.totalOutstanding) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(tallyData.summary.totalNetPending || tallyData.summary.totalOutstanding) }}</span>
                <span class="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                  {{ formatNumber(tallyData.summary.totalBills) }} Open Bills
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          </div>

          <!-- 4. Active Accounts -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ activeEntityMode === 'debtors' ? 'Active Debtors' : 'Active Creditors' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/80">
                <component :is="activeEntityMode === 'debtors' ? Users : Building2" class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatNumber(tallyData.summary.totalParties) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ activeEntityMode === 'debtors' ? 'Avg Pending / Debtor' : 'Avg Pending / Creditor' }}</span>
                <span class="font-semibold text-gray-700">
                  {{ formatCurrency(tallyData.summary.totalParties > 0 ? Math.round((tallyData.summary.totalNetPending || tallyData.summary.totalOutstanding) / tallyData.summary.totalParties) : 0) }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-600"></div>
          </div>
        </div>

        <!-- Progress Bar (Collection Health vs Payment Health) -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs space-y-2.5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div class="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
              <span>{{ activeEntityMode === 'debtors' ? 'Overall Collection Health' : 'Overall Supplier Payment Health' }}</span>
              <span class="text-xs font-normal text-gray-500 hidden md:inline">
                ({{ activeEntityMode === 'debtors' ? 'Total Payments vs Total Billing Demand' : 'Total Payments vs Total Purchase Demand' }})
              </span>
            </div>
            <div class="flex items-center justify-between sm:justify-end gap-2 text-xs">
              <span class="text-emerald-700 font-bold bg-emerald-50 sm:bg-transparent px-2 sm:px-0 py-0.5 sm:py-0 rounded-md">Paid: {{ formatCrores(tallyData.summary.totalPaid) }}</span>
              <span class="text-gray-300 hidden sm:inline">•</span>
              <span class="text-amber-700 font-bold bg-amber-50 sm:bg-transparent px-2 sm:px-0 py-0.5 sm:py-0 rounded-md">Pending: {{ formatCrores(tallyData.summary.totalNetPending) }}</span>
            </div>
          </div>

          <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
            <div
              class="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
              :style="{ width: `${Math.min(100, activeEntityMode === 'debtors' ? tallyData.summary.overallCollectionRate : tallyData.summary.overallPaymentRate)}%` }"
              :title="`Paid: ${activeEntityMode === 'debtors' ? tallyData.summary.overallCollectionRate : tallyData.summary.overallPaymentRate}%`"
            ></div>
            <div
              class="bg-amber-400 h-full rounded-r-full transition-all duration-500"
              :style="{ width: `${Math.max(0, 100 - (activeEntityMode === 'debtors' ? tallyData.summary.overallCollectionRate : tallyData.summary.overallPaymentRate))}%` }"
              :title="`Pending: ${(100 - (activeEntityMode === 'debtors' ? tallyData.summary.overallCollectionRate : tallyData.summary.overallPaymentRate)).toFixed(1)}%`"
            ></div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
            <span>0%</span>
            <span class="font-bold text-emerald-700">
              {{ activeEntityMode === 'debtors' ? (tallyData.summary.overallCollectionRate + '% Collected') : (tallyData.summary.overallPaymentRate + '% Paid') }}
            </span>
            <span>100% Demand</span>
          </div>
        </div>

        <!-- Ledger Accounts Search, Filter and Table Card -->
        <div class="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-gray-900 text-base">
                {{ activeEntityMode === 'debtors' ? 'Sundry Debtors Ledger Accounts' : 'Sundry Creditors Ledger Accounts' }}
              </h3>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                {{ filteredParties.length }} Accounts
              </span>
            </div>

            <!-- Search & Sort Controls -->
            <div class="flex items-center gap-2.5 flex-wrap">
              <div class="relative w-full sm:w-64">
                <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="activeEntityMode === 'debtors' ? 'Search debtor name or group...' : 'Search supplier name or group...'"
                  class="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <button
                  v-if="searchQuery"
                  @click="searchQuery = ''"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>

              <select
                v-model="sortBy"
                class="w-full sm:w-auto px-2.5 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                <option value="pending_desc">{{ activeEntityMode === 'debtors' ? 'Highest Net Pending' : 'Highest Net Payable' }}</option>
                <option value="billed_desc">{{ activeEntityMode === 'debtors' ? 'Highest Total Billed' : 'Highest Total Purchased' }}</option>
                <option value="paid_desc">Highest Total Paid</option>
                <option value="rate_asc">{{ activeEntityMode === 'debtors' ? 'Lowest Collection Rate (Risk)' : 'Lowest Payment Rate' }}</option>
                <option value="rate_desc">{{ activeEntityMode === 'debtors' ? 'Highest Collection Rate' : 'Highest Payment Rate' }}</option>
                <option value="bills_desc">Most Unadjusted Bills</option>
                <option value="speed_asc">Fastest Turnaround</option>
                <option value="speed_desc">Slowest Turnaround</option>
              </select>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50/80 text-gray-500 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">{{ activeEntityMode === 'debtors' ? 'Debtor Party / Ledger' : 'Supplier Creditor / Ledger' }}</th>
                  <th class="py-3 px-4 text-right">{{ activeEntityMode === 'debtors' ? 'Total Billed' : 'Total Purchased' }}</th>
                  <th class="py-3 px-4 text-right">Total Paid</th>
                  <th class="py-3 px-4 text-right">{{ activeEntityMode === 'debtors' ? 'Net Pending' : 'Net Payable' }}</th>
                  <th class="py-3 px-4 text-center">{{ activeEntityMode === 'debtors' ? 'Collection %' : 'Payment %' }}</th>
                  <th class="py-3 px-4 text-center">Avg Pay Time</th>
                  <th class="py-3 px-4 text-center">Open Bills</th>
                  <th class="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(party, idx) in paginatedParties"
                  :key="party.party"
                  @click="openDebtorDetails(party)"
                  class="hover:bg-amber-50/30 transition-colors cursor-pointer group"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (currentPage - 1) * pageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-900 group-hover:text-amber-900">
                    <div class="font-bold text-gray-900">{{ party.party }}</div>
                    <div v-if="party.parent" class="text-[11px] text-gray-400 font-normal">{{ party.parent }}</div>
                  </td>
                  <td class="py-3.5 px-4 text-right font-medium text-gray-700">
                    {{ formatCurrency(activeEntityMode === 'debtors' ? party.totalBilled : (party.totalPurchased || party.totalBilled)) }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-bold text-emerald-700">
                    {{ formatCurrency(party.totalPaid) }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-extrabold" :class="party.netPending > 0 ? 'text-amber-700' : 'text-emerald-700'">
                    {{ party.netPending > 0 ? formatCurrency(party.netPending) : (party.advance > 0 ? '+' + formatCurrency(party.advance) + ' CR' : '₹0') }}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <div class="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-emerald-500 h-full rounded-full" :style="{ width: `${Math.min(100, activeEntityMode === 'debtors' ? party.collectionRate : party.paymentRate)}%` }"></div>
                      </div>
                      <span class="text-xs font-bold" :class="(activeEntityMode === 'debtors' ? party.collectionRate : party.paymentRate) >= 80 ? 'text-emerald-700' : (activeEntityMode === 'debtors' ? party.collectionRate : party.paymentRate) >= 50 ? 'text-amber-700' : 'text-rose-700'">
                        {{ activeEntityMode === 'debtors' ? party.collectionRate : party.paymentRate }}%
                      </span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span
                      class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                      :class="getAvgPaymentBadgeClass(party)"
                      :title="'Turnaround completion cycle: ' + getAvgPaymentDaysText(party)"
                    >
                      <Clock class="w-3 h-3 shrink-0" />
                      <span>{{ getAvgPaymentDaysText(party) }}</span>
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span
                      v-if="party.billsCount > 0"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                    >
                      {{ party.billsCount }} bills
                    </span>
                    <span v-else class="text-gray-400 text-xs">-</span>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <button
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 group-hover:bg-amber-100 transition-colors"
                    >
                      <span>View Financials</span>
                      <ChevronRight class="w-3 h-3" />
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredParties.length === 0">
                  <td colspan="9" class="py-12 text-center text-gray-500">
                    <div class="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto text-gray-400 mb-3">
                      <Search class="w-6 h-6" />
                    </div>
                    <p class="font-medium">No accounts found matching your search</p>
                    <p class="text-xs text-gray-400 mt-1">Try searching for a different party or ledger name</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="p-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredParties.length) }} of {{ filteredParties.length }} accounts
            </div>
            <div class="flex items-center gap-1.5">
              <button
                @click="currentPage--"
                :disabled="currentPage === 1"
                class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
              >
                Previous
              </button>
              <span class="text-xs font-semibold px-2">{{ currentPage }} / {{ totalPages }}</span>
              <button
                @click="currentPage++"
                :disabled="currentPage >= totalPages"
                class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================================= -->
    <!-- VIEW 2: BUSY ↔ TALLY RECONCILIATION & DISCREPANCIES AUDIT -->
    <!-- ========================================================================================= -->
    <div v-else-if="activeMainView === 'reconciliation'" class="space-y-6">
      <!-- Loading State -->
      <div v-if="reconLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs h-32 animate-pulse"></div>
      </div>

      <!-- Content when loaded -->
      <div v-else-if="reconData" class="space-y-6">
        <!-- 4 Reconciliation KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- 1. Total Busy Sales / Purchases -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ activeEntityMode === 'debtors' ? 'Live BUSY Sales' : 'Live BUSY Purchases' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
                <Receipt class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatCrores(reconData.summary.totalBusySales || reconData.summary.totalBusyPurchases) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(reconData.summary.totalBusySales || reconData.summary.totalBusyPurchases) }}</span>
                <span class="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                  {{ formatNumber(reconData.summary.busyVoucherCount) }} {{ activeEntityMode === 'debtors' ? 'Invoices' : 'Purchases' }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          </div>

          <!-- 2. Total Tally Billed / Purchased -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ activeEntityMode === 'debtors' ? 'Tally Prime Billed' : 'Tally Prime Purchased' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/80">
                <Building2 class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatCrores(reconData.summary.totalTallyBilled || reconData.summary.totalTallyPurchased) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(reconData.summary.totalTallyBilled || reconData.summary.totalTallyPurchased) }}</span>
                <span class="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                  {{ formatNumber(activeEntityMode === 'debtors' ? reconData.summary.tallyDebtorCount : reconData.summary.tallyCreditorCount) }} {{ activeEntityMode === 'debtors' ? 'Debtors' : 'Creditors' }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          </div>

          <!-- 3. Net Ledger Discrepancy -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-rose-700">Net Ledger Discrepancy</span>
              <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/80">
                <AlertTriangle class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">
                {{ formatCrores(Math.abs(reconData.summary.netDiscrepancy)) }}
              </div>
              <div class="flex items-center justify-between text-xs text-rose-600 mt-2">
                <span>{{ formatCurrency(Math.abs(reconData.summary.netDiscrepancy)) }}</span>
                <span class="text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 text-[11px]">
                  {{ reconData.summary.netDiscrepancy >= 0 ? 'Busy > Tally' : 'Tally > Busy' }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
          </div>

          <!-- 4. Unposted Invoices / Purchases -->
          <div class="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs relative overflow-hidden group hover:border-amber-300 transition-all bg-amber-50/20">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-amber-800">
                {{ activeEntityMode === 'debtors' ? 'Unposted Invoices' : 'Unposted Purchases' }}
              </span>
              <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
                <FileSpreadsheet class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-amber-800 tracking-tight">
                {{ formatNumber(reconData.summary.unpostedVouchersCount) }}
              </div>
              <div class="flex items-center justify-between text-xs text-amber-700 mt-2">
                <span>Value: {{ formatCrores(reconData.summary.unpostedVouchersTotal) }}</span>
                <span class="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                  Action Needed
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          </div>
        </div>

        <!-- Discrepancy Breakdown Insight Box -->
        <div class="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <Scale class="w-4 h-4" />
          </div>
          <div class="text-xs sm:text-sm text-gray-700">
            <p class="font-bold text-gray-900">
              Why does BUSY have {{ formatCrores(Math.abs(reconData.summary.netDiscrepancy)) }} {{ reconData.summary.netDiscrepancy >= 0 ? 'more' : 'less' }} {{ activeEntityMode === 'debtors' ? 'sales' : 'purchases' }} than Tally?
            </p>
            <p class="mt-0.5 text-gray-600">
              <strong>{{ formatCrores(reconData.summary.missingPartiesSales || reconData.summary.missingPartiesPurchases) }}</strong> ({{ reconData.summary.missingPartiesCount }} {{ activeEntityMode === 'debtors' ? 'customers' : 'suppliers' }}) is from accounts missing in Tally's {{ activeEntityMode === 'debtors' ? 'Debtors' : 'Creditors' }} list, and the remaining <strong>{{ formatCrores(Math.abs(reconData.summary.netDiscrepancy - (reconData.summary.missingPartiesSales || reconData.summary.missingPartiesPurchases))) }}</strong> is from recent/unposted vouchers in active accounts.
            </p>
          </div>
        </div>

        <!-- RECONCILIATION SUB-TABS (Clean 2-Row Layout) -->
        <div class="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-gray-200 space-y-3.5">
            <!-- ROW 1: Sub-tab Buttons -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                @click="activeReconSubTab = 'unposted'"
                class="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
                :class="activeReconSubTab === 'unposted' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                <FileText class="w-3.5 h-3.5" />
                <span>{{ activeEntityMode === 'debtors' ? 'Unposted BUSY Invoices' : 'Unposted BUSY Purchases' }}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" :class="activeReconSubTab === 'unposted' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'">
                  {{ reconData.unpostedVouchers.length }}
                </span>
              </button>

              <button
                @click="activeReconSubTab = 'discrepancies'"
                class="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
                :class="activeReconSubTab === 'discrepancies' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                <Users class="w-3.5 h-3.5" />
                <span>{{ activeEntityMode === 'debtors' ? 'Party Balance Discrepancies' : 'Supplier Balance Discrepancies' }}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" :class="activeReconSubTab === 'discrepancies' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'">
                  {{ reconData.partyDiscrepancies.length }}
                </span>
              </button>

              <button
                @click="activeReconSubTab = 'missing_parties'"
                class="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
                :class="activeReconSubTab === 'missing_parties' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                <UserX class="w-3.5 h-3.5 text-rose-600" />
                <span>{{ activeEntityMode === 'debtors' ? 'Missing Debtors in Tally' : 'Missing Creditors in Tally' }}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" :class="activeReconSubTab === 'missing_parties' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'">
                  {{ reconData.unmatchedParties.length }}
                </span>
              </button>

              <button
                @click="activeReconSubTab = 'bill_value'"
                class="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
                :class="activeReconSubTab === 'bill_value' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                <Scale class="w-3.5 h-3.5 text-emerald-600" />
                <span>Bill-Wise Value Audit</span>
                <span
                  class="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
                  :class="reconData.summary.allBillsAccurate ? (reconData.billValueDiscrepancies?.length > 0 ? (activeReconSubTab === 'bill_value' ? 'bg-amber-500/30 text-white' : 'bg-amber-100 text-amber-800') : (activeReconSubTab === 'bill_value' ? 'bg-emerald-500/30 text-white' : 'bg-emerald-100 text-emerald-800')) : (activeReconSubTab === 'bill_value' ? 'bg-rose-500/30 text-white' : 'bg-rose-100 text-rose-800')"
                >
                  {{ reconData.summary.allBillsAccurate ? (reconData.billValueDiscrepancies?.length > 0 ? reconData.billValueDiscrepancies.length + ' Action Items' : '✓ 0 Value Errors') : reconData.summary.billDiscrepanciesCount + ' Value Discrepancies' }}
                </span>
              </button>
            </div>

            <!-- ROW 2: Search Bar & Filters -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div class="relative w-full sm:w-80">
                <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  v-model="reconSearchQuery"
                  type="text"
                  :placeholder="activeReconSubTab === 'unposted' ? 'Search voucher # or party...' : activeReconSubTab === 'discrepancies' ? 'Search party or tally ledger...' : activeReconSubTab === 'missing_parties' ? 'Search missing party...' : 'Filter bill # or party name...'"
                  class="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <button
                  v-if="reconSearchQuery"
                  @click="reconSearchQuery = ''"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Filter select for Unposted Vouchers -->
              <select
                v-if="activeReconSubTab === 'unposted'"
                v-model="unpostedCategoryFilter"
                class="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Unposted {{ activeEntityMode === 'debtors' ? 'Invoices' : 'Purchases' }}</option>
                <option :value="activeEntityMode === 'debtors' ? 'UNPOSTED_INVOICE' : 'UNPOSTED_PURCHASE'">In Active Accounts</option>
                <option :value="activeEntityMode === 'debtors' ? 'MISSING_CUSTOMER' : 'MISSING_SUPPLIER'">From Missing {{ activeEntityMode === 'debtors' ? 'Customers' : 'Suppliers' }}</option>
              </select>

              <!-- Filter select for Discrepancies -->
              <select
                v-if="activeReconSubTab === 'discrepancies'"
                v-model="partyDiscrepancyFilter"
                class="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Discrepant Accounts</option>
                <option value="BUSY_HIGHER">Busy Higher (Under-reported in Tally)</option>
                <option value="TALLY_HIGHER">Tally Higher</option>
              </select>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- SUB-TAB 1: UNPOSTED VOUCHERS TABLE -->
          <!-- ========================================== -->
          <div v-if="activeReconSubTab === 'unposted'" class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">Voucher #</th>
                  <th class="py-3 px-4">Date</th>
                  <th class="py-3 px-4">{{ activeEntityMode === 'debtors' ? 'Customer Name' : 'Supplier Name' }}</th>
                  <th class="py-3 px-4 text-right">Taxable Base</th>
                  <th class="py-3 px-4 text-right">GST Tax</th>
                  <th class="py-3 px-4 text-right">Total Value</th>
                  <th class="py-3 px-4">Status / Reason</th>
                  <th class="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(vch, idx) in paginatedUnpostedVouchers"
                  :key="vch.voucherNo"
                  class="hover:bg-amber-50/20 transition-colors"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (unpostedPage - 1) * unpostedPageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-mono font-bold text-gray-900 flex items-center gap-1.5">
                    <span>{{ vch.voucherNo }}</span>
                    <button
                      @click="copyVoucherNo(vch.voucherNo)"
                      class="text-gray-400 hover:text-gray-700 p-0.5 rounded cursor-pointer"
                      title="Copy Voucher #"
                    >
                      <Check v-if="copiedVoucher === vch.voucherNo" class="w-3.5 h-3.5 text-emerald-600" />
                      <Copy v-else class="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td class="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                    {{ formatDate(vch.voucherDate) }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-900">
                    <div>{{ vch.customerName || vch.supplierName }}</div>
                    <div v-if="vch.tallyParty" class="text-[11px] text-gray-400 font-normal">
                      Tally: {{ vch.tallyParty }}
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-right text-gray-600">
                    {{ formatCurrency(vch.taxableAmount) }}
                  </td>
                  <td class="py-3.5 px-4 text-right text-gray-600">
                    {{ formatCurrency(vch.taxAmount) }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-extrabold text-amber-900 whitespace-nowrap">
                    {{ formatCurrency(vch.amount) }}
                  </td>
                  <td class="py-3.5 px-4">
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      :class="vch.category === 'MISSING_CUSTOMER' || vch.category === 'MISSING_SUPPLIER' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'"
                    >
                      <AlertCircle class="w-3 h-3 shrink-0" />
                      <span>{{ vch.reason }}</span>
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <button
                      v-if="vch.tallyParty"
                      @click="viewPartyDebtorDetails(vch.tallyParty)"
                      class="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Inspect Ledger
                    </button>
                    <span v-else class="text-xs text-rose-600 font-semibold">Create Ledger</span>
                  </td>
                </tr>

                <tr v-if="filteredUnpostedVouchers.length === 0">
                  <td colspan="9" class="py-12 text-center text-gray-500">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 class="w-6 h-6" />
                    </div>
                    <p class="font-bold text-gray-900">Zero Unposted Vouchers</p>
                    <p class="text-xs text-gray-400 mt-1">All vouchers in this category have been posted to Tally.</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination for Unposted -->
            <div v-if="filteredUnpostedVouchers.length > unpostedPageSize" class="p-4 border-t border-gray-200 flex items-center justify-between">
              <span class="text-xs text-gray-500">
                Showing {{ (unpostedPage - 1) * unpostedPageSize + 1 }} to {{ Math.min(unpostedPage * unpostedPageSize, filteredUnpostedVouchers.length) }} of {{ filteredUnpostedVouchers.length }} vouchers
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  @click="unpostedPage--"
                  :disabled="unpostedPage === 1"
                  class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Previous
                </button>
                <span class="text-xs font-semibold px-2">{{ unpostedPage }} / {{ totalUnpostedPages }}</span>
                <button
                  @click="unpostedPage++"
                  :disabled="unpostedPage >= totalUnpostedPages"
                  class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- SUB-TAB 2: PARTY DISCREPANCIES TABLE -->
          <!-- ========================================== -->
          <div v-else-if="activeReconSubTab === 'discrepancies'" class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">{{ activeEntityMode === 'debtors' ? 'Customer Account (BUSY)' : 'Supplier Account (BUSY)' }}</th>
                  <th class="py-3 px-4">{{ activeEntityMode === 'debtors' ? 'Matched Tally Debtor' : 'Matched Tally Creditor' }}</th>
                  <th class="py-3 px-4 text-right">{{ activeEntityMode === 'debtors' ? 'BUSY Sales' : 'BUSY Purchases' }}</th>
                  <th class="py-3 px-4 text-right">{{ activeEntityMode === 'debtors' ? 'Tally Billed' : 'Tally Purchased' }}</th>
                  <th class="py-3 px-4 text-right">Difference (Gap)</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(party, idx) in paginatedPartyDiscrepancies"
                  :key="party.customerName || party.supplierName"
                  class="hover:bg-amber-50/20 transition-colors"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (discrepancyPage - 1) * discrepancyPageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-900">
                    {{ party.customerName || party.supplierName }}
                    <div class="text-[11px] text-gray-400 font-normal">{{ party.busyVoucherCount }} BUSY vouchers</div>
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-700">
                    {{ party.tallyParty }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-medium text-gray-800">
                    {{ formatCurrency(party.busySales || party.busyPurchases) }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-medium text-gray-800">
                    {{ formatCurrency(party.tallyBilled || party.tallyPurchased) }}
                  </td>
                  <td
                    class="py-3.5 px-4 text-right font-extrabold whitespace-nowrap"
                    :class="party.difference > 0 ? 'text-rose-700' : 'text-blue-700'"
                  >
                    {{ party.difference > 0 ? '+' : '' }}{{ formatCurrency(party.difference) }}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      :class="party.status === 'BUSY_HIGHER' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-blue-50 text-blue-800 border border-blue-200'"
                    >
                      {{ party.status === 'BUSY_HIGHER' ? 'Busy Higher' : 'Tally Higher' }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <button
                      @click="viewPartyDebtorDetails(party.tallyParty)"
                      class="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      View Ledger
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredPartyDiscrepancies.length === 0">
                  <td colspan="8" class="py-12 text-center text-gray-500">
                    <p class="font-medium">No account discrepancies match your filter.</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination for Discrepancies -->
            <div v-if="filteredPartyDiscrepancies.length > discrepancyPageSize" class="p-4 border-t border-gray-200 flex items-center justify-between">
              <span class="text-xs text-gray-500">
                Showing {{ (discrepancyPage - 1) * discrepancyPageSize + 1 }} to {{ Math.min(discrepancyPage * discrepancyPageSize, filteredPartyDiscrepancies.length) }} of {{ filteredPartyDiscrepancies.length }} accounts
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  @click="discrepancyPage--"
                  :disabled="discrepancyPage === 1"
                  class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Previous
                </button>
                <span class="text-xs font-semibold px-2">{{ discrepancyPage }} / {{ totalDiscrepancyPages }}</span>
                <button
                  @click="discrepancyPage++"
                  :disabled="discrepancyPage >= totalDiscrepancyPages"
                  class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- SUB-TAB 3: MISSING PARTIES IN TALLY -->
          <!-- ========================================== -->
          <div v-else-if="activeReconSubTab === 'missing_parties'" class="overflow-x-auto">
            <div class="p-4 bg-rose-50/70 border-b border-rose-100 text-xs text-rose-900 flex items-center gap-2">
              <UserX class="w-4 h-4 text-rose-600 shrink-0" />
              <span>These accounts have transactions recorded in BUSY, but no corresponding ledger exists in Tally's {{ activeEntityMode === 'debtors' ? 'Sundry Debtors' : 'Sundry Creditors' }} group.</span>
            </div>

            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">{{ activeEntityMode === 'debtors' ? 'Customer Name (BUSY)' : 'Supplier Name (BUSY)' }}</th>
                  <th class="py-3 px-4 text-right">{{ activeEntityMode === 'debtors' ? 'Total Sales' : 'Total Purchases' }}</th>
                  <th class="py-3 px-4 text-center">Vouchers</th>
                  <th class="py-3 px-4 text-center">Latest Transaction</th>
                  <th class="py-3 px-4 text-center">Suggested Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(party, idx) in paginatedMissingParties"
                  :key="party.customerName || party.supplierName"
                  class="hover:bg-amber-50/20 transition-colors"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (missingPartiesPage - 1) * missingPartiesPageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-900">
                    {{ party.customerName || party.supplierName }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-extrabold text-rose-700 whitespace-nowrap">
                    {{ formatCurrency(party.totalSales || party.totalPurchases) }}
                  </td>
                  <td class="py-3.5 px-4 text-center font-semibold text-gray-700">
                    {{ party.voucherCount }} bills
                  </td>
                  <td class="py-3.5 px-4 text-center text-gray-600">
                    {{ formatDate(party.latestDate) }}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                      Create {{ activeEntityMode === 'debtors' ? 'Debtor' : 'Creditor' }} Ledger in Tally
                    </span>
                  </td>
                </tr>

                <tr v-if="filteredMissingParties.length === 0">
                  <td colspan="6" class="py-12 text-center text-gray-500">
                    <p class="font-medium">No missing accounts match your search.</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination for Missing Parties -->
            <div v-if="filteredMissingParties.length > missingPartiesPageSize" class="p-4 border-t border-gray-200 flex items-center justify-between">
              <span class="text-xs text-gray-500">
                Showing {{ (missingPartiesPage - 1) * missingPartiesPageSize + 1 }} to {{ Math.min(missingPartiesPage * missingPartiesPageSize, filteredMissingParties.length) }} of {{ filteredMissingParties.length }}
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  @click="missingPartiesPage--"
                  :disabled="missingPartiesPage === 1"
                  class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Previous
                </button>
                <span class="text-xs font-semibold px-2">{{ missingPartiesPage }} / {{ totalMissingPartiesPages }}</span>
                <button
                  @click="missingPartiesPage++"
                  :disabled="missingPartiesPage >= totalMissingPartiesPages"
                  class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- SUB-TAB 4: BILL-WISE VALUE AUDIT VIEW -->
          <!-- ========================================== -->
          <div v-else-if="activeReconSubTab === 'bill_value'" class="p-4 sm:p-6">
            <!-- When all bills match accurately (0 pure value errors) -->
            <div
              v-if="reconData.summary.allBillsAccurate && (!reconData.billValueDiscrepancies || reconData.billValueDiscrepancies.length === 0)"
              class="py-12 px-6 text-center max-w-xl mx-auto space-y-3"
            >
              <div class="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 class="w-8 h-8 text-emerald-600" />
              </div>
              <h4 class="text-base sm:text-lg font-bold text-gray-900">All Vouchers Accurately Mapped in Tally</h4>
              <p class="text-xs sm:text-sm text-gray-600">
                Zero bill-by-bill value corruptions or typo discrepancies detected. All active accounts in Tally match their BUSY counterpart exactly to the single rupee.
              </p>
              <div class="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-600 text-left space-y-1.5 mt-4">
                <div class="flex items-center gap-1.5 font-bold text-gray-800">
                  <ShieldCheck class="w-4 h-4 text-emerald-600" />
                  Verification Audit Summary:
                </div>
                <div>• Every bill entered into Tally carries the exact correct taxable base, GST tax, and total value as recorded in BUSY.</div>
                <div>• The overall difference consists exclusively of <strong>unposted vouchers</strong> and <strong>missing party ledgers</strong>, not incorrect bill amounts.</div>
              </div>
            </div>

            <!-- When action items / clubbed entries exist -->
            <div v-else class="space-y-4">
              <div class="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-3">
                <ShieldCheck class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div class="space-y-1">
                  <div class="font-bold text-gray-900 text-sm">Cross-System Audit Findings & Action Guide</div>
                  <div class="text-gray-600">
                    All verified ledger balances match 100% to the rupee. The items below highlight where reference typos or combined vouchers were entered in Tally. Please follow the instructions in the <strong>How to Correct</strong> column for manual review without creating double entries.
                  </div>
                </div>
              </div>

              <div class="overflow-x-auto border border-gray-200 rounded-xl shadow-xs">
                <table class="w-full text-left text-xs sm:text-sm">
                  <thead class="bg-gray-50 text-gray-600 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th class="py-3 px-3.5">Tally Ref</th>
                      <th class="py-3 px-3.5">BUSY Bill</th>
                      <th class="py-3 px-3.5">{{ activeEntityMode === 'debtors' ? 'Party / Customer' : 'Party / Supplier' }}</th>
                      <th class="py-3 px-3.5 text-right whitespace-nowrap">BUSY Amt</th>
                      <th class="py-3 px-3.5 text-right whitespace-nowrap">Tally Amt</th>
                      <th class="py-3 px-3.5 text-center">Status</th>
                      <th class="py-3 px-4 min-w-[280px]">Issue / Error Detected</th>
                      <th class="py-3 px-4 min-w-[320px]">How to Correct</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="bill in filteredBillDiscrepancies" :key="bill.ref + bill.party" class="hover:bg-amber-50/20 transition-colors">
                      <td class="py-3.5 px-3.5 font-mono font-bold text-gray-900">{{ bill.ref }}</td>
                      <td class="py-3.5 px-3.5 font-mono font-semibold text-blue-700">{{ bill.actualBusyRef || bill.ref }}</td>
                      <td class="py-3.5 px-3.5 font-bold text-gray-900">
                        <div>{{ bill.party }}</div>
                        <div v-if="(bill.customerName || bill.supplierName) && (bill.customerName || bill.supplierName) !== bill.party" class="text-[11px] text-gray-400 font-normal">
                          BUSY: {{ bill.customerName || bill.supplierName }}
                        </div>
                      </td>
                      <td class="py-3.5 px-3.5 text-right font-medium text-gray-700 whitespace-nowrap">
                        {{ formatCurrency(bill.busyAmount) }}
                      </td>
                      <td class="py-3.5 px-3.5 text-right font-bold text-gray-900 whitespace-nowrap">
                        {{ formatCurrency(bill.tallyAmount) }}
                      </td>
                      <td class="py-3.5 px-3.5 text-center">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                          :class="{
                            'bg-amber-100 text-amber-800 border border-amber-200': bill.status === 'AMEND_REFERENCE',
                            'bg-sky-100 text-sky-800 border border-sky-200': bill.status === 'COMBINED_ENTRY',
                            'bg-rose-100 text-rose-800 border border-rose-200': bill.status === 'VALUE_MISMATCH'
                          }"
                        >
                          {{ bill.status === 'AMEND_REFERENCE' ? 'Reference Typo' : bill.status === 'COMBINED_ENTRY' ? 'Combined Entry' : 'Amount Mismatch' }}
                        </span>
                      </td>
                      <td class="py-3.5 px-4 text-xs text-gray-700 leading-relaxed font-normal">
                        {{ bill.issueDetected }}
                      </td>
                      <td class="py-3.5 px-4 text-xs leading-relaxed">
                        <div
                          class="p-2 rounded-lg border text-xs"
                          :class="{
                            'bg-amber-50/90 border-amber-200 text-amber-950 font-medium': bill.status === 'AMEND_REFERENCE',
                            'bg-sky-50/90 border-sky-200 text-sky-950': bill.status === 'COMBINED_ENTRY',
                            'bg-rose-50/90 border-rose-200 text-rose-950 font-medium': bill.status === 'VALUE_MISMATCH'
                          }"
                        >
                          {{ bill.howToCorrect }}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Financials & Bills Slide-over Modal / Drawer -->
    <Teleport to="body">
      <div
        v-if="selectedParty"
        class="fixed inset-0 z-[9999] overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end"
        @click.self="selectedParty = null"
      >
        <div class="w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <!-- Drawer Header -->
          <div class="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/70 flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide shrink-0">
                  {{ activeEntityMode === 'debtors' ? 'Customer Financial Overview' : 'Supplier Financial Overview' }}
                </span>
                <span v-if="selectedParty.parent" class="text-xs text-gray-500 truncate max-w-[200px]">{{ selectedParty.parent }}</span>
              </div>
              <h3 class="text-base sm:text-lg font-bold text-gray-900 mt-1 break-words leading-snug">{{ selectedParty.party }}</h3>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="selectedParty = null"
                class="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Drawer Body with Scroll -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <!-- 3 Stat Cards in Drawer -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-gray-50 rounded-xl p-3 border border-gray-200/80">
                <span class="text-[11px] font-semibold text-gray-500 uppercase">{{ activeEntityMode === 'debtors' ? 'Total Billed' : 'Total Purchased' }}</span>
                <p class="text-sm sm:text-base font-extrabold text-gray-900 mt-0.5">{{ formatCurrency(activeEntityMode === 'debtors' ? selectedParty.totalBilled : (selectedParty.totalPurchased || selectedParty.totalBilled)) }}</p>
              </div>
              <div class="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/80">
                <span class="text-[11px] font-semibold text-emerald-800 uppercase">Total Paid</span>
                <p class="text-sm sm:text-base font-extrabold text-emerald-700 mt-0.5">{{ formatCurrency(selectedParty.totalPaid) }}</p>
              </div>
              <div class="bg-amber-50/70 rounded-xl p-3 border border-amber-200/80">
                <span class="text-[11px] font-semibold text-amber-800 uppercase">{{ activeEntityMode === 'debtors' ? 'Net Pending' : 'Net Payable' }}</span>
                <p class="text-sm sm:text-base font-extrabold text-amber-700 mt-0.5">
                  {{ selectedParty.netPending > 0 ? formatCurrency(selectedParty.netPending) : '₹0' }}
                </p>
              </div>
            </div>

            <!-- Average Payment Turnaround / Completion Time Stat Card -->
            <div class="bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-transparent border border-amber-200/80 rounded-2xl p-4 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Clock class="w-4 h-4" />
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-gray-900">Average Payment Completion Time</h4>
                    <p class="text-[11px] text-gray-500">Days Turnover & Settlement Cycle</p>
                  </div>
                </div>
                <span
                  class="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full"
                  :class="getAvgPaymentBadgeClass(selectedParty)"
                >
                  {{ getPaymentSpeedLabel(selectedParty) }}
                </span>
              </div>

              <div class="pt-2 border-t border-amber-200/50 flex items-baseline justify-between">
                <div>
                  <span class="text-xl sm:text-2xl font-extrabold" :class="getAvgPaymentColor(selectedParty)">
                    {{ getAvgPaymentDaysText(selectedParty) }}
                  </span>
                  <span class="text-xs text-gray-500 ml-1.5 font-normal">turnaround cycle</span>
                </div>
                <div v-if="selectedParty.billsCount > 0" class="text-right text-[11px] text-gray-600">
                  <span>Avg Overdue: </span>
                  <span class="font-bold text-amber-800">{{ getPartyAvgOverdue(selectedParty) }} days</span>
                </div>
              </div>
            </div>

            <!-- Progress in Drawer -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-semibold">
                <span class="text-gray-700">{{ activeEntityMode === 'debtors' ? 'Account Collection Rate' : 'Account Payment Rate' }}</span>
                <span :class="(activeEntityMode === 'debtors' ? selectedParty.collectionRate : selectedParty.paymentRate) >= 80 ? 'text-emerald-700 font-bold' : (activeEntityMode === 'debtors' ? selectedParty.collectionRate : selectedParty.paymentRate) >= 50 ? 'text-amber-700 font-bold' : 'text-rose-700 font-bold'">
                  {{ activeEntityMode === 'debtors' ? selectedParty.collectionRate : selectedParty.paymentRate }}% Settled
                </span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="(activeEntityMode === 'debtors' ? selectedParty.collectionRate : selectedParty.paymentRate) >= 80 ? 'bg-emerald-500' : (activeEntityMode === 'debtors' ? selectedParty.collectionRate : selectedParty.paymentRate) >= 50 ? 'bg-amber-500' : 'bg-rose-500'"
                  :style="{ width: `${Math.min(100, activeEntityMode === 'debtors' ? selectedParty.collectionRate : selectedParty.paymentRate)}%` }"
                ></div>
              </div>
            </div>

            <!-- Bill Category Tabs -->
            <div class="border-b border-gray-200 flex items-center justify-between gap-2 pt-2">
              <div class="flex items-center gap-1">
                <button
                  @click="selectedBillTab = 'pending'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'pending' ? 'bg-amber-100 text-amber-900 font-extrabold' : 'text-gray-600 hover:bg-gray-100'"
                >
                  Pending Bills
                  <span v-if="partyBillsData?.pendingBills" class="ml-1 px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px]">
                    {{ partyBillsData.pendingBills.length }}
                  </span>
                </button>

                <button
                  @click="selectedBillTab = 'partial'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'partial' ? 'bg-amber-100 text-amber-900 font-extrabold' : 'text-gray-600 hover:bg-gray-100'"
                >
                  Partially Paid
                  <span v-if="partyBillsData?.partialBills" class="ml-1 px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px]">
                    {{ partyBillsData.partialBills.length }}
                  </span>
                </button>

                <button
                  @click="selectedBillTab = 'cleared'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'cleared' ? 'bg-emerald-100 text-emerald-900 font-extrabold' : 'text-gray-600 hover:bg-gray-100'"
                >
                  Cleared Bills
                  <span v-if="partyBillsData?.clearedBills" class="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 text-[10px]">
                    {{ partyBillsData.clearedBills.length }}
                  </span>
                </button>

                <button
                  @click="selectedBillTab = 'all'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'all' ? 'bg-gray-200 text-gray-900 font-extrabold' : 'text-gray-600 hover:bg-gray-100'"
                >
                  All ({{ partyBillsData?.allBills ? partyBillsData.allBills.length : selectedParty.bills?.length || 0 }})
                </button>
              </div>

              <!-- Search Bills inside drawer -->
              <div class="relative w-40 sm:w-48">
                <Search class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="billSearchQuery"
                  type="text"
                  placeholder="Filter bills..."
                  class="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <!-- Loading State for detailed bills -->
            <div v-if="partyBillsLoading" class="py-8 text-center text-gray-500 space-y-2">
              <RefreshCw class="w-5 h-5 mx-auto animate-spin text-amber-600" />
              <p class="text-xs">Fetching live voucher audit...</p>
            </div>

            <!-- Bills List in Drawer -->
            <div v-else-if="filteredPartyBills.length > 0" class="space-y-2.5">
              <div
                v-for="bill in filteredPartyBills"
                :key="bill.ref"
                class="p-3.5 rounded-xl border transition-all"
                :class="bill.status === 'CLEARED' ? 'bg-emerald-50/30 border-emerald-200/60' : bill.status === 'PARTIAL' ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-gray-200 shadow-2xs'"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-xs sm:text-sm text-gray-900">{{ bill.ref }}</span>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                      :class="bill.status === 'CLEARED' ? 'bg-emerald-100 text-emerald-800' : bill.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'"
                    >
                      {{ bill.status === 'CLEARED' ? 'Fully Cleared' : bill.status === 'PARTIAL' ? 'Partially Paid' : 'Open / Due' }}
                    </span>
                  </div>
                  <div class="text-right">
                    <span class="text-sm sm:text-base font-extrabold" :class="bill.status === 'CLEARED' ? 'text-emerald-700' : 'text-amber-800'">
                      {{ formatCurrency(bill.amount) }}
                    </span>
                    <div v-if="bill.originalAmount && bill.originalAmount !== bill.amount" class="text-[10px] text-gray-400">
                      Total: {{ formatCurrency(bill.originalAmount) }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
                  <div class="flex items-center gap-3">
                    <span class="flex items-center gap-1">
                      <Calendar class="w-3 h-3 text-gray-400" />
                      {{ formatDate(bill.date) }}
                    </span>
                    <span v-if="bill.dueDate" class="text-gray-400">Due: {{ formatDate(bill.dueDate) }}</span>
                  </div>

                  <div class="flex items-center gap-2">
                    <span
                      v-if="bill.overdueDays > 0"
                      class="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200"
                    >
                      {{ bill.overdueDays }} days overdue
                    </span>
                    <span v-else-if="bill.status === 'CLEARED'" class="text-emerald-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 class="w-3 h-3" />
                      Settled
                    </span>
                    <span v-else class="text-emerald-700 font-semibold">Current (Within Term)</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty Bills State -->
            <div v-else class="py-12 text-center text-gray-500">
              <Clock3 class="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p class="font-medium">No bills found in this view</p>
              <p class="text-xs text-gray-400 mt-0.5">This party may not have any unadjusted or pending bills.</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  IndianRupee, Users, AlertTriangle, ShieldCheck, Lock,
  Building2, Clock, Search, X, ChevronRight,
  CheckCircle2, AlertCircle, Clock3, FileText, Calendar, RefreshCw,
  Scale, Receipt, FileSpreadsheet, Copy, Check, UserX
} from 'lucide-vue-next'

const route = useRoute()

// Entity Mode Toggle: 'debtors' (Sales) vs 'creditors' (Purchases)
const activeEntityMode = ref<'debtors' | 'creditors'>('debtors')

// Primary View Navigation: 'debtors' (Accounts Table) vs 'reconciliation'
const activeMainView = ref<'debtors' | 'reconciliation'>('debtors')
const activeReconSubTab = ref<'unposted' | 'discrepancies' | 'missing_parties' | 'bill_value'>('unposted')

// Loading & Data States
const loading = ref(true)
const reconLoading = ref(false)

const debtorsData = ref<any | null>(null)
const creditorsData = ref<any | null>(null)
const salesReconData = ref<any | null>(null)
const purchasesReconData = ref<any | null>(null)

// Unified active data bindings
const tallyData = computed(() => activeEntityMode.value === 'debtors' ? debtorsData.value : creditorsData.value)
const reconData = computed(() => activeEntityMode.value === 'debtors' ? salesReconData.value : purchasesReconData.value)

// Filter & Sort State for Accounts
const searchQuery = ref('')
const sortBy = ref<'pending_desc' | 'billed_desc' | 'paid_desc' | 'rate_asc' | 'rate_desc' | 'bills_desc' | 'speed_asc' | 'speed_desc'>('pending_desc')
const currentPage = ref(1)
const pageSize = 25

// Reconciliation view state
const reconSearchQuery = ref('')
const unpostedCategoryFilter = ref<string>('all')
const partyDiscrepancyFilter = ref<'all' | 'BUSY_HIGHER' | 'TALLY_HIGHER'>('all')

const unpostedPage = ref(1)
const unpostedPageSize = 25

const discrepancyPage = ref(1)
const discrepancyPageSize = 25

const missingPartiesPage = ref(1)
const missingPartiesPageSize = 25

const copiedVoucher = ref<string | null>(null)

// Drill-down Modal state
const selectedParty = ref<any | null>(null)
const billSearchQuery = ref('')
const selectedBillTab = ref<'pending' | 'partial' | 'cleared' | 'all'>('pending')
const partyBillsLoading = ref(false)
const partyBillsData = ref<any | null>(null)

// ==========================================
// DATA FETCHING METHODS
// ==========================================
const fetchDebtors = async () => {
  try {
    const res = await $fetch<any>('/api/admin/tally/receivables')
    if (res && res.success && res.data) {
      debtorsData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load Tally debtors:', err)
  }
}

const fetchCreditors = async () => {
  try {
    const res = await $fetch<any>('/api/admin/tally/payables')
    if (res && res.success && res.data) {
      creditorsData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load Tally creditors:', err)
  }
}

const fetchSalesReconciliation = async () => {
  try {
    const res = await $fetch<any>('/api/admin/tally/reconciliation?type=sales')
    if (res && res.success && res.data) {
      salesReconData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load sales reconciliation audit:', err)
  }
}

const fetchPurchasesReconciliation = async () => {
  try {
    const res = await $fetch<any>('/api/admin/tally/reconciliation?type=purchases')
    if (res && res.success && res.data) {
      purchasesReconData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load purchases reconciliation audit:', err)
  }
}

const switchEntityMode = async (mode: 'debtors' | 'creditors') => {
  activeEntityMode.value = mode
  currentPage.value = 1
  unpostedPage.value = 1
  discrepancyPage.value = 1
  missingPartiesPage.value = 1
  searchQuery.value = ''
  reconSearchQuery.value = ''
  unpostedCategoryFilter.value = 'all'

  if (mode === 'creditors' && (!creditorsData.value || !purchasesReconData.value)) {
    loading.value = !creditorsData.value
    reconLoading.value = !purchasesReconData.value
    await Promise.all([
      fetchCreditors(),
      fetchPurchasesReconciliation()
    ])
    loading.value = false
    reconLoading.value = false
  }
}

const refreshAllData = async () => {
  loading.value = true
  reconLoading.value = true
  await Promise.all([
    fetchDebtors(),
    fetchCreditors(),
    fetchSalesReconciliation(),
    fetchPurchasesReconciliation()
  ])
  loading.value = false
  reconLoading.value = false
}

const formattedSyncTime = computed(() => {
  if (!tallyData.value?.syncedAt) return 'Never'
  const d = new Date(tallyData.value.syncedAt)
  if (isNaN(d.getTime())) return tallyData.value.syncedAt
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

// ==========================================
// ACCOUNTS FILTERING & SORTING
// ==========================================
const filteredParties = computed(() => {
  if (!tallyData.value?.parties) return []
  let list = [...tallyData.value.parties]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter((p: any) =>
      p.party.toLowerCase().includes(q) ||
      (p.parent && p.parent.toLowerCase().includes(q))
    )
  }

  // Sort
  if (sortBy.value === 'pending_desc') {
    list.sort((a, b) => (b.netPending || 0) - (a.netPending || 0))
  } else if (sortBy.value === 'billed_desc') {
    list.sort((a, b) => (b.totalBilled || b.totalPurchased || 0) - (a.totalBilled || a.totalPurchased || 0))
  } else if (sortBy.value === 'paid_desc') {
    list.sort((a, b) => (b.totalPaid || 0) - (a.totalPaid || 0))
  } else if (sortBy.value === 'rate_asc') {
    list.sort((a, b) => (a.collectionRate || a.paymentRate || 0) - (b.collectionRate || b.paymentRate || 0))
  } else if (sortBy.value === 'rate_desc') {
    list.sort((a, b) => (b.collectionRate || b.paymentRate || 0) - (a.collectionRate || a.paymentRate || 0))
  } else if (sortBy.value === 'bills_desc') {
    list.sort((a, b) => (b.billsCount || 0) - (a.billsCount || 0))
  } else if (sortBy.value === 'speed_asc') {
    list.sort((a, b) => getAvgPaymentDays(a) - getAvgPaymentDays(b))
  } else if (sortBy.value === 'speed_desc') {
    list.sort((a, b) => getAvgPaymentDays(b) - getAvgPaymentDays(a))
  }

  return list
})

const totalPages = computed(() => Math.ceil(filteredParties.value.length / pageSize) || 1)

const paginatedParties = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredParties.value.slice(start, start + pageSize)
})

// ==========================================
// RECONCILIATION FILTERING & PAGINATION
// ==========================================
const filteredUnpostedVouchers = computed(() => {
  if (!reconData.value?.unpostedVouchers) return []
  let list = reconData.value.unpostedVouchers

  if (unpostedCategoryFilter.value !== 'all') {
    list = list.filter((v: any) => v.category === unpostedCategoryFilter.value)
  }

  if (reconSearchQuery.value.trim()) {
    const q = reconSearchQuery.value.toLowerCase().trim()
    list = list.filter((v: any) =>
      v.voucherNo.toLowerCase().includes(q) ||
      (v.customerName && v.customerName.toLowerCase().includes(q)) ||
      (v.supplierName && v.supplierName.toLowerCase().includes(q)) ||
      (v.tallyParty && v.tallyParty.toLowerCase().includes(q))
    )
  }

  return list
})

const totalUnpostedPages = computed(() => Math.ceil(filteredUnpostedVouchers.value.length / unpostedPageSize) || 1)
const paginatedUnpostedVouchers = computed(() => {
  const start = (unpostedPage.value - 1) * unpostedPageSize
  return filteredUnpostedVouchers.value.slice(start, start + unpostedPageSize)
})

const filteredPartyDiscrepancies = computed(() => {
  if (!reconData.value?.partyDiscrepancies) return []
  let list = reconData.value.partyDiscrepancies

  if (partyDiscrepancyFilter.value !== 'all') {
    list = list.filter((p: any) => p.status === partyDiscrepancyFilter.value)
  }

  if (reconSearchQuery.value.trim()) {
    const q = reconSearchQuery.value.toLowerCase().trim()
    list = list.filter((p: any) =>
      ((p.customerName || p.supplierName) && (p.customerName || p.supplierName).toLowerCase().includes(q)) ||
      (p.tallyParty && p.tallyParty.toLowerCase().includes(q))
    )
  }

  return list
})

const totalDiscrepancyPages = computed(() => Math.ceil(filteredPartyDiscrepancies.value.length / discrepancyPageSize) || 1)
const paginatedPartyDiscrepancies = computed(() => {
  const start = (discrepancyPage.value - 1) * discrepancyPageSize
  return filteredPartyDiscrepancies.value.slice(start, start + discrepancyPageSize)
})

const filteredMissingParties = computed(() => {
  if (!reconData.value?.unmatchedParties) return []
  let list = reconData.value.unmatchedParties

  if (reconSearchQuery.value.trim()) {
    const q = reconSearchQuery.value.toLowerCase().trim()
    list = list.filter((p: any) =>
      (p.customerName || p.supplierName) && (p.customerName || p.supplierName).toLowerCase().includes(q)
    )
  }

  return list
})

const totalMissingPartiesPages = computed(() => Math.ceil(filteredMissingParties.value.length / missingPartiesPageSize) || 1)
const paginatedMissingParties = computed(() => {
  const start = (missingPartiesPage.value - 1) * missingPartiesPageSize
  return filteredMissingParties.value.slice(start, start + missingPartiesPageSize)
})

const filteredBillDiscrepancies = computed(() => {
  if (!reconData.value?.billValueDiscrepancies) return []
  let list = reconData.value.billValueDiscrepancies

  if (reconSearchQuery.value.trim()) {
    const q = reconSearchQuery.value.toLowerCase().trim()
    list = list.filter((b: any) =>
      b.ref.toLowerCase().includes(q) ||
      b.party.toLowerCase().includes(q) ||
      ((b.customerName || b.supplierName) && (b.customerName || b.supplierName).toLowerCase().includes(q))
    )
  }

  return list
})

// ==========================================
// ACTIONS & MODAL HELPERS
// ==========================================
const copyVoucherNo = (voucherNo: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(voucherNo)
    copiedVoucher.value = voucherNo
    setTimeout(() => {
      if (copiedVoucher.value === voucherNo) copiedVoucher.value = null
    }, 2000)
  }
}

const openDebtorDetails = async (party: any) => {
  selectedParty.value = party
  billSearchQuery.value = ''
  selectedBillTab.value = 'pending'
  partyBillsLoading.value = true
  partyBillsData.value = null

  try {
    const res = await $fetch<any>(`/api/admin/tally/party-bills?party=${encodeURIComponent(party.party)}&type=${activeEntityMode.value}`)
    if (res && res.success && res.data) {
      partyBillsData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load detailed party bills:', err)
  } finally {
    partyBillsLoading.value = false
  }
}

const viewPartyDebtorDetails = (tallyPartyName: string) => {
  if (!tallyData.value?.parties) return
  const party = tallyData.value.parties.find((p: any) => p.party.toLowerCase() === tallyPartyName.toLowerCase())
  if (party) {
    activeMainView.value = 'debtors'
    openDebtorDetails(party)
  }
}

const activeBillsList = computed(() => {
  if (partyBillsData.value) {
    if (selectedBillTab.value === 'pending') return partyBillsData.value.pendingBills || []
    if (selectedBillTab.value === 'partial') return partyBillsData.value.partialBills || []
    if (selectedBillTab.value === 'cleared') return partyBillsData.value.clearedBills || []
    return partyBillsData.value.allBills || []
  }
  return selectedParty.value?.bills || []
})

const filteredPartyBills = computed(() => {
  const list = activeBillsList.value
  if (!billSearchQuery.value.trim()) return list
  const q = billSearchQuery.value.toLowerCase().trim()
  return list.filter((b: any) =>
    (b.ref && b.ref.toLowerCase().includes(q)) ||
    (b.date && b.date.toLowerCase().includes(q))
  )
})

// ==========================================
// FORMATTERS & DATE HELPERS
// ==========================================
function formatDate(dStr: string | undefined): string {
  if (!dStr) return '-'
  const d = new Date(dStr)
  if (isNaN(d.getTime())) return dStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

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

function getAvgPaymentDays(party: any): number {
  const base = Number(party?.totalBilled || party?.totalPurchased || 0)
  if (!party || base <= 0) return 0
  const pending = Number(party.netPending || 0)
  if (pending <= 0) return 0

  const now = new Date()
  const currentYear = now.getFullYear()
  const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1
  const fyStart = new Date(fyStartYear, 3, 1)
  const daysElapsed = Math.max(1, Math.round((now.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24)))

  return Math.round((pending / base) * daysElapsed)
}

function getAvgPaymentDaysText(party: any): string {
  if (!party) return '-'
  if (Number(party.netPending || 0) <= 0) {
    return 'Immediate / Clear'
  }
  const days = getAvgPaymentDays(party)
  if (days <= 0) return 'Immediate'
  return `~${days} Days`
}

function getAvgPaymentBadgeClass(party: any): string {
  if (!party || Number(party.netPending || 0) <= 0) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  }
  const days = getAvgPaymentDays(party)
  if (days <= 30) return 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  if (days <= 60) return 'bg-amber-50 text-amber-800 border border-amber-200'
  return 'bg-rose-50 text-rose-800 border border-rose-200'
}

function getAvgPaymentColor(party: any): string {
  if (!party || Number(party.netPending || 0) <= 0) return 'text-emerald-700'
  const days = getAvgPaymentDays(party)
  if (days <= 30) return 'text-emerald-700'
  if (days <= 60) return 'text-amber-700'
  return 'text-rose-700'
}

function getPaymentSpeedLabel(party: any): string {
  if (!party || Number(party.netPending || 0) <= 0) return 'Immediate'
  const days = getAvgPaymentDays(party)
  if (days <= 30) return 'Prompt'
  if (days <= 60) return 'Moderate'
  return 'Slow Turnaround'
}

function getPartyAvgOverdue(party: any): number {
  if (!party?.bills || party.bills.length === 0) return 0
  const total = party.bills.reduce((sum: number, b: any) => sum + (Number(b.overdueDays) || 0), 0)
  return Math.round(total / party.bills.length)
}

onMounted(async () => {
  loading.value = true
  reconLoading.value = true

  await Promise.all([
    fetchDebtors(),
    fetchSalesReconciliation(),
    fetchCreditors(),
    fetchPurchasesReconciliation()
  ])

  loading.value = false
  reconLoading.value = false

  // Deep linking: if ?sub=recon in url
  if (route.query.sub === 'recon') {
    activeMainView.value = 'reconciliation'
  }
  if (route.query.mode === 'creditors' || route.query.mode === 'payables') {
    activeEntityMode.value = 'creditors'
  }
})
</script>
