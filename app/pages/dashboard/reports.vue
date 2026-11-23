<template>
  <div class="min-h-screen bg-slate-50 flex flex-col antialiased text-gray-900 pb-24 md:pb-12">
    <!-- Top Header Bar -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <!-- Page Title & Icon -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f] text-white flex items-center justify-center shadow-sm shrink-0">
              <FileSpreadsheet class="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-lg sm:text-xl font-black text-gray-950 tracking-tight">Reports & Statements</h1>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Tally Prime Live
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                Official Statement of Accounts, Party Ledgers & Balance Verification
              </p>
            </div>
          </div>

          <!-- Quick Summary Stats (Desktop) -->
          <div v-if="summary" class="hidden md:flex items-center gap-3 text-xs">
            <div class="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2">
              <span class="text-gray-500 font-medium">Tally Parties:</span>
              <strong class="font-mono text-gray-900 font-bold">{{ summary.totalParties }}</strong>
            </div>
            <div class="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
              <span class="text-amber-800 font-medium">Debtors:</span>
              <strong class="font-mono text-amber-900 font-bold">{{ summary.debtorsCount }}</strong>
            </div>
            <div class="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2">
              <span class="text-blue-800 font-medium">Creditors:</span>
              <strong class="font-mono text-blue-900 font-bold">{{ summary.creditorsCount }}</strong>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100 overflow-x-auto scrollbar-none">
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 bg-[#1b3b5f] text-white shadow-2xs"
          >
            <FileSpreadsheet class="w-3.5 h-3.5 text-emerald-300" />
            <span>Party Ledger Statement</span>
          </button>

          <button
            type="button"
            disabled
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 bg-gray-100 cursor-not-allowed flex items-center gap-1.5 shrink-0 opacity-60"
            title="Receivables Aging is available under Customer details & analytics"
          >
            <span>Receivables Aging</span>
            <span class="text-[9px] px-1 py-0.2 rounded bg-gray-200 text-gray-600 font-bold">Tally</span>
          </button>

          <button
            type="button"
            disabled
            class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 bg-gray-100 cursor-not-allowed flex items-center gap-1.5 shrink-0 opacity-60"
          >
            <span>Sales Register</span>
            <span class="text-[9px] px-1 py-0.2 rounded bg-gray-200 text-gray-600 font-bold">Upcoming</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full space-y-4">
      <!-- RBAC Guard: Permission Denied Banner -->
      <div
        v-if="!canDownloadPartyLedger && user?.role !== 'ADMIN'"
        class="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm space-y-4"
      >
        <div class="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert class="w-7 h-7" />
        </div>
        <div class="space-y-1">
          <h2 class="text-base font-bold text-gray-900">Access Restricted</h2>
          <p class="text-xs text-gray-600 leading-relaxed">
            Financial Ledger Statements contain sensitive business and banking transaction records.
            Your role currently does not have permission to view or export party ledgers.
          </p>
        </div>
        <p class="text-[11px] text-gray-400">
          Please contact your Administrator to request the <code class="font-mono font-bold text-gray-700">canDownloadPartyLedger</code> permission.
        </p>
      </div>

      <!-- Main Reports Interface (When Permitted) -->
      <div v-else class="space-y-4">
        <!-- Control Panel: Party Selector & Date Filters -->
        <div class="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-2xs space-y-4">
          <!-- Top Row: Tally Party Selector Combobox -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 class="w-3.5 h-3.5 text-[#1b3b5f]" />
                <span>Select Tally Ledger Account</span>
                <span class="text-rose-500">*</span>
              </label>

              <!-- Group Filter Pills (All / Debtors / Creditors) -->
              <div class="flex items-center gap-1 text-[11px] font-semibold">
                <button
                  type="button"
                  @click="partyGroupFilter = 'all'"
                  class="px-2 py-0.5 rounded-md transition-colors"
                  :class="partyGroupFilter === 'all' ? 'bg-[#1b3b5f] text-white' : 'text-gray-500 hover:bg-gray-100'"
                >
                  All ({{ parties.length }})
                </button>
                <button
                  type="button"
                  @click="partyGroupFilter = 'debtor'"
                  class="px-2 py-0.5 rounded-md transition-colors"
                  :class="partyGroupFilter === 'debtor' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-100'"
                >
                  Debtors
                </button>
                <button
                  type="button"
                  @click="partyGroupFilter = 'creditor'"
                  class="px-2 py-0.5 rounded-md transition-colors"
                  :class="partyGroupFilter === 'creditor' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'"
                >
                  Creditors
                </button>
              </div>
            </div>

            <!-- Custom Searchable Dropdown Combobox -->
            <div class="relative" ref="comboboxRef">
              <div
                @click="toggleDropdown"
                class="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-gray-300 rounded-xl flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
                :class="{ 'ring-2 ring-[#1b3b5f] border-transparent bg-white': isDropdownOpen }"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                    :class="selectedPartyObj?.role === 'creditor' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ selectedPartyObj?.role === 'creditor' ? 'Cr' : 'Dr' }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-gray-900 truncate">
                      {{ selectedParty || 'Click to select a Tally party...' }}
                    </p>
                    <p v-if="selectedPartyObj" class="text-[11px] text-gray-500 truncate flex items-center gap-2">
                      <span>{{ selectedPartyObj.parent }}</span>
                      <span>&bull;</span>
                      <span class="font-mono font-semibold" :class="selectedPartyObj.netPending > 0 ? 'text-amber-700' : 'text-emerald-700'">
                        ₹{{ formatIndianNumber(selectedPartyObj.netPending) }}
                        {{ selectedPartyObj.role === 'creditor' ? 'Payable' : 'Receivable' }}
                      </span>
                      <span>&bull;</span>
                      <span>{{ selectedPartyObj.transactionsCount }} vouchers</span>
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 text-gray-400">
                  <span v-if="isLoadingParties" class="animate-spin mr-1">
                    <Loader2 class="w-4 h-4 text-[#1b3b5f]" />
                  </span>
                  <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': isDropdownOpen }" />
                </div>
              </div>

              <!-- Dropdown Menu Sheet -->
              <div
                v-if="isDropdownOpen"
                class="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col max-h-80"
              >
                <!-- Search Input Header -->
                <div class="p-2.5 bg-slate-50 border-b border-gray-200 flex items-center gap-2 shrink-0">
                  <Search class="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                  <input
                    ref="searchInputRef"
                    v-model="partySearchQuery"
                    type="text"
                    placeholder="Search by Tally ledger name (e.g. Mr Knob, Mas Furniture)..."
                    class="w-full bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
                    @keydown.esc="isDropdownOpen = false"
                  />
                  <button
                    v-if="partySearchQuery"
                    @click="partySearchQuery = ''"
                    class="text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Dropdown List Options -->
                <div class="overflow-y-auto flex-1 divide-y divide-gray-100 overscroll-contain">
                  <div
                    v-if="filteredParties.length === 0"
                    class="p-6 text-center text-xs text-gray-400"
                  >
                    No Tally ledger found matching "{{ partySearchQuery }}".
                  </div>

                  <button
                    v-for="p in filteredParties"
                    :key="p.party"
                    type="button"
                    @click="selectParty(p.party)"
                    class="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                    :class="selectedParty === p.party ? 'bg-slate-100 font-semibold' : ''"
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-900 group-hover:text-[#1b3b5f] truncate">
                          {{ p.party }}
                        </span>
                        <span
                          class="text-[9px] font-bold px-1.5 py-0.2 rounded"
                          :class="p.role === 'creditor' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'"
                        >
                          {{ p.parent }}
                        </span>
                      </div>
                      <div class="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>{{ p.transactionsCount }} entries</span>
                        <span>&bull;</span>
                        <span>Billed: ₹{{ formatIndianNumber(p.totalBilled) }}</span>
                      </div>
                    </div>

                    <div class="text-right shrink-0">
                      <div class="text-xs font-mono font-bold" :class="p.netPending > 0 ? 'text-amber-800' : 'text-gray-500'">
                        ₹{{ formatIndianNumber(p.netPending) }}
                      </div>
                      <span class="text-[9px] text-gray-400 font-mono">
                        {{ p.role === 'creditor' ? 'Payable' : 'Pending' }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Visual Date Picker & Presets -->
          <div class="pt-3 border-t border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <!-- Visual Calendar Date Pickers -->
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="font-bold text-gray-700 text-xs flex items-center gap-1">
                <Calendar class="w-3.5 h-3.5 text-gray-500" />
                <span>Period Range:</span>
              </span>

              <div class="flex items-center gap-1.5">
                <div class="flex items-center bg-slate-50 border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
                  <span class="text-[10px] uppercase font-bold text-gray-400 mr-1.5">From</span>
                  <input
                    v-model="fromDate"
                    type="date"
                    class="bg-transparent text-xs font-mono font-bold text-gray-800 outline-none cursor-pointer"
                  />
                </div>

                <span class="text-gray-400 font-bold">&ndash;</span>

                <div class="flex items-center bg-slate-50 border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
                  <span class="text-[10px] uppercase font-bold text-gray-400 mr-1.5">To</span>
                  <input
                    v-model="toDate"
                    type="date"
                    class="bg-transparent text-xs font-mono font-bold text-gray-800 outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  @click="fetchLedger"
                  :disabled="isLoadingLedger || !selectedParty"
                  class="px-3 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white font-bold rounded-lg text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingLedger }" />
                  <span>Update</span>
                </button>
              </div>
            </div>

            <!-- 1-Tap Quick Period Presets -->
            <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-semibold">
              <span class="text-gray-400 text-[10px] uppercase tracking-wider font-bold mr-1">Presets:</span>
              <button
                type="button"
                @click="applyPreset('currentFY')"
                class="px-2.5 py-1 rounded-lg border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'currentFY' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-slate-100'"
              >
                Current FY
              </button>
              <button
                type="button"
                @click="applyPreset('thisMonth')"
                class="px-2.5 py-1 rounded-lg border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'thisMonth' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-slate-100'"
              >
                This Month
              </button>
              <button
                type="button"
                @click="applyPreset('lastMonth')"
                class="px-2.5 py-1 rounded-lg border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'lastMonth' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-slate-100'"
              >
                Last Month
              </button>
              <button
                type="button"
                @click="applyPreset('allTime')"
                class="px-2.5 py-1 rounded-lg border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'allTime' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-slate-50 text-gray-700 border-gray-200 hover:bg-slate-100'"
              >
                All Time / YTD
              </button>
            </div>
          </div>
        </div>

        <!-- Export & Display Toolbar (When ledger loaded) -->
        <div
          v-if="ledgerData"
          class="bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3"
        >
          <!-- Left: Party & Balance Quick Pill -->
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              :class="ledgerData.totals.closingBalanceType === 'Dr' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'"
            >
              {{ ledgerData.totals.closingBalanceType === 'Dr' ? 'Receivable' : 'Advance' }}
            </span>
            <div class="text-sm font-bold text-gray-900 truncate">
              Closing Balance:
              <span class="font-mono font-black text-base text-[#1b3b5f] ml-1">
                ₹{{ formatIndianNumber(ledgerData.totals.closingBalance) }}
              </span>
              <span class="text-xs text-gray-500 font-normal ml-0.5">({{ ledgerData.totals.closingBalanceType }})</span>
            </div>
          </div>

          <!-- Right: Mobile View Toggle, Zoom Controls, Print & PDF Export -->
          <div class="flex items-center gap-2">
            <!-- Mobile Toggle: Cards vs A4 Slip -->
            <div class="flex sm:hidden p-0.5 bg-gray-200/80 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                @click="mobileViewMode = 'list'"
                class="px-2.5 py-1 rounded-md transition-all"
                :class="mobileViewMode === 'list' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'"
              >
                Cards
              </button>
              <button
                type="button"
                @click="mobileViewMode = 'slip'"
                class="px-2.5 py-1 rounded-md transition-all"
                :class="mobileViewMode === 'slip' ? 'bg-[#1b3b5f] text-white shadow-2xs' : 'text-gray-600'"
              >
                A4 Slip
              </button>
            </div>

            <!-- Zoom Controls (A4 Slip mode) -->
            <div v-show="mobileViewMode === 'slip' || isDesktop" class="hidden sm:flex items-center gap-1 text-xs">
              <span class="text-[10px] font-mono font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 px-2 py-1 rounded border border-[#1b3b5f]/20">
                {{ Math.round(zoomScale * 100) }}%
              </span>
              <button
                type="button"
                @click="zoomOut"
                :disabled="zoomScale <= 0.35"
                class="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="setZoom('fit')"
                class="px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer"
                :class="zoomScale === fitScale ? 'bg-[#1b3b5f] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                Fit
              </button>
              <button
                type="button"
                @click="setZoom(1.0)"
                class="px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer"
                :class="zoomScale === 1.0 ? 'bg-[#1b3b5f] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              >
                100%
              </button>
              <button
                type="button"
                @click="zoomIn"
                :disabled="zoomScale >= 1.6"
                class="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Desktop Print Button -->
            <button
              type="button"
              @click="printLedger"
              :disabled="isLoadingLedger || isExporting"
              class="hidden sm:flex px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-800 rounded-xl text-xs font-bold transition-all items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-gray-200"
            >
              <Loader2 v-if="isExporting && exportAction === 'print'" class="w-3.5 h-3.5 animate-spin" />
              <Printer v-else class="w-3.5 h-3.5 text-gray-700" />
              <span>Print</span>
            </button>

            <!-- Download PDF Button -->
            <button
              type="button"
              @click="downloadPdf"
              :disabled="isLoadingLedger || isExporting"
              class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Loader2 v-if="isExporting && exportAction === 'pdf'" class="w-3.5 h-3.5 animate-spin" />
              <FileDown v-else class="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        <!-- Ledger Content Area -->
        <div class="rounded-2xl border border-gray-200 bg-slate-100/70 p-3 sm:p-6 overflow-hidden min-h-[500px] flex flex-col justify-start">
          <!-- State 1: No Party Selected -->
          <div
            v-if="!selectedParty && !isLoadingLedger"
            class="py-24 text-center space-y-3 max-w-sm mx-auto"
          >
            <div class="w-12 h-12 rounded-2xl bg-white border border-gray-200 text-[#1b3b5f] flex items-center justify-center mx-auto shadow-2xs">
              <FileSpreadsheet class="w-6 h-6 text-emerald-600" />
            </div>
            <h3 class="text-sm font-bold text-gray-900">Select a Tally Party to Generate Statement</h3>
            <p class="text-xs text-gray-500 leading-relaxed">
              Choose any customer or vendor from the dropdown above to render their complete Tally Prime ledger statement with date-filtered vouchers and running balances.
            </p>
          </div>

          <!-- State 2: Loading Indicator -->
          <div
            v-else-if="isLoadingLedger"
            class="py-28 flex flex-col items-center justify-center gap-3 text-gray-500"
          >
            <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
            <p class="text-xs font-bold text-gray-700">Generating statement for {{ selectedParty }}...</p>
            <p class="text-[11px] text-gray-400">Filtering transactions and computing running balances</p>
          </div>

          <!-- State 3: Error Banner -->
          <div
            v-else-if="ledgerError"
            class="py-20 text-center text-red-600 space-y-3 px-4 max-w-md mx-auto"
          >
            <AlertCircle class="w-9 h-9 mx-auto text-red-500" />
            <p class="font-bold text-sm">{{ ledgerError }}</p>
            <button
              @click="fetchLedger"
              class="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition"
            >
              Retry
            </button>
          </div>

          <!-- State 4: Content Rendered -->
          <div v-else-if="ledgerData" class="w-full">
            <!-- Mobile Cards View -->
            <div
              v-if="mobileViewMode === 'list' && !isDesktop"
              class="space-y-3 max-w-md mx-auto"
            >
              <!-- Balance Summary Card -->
              <div class="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Net Ledger Balance</span>
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    :class="ledgerData.totals.closingBalanceType === 'Dr' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'"
                  >
                    {{ ledgerData.totals.closingBalanceType === 'Dr' ? 'RECEIVABLE (Dr)' : 'ADVANCE / PAYABLE (Cr)' }}
                  </span>
                </div>

                <div class="flex items-baseline justify-between">
                  <div class="text-2xl font-black text-gray-950 font-mono">
                    ₹{{ formatIndianNumber(ledgerData.totals.closingBalance) }}
                  </div>
                  <div class="text-right text-[11px] text-gray-500 font-mono">
                    {{ ledgerData.period.display }}
                  </div>
                </div>

                <!-- Totals Mini Grid -->
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                  <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span class="text-[10px] text-gray-500 block">Total Debits</span>
                    <span class="font-bold font-mono text-[#1b3b5f]">₹{{ formatIndianNumber(ledgerData.totals.totalDebit) }}</span>
                  </div>
                  <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span class="text-[10px] text-gray-500 block">Total Credits</span>
                    <span class="font-bold font-mono text-emerald-700">₹{{ formatIndianNumber(ledgerData.totals.totalCredit) }}</span>
                  </div>
                </div>
              </div>

              <!-- Transaction Items -->
              <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                  <span class="text-xs font-bold text-gray-700">Vouchers ({{ ledgerData.transactions.length }})</span>
                  <span class="text-[11px] text-gray-400">Chronological</span>
                </div>

                <div
                  v-for="(row, idx) in ledgerData.transactions"
                  :key="idx"
                  class="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1.5"
                  :class="row.particulars.includes('Opening Balance') ? 'bg-amber-50/30 border-amber-200' : ''"
                >
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-mono text-gray-500 text-[11px]">{{ row.date }}</span>
                    <span
                      v-if="row.vchType"
                      class="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded"
                      :class="row.vchType === 'Sales' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
                    >
                      {{ row.vchType }} {{ row.vchNo ? `#${row.vchNo}` : '' }}
                    </span>
                  </div>

                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-gray-900 leading-snug truncate max-w-[220px]">
                      {{ row.particulars }}
                    </span>
                    <div class="text-right shrink-0">
                      <span v-if="row.debit !== null" class="font-mono font-bold text-xs text-[#1b3b5f]">
                        ₹{{ formatIndianNumber(row.debit) }} <span class="text-[9px] font-normal text-gray-400">Dr</span>
                      </span>
                      <span v-else-if="row.credit !== null" class="font-mono font-bold text-xs text-emerald-700">
                        ₹{{ formatIndianNumber(row.credit) }} <span class="text-[9px] font-normal text-gray-400">Cr</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Faithful A4 Printed Canvas (Desktop & Mobile 'A4 Slip' View) -->
            <div
              v-else
              class="w-full overflow-x-auto flex flex-col items-center py-2"
            >
              <div
                :style="{
                  width: `${Math.round(794 * zoomScale)}px`,
                  minHeight: `${Math.round(1123 * zoomScale * paginatedPages.length)}px`
                }"
                class="relative transition-all duration-150 space-y-6"
              >
                <!-- Container for all pages -->
                <div
                  ref="printableContainerRef"
                  class="flex flex-col gap-8"
                  :style="{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top center',
                    width: '794px'
                  }"
                >
                  <!-- Multi-Page Paginated A4 Sheets (Matching exact Tally format from uploaded photo) -->
                  <div
                    v-for="page in paginatedPages"
                    :key="page.pageNumber"
                    class="a4-ledger-sheet bg-white text-gray-950 font-serif shadow-xl rounded-none border border-gray-300 p-8 flex flex-col justify-between"
                    style="width: 794px; min-height: 1123px; font-family: 'Times New Roman', Times, serif; -webkit-font-smoothing: antialiased;"
                  >
                    <!-- Sheet Content -->
                    <div class="space-y-4">
                      <!-- Page 1 Full Header -->
                      <div v-if="page.isFirstPage" class="space-y-3">
                        <!-- Company Header (Sri Lakshmi Plywoods / Silicon Marketing) -->
                        <div class="text-center space-y-0.5">
                          <h1 class="text-lg font-black tracking-wider uppercase text-black font-sans">
                            {{ ledgerData.company.name }}
                          </h1>
                          <p class="text-xs italic text-gray-800">
                            {{ ledgerData.company.tradeName }}
                          </p>
                          <p class="text-[11px] uppercase tracking-tight text-gray-700 whitespace-pre-line leading-tight">
                            {{ ledgerData.company.address }}
                          </p>
                        </div>

                        <!-- Party Details & Statement Title -->
                        <div class="text-center space-y-0.5 pt-1">
                          <h2 class="text-base font-bold text-black tracking-tight font-sans">
                            {{ ledgerData.party.name }}
                          </h2>
                          <p class="text-xs text-gray-800">
                            Ledger Account
                          </p>
                          <div v-if="ledgerData.party.addressLines?.length" class="text-[11px] text-gray-700 uppercase leading-snug">
                            <p v-for="(line, idx) in ledgerData.party.addressLines" :key="idx">{{ line }}</p>
                          </div>
                          <p v-if="ledgerData.party.phone" class="text-[11px] text-gray-700">
                            {{ ledgerData.party.phone }}
                          </p>

                          <!-- Date Period and Page Number -->
                          <div class="pt-1 flex items-center justify-between text-xs text-black">
                            <div class="flex-1 text-center font-bold">
                              {{ ledgerData.period.display }}
                            </div>
                            <div class="text-right text-[11px] font-sans font-semibold shrink-0">
                              Page {{ page.pageNumber }}
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Subsequent Pages Short Header (Page 2+) -->
                      <div v-else class="space-y-1 pb-1">
                        <div class="flex items-center justify-between text-xs border-b border-black pb-1">
                          <span class="font-bold uppercase tracking-wider text-black font-sans">
                            {{ ledgerData.company.name }}
                          </span>
                          <span class="text-[11px] font-sans font-semibold">
                            Page {{ page.pageNumber }}
                          </span>
                        </div>
                        <div class="flex items-center justify-between text-xs pt-0.5">
                          <span class="font-bold text-black">{{ ledgerData.party.name }}</span>
                          <span class="text-[11px] text-gray-700">Ledger Account : {{ ledgerData.period.display }}</span>
                        </div>
                      </div>

                      <!-- Ledger Table (Pixel-perfect Tally Lines) -->
                      <div class="w-full">
                        <table class="w-full text-left border-collapse text-xs">
                          <!-- Column Headers with Distinct Top/Bottom Lines -->
                          <thead>
                            <tr class="border-t border-b border-black font-bold text-xs text-black">
                              <th class="py-1 px-1.5 w-20 text-left font-serif">Date</th>
                              <th class="py-1 px-2 text-left font-serif">Particulars</th>
                              <th class="py-1 px-1.5 w-20 text-left font-serif">Vch Type</th>
                              <th class="py-1 px-1.5 w-20 text-center font-serif">Vch No.</th>
                              <th class="py-1 px-2 w-28 text-right font-serif">Debit</th>
                              <th class="py-1 px-2 w-28 text-right font-serif">Credit</th>
                            </tr>
                          </thead>

                          <tbody class="text-xs text-black divide-y-0">
                            <!-- Page 2+ Brought Forward Line -->
                            <tr v-if="!page.isFirstPage" class="font-bold">
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-2 italic">Brought Forward</td>
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-2 text-right font-mono tabular-nums">
                                {{ page.broughtForwardDebit > 0 ? formatIndianNumber(page.broughtForwardDebit) : '' }}
                              </td>
                              <td class="py-1 px-2 text-right font-mono tabular-nums">
                                {{ page.broughtForwardCredit > 0 ? formatIndianNumber(page.broughtForwardCredit) : '' }}
                              </td>
                            </tr>

                            <!-- Transaction Rows -->
                            <tr
                              v-for="(row, rIdx) in page.rows"
                              :key="rIdx"
                              class="leading-tight"
                            >
                              <td class="py-1 px-1.5 whitespace-nowrap font-serif align-top text-black">
                                {{ row.date }}
                              </td>
                              <td class="py-1 px-2 text-black align-top">
                                <div class="font-serif leading-tight">
                                  {{ row.particulars }}
                                </div>
                              </td>
                              <td class="py-1 px-1.5 font-serif text-black align-top whitespace-nowrap">
                                {{ row.vchType || '' }}
                              </td>
                              <td class="py-1 px-1.5 text-center font-serif text-black align-top whitespace-nowrap">
                                {{ row.vchNo || '' }}
                              </td>
                              <td class="py-1 px-2 text-right font-mono text-black align-top tabular-nums whitespace-nowrap">
                                {{ row.debit !== null ? formatIndianNumber(row.debit) : '' }}
                              </td>
                              <td class="py-1 px-2 text-right font-mono text-black align-top tabular-nums whitespace-nowrap">
                                {{ row.credit !== null ? formatIndianNumber(row.credit) : '' }}
                              </td>
                            </tr>

                            <!-- Intermediate Page: Carried Over Row -->
                            <tr v-if="!page.isLastPage" class="font-bold border-t border-black">
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-2 italic">Carried Over</td>
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-2 text-right font-mono tabular-nums">
                                {{ formatIndianNumber(page.carriedOverDebit) }}
                              </td>
                              <td class="py-1 px-2 text-right font-mono tabular-nums">
                                {{ formatIndianNumber(page.carriedOverCredit) }}
                              </td>
                            </tr>

                            <!-- Last Page Totals & Closing Balance Section -->
                            <template v-if="page.isLastPage">
                              <!-- Subtotal Totals Row -->
                              <tr class="border-t border-black font-bold">
                                <td colspan="4" class="py-1 px-2 text-right"></td>
                                <td class="py-1 px-2 text-right font-mono border-t border-black tabular-nums">
                                  {{ formatIndianNumber(ledgerData.totals.totalDebit) }}
                                </td>
                                <td class="py-1 px-2 text-right font-mono border-t border-black tabular-nums">
                                  {{ formatIndianNumber(ledgerData.totals.totalCredit) }}
                                </td>
                              </tr>

                              <!-- Closing Balance Row -->
                              <tr v-if="ledgerData.totals.closingBalance > 0" class="font-bold">
                                <td class="py-1 px-1.5"></td>
                                <td colspan="3" class="py-1 px-2">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Dr'">
                                    By Closing Balance
                                  </span>
                                  <span v-else>
                                    To Closing Balance
                                  </span>
                                </td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Cr'">
                                    {{ formatIndianNumber(ledgerData.totals.closingBalance) }}
                                  </span>
                                </td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Dr'">
                                    {{ formatIndianNumber(ledgerData.totals.closingBalance) }}
                                  </span>
                                </td>
                              </tr>

                              <!-- Grand Balanced Total (Double Underline Standard) -->
                              <tr class="border-t border-b-4 border-double border-black font-bold">
                                <td colspan="4" class="py-1 px-2 text-right"></td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">
                                  {{ formatIndianNumber(ledgerData.totals.balancedTotal) }}
                                </td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">
                                  {{ formatIndianNumber(ledgerData.totals.balancedTotal) }}
                                </td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- Bottom Continuation Note (for intermediate pages) -->
                    <div v-if="!page.isLastPage" class="pt-4 text-right italic text-[11px] text-gray-700">
                      continued ...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  Search,
  Calendar,
  Building2,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Loader2,
  ZoomIn,
  ZoomOut,
  X
} from 'lucide-vue-next'
import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'

