<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[350] md:z-[500] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 lg:p-6 overflow-hidden antialiased animate-in fade-in duration-200"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        @click="closeModal"
      ></div>

      <!-- Modal Container -->
      <div
        class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-6xl mx-auto h-full sm:h-auto sm:max-h-[94vh] overflow-hidden flex flex-col border border-gray-200 z-10"
      >
        <!-- Modal Top Bar -->
        <div class="px-3 sm:px-6 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 sm:py-3 bg-[#171717] text-white flex items-center justify-between shrink-0 border-b border-gray-800">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="min-w-0">
              <h3 class="text-xs sm:text-base font-bold text-white truncate">Party Ledger Statement</h3>
            </div>
          </div>

          <!-- Top Action Controls -->
          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <!-- Design Style Toggle (Classic Look vs SM Look) -->
            <div class="flex items-center p-0.5 bg-gray-800/90 rounded-lg border border-gray-700 text-[10px] sm:text-[11px] font-bold">
              <button
                type="button"
                @click="designStyle = 'classic'"
                class="px-2 sm:px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                :class="designStyle === 'classic' ? 'bg-white text-gray-950 shadow-xs' : 'text-gray-400 hover:text-white'"
                title="Traditional monochrome ledger layout"
              >
                <span>Classic</span>
              </button>
              <button
                type="button"
                @click="designStyle = 'sm'"
                class="px-2 sm:px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                :class="designStyle === 'sm' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'text-gray-400 hover:text-white'"
                title="Silicon Marketing branded layout"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>SM Look</span>
              </button>
            </div>

            <!-- Print Button (Desktop) -->
            <button
              type="button"
              @click="printLedger"
              :disabled="isLoadingLedger || isExporting || !ledgerData"
              class="hidden sm:flex px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Print Ledger"
            >
              <Loader2 v-if="isExporting && exportAction === 'print'" class="w-3.5 h-3.5 animate-spin" />
              <Printer v-else class="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <!-- Download PDF Button (Desktop) -->
            <button
              type="button"
              @click="downloadPdf"
              :disabled="isLoadingLedger || isExporting || !ledgerData"
              class="hidden sm:flex px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-lg text-xs font-bold shadow-sm transition-all items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Loader2 v-if="isExporting && exportAction === 'pdf'" class="w-3.5 h-3.5 animate-spin" />
              <FileDown v-else class="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <!-- Close Modal -->
            <button
              @click="closeModal"
              class="p-1 sm:p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer ml-0.5 sm:ml-1"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Filter Bar: Customer Search & Date Range -->
        <div class="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-b border-gray-200 flex flex-col gap-2.5 shrink-0">
          <!-- Row 1: Searchable Tally Party Combobox -->
          <div class="relative" ref="comboboxRef">
            <div
              @click="toggleDropdown"
              class="w-full px-3 py-2 bg-white hover:bg-slate-50/80 border border-gray-300 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs gap-2"
              :class="{ 'ring-2 ring-[#1b3b5f] border-transparent': isDropdownOpen }"
            >
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <Search class="w-4 h-4 text-gray-400 shrink-0" />
                <div class="min-w-0 flex-1">
                  <span v-if="!selectedParty" class="text-xs text-gray-400 font-medium truncate block">
                    Search customer or vendor account...
                  </span>
                  <div v-else class="min-w-0 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <span class="text-xs font-bold text-gray-950 truncate max-w-[180px] sm:max-w-md block">
                      {{ selectedParty }}
                    </span>
                    <span
                      v-if="selectedPartyObj"
                      class="text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0"
                      :class="selectedPartyObj.role === 'creditor' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'"
                    >
                      {{ selectedPartyObj.parent }}
                    </span>
                    <span v-if="selectedPartyObj && selectedPartyObj.netPending > 0" class="text-[10px] font-mono font-semibold text-gray-500 shrink-0 hidden sm:inline">
                      &bull; ₹{{ formatIndianNumber(selectedPartyObj.netPending) }} pending
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0 text-gray-400">
                <button
                  v-if="selectedParty"
                  @click.stop="clearSelection"
                  class="p-1 hover:text-gray-600 rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer mr-0.5"
                  title="Clear party"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
                <Loader2 v-if="isLoadingParties" class="w-4 h-4 animate-spin text-[#1b3b5f]" />
                <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': isDropdownOpen }" />
              </div>
            </div>

            <!-- Dropdown Menu Sheet -->
            <div
              v-if="isDropdownOpen"
              class="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col max-h-72"
            >
              <!-- Search Input inside dropdown -->
              <div class="p-2.5 bg-slate-50 border-b border-gray-200 flex items-center gap-2 shrink-0">
                <Search class="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                <input
                  ref="searchInputRef"
                  v-model="partySearchQuery"
                  type="text"
                  placeholder="Type customer or vendor name (e.g. Mas, Knob, Timber)..."
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

              <!-- Options List -->
              <div class="overflow-y-auto flex-1 divide-y divide-gray-100 overscroll-contain">
                <div v-if="filteredParties.length === 0" class="p-6 text-center text-xs text-gray-400">
                  No Tally account found matching "{{ partySearchQuery }}".
                </div>

                <button
                  v-for="p in filteredParties"
                  :key="p.party"
                  type="button"
                  @click="selectParty(p.party)"
                  class="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                  :class="selectedParty === p.party ? 'bg-slate-100 font-semibold' : ''"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <span class="text-xs font-bold text-gray-900 group-hover:text-[#1b3b5f] truncate max-w-[190px] sm:max-w-md block">
                        {{ p.party }}
                      </span>
                      <span
                        class="text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0"
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

          <!-- Row 2: Date Picker Controls & Quick Presets -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-2.5 text-xs">
            <!-- Desktop / Tablet inline date picker -->
            <div class="hidden sm:flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-gray-700 flex items-center gap-1 text-xs">
                <Calendar class="w-3.5 h-3.5 text-gray-500" />
                <span>Period:</span>
              </span>

              <div class="flex items-center gap-1">
                <div class="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
                  <span class="text-[9px] uppercase font-bold text-gray-400 mr-1">From</span>
                  <input
                    v-model="fromDate"
                    type="date"
                    class="bg-transparent text-xs font-mono font-bold text-gray-800 outline-none cursor-pointer"
                  />
                </div>
                <span class="text-gray-400 font-bold">&ndash;</span>
                <div class="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
                  <span class="text-[9px] uppercase font-bold text-gray-400 mr-1">To</span>
                  <input
                    v-model="toDate"
                    type="date"
                    class="bg-transparent text-xs font-mono font-bold text-gray-800 outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  @click="fetchLedger"
                  :disabled="!selectedParty || isLoadingLedger"
                  class="px-2.5 py-1 bg-[#1b3b5f] hover:bg-[#132c49] text-white font-bold rounded-lg text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isLoadingLedger }" />
                  <span>Filter</span>
                </button>
              </div>
            </div>

            <!-- Mobile-only 2-column Date Pickers Row (Guaranteed No Overflow!) -->
            <div class="sm:hidden flex items-center gap-1.5 w-full">
              <div class="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
                <div class="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs min-w-0">
                  <span class="text-[9px] uppercase font-bold text-gray-400 mr-1 shrink-0">From</span>
                  <input
                    v-model="fromDate"
                    type="date"
                    class="bg-transparent text-[11px] font-mono font-bold text-gray-800 outline-none w-full min-w-0 p-0 cursor-pointer"
                  />
                </div>
                <div class="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs min-w-0">
                  <span class="text-[9px] uppercase font-bold text-gray-400 mr-1 shrink-0">To</span>
                  <input
                    v-model="toDate"
                    type="date"
                    class="bg-transparent text-[11px] font-mono font-bold text-gray-800 outline-none w-full min-w-0 p-0 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                @click="fetchLedger"
                :disabled="!selectedParty || isLoadingLedger"
                class="px-3 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white font-bold rounded-lg text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
                title="Apply Date Filter"
              >
                <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingLedger }" />
              </button>
            </div>

            <!-- Quick Presets -->
            <div class="flex items-center gap-1 overflow-x-auto scrollbar-none text-[10px] sm:text-[11px] font-semibold py-0.5">
              <button
                type="button"
                @click="applyPreset('currentFY')"
                class="px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'currentFY' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
              >
                Current FY
              </button>
              <button
                type="button"
                @click="applyPreset('thisMonth')"
                class="px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'thisMonth' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
              >
                This Month
              </button>
              <button
                type="button"
                @click="applyPreset('lastMonth')"
                class="px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'lastMonth' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
              >
                Last Month
              </button>
              <button
                type="button"
                @click="applyPreset('allTime')"
                class="px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0"
                :class="activePreset === 'allTime' ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'"
              >
                All Time
              </button>
            </div>
          </div>
        </div>

        <!-- Preview Body Area -->
        <div class="overflow-y-auto overflow-x-auto flex-1 bg-slate-200/80 p-2 sm:p-6 pb-24 sm:pb-8 text-center -webkit-overflow-scrolling-touch">
          <!-- State 1: Start Blank (No Party Selected) -->
          <div v-if="!selectedParty && !isLoadingLedger" class="py-20 sm:py-24 text-center max-w-sm mx-auto space-y-3 px-4">
            <div class="w-12 h-12 rounded-2xl bg-white border border-gray-200 text-[#1b3b5f] flex items-center justify-center mx-auto shadow-2xs">
              <Search class="w-6 h-6 text-gray-400" />
            </div>
            <h4 class="text-sm font-bold text-gray-900">Select a Tally Customer to Generate Statement</h4>
            <p class="text-xs text-gray-500 leading-relaxed">
              Use the search bar above to look up any customer or vendor. The statement will immediately generate below.
            </p>
          </div>

          <!-- State 2: Loading State -->
          <div v-else-if="isLoadingLedger" class="py-20 sm:py-24 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
            <p class="text-xs font-semibold text-gray-700">Generating statement for {{ selectedParty }}...</p>
          </div>

          <!-- State 3: Error State -->
          <div v-else-if="ledgerError" class="py-16 text-center text-red-600 space-y-3 px-4 max-w-md mx-auto">
            <AlertCircle class="w-8 h-8 mx-auto text-red-500" />
            <p class="font-bold text-sm">{{ ledgerError }}</p>
            <button
              @click="fetchLedger"
              class="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition"
            >
              Retry
            </button>
          </div>

          <!-- State 4: Ledger Preview (Rendered) -->
          <div v-else-if="ledgerData" class="w-full flex flex-col items-center">
            <!-- Zoom & Page Indicator Controls Bar -->
            <div class="flex items-center justify-between w-full max-w-4xl mx-auto mb-3 px-1">
              <div class="flex items-center gap-2 text-xs text-gray-700 font-semibold">
                <span class="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-gray-300 shadow-2xs">
                  {{ paginatedPages.length }} {{ paginatedPages.length === 1 ? 'Page' : 'Pages' }}
                </span>
              </div>

              <div class="flex items-center gap-1 text-xs">
                <span class="text-[10px] font-mono font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 px-2 py-0.5 rounded border border-[#1b3b5f]/20">
                  {{ Math.round(zoomScale * 100) }}%
                </span>
                <button
                  type="button"
                  @click="zoomOut"
                  :disabled="zoomScale <= 0.25"
                  class="p-1 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 disabled:opacity-40 cursor-pointer shadow-2xs"
                  title="Zoom Out"
                >
                  <ZoomOut class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  @click="setZoom('fit')"
                  class="px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer shadow-2xs"
                  :class="zoomScale === fitScale ? 'bg-[#1b3b5f] text-white border border-[#1b3b5f]' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
                >
                  Fit
                </button>
                <button
                  type="button"
                  @click="setZoom(1.0)"
                  class="px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer shadow-2xs"
                  :class="zoomScale === 1.0 ? 'bg-[#1b3b5f] text-white border border-[#1b3b5f]' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
                >
                  100%
                </button>
                <button
                  type="button"
                  @click="zoomIn"
                  :disabled="zoomScale >= 1.6"
                  class="p-1 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 disabled:opacity-40 cursor-pointer shadow-2xs"
                  title="Zoom In"
                >
                  <ZoomIn class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Faithful Multi-Page A4 Canvas Preview (Works natively on Desktop & Mobile!) -->
            <div
              ref="printableContainerRef"
              class="flex flex-col items-center gap-6 mx-auto w-fit py-1 select-text"
            >
              <!-- Multi-Page Paginated Sheets -->
              <div
                v-for="page in paginatedPages"
                :key="page.pageNumber"
                class="page-sheet-wrapper relative shadow-2xl rounded-xs overflow-hidden mx-auto transition-all duration-150"
                :style="{
                  width: `${Math.round(794 * zoomScale)}px`,
                  height: `${Math.round(1123 * zoomScale)}px`
                }"
              >
                <div
                  class="a4-ledger-sheet bg-white border border-gray-300 p-8 flex flex-col justify-between text-left antialiased select-text"
                  :class="designStyle === 'classic' ? 'text-gray-950 font-serif' : 'text-gray-900 font-sans'"
                  :style="{
                    width: '794px',
                    height: '1123px',
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    left: '0px',
                    top: '0px',
                    fontFamily: designStyle === 'classic' ? `'Times New Roman', Times, serif` : `ui-sans-serif, system-ui, sans-serif`
                  }"
                >
                    <!-- ================= STYLE 1: CLASSIC TALLY PRIME (Exact Match to User Image) ================= -->
                    <div v-if="designStyle === 'classic'" class="space-y-4">
                      <!-- Page 1 Full Header -->
                      <div v-if="page.isFirstPage" class="space-y-3">
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

                        <!-- Party Details -->
                        <div class="text-center space-y-0.5 pt-1">
                          <h2 class="text-base font-bold text-black tracking-tight font-sans">
                            {{ ledgerData.party.name }}
                          </h2>
                          <p class="text-xs text-gray-800">Ledger Account</p>
                          <div v-if="ledgerData.party.addressLines?.length" class="text-[11px] text-gray-700 uppercase leading-snug">
                            <p v-for="(line, idx) in ledgerData.party.addressLines" :key="idx">{{ line }}</p>
                          </div>
                          <p v-if="ledgerData.party.phone" class="text-[11px] text-gray-700">
                            {{ ledgerData.party.phone }}
                          </p>

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

                      <!-- Subsequent Pages Short Header -->
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

                      <!-- Classic Ledger Table -->
                      <div class="w-full">
                        <table class="w-full text-left border-collapse text-xs">
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
                            <!-- Brought Forward (Page 2+) -->
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

                            <!-- Row Entries -->
                            <tr v-for="(row, rIdx) in page.rows" :key="rIdx" class="leading-tight">
                              <td class="py-1 px-1.5 whitespace-nowrap font-serif align-top text-black">{{ row.date }}</td>
                              <td class="py-1 px-2 text-black align-top font-serif leading-tight">{{ row.particulars }}</td>
                              <td class="py-1 px-1.5 font-serif text-black align-top whitespace-nowrap">{{ row.vchType || '' }}</td>
                              <td class="py-1 px-1.5 text-center font-serif text-black align-top whitespace-nowrap">{{ row.vchNo || '' }}</td>
                              <td class="py-1 px-2 text-right font-mono text-black align-top tabular-nums whitespace-nowrap">
                                {{ row.debit !== null ? formatIndianNumber(row.debit) : '' }}
                              </td>
                              <td class="py-1 px-2 text-right font-mono text-black align-top tabular-nums whitespace-nowrap">
                                {{ row.credit !== null ? formatIndianNumber(row.credit) : '' }}
                              </td>
                            </tr>

                            <!-- Carried Over (Intermediate pages) -->
                            <tr v-if="!page.isLastPage" class="font-bold border-t border-black">
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-2 italic">Carried Over</td>
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-1.5"></td>
                              <td class="py-1 px-2 text-right font-mono tabular-nums">{{ formatIndianNumber(page.carriedOverDebit) }}</td>
                              <td class="py-1 px-2 text-right font-mono tabular-nums">{{ formatIndianNumber(page.carriedOverCredit) }}</td>
                            </tr>

                            <!-- Last Page Totals & Closing Balance -->
                            <template v-if="page.isLastPage">
                              <tr class="border-t border-black font-bold">
                                <td colspan="4" class="py-1 px-2 text-right"></td>
                                <td class="py-1 px-2 text-right font-mono border-t border-black tabular-nums">{{ formatIndianNumber(ledgerData.totals.totalDebit) }}</td>
                                <td class="py-1 px-2 text-right font-mono border-t border-black tabular-nums">{{ formatIndianNumber(ledgerData.totals.totalCredit) }}</td>
                              </tr>
                              <tr v-if="ledgerData.totals.closingBalance > 0" class="font-bold">
                                <td class="py-1 px-1.5"></td>
                                <td colspan="3" class="py-1 px-2">
                                  {{ ledgerData.totals.closingBalanceType === 'Dr' ? 'By Closing Balance' : 'To Closing Balance' }}
                                </td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Cr'">{{ formatIndianNumber(ledgerData.totals.closingBalance) }}</span>
                                </td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Dr'">{{ formatIndianNumber(ledgerData.totals.closingBalance) }}</span>
                                </td>
                              </tr>
                              <tr class="border-t border-b-4 border-double border-black font-bold">
                                <td colspan="4" class="py-1 px-2 text-right"></td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">{{ formatIndianNumber(ledgerData.totals.balancedTotal) }}</td>
                                <td class="py-1 px-2 text-right font-mono tabular-nums">{{ formatIndianNumber(ledgerData.totals.balancedTotal) }}</td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- ================= STYLE 2: SM LOOK (Faithful First Custom Design) ================= -->
                    <div v-else class="space-y-4">
                      <!-- Page 1 Header (Compact, Left-Aligned with Name at Left & Address at Right) -->
                      <div v-if="page.isFirstPage" class="space-y-2.5">
                        <!-- Top Brand Color Gradient Line -->
                        <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1b3b5f] rounded-full"></div>

                        <!-- Row 1: Company Header (Left) & Document Meta (Right) -->
                        <div class="flex items-start justify-between border-b border-gray-200 pb-2.5 gap-4">
                          <div class="min-w-0">
                            <h1 class="text-base font-bold text-[#1b3b5f] tracking-wide uppercase leading-tight">
                              {{ ledgerData?.company?.name || 'SRI LAKSHMI PLYWOODS' }}
                            </h1>
                            <p class="text-[11px] font-medium text-gray-500 mt-0.5">
                              {{ ledgerData?.company?.tradeName || 'Trade Name : Silicon Marketing' }}
                            </p>
                            <p class="text-[10px] text-gray-500 whitespace-pre-line leading-tight mt-0.5 max-w-md">
                              {{ ledgerData?.company?.address }}
                            </p>
                          </div>

                          <div class="text-right shrink-0 flex flex-col items-end">
                            <span class="inline-block px-2.5 py-0.5 rounded-md bg-[#1b3b5f] text-white text-[10px] font-black uppercase tracking-wider shadow-2xs">
                              Statement of Account
                            </span>
                            <div class="text-[10px] font-mono font-bold text-gray-700 mt-1">
                              Period: <span class="text-[#1b3b5f]">{{ ledgerData?.period?.display }}</span>
                            </div>
                            <div class="text-[9px] font-mono text-gray-400 mt-0.5">
                              Page {{ page.pageNumber }} of {{ page.totalPages }}
                            </div>
                          </div>
                        </div>

                        <!-- Row 2: Customer Box (Name at Left, Address at Right) -->
                        <div class="bg-slate-50 border border-slate-200/90 rounded-lg p-2.5 flex items-start justify-between gap-4">
                          <!-- Left: Customer Name & Contact -->
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 mb-0.5">
                              <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                Account Of
                              </span>
                              <span
                                v-if="selectedPartyObj?.parent"
                                class="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase"
                              >
                                {{ selectedPartyObj.parent }}
                              </span>
                            </div>
                            <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-normal truncate">
                              {{ ledgerData?.party?.name }}
                            </h2>
                            <div v-if="ledgerData?.party?.phone" class="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1 font-mono">
                              <span class="text-gray-400 font-sans">Contact:</span>
                              <span class="font-bold text-gray-800">{{ ledgerData.party.phone }}</span>
                            </div>
                          </div>

                          <!-- Right: Party Address (Neatly right aligned) -->
                          <div
                            v-if="ledgerData?.party?.addressLines?.length || ledgerData?.party?.address"
                            class="text-right max-w-xs shrink-0"
                          >
                            <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                              Address
                            </span>
                            <div class="text-[10.5px] text-gray-700 uppercase leading-snug">
                              <template v-if="ledgerData.party.addressLines?.length">
                                <p v-for="(line, idx) in ledgerData.party.addressLines" :key="idx" class="truncate">
                                  {{ line }}
                                </p>
                              </template>
                              <p v-else class="whitespace-pre-line line-clamp-2">
                                {{ ledgerData.party.address }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Subsequent Pages Short SM Header -->
                      <div v-else class="space-y-2 pb-1">
                        <div class="h-1 w-full bg-gradient-to-r from-[#1b3b5f] to-[#d92546] rounded-full"></div>
                        <div class="flex items-center justify-between text-xs pb-1 border-b border-gray-200">
                          <div>
                            <span class="font-bold text-[#1b3b5f] uppercase tracking-wide">{{ ledgerData.company.name }}</span>
                            <span class="text-gray-400 mx-2">&bull;</span>
                            <span class="font-semibold text-gray-800">{{ ledgerData.party.name }}</span>
                            <span class="text-gray-400 mx-2">&bull;</span>
                            <span class="text-[11px] text-gray-500">Statement of Account</span>
                          </div>
                          <span class="text-[11px] font-mono text-gray-500">Page {{ page.pageNumber }} of {{ page.totalPages }}</span>
                        </div>
                      </div>

                      <!-- Modern SM Table -->
                      <div class="border border-gray-300 rounded-lg overflow-hidden shadow-2xs">
                        <table class="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr class="bg-[#1b3b5f] text-white font-extrabold text-[11px] uppercase tracking-wider">
                              <th class="py-2.5 px-3 w-24">Date</th>
                              <th class="py-2.5 px-3">Particulars</th>
                              <th class="py-2.5 px-2.5 text-center w-20">Vch Type</th>
                              <th class="py-2.5 px-2.5 text-center w-24">Vch No.</th>
                              <th class="py-2.5 px-3 text-right w-28">Debit (₹)</th>
                              <th class="py-2.5 px-3 text-right w-28">Credit (₹)</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-200 text-[11px]">
                            <!-- Brought Forward (Page 2+) -->
                            <tr v-if="!page.isFirstPage" class="bg-slate-50 font-bold">
                              <td class="py-2 px-3"></td>
                              <td class="py-2 px-3 text-gray-700 italic">Brought Forward</td>
                              <td class="py-2 px-2.5 text-center">-</td>
                              <td class="py-2 px-2.5 text-center">-</td>
                              <td class="py-2 px-3 text-right font-mono tabular-nums text-[#1b3b5f]">
                                {{ page.broughtForwardDebit > 0 ? formatIndianNumber(page.broughtForwardDebit) : '' }}
                              </td>
                              <td class="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">
                                {{ page.broughtForwardCredit > 0 ? formatIndianNumber(page.broughtForwardCredit) : '' }}
                              </td>
                            </tr>

                            <!-- Row Entries -->
                            <tr
                              v-for="(row, rIdx) in page.rows"
                              :key="rIdx"
                              class="hover:bg-slate-50/80 transition-colors"
                              :class="row.particulars.includes('Opening Balance') ? 'bg-amber-50/40 font-bold' : ''"
                            >
                              <td class="py-2 px-3 font-mono text-gray-700 whitespace-nowrap">{{ row.date }}</td>
                              <td class="py-2 px-3 text-gray-900 font-medium">
                                <span :class="row.particulars.startsWith('To') ? 'text-[#1b3b5f] font-semibold' : 'text-slate-800 font-semibold'">
                                  {{ row.particulars }}
                                </span>
                              </td>
                              <td class="py-2 px-2.5 text-center font-semibold text-gray-600">{{ row.vchType || '-' }}</td>
                              <td class="py-2 px-2.5 text-center font-mono font-bold text-[#1b3b5f]">{{ row.vchNo || '-' }}</td>
                              <td class="py-2 px-3 text-right font-mono font-semibold text-gray-900 tabular-nums">
                                {{ row.debit !== null ? formatIndianNumber(row.debit) : '' }}
                              </td>
                              <td class="py-2 px-3 text-right font-mono font-semibold text-gray-900 tabular-nums">
                                {{ row.credit !== null ? formatIndianNumber(row.credit) : '' }}
                              </td>
                            </tr>

                            <!-- Carried Over (Intermediate pages) -->
                            <tr v-if="!page.isLastPage" class="bg-slate-50 font-bold border-t border-gray-300">
                              <td class="py-2 px-3"></td>
                              <td class="py-2 px-3 text-gray-700 italic">Carried Over</td>
                              <td class="py-2 px-2.5 text-center">-</td>
                              <td class="py-2 px-2.5 text-center">-</td>
                              <td class="py-2 px-3 text-right font-mono tabular-nums text-[#1b3b5f]">{{ formatIndianNumber(page.carriedOverDebit) }}</td>
                              <td class="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">{{ formatIndianNumber(page.carriedOverCredit) }}</td>
                            </tr>

                            <!-- Last Page Totals & Closing Balance -->
                            <template v-if="page.isLastPage">
                              <tr class="bg-gray-50 border-t-2 border-gray-300 font-bold text-[11px]">
                                <td colspan="4" class="py-2 px-3 text-right uppercase tracking-wider text-gray-700">Totals</td>
                                <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">{{ formatIndianNumber(ledgerData.totals.totalDebit) }}</td>
                                <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">{{ formatIndianNumber(ledgerData.totals.totalCredit) }}</td>
                              </tr>
                              <tr v-if="ledgerData.totals.closingBalance > 0" class="bg-amber-50/50 font-bold text-[11px]">
                                <td class="py-2 px-3 font-mono text-gray-600">{{ toDate }}</td>
                                <td colspan="3" class="py-2 px-3 text-gray-900">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Dr'" class="text-[#1b3b5f]">
                                    By Closing Balance (Dr)
                                  </span>
                                  <span v-else class="text-emerald-700">
                                    To Closing Balance (Cr)
                                  </span>
                                </td>
                                <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Cr'">{{ formatIndianNumber(ledgerData.totals.closingBalance) }}</span>
                                </td>
                                <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">
                                  <span v-if="ledgerData.totals.closingBalanceType === 'Dr'">{{ formatIndianNumber(ledgerData.totals.closingBalance) }}</span>
                                </td>
                              </tr>
                              <tr class="bg-[#1b3b5f]/5 border-t-2 border-b-4 border-double border-gray-400 font-black text-xs">
                                <td colspan="4" class="py-2.5 px-3 text-right"></td>
                                <td class="py-2.5 px-3 text-right font-mono text-[#1b3b5f] tabular-nums">₹{{ formatIndianNumber(ledgerData.totals.balancedTotal) }}</td>
                                <td class="py-2.5 px-3 text-right font-mono text-[#1b3b5f] tabular-nums">₹{{ formatIndianNumber(ledgerData.totals.balancedTotal) }}</td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- Bottom Continuation Note (for intermediate pages) -->
                    <div v-if="!page.isLastPage" class="pt-4 text-right italic text-[11px] text-gray-600">
                      continued ...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        <!-- Sticky Mobile Bottom Bar -->
        <div v-if="ledgerData" class="sm:hidden p-3 bg-white border-t border-gray-200 shadow-lg flex items-center gap-2.5 shrink-0 z-20">
          <div class="flex-1 min-w-0">
            <span class="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Closing Balance</span>
            <div class="text-xs font-mono font-black text-gray-900 truncate">
              ₹{{ formatIndianNumber(ledgerData?.totals?.closingBalance || 0) }}
              <span class="text-[10px]" :class="ledgerData?.totals?.closingBalanceType === 'Dr' ? 'text-amber-800' : 'text-emerald-700'">
                ({{ ledgerData?.totals?.closingBalanceType || 'Dr' }})
              </span>
            </div>
          </div>

          <button
            type="button"
            @click="downloadPdf"
            :disabled="isLoadingLedger || isExporting"
            class="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isExporting && exportAction === 'pdf'" class="w-4 h-4 animate-spin" />
            <FileDown v-else class="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  Search,
  Calendar,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  X
} from 'lucide-vue-next'
import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// State
const isLoadingParties = ref(false)
const isLoadingLedger = ref(false)
const isExporting = ref(false)
const exportAction = ref<'pdf' | 'print' | null>(null)
const ledgerError = ref<string | null>(null)

// Design style toggle: 'classic' (Tally) vs 'sm' (Modern Silicon Marketing Quotation)
const designStyle = ref<'classic' | 'sm'>('classic')

const parties = ref<any[]>([])
const selectedParty = ref<string>('') // STARTS BLANK! No default customer.
const partySearchQuery = ref('')
const isDropdownOpen = ref(false)
const comboboxRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Date Range Filters
const fromDate = ref('2026-04-01')
const toDate = ref('2026-11-30')
const activePreset = ref<'currentFY' | 'thisMonth' | 'lastMonth' | 'allTime'>('currentFY')

// Zoom & Scale State
const zoomScale = ref(0.95)
const fitScale = ref(0.95)
const isDesktop = ref(false)
const printableContainerRef = ref<HTMLElement | null>(null)

const ledgerData = ref<any>(null)

const closeModal = () => {
  emit('close')
}

const clearSelection = () => {
  selectedParty.value = ''
  ledgerData.value = null
  ledgerError.value = null
}

const selectedPartyObj = computed(() => {
  if (!selectedParty.value) return null
  return parties.value.find(p => p.party === selectedParty.value) || null
})

const filteredParties = computed(() => {
  const query = partySearchQuery.value.trim().toLowerCase()
  if (!query) return parties.value
  return parties.value.filter(p => {
    return p.party.toLowerCase().includes(query) || (p.parent && p.parent.toLowerCase().includes(query))
  })
})

const currentFormattedTimestamp = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
  if (selectedParty.value) {
    fetchLedger()
  }
}

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

