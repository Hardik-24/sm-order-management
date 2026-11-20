<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-text">
    <div 
      class="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      @click.stop
    >
      <!-- Modal Header -->
      <div class="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50/50 via-white to-indigo-50/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg sm:text-xl font-bold text-gray-900">PO Pre-Flight Auditor & Simulator</h2>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                100% Math Rules
              </span>
            </div>
            <p class="text-xs sm:text-sm text-gray-500 mt-0.5">
              Simulate proposed purchase orders against stock runway, sales velocity, and historical vendor prices before committing capital.
            </p>
          </div>
        </div>

        <button 
          @click="close" 
          class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
        <!-- Draft Item Entry Section -->
        <div class="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Package class="w-4 h-4 text-purple-600" />
              Proposed Order Items ({{ items.length }})
            </h3>
            <div class="flex items-center gap-2">
              <button
                v-if="suggestedItems && suggestedItems.length > 0"
                @click="importSuggestedReorders"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
              >
                <Download class="w-3.5 h-3.5" />
                Import {{ suggestedItems.length }} Urgent Reorders
              </button>
              <button
                @click="addItemRow"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus class="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
          </div>

          <!-- Items Input Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th class="py-2.5 px-2">Item Name / Product</th>
                  <th class="py-2.5 px-2 w-32">Proposed Qty</th>
                  <th class="py-2.5 px-2 w-36">Quoted Unit Rate (₹)</th>
                  <th class="py-2.5 px-2 w-28 text-right">Est. Amount</th>
                  <th class="py-2.5 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200/60">
                <tr v-for="(item, idx) in items" :key="idx" class="hover:bg-white/80 transition-colors">
                  <td class="py-2 px-2">
                    <input
                      v-model="item.name"
                      type="text"
                      placeholder="e.g. 11 MDF INT GR (GREEN)"
                      class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </td>
                  <td class="py-2 px-2">
                    <input
                      v-model.number="item.qty"
                      type="number"
                      min="1"
                      placeholder="Qty"
                      class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </td>
                  <td class="py-2 px-2">
                    <input
                      v-model.number="item.unitPrice"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Auto / Last Rate"
                      class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                  </td>
                  <td class="py-2 px-2 text-right font-bold text-gray-800">
                    ₹{{ Math.round((item.qty || 0) * (item.unitPrice || 0)).toLocaleString('en-IN') }}
                  </td>
                  <td class="py-2 px-2 text-center">
                    <button
                      @click="removeItemRow(idx)"
                      :disabled="items.length <= 1"
                      class="text-gray-400 hover:text-red-600 disabled:opacity-30 cursor-pointer p-1 rounded-lg transition-colors"
                      title="Remove row"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Audit Trigger Button -->
          <div class="flex items-center justify-between pt-2">
            <span class="text-xs text-gray-500">
              Total Proposed Value: <strong class="text-gray-900">₹{{ formatNumber(draftTotalValue) }}</strong>
            </span>
            <button
              @click="runAudit"
              :disabled="loading || items.length === 0 || !items.some(i => i.name && i.qty > 0)"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw v-if="loading" class="w-4 h-4 animate-spin" />
              <ShieldCheck v-else class="w-4 h-4" />
              <span>{{ loading ? 'Auditing Math Rules...' : 'Run Pre-Flight Audit' }}</span>
            </button>
          </div>
        </div>

        <!-- Audit Result Presentation -->
        <div v-if="auditResult" class="space-y-6 animate-in fade-in duration-300">
          <!-- Score & Financial Impact Banner -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
            <!-- Score Card -->
            <div 
              class="md:col-span-4 rounded-2xl p-5 border flex flex-col justify-between"
              :class="scoreCardColorClass"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold uppercase tracking-wider">PO Health Score</span>
                  <span class="text-xs font-black px-2 py-0.5 rounded-full border shadow-2xs" :class="gradeBadgeClass">
                    Grade {{ auditResult.grade }}
                  </span>
                </div>
                <div class="mt-3 flex items-baseline gap-2">
                  <span class="text-4xl font-black tracking-tight">{{ auditResult.score }}</span>
                  <span class="text-sm font-semibold opacity-70">/ 100</span>
                </div>
              </div>
              <p class="text-xs mt-3 leading-relaxed font-medium">
                {{ scoreExplanation }}
              </p>
            </div>

            <!-- Financial Impact Summary Cards -->
            <div class="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <!-- Proposed Value -->
              <div class="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs flex flex-col justify-between">
                <span class="text-xs font-semibold text-gray-500 uppercase">Proposed PO Total</span>
                <div class="mt-2 text-xl font-black text-gray-900">
                  ₹{{ formatNumber(auditResult.summary.totalPOValue) }}
                </div>
                <span class="text-[11px] text-gray-400 mt-1">{{ auditResult.summary.itemCount }} Items</span>
              </div>

              <!-- Recommended Value -->
              <div class="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs flex flex-col justify-between">
                <span class="text-xs font-semibold text-emerald-700 uppercase">Optimal PO Total</span>
                <div class="mt-2 text-xl font-black text-emerald-800">
                  ₹{{ formatNumber(auditResult.summary.recommendedPOValue) }}
                </div>
                <span class="text-[11px] text-emerald-600 font-medium mt-1">Based on 30-day runway</span>
              </div>

              <!-- Capital Saved -->
              <div class="bg-white rounded-2xl p-4 border border-purple-200 shadow-2xs flex flex-col justify-between">
                <span class="text-xs font-semibold text-purple-700 uppercase">Capital Preserved</span>
                <div class="mt-2 text-xl font-black text-purple-800">
                  ₹{{ formatNumber(auditResult.summary.capitalSavings) }}
                </div>
                <span class="text-[11px] text-purple-600 font-medium mt-1">Avoided cash trap</span>
              </div>
            </div>
          </div>

          <!-- Quick Action: Apply All Suggestions -->
          <div v-if="hasSuggestions" class="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2 text-purple-900">
              <Sparkles class="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>{{ auditResult.summary.overorderedCount + auditResult.summary.underorderedCount }} Item Adjustments Recommended:</strong>
                Balance inventory runway and prevent price leakage.
              </span>
            </div>
            <button
              @click="applyAllSuggestions"
              class="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              Apply All Suggested Quantities
            </button>
          </div>

          <!-- Audited Line-by-Line Table -->
          <div class="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700">Detailed Line-Item Audit</h4>
              <span class="text-xs text-gray-500">{{ auditResult.items.length }} verified against catalog & invoices</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs divide-y divide-gray-200">
                <thead class="bg-gray-50/50 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th class="py-2.5 px-3">Item</th>
                    <th class="py-2.5 px-3 text-right">Proposed Qty</th>
                    <th class="py-2.5 px-3 text-right">Suggested Qty</th>
                    <th class="py-2.5 px-3 text-right">Quoted Rate</th>
                    <th class="py-2.5 px-3 text-right">Last Purchase</th>
                    <th class="py-2.5 px-3 text-center">Projected Runway</th>
                    <th class="py-2.5 px-3">Status & Notes</th>
                    <th class="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr 
                    v-for="(it, idx) in auditResult.items" 
                    :key="idx"
                    class="hover:bg-gray-50/70 transition-colors"
                  >
                    <!-- Item Name -->
                    <td class="py-2.5 px-3 font-medium text-gray-900 max-w-[200px] truncate" :title="it.name">
                      {{ it.name }}
                    </td>

                    <!-- Proposed Qty -->
                    <td class="py-2.5 px-3 text-right font-bold text-gray-800">
                      {{ it.proposedQty }}
                    </td>

                    <!-- Suggested Qty -->
                    <td class="py-2.5 px-3 text-right font-black" :class="it.suggestedQty !== it.proposedQty ? 'text-purple-700' : 'text-gray-700'">
                      {{ it.suggestedQty }}
                    </td>

                    <!-- Quoted Rate -->
                    <td class="py-2.5 px-3 text-right font-semibold text-gray-900">
                      ₹{{ formatNumber(it.unitPrice) }}
                    </td>

                    <!-- Last Purchase Rate -->
                    <td class="py-2.5 px-3 text-right text-gray-500">
                      <span v-if="it.lastPurchasePrice">₹{{ formatNumber(it.lastPurchasePrice) }}</span>
                      <span v-else class="text-gray-400 italic">No history</span>
                    </td>

                    <!-- Projected Runway -->
                    <td class="py-2.5 px-3 text-center">
                      <span 
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
                        :class="it.projectedRunwayDays > 45 ? 'bg-amber-100 text-amber-800' : it.projectedRunwayDays < 15 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'"
                      >
                        {{ it.projectedRunwayDays >= 999 ? 'Non-moving' : it.projectedRunwayDays + ' days' }}
                      </span>
                    </td>

                    <!-- Issues / Notes -->
                    <td class="py-2.5 px-3">
                      <div v-if="it.issues.length > 0" class="space-y-1">
                        <div 
                          v-for="(iss, iIdx) in it.issues" 
                          :key="iIdx"
                          class="text-[11px] font-medium flex items-start gap-1"
                          :class="iss.includes('Over-ordering') ? 'text-amber-700' : iss.includes('Price Alert') ? 'text-rose-700' : 'text-indigo-700'"
                        >
                          <AlertTriangle v-if="iss.includes('Price Alert') || iss.includes('Over-ordering')" class="w-3 h-3 shrink-0 mt-0.5" />
                          <Info v-else class="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{{ iss }}</span>
                        </div>
                      </div>
                      <div v-else class="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        <span>Optimal order quantity & price</span>
                      </div>
                    </td>

                    <!-- Action -->
                    <td class="py-2.5 px-3 text-center">
                      <button
                        v-if="it.suggestedQty !== it.proposedQty"
                        @click="applySingleSuggestion(idx, it.suggestedQty)"
                        class="px-2 py-1 text-[11px] font-bold rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer transition-colors"
                        title="Adopt suggested quantity"
                      >
                        Apply {{ it.suggestedQty }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 sm:px-6 sm:py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <span class="text-xs text-gray-500">
          Pure deterministic evaluation &bull; Zero AI hallucinations
        </span>
        <div class="flex items-center gap-2.5">
          <button
            @click="close"
            type="button"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 cursor-pointer shadow-2xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Sparkles,
  X,
  Plus,
  Trash2,
  Package,
  Download,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  suggestedItems?: Array<{
    name: string
    suggestedPOQty: number
    costPrice?: number
    activeAds?: number
  }>
}>()

