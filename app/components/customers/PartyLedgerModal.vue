<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[650] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        @click="closeModal"
      ></div>

      <!-- Modal Container -->
      <div
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-hidden flex flex-col border border-gray-100 z-10"
      >
        <!-- Header -->
        <div class="px-5 sm:px-6 py-4 bg-[#171717] text-white flex items-center justify-between shrink-0 border-b border-gray-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base sm:text-lg font-bold text-white">Party Ledger Statement</h3>
                <span v-if="ledgerData?.party?.isDualRole" class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  🔄 Dual Account
                </span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Tally Synchronized
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5 truncate max-w-sm sm:max-w-md">
                {{ ledgerData?.party?.name || customer?.company || customer?.name }} &bull; Period: {{ ledgerData?.period?.display || 'Current FY' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Download PDF Button -->
            <button
              type="button"
              @click="downloadPdf"
              :disabled="isLoading || isExporting"
              class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Loader2 v-if="isExporting && exportAction === 'pdf'" class="w-3.5 h-3.5 animate-spin" />
              <FileDown v-else class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Download</span> PDF
            </button>

            <!-- Print Button -->
            <button
              type="button"
              @click="printLedger"
              :disabled="isLoading || isExporting"
              class="hidden sm:flex px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Loader2 v-if="isExporting && exportAction === 'print'" class="w-3.5 h-3.5 animate-spin" />
              <Printer v-else class="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <!-- Close Modal -->
            <button
              @click="closeModal"
              class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Controls / Date Filter Bar -->
        <div class="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div class="flex items-center gap-2 text-gray-600">
            <span class="font-bold text-gray-700">Financial Period:</span>
            <input
              v-model="fromDate"
              type="text"
              placeholder="1-Apr-26"
              class="w-24 px-2 py-1 bg-white border border-gray-300 rounded font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <span class="text-gray-400">to</span>
            <input
              v-model="toDate"
              type="text"
              placeholder="31-Oct-26"
              class="w-24 px-2 py-1 bg-white border border-gray-300 rounded font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              @click="fetchLedger"
              class="px-2.5 py-1 bg-[#1b3b5f] hover:bg-[#132c49] text-white font-semibold rounded text-[11px] transition-colors cursor-pointer"
            >
              Apply Filter
            </button>
          </div>

          <!-- Zoom & Fit Controls -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-mono font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 px-2 py-0.5 rounded border border-[#1b3b5f]/20">
              {{ Math.round(zoomScale * 100) }}%
            </span>
            <button
              type="button"
              @click="zoomOut"
              :disabled="zoomScale <= 0.4"
              class="p-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-40 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              @click="setZoom(1.0)"
              class="px-2 py-1 rounded text-[11px] font-bold"
              :class="zoomScale === 1.0 ? 'bg-[#1b3b5f] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            >
              100%
            </button>
            <button
              type="button"
              @click="zoomIn"
              :disabled="zoomScale >= 1.5"
              class="p-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-40 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Body / Printable A4 Preview Container -->
        <div class="p-4 sm:p-6 overflow-auto flex-1 bg-slate-200/90 text-center">
          <div v-if="isLoading" class="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
            <p class="text-xs font-semibold">Generating party ledger statement...</p>
          </div>

          <div v-else-if="error" class="py-16 text-center text-red-600 space-y-2">
            <AlertCircle class="w-8 h-8 mx-auto text-red-500" />
            <p class="font-bold text-sm">{{ error }}</p>
            <button
              @click="fetchLedger"
              class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-semibold"
            >
              Retry
            </button>
          </div>

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

                      <!-- Subtotal / Carried Over (if multiple pages or summary) -->
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
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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

const currentFormattedTimestamp = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
})

function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0.00'
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function zoomIn() {
  if (zoomScale.value < 1.5) zoomScale.value = Math.min(1.5, Math.round((zoomScale.value + 0.1) * 10) / 10)
}

function zoomOut() {
  if (zoomScale.value > 0.4) zoomScale.value = Math.max(0.4, Math.round((zoomScale.value - 0.1) * 10) / 10)
}

function setZoom(val: number) {
  zoomScale.value = val
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
    error.value = err.data?.statusMessage || err.message || 'Failed to load ledger data.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [props.isOpen, props.customer],
  ([open, cust]) => {
    if (open && cust) {
      fetchLedger()
    }
  },
  { immediate: true }
)

const closeModal = () => {
  emit('close')
}

// PDF Download
const downloadPdf = async () => {
  if (!printableSheetRef.value || isExporting.value) return
  isExporting.value = true
  exportAction.value = 'pdf'

  try {
    const el = printableSheetRef.value
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
    pdf.save(`Ledger-${safePartyName}-${toDate.value}.pdf`)
  } catch (err: any) {
    console.error('PDF generation error:', err)
  } finally {
    isExporting.value = false
    exportAction.value = null
  }
}

// Print Ledger via hidden iframe
const printLedger = async () => {
  if (!printableSheetRef.value || isExporting.value) return
  isExporting.value = true
  exportAction.value = 'print'

  try {
    const el = printableSheetRef.value
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