definePageMeta({ layout: 'dashboard' })

const { user, canDownloadPartyLedger } = useAuth()

// State
const isLoadingParties = ref(false)
const isLoadingLedger = ref(false)
const isExporting = ref(false)
const exportAction = ref<'pdf' | 'print' | null>(null)
const ledgerError = ref<string | null>(null)

const parties = ref<any[]>([])
const summary = ref<any>(null)
const selectedParty = ref<string>('')
const partySearchQuery = ref('')
const partyGroupFilter = ref<'all' | 'debtor' | 'creditor'>('all')
const isDropdownOpen = ref(false)
const comboboxRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Date Range Filters (Default: Current Financial Year 2026-27)
const fromDate = ref('2026-04-01')
const toDate = ref('2026-11-30')
const activePreset = ref<'currentFY' | 'thisMonth' | 'lastMonth' | 'allTime'>('currentFY')

// Zoom & View Mode State
const zoomScale = ref(0.95)
const fitScale = ref(0.95)
const mobileViewMode = ref<'list' | 'slip'>('list')
const isDesktop = ref(false)
const printableContainerRef = ref<HTMLElement | null>(null)

const ledgerData = ref<any>(null)

// Compute selected party metadata
const selectedPartyObj = computed(() => {
  if (!selectedParty.value) return null
  return parties.value.find(p => p.party === selectedParty.value) || null
})

