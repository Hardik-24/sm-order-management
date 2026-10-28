<template>
  <div class="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
    <!-- Header: Title & Info -->
    <div class="flex items-center justify-between pb-3 border-b border-gray-100">
      <div>
        <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
          <Crown class="w-4 h-4 text-amber-500" />
          B2B Account Concentration (Pareto 80/20)
        </h2>
        <p class="text-xs text-gray-500 mt-0.5">Revenue dependency across top institutional wholesale accounts</p>
      </div>

      <span class="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
        VIP Tiering
      </span>
    </div>

    <!-- Stacked Concentration Bar -->
    <div class="mt-4 space-y-2">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>Turnover Breakdown by Account Tier</span>
        <span class="font-bold text-gray-800">{{ pareto?.top10SharePct || 0 }}% by Top 10</span>
      </div>

      <!-- Segmented Bar -->
      <div class="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-2xs">
        <!-- Tier 1: Top 5 VIP -->
        <div 
          class="bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-105 transition-all relative group cursor-pointer"
          :style="{ width: `${pareto?.top5SharePct || 0}%` }"
          @click="selectTier('vip')"
        >
          <span class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none transition-opacity">
            Top 5 VIPs: {{ pareto?.top5SharePct || 0 }}% ({{ formatCrores(pareto?.top5Spend) }})
          </span>
        </div>

        <!-- Tier 2: Next 6-10 Gold -->
        <div 
          class="bg-gradient-to-r from-indigo-500 to-indigo-400 hover:brightness-105 transition-all relative group cursor-pointer"
          :style="{ width: `${Math.max(0, (pareto?.top10SharePct || 0) - (pareto?.top5SharePct || 0))}%` }"
          @click="selectTier('gold')"
        >
          <span class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none transition-opacity">
            Rank 6-10: {{ Math.max(0, (pareto?.top10SharePct || 0) - (pareto?.top5SharePct || 0)).toFixed(1) }}%
          </span>
        </div>

        <!-- Tier 3: Balance Long-Tail -->
        <div 
          class="bg-gradient-to-r from-slate-300 to-slate-200 hover:brightness-95 transition-all relative group flex-1 cursor-pointer"
          @click="selectTier('all')"
        >
          <span class="opacity-0 group-hover:opacity-100 absolute -top-8 right-2 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none transition-opacity">
            Long-Tail Dealers: {{ Math.max(0, 100 - (pareto?.top10SharePct || 0)).toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Tiers Breakdown Cards (3 Columns) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 text-xs">
      <!-- Tier 1 -->
      <div 
        @click="selectTier('vip')"
        class="p-3 rounded-xl border transition-all cursor-pointer"
        :class="activeTier === 'vip' ? 'bg-amber-50/80 border-amber-300 shadow-2xs' : 'bg-gray-50/60 border-gray-200/80 hover:bg-amber-50/40'"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-amber-900 flex items-center gap-1">
            <span>⭐ Top 5 VIPs</span>
          </span>
          <span class="font-extrabold text-amber-700">{{ pareto?.top5SharePct || 0 }}%</span>
        </div>
        <div class="text-sm font-black text-gray-900 mt-1 tabular-nums">
          {{ formatCrores(pareto?.top5Spend) }}
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">High retention focus</div>
      </div>

      <!-- Tier 2 -->
      <div 
        @click="selectTier('gold')"
        class="p-3 rounded-xl border transition-all cursor-pointer"
        :class="activeTier === 'gold' ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs' : 'bg-gray-50/60 border-gray-200/80 hover:bg-indigo-50/40'"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-indigo-900">Rank 6-10 Gold</span>
          <span class="font-extrabold text-indigo-700">
            {{ Math.max(0, (pareto?.top10SharePct || 0) - (pareto?.top5SharePct || 0)).toFixed(1) }}%
          </span>
        </div>
        <div class="text-sm font-black text-gray-900 mt-1 tabular-nums">
          {{ formatCrores(Math.max(0, (pareto?.top10Spend || 0) - (pareto?.top5Spend || 0))) }}
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">Growth accounts</div>
      </div>

      <!-- Tier 3 -->
      <div 
        @click="selectTier('all')"
        class="p-3 rounded-xl border transition-all cursor-pointer"
        :class="activeTier === 'all' ? 'bg-slate-100 border-slate-300 shadow-2xs' : 'bg-gray-50/60 border-gray-200/80 hover:bg-gray-100'"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-gray-700">Long-Tail Dealers</span>
          <span class="font-extrabold text-gray-600">
            {{ Math.max(0, 100 - (pareto?.top10SharePct || 0)).toFixed(1) }}%
          </span>
        </div>
        <div class="text-sm font-black text-gray-900 mt-1 tabular-nums">
          {{ formatCrores(Math.max(0, totalSalesRevenue - (pareto?.top10Spend || 0))) }}
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">Retail distribution</div>
      </div>
    </div>

    <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
      <span>Click a tier to filter the customer accounts table</span>
      <span v-if="activeTier !== 'all'" class="text-indigo-600 font-semibold cursor-pointer" @click="selectTier('all')">Show all tiers</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Crown } from 'lucide-vue-next'

export interface ParetoConcentration {
  top5Spend: number
  top5SharePct: number
  top10Spend: number
  top10SharePct: number
  top25Spend: number
  top25SharePct: number
}

const props = withDefaults(defineProps<{
  pareto?: ParetoConcentration | null
  totalSalesRevenue?: number
}>(), {
  pareto: null,
  totalSalesRevenue: 0
})

const emit = defineEmits<{
  (e: 'select-tier', tier: 'all' | 'vip' | 'gold'): void
}>()

const activeTier = ref<'all' | 'vip' | 'gold'>('all')

const selectTier = (tier: 'all' | 'vip' | 'gold') => {
  activeTier.value = tier
  emit('select-tier', tier)
}

function formatCurrency(val: number | undefined): string {
  if (!val) return '₹0'
  return '₹' + Math.round(val).toLocaleString('en-IN')
}

function formatCrores(val: number | undefined): string {
  if (!val) return '₹0'
  const n = Number(val)
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L'
  return formatCurrency(n)
}
</script>
