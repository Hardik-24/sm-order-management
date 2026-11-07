<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[320] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      @click.self="close"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <!-- Modal Header -->
        <div class="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-white shrink-0">
          <div class="flex items-start gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center border border-[#1b3b5f]/20 shrink-0 mt-0.5">
              <History class="w-5 h-5 text-[#1b3b5f]" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base sm:text-lg font-black text-gray-900 truncate">
                  {{ productName || 'Price History' }}
                </h3>
                <span
                  v-if="productSku"
                  class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {{ productSku }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Customer / Party:</span>
                <strong class="font-bold text-[#1b3b5f]">{{ customerName || 'All Customers' }}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="close"
            class="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Summary Stats Ribbon -->
        <div
          v-if="summary && (summary.minRate || summary.avgRate || summary.maxRate)"
          class="grid grid-cols-3 gap-2 px-4 sm:px-5 pt-3.5 pb-2 shrink-0 bg-slate-50/70 border-b border-gray-100"
        >
          <div class="p-2 bg-white rounded-xl border border-gray-200/80 text-center shadow-2xs">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Lowest Rate</span>
            <span class="text-xs sm:text-sm font-black text-emerald-700 tabular-nums">
              {{ summary.minRate ? formatCurrency(summary.minRate) : '—' }}
            </span>
          </div>
          <div class="p-2 bg-blue-50/70 rounded-xl border border-blue-200/80 text-center shadow-2xs">
            <span class="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">Avg Billed Rate</span>
            <span class="text-xs sm:text-sm font-black text-[#1b3b5f] tabular-nums">
              {{ summary.avgRate ? formatCurrency(summary.avgRate) : '—' }}
            </span>
          </div>
          <div class="p-2 bg-white rounded-xl border border-gray-200/80 text-center shadow-2xs">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Highest Rate</span>
            <span class="text-xs sm:text-sm font-black text-rose-700 tabular-nums">
              {{ summary.maxRate ? formatCurrency(summary.maxRate) : '—' }}
            </span>
          </div>
        </div>

        <!-- Controls: Tabs & In-Modal Search -->
        <div class="px-4 sm:px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-gray-100 shrink-0">
          <!-- Tabs -->
          <div class="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-bold shrink-0">
            <button
              type="button"
              @click="activeTab = 'current_party'"
              class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none"
              :class="activeTab === 'current_party' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'"
            >
              <UserCheck class="w-3.5 h-3.5 text-[#1b3b5f]" />
              <span>Current Party ({{ currentPartyList.length }})</span>
            </button>
            <button
              type="button"
              @click="activeTab = 'all_parties'"
              class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none"
              :class="activeTab === 'all_parties' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'"
            >
              <Users class="w-3.5 h-3.5 text-gray-500" />
              <span>All Parties ({{ allPartiesList.length }})</span>
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative flex-1 sm:max-w-xs">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search voucher or party..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl outline-none focus:border-[#1b3b5f] transition-all"
            />
          </div>
        </div>

        <!-- Price History List -->
        <div class="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          <!-- Loading State -->
          <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 class="w-6 h-6 animate-spin text-[#1b3b5f]" />
            <span class="text-xs font-semibold">Loading price history...</span>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="filteredList.length === 0"
            class="py-12 px-4 text-center rounded-2xl bg-gray-50/80 border border-dashed border-gray-200 space-y-2"
          >
            <div class="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <FileText class="w-5 h-5 text-gray-400" />
            </div>
            <p class="text-sm font-bold text-gray-700">No previous billing records found</p>
            <p class="text-xs text-gray-500 max-w-sm mx-auto">
              {{ activeTab === 'current_party' ? `No previous invoices found for ${customerName || 'this customer'} with this item.` : 'No previous invoices found for this product across all parties.' }}
            </p>
            <button
              v-if="activeTab === 'current_party' && allPartiesList.length > 0"
              type="button"
              @click="activeTab = 'all_parties'"
              class="mt-2 text-xs font-bold text-[#1b3b5f] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View price history for All Parties ({{ allPartiesList.length }} bills) &rarr;</span>
            </button>
          </div>

          <!-- List Items -->
          <div
            v-else
            v-for="(row, idx) in filteredList"
            :key="row.id || `${row.voucherNo}-${idx}`"
            class="p-3.5 bg-gray-50/80 hover:bg-slate-100/70 border border-gray-200/90 rounded-xl flex items-center justify-between gap-3 transition-colors"
          >
            <div class="min-w-0 flex-1">
              <!-- Customer & Code -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-gray-900 text-xs sm:text-sm truncate">
                  {{ row.customerName || row.customer?.name || 'Customer' }}
                </span>
                <span
                  v-if="row.customerCode || row.customer?.customerCode"
                  class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-white text-gray-600 border border-gray-200"
                >
                  {{ row.customerCode || row.customer?.customerCode }}
                </span>
                <span
                  v-if="row.customer?.city"
                  class="text-[10px] text-gray-500 font-medium"
                >
                  ({{ row.customer.city }})
                </span>
              </div>

              <!-- Voucher details & metadata -->
              <div class="flex items-center gap-2 text-[11px] text-gray-500 mt-1 flex-wrap">
                <span class="font-medium">
                  Voucher:
                  <NuxtLink
                    v-if="row.voucherNo"
                    :to="`/dashboard/vouchers?search=${encodeURIComponent(row.voucherNo)}`"
                    target="_blank"
                    class="font-bold text-sky-700 hover:text-sky-900 font-mono underline hover:no-underline ml-0.5"
                    title="View invoice in vouchers page"
                  >
                    {{ row.voucherNo }}
                  </NuxtLink>
                  <span v-else class="font-mono text-gray-400">N/A</span>
                </span>
                <span class="text-gray-300">&bull;</span>
                <span class="tabular-nums">
                  {{ formatDateDisplay(row.voucherDate) }}
                </span>
                <span v-if="row.daysAgo !== undefined" class="text-gray-400 text-[10px]">
                  ({{ row.daysAgo }}d ago)
                </span>
                <span v-if="row.qty" class="text-gray-300">&bull;</span>
                <span v-if="row.qty" class="font-semibold text-gray-700 tabular-nums">
                  Qty: {{ row.qty }} {{ row.unit || '' }}
                </span>
              </div>
            </div>

            <!-- Rate & Action -->
            <div class="flex items-center gap-3 shrink-0 text-right">
              <div>
                <div class="text-sm sm:text-base font-black text-[#1b3b5f] tabular-nums">
                  {{ formatCurrency(row.rate || row.unitPrice || 0) }}
                </div>
                <span class="text-[9px] font-bold uppercase tracking-wider block" :class="row.isTaxInclusive ? 'text-blue-600' : 'text-gray-500'">
                  {{ row.isTaxInclusive ? 'Incl. Tax' : '+Tax' }}
                </span>
              </div>

              <button
                type="button"
                @click="applyRate(row)"
                class="px-3 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer select-none"
                title="Apply this historical rate to the order item"
              >
                <Check class="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span class="truncate">
            Showing <strong class="text-gray-800">{{ filteredList.length }}</strong> previous records
          </span>
          <button
            type="button"
            @click="close"
            class="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { History, X, UserCheck, Users, Search, Loader2, FileText, Check } from 'lucide-vue-next'
import { formatCurrency } from '~/utils/formatters'

const props = defineProps<{
  modelValue: boolean
  productId?: string | null
  productName?: string
  productSku?: string
  customerId?: string | null
  customerName?: string
  isTaxInclusive?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'apply-price', data: { rate: number; isTaxInclusive?: boolean; voucherNo?: string }): void
}>()