// Filtered Tally Parties for Combobox
const filteredParties = computed(() => {
  let list = parties.value

  if (partyGroupFilter.value === 'debtor') {
    list = list.filter(p => p.role === 'debtor' || p.role === 'dual')
  } else if (partyGroupFilter.value === 'creditor') {
    list = list.filter(p => p.role === 'creditor')
  }

  const query = partySearchQuery.value.trim().toLowerCase()
  if (!query) return list

  return list.filter(p => {
    return p.party.toLowerCase().includes(query) || (p.parent && p.parent.toLowerCase().includes(query))
  })
})

function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0.00'
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// Fetch all Tally Parties
const fetchTallyParties = async () => {
  isLoadingParties.value = true
  try {
    const res = await $fetch<any>('/api/reports/tally-parties')
    parties.value = res.parties || []
    summary.value = res.summary || null

    // Default select Mr Knob or highest pending receivable party if available
    if (!selectedParty.value && parties.value.length > 0) {
      const knob = parties.value.find(p => p.party.toLowerCase().includes('knob'))
      if (knob) {
        selectedParty.value = knob.party
      } else {
        selectedParty.value = parties.value[0].party
      }
      fetchLedger()
    }
  } catch (err: any) {
    console.error('Failed to load Tally parties:', err)
  } finally {
    isLoadingParties.value = false
  }
}

