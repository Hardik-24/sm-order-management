<template>
  <div class="min-h-screen bg-slate-50 flex flex-col antialiased text-gray-900 pb-24 md:pb-12">
    <!-- Top Header Bar -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <!-- Page Title & Icon -->
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-[#1b3b5f] text-white flex items-center justify-center shadow-sm shrink-0">
              <FileSpreadsheet class="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">Reports & Statements</h1>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Live Center
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                Generate official Statements of Account, Tally ledgers, and operational business records
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
      <!-- Section Intro Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm sm:text-base font-black text-gray-900 uppercase tracking-wide">
            Available Reports & Ledgers
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Click any report tile to configure parameters, preview on screen, and export to PDF or print.
          </p>
        </div>
      </div>

      <!-- Report Tiles Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <!-- TILE 1: DOWNLOAD PARTY LEDGER (Primary Feature) -->
        <div
          @click="openPartyLedgerModal"
          class="group relative bg-white rounded-2xl border-2 border-emerald-500/30 hover:border-emerald-500 p-6 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99] bg-gradient-to-br from-white via-white to-emerald-50/20"
        >
          <!-- Featured Tag Badge -->
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-2xs flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse"></span>
              <span>Tally Prime Live</span>
            </span>
            <span class="text-[10px] font-bold text-gray-400 font-mono">
              550+ Accounts
            </span>
          </div>

          <!-- Icon & Info -->
          <div class="space-y-3 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200">
              <FileSpreadsheet class="w-6 h-6" />
            </div>

            <div>
              <h3 class="text-base sm:text-lg font-black text-gray-950 group-hover:text-emerald-700 transition-colors flex items-center gap-2">
                <span>Party Ledger Statement</span>
                <ArrowUpRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p class="text-xs text-gray-600 leading-relaxed mt-1.5">
                Generate official Statements of Account with date filtering, running balances, multi-page pagination, and 1-tap PDF/print export.
              </p>
            </div>

            <!-- Features Tags -->
            <div class="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] font-bold text-gray-500">
              <span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">Classic (Tally) Look</span>
              <span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">SM Quotation Look</span>
              <span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">Date Presets</span>
            </div>
          </div>

          <!-- Bottom Action Button -->
          <div class="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-700 flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform">
              <span>Open Statement Generator</span>
              <ChevronRight class="w-4 h-4" />
            </span>
            <span
              v-if="!canDownloadPartyLedger && user?.role !== 'ADMIN'"
              class="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
            >
              Permission Locked
            </span>
          </div>
        </div>

        <!-- TILE 2: RECEIVABLES AGING ANALYSIS -->
        <NuxtLink
          to="/dashboard/customers"
          class="group bg-white rounded-2xl border border-gray-200 hover:border-amber-400 p-6 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99]"
        >
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Customer Analytics
            </span>
          </div>

          <div class="space-y-3 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs group-hover:bg-amber-500 group-hover:text-white transition-colors duration-200">
              <Clock class="w-6 h-6" />
            </div>

            <div>
              <h3 class="text-base sm:text-lg font-black text-gray-950 group-hover:text-amber-800 transition-colors flex items-center gap-2">
                <span>Receivables Aging Summary</span>
                <ArrowUpRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p class="text-xs text-gray-600 leading-relaxed mt-1.5">
                Audit customer dues grouped by age brackets (0-30, 31-60, 61-90, 90+ days) and analyze collection rates.
              </p>
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-amber-800">
            <span>View Customers Directory</span>
            <ChevronRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </NuxtLink>

        <!-- TILE 3: BUSY SALES INVOICE REGISTER -->
        <NuxtLink
          to="/dashboard/vouchers"
          class="group bg-white rounded-2xl border border-gray-200 hover:border-sky-400 p-6 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99]"
        >
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
              Accounting Register
            </span>
          </div>

          <div class="space-y-3 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shadow-2xs group-hover:bg-[#1b3b5f] group-hover:text-white transition-colors duration-200">
              <Receipt class="w-6 h-6" />
            </div>

            <div>
              <h3 class="text-base sm:text-lg font-black text-gray-950 group-hover:text-[#1b3b5f] transition-colors flex items-center gap-2">
                <span>Sales Invoices Register</span>
                <ArrowUpRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p class="text-xs text-gray-600 leading-relaxed mt-1.5">
                Inspect full history of BUSY and Tally sales bills with line item quantities, tax splits, and delivery statuses.
              </p>
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-[#1b3b5f]">
            <span>Open Vouchers Register</span>
            <ChevronRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </NuxtLink>

        <!-- TILE 4: STOCK & INVENTORY VALUATION -->
        <NuxtLink
          to="/dashboard/inventory"
          class="group bg-white rounded-2xl border border-gray-200 hover:border-purple-400 p-6 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99]"
        >
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Godown Stock
            </span>
          </div>

          <div class="space-y-3 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition-colors duration-200">
              <Boxes class="w-6 h-6" />
            </div>

            <div>
              <h3 class="text-base sm:text-lg font-black text-gray-950 group-hover:text-purple-800 transition-colors flex items-center gap-2">
                <span>Stock Status & Valuation</span>
                <ArrowUpRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p class="text-xs text-gray-600 leading-relaxed mt-1.5">
                Live godown stock quantities, category-wise holdings, physical counts, and real-time inventory valuations.
              </p>
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-purple-800">
            <span>Open Stock Status</span>
            <ChevronRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </NuxtLink>
      </div>
    </main>

    <!-- Modal Mount: Party Ledger Report Modal -->
    <PartyLedgerReportModal
      :is-open="isPartyLedgerModalOpen"
      @close="isPartyLedgerModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  FileSpreadsheet,
  Receipt,
  Boxes,
  Clock,
  ChevronRight,
  ArrowUpRight
} from 'lucide-vue-next'
import PartyLedgerReportModal from '~/components/reports/PartyLedgerReportModal.vue'

definePageMeta({ layout: 'dashboard' })

const { user, canDownloadPartyLedger } = useAuth()

const isPartyLedgerModalOpen = ref(false)

const openPartyLedgerModal = () => {
  isPartyLedgerModalOpen.value = true
}
</script>