const emit = defineEmits(['close'])

interface POItemInput {
  name: string
  qty: number
  unitPrice?: number
}

const items = ref<POItemInput[]>([
  { name: '', qty: 10, unitPrice: undefined }
])

const loading = ref(false)
const auditResult = ref<any>(null)

function close() {
  emit('close')
}

function addItemRow() {
  items.value.push({ name: '', qty: 10, unitPrice: undefined })
}

function removeItemRow(idx: number) {
  if (items.value.length > 1) {
    items.value.splice(idx, 1)
  }
}

function importSuggestedReorders() {
  if (!props.suggestedItems || props.suggestedItems.length === 0) return
  items.value = props.suggestedItems.map(si => ({
    name: si.name,
    qty: si.suggestedPOQty || 10,
    unitPrice: si.costPrice || undefined
  }))
  auditResult.value = null
}

const draftTotalValue = computed(() => {
  return items.value.reduce((sum, i) => sum + ((i.qty || 0) * (i.unitPrice || 0)), 0)
})

const hasSuggestions = computed(() => {
  if (!auditResult.value) return false
  return auditResult.value.items.some((i: any) => i.suggestedQty !== i.proposedQty)
})

const scoreCardColorClass = computed(() => {
  if (!auditResult.value) return ''
  const s = auditResult.value.score
  if (s >= 85) return 'bg-emerald-50 text-emerald-950 border-emerald-200'
  if (s >= 70) return 'bg-amber-50 text-amber-950 border-amber-200'
  return 'bg-rose-50 text-rose-950 border-rose-200'
})