// Fetch specific party ledger
const fetchLedger = async () => {
  if (!selectedParty.value) return
  isLoadingLedger.value = true
  ledgerError.value = null

  try {
    const res = await $fetch<any>('/api/reports/party-ledger', {
      params: {
        party: selectedParty.value,
        from: fromDate.value,
        to: toDate.value
      }
    })
    ledgerData.value = res
  } catch (err: any) {
    console.error('Ledger fetch error:', err)
    ledgerError.value = err.data?.statusMessage || err.data?.message || err.message || 'Failed to load ledger data.'
  } finally {
    isLoadingLedger.value = false
  }
}

// Quick Period Presets
function applyPreset(preset: 'currentFY' | 'thisMonth' | 'lastMonth' | 'allTime') {
  activePreset.value = preset
  if (preset === 'currentFY') {
    fromDate.value = '2026-04-01'
    toDate.value = '2027-03-31'
  } else if (preset === 'thisMonth') {
    fromDate.value = '2026-11-01'
    toDate.value = '2026-11-30'
  } else if (preset === 'lastMonth') {
    fromDate.value = '2026-10-01'
    toDate.value = '2026-10-31'
  } else if (preset === 'allTime') {
    fromDate.value = '2026-04-01'
    toDate.value = '2026-11-30'
  }
  fetchLedger()
}

