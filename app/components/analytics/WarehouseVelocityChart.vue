<template>
  <div class="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
    <!-- Header: Title, Metric Legend & View Selector -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
      <div>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
            <Activity class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Monthly Warehouse Movement Velocity
              <span class="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 hidden sm:inline-flex">
                Inflow vs Outflow
              </span>
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Stock movement rhythm comparing vendor receipts vs customer dispatches
            </p>
          </div>
        </div>
      </div>

      <!-- Legend & Filter -->
      <div class="flex items-center gap-4 text-xs font-semibold">
        <span class="flex items-center gap-1.5 text-emerald-700">
          <span class="w-3 h-3 rounded bg-emerald-500"></span> Inward Receipts
        </span>
        <span class="flex items-center gap-1.5 text-rose-600">
          <span class="w-3 h-3 rounded bg-rose-500"></span> Outward Dispatches
        </span>
      </div>
    </div>

    <!-- Quick Movement Metrics Ribbon -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 px-3.5 bg-slate-50/80 rounded-xl border border-slate-100 my-4 text-xs">
      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Inward (GRN)</span>
        <div class="text-base sm:text-lg font-black text-emerald-700 mt-0.5 tabular-nums">
          +{{ formatNumber(totalInward) }} <span class="text-xs font-medium text-gray-500">units</span>
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Outward (Sales)</span>
        <div class="text-base sm:text-lg font-black text-rose-600 mt-0.5 tabular-nums">
          -{{ formatNumber(totalOutward) }} <span class="text-xs font-medium text-gray-500">units</span>
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Net Inventory Delta</span>
        <div class="text-base sm:text-lg font-black mt-0.5 tabular-nums" :class="netDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'">
          {{ netDelta >= 0 ? '+' : '' }}{{ formatNumber(netDelta) }} <span class="text-xs font-medium text-gray-500">units</span>
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Fulfillment Ratio</span>
        <div class="text-base sm:text-lg font-black text-indigo-700 mt-0.5 tabular-nums">
          {{ fulfillmentRatio }}% <span class="text-xs font-medium text-gray-500">turnover</span>
        </div>
      </div>
    </div>

    <!-- Interactive Visual Bar Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mt-2">
      <div 
        v-for="(m, idx) in monthlyFlow" 
        :key="m.label"
        @mouseenter="hoveredIndex = idx"
        @mouseleave="hoveredIndex = null"
        class="flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer relative"
        :class="hoveredIndex === idx ? 'bg-sky-50/40 border-sky-300 shadow-xs' : 'bg-gray-50/60 border-gray-100 hover:bg-gray-100/60'"
      >
        <!-- Month Label -->
        <span class="text-xs font-bold text-gray-800 mb-2 truncate max-w-full">{{ m.label }}</span>
        
        <!-- Bars Container -->
        <div class="w-full flex items-end justify-center gap-2.5 h-32 pb-1 border-b border-gray-200">
          <!-- Inward Bar -->
          <div class="w-4 bg-emerald-500 rounded-t-md transition-all duration-300 relative group flex items-end justify-center hover:brightness-110" :style="{ height: getBarHeight(m.inward) + '%' }">
            <span class="opacity-0 group-hover:opacity-100 absolute -top-7 text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-20 transition-opacity">
              +{{ formatNumber(m.inward) }}
            </span>
          </div>

          <!-- Outward Bar -->
          <div class="w-4 bg-rose-500 rounded-t-md transition-all duration-300 relative group flex items-end justify-center hover:brightness-110" :style="{ height: getBarHeight(m.outward) + '%' }">
            <span class="opacity-0 group-hover:opacity-100 absolute -top-7 text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-20 transition-opacity">
              -{{ formatNumber(m.outward) }}
            </span>
          </div>
        </div>

        <!-- Month Stat Details -->
        <div class="mt-2.5 text-[11px] space-y-1 w-full">
          <div class="flex justify-between text-gray-500">
            <span>In:</span> 
            <span class="font-bold text-emerald-700 tabular-nums">{{ formatNumber(m.inward) }}</span>
          </div>
          <div class="flex justify-between text-gray-500">
            <span>Out:</span> 
            <span class="font-bold text-rose-600 tabular-nums">{{ formatNumber(m.outward) }}</span>
          </div>
          <div 
            class="flex justify-between font-extrabold pt-1 border-t border-gray-200/80 text-[11.5px] tabular-nums" 
            :class="m.net >= 0 ? 'text-emerald-700' : 'text-rose-600'"
          >
            <span>Net:</span> 
            <span>{{ m.net >= 0 ? '+' : '' }}{{ formatNumber(m.net) }}</span>
          </div>
        </div>

        <!-- Net Badge Indicator -->
        <div class="mt-2 w-full">
          <span 
            class="w-full text-center block text-[9.5px] font-bold py-0.5 rounded-md"
            :class="m.net >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'"
          >
            {{ m.net >= 0 ? 'Stock Surplus' : 'Stock Depletion' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Activity } from 'lucide-vue-next'

export interface MonthlyMovementItem {
  month: number
  year: number
  label: string
  inward: number
  outward: number
  net: number
}

const props = withDefaults(defineProps<{
  monthlyFlow?: MonthlyMovementItem[]
}>(), {
  monthlyFlow: () => []
})

const hoveredIndex = ref<number | null>(null)

// Max height scaling
const maxVal = computed(() => {
  if (!props.monthlyFlow.length) return 100
  const max = Math.max(
    ...props.monthlyFlow.map(m => Math.max(m.inward || 0, m.outward || 0))
  )
  return max > 0 ? max : 100
})

const getBarHeight = (val: number) => {
  if (val <= 0) return 4
  return Math.min(100, Math.max(8, Math.round((val / maxVal.value) * 100)))
}

// Summary Metrics
const totalInward = computed(() => {
  return props.monthlyFlow.reduce((sum, m) => sum + (m.inward || 0), 0)
})

const totalOutward = computed(() => {
  return props.monthlyFlow.reduce((sum, m) => sum + (m.outward || 0), 0)
})

const netDelta = computed(() => {
  return totalInward.value - totalOutward.value
})

const fulfillmentRatio = computed(() => {
  if (totalInward.value === 0) return 100
  return Math.min(150, Math.round((totalOutward.value / totalInward.value) * 100))
})

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '0'
  return Math.round(num).toLocaleString('en-IN')
}
</script>
