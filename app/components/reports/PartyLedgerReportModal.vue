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

            <!-- Vector PDF View Tab -->
            <a
              v-if="selectedParty && ledgerData"
              :href="'/api/reports/party-ledger-pdf?party=' + encodeURIComponent(selectedParty) + '&from=' + fromDate + '&to=' + toDate + '&style=' + designStyle"
              target="_blank"
              class="hidden sm:flex px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all items-center gap-1.5 cursor-pointer"
              title="Open pure-vector PDF in new tab"
            >
              <ExternalLink class="w-3.5 h-3.5 text-emerald-400" />
              <span>Vector PDF</span>
            </a>

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
                  {{ pdfPagesCount }} {{ pdfPagesCount === 1 ? 'Page' : 'Pages' }}
                </span>
                <span class="text-[10px] text-gray-500 font-sans hidden sm:inline">
                  • Pure Vector Render
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

            <!-- True Vector PDF Multi-Page Canvas Preview (Identical to Downloaded PDF!) -->
            <div
              ref="printableContainerRef"
              class="flex flex-col items-center gap-6 mx-auto w-fit py-1 select-text"
            >
              <!-- PDF Rendering Indicator -->
              <div v-if="isRenderingPdf" class="py-16 flex flex-col items-center justify-center gap-2 text-gray-500">
                <Loader2 class="w-6 h-6 animate-spin text-[#1b3b5f]" />
                <p class="text-xs font-semibold text-gray-700">Rendering vector statement preview...</p>
              </div>

              <!-- PDF Render Error Notice -->
              <div v-else-if="renderError" class="py-12 px-4 max-w-md mx-auto text-center space-y-2 text-red-600">
                <AlertCircle class="w-6 h-6 mx-auto text-red-500" />
                <p class="text-xs font-bold">{{ renderError }}</p>
                <button
                  type="button"
                  @click="renderPdfPreview"
                  class="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Retry Preview
                </button>
              </div>

              <!-- Multi-Page Real Vector Sheets -->
              <template v-else>
                <div
                  v-for="pageNum in pdfPagesCount"
                  :key="pageNum"
                  class="page-sheet-wrapper relative shadow-2xl rounded-xs overflow-hidden mx-auto transition-all duration-150 bg-white"
                  :style="{
                    width: `${Math.round(794 * zoomScale)}px`,
                    height: `${Math.round(1123 * zoomScale)}px`
                  }"
                >
                  <canvas
                    :ref="el => setCanvasRef(pageNum, el)"
                    class="w-full h-full block"
                  ></canvas>
                </div>
              </template>
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
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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
  ExternalLink,
  X
} from 'lucide-vue-next'

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

// Vector PDF State
const pdfBlob = ref<Blob | null>(null)
const pdfDoc = shallowRef<any>(null)
const pdfPagesCount = ref(0)
const isRenderingPdf = ref(false)
const renderError = ref<string | null>(null)
const canvasRefs = new Map<number, HTMLCanvasElement>()

function setCanvasRef(pageNum: number, el: any) {
  if (el) {
    canvasRefs.set(pageNum, el as HTMLCanvasElement)
  } else {
    canvasRefs.delete(pageNum)
  }
}

let pdfjsLibInstance: any = null

async function loadPdfjs() {
  if (typeof window === 'undefined') return null
  if (!pdfjsLibInstance) {
    const lib = await import('pdfjs-dist')
    if (lib.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    }
    pdfjsLibInstance = lib
  }
  return pdfjsLibInstance
}

const ledgerData = ref<any>(null)

const closeModal = () => {
  emit('close')
}

const clearSelection = () => {
  selectedParty.value = ''
  ledgerData.value = null
  ledgerError.value = null
  pdfBlob.value = null
  pdfDoc.value = null
  pdfPagesCount.value = 0
  canvasRefs.clear()
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

    await renderPdfPreview()
  } catch (err: any) {
    console.error('Ledger fetch error:', err)
    ledgerError.value = err.data?.statusMessage || err.data?.message || err.message || 'Failed to load ledger data.'
  } finally {
    isLoadingLedger.value = false
  }
}