// Combobox Handlers
function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
  if (isDropdownOpen.value) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

function selectParty(partyName: string) {
  selectedParty.value = partyName
  isDropdownOpen.value = false
  fetchLedger()
}

function handleClickOutside(event: MouseEvent) {
  if (comboboxRef.value && !comboboxRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

// Responsive Zoom
function updateResponsiveScales() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  isDesktop.value = w >= 640

  if (w < 640) {
    const targetW = w - 32
    fitScale.value = Math.max(0.35, Math.min(1.0, Math.round((targetW / 794) * 100) / 100))
    if (zoomScale.value === 0.95 || zoomScale.value > fitScale.value * 1.5) {
      zoomScale.value = fitScale.value
    }
  } else {
    fitScale.value = Math.max(0.7, Math.min(1.15, Math.round(((w - 180) / 794) * 100) / 100))
    zoomScale.value = Math.min(0.95, fitScale.value)
  }
}

function zoomIn() {
  if (zoomScale.value < 1.6) zoomScale.value = Math.min(1.6, Math.round((zoomScale.value + 0.1) * 10) / 10)
}

function zoomOut() {
  if (zoomScale.value > 0.35) zoomScale.value = Math.max(0.35, Math.round((zoomScale.value - 0.1) * 10) / 10)
}

function setZoom(val: number | 'fit') {
  if (val === 'fit') {
    zoomScale.value = fitScale.value
  } else {
    zoomScale.value = val
  }
}

// Multi-Page Pagination Engine (Faithful to Tally Prime layout)
const paginatedPages = computed(() => {
  if (!ledgerData.value || !ledgerData.value.transactions) return []

  const txs = ledgerData.value.transactions as any[]
  const totalTxs = txs.length

  // If 18 or fewer items, fits perfectly on a single page
  if (totalTxs <= 18) {
    return [{
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      isLastPage: true,
      rows: txs,
      broughtForwardDebit: 0,
      broughtForwardCredit: 0,
      carriedOverDebit: 0,
      carriedOverCredit: 0
    }]
  }

  // Multi-page split:
  // Page 1: 18 rows
  // Page 2+: 26 rows
  const pages: any[] = []
  let currentIndex = 0
  let pageNumber = 1

  let runningDebit = 0
  let runningCredit = 0

  while (currentIndex < totalTxs) {
    const isFirst = pageNumber === 1
    const pageSize = isFirst ? 18 : 26
    const chunk = txs.slice(currentIndex, currentIndex + pageSize)
    const isLast = (currentIndex + pageSize) >= totalTxs

    const bfDebit = runningDebit
    const bfCredit = runningCredit

    for (const row of chunk) {
      if (row.debit) runningDebit += row.debit
      if (row.credit) runningCredit += row.credit
    }

    pages.push({
      pageNumber,
      isFirstPage: isFirst,
      isLastPage: isLast,
      rows: chunk,
      broughtForwardDebit: bfDebit,
      broughtForwardCredit: bfCredit,
      carriedOverDebit: runningDebit,
      carriedOverCredit: runningCredit
    })

    currentIndex += pageSize
    pageNumber++
  }

  pages.forEach(p => { p.totalPages = pages.length })
  return pages
})

// PDF Generation
const downloadPdf = async () => {
  if (isExporting.value) return
  isExporting.value = true
  exportAction.value = 'pdf'

  try {
    const prevMode = mobileViewMode.value
    if (!isDesktop.value && mobileViewMode.value === 'list') {
      mobileViewMode.value = 'slip'
      await new Promise(r => setTimeout(r, 120))
    }

    const container = printableContainerRef.value
    if (!container) throw new Error('Preview container not found')

    const pageElements = container.querySelectorAll('.a4-ledger-sheet')
    if (!pageElements.length) throw new Error('No printable sheets found')

    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    })

    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement
      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        quality: 0.95,
        backgroundColor: '#ffffff'
      })

      if (i > 0) pdf.addPage('a4', 'portrait')
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST')
    }

    const safeParty = (ledgerData.value?.party?.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Ledger-${safeParty}-${toDate.value}.pdf`

    if (typeof window !== 'undefined' && ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile || (window as any).AndroidBridge?.saveFile)) {
      const pdfDataUri = pdf.output('datauristring')
      if ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile) {
        await (window as any).Capacitor.Plugins.OMSBridge.saveFile({
          base64Data: pdfDataUri,
          fileName,
          mimeType: 'application/pdf',
          openAfterSave: true
        })
      } else {
        ;(window as any).AndroidBridge.saveFile(pdfDataUri, fileName, 'application/pdf', true)
      }
      return
    }

    pdf.save(fileName)

    if (!isDesktop.value && prevMode === 'list') {
      mobileViewMode.value = 'list'
    }
  } catch (err: any) {
    console.error('PDF generation error:', err)
  } finally {
    isExporting.value = false
    exportAction.value = null
  }
}

// Print Ledger via hidden iframe
const printLedger = async () => {
  if (isExporting.value) return
  isExporting.value = true
  exportAction.value = 'print'

  try {
    const container = printableContainerRef.value
    if (!container) throw new Error('Preview container not found')

    const pageElements = container.querySelectorAll('.a4-ledger-sheet')
    if (!pageElements.length) throw new Error('No printable sheets found')

    const images: string[] = []
    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement
      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        quality: 0.95,
        backgroundColor: '#ffffff'
      })
      images.push(dataUrl)
    }

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentWindow?.document
    if (iframeDoc) {
      iframeDoc.open()
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Party Ledger - ${ledgerData.value?.party?.name || 'Tally'}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; }
            .print-page { width: 100vw; height: 100vh; page-break-after: always; display: flex; align-items: flex-start; justify-content: center; }
            img { width: 100%; height: auto; max-width: 100vw; display: block; }
          </style>
        </head>
        <body>
          ${images.map(img => `<div class="print-page"><img src="${img}" /></div>`).join('')}
          <script>
            window.onload = function() {
              window.print();
            };
          <\/script>
        </body>
        </html>
      `)
      iframeDoc.close()
    }

    setTimeout(() => {
      try {
        document.body.removeChild(iframe)
      } catch (_) {}
    }, 3000)
  } catch (err: any) {
    console.error('Print error:', err)
  } finally {
    isExporting.value = false
    exportAction.value = null
  }
}

onMounted(() => {
  updateResponsiveScales()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateResponsiveScales)
    document.addEventListener('click', handleClickOutside)
  }
  fetchTallyParties()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateResponsiveScales)
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
