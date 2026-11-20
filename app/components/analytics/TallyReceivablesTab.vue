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

    <!-- MAIN SEGMENT SWITCHER: Debtors vs Busy-Tally Reconciliation -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-2">
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          @click="activeMainView = 'debtors'"
          class="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
          :class="activeMainView === 'debtors' ? 'bg-[#1b3b5f] text-white shadow-sm' : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'"
        >
          <Users class="w-4 h-4" />
          <span>Sundry Debtors Accounts</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="activeMainView === 'debtors' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'">
            {{ tallyData?.summary?.totalParties || 354 }}
          </span>
        </button>

        <button
          type="button"
          @click="activeMainView = 'reconciliation'"
          class="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
          :class="activeMainView === 'reconciliation' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-900 hover:bg-amber-50/60 border border-amber-300'"
        >
          <Scale class="w-4 h-4" />
          <span>BUSY ↔ Tally Reconciliation</span>
          <span
            v-if="reconData?.summary?.netDiscrepancy"
            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
            :class="activeMainView === 'reconciliation' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-800 border border-rose-200'"
          >
            {{ formatCrores(reconData.summary.netDiscrepancy) }} Gap
          </span>
        </button>
      </div>

      <div v-if="activeMainView === 'reconciliation' && reconData" class="flex items-center gap-2 text-xs text-gray-500 self-end sm:self-center">
        <span class="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
          <AlertCircle class="w-3.5 h-3.5" />
          {{ reconData.summary.unpostedVouchersCount }} Unposted Invoices
        </span>
      </div>
    </div>

    <!-- ========================================================================================= -->
    <!-- VIEW 1: SUNDRY DEBTORS LEDGER ACCOUNTS (EXISTING VIEW) -->
    <!-- ========================================================================================= -->
    <div v-if="activeMainView === 'debtors'" class="space-y-6">
      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs h-32 animate-pulse"></div>
      </div>

      <!-- Content when loaded -->
      <div v-else-if="tallyData" class="space-y-6">
        <!-- 4 Executive KPI Cards (Billed vs Paid vs Pending) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- 1. Total Invoiced (Billed) -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Billed (Debits)</span>
              <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/80">
                <IndianRupee class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatCrores(tallyData.summary.totalBilled || tallyData.summary.totalOutstanding) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(tallyData.summary.totalBilled || tallyData.summary.totalOutstanding) }}</span>
                <span class="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                  Invoiced Sales
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          </div>

          <!-- 2. Total Paid (Receipts) -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Collected (Paid)</span>
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
                  {{ tallyData.summary.overallCollectionRate }}% Collected
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          </div>

          <!-- 3. Net Receivables Pending -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Net Pending Balance</span>
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
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Debtors</span>
              <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/80">
                <Users class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatNumber(tallyData.summary.totalParties) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>Avg Pending / Debtor</span>
                <span class="font-semibold text-gray-700">
                  {{ formatCurrency(tallyData.summary.totalParties > 0 ? Math.round((tallyData.summary.totalNetPending || tallyData.summary.totalOutstanding) / tallyData.summary.totalParties) : 0) }}
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-600"></div>
          </div>
        </div>

        <!-- Overall Collection Progress Bar -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs space-y-2.5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div class="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
              <span>Overall Collection Health</span>
              <span class="text-xs font-normal text-gray-500 hidden md:inline">(Total Payments vs Total Billing Demand)</span>
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
              :style="{ width: `${Math.min(100, tallyData.summary.overallCollectionRate)}%` }"
              :title="`Paid: ${tallyData.summary.overallCollectionRate}%`"
            ></div>
            <div
              class="bg-amber-400 h-full rounded-r-full transition-all duration-500"
              :style="{ width: `${Math.max(0, 100 - tallyData.summary.overallCollectionRate)}%` }"
              :title="`Pending: ${(100 - tallyData.summary.overallCollectionRate).toFixed(1)}%`"
            ></div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
            <span>0%</span>
            <span class="font-bold text-emerald-700">{{ tallyData.summary.overallCollectionRate }}% Collected</span>
            <span>100% Demand</span>
          </div>
        </div>

        <!-- Debtors Search, Filter and Table Card -->
        <div class="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-gray-900 text-base">Sundry Debtors Ledger Accounts</h3>
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
                  placeholder="Search debtor name or group..."
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
                <option value="pending_desc">Highest Net Pending</option>
                <option value="billed_desc">Highest Total Billed</option>
                <option value="paid_desc">Highest Total Paid</option>
                <option value="rate_asc">Lowest Collection Rate (Risk)</option>
                <option value="rate_desc">Highest Collection Rate</option>
                <option value="bills_desc">Most Unadjusted Bills</option>
                <option value="speed_asc">Fastest Payers (Lowest Days)</option>
                <option value="speed_desc">Slowest Payers (Highest Days)</option>
              </select>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50/80 text-gray-500 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">Debtor Party / Ledger</th>
                  <th class="py-3 px-4 text-right">Total Billed</th>
                  <th class="py-3 px-4 text-right">Total Paid</th>
                  <th class="py-3 px-4 text-right">Net Pending</th>
                  <th class="py-3 px-4 text-center">Collection %</th>
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
                    {{ formatCurrency(party.totalBilled) }}
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
                        <div class="bg-emerald-500 h-full rounded-full" :style="{ width: `${Math.min(100, party.collectionRate)}%` }"></div>
                      </div>
                      <span class="text-xs font-bold" :class="party.collectionRate >= 80 ? 'text-emerald-700' : party.collectionRate >= 50 ? 'text-amber-700' : 'text-rose-700'">
                        {{ party.collectionRate }}%
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
                    <Search class="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p class="font-medium">No debtor accounts match your search.</p>
                    <button @click="searchQuery = ''" class="text-xs text-amber-700 underline mt-1">Clear search</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div v-if="filteredParties.length > pageSize" class="p-4 border-t border-gray-200 flex items-center justify-between">
            <span class="text-xs text-gray-500">
              Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredParties.length) }} of {{ filteredParties.length }}
            </span>
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
          <!-- 1. Total Busy Sales -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Live BUSY Sales</span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
                <Receipt class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatCrores(reconData.summary.totalBusySales) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(reconData.summary.totalBusySales) }}</span>
                <span class="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                  {{ formatNumber(reconData.summary.busyVoucherCount) }} Invoices
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          </div>

          <!-- 2. Total Tally Billed -->
          <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Tally Debtors Billed</span>
              <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/80">
                <Building2 class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {{ formatCrores(reconData.summary.totalTallyBilled) }}
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>{{ formatCurrency(reconData.summary.totalTallyBilled) }}</span>
                <span class="text-blue-800 font-bold bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                  {{ formatNumber(reconData.summary.tallyDebtorCount) }} Debtors
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          </div>

          <!-- 3. Overall Net Discrepancy Gap -->
          <div class="bg-white rounded-2xl p-5 border border-rose-200 shadow-xs relative overflow-hidden group hover:border-rose-300 transition-all bg-rose-50/20">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-rose-800">Unposted Sales Gap</span>
              <div class="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200">
                <AlertTriangle class="w-5 h-5" />
              </div>
            </div>
            <div class="mt-3">
              <div class="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">
                {{ formatCrores(reconData.summary.netDiscrepancy) }}
              </div>
              <div class="flex items-center justify-between text-xs text-rose-600 mt-2">
                <span>{{ formatCurrency(reconData.summary.netDiscrepancy) }}</span>
                <span class="text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 text-[11px]">
                  Busy &gt; Tally
                </span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
          </div>

          <!-- 4. Unposted Invoices Count & Amount -->
          <div class="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs relative overflow-hidden group hover:border-amber-300 transition-all bg-amber-50/20">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-amber-800">Unposted Invoices</span>
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
        <div class="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <Scale class="w-4 h-4" />
            </div>
            <div class="text-xs sm:text-sm text-gray-700">
              <p class="font-bold text-gray-900">Why does BUSY have ₹66.03 Lakhs more sales than Tally?</p>
              <p class="mt-0.5 text-gray-600">
                <strong>{{ formatCrores(reconData.summary.missingPartiesSales) }}</strong> ({{ reconData.summary.missingPartiesCount }} customers) is from parties missing in Tally's Debtors list, and the remaining <strong>{{ formatCrores(reconData.summary.netDiscrepancy - reconData.summary.missingPartiesSales) }}</strong> is from recent/unposted invoices in active customer accounts.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="exportUnpostedToCsv"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Export All Unposted (CSV)</span>
            </button>
          </div>
        </div>

        <!-- RECONCILIATION SUB-TABS -->
        <div class="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <!-- Sub-tab buttons -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                @click="activeReconSubTab = 'unposted'"
                class="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
                :class="activeReconSubTab === 'unposted' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                <FileText class="w-3.5 h-3.5" />
                <span>Unposted BUSY Invoices</span>
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
                <span>Party Balance Discrepancies</span>
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
                <span>Missing Debtors in Tally</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold" :class="activeReconSubTab === 'missing_parties' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'">
                  {{ reconData.unmatchedParties.length }}
                </span>
              </button>
            </div>

            <!-- Search & Filters -->
            <div class="flex items-center gap-2.5 flex-wrap">
              <div class="relative w-full sm:w-60">
                <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  v-model="reconSearchQuery"
                  type="text"
                  :placeholder="activeReconSubTab === 'unposted' ? 'Search voucher # or customer...' : activeReconSubTab === 'discrepancies' ? 'Search customer or tally party...' : 'Search missing customer...'"
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
                class="px-2.5 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Unposted Invoices</option>
                <option value="UNPOSTED_INVOICE">In Active Accounts</option>
                <option value="MISSING_CUSTOMER">From Missing Customers</option>
              </select>

              <!-- Filter select for Discrepancies -->
              <select
                v-if="activeReconSubTab === 'discrepancies'"
                v-model="partyDiscrepancyFilter"
                class="px-2.5 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Discrepant Accounts</option>
                <option value="BUSY_HIGHER">Busy Higher (Under-reported in Tally)</option>
                <option value="TALLY_HIGHER">Tally Higher</option>
              </select>

              <!-- CSV Export for current sub-tab -->
              <button
                @click="exportCurrentReconTab"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition-all cursor-pointer"
                title="Export current tab to CSV"
              >
                <Download class="w-3.5 h-3.5 text-gray-500" />
                <span class="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- SUB-TAB 1: UNPOSTED BUSY INVOICES TABLE -->
          <!-- ========================================== -->
          <div v-if="activeReconSubTab === 'unposted'" class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50/80 text-gray-500 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">Voucher No</th>
                  <th class="py-3 px-4">Date</th>
                  <th class="py-3 px-4">Customer Name (BUSY)</th>
                  <th class="py-3 px-4">Tally Debtor Ledger</th>
                  <th class="py-3 px-4 text-right">Taxable</th>
                  <th class="py-3 px-4 text-right">GST</th>
                  <th class="py-3 px-4 text-right">Gross Amount</th>
                  <th class="py-3 px-4 text-center">Status / Reason</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(voucher, idx) in paginatedUnpostedVouchers"
                  :key="voucher.voucherNo"
                  class="hover:bg-amber-50/20 transition-colors"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (unpostedPage - 1) * unpostedPageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-mono font-bold text-gray-900">
                    <div class="flex items-center gap-1.5">
                      <span>{{ voucher.voucherNo }}</span>
                      <button
                        @click="copyVoucherNo(voucher.voucherNo)"
                        class="text-gray-400 hover:text-amber-700 p-0.5 rounded cursor-pointer"
                        :title="'Copy voucher ' + voucher.voucherNo"
                      >
                        <Check v-if="copiedVoucher === voucher.voucherNo" class="w-3 h-3 text-emerald-600" />
                        <Copy v-else class="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                    {{ formatDate(voucher.voucherDate) }}
                  </td>
                  <td class="py-3.5 px-4 font-semibold text-gray-900">
                    {{ voucher.customerName }}
                  </td>
                  <td class="py-3.5 px-4 text-gray-700">
                    <span v-if="voucher.tallyParty" class="font-medium text-blue-900">
                      {{ voucher.tallyParty }}
                    </span>
                    <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <UserX class="w-2.5 h-2.5" />
                      Not in Tally
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-right text-gray-500 font-mono">
                    {{ formatCurrency(voucher.taxableAmount) }}
                  </td>
                  <td class="py-3.5 px-4 text-right text-gray-500 font-mono">
                    {{ formatCurrency(voucher.taxAmount) }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-bold text-rose-700 font-mono">
                    {{ formatCurrency(voucher.amount) }}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      :class="voucher.category === 'MISSING_CUSTOMER' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'"
                      :title="voucher.reason"
                    >
                      <Clock3 class="w-3 h-3 shrink-0" />
                      <span>{{ voucher.category === 'MISSING_CUSTOMER' ? 'Missing Customer' : 'Unposted Bill' }}</span>
                    </span>
                  </td>
                </tr>

                <tr v-if="filteredUnpostedVouchers.length === 0">
                  <td colspan="9" class="py-12 text-center text-gray-500">
                    <CheckCircle2 class="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    <p class="font-medium">No unposted vouchers match your criteria.</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination for Unposted Vouchers -->
            <div v-if="filteredUnpostedVouchers.length > unpostedPageSize" class="p-4 border-t border-gray-200 flex items-center justify-between">
              <span class="text-xs text-gray-500">
                Showing {{ (unpostedPage - 1) * unpostedPageSize + 1 }} to {{ Math.min(unpostedPage * unpostedPageSize, filteredUnpostedVouchers.length) }} of {{ filteredUnpostedVouchers.length }}
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
          <!-- SUB-TAB 2: PARTY BALANCE DISCREPANCIES TABLE -->
          <!-- ========================================== -->
          <div v-else-if="activeReconSubTab === 'discrepancies'" class="overflow-x-auto">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50/80 text-gray-500 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">BUSY Customer</th>
                  <th class="py-3 px-4">Tally Ledger Account</th>
                  <th class="py-3 px-4 text-right">BUSY Sales</th>
                  <th class="py-3 px-4 text-right">Tally Billed</th>
                  <th class="py-3 px-4 text-right">Difference (Gap)</th>
                  <th class="py-3 px-4 text-center">Busy Invoices</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(party, idx) in paginatedPartyDiscrepancies"
                  :key="party.customerName"
                  class="hover:bg-amber-50/20 transition-colors"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (discrepancyPage - 1) * discrepancyPageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-900">
                    {{ party.customerName }}
                  </td>
                  <td class="py-3.5 px-4 text-blue-900 font-medium">
                    {{ party.tallyParty }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-medium text-gray-800">
                    {{ formatCurrency(party.busySales) }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-medium text-gray-600">
                    {{ formatCurrency(party.tallyBilled) }}
                  </td>
                  <td
                    class="py-3.5 px-4 text-right font-bold"
                    :class="party.difference > 0 ? 'text-rose-700' : 'text-emerald-700'"
                  >
                    {{ party.difference > 0 ? '+' : '' }}{{ formatCurrency(party.difference) }}
                  </td>
                  <td class="py-3.5 px-4 text-center font-medium text-gray-600">
                    {{ party.busyVoucherCount }} bills
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      :class="party.difference > 0 ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'"
                    >
                      <span>{{ party.difference > 0 ? 'Busy Higher' : 'Tally Higher' }}</span>
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <button
                      @click="viewPartyDebtorDetails(party.tallyParty)"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <span>View Bills</span>
                      <ChevronRight class="w-3 h-3" />
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredPartyDiscrepancies.length === 0">
                  <td colspan="9" class="py-12 text-center text-gray-500">
                    <p class="font-medium">No party discrepancies match your search.</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination for Discrepancies -->
            <div v-if="filteredPartyDiscrepancies.length > discrepancyPageSize" class="p-4 border-t border-gray-200 flex items-center justify-between">
              <span class="text-xs text-gray-500">
                Showing {{ (discrepancyPage - 1) * discrepancyPageSize + 1 }} to {{ Math.min(discrepancyPage * discrepancyPageSize, filteredPartyDiscrepancies.length) }} of {{ filteredPartyDiscrepancies.length }}
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
          <!-- SUB-TAB 3: MISSING CUSTOMERS IN TALLY TABLE -->
          <!-- ========================================== -->
          <div v-else-if="activeReconSubTab === 'missing_parties'" class="overflow-x-auto">
            <div class="p-4 bg-rose-50/40 border-b border-rose-100 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Accounting Action Required:</strong> These {{ reconData.unmatchedParties.length }} customer accounts exist in BUSY with valid invoiced sales totaling <strong>{{ formatCrores(reconData.summary.missingPartiesSales) }}</strong>, but have not been created as Sundry Debtors in Tally Prime. Creating these debtor accounts and entering the vouchers will reconcile <strong>58% of the entire discrepancy</strong>.
              </div>
            </div>

            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="bg-gray-50/80 text-gray-500 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th class="py-3 px-4 w-12 text-center">#</th>
                  <th class="py-3 px-4">Customer Name in BUSY</th>
                  <th class="py-3 px-4 text-right">Total Invoiced Sales</th>
                  <th class="py-3 px-4 text-center">Invoices Count</th>
                  <th class="py-3 px-4 text-center">Latest Invoice Date</th>
                  <th class="py-3 px-4 text-center">Recommended Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="(party, idx) in paginatedMissingParties"
                  :key="party.customerName"
                  class="hover:bg-rose-50/20 transition-colors"
                >
                  <td class="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                    {{ (missingPartiesPage - 1) * missingPartiesPageSize + idx + 1 }}
                  </td>
                  <td class="py-3.5 px-4 font-bold text-gray-900">
                    {{ party.customerName }}
                  </td>
                  <td class="py-3.5 px-4 text-right font-bold text-rose-700">
                    {{ formatCurrency(party.totalSales) }}
                  </td>
                  <td class="py-3.5 px-4 text-center font-medium text-gray-700">
                    {{ party.voucherCount }} bills
                  </td>
                  <td class="py-3.5 px-4 text-center text-gray-600">
                    {{ formatDate(party.latestDate) }}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                      Create Debtor Ledger in Tally
                    </span>
                  </td>
                </tr>

                <tr v-if="filteredMissingParties.length === 0">
                  <td colspan="6" class="py-12 text-center text-gray-500">
                    <p class="font-medium">No missing customer accounts match your search.</p>
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
        </div>
      </div>
    </div>

    <!-- Debtor Financials & Bills Slide-over Modal / Drawer -->
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
                <span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide shrink-0">Customer Financial Overview</span>
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
                <span class="text-[11px] font-semibold text-gray-500 uppercase">Total Billed</span>
                <p class="text-sm sm:text-base font-extrabold text-gray-900 mt-0.5">{{ formatCurrency(selectedParty.totalBilled) }}</p>
              </div>
              <div class="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/80">
                <span class="text-[11px] font-semibold text-emerald-800 uppercase">Total Paid</span>
                <p class="text-sm sm:text-base font-extrabold text-emerald-700 mt-0.5">{{ formatCurrency(selectedParty.totalPaid) }}</p>
              </div>
              <div class="bg-amber-50/70 rounded-xl p-3 border border-amber-200/80">
                <span class="text-[11px] font-semibold text-amber-800 uppercase">Net Pending</span>
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
                    <p class="text-[11px] text-gray-500">Days Sales Outstanding (DSO) & Turnover Cycle</p>
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

            <!-- Collection Progress in Drawer -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-semibold">
                <span class="text-gray-700">Account Collection Rate</span>
                <span :class="selectedParty.collectionRate >= 80 ? 'text-emerald-700 font-bold' : selectedParty.collectionRate >= 50 ? 'text-amber-700 font-bold' : 'text-rose-700 font-bold'">
                  {{ selectedParty.collectionRate }}% Settled
                </span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="selectedParty.collectionRate >= 80 ? 'bg-emerald-500' : selectedParty.collectionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'"
                  :style="{ width: `${Math.min(100, selectedParty.collectionRate)}%` }"
                ></div>
              </div>
            </div>

            <!-- Bill Category Tabs -->
            <div class="border-b border-gray-200 flex items-center justify-between gap-2 pt-2">
              <div class="flex items-center gap-1">
                <button
                  @click="selectedBillTab = 'pending'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'pending' ? 'bg-amber-100 text-amber-900 font-extrabold' : 'text-gray-500 hover:text-gray-700'"
                >
                  Open Pending ({{ partyBillsData?.pendingBills?.length ?? selectedParty.bills?.length ?? 0 }})
                </button>
                <button
                  @click="selectedBillTab = 'partial'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'partial' ? 'bg-amber-100 text-amber-900 font-extrabold' : 'text-gray-500 hover:text-gray-700'"
                >
                  Partial ({{ partyBillsData?.partialBills?.length ?? 0 }})
                </button>
                <button
                  @click="selectedBillTab = 'cleared'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'cleared' ? 'bg-emerald-100 text-emerald-900 font-extrabold' : 'text-gray-500 hover:text-gray-700'"
                >
                  Cleared ({{ partyBillsData?.clearedBills?.length ?? 0 }})
                </button>
                <button
                  @click="selectedBillTab = 'all'"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  :class="selectedBillTab === 'all' ? 'bg-gray-200 text-gray-900 font-extrabold' : 'text-gray-500 hover:text-gray-700'"
                >
                  All Invoices ({{ partyBillsData?.allBills?.length ?? 0 }})
                </button>
              </div>

              <!-- Bill Search -->
              <div class="relative w-36 sm:w-44">
                <Search class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="billSearchQuery"
                  type="text"
                  placeholder="Filter ref/date..."
                  class="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <!-- Loading Bills Spinner -->
            <div v-if="partyBillsLoading" class="py-12 text-center text-gray-400 text-xs">
              <RefreshCw class="w-5 h-5 mx-auto animate-spin text-amber-600 mb-2" />
              Loading complete ledger and cleared bills...
            </div>

            <!-- Invoices List -->
            <div v-else-if="filteredPartyBills.length > 0" class="space-y-2">
              <div
                v-for="b in filteredPartyBills"
                :key="b.ref + b.date"
                class="p-3 rounded-xl border border-gray-200/80 hover:border-gray-300 transition-colors flex items-center justify-between gap-3 text-xs bg-white shadow-2xs"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-gray-900 text-sm">{{ b.ref }}</span>
                    <span
                      class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      :class="b.status === 'CLEARED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : b.status === 'PARTIAL' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-700 border border-amber-200'"
                    >
                      {{ b.status }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 text-gray-500 text-[11px] mt-1">
                    <span class="flex items-center gap-1">
                      <Calendar class="w-3 h-3 text-gray-400" />
                      {{ b.date }}
                    </span>
                    <span v-if="b.overdueDays > 0" class="text-amber-700 font-semibold">
                      {{ b.overdueDays }} days overdue
                    </span>
                    <span v-if="b.itemCount > 0" class="text-gray-400">
                      {{ b.itemCount }} items
                    </span>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <div class="font-bold text-sm text-gray-900">
                    {{ formatCurrency(b.amount) }}
                  </div>
                  <div v-if="b.paidAmount && b.status === 'PARTIAL'" class="text-[11px] text-emerald-600 font-medium">
                    Paid: {{ formatCurrency(b.paidAmount) }}
                  </div>
                  <div v-else-if="b.status === 'CLEARED'" class="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 justify-end">
                    <CheckCircle2 class="w-3 h-3" />
                    Cleared
                  </div>
                  <div v-else class="text-[11px] text-amber-600 font-medium flex items-center gap-0.5 justify-end">
                    <Clock3 class="w-3 h-3" />
                    Pending
                  </div>
                </div>
              </div>
            </div>

            <div v-if="!partyBillsLoading && filteredPartyBills.length === 0" class="py-12 text-center text-gray-400 text-xs">
              <span v-if="selectedBillTab === 'pending'">No open bills pending clearance. Account is settled!</span>
              <span v-else-if="selectedBillTab === 'partial'">No partially paid bills found for this customer.</span>
              <span v-else-if="selectedBillTab === 'cleared'">No cleared bills recorded yet for this customer.</span>
              <span v-else>No invoices match your search.</span>
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="p-3 sm:p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
            <span class="text-gray-500">
              Showing {{ filteredPartyBills.length }} {{ selectedBillTab === 'pending' ? 'pending' : selectedBillTab === 'partial' ? 'partially paid' : selectedBillTab === 'cleared' ? 'cleared' : 'total' }} invoice{{ filteredPartyBills.length === 1 ? '' : 's' }}
            </span>
            <button
              @click="selectedParty = null"
              class="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 cursor-pointer"
            >
              Close
            </button>
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
  CheckCircle2, AlertCircle, Clock3, FileText, Calendar, RefreshCw, PieChart,
  Scale, Receipt, FileSpreadsheet, Download, Copy, Check, UserX
} from 'lucide-vue-next'

const route = useRoute()

// Primary Navigation state
const activeMainView = ref<'debtors' | 'reconciliation'>('debtors')
const activeReconSubTab = ref<'unposted' | 'discrepancies' | 'missing_parties'>('unposted')

// Debtors view state
const loading = ref(true)
const tallyData = ref<any | null>(null)
const searchQuery = ref('')
const sortBy = ref<'pending_desc' | 'billed_desc' | 'paid_desc' | 'rate_asc' | 'rate_desc' | 'bills_desc' | 'speed_asc' | 'speed_desc'>('pending_desc')
const currentPage = ref(1)
const pageSize = 25

// Reconciliation view state
const reconLoading = ref(false)
const reconData = ref<any | null>(null)
const reconSearchQuery = ref('')
const unpostedCategoryFilter = ref<'all' | 'UNPOSTED_INVOICE' | 'MISSING_CUSTOMER'>('all')
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

const fetchTallyReceivables = async () => {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/admin/tally/receivables')
    if (res && res.success && res.data) {
      tallyData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load Tally receivables:', err)
  } finally {
    loading.value = false
  }
}

const fetchReconciliation = async () => {
  reconLoading.value = true
  try {
    const res = await $fetch<any>('/api/admin/tally/reconciliation')
    if (res && res.success && res.data) {
      reconData.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load reconciliation audit:', err)
  } finally {
    reconLoading.value = false
  }
}

const refreshAllData = async () => {
  await Promise.all([
    fetchTallyReceivables(),
    fetchReconciliation()
  ])
}

const formattedSyncTime = computed(() => {
  if (!tallyData.value?.syncedAt) return 'Never'
  const d = new Date(tallyData.value.syncedAt)
  if (isNaN(d.getTime())) return tallyData.value.syncedAt
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

// ==========================================
// DEBTORS FILTERING & SORTING
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
    list.sort((a, b) => (b.totalBilled || 0) - (a.totalBilled || 0))
  } else if (sortBy.value === 'paid_desc') {
    list.sort((a, b) => (b.totalPaid || 0) - (a.totalPaid || 0))
  } else if (sortBy.value === 'rate_asc') {
    list.sort((a, b) => (a.collectionRate || 0) - (b.collectionRate || 0))
  } else if (sortBy.value === 'rate_desc') {
    list.sort((a, b) => (b.collectionRate || 0) - (a.collectionRate || 0))
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
      v.customerName.toLowerCase().includes(q) ||
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
      p.customerName.toLowerCase().includes(q) ||
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
    list = list.filter((p: any) => p.customerName.toLowerCase().includes(q))
  }

  return list
})

const totalMissingPartiesPages = computed(() => Math.ceil(filteredMissingParties.value.length / missingPartiesPageSize) || 1)
const paginatedMissingParties = computed(() => {
  const start = (missingPartiesPage.value - 1) * missingPartiesPageSize
  return filteredMissingParties.value.slice(start, start + missingPartiesPageSize)
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
    const res = await $fetch<any>(`/api/admin/tally/party-bills?party=${encodeURIComponent(party.party)}`)
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
// CSV EXPORT HELPERS
// ==========================================
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell ?? '').replace(/"/g, '""')
        return `"${str}"`
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const exportUnpostedToCsv = () => {
  if (!reconData.value?.unpostedVouchers) return
  const headers = ['Voucher No', 'Date', 'Customer Name (BUSY)', 'Tally Ledger', 'Taxable Amount', 'Tax Amount', 'Gross Amount', 'Category', 'Reason']
  const rows = reconData.value.unpostedVouchers.map((v: any) => [
    v.voucherNo,
    v.voucherDate ? v.voucherDate.slice(0, 10) : '',
    v.customerName,
    v.tallyParty || 'NOT IN TALLY',
    v.taxableAmount || 0,
    v.taxAmount || 0,
    v.amount || 0,
    v.category,
    v.reason
  ])
  downloadCsv(`Busy_Unposted_Vouchers_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
}

const exportCurrentReconTab = () => {
  if (activeReconSubTab.value === 'unposted') {
    exportUnpostedToCsv()
  } else if (activeReconSubTab.value === 'discrepancies') {
    if (!reconData.value?.partyDiscrepancies) return
    const headers = ['Customer Name (BUSY)', 'Tally Ledger', 'BUSY Sales', 'Tally Billed', 'Difference', 'BUSY Invoices Count', 'Status']
    const rows = reconData.value.partyDiscrepancies.map((p: any) => [
      p.customerName,
      p.tallyParty,
      p.busySales,
      p.tallyBilled,
      p.difference,
      p.busyVoucherCount,
      p.status
    ])
    downloadCsv(`Party_Discrepancies_Audit_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  } else if (activeReconSubTab.value === 'missing_parties') {
    if (!reconData.value?.unmatchedParties) return
    const headers = ['Customer Name (BUSY)', 'Total Sales (BUSY)', 'Invoices Count', 'Latest Invoice Date', 'Action Required']
    const rows = reconData.value.unmatchedParties.map((p: any) => [
      p.customerName,
      p.totalSales,
      p.voucherCount,
      p.latestDate ? p.latestDate.slice(0, 10) : '',
      'Create Sundry Debtor Ledger in Tally Prime'
    ])
    downloadCsv(`Missing_Debtors_In_Tally_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }
}

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
  if (!party || !party.totalBilled || Number(party.totalBilled) <= 0) return 0
  const pending = Number(party.netPending || 0)
  if (pending <= 0) return 0

  const now = new Date()
  const currentYear = now.getFullYear()
  const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1
  const fyStart = new Date(fyStartYear, 3, 1)
  const daysElapsed = Math.max(1, Math.round((now.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24)))

  return Math.round((pending / Number(party.totalBilled)) * daysElapsed)
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
  return 'Slow Payer'
}

function getPartyAvgOverdue(party: any): number {
  if (!party?.bills || party.bills.length === 0) return 0
  const total = party.bills.reduce((sum: number, b: any) => sum + (Number(b.overdueDays) || 0), 0)
  return Math.round(total / party.bills.length)
}

onMounted(() => {
  fetchTallyReceivables()
  fetchReconciliation()

  // Deep linking: if ?sub=recon in url
  if (route.query.sub === 'recon') {
    activeMainView.value = 'reconciliation'
  }
})
</script>
