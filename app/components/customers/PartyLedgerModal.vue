<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[650] flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-hidden"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        @click="closeModal"
      ></div>

      <!-- Modal Container -->
      <div
        class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[94vh] overflow-hidden flex flex-col border border-gray-100 z-10"
      >
        <!-- Modern Dark Header -->
        <div class="px-4 sm:px-6 py-3 sm:py-4 bg-[#171717] text-white flex items-center justify-between shrink-0 border-b border-gray-800">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h3 class="text-sm sm:text-lg font-bold text-white truncate">Party Ledger Statement</h3>
                <span v-if="ledgerData?.party?.isDualRole" class="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  Dual Role
                </span>
                <span class="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Tally Synced
                </span>
              </div>
              <p class="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">
                {{ ledgerData?.party?.name || customer?.company || customer?.name }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <!-- Desktop Print Button -->
            <button
              type="button"
              @click="printLedger"
              :disabled="isLoading || isExporting"
              class="hidden sm:flex px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Print Ledger"
            >
              <Loader2 v-if="isExporting && exportAction === 'print'" class="w-3.5 h-3.5 animate-spin" />
              <Printer v-else class="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <!-- Download PDF Button (Desktop Header) -->
            <button
              type="button"
              @click="downloadPdf"
              :disabled="isLoading || isExporting"
              class="hidden sm:flex px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Loader2 v-if="isExporting && exportAction === 'pdf'" class="w-3.5 h-3.5 animate-spin" />
              <FileDown v-else class="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <!-- Close Modal Button -->
            <button
              @click="closeModal"
              class="p-1.5 sm:p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Controls / Date Filter & View Switcher Bar -->
        <div class="px-3 sm:px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs shrink-0">
          <!-- Date Filter Row -->
          <div class="flex items-center gap-1.5 sm:gap-2 text-gray-600 justify-between sm:justify-start">
            <span class="font-bold text-gray-700 text-[11px] sm:text-xs">Period:</span>
            <div class="flex items-center gap-1">
              <input
                v-model="fromDate"
                type="text"
                placeholder="1-Apr-26"
                class="w-20 sm:w-24 px-1.5 sm:px-2 py-1 bg-white border border-gray-300 rounded font-mono text-[11px] sm:text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-center"
              />
              <span class="text-gray-400 text-xs">-</span>
              <input
                v-model="toDate"
                type="text"
                placeholder="31-Oct-26"
                class="w-20 sm:w-24 px-1.5 sm:px-2 py-1 bg-white border border-gray-300 rounded font-mono text-[11px] sm:text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-center"
              />
            </div>
            <button
              type="button"
              @click="fetchLedger"
              class="px-2.5 py-1 bg-[#1b3b5f] hover:bg-[#132c49] text-white font-semibold rounded text-[11px] transition-colors cursor-pointer shrink-0"
            >
              Filter
            </button>
          </div>

          <!-- Mobile View Switcher & Zoom Controls -->
          <div class="flex items-center justify-between sm:justify-end gap-2">
            <!-- Mobile View Switcher (Feed vs A4 Preview) -->
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

            <!-- Zoom & Fit Controls (Only relevant in A4 slip mode) -->
            <div v-show="mobileViewMode === 'slip' || isDesktop" class="flex items-center gap-1">
              <span class="text-[10px] sm:text-xs font-mono font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 px-1.5 sm:px-2 py-0.5 rounded border border-[#1b3b5f]/20">
                {{ Math.round(zoomScale * 100) }}%
              </span>
              <button
                type="button"
                @click="zoomOut"
                :disabled="zoomScale <= 0.35"
                class="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-40 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="setZoom('fit')"
                class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition cursor-pointer"
                :class="zoomScale === fitScale ? 'bg-[#1b3b5f] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
              >
                Fit
              </button>
              <button
                type="button"
                @click="setZoom(1.0)"
                class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition cursor-pointer"
                :class="zoomScale === 1.0 ? 'bg-[#1b3b5f] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
              >
                100%
              </button>
              <button
                type="button"
                @click="zoomIn"
                :disabled="zoomScale >= 1.6"
                class="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-40 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Main Body Area -->
        <div class="overflow-y-auto overflow-x-hidden flex-1 bg-slate-100 p-2 sm:p-6 pb-20 sm:pb-6 text-center -webkit-overflow-scrolling-touch">
          <!-- Loading State -->
          <div v-if="isLoading" class="py-24 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
            <p class="text-xs font-semibold">Generating party ledger statement...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="py-16 text-center text-red-600 space-y-3 px-4">
            <AlertCircle class="w-8 h-8 mx-auto text-red-500" />
            <p class="font-bold text-sm">{{ error }}</p>
            <p class="text-xs text-gray-500 max-w-sm mx-auto">
              Please verify that this customer exists in Tally and that the sync agent has updated recent records.
            </p>
            <button
              @click="fetchLedger"
              class="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition"
            >
              Retry
            </button>
          </div>

          <!-- Content: Mobile Cards Feed (When active on mobile) -->
          <div
            v-else-if="mobileViewMode === 'list' && !isDesktop"
            class="space-y-3 text-left max-w-lg mx-auto"
          >
            <!-- Net Balance Highlight Card -->
            <div class="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Net Ledger Balance</span>
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  :class="ledgerData?.totals?.closingBalanceType === 'Dr' 
                    ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'"
                >
                  {{ ledgerData?.totals?.closingBalanceType === 'Dr' ? 'RECEIVABLE' : 'ADVANCE / PAYABLE' }}
                </span>
              </div>
              <div class="flex items-baseline justify-between">
                <div class="text-2xl font-black text-gray-950 font-mono">
                  ₹{{ formatIndianNumber(ledgerData?.totals?.closingBalance || 0) }}
                </div>
                <div class="text-right text-[11px] text-gray-500 font-mono">
                  Period: {{ ledgerData?.period?.display }}
                </div>
              </div>

              <!-- Quick Totals Mini Grid -->
              <div class="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span class="text-[10px] text-gray-500 block">Total Debits (Sales)</span>
                  <span class="font-bold font-mono text-[#1b3b5f]">₹{{ formatIndianNumber(ledgerData?.totals?.totalDebit || 0) }}</span>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span class="text-[10px] text-gray-500 block">Total Credits (Paid)</span>
                  <span class="font-bold font-mono text-emerald-700">₹{{ formatIndianNumber(ledgerData?.totals?.totalCredit || 0) }}</span>
                </div>
              </div>
            </div>

            <!-- Transaction Items Cards -->
            <div class="space-y-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-xs font-bold text-gray-700">Transactions ({{ ledgerData?.transactions?.length || 0 }})</span>
                <span class="text-[11px] text-gray-400">Chronological</span>
              </div>

              <div
                v-for="(row, idx) in ledgerData?.transactions || []"
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

          <!-- Content: Strict A4 Printable Canvas (Always accessible on desktop and via 'A4 Slip' tab on mobile) -->
          <div
            v-else
            :style="{
              width: `${Math.round(794 * zoomScale)}px`,
              minHeight: `${Math.round(1123 * zoomScale)}px`
            }"
            class="relative mx-auto text-left inline-block"
          >
            <!-- Strict A4 Printable Sheet (794px width) -->
            <div
              ref="printableSheetRef"
              :style="{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left',
                width: '794px'
              }"
              class="absolute left-0 top-0 shadow-2xl rounded-xl overflow-hidden bg-white min-h-[1123px] flex flex-col justify-between text-left antialiased text-gray-900 font-sans"
              style="-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision;"
            >
              <div class="p-8 sm:p-10 space-y-5">
                <!-- Top Brand Line -->
                <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1b3b5f] rounded-full"></div>

                <!-- Company Header -->
                <div class="text-center space-y-1 pb-3 border-b border-gray-200">
                  <h1 class="text-xl font-black text-[#1b3b5f] tracking-wide uppercase">
                    {{ ledgerData?.company?.name || 'SRI LAKSHMI PLYWOODS' }}
                  </h1>
                  <p class="text-xs font-semibold text-gray-600">
                    {{ ledgerData?.company?.tradeName || 'Trade Name : Silicon Marketing' }}
                  </p>
                  <p class="text-[11px] text-gray-500 whitespace-pre-line leading-relaxed max-w-lg mx-auto">
                    {{ ledgerData?.company?.address }}
                  </p>
                </div>

                <!-- Party Title & Details -->
                <div class="text-center space-y-1 pb-2">
                  <h2 class="text-base font-bold text-gray-950 uppercase tracking-tight">
                    {{ ledgerData?.party?.name }}
                  </h2>
                  <div class="inline-block px-3 py-0.5 rounded-full bg-slate-100 text-[#1b3b5f] font-bold text-xs uppercase tracking-wider">
                    Ledger Account
                  </div>
                  <div v-if="ledgerData?.party?.addressLines?.length" class="text-xs text-gray-600 pt-1 leading-snug">
                    <p v-for="(line, idx) in ledgerData.party.addressLines" :key="idx">{{ line }}</p>
                  </div>
                  <div v-if="ledgerData?.party?.phone" class="text-xs font-medium text-gray-600">
                    <span>Contact: {{ ledgerData.party.phone }}</span>
                  </div>
                  <div class="pt-2">
                    <span class="inline-block px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-bold">
                      Period: {{ ledgerData?.period?.display }}
                    </span>
                  </div>
                </div>

                <!-- Ledger Table -->
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
                      <tr
                        v-for="(row, idx) in ledgerData?.transactions || []"
                        :key="idx"
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

                      <!-- Subtotal Row -->
                      <tr class="bg-gray-50 border-t-2 border-gray-300 font-bold text-[11px]">
                        <td colspan="4" class="py-2 px-3 text-right uppercase tracking-wider text-gray-700">
                          Totals
                        </td>
                        <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">
                          {{ formatIndianNumber(ledgerData?.totals?.totalDebit || 0) }}
                        </td>
                        <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">
                          {{ formatIndianNumber(ledgerData?.totals?.totalCredit || 0) }}
                        </td>
                      </tr>

                      <!-- Closing Balance Row -->
                      <tr v-if="ledgerData?.totals?.closingBalance" class="bg-amber-50/50 font-bold text-[11px]">
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
                          <span v-if="ledgerData.totals.closingBalanceType === 'Cr'">
                            {{ formatIndianNumber(ledgerData.totals.closingBalance) }}
                          </span>
                        </td>
                        <td class="py-2 px-3 text-right font-mono text-gray-900 tabular-nums">
                          <span v-if="ledgerData.totals.closingBalanceType === 'Dr'">
                            {{ formatIndianNumber(ledgerData.totals.closingBalance) }}
                          </span>
                        </td>
                      </tr>

                      <!-- Grand Balanced Total (Double Underline Standard) -->
                      <tr class="bg-[#1b3b5f]/5 border-t-2 border-b-4 border-double border-gray-400 font-black text-xs">
                        <td colspan="4" class="py-2.5 px-3 text-right uppercase tracking-widest text-[#1b3b5f]">
                          Grand Total
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-[#1b3b5f] tabular-nums">
                          ₹{{ formatIndianNumber(ledgerData?.totals?.balancedTotal || 0) }}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-[#1b3b5f] tabular-nums">
                          ₹{{ formatIndianNumber(ledgerData?.totals?.balancedTotal || 0) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Outstanding Summary Box -->
                <div class="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div class="space-y-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Net Ledger Status:</span>
                    <div class="flex items-center gap-2">
                      <span
                        class="text-sm font-black px-2.5 py-0.5 rounded-lg border"
                        :class="ledgerData?.totals?.closingBalanceType === 'Dr' 
                          ? 'bg-amber-100 text-amber-900 border-amber-300' 
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'"
                      >
                        {{ ledgerData?.totals?.closingBalanceType === 'Dr' ? 'RECEIVABLE FROM PARTY' : 'ADVANCE / PAYABLE TO PARTY' }}
                      </span>
                      <strong class="text-sm font-mono font-bold text-gray-900">
                        ₹{{ formatIndianNumber(ledgerData?.totals?.closingBalance || 0) }}
                      </strong>
                    </div>
                  </div>

                  <div class="text-right text-[11px] text-gray-500 space-y-0.5">
                    <p>Computer-generated statement of accounts.</p>
                    <p class="font-mono text-[10px] text-gray-400">Generated: {{ currentFormattedTimestamp }}</p>
                  </div>
                </div>
              </div>

              <!-- Page Footer Branding -->
              <div class="p-6 bg-slate-50 border-t border-gray-200 text-center text-[10px] text-gray-400">
                <span>Silicon Marketing Order Management System &bull; Official Tally Statement of Account</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Mobile Bottom Bar (Always visible on mobile) -->
        <div class="sm:hidden p-3 bg-white border-t border-gray-200 shadow-lg flex items-center gap-2.5 shrink-0 z-20">
          <div class="flex-1 min-w-0">
            <span class="text-[9px] uppercase tracking-wider text-gray-400 block font-bold">Net Balance</span>
            <div class="text-xs font-mono font-black text-gray-900 truncate">
              ₹{{ formatIndianNumber(ledgerData?.totals?.closingBalance || 0) }}
              <span class="text-[10px] text-amber-700">({{ ledgerData?.totals?.closingBalanceType || 'Dr' }})</span>
            </div>
          </div>

          <button
            type="button"
            @click="downloadPdf"
            :disabled="isLoading || isExporting"
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
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  X,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'

const props = defineProps<{
  isOpen: boolean
  customer: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isLoading = ref(false)
const isExporting = ref(false)
const exportAction = ref<'pdf' | 'print' | null>(null)
const error = ref<string | null>(null)
const ledgerData = ref<any>(null)
const printableSheetRef = ref<HTMLElement | null>(null)

const fromDate = ref('1-Apr-26')
const toDate = ref('31-Oct-26')
const zoomScale = ref(0.95)
const fitScale = ref(0.95)
const mobileViewMode = ref<'list' | 'slip'>('list')
const isDesktop = ref(false)

const currentFormattedTimestamp = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
})

function updateResponsiveScales() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  isDesktop.value = w >= 640

  if (w < 640) {
    const targetW = w - 24
    fitScale.value = Math.max(0.35, Math.min(1.0, Math.round((targetW / 794) * 100) / 100))
    // On mobile, if in slip view and at default scale, snap to fit
    if (zoomScale.value === 0.95 || zoomScale.value > fitScale.value * 1.5) {
      zoomScale.value = fitScale.value
    }
  } else {
    fitScale.value = Math.max(0.7, Math.min(1.2, Math.round(((w - 120) / 794) * 100) / 100))
    zoomScale.value = 0.95
  }
}

function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0.00'
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
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

const fetchLedger = async () => {
  if (!props.customer?.id) return
  isLoading.value = true
  error.value = null

  try {
    const res = await $fetch<any>(`/api/customers/${props.customer.id}/ledger`, {
      params: {
        from: fromDate.value,
        to: toDate.value
      }
    })
    ledgerData.value = res
  } catch (err: any) {
    console.error('Ledger fetch error:', err)
    error.value = err.data?.statusMessage || err.data?.message || err.message || 'Failed to load ledger data.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [props.isOpen, props.customer],
  ([open, cust]) => {
    if (open && cust) {
      updateResponsiveScales()
      fetchLedger()
    }
  },
  { immediate: true }
)

onMounted(() => {
  updateResponsiveScales()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateResponsiveScales)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateResponsiveScales)
  }
})