const gradeBadgeClass = computed(() => {
  if (!auditResult.value) return ''
  const s = auditResult.value.score
  if (s >= 85) return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (s >= 70) return 'bg-amber-100 text-amber-800 border-amber-300'
  return 'bg-rose-100 text-rose-800 border-rose-300'
})

const scoreExplanation = computed(() => {
  if (!auditResult.value) return ''
  const s = auditResult.value.score
  if (s >= 90) return 'Optimal purchase order. Items match target 30-day runway with stable demand velocity.'
  if (s >= 75) return 'Acceptable draft, but a few items are over-ordered or have higher price quotes.'
  return 'High capital risk. Order contains excessive stock or items with declining demand trends.'
})

async function runAudit() {
  const validItems = items.value.filter(i => i.name.trim() && i.qty > 0)
  if (validItems.length === 0) return

  loading.value = true
  try {
    const res = await $fetch<any>('/api/analytics/simulate-po', {
      method: 'POST',
      body: { items: validItems }
    })
    if (res && res.success) {
      auditResult.value = res
    }
  } catch (err: any) {
    console.error('Audit failed:', err)
  } finally {
    loading.value = false
  }
}

function applySingleSuggestion(idx: number, newQty: number) {
  if (items.value[idx]) {
    items.value[idx].qty = newQty
  }
  if (auditResult.value && auditResult.value.items[idx]) {
    auditResult.value.items[idx].proposedQty = newQty
    auditResult.value.items[idx].suggestedQty = newQty
    auditResult.value.items[idx].issues = auditResult.value.items[idx].issues.filter(
      (iss: string) => !iss.includes('Over-ordering') && !iss.includes('Under-ordering')
    )
  }
}

function applyAllSuggestions() {
  if (!auditResult.value) return
  auditResult.value.items.forEach((it: any, idx: number) => {
    if (items.value[idx]) {
      items.value[idx].qty = it.suggestedQty
    }
    it.proposedQty = it.suggestedQty
    it.issues = it.issues.filter(
      (iss: string) => !iss.includes('Over-ordering') && !iss.includes('Under-ordering')
    )
  })
  // Re-run audit to show fresh 100/100 score!
  runAudit()
}

function formatNumber(val: number | undefined): string {
  if (val === undefined || val === null) return '0'
  return Number(val).toLocaleString('en-IN')
}
</script>
