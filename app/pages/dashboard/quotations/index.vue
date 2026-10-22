<template>
  <div class="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-16">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Dashboard</span>
          <span class="text-gray-300">&bull;</span>
          <span class="text-xs font-bold text-[#1a5c4c] uppercase tracking-widest">Pricing Estimates</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center">
            <Calculator class="w-5 h-5" />
          </div>
          <span>Quotations</span>
        </h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Manage hardware price estimates, check stock availability, and share branded quotation slips.
        </p>
      </div>

      <!-- Action Button -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          @click="openNewQuoteModal"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a5c4c] hover:bg-[#14483b] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-98 cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Create New Quotation</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
      <!-- Total Quotations -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Quotes</span>
          <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <FileText class="w-4 h-4" />
          </div>
        </div>
        <div class="text-xl sm:text-2xl font-black text-gray-900 font-mono">{{ quotations.length }}</div>
        <div class="text-[11px] text-gray-500 mt-0.5">Recorded in system</div>
      </div>

      <!-- Created This Month -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">This Month</span>
          <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <Calendar class="w-4 h-4" />
          </div>
        </div>
        <div class="text-xl sm:text-2xl font-black text-gray-900 font-mono">{{ quotesThisMonth }}</div>
        <div class="text-[11px] text-gray-500 mt-0.5">Issued in {{ currentMonthName }}</div>
      </div>

      <!-- Active Catalog Feed -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Catalog Feed</span>
          <div class="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <CheckCircle2 class="w-4 h-4" />
          </div>
        </div>
        <div class="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5 mt-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Google Sheet Live</span>
        </div>
        <div class="text-[11px] text-gray-500 mt-0.5">Synced with live stock</div>
      </div>
    </div>

    <!-- Search & Filter Toolbar -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-2xs p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="relative flex-1 max-w-md">
        <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by Quote No, Customer, Place, or Staff..."
          class="w-full pl-9 pr-3 py-2 bg-gray-50/70 focus:bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="fetchQuotations"
          :disabled="isLoading"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Refresh Quotations"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
          <span class="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quotations Table Card -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="p-12 text-center text-gray-400">
        <Loader2 class="w-8 h-8 animate-spin mx-auto mb-2 text-[#1a5c4c]" />
        <p class="text-xs font-semibold text-gray-600">Loading quotations...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredQuotations.length === 0" class="py-16 px-4 text-center">
        <div class="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
          <Calculator class="w-8 h-8" />
        </div>
        <h3 class="text-sm font-bold text-gray-800">
          {{ searchQuery ? 'No quotations match your search' : 'No quotations created yet' }}
        </h3>
        <p class="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-5">
          {{ searchQuery ? 'Try searching by a different customer name, place, or quote number.' : 'Click below to create your first official quotation slip with live Google Sheet hardware pricing.' }}
        </p>
        <button
          type="button"
          @click="openNewQuoteModal"
          class="inline-flex items-center gap-2 px-4 py-2 bg-[#1a5c4c] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-[#14483b] transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Create First Quotation</span>
        </button>
      </div>

      <!-- Desktop Table View -->
      <div v-else class="hidden md:block overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-gray-50/90 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <th class="py-3 px-4 w-36">Quote No.</th>
              <th class="py-3 px-4">Customer & Destination</th>
              <th class="py-3 px-3 text-center w-24">Items</th>
              <th class="py-3 px-4 w-44">Created By</th>
              <th class="py-3 px-4 w-28 text-center">Date</th>
              <th class="py-3 px-4 w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="quote in filteredQuotations"
              :key="quote.id"
              class="hover:bg-gray-50/70 transition-colors group cursor-pointer"
              @click="viewQuoteDetails(quote)"
            >
              <!-- 1. Quote Number -->
              <td class="py-3.5 px-4">
                <div class="font-mono font-bold text-xs text-[#1b3b5f] flex items-center gap-1.5">
                  <span>{{ quote.quoteNumber }}</span>
                </div>
                <div class="text-[10px] text-gray-400 mt-0.5">
                  Valid for {{ quote.validityDays || 7 }} days
                </div>
              </td>

              <!-- 2. Customer & Place -->
              <td class="py-3.5 px-4">
                <div class="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                  <span>{{ quote.customerName }}</span>
                  <span
                    v-if="quote.customerPlace"
                    class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                  >
                    <MapPin class="w-2.5 h-2.5 text-[#1b3b5f]" />
                    <span>{{ quote.customerPlace }}</span>
                  </span>
                </div>
                <div v-if="quote.customerPhone" class="inline-flex items-center gap-1 text-[11px] text-gray-500 font-mono mt-0.5">
                  <Phone class="w-2.5 h-2.5 text-[#1b3b5f]" />
                  <span>+91 {{ quote.customerPhone }}</span>
                </div>
              </td>

              <!-- 3. Items Count -->
              <td class="py-3.5 px-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  {{ Array.isArray(quote.items) ? quote.items.length : (quote.totalItems || 0) }} items
                </span>
              </td>

              <!-- 4. Created By -->
              <td class="py-3.5 px-4">
                <div class="font-bold text-gray-800 text-xs truncate">
                  {{ quote.createdByName || 'Sales Staff' }}
                </div>
                <div class="text-[10px] text-gray-400 uppercase font-medium tracking-wider">
                  {{ quote.createdByRole || 'STAFF' }}
                </div>
              </td>

              <!-- 6. Date -->
              <td class="py-3.5 px-4 text-center text-gray-500 text-[11px] whitespace-nowrap">
                {{ formatDisplayDate(new Date(quote.createdAt)) }}
              </td>

              <!-- 7. Actions -->
              <td class="py-3.5 px-4 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    @click="viewQuoteDetails(quote)"
                    class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#1a5c4c] rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="View & Share Quotation Slip"
                  >
                    <Share2 class="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>

                  <button
                    v-if="canDeleteQuotations"
                    type="button"
                    @click="deleteQuote(quote)"
                    class="p-1 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Delete Quotation"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile High-Density Row View -->
      <div class="md:hidden divide-y divide-gray-100 bg-white">
        <div
          v-for="quote in filteredQuotations"
          :key="quote.id"
          class="px-3.5 py-2.5 hover:bg-gray-50 active:bg-gray-100/80 transition-colors cursor-pointer flex flex-col gap-1.5"
          @click="viewQuoteDetails(quote)"
        >
          <!-- LINE 1: Quote # + Destination City pill & Chevron -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-mono font-bold text-xs text-[#1b3b5f] shrink-0">
                {{ quote.quoteNumber }}
              </span>
              <span
                v-if="quote.customerPlace"
                class="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[130px]"
              >
                <MapPin class="w-2.5 h-2.5 text-[#1b3b5f] shrink-0" />
                <span class="truncate">{{ quote.customerPlace }}</span>
              </span>
            </div>

            <!-- Chevron -->
            <div class="flex items-center shrink-0 text-gray-400">
              <ChevronRight class="w-4 h-4" />
            </div>
          </div>

          <!-- LINE 2: Customer Name & Phone -->
          <div class="flex items-baseline justify-between gap-2 min-w-0">
            <span class="font-bold text-gray-900 text-xs truncate">
              {{ quote.customerName }}
            </span>
            <span v-if="quote.customerPhone" class="text-[10px] font-mono text-gray-500 shrink-0 flex items-center gap-1">
              <Phone class="w-2.5 h-2.5 text-gray-400" />
              <span>+91 {{ quote.customerPhone }}</span>
            </span>
          </div>

          <!-- LINE 3: Items, Date, Created By & Admin Action -->
          <div class="flex items-center justify-between gap-2 text-[10px] text-gray-400 pt-0.5 border-t border-gray-50">
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                {{ Array.isArray(quote.items) ? quote.items.length : (quote.totalItems || 0) }} items
              </span>
              <span>&bull;</span>
              <span>{{ formatDisplayDate(new Date(quote.createdAt)) }}</span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span class="text-gray-600 font-medium">
                {{ quote.createdByName || 'Staff' }}
              </span>
              <button
                v-if="canDeleteQuotations"
                type="button"
                @click.stop="deleteQuote(quote)"
                class="p-1 rounded text-gray-300 hover:text-rose-600 active:bg-rose-50 transition"
                title="Delete Quotation"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Responsive Quotation Modal (Drafting & Export Sharing) -->
    <QuotationModal
      v-model="isModalOpen"
      :initial-quote="selectedQuote"
      @created="onQuoteCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Calculator,
  Plus,
  Search,
  X,
  FileText,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Share2,
  Trash2,
  Loader2,
  Phone,
  MapPin,
  ChevronRight
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuth } from '~/composables/useAuth'
import { getEffectiveActionPermissions } from '~/utils/permissions'
import QuotationModal from '~/components/quotations/QuotationModal.vue'