const closeModal = () => {
  emit('close')
}

// PDF Download
const downloadPdf = async () => {
  if (isExporting.value) return
  isExporting.value = true
  exportAction.value = 'pdf'

  try {
    // If on mobile list view, switch temporarily or ensure printableSheetRef exists
    const prevMode = mobileViewMode.value
    if (!isDesktop.value && mobileViewMode.value === 'list') {
      mobileViewMode.value = 'slip'
      await new Promise(r => setTimeout(r, 100))
    }

    const el = printableSheetRef.value
    if (!el) throw new Error('Preview element not ready')

    // Guarantee fonts are settled
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready
    }

    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      quality: 0.95,
      backgroundColor: '#ffffff'
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    })

    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()

    pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST')

    const safePartyName = (ledgerData.value?.party?.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Ledger-${safePartyName}-${toDate.value}.pdf`

    // Native Capacitor / Android bridge integration if on mobile app
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
    const el = printableSheetRef.value
    if (!el) throw new Error('Preview element not ready')

    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      quality: 0.95,
      backgroundColor: '#ffffff'
    })

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
          <title>Party Ledger Account</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: flex-start; }
            img { width: 100%; height: auto; max-width: 100vw; display: block; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print();" />
        </body>
        </html>
      `)
      iframeDoc.close()
    }

    setTimeout(() => {
      try {
        document.body.removeChild(iframe)
      } catch (_) {}
    }, 2000)
  } catch (err: any) {
    console.error('Print error:', err)
  } finally {
    isExporting.value = false
    exportAction.value = null
  }
}
</script>