function updateResponsiveScales() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  isDesktop.value = w >= 640

  if (w < 640) {
    const targetW = Math.max(280, w - 24)
    const calculatedFit = Math.round((targetW / 794) * 1000) / 1000
    fitScale.value = calculatedFit
    zoomScale.value = calculatedFit
  } else {
    const targetW = Math.min(1050, w - 80)
    fitScale.value = Math.max(0.6, Math.min(1.15, Math.round((targetW / 794) * 100) / 100))
    zoomScale.value = Math.min(0.95, fitScale.value)
  }
}

function zoomIn() {
  if (zoomScale.value < 1.6) zoomScale.value = Math.min(1.6, Math.round((zoomScale.value + 0.1) * 10) / 10)
}

function zoomOut() {
  if (zoomScale.value > 0.25) zoomScale.value = Math.max(0.25, Math.round((zoomScale.value - 0.1) * 10) / 10)
}

function setZoom(val: number | 'fit') {
  if (val === 'fit') {
    zoomScale.value = fitScale.value
  } else {
    zoomScale.value = val
  }
}

// Multi-Page Pagination Engine
const paginatedPages = computed(() => {
  if (!ledgerData.value || !ledgerData.value.transactions) return []

  const txs = ledgerData.value.transactions as any[]
  const totalTxs = txs.length
  // Dynamic page capacities: Classic look has compact py-1 rows (~23px) fitting 28 on p1 & 34 on p2+
  // SM look has py-2 rows (~31px) fitting 24 on p1 & 28 on p2+
  const firstPageLimit = designStyle.value === 'sm' ? 24 : 28
  const subsequentPageLimit = designStyle.value === 'sm' ? 28 : 34

  if (totalTxs <= firstPageLimit) {
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

  const pages: any[] = []
  let currentIndex = 0
  let pageNumber = 1
  let runningDebit = 0
  let runningCredit = 0

  while (currentIndex < totalTxs) {
    const isFirst = pageNumber === 1
    const pageSize = isFirst ? firstPageLimit : subsequentPageLimit
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
  if (isExporting.value || !ledgerData.value) return
  isExporting.value = true
  exportAction.value = 'pdf'

  try {
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
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          left: '0px',
          top: '0px',
          margin: '0px'
        }
      })

      if (i > 0) pdf.addPage('a4', 'portrait')
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST')
    }

    const safeParty = (ledgerData.value?.party?.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Ledger-${safeParty}-${designStyle.value}-${toDate.value}.pdf`

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
  } catch (err: any) {
    console.error('PDF generation error:', err)
  } finally {
    isExporting.value = false
    exportAction.value = null
  }
}

// Print Ledger via hidden iframe
const printLedger = async () => {
  if (isExporting.value || !ledgerData.value) return
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
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          left: '0px',
          top: '0px',
          margin: '0px'
        }
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
          <title>Party Ledger - ${ledgerData.value?.party?.name || 'Statement'}</title>
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

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      updateResponsiveScales()
      if (parties.value.length === 0) {
        fetchTallyParties()
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  updateResponsiveScales()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateResponsiveScales)
    document.addEventListener('click', handleClickOutside)
  }
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