definePageMeta({
  layout: 'dashboard'
})

const { showSaved, showEditing } = useSnackbar()
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')
const canDeleteQuotations = computed(() => {
  if (!user.value) return false
  if (user.value.role === 'ADMIN') return true
  const perms = getEffectiveActionPermissions(user.value)
  return Boolean(perms.canDeleteQuotations)
})

// State
const quotations = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

// Modal State
const isModalOpen = ref(false)
const selectedQuote = ref<any | null>(null)

// Load Quotations from DB
const fetchQuotations = async () => {
  isLoading.value = true
  try {
    const res = await $fetch<any>('/api/quotations')
    if (res?.quotations) {
      quotations.value = res.quotations
    }
  } catch (err: any) {
    console.error('Failed to load quotations:', err)
  } finally {
    isLoading.value = false
  }
}

// Filtered Quotations
const filteredQuotations = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return quotations.value

  return quotations.value.filter(item => {
    return (
      item.quoteNumber?.toLowerCase().includes(q) ||
      item.customerName?.toLowerCase().includes(q) ||
      item.customerPlace?.toLowerCase().includes(q) ||
      item.createdByName?.toLowerCase().includes(q)
    )
  })
})

// Stats
const now = new Date()
const quotesThisMonth = computed(() => {
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  return quotations.value.filter(q => {
    const d = new Date(q.createdAt)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length
})

const currentMonthName = computed(() => {
  return now.toLocaleString('default', { month: 'short' })
})

const formatDisplayDate = (d: Date) => {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// Modal open handlers
const openNewQuoteModal = () => {
  selectedQuote.value = null
  isModalOpen.value = true
}

const viewQuoteDetails = (quote: any) => {
  selectedQuote.value = quote
  isModalOpen.value = true
}

const onQuoteCreated = (newQuote: any) => {
  quotations.value.unshift(newQuote)
}

// Delete handler
const deleteQuote = async (quote: any) => {
  if (!confirm(`Delete quotation ${quote.quoteNumber} for ${quote.customerName}?`)) {
    return
  }

  try {
    await $fetch(`/api/quotations/${quote.id}`, { method: 'DELETE' })
    quotations.value = quotations.value.filter(q => q.id !== quote.id)
    showSaved(`Quotation ${quote.quoteNumber} deleted`)
  } catch (err: any) {
    showEditing(err.message || 'Could not delete quotation')
  }
}

onMounted(() => {
  fetchQuotations()
})
</script>
