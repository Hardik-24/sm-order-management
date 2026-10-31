<template>
  <div class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto pb-16">
    <!-- Top Header (Matching billing.vue:195-213) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Quotations & Pricing Estimates</h1>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Manage hardware price estimates, check stock availability, and share branded quotation slips.
        </p>
      </div>

      <!-- Action Button (Matching billing.vue action buttons) -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          @click="openNewQuoteModal"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-[#1b3b5f] hover:bg-[#132c49] rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Create New Quotation</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching billing.vue:216-284 exact structure & typography) -->
    <div ref="statsContainerRef" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 select-none">
      <!-- 1. Total Quotes -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-blue-50 p-2 sm:p-2.5 rounded-lg text-[#1b3b5f] border border-blue-100/50">
              <FileText class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1b3b5f] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Quotes</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="quotations.length" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-gray-500 font-medium truncate">Recorded in system</p>
          </div>
        </div>
      </div>

      <!-- 2. This Month -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-amber-50 p-2 sm:p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <Calendar class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-amber-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">This Month</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="quotesThisMonth" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-amber-600 font-medium truncate">Issued in {{ currentMonthName }}</p>
          </div>
        </div>
      </div>

      <!-- 3. Catalog Feed -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div
              class="p-2 sm:p-2.5 rounded-lg border"
              :class="sheetDiagnostics?.canConnect
                ? 'bg-teal-50 text-teal-600 border-teal-100/50'
                : (sheetDiagnostics?.configured === false ? 'bg-amber-50 text-amber-600 border-amber-100/50' : 'bg-gray-100 text-gray-600 border-gray-200')"
            >
              <CheckCircle2 v-if="sheetDiagnostics?.canConnect" class="w-4 h-4 sm:w-5 sm:h-5" />
              <AlertCircle v-else class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-teal-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0 flex-1">
            <div class="flex items-center justify-between gap-1">
              <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Catalog Feed</p>
              <button
                type="button"
                @click="checkSheetStatus(true)"
                :disabled="isCheckingSheet"
                title="Re-sync from Google Sheet"
                class="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer disabled:opacity-40"
              >
                <RefreshCw class="w-3 h-3" :class="isCheckingSheet ? 'animate-spin' : ''" />
              </button>
            </div>
            <h3 class="text-sm sm:text-base font-bold text-gray-900 mb-0.5 flex items-center gap-1.5 truncate">
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :class="sheetDiagnostics?.canConnect
                  ? 'bg-emerald-500 animate-pulse'
                  : (sheetDiagnostics?.configured === false ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse')"
              ></span>
              <span class="truncate">{{ sheetDiagnostics?.canConnect ? 'Google Sheet Live' : (sheetDiagnostics?.configured === false ? 'Offline Fallback' : 'Google Sheet Ready') }}</span>
            </h3>
            <p class="text-[11px] sm:text-xs text-teal-600 font-medium truncate">
              {{ sheetDiagnostics?.rowCount ? `${((sheetDiagnostics.rowCount || 1) - 1).toLocaleString()} live products` : 'Synced with stock' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Search & Filter Controls Toolbar (Matching BillingTable.vue:104-145) -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 bg-gray-50/50">
        <!-- 1. Scope Toggle: At top above search on mobile, utilizing full row (flex-1 buttons); on desktop pushed right next to Refresh -->
        <div
          v-if="canViewAllCompanyOrders"
          class="inline-flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80 shadow-2xs w-full sm:w-auto justify-center sm:justify-start shrink-0 order-first sm:order-2 sm:ml-auto"
        >
          <button
            type="button"
            @click="quoteScope = 'all'"
            class="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            :class="quoteScope === 'all' ? 'bg-white text-[#1b3b5f] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'"
          >
            <Building2 class="w-3.5 h-3.5" />
            <span>All Company</span>
          </button>
          <button
            type="button"
            @click="quoteScope = 'mine'"
            class="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            :class="quoteScope === 'mine' ? 'bg-white text-[#1b3b5f] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'"
          >
            <UserIcon class="w-3.5 h-3.5" />
            <span>My Quotes</span>
          </button>
        </div>

        <!-- 2. Search Input: Below toggle on mobile, leftmost on desktop -->
        <div class="relative w-full sm:w-80 order-2 sm:order-1">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search quote #, customer, place..."
            class="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition-all"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- 3. Actions (Refresh button) -->
        <div class="flex items-center gap-2 w-full sm:w-auto justify-end order-3">
          <button
            type="button"
            @click="fetchQuotations"
            :disabled="isLoading"
            class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors cursor-pointer disabled:opacity-50 w-full sm:w-auto justify-center"
            title="Refresh Quotations"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Quotations Table Card (Matching BillingTable.vue) -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative">
      <LoadingTopBar :loading="isLoading" />

      <!-- Toolbar Header -->
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <div>
          Showing <span class="font-bold text-gray-900">{{ filteredQuotations.length }}</span> of
          <span class="font-bold text-gray-900">{{ quotations.length }}</span> quotations
          <span v-if="searchQuery" class="text-sky-600 ml-1 font-semibold">(filtered)</span>
        </div>
      </div>

      <!-- Skeletons when initial loading -->
      <div v-if="isLoading && filteredQuotations.length === 0">
        <div class="hidden md:block overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th class="px-5 py-3.5 whitespace-nowrap">Quote No.</th>
                <th class="px-5 py-3.5">Customer & Destination</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
                <th class="px-5 py-3.5 whitespace-nowrap">Created By</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Date</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
              </tr>
            </thead>
            <TableSkeletonRows :cols="6" :rows="5" />
          </table>
        </div>
        <TableSkeletonRows :cols="6" :rows="5" :isMobileOnly="true" :renderMobile="true" />
      </div>

      <!-- Empty State matching BillingTable.vue:195-201 -->
      <div v-else-if="filteredQuotations.length === 0" class="py-14 text-center text-gray-400">
        <Calculator class="w-8 h-8 mx-auto text-gray-300 mb-2" />
        <p class="text-sm font-semibold text-gray-700">
          {{ searchQuery ? 'No quotations match your search' : 'No quotations created yet' }}
        </p>
        <p class="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
          {{ searchQuery ? 'Try searching by a different customer name, place, or quote number.' : 'Click below to create your first official quotation slip with live Google Sheet hardware pricing.' }}
        </p>
        <button
          type="button"
          @click="openNewQuoteModal"
          class="mt-3 px-3 py-1.5 text-xs font-semibold text-[#1b3b5f] bg-sky-50 hover:bg-sky-100 rounded-lg transition cursor-pointer"
        >
          Create First Quotation
        </button>
      </div>

      <!-- Content Views -->
      <div v-else>
        <!-- Desktop Table matching BillingTable.vue:152-328 -->
        <div class="hidden md:block overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th class="px-5 py-3.5 whitespace-nowrap">Quote No.</th>
                <th class="px-5 py-3.5">Customer & Destination</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
                <th class="px-5 py-3.5 whitespace-nowrap">Created By</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Date</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody ref="tbodyRef" class="divide-y divide-gray-100 bg-white">
              <tr
                v-for="quote in filteredQuotations"
                :key="quote.id"
                @click="viewQuoteDetails(quote)"
                class="cursor-pointer hover:bg-gray-50/80 transition-colors duration-150 group"
              >
                <!-- 1. Quote No (Regular font matching BillingTable.vue Order No) -->
                <td class="px-5 py-3.5 whitespace-nowrap">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-bold text-gray-900 group-hover:text-[#1b3b5f] transition-colors">
                      {{ quote.quoteNumber }}
                    </span>
                  </div>
                  <p class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    Valid for {{ quote.validityDays || 7 }} days
                  </p>
                </td>

                <!-- 2. Customer & Destination -->
                <td class="px-5 py-3.5 min-w-0">
                  <div class="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5" :title="quote.customerName">
                    <span class="truncate">{{ quote.customerName }}</span>
                    <span
                      v-if="quote.customerPlace"
                      class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200"
                    >
                      <MapPin class="w-2.5 h-2.5 text-[#1b3b5f]" />
                      <span>{{ quote.customerPlace }}</span>
                    </span>
                  </div>
                  <p v-if="quote.customerPhone" class="text-[11px] text-gray-500 truncate mt-0.5 tabular-nums">
                    +91 {{ quote.customerPhone }}
                  </p>
                </td>

                <!-- 3. Items Count -->
                <td class="px-5 py-3.5 whitespace-nowrap text-center">
                  <div class="text-xs font-bold text-gray-800">
                    {{ Array.isArray(quote.items) ? quote.items.length : (quote.totalItems || 0) }} items
                  </div>
                </td>

                <!-- 4. Created By -->
                <td class="px-5 py-3.5 whitespace-nowrap">
                  <div class="text-xs font-semibold text-gray-800 truncate">
                    {{ quote.createdByName || 'Sales Staff' }}
                  </div>
                  <p class="text-[11px] text-gray-400 uppercase font-medium tracking-wider">
                    {{ quote.createdByRole || 'STAFF' }}
                  </p>
                </td>

                <!-- 5. Date -->
                <td class="px-5 py-3.5 whitespace-nowrap text-center">
                  <span class="text-xs text-gray-700">
                    {{ formatDisplayDate(new Date(quote.createdAt)) }}
                  </span>
                </td>

                <!-- 6. Actions (Matching BillingTable.vue button style) -->
                <td class="px-5 py-3.5 text-right whitespace-nowrap pr-5" @click.stop>
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      @click="viewQuoteDetails(quote)"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      title="View & Share Quotation Slip"
                    >
                      <span>View Slip</span>
                      <ChevronRight class="w-3.5 h-3.5 text-gray-400" />
                    </button>

                    <button
                      v-if="canDeleteQuotations"
                      type="button"
                      @click="deleteQuote(quote)"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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

        <!-- Mobile View (Matching BillingTable.vue:351-420 exact 2-line layout) -->
        <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
          <div
            v-for="quote in filteredQuotations"
            :key="'mob-' + quote.id"
            @click="viewQuoteDetails(quote)"
            class="px-3.5 py-3 cursor-pointer transition-colors flex flex-col gap-1.5 hover:bg-gray-50 active:bg-gray-100"
          >
            <!-- LINE 1: Quote #, Destination, Customer & Date -->
            <div class="flex items-center justify-between gap-2 min-w-0">
              <div class="flex items-center gap-1.5 min-w-0 flex-1">
                <span class="text-xs font-bold text-gray-900 shrink-0">
                  {{ quote.quoteNumber }}
                </span>
                <span
                  v-if="quote.customerPlace"
                  class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[120px]"
                >
                  <MapPin class="w-2.5 h-2.5 text-[#1b3b5f] shrink-0" />
                  <span class="truncate">{{ quote.customerPlace }}</span>
                </span>
                <span class="text-gray-300 text-xs shrink-0">&bull;</span>
                <span class="text-xs font-semibold text-gray-700 truncate" :title="quote.customerName">
                  {{ quote.customerName }}
                </span>
              </div>

              <span class="text-[11px] text-gray-400 tabular-nums shrink-0">
                {{ formatDisplayDate(new Date(quote.createdAt)) }}
              </span>
            </div>

            <!-- LINE 2: Items, Phone, Staff & View Action -->
            <div class="flex items-center justify-between gap-2 min-w-0 pt-0.5">
              <div class="flex items-baseline gap-1.5 min-w-0">
                <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 shrink-0">
                  {{ Array.isArray(quote.items) ? quote.items.length : (quote.totalItems || 0) }} items
                </span>
                <span v-if="quote.customerPhone" class="text-[11px] text-gray-400 truncate tabular-nums">
                  +91 {{ quote.customerPhone }}
                </span>
                <span class="text-gray-300 text-[10px] shrink-0">&bull;</span>
                <span class="text-[11px] text-gray-400 truncate">
                  {{ quote.createdByName || 'Staff' }}
                </span>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <span class="text-xs font-semibold text-[#1b3b5f] flex items-center gap-0.5">
                  <span>View</span>
                  <ChevronRight class="w-3 h-3 text-gray-400" />
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
import { ref, computed, onMounted, nextTick, watch } from 'vue'
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
  ChevronRight,
  AlertCircle,
  Building2,
  User as UserIcon
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuth } from '~/composables/useAuth'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'
import LoadingTopBar from '~/components/ui/LoadingTopBar.vue'
import TableSkeletonRows from '~/components/ui/TableSkeletonRows.vue'
import { getEffectiveActionPermissions } from '~/utils/permissions'
import QuotationModal from '~/components/quotations/QuotationModal.vue'
import { rankAndFilter } from '~/utils/search'

definePageMeta({
  layout: 'dashboard'
})

const { showSaved, showEditing } = useSnackbar()
const { user } = useAuth()
const { animateStagger, initContext } = useGsapAnimation()

const statsContainerRef = ref<HTMLElement | null>(null)
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)

const isAdmin = computed(() => user.value?.role === 'ADMIN')
const canDeleteQuotations = computed(() => {
  if (!user.value) return false
  if (user.value.role === 'ADMIN') return true
  const perms = getEffectiveActionPermissions(user.value)
  return Boolean(perms.canDeleteQuotations)
})
const canViewAllCompanyOrders = computed(() => {
  if (!user.value) return false
  if (user.value.role === 'ADMIN') return true
  const perms = getEffectiveActionPermissions(user.value)
  return perms.canViewAllCompanyOrders ?? true
})

const quoteScope = ref<'all' | 'mine'>(canViewAllCompanyOrders.value ? 'all' : 'mine')

watch(canViewAllCompanyOrders, (val) => {
  if (!val) {
    quoteScope.value = 'mine'
  }
})

watch(quoteScope, () => {
  fetchQuotations()
})

// State
const quotations = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const sheetDiagnostics = ref<any>(null)
const isCheckingSheet = ref(false)

const triggerRowAnimation = () => {
  nextTick(() => {
    if (!isLoading.value) {
      if (tbodyRef.value) {
        const rows = tbodyRef.value.querySelectorAll('tr')
        const targetRows = Array.from(rows).slice(0, 15)
        animateStagger(targetRows, { duration: 0.22, stagger: 0.02, y: 6 })
      }
      if (mobileListRef.value) {
        const cards = Array.from(mobileListRef.value.children).slice(0, 15)
        animateStagger(cards, { duration: 0.22, stagger: 0.02, y: 6 })
      }
    }
  })
}

watch([() => filteredQuotations.value, isLoading], () => {
  triggerRowAnimation()
})

const checkSheetStatus = async (forceSync = false) => {
  isCheckingSheet.value = true
  try {
    if (forceSync) {
      const syncRes = await $fetch<any>('/api/quotations/sheet-products?force=true')
      if (syncRes?.lastSyncedAt && sheetDiagnostics.value) {
        sheetDiagnostics.value.lastSyncedAt = syncRes.lastSyncedAt
      }
    }
    const diag = await $fetch<any>('/api/quotations/sheet-diagnostics')
    sheetDiagnostics.value = diag
    if (forceSync && diag?.canConnect) {
      showSaved(`Google Sheet synced! ${((diag.rowCount || 1) - 1).toLocaleString()} products ready`)
    }
  } catch (e: any) {
    console.warn('Could not check Google Sheet diagnostics:', e)
  } finally {
    isCheckingSheet.value = false
  }
}

const formatLastSynced = (iso?: string | null) => {
  if (!iso) return 'Not synced yet'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return 'Recently'

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

// Modal State
const isModalOpen = ref(false)
const selectedQuote = ref<any | null>(null)

// Load Quotations from DB
const fetchQuotations = async () => {
  isLoading.value = true
  try {
    const res = await $fetch<any>('/api/quotations', {
      params: { scope: quoteScope.value }
    })
    if (res?.quotations) {
      quotations.value = res.quotations
    }
  } catch (err: any) {
    console.error('Failed to load quotations:', err)
  } finally {
    isLoading.value = false
  }
}

// Filtered Quotations with relevance ranking
const filteredQuotations = computed(() => {
  if (!quotations.value) return []
  return rankAndFilter(quotations.value as any[], searchQuery.value, {
    primary: q => [q.quoteNumber, q.customerName],
    secondary: q => [q.customerPlace, q.createdByName]
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
  initContext(statsContainerRef.value || undefined)
  if (statsContainerRef.value) {
    animateStagger(statsContainerRef.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  fetchQuotations()
  checkSheetStatus()
})
</script>
