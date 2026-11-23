<template>
  <div class="min-h-screen bg-slate-50 flex flex-col antialiased text-gray-900 pb-24 md:pb-12">
    <!-- Main Content Container: Directly starts from Available Reports & Ledgers -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-6">
      <!-- Section Title & Description -->
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
          Available Reports & Ledgers
        </h1>
        <p class="text-xs text-gray-500 mt-1">
          Select a report below to configure parameters, preview statement, and export to PDF or print.
        </p>
      </div>

      <!-- Single Tile: Party Ledger Statement -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          @click="openPartyLedgerModal"
          class="group relative bg-white rounded-2xl border-2 border-emerald-500/30 hover:border-emerald-500 p-6 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99] bg-gradient-to-br from-white via-white to-emerald-50/20"
        >
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
              <span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">Classic Look</span>
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
