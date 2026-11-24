<template>
  <div v-if="isOpen" class="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" @click="close"></div>

    <!-- Main Container -->
    <div class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Layers class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <h2 class="text-lg font-black text-gray-950 tracking-tight">
                BUSY to Tally Prime Voucher Posting
              </h2>
              <!-- Tally Connection Indicator -->
              <span 
                v-if="tallyStatus?.online"
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Tally Online (Port {{ tallyStatus.port }})
              </span>
              <span 
                v-else
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200"
              >
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                Tally Offline (Port 9000)
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Connected Company: <span class="font-bold text-gray-800">{{ tallyStatus?.company || 'SRI LAKSHMI PLYWOODS 2627' }}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-center">
          <button 
            @click="refreshData" 
            :disabled="isLoading"
            class="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span>Refresh</span>
          </button>
          
          <button 
            @click="close" 
            class="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-slate-50/50 border-b border-gray-200 shrink-0 text-xs">
        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
          <div class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total Vouchers</div>
          <div class="text-lg font-black text-gray-900 mt-0.5">{{ totalCount }}</div>
        </div>
        <div class="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs bg-gradient-to-br from-white to-amber-50/30">
          <div class="text-[10px] font-bold uppercase tracking-wider text-amber-700">Unposted Vouchers</div>
          <div class="text-lg font-black text-amber-900 mt-0.5">{{ unpostedCount }}</div>
        </div>
        <div class="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
          <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Posted to Tally</div>
          <div class="text-lg font-black text-emerald-900 mt-0.5">{{ postedCount }}</div>
        </div>
        <div class="bg-white p-3 rounded-xl border border-indigo-200/80 shadow-2xs bg-gradient-to-br from-white to-indigo-50/30">
          <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Known Tally Debtors</div>
          <div class="text-lg font-black text-indigo-900 mt-0.5">{{ availableTallyDebtors.length }}</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="p-4 sm:px-6 bg-white border-b border-gray-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <!-- Search Input -->
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            v-model="searchQuery"
            placeholder="Search by invoice number or customer name..."
            class="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <!-- Series & Status Filters -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Status Tabs -->
          <div class="flex p-0.5 bg-slate-100 rounded-lg text-xs font-bold text-gray-600">
            <button 
              type="button"
              @click="statusFilter = 'all'"
              class="px-2.5 py-1 rounded-md transition-colors"
              :class="statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              All
            </button>
            <button 
              type="button"
              @click="statusFilter = 'unposted'"
              class="px-2.5 py-1 rounded-md transition-colors"
              :class="statusFilter === 'unposted' ? 'bg-white text-amber-800 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              Unposted ({{ unpostedCount }})
            </button>
            <button 
              type="button"
              @click="statusFilter = 'posted'"
              class="px-2.5 py-1 rounded-md transition-colors"
              :class="statusFilter === 'posted' ? 'bg-white text-emerald-800 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              Posted ({{ postedCount }})
            </button>
          </div>

          <!-- Series Selector -->
          <select 
            v-model="seriesFilter"
            class="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white outline-none"
          >
            <option value="">All Series</option>
            <option value="SMG">SMG (Wholesale)</option>
            <option value="RETAIL">RETAIL</option>
          </select>
        </div>
      </div>

      <!-- Vouchers Table -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="isLoading && vouchers.length === 0" class="py-16 text-center">
          <Loader2 class="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <span class="text-xs text-gray-500 font-medium">Loading BUSY vouchers & Tally mappings...</span>
        </div>

        <div v-else-if="filteredVouchers.length === 0" class="py-16 text-center text-gray-400 text-xs">
          No vouchers match the selected filter criteria.
        </div>

        <table v-else class="w-full text-left text-xs">
          <thead class="sticky top-0 bg-slate-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-500 tracking-wider z-10">
            <tr>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Voucher No</th>
              <th class="px-4 py-3">BUSY Customer</th>
              <th class="px-4 py-3">Tally Party Link</th>
              <th class="px-4 py-3 text-right">Taxable</th>
              <th class="px-4 py-3 text-right">GST</th>
              <th class="px-4 py-3 text-right">Total (₹)</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr 
              v-for="v in filteredVouchers" 
              :key="v.id"
              class="hover:bg-indigo-50/30 transition-colors"
              :class="{ 'bg-emerald-50/15': v.isPosted }"
            >
              <td class="px-4 py-3 text-gray-600 whitespace-nowrap">{{ v.displayDate }}</td>
              
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold font-mono text-gray-900">{{ v.voucherNo }}</span>
                  <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {{ v.series }}
                  </span>
                </div>
              </td>

              <td class="px-4 py-3 font-semibold text-gray-900 max-w-[200px] truncate" :title="v.customerName">
                {{ v.customerName }}
              </td>

              <!-- Tally Party Link Status -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-1 max-w-[220px]">
                  <span 
                    v-if="v.isMapped" 
                    class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 truncate"
                    :title="`Linked to: ${v.mappedTallyParty}`"
                  >
                    <Check class="w-3 h-3 text-emerald-600 shrink-0" />
                    <span class="truncate">{{ v.mappedTallyParty }}</span>
                  </span>
                  <span 
                    v-else
                    class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 truncate"
                    :title="`Suggested match: ${v.suggestedTallyParty}`"
                  >
                    <span class="text-amber-500 shrink-0">⚠️</span>
                    <span class="truncate">{{ v.suggestedTallyParty }}</span>
                  </span>
                </div>
              </td>

              <!-- Taxable -->
              <td class="px-4 py-3 text-right font-mono text-gray-600 whitespace-nowrap">
                ₹{{ v.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>

              <!-- GST (CGST+SGST or IGST) -->
              <td class="px-4 py-3 text-right font-mono whitespace-nowrap">
                <span v-if="v.igstAmount > 0" class="text-purple-700 font-bold" title="Inter-state IGST">
                  ₹{{ v.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }} (IGST)
                </span>
                <span v-else class="text-gray-600">
                  ₹{{ (v.cgstAmount + v.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </span>
              </td>

              <!-- Grand Total -->
              <td class="px-4 py-3 text-right font-black font-mono text-gray-900 whitespace-nowrap">
                ₹{{ v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>

              <!-- Status Badge -->
              <td class="px-4 py-3 text-center whitespace-nowrap">
                <span 
                  v-if="v.isPosted"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1 w-fit mx-auto"
                >
                  <CheckCircle2 class="w-3 h-3 text-emerald-600" /> Posted
                </span>
                <span 
                  v-else
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
                >
                  Unposted
                </span>
              </td>

              <!-- Review & Post Action Button -->
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <button 
                  type="button"
                  @click="openReviewModal(v)"
                  class="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ml-auto shadow-2xs active:scale-95"
                  :class="[
                    v.isPosted 
                      ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' 
                      : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:shadow-sm'
                  ]"
                >
                  <Eye class="w-3.5 h-3.5" />
                  <span>{{ v.isPosted ? 'View / Repost' : 'Review & Post' }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bottom Bar -->
      <div class="px-6 py-3 border-t border-gray-200 bg-slate-50 flex items-center justify-between text-xs text-gray-500 shrink-0">
        <span>Showing {{ filteredVouchers.length }} vouchers</span>
        <span>Click <strong>"Review & Post"</strong> on any voucher to open the side-by-side comparison & override modal.</span>
      </div>

    </div>

    <!-- Mount Side-by-Side Review & Override Modal -->
    <BusyToTallyReviewModal
      :is-open="isReviewModalOpen"
      :voucher="selectedVoucher"
      :available-tally-debtors="availableTallyDebtors"
      :available-voucher-types="availableVoucherTypes"
      @close="isReviewModalOpen = false"
      @posted="onVoucherPosted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers,
  X,
  RefreshCw,
  Search,
  Check,
  CheckCircle2,
  Eye,
  Loader2
} from 'lucide-vue-next'
import type { PreparedVoucherItem } from '~~/server/api/tally/vouchers.get'
import BusyToTallyReviewModal from './BusyToTallyReviewModal.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// State
const isLoading = ref(false)
const vouchers = ref<PreparedVoucherItem[]>([])
const tallyStatus = ref<{ online: boolean; company?: string; port: number } | null>(null)
const availableTallyDebtors = ref<string[]>([])
const availableVoucherTypes = ref<string[]>(['Sales', 'Sales - Manual Series'])

const searchQuery = ref('')
const seriesFilter = ref('')
const statusFilter = ref<'all' | 'unposted' | 'posted'>('all')

const isReviewModalOpen = ref(false)
const selectedVoucher = ref<PreparedVoucherItem | null>(null)

// Counts
const totalCount = computed(() => vouchers.value.length)
const postedCount = computed(() => vouchers.value.filter(v => v.isPosted).length)
const unpostedCount = computed(() => vouchers.value.filter(v => !v.isPosted).length)

// Filtering
const filteredVouchers = computed(() => {
  return vouchers.value.filter(v => {
    // Search
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchNo = v.voucherNo.toLowerCase().includes(q)
      const matchCustomer = v.customerName.toLowerCase().includes(q)
      if (!matchNo && !matchCustomer) return false
    }

    // Series
    if (seriesFilter.value && v.series.toUpperCase() !== seriesFilter.value.toUpperCase()) {
      return false
    }

    // Status
    if (statusFilter.value === 'unposted' && v.isPosted) return false
    if (statusFilter.value === 'posted' && !v.isPosted) return false

    return true
  })
})

// Fetch initial data
const refreshData = async () => {
  isLoading.value = true
  try {
    const [statusRes, ledgersRes, vouchersRes] = await Promise.all([
      $fetch<any>('/api/tally/status').catch(() => ({ online: false, port: 9000 })),
      $fetch<any>('/api/tally/ledgers').catch(() => ({ debtors: [], voucherTypes: ['Sales'] })),
      $fetch<any>('/api/tally/vouchers').catch(() => ({ vouchers: [] }))
    ])

    tallyStatus.value = statusRes
    if (Array.isArray(ledgersRes?.debtors)) {
      availableTallyDebtors.value = ledgersRes.debtors
    }
    if (Array.isArray(ledgersRes?.voucherTypes)) {
      availableVoucherTypes.value = ledgersRes.voucherTypes
    }
    if (Array.isArray(vouchersRes?.vouchers)) {
      vouchers.value = vouchersRes.vouchers
    }
  } catch (err) {
    console.error('Failed fetching Tally data', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  refreshData()
})

const openReviewModal = (v: PreparedVoucherItem) => {
  selectedVoucher.value = v
  isReviewModalOpen.value = true
}

const onVoucherPosted = (voucherNo: string) => {
  const match = vouchers.value.find(v => v.voucherNo === voucherNo)
  if (match) {
    match.isPosted = true
  }
}

const close = () => {
  emit('close')
}
</script>
