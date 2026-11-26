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
            type="button"
            @click="isResetModalOpen = true" 
            :disabled="isResetting || isLoading"
            class="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Reset OMS test postings back to Tally ground truth"
          >
            <RotateCcw class="w-3.5 h-3.5" :class="{ 'animate-spin': isResetting }" />
            <span>Reset Test Data</span>
          </button>

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
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <span>Posted in Tally</span>
            <span v-if="justPostedCount > 0" class="text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded">
              {{ justPostedCount }} new
            </span>
          </div>
          <div class="text-lg font-black text-emerald-900 mt-0.5 flex items-baseline gap-2">
            <span>{{ postedCount }}</span>
            <span class="text-[11px] font-semibold text-emerald-600">({{ verifiedCount }} verified)</span>
          </div>
        </div>
        <div class="bg-white p-3 rounded-xl border border-indigo-200/80 shadow-2xs bg-gradient-to-br from-white to-indigo-50/30">
          <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Known Tally Ledgers</div>
          <div class="text-lg font-black text-indigo-900 mt-0.5">
            {{ availableAllLedgers.length || (availableTallyDebtors.length + availableTallyCreditors.length) }}
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="p-4 sm:px-6 bg-white border-b border-gray-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <!-- Left: Search Input + Sales / Purchases Toggle -->
        <div class="flex items-center gap-3 flex-1 max-w-2xl">
          <div class="relative flex-1">
            <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              v-model="searchQuery"
              :placeholder="selectedType === 'purchase' ? 'Search purchases by voucher # or supplier...' : 'Search sales by invoice # or customer...'"
              class="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <!-- Sales / Purchases Toggle Pill -->
          <div class="flex p-0.5 bg-slate-100 rounded-xl border border-gray-200 text-xs font-bold shrink-0 shadow-2xs">
            <button
              type="button"
              @click="setTypeFilter('sales')"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
              :class="selectedType === 'sales' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
            >
              <ShoppingCart class="w-3.5 h-3.5" />
              <span>Sales</span>
            </button>
            <button
              type="button"
              @click="setTypeFilter('purchase')"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
              :class="selectedType === 'purchase' ? 'bg-emerald-600 text-white shadow-xs font-black' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'"
            >
              <ShoppingBag class="w-3.5 h-3.5" />
              <span>Purchases</span>
            </button>
          </div>
        </div>

        <!-- Right: Status Tabs (Unposted / Posted / All) -->
        <div class="flex items-center gap-2">
          <div class="flex p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-gray-600 border border-gray-200">
            <button 
              type="button"
              @click="statusFilter = 'unposted'"
              class="px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              :class="statusFilter === 'unposted' ? 'bg-white text-amber-900 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              <span>Unposted</span>
              <span class="px-1.5 py-0.5 rounded-full text-[10px]" :class="statusFilter === 'unposted' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-gray-700'">{{ unpostedCount }}</span>
            </button>
            <button 
              type="button"
              @click="statusFilter = 'posted'"
              class="px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              :class="statusFilter === 'posted' ? 'bg-white text-emerald-900 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              <span>Posted</span>
              <span class="px-1.5 py-0.5 rounded-full text-[10px]" :class="statusFilter === 'posted' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-gray-700'">{{ postedCount }}</span>
            </button>
            <button 
              type="button"
              @click="statusFilter = 'all'"
              class="px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              :class="statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs font-extrabold' : 'hover:text-gray-900'"
            >
              <span>All</span>
              <span class="px-1.5 py-0.5 rounded-full text-[10px]" :class="statusFilter === 'all' ? 'bg-slate-200 text-gray-900' : 'bg-slate-200 text-gray-700'">{{ totalCount }}</span>
            </button>
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
                <div v-if="v.isMapped" class="flex items-center gap-1.5 text-emerald-700 font-bold truncate max-w-[190px]">
                  <Check class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span class="truncate text-xs" :title="v.mappedTallyParty">{{ v.mappedTallyParty }}</span>
                </div>
                <div v-else class="flex items-center gap-1.5 truncate max-w-[190px]">
                  <span class="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 shrink-0 inline-flex items-center gap-1">
                    <Link2 class="w-3 h-3 text-amber-700" /> Link First
                  </span>
                  <span v-if="v.suggestedTallyParty" class="truncate text-[11px] text-gray-500 font-medium" :title="'Suggested: ' + v.suggestedTallyParty">
                    {{ v.suggestedTallyParty }}
                  </span>
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
                  v-if="v.isVerifiedInTally"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs"
                  :title="v.tallyReference ? 'Ground-truth verified in live Tally (Ref: ' + v.tallyReference + ')' : 'Ground-truth verified in live Tally Prime register'"
                >
                  <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                  <span>Verified in Tally</span>
                  <span v-if="v.tallyReference" class="text-[9px] font-mono text-emerald-950 font-normal ml-0.5">({{ v.tallyReference }})</span>
                </span>
                <span 
                  v-else-if="v.postStatus === 'manual' || v.isManualPosted"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 inline-flex items-center gap-1 shadow-2xs"
                  title="Manually marked as already in Tally by user"
                >
                  <Check class="w-3 h-3 text-teal-600" /> Manually Marked
                </span>
                <span 
                  v-else-if="v.isJustPosted || v.isPosted"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1 shadow-2xs"
                  title="Created via OMS; will be verified on next background sync"
                >
                  <Clock class="w-3 h-3 text-blue-600" /> Just Posted
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
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Quick Toggle Button: Mark as Posted / Reset to Unposted -->
                  <button 
                    v-if="!v.isPosted"
                    type="button"
                    @click.stop="togglePostedStatus(v, 'mark')"
                    :disabled="togglingVoucherNo === v.voucherNo"
                    class="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                    title="Mark as already entered in Tally"
                  >
                    <Loader2 v-if="togglingVoucherNo === v.voucherNo" class="w-3.5 h-3.5 animate-spin" />
                    <Check v-else class="w-3.5 h-3.5 text-teal-600" />
                    <span>Mark as Posted</span>
                  </button>
                  <button 
                    v-else
                    type="button"
                    @click.stop="togglePostedStatus(v, 'unmark')"
                    :disabled="togglingVoucherNo === v.voucherNo"
                    class="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                    title="Reset back to Unposted"
                  >
                    <Loader2 v-if="togglingVoucherNo === v.voucherNo" class="w-3.5 h-3.5 animate-spin" />
                    <RotateCcw v-else class="w-3.5 h-3.5 text-rose-600" />
                    <span>Reset to Unposted</span>
                  </button>

                  <button 
                    type="button"
                    @click="openReviewModal(v)"
                    class="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    :class="[
                      v.isVerifiedInTally
                        ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
                        : (v.isJustPosted
                            ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                            : (!v.isMapped
                                ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700 hover:shadow-sm'
                                : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:shadow-sm'))
                    ]"
                  >
                    <CheckCircle2 v-if="v.isVerifiedInTally" class="w-3.5 h-3.5 text-emerald-600" />
                    <Clock v-else-if="v.isJustPosted" class="w-3.5 h-3.5 text-blue-600" />
                    <Link2 v-else-if="!v.isMapped" class="w-3.5 h-3.5" />
                    <Send v-else class="w-3.5 h-3.5" />
                    <span>{{ v.isVerifiedInTally ? 'View / Repost' : (v.isJustPosted ? 'View / Repost' : (!v.isMapped ? 'Link & Post' : 'Review & Post')) }}</span>
                  </button>
                </div>
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

    <!-- Reset Test Data Confirmation Modal -->
    <div v-if="isResetModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="isResetModalOpen = false"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <RotateCcw class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-black text-gray-900">Reset Test Postings</h3>
            <p class="text-xs text-gray-500">Revert OMS posting status back to live Tally sync</p>
          </div>
        </div>

        <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5 leading-relaxed">
          <div class="font-bold flex items-center gap-1.5 text-amber-950">
            <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0" />
            <span>How This Reset Works</span>
          </div>
          <p>
            This clears the local OMS tracking of tested vouchers (marked as <strong>"Just Posted"</strong>), immediately reverting them to <strong>"Unposted"</strong> unless they are genuinely present in your live Tally register.
          </p>
        </div>

        <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-gray-200 cursor-pointer select-none">
          <input 
            type="checkbox" 
            v-model="alsoResetMappings" 
            class="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
          />
          <div class="text-xs">
            <div class="font-bold text-gray-900">Also reset party ledger mappings</div>
            <div class="text-[11px] text-gray-500">Unlinks all tested parties so they can be re-mapped cleanly.</div>
          </div>
        </label>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button 
            type="button" 
            @click="isResetModalOpen = false" 
            class="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="executeReset" 
            :disabled="isResetting"
            class="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Loader2 v-if="isResetting" class="w-3.5 h-3.5 animate-spin" />
            <RotateCcw v-else class="w-3.5 h-3.5" />
            <span>Confirm Reset</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Mount Side-by-Side Review & Override Modal -->
    <BusyToTallyReviewModal
      :is-open="isReviewModalOpen"
      :voucher="selectedVoucher"
      :available-tally-debtors="availableTallyDebtors"
      :available-tally-creditors="availableTallyCreditors"
      :available-all-ledgers="availableAllLedgers"
      :available-voucher-types="availableVoucherTypes"
      @close="isReviewModalOpen = false"
      @posted="onVoucherPosted"
      @status-changed="onVoucherStatusChanged"
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
  ChevronDown,
  Link2,
  Send,
  Clock,
  RotateCcw,
  AlertTriangle
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
const availableAllLedgers = ref<string[]>([])
const availableVoucherTypes = ref<string[]>(['Sales', 'Purchase'])

const searchQuery = ref('')
const selectedType = ref<'sales' | 'purchase' | 'all'>('sales')
const statusFilter = ref<'all' | 'unposted' | 'posted'>('unposted')

const isReviewModalOpen = ref(false)
const selectedVoucher = ref<PreparedVoucherItem | null>(null)

// Reset Test Data State
const isResetModalOpen = ref(false)
const alsoResetMappings = ref(true)
const isResetting = ref(false)

const executeReset = async () => {
  isResetting.value = true
  try {
    await $fetch('/api/tally/reset-test-postings', {
      method: 'POST',
      body: { resetMappings: alsoResetMappings.value }
    })
    isResetModalOpen.value = false
    await refreshData()
  } catch (err) {
    console.error('Failed to reset test postings:', err)
  } finally {
    isResetting.value = false
  }
}

const setTypeFilter = (type: 'sales' | 'purchase' | 'all') => {
  selectedType.value = type
  fetchVouchers()
}

// Counts
const totalCount = computed(() => vouchers.value.length)
const postedCount = computed(() => vouchers.value.filter(v => v.isPosted).length)
const unpostedCount = computed(() => vouchers.value.filter(v => !v.isPosted).length)
const verifiedCount = computed(() => vouchers.value.filter(v => v.isVerifiedInTally).length)
const justPostedCount = computed(() => vouchers.value.filter(v => v.isJustPosted && !v.isVerifiedInTally).length)

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
    if (Array.isArray(ledgersRes?.allLedgers) && ledgersRes.allLedgers.length > 0) {
      availableAllLedgers.value = ledgersRes.allLedgers.map((l: any) => typeof l === 'string' ? l : l.name)
    } else {
      availableAllLedgers.value = Array.from(new Set([...availableTallyDebtors.value, ...availableTallyCreditors.value])).sort()
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

const togglingVoucherNo = ref<string | null>(null)

const togglePostedStatus = async (v: PreparedVoucherItem, action: 'mark' | 'unmark') => {
  if (togglingVoucherNo.value) return
  togglingVoucherNo.value = v.voucherNo
  try {
    const res = await $fetch<{ success: boolean; isPosted: boolean }>('/api/tally/toggle-posted', {
      method: 'POST',
      body: {
        voucherNo: v.voucherNo,
        action
      }
    })
    if (res.success) {
      if (action === 'mark') {
        v.isPosted = true
        v.isJustPosted = true
        v.isManualPosted = true
        v.postStatus = 'manual'
        v.postedAt = new Date().toISOString()
      } else {
        v.isPosted = false
        v.isJustPosted = false
        v.isVerifiedInTally = false
        v.isManualPosted = false
        v.postStatus = 'unposted'
      }
    }
  } catch (err: any) {
    console.error('Failed toggling posted status:', err)
    alert(err?.data?.message || err?.message || 'Failed to update voucher status')
  } finally {
    togglingVoucherNo.value = null
  }
}

const onVoucherStatusChanged = (vchNo: string, action: 'mark' | 'unmark') => {
  const target = vouchers.value.find(v => v.voucherNo === vchNo)
  if (target) {
    if (action === 'mark') {
      target.isPosted = true
      target.isJustPosted = true
      target.isManualPosted = true
      target.postStatus = 'manual'
      target.postedAt = new Date().toISOString()
    } else {
      target.isPosted = false
      target.isJustPosted = false
      target.isVerifiedInTally = false
      target.isManualPosted = false
      target.postStatus = 'unposted'
    }
  }
}

// Callback when voucher is posted
const onVoucherPosted = (vchNo: string, partyLedgerName?: string, busyPartyName?: string) => {
  const target = vouchers.value.find(v => v.voucherNo === vchNo)
  if (target) {
    target.isPosted = true
    target.isJustPosted = true
    target.postStatus = 'just_posted'
    target.postedAt = new Date().toISOString()
  }
  if (partyLedgerName && busyPartyName) {
    for (const v of vouchers.value) {
      if (v.customerName === busyPartyName) {
        v.isMapped = true
        v.mappedTallyParty = partyLedgerName
      }
    }
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