const activeTab = ref<'current_party' | 'all_parties'>('current_party')
const searchQuery = ref('')
const isLoading = ref(false)

const allVouchers = ref<any[]>([])
const historicalPrices = ref<any[]>([])
const currentPartyVouchers = ref<any[]>([])
const currentPartyHistorical = ref<any | null>(null)
const summary = ref<any>(null)

const close = () => {
  emit('update:modelValue', false)
}

const loadHistory = async () => {
  if (!props.productId) return
  isLoading.value = true
  searchQuery.value = ''
  // Default to current party if customerId exists
  activeTab.value = props.customerId ? 'current_party' : 'all_parties'

  try {
    const custParam = props.customerId ? `&customerId=${encodeURIComponent(props.customerId)}` : ''
    const res = await $fetch<any>(`/api/products/${props.productId}/last-prices?limit=150${custParam}`)
    if (res.success) {
      allVouchers.value = res.allVouchers || []
      historicalPrices.value = res.historicalPrices || []
      currentPartyVouchers.value = res.currentPartyVouchers || []
      currentPartyHistorical.value = res.currentPartyHistorical || null
      summary.value = res.summary || null
    }
  } catch (err) {
    console.error('Failed to load product price history:', err)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [props.modelValue, props.productId],
  ([isOpen, pId]) => {
    if (isOpen && pId) {
      loadHistory()
    } else if (!isOpen) {
      allVouchers.value = []
      historicalPrices.value = []
      currentPartyVouchers.value = []
      currentPartyHistorical.value = null
    }
  },
  { immediate: true }
)

const now = new Date()

// Build comprehensive list for "Current Party"
const currentPartyList = computed(() => {
  // If we have currentPartyVouchers, map them
  const list: any[] = []
  const seenVouchers = new Set<string>()

  for (const v of currentPartyVouchers.value) {
    if (v.voucherNo && seenVouchers.has(v.voucherNo)) continue
    if (v.voucherNo) seenVouchers.add(v.voucherNo)

    const vDate = v.voucherDate ? new Date(v.voucherDate) : null
    const daysAgo = vDate ? Math.ceil(Math.abs(now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined

    list.push({
      id: v.voucherNo,
      voucherNo: v.voucherNo,
      voucherDate: v.voucherDate,
      customerName: v.customerName || props.customerName,
      customerCode: v.customerCode,
      qty: v.qty,
      rate: v.rate,
      amount: v.amount,
      isTaxInclusive: v.isTaxInclusive,
      daysAgo
    })
  }

  // If historical price for current customer is not yet in the list, include it
  if (currentPartyHistorical.value && !seenVouchers.has(currentPartyHistorical.value.voucherNo)) {
    const hp = currentPartyHistorical.value
    const vDate = hp.voucherDate ? new Date(hp.voucherDate) : null
    const daysAgo = vDate ? Math.ceil(Math.abs(now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined

    list.unshift({
      id: hp.id || hp.voucherNo,
      voucherNo: hp.voucherNo,
      voucherDate: hp.voucherDate,
      customerName: hp.customer?.name || props.customerName,
      customerCode: hp.customer?.customerCode,
      qty: hp.quantity,
      rate: Number(hp.unitPrice || hp.basePrice || 0),
      isTaxInclusive: Boolean(hp.isTaxInclusive),
      daysAgo,
      customer: hp.customer
    })
  }

  return list
})

// Build comprehensive list for "All Parties"
const allPartiesList = computed(() => {
  if (allVouchers.value.length > 0) {
    return allVouchers.value.map((v) => {
      const vDate = v.voucherDate ? new Date(v.voucherDate) : null
      const daysAgo = vDate ? Math.ceil(Math.abs(now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined
      return {
        ...v,
        daysAgo
      }
    })
  }

  // Fallback to historicalPrices
  return historicalPrices.value.map((hp) => {
    const vDate = hp.voucherDate ? new Date(hp.voucherDate) : null
    const daysAgo = vDate ? Math.ceil(Math.abs(now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined
    return {
      id: hp.id,
      voucherNo: hp.voucherNo,
      voucherDate: hp.voucherDate,
      customerName: hp.customer?.name || 'Customer',
      customerCode: hp.customer?.customerCode,
      qty: hp.quantity,
      rate: Number(hp.unitPrice || 0),
      isTaxInclusive: Boolean(hp.isTaxInclusive),
      daysAgo,
      customer: hp.customer
    }
  })
})

const filteredList = computed(() => {
  const base = activeTab.value === 'current_party' ? currentPartyList.value : allPartiesList.value
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return base

  return base.filter((item) => {
    const cust = (item.customerName || item.customer?.name || '').toLowerCase()
    const code = (item.customerCode || item.customer?.customerCode || '').toLowerCase()
    const city = (item.customer?.city || '').toLowerCase()
    const vNo = (item.voucherNo || '').toLowerCase()
    return cust.includes(q) || code.includes(q) || city.includes(q) || vNo.includes(q)
  })
})

const formatDateDisplay = (dateVal: any) => {
  if (!dateVal) return '—'
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const applyRate = (row: any) => {
  const rateVal = Number(row.rate || row.unitPrice || 0)
  if (rateVal > 0) {
    emit('apply-price', {
      rate: rateVal,
      isTaxInclusive: Boolean(row.isTaxInclusive),
      voucherNo: row.voucherNo
    })
    close()
  }
}
</script>