async function renderPdfPreview() {
  if (!selectedParty.value) return
  isRenderingPdf.value = true
  renderError.value = null

  try {
    const pdfUrl = `/api/reports/party-ledger-pdf?party=${encodeURIComponent(selectedParty.value)}&from=${fromDate.value}&to=${toDate.value}&style=${designStyle.value}`
    const response = await fetch(pdfUrl)
    if (!response.ok) {
      throw new Error(`Failed to generate PDF: ${response.statusText}`)
    }
    const blob = await response.blob()
    pdfBlob.value = blob

    const arrayBuffer = await blob.arrayBuffer()
    const pdfjsLib = await loadPdfjs()
    if (!pdfjsLib) throw new Error('PDF viewer could not be initialized.')

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer)
    })
    const doc = await loadingTask.promise
    pdfDoc.value = doc
    pdfPagesCount.value = doc.numPages

    await nextTick()
    await drawPages()
  } catch (err: any) {
    console.error('Error rendering PDF preview:', err)
    renderError.value = err.message || 'Failed to render PDF preview.'
  } finally {
    isRenderingPdf.value = false
  }
}

async function drawPages() {
  if (!pdfDoc.value) return
  const doc = pdfDoc.value

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const canvas = canvasRefs.get(pageNum)
    if (!canvas) continue

    const page = await doc.getPage(pageNum)
    const baseViewport = page.getViewport({ scale: 1 })
    const fitScaleFactor = 794 / baseViewport.width
    const viewport = page.getViewport({ scale: fitScaleFactor })

    const dpr = Math.max(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1)
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.save()
    ctx.scale(dpr, dpr)

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise

    ctx.restore()
  }
}

watch(designStyle, async () => {
  if (selectedParty.value && ledgerData.value) {
    await renderPdfPreview()
  }
})

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

// Download Vector PDF
const downloadPdf = async () => {
  if (isExporting.value || !selectedParty.value) return
  isExporting.value = true
  exportAction.value = 'pdf'

  try {
    const safeParty = (ledgerData.value?.party?.name || selectedParty.value || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Ledger-${safeParty}-${designStyle.value}-${toDate.value}.pdf`

    let blob = pdfBlob.value
    if (!blob) {
      const pdfUrl = `/api/reports/party-ledger-pdf?party=${encodeURIComponent(selectedParty.value)}&from=${fromDate.value}&to=${toDate.value}&style=${designStyle.value}&download=1`
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.statusText}`)
      }
      blob = await response.blob()
      pdfBlob.value = blob
    }

    // Mobile App (Capacitor / AndroidBridge)
    if (typeof window !== 'undefined' && ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile || (window as any).AndroidBridge?.saveFile)) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Data = reader.result as string
        if ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile) {
          await (window as any).Capacitor.Plugins.OMSBridge.saveFile({
            base64Data,
            fileName,
            mimeType: 'application/pdf',
            openAfterSave: true
          })
        } else {
          ;(window as any).AndroidBridge.saveFile(base64Data, fileName, 'application/pdf', true)
        }
      }
      reader.readAsDataURL(blob)
      return
    }

    // Standard Browser Download
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch (err: any) {
    console.error('PDF download error:', err)
    alert('Failed to download PDF: ' + (err.message || 'Unknown error'))
  } finally {
    isExporting.value = false
    exportAction.value = null
  }
}

// Print Ledger via hidden iframe
const printLedger = async () => {
  if (isExporting.value || !selectedParty.value) return
  isExporting.value = true
  exportAction.value = 'print'

  try {
    let blob = pdfBlob.value
    if (!blob) {
      const pdfUrl = `/api/reports/party-ledger-pdf?party=${encodeURIComponent(selectedParty.value)}&from=${fromDate.value}&to=${toDate.value}&style=${designStyle.value}`
      const response = await fetch(pdfUrl)
      if (!response.ok) throw new Error('Failed to fetch PDF for printing')
      blob = await response.blob()
      pdfBlob.value = blob
    }

    const blobUrl = window.URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.top = '-9999px'
    iframe.style.left = '-9999px'
    iframe.style.width = '1px'
    iframe.style.height = '1px'
    iframe.src = blobUrl

    document.body.appendChild(iframe)
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.error('Print iframe error:', e)
          window.open(blobUrl, '_blank')
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe)
          } catch (_) {}
          window.URL.revokeObjectURL(blobUrl)
        }, 3000)
      }, 300)
    }
  } catch (err: any) {
    console.error('Print error:', err)
    alert('Failed to print statement: ' + (err.message || 'Unknown error'))
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
