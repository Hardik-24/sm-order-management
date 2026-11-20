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
            <h2 class="text-base sm:text-lg font-bold text-gray-900">Tally Prime Financial Receivables</h2>
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
            Real-time debtor ledger balances, bill-by-bill aging brackets, and overdue tracking extracted directly from Tally Prime.
          </p>
        </div>
      </div>

      <!-- Sync Action & Timestamp -->
      <div class="flex items-center gap-3 shrink-0 self-end md:self-center">
        <div class="text-right hidden sm:block">
          <div class="text-[11px] text-gray-500">Last Synced</div>
          <div class="text-xs font-semibold text-gray-800 flex items-center gap-1 justify-end">
            <Clock class="w-3 h-3 text-gray-400" />
            {{ formattedSyncTime }}
          </div>
        </div>

        <button
          @click="syncTallyNow"
          :disabled="syncing"
          class="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': syncing }" />
          <span>{{ syncing ? 'Syncing...' : 'Sync Tally' }}</span>
        </button>

        <button
          @click="exportAllDebtorsCsv"
          :disabled="!tallyData?.parties?.length"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-2xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          title="Export All Receivables to CSV"
        >
          <Download class="w-4 h-4 text-gray-500" />
          <span class="hidden md:inline">Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Alert / Sync Message Banner if any -->
    <div v-if="syncMessage" class="p-3.5 rounded-xl border flex items-start gap-2.5 text-xs sm:text-sm" :class="syncMessage.isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'">
      <AlertCircle v-if="syncMessage.isError" class="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
      <CheckCircle2 v-else class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="font-medium">{{ syncMessage.text }}</p>
        <p v-if="syncMessage.subtext" class="text-xs mt-0.5 opacity-90">{{ syncMessage.subtext }}</p>
      </div>
      <button @click="syncMessage = null" class="text-gray-400 hover:text-gray-600">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs h-32 animate-pulse"></div>
    </div>

    <!-- Content when loaded -->
    <div v-else-if="tallyData" class="space-y-6">
      <!-- 4 Executive KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Total Outstanding Receivables -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Receivables</span>
            <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
              <IndianRupee class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatCrores(tallyData.summary.totalOutstanding) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>{{ formatCurrency(tallyData.summary.totalOutstanding) }}</span>
              <span class="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                {{ formatNumber(tallyData.summary.totalBills) }} Unpaid Bills
              </span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
        </div>

        <!-- 2. Unique Debtors Count -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Debtor Accounts</span>
            <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/80">
              <Users class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {{ formatNumber(tallyData.summary.totalParties) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>Average Outstanding</span>
              <span class="font-semibold text-gray-700">
                {{ formatCurrency(tallyData.summary.totalParties > 0 ? Math.round(tallyData.summary.totalOutstanding / tallyData.summary.totalParties) : 0) }}
              </span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        </div>

        <!-- 3. Overdue > 180 Days -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Aged > 180 Days</span>
            <div class="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/80">
              <AlertTriangle class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">
              {{ formatCrores(tallyData.summary.agingBuckets.overOneEighty) }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>Risk Share</span>
              <span class="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 text-[11px]">
                {{ tallyData.summary.totalOutstanding > 0 ? ((tallyData.summary.agingBuckets.overOneEighty / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}% of Total
              </span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
        </div>

        <!-- 4. Top Exposure Account -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs relative overflow-hidden group hover:border-gray-300 transition-all">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">Top Debtor Concentration</span>
            <div class="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/80">
              <Crown class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-lg sm:text-xl font-bold text-gray-900 tracking-tight truncate" :title="topDebtor?.party">
              {{ topDebtor?.party || 'None' }}
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span class="font-bold text-gray-900">{{ formatCurrency(topDebtor?.totalReceivable || 0) }}</span>
              <span class="text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 text-[11px]">
                {{ tallyData.summary.totalOutstanding > 0 && topDebtor ? ((topDebtor.totalReceivable / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}% Book
              </span>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-600"></div>
        </div>
      </div>

      <!-- Aging Buckets Distribution Bar -->
      <div class="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span>Aging Profile Breakdown</span>
              <span class="text-xs font-normal text-gray-500">(Overdue from Invoice Due Date)</span>
            </h3>
          </div>
          <span class="text-xs text-gray-500 font-medium">Total: {{ formatCurrency(tallyData.summary.totalOutstanding) }}</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            <div class="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">0 - 30 Days</div>
            <div class="text-sm sm:text-base font-bold text-emerald-950 mt-1">{{ formatCurrency(tallyData.summary.agingBuckets.current) }}</div>
            <div class="text-[10.5px] text-emerald-700 font-medium mt-0.5">
              {{ tallyData.summary.totalOutstanding > 0 ? ((tallyData.summary.agingBuckets.current / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}%
            </div>
          </div>

          <div class="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80">
            <div class="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">31 - 60 Days</div>
            <div class="text-sm sm:text-base font-bold text-blue-950 mt-1">{{ formatCurrency(tallyData.summary.agingBuckets.thirtyToSixty) }}</div>
            <div class="text-[10.5px] text-blue-700 font-medium mt-0.5">
              {{ tallyData.summary.totalOutstanding > 0 ? ((tallyData.summary.agingBuckets.thirtyToSixty / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}%
            </div>
          </div>

          <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <div class="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">61 - 90 Days</div>
            <div class="text-sm sm:text-base font-bold text-amber-950 mt-1">{{ formatCurrency(tallyData.summary.agingBuckets.sixtyToNinety) }}</div>
            <div class="text-[10.5px] text-amber-700 font-medium mt-0.5">
              {{ tallyData.summary.totalOutstanding > 0 ? ((tallyData.summary.agingBuckets.sixtyToNinety / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}%
            </div>
          </div>

          <div class="p-3 rounded-xl bg-orange-50/70 border border-orange-200/80">
            <div class="text-[11px] font-semibold text-orange-800 uppercase tracking-wider">91 - 180 Days</div>
            <div class="text-sm sm:text-base font-bold text-orange-950 mt-1">{{ formatCurrency(tallyData.summary.agingBuckets.ninetyToOneEighty) }}</div>
            <div class="text-[10.5px] text-orange-700 font-medium mt-0.5">
              {{ tallyData.summary.totalOutstanding > 0 ? ((tallyData.summary.agingBuckets.ninetyToOneEighty / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}%
            </div>
          </div>

          <div class="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 col-span-2 sm:col-span-1">
            <div class="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">> 180 Days</div>
            <div class="text-sm sm:text-base font-bold text-rose-950 mt-1">{{ formatCurrency(tallyData.summary.agingBuckets.overOneEighty) }}</div>
            <div class="text-[10.5px] text-rose-700 font-medium mt-0.5">
              {{ tallyData.summary.totalOutstanding > 0 ? ((tallyData.summary.agingBuckets.overOneEighty / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}%
            </div>
          </div>
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
                placeholder="Search debtor name..."
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
              class="px-2.5 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="amount_desc">Highest Outstanding</option>
              <option value="amount_asc">Lowest Outstanding</option>
              <option value="bills_desc">Most Unpaid Bills</option>
              <option value="overdue_desc">Oldest Overdue Days</option>
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
                <th class="py-3 px-4 text-right">Outstanding (₹)</th>
                <th class="py-3 px-4 text-center">Unpaid Bills</th>
                <th class="py-3 px-4 text-center">Overdue Days</th>
                <th class="py-3 px-4 text-right">% of Total</th>
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
                <td class="py-3.5 px-4 font-bold text-gray-900 group-hover:text-amber-900 flex items-center gap-2">
                  <span>{{ party.party }}</span>
                </td>
                <td class="py-3.5 px-4 text-right font-extrabold text-gray-900">
                  {{ formatCurrency(party.totalReceivable) }}
                </td>
                <td class="py-3.5 px-4 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {{ party.billsCount }} bills
                  </span>
                </td>
                <td class="py-3.5 px-4 text-center">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    :class="getOverdueBadgeClass(party.maxOverdueDays)"
                  >
                    {{ party.maxOverdueDays }} days
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right text-xs font-semibold text-gray-600">
                  {{ tallyData.summary.totalOutstanding > 0 ? ((party.totalReceivable / tallyData.summary.totalOutstanding) * 100).toFixed(1) : 0 }}%
                </td>
                <td class="py-3.5 px-4 text-center">
                  <button
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 group-hover:bg-amber-100 transition-colors"
                  >
                    <span>View Bills</span>
                    <ChevronRight class="w-3 h-3" />
                  </button>
                </td>
              </tr>

              <tr v-if="filteredParties.length === 0">
                <td colspan="7" class="py-12 text-center text-gray-500">
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
              class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <span class="text-xs font-semibold px-2">{{ currentPage }} / {{ totalPages }}</span>
            <button
              @click="currentPage++"
              :disabled="currentPage >= totalPages"
              class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bill-by-Bill Slide-over Modal / Drawer -->
    <div
      v-if="selectedParty"
      class="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end"
      @click.self="selectedParty = null"
    >
      <div class="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <!-- Drawer Header -->
        <div class="p-5 border-b border-gray-200 bg-gray-50/50 flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide">Sundry Debtor</span>
              <span class="text-xs text-gray-500">{{ selectedParty.billsCount }} Unpaid Bills</span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mt-1">{{ selectedParty.party }}</h3>
            <div class="flex items-center gap-3 mt-2 text-xs">
              <span class="font-extrabold text-base text-gray-900">{{ formatCurrency(selectedParty.totalReceivable) }}</span>
              <span class="text-gray-400">•</span>
              <span class="text-rose-700 font-semibold">Oldest Overdue: {{ selectedParty.maxOverdueDays }} days</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="exportDebtorBillsCsv(selectedParty)"
              class="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Download Bills as CSV"
            >
              <Download class="w-4 h-4" />
            </button>
            <button
              @click="selectedParty = null"
              class="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Filter within Bills -->
        <div class="p-3.5 border-b border-gray-200 bg-white">
          <div class="relative">
            <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="billSearchQuery"
              type="text"
              placeholder="Search by Bill Ref / Invoice # (e.g. SMG231)..."
              class="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        <!-- Bills List -->
        <div class="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
          <div
            v-for="(bill, bIdx) in filteredPartyBills"
            :key="bIdx"
            class="p-3.5 hover:bg-gray-50/80 rounded-xl transition-colors flex items-center justify-between gap-3 text-xs sm:text-sm"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-900 font-mono text-xs sm:text-sm bg-gray-100 px-2 py-0.5 rounded">
                  {{ bill.ref || 'ON ACCOUNT' }}
                </span>
                <span class="text-gray-400 text-xs">Date: {{ bill.date }}</span>
              </div>
              <div class="text-[11px] text-gray-500 flex items-center gap-2">
                <span>Due: {{ bill.dueDate }}</span>
                <span>•</span>
                <span
                  class="font-semibold"
                  :class="bill.overdueDays > 90 ? 'text-rose-600' : bill.overdueDays > 30 ? 'text-amber-600' : 'text-emerald-600'"
                >
                  {{ bill.overdueDays }} days overdue
                </span>
              </div>
            </div>

            <div class="text-right shrink-0">
              <div class="font-bold text-gray-900 text-sm sm:text-base">
                {{ formatCurrency(bill.amount) }}
              </div>
              <span class="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                DR / Unpaid
              </span>
            </div>
          </div>

          <div v-if="filteredPartyBills.length === 0" class="py-12 text-center text-gray-400 text-xs">
            No bills match your invoice search.
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
          <span class="text-gray-500">Total {{ filteredPartyBills.length }} bills displayed</span>
          <button
            @click="selectedParty = null"
            class="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IndianRupee, Users, AlertTriangle, Crown, ShieldCheck, Lock,
  Building2, Clock, RefreshCw, Download, Search, X, ChevronRight,
  CheckCircle2, AlertCircle
} from 'lucide-vue-next'

const loading = ref(true)
const syncing = ref(false)
const syncMessage = ref<{ text: string; subtext?: string; isError?: boolean } | null>(null)
const tallyData = ref<any | null>(null)

// Search & Sorting
const searchQuery = ref('')
const sortBy = ref<'amount_desc' | 'amount_asc' | 'bills_desc' | 'overdue_desc'>('amount_desc')

// Pagination
const currentPage = ref(1)
const pageSize = 25

// Drill-down Modal
const selectedParty = ref<any | null>(null)
const billSearchQuery = ref('')

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

const syncTallyNow = async () => {
  syncing.value = true
  syncMessage.value = null
  try {
    const res = await $fetch<any>('/api/admin/tally/sync', { method: 'POST' })
    if (res && res.success) {
      tallyData.value = res.data
      syncMessage.value = {
        text: 'Tally receivables successfully synchronized!',
        subtext: `Updated ${res.data?.summary?.totalParties || 0} accounts and ${res.data?.summary?.totalBills || 0} unpaid bills.`,
        isError: false
      }
    } else {
      syncMessage.value = {
        text: res.message || 'Could not connect to Tally Prime on localhost.',
        subtext: res.isLocalOnly ? 'Run the desktop "sync_tally.bat" shortcut or "npm run sync:tally" on your PC.' : res.details,
        isError: true
      }
    }
  } catch (err: any) {
    syncMessage.value = {
      text: 'Sync request failed',
      subtext: err.data?.message || err.message,
      isError: true
    }
  } finally {
    syncing.value = false
  }
}

const topDebtor = computed(() => {
  if (!tallyData.value?.parties?.length) return null
  return tallyData.value.parties[0]
})

const formattedSyncTime = computed(() => {
  if (!tallyData.value?.syncedAt) return 'Never'
  const d = new Date(tallyData.value.syncedAt)
  if (isNaN(d.getTime())) return tallyData.value.syncedAt
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

const filteredParties = computed(() => {
  if (!tallyData.value?.parties) return []
  let list = [...tallyData.value.parties]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter((p: any) => p.party.toLowerCase().includes(q))
  }

  // Sort
  if (sortBy.value === 'amount_desc') {
    list.sort((a, b) => b.totalReceivable - a.totalReceivable)
  } else if (sortBy.value === 'amount_asc') {
    list.sort((a, b) => a.totalReceivable - b.totalReceivable)
  } else if (sortBy.value === 'bills_desc') {
    list.sort((a, b) => b.billsCount - a.billsCount)
  } else if (sortBy.value === 'overdue_desc') {
    list.sort((a, b) => b.maxOverdueDays - a.maxOverdueDays)
  }

  return list
})

const totalPages = computed(() => Math.ceil(filteredParties.value.length / pageSize) || 1)

const paginatedParties = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredParties.value.slice(start, start + pageSize)
})

const openDebtorDetails = (party: any) => {
  selectedParty.value = party
  billSearchQuery.value = ''
}

const filteredPartyBills = computed(() => {
  if (!selectedParty.value?.bills) return []
  if (!billSearchQuery.value.trim()) return selectedParty.value.bills
  const q = billSearchQuery.value.toLowerCase().trim()
  return selectedParty.value.bills.filter((b: any) =>
    (b.ref && b.ref.toLowerCase().includes(q)) ||
    (b.date && b.date.toLowerCase().includes(q))
  )
})

function getOverdueBadgeClass(days: number): string {
  if (days > 180) return 'bg-rose-100 text-rose-800 border border-rose-200'
  if (days > 90) return 'bg-orange-100 text-orange-800 border border-orange-200'
  if (days > 30) return 'bg-amber-100 text-amber-800 border border-amber-200'
  return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
}

// Number & Currency helpers
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

// CSV Export Helpers
const exportAllDebtorsCsv = () => {
  if (!tallyData.value?.parties?.length) return
  const headers = ['Rank', 'Party Name', 'Total Outstanding (INR)', 'Unpaid Bills Count', 'Oldest Overdue Days', 'Share of Total Receivables (%)']
  const rows = tallyData.value.parties.map((p: any, idx: number) => [
    idx + 1,
    `"${p.party.replace(/"/g, '""')}"`,
    p.totalReceivable,
    p.billsCount,
    p.maxOverdueDays,
    tallyData.value.summary.totalOutstanding > 0 ? ((p.totalReceivable / tallyData.value.summary.totalOutstanding) * 100).toFixed(2) : 0
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  downloadBlob(csv, `Tally_Debtors_Receivables_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;')
}

const exportDebtorBillsCsv = (party: any) => {
  if (!party?.bills?.length) return
  const headers = ['Party Name', 'Invoice / Bill Ref', 'Bill Date', 'Due Date', 'Overdue Days', 'Pending Balance (INR)']
  const rows = party.bills.map((b: any) => [
    `"${party.party.replace(/"/g, '""')}"`,
    `"${(b.ref || '').replace(/"/g, '""')}"`,
    b.date,
    b.dueDate,
    b.overdueDays,
    b.amount
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  downloadBlob(csv, `${party.party.replace(/[^a-zA-Z0-9]/g, '_')}_Bills_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;')
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  fetchTallyReceivables()
})
</script>
