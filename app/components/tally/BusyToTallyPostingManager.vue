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
          <div class="text-[10px] font-bold uppercase tracking-wider text-amber-700">Unposted in Tally</div>
          <div class="text-lg font-black text-amber-900 mt-0.5">{{ unpostedCount }}</div>
        </div>
        <div class="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
          <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Posted in Tally</div>
          <div class="text-lg font-black text-emerald-900 mt-0.5">{{ postedCount }}</div>
        </div>
        <div class="bg-white p-3 rounded-xl border border-indigo-200/80 shadow-2xs bg-gradient-to-br from-white to-indigo-50/30">
          <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Known Tally Ledgers</div>
          <div class="text-lg font-black text-indigo-900 mt-0.5">
            {{ availableTallyDebtors.length + availableTallyCreditors.length }}
          </div>
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
            placeholder="Search by invoice number or party name..."
            class="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <!-- Transaction Type & Status Filters -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- Status Tabs -->
          <div class="flex p-0.5 bg-slate-100 rounded-lg text-xs font-bold text-gray-600">
            <button 
              type="button"
              @click="statusFilter = 'all'"
              class="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              :class="statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              All
            </button>
            <button 
              type="button"
              @click="statusFilter = 'unposted'"
              class="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              :class="statusFilter === 'unposted' ? 'bg-white text-amber-800 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              Unposted ({{ unpostedCount }})
            </button>
            <button 
              type="button"
              @click="statusFilter = 'posted'"
              class="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              :class="statusFilter === 'posted' ? 'bg-white text-emerald-800 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              Posted ({{ postedCount }})
            </button>
          </div>

          <!-- Custom Polished Voucher Type Selector (Sales vs Purchase) -->
          <div class="relative" ref="typeDropdownRef">
            <button
              type="button"
              @click="isTypeDropdownOpen = !isTypeDropdownOpen"
              class="px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-300 bg-white text-gray-800 hover:border-indigo-400 hover:bg-slate-50 shadow-2xs transition-all flex items-center gap-2 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <ShoppingCart v-if="selectedType === 'sales'" class="w-3.5 h-3.5 text-indigo-600" />
              <ShoppingBag v-else-if="selectedType === 'purchase'" class="w-3.5 h-3.5 text-emerald-600" />
              <Layers v-else class="w-3.5 h-3.5 text-slate-600" />
              <span>{{ selectedTypeLabel }}</span>
              <ChevronDown class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" :class="{ 'rotate-180': isTypeDropdownOpen }" />
            </button>

            <!-- Dropdown Menu -->
            <div 
              v-if="isTypeDropdownOpen"
              class="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
            >
              <div class="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                Transaction Type
              </div>

              <!-- Sales Option -->
              <button
                type="button"
                @click="setTypeFilter('sales')"
                class="w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                :class="selectedType === 'sales' ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-slate-50'"
              >
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <ShoppingCart class="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span class="block">Sales Invoices</span>
                    <span class="text-[10px] font-normal text-gray-500">Debtors & Outward GST</span>
                  </div>
                </div>
                <Check v-if="selectedType === 'sales'" class="w-4 h-4 text-indigo-600" />
              </button>

              <!-- Purchase Option -->
              <button
                type="button"
                @click="setTypeFilter('purchase')"
                class="w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                :class="selectedType === 'purchase' ? 'bg-emerald-50 text-emerald-900' : 'text-gray-700 hover:bg-slate-50'"
              >
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShoppingBag class="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span class="block">Purchase Invoices</span>
                    <span class="text-[10px] font-normal text-gray-500">Creditors & Inward GST</span>
                  </div>
                </div>
                <Check v-if="selectedType === 'purchase'" class="w-4 h-4 text-emerald-600" />
              </button>

              <!-- All Option -->
              <div class="border-t border-gray-100 my-1"></div>
              <button
                type="button"
                @click="setTypeFilter('all')"
                class="w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                :class="selectedType === 'all' ? 'bg-slate-100 text-gray-900' : 'text-gray-700 hover:bg-slate-50'"
              >
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Layers class="w-3.5 h-3.5" />
                  </div>
                  <span>All (Sales & Purchase)</span>
                </div>
                <Check v-if="selectedType === 'all'" class="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Vouchers Table -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="isLoading && vouchers.length === 0" class="py-16 text-center">
          <Loader2 class="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <span class="text-xs text-gray-500 font-medium">Loading BUSY vouchers & verifying Tally sync...</span>
        </div>

        <div v-else-if="filteredVouchers.length === 0" class="py-16 text-center text-gray-400 text-xs">
          No vouchers match the selected filter criteria.
        </div>

        <table v-else class="w-full text-left text-xs">
          <thead class="sticky top-0 bg-slate-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-500 tracking-wider z-10">
            <tr>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Voucher No</th>
              <th class="px-4 py-3">Type</th>
              <th class="px-4 py-3">Party (BUSY)</th>
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
              class="hover:bg-slate-50/70 transition-colors"
              :class="{ 'bg-emerald-50/20': v.isPosted }"
            >
              <!-- Date -->
              <td class="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                {{ v.displayDate }}
              </td>

              <!-- Voucher No -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="font-bold text-gray-900 font-mono">{{ v.voucherNo }}</span>
              </td>

              <!-- Type Badge -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span 
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                  :class="v.voucherType === 'Purchase' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'"
                >
                  <ShoppingBag v-if="v.voucherType === 'Purchase'" class="w-3 h-3" />
                  <ShoppingCart v-else class="w-3 h-3" />
                  {{ v.voucherType }}
                </span>
              </td>

              <!-- BUSY Customer/Supplier with Narration preview -->
              <td class="px-4 py-3">
                <div class="font-bold text-gray-900 truncate max-w-[200px]" :title="v.customerName">
                  {{ v.customerName }}
                </div>
                <div class="text-[10px] text-gray-400 truncate max-w-[200px]" :title="v.narration">
                  {{ v.narration }}
                </div>
              </td>

              <!-- Tally Party Link / Suggestion -->
              <td class="px-4 py-3">
                <div v-if="v.isMapped" class="flex items-center gap-1.5 text-emerald-700 font-semibold truncate max-w-[190px]">
                  <Check class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span class="truncate" :title="v.mappedTallyParty">{{ v.mappedTallyParty }}</span>
                </div>
                <div v-else class="flex items-center gap-1.5 text-gray-600 truncate max-w-[190px]">
                  <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 shrink-0">Auto</span>
                  <span class="truncate font-medium text-gray-800" :title="v.suggestedTallyParty">{{ v.suggestedTallyParty }}</span>
                </div>
              </td>

              <!-- Taxable -->
              <td class="px-4 py-3 text-right font-mono text-gray-600 whitespace-nowrap">
                ₹{{ v.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>

              <!-- GST (CGST+SGST+IGST) -->
              <td class="px-4 py-3 text-right font-mono text-gray-600 whitespace-nowrap">
                ₹{{ (v.cgstAmount + v.sgstAmount + v.igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>

              <!-- Total -->
              <td class="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                ₹{{ v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>

              <!-- Status -->
              <td class="px-4 py-3 text-center whitespace-nowrap">
                <span 
                  v-if="v.isPosted"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"
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
      :available-tally-creditors="availableTallyCreditors"
      :available-voucher-types="availableVoucherTypes"
      @close="isReviewModalOpen = false"
      @posted="onVoucherPosted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Layers,
  X,
  RefreshCw,
  Search,
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  ShoppingCart,
  ShoppingBag,
  ChevronDown
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
const availableTallyCreditors = ref<string[]>([])
const availableVoucherTypes = ref<string[]>(['Sales', 'Purchase'])

const searchQuery = ref('')
const selectedType = ref<'sales' | 'purchase' | 'all'>('sales')
const isTypeDropdownOpen = ref(false)
const statusFilter = ref<'all' | 'unposted' | 'posted'>('all')

const isReviewModalOpen = ref(false)
const selectedVoucher = ref<PreparedVoucherItem | null>(null)

// Dropdown label
const selectedTypeLabel = computed(() => {
  if (selectedType.value === 'sales') return 'Sales'
  if (selectedType.value === 'purchase') return 'Purchase'
  return 'All Types'
})

const setTypeFilter = (type: 'sales' | 'purchase' | 'all') => {
  selectedType.value = type
  isTypeDropdownOpen.value = false
  fetchVouchers()
}

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

    // Status
    if (statusFilter.value === 'unposted' && v.isPosted) return false
    if (statusFilter.value === 'posted' && !v.isPosted) return false

    return true
  })
})

// Fetch vouchers based on selected type
const fetchVouchers = async () => {
  isLoading.value = true
  try {
    const res = await $fetch<any>('/api/tally/vouchers', {
      query: { type: selectedType.value }
    })
    if (Array.isArray(res?.vouchers)) {
      vouchers.value = res.vouchers
    }
  } catch (err) {
    console.error('Failed fetching vouchers:', err)
  } finally {
    isLoading.value = false
  }
}

// Fetch all initial data
const refreshData = async () => {
  isLoading.value = true
  try {
    const [statusRes, ledgersRes, vouchersRes] = await Promise.all([
      $fetch<any>('/api/tally/status').catch(() => ({ online: false, port: 9000 })),
      $fetch<any>('/api/tally/ledgers').catch(() => ({ debtors: [], creditors: [], voucherTypes: ['Sales', 'Purchase'] })),
      $fetch<any>('/api/tally/vouchers', { query: { type: selectedType.value } }).catch(() => ({ vouchers: [] }))
    ])

    tallyStatus.value = statusRes

    if (Array.isArray(ledgersRes?.debtors)) {
      availableTallyDebtors.value = ledgersRes.debtors
    }
    if (Array.isArray(ledgersRes?.creditors)) {
      availableTallyCreditors.value = ledgersRes.creditors
    }
    if (Array.isArray(ledgersRes?.voucherTypes) && ledgersRes.voucherTypes.length > 0) {
      availableVoucherTypes.value = ledgersRes.voucherTypes
    }

    if (Array.isArray(vouchersRes?.vouchers)) {
      vouchers.value = vouchersRes.vouchers
    }
  } catch (err) {
    console.error('Failed refreshing data:', err)
  } finally {
    isLoading.value = false
  }
}

// Open Review Modal
const openReviewModal = (v: PreparedVoucherItem) => {
  selectedVoucher.value = v
  isReviewModalOpen.value = true
}

// Callback when voucher is posted
const onVoucherPosted = (vchNo: string) => {
  const target = vouchers.value.find(v => v.voucherNo === vchNo)
  if (target) {
    target.isPosted = true
    target.postedAt = new Date().toISOString()
  }
}

const close = () => {
  emit('close')
}

watch(() => props.isOpen, (open) => {
  if (open) {
    refreshData()
  }
})

onMounted(() => {
  if (props.isOpen) {
    refreshData()
  }
})
</script>
