<script setup lang="ts">
import { ref, computed } from 'vue'
import { TrendingUp, Calendar, Clock, BarChart2 } from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'

export interface OrderTrendDay {
  key?: string
  label: string
  fullDate?: string
  count: number
  totalAmount: number
  isToday?: boolean
}

export interface OrderTrendsPayload {
  last7Days: OrderTrendDay[]
  todayHourly: OrderTrendDay[]
  last30Days: OrderTrendDay[]
}

const props = withDefaults(defineProps<{
  trends?: OrderTrendsPayload | null
  isLoading?: boolean
}>(), {
  trends: null,
  isLoading: false
})

type Timeframe = '7d' | 'today' | '30d'
const selectedTimeframe = ref<Timeframe>('7d')

const hoveredIndex = ref<number | null>(null)

// Current dataset based on active timeframe
const currentData = computed<OrderTrendDay[]>(() => {
  if (!props.trends) return []
  if (selectedTimeframe.value === 'today') return props.trends.todayHourly || []
  if (selectedTimeframe.value === '30d') return props.trends.last30Days || []
  return props.trends.last7Days || []
})

// Max count for scaling bar heights
const maxCount = computed(() => {
  const counts = currentData.value.map(d => d.count || 0)
  const max = Math.max(...counts, 0)
  return max > 0 ? max : 5 // Default scale ceiling of 5 if empty
})

// Summary Metrics
const totalOrders = computed(() => {
  return currentData.value.reduce((acc, d) => acc + (d.count || 0), 0)
})

const totalValue = computed(() => {
  return currentData.value.reduce((acc, d) => acc + (d.totalAmount || 0), 0)
})

const peakItem = computed(() => {
  if (!currentData.value.length) return null
  return currentData.value.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), currentData.value[0])
})

const avgOrders = computed(() => {
  if (!currentData.value.length) return '0'
  const len = selectedTimeframe.value === '30d' ? 30 : (selectedTimeframe.value === '7d' ? 7 : currentData.value.length)
  const avg = totalOrders.value / len
  return avg < 1 && avg > 0 ? avg.toFixed(1) : Math.round(avg).toString()
})

const getBarHeight = (count: number) => {
  if (count <= 0) return 6 // Minimum 6% visible nub
  return Math.min(Math.max(Math.round((count / maxCount.value) * 100), 12), 100)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
    <!-- Header: Title, Total Badge & Timeframe Selector -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-[#e8eff7] text-[#1b3b5f] flex items-center justify-center shrink-0">
            <BarChart2 class="w-4 h-4" />
          </div>
          <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Orders Placed Trend</h2>
        </div>
        <p class="text-xs text-gray-500 mt-0.5 ml-9">
          {{ selectedTimeframe === 'today' ? "Today's intake volume by time slot" : (selectedTimeframe === '7d' ? "Daily order volume over the last 7 days" : "30-day order intake velocity") }}
        </p>
      </div>

      <!-- Segmented Timeframe Switcher -->
      <div class="inline-flex items-center bg-gray-100 p-1 rounded-xl self-start sm:self-auto border border-gray-200/80">
        <button
          type="button"
          @click="selectedTimeframe = '7d'"
          class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          :class="selectedTimeframe === '7d' ? 'bg-white text-[#1b3b5f] shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
        >
          Last 7 Days
        </button>
        <button
          type="button"
          @click="selectedTimeframe = 'today'"
          class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          :class="selectedTimeframe === 'today' ? 'bg-white text-[#1b3b5f] shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
        >
          Today
        </button>
        <button
          type="button"
          @click="selectedTimeframe = '30d'"
          class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          :class="selectedTimeframe === '30d' ? 'bg-white text-[#1b3b5f] shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
        >
          30 Days
        </button>
      </div>
    </div>

    <!-- Metrics Ribbon -->
    <div class="grid grid-cols-3 gap-2 py-3 px-3.5 bg-slate-50/80 rounded-xl border border-slate-100 mb-5">
      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Intake</span>
        <div class="flex items-baseline gap-1 mt-0.5">
          <span class="text-xl sm:text-2xl font-extrabold text-[#1b3b5f] tabular-nums">{{ totalOrders }}</span>
          <span class="text-[11px] font-semibold text-gray-500">{{ totalOrders === 1 ? 'order' : 'orders' }}</span>
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Billed Value</span>
        <div class="mt-0.5">
          <span class="text-base sm:text-lg font-bold text-gray-800 tabular-nums truncate block">
            {{ formatCurrency(totalValue) }}
          </span>
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
          {{ selectedTimeframe === 'today' ? 'Busiest Slot' : 'Peak Day' }}
        </span>
        <div class="mt-0.5 flex items-center gap-1">
          <span v-if="peakItem && peakItem.count > 0" class="text-xs sm:text-sm font-bold text-emerald-700 truncate">
            {{ peakItem.label }} ({{ peakItem.count }})
          </span>
          <span v-else class="text-xs text-gray-400">
            No rush recorded
          </span>
        </div>
      </div>
    </div>

    <!-- Chart Visualization Body -->
    <div class="flex-1 flex flex-col justify-end pt-2">
      <!-- 7-Day & Today View: Clean 7-Bar Layout -->
      <div v-if="selectedTimeframe !== '30d'" class="grid grid-cols-7 gap-1.5 sm:gap-3 items-end h-40 pb-2 border-b border-gray-100">
        <div
          v-for="(item, idx) in currentData"
          :key="item.key || item.label + idx"
          class="flex flex-col items-center justify-end h-full group relative cursor-pointer"
          @mouseenter="hoveredIndex = idx"
          @mouseleave="hoveredIndex = null"
        >
          <!-- Hover Floating Tooltip -->
          <div
            v-if="hoveredIndex === idx"
            class="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none transition-all flex flex-col items-center"
          >
            <span>{{ item.count }} {{ item.count === 1 ? 'Order' : 'Orders' }}</span>
            <span class="text-gray-300 font-normal">{{ formatCurrency(item.totalAmount) }}</span>
            <div class="w-1.5 h-1.5 bg-gray-900 rotate-45 -mb-1"></div>
          </div>

          <!-- Top Count Label (Always visible above bar) -->
          <span
            class="text-[11px] font-bold mb-1.5 transition-colors tabular-nums"
            :class="item.count > 0 ? (item.isToday ? 'text-[#1b3b5f]' : 'text-gray-700') : 'text-gray-300'"
          >
            {{ item.count }}
          </span>

          <!-- The Bar Track -->
          <div class="w-full max-w-[36px] bg-slate-100/90 rounded-t-lg flex flex-col justify-end overflow-hidden h-full">
            <div
              class="w-full rounded-t-lg transition-all duration-500 ease-out"
              :class="item.isToday
                ? 'bg-gradient-to-t from-[#1b3b5f] to-[#2c5889] group-hover:to-[#386da6]' 
                : (item.count > 0 
                  ? 'bg-gradient-to-t from-slate-400 to-[#1b3b5f]/80 group-hover:from-[#1b3b5f] group-hover:to-[#2c5889]' 
                  : 'bg-transparent')"
              :style="{ height: `${getBarHeight(item.count)}%` }"
            ></div>
          </div>

          <!-- Bottom Label: Day / Hour -->
          <div class="mt-2 text-center w-full min-w-0">
            <p
              class="text-xs font-bold truncate transition-colors"
              :class="item.isToday ? 'text-[#1b3b5f] font-extrabold' : 'text-gray-700'"
            >
              {{ item.label }}
            </p>
            <p v-if="item.fullDate" class="text-[10px] text-gray-400 truncate hidden sm:block">
              {{ item.fullDate }}
            </p>
            <span v-if="item.isToday" class="inline-block w-1 h-1 rounded-full bg-[#1b3b5f] mt-0.5 sm:hidden"></span>
          </div>
        </div>
      </div>

      <!-- 30-Day Density Bar View -->
      <div v-else class="h-40 flex flex-col justify-end pb-2 border-b border-gray-100">
        <div class="flex items-end gap-1 sm:gap-1.5 h-32 w-full justify-between">
          <div
            v-for="(item, idx) in currentData"
            :key="item.label + idx"
            class="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
            @mouseenter="hoveredIndex = idx"
            @mouseleave="hoveredIndex = null"
          >
            <!-- Hover Tooltip -->
            <div
              v-if="hoveredIndex === idx"
              class="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-semibold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none"
            >
              <div>{{ item.label }}: <strong>{{ item.count }} orders</strong></div>
              <div class="text-gray-300 font-normal">{{ formatCurrency(item.totalAmount) }}</div>
            </div>

            <div class="w-full bg-slate-100/90 rounded-t-xs h-full flex flex-col justify-end overflow-hidden">
              <div
                class="w-full rounded-t-xs transition-all duration-300"
                :class="item.isToday 
                  ? 'bg-[#1b3b5f]' 
                  : (item.count > 0 ? 'bg-[#1b3b5f]/70 group-hover:bg-[#1b3b5f]' : 'bg-transparent')"
                :style="{ height: `${getBarHeight(item.count)}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 30-Day Date Markers at Bottom -->
        <div class="flex justify-between items-center text-[10px] text-gray-400 pt-2 font-medium">
          <span>30 Days Ago</span>
          <span>15 Days Ago</span>
          <span class="font-bold text-[#1b3b5f]">Today</span>
        </div>
      </div>

      <!-- Footer Info Note -->
      <div class="flex items-center justify-between text-[11px] text-gray-400 pt-3">
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-[#1b3b5f]"></span>
          <span>Orders placed via Sales staff & WhatsApp</span>
        </span>
        <span class="font-medium">
          Avg: <strong class="text-gray-700 font-bold">{{ avgOrders }}</strong> orders/day
        </span>
      </div>
    </div>
  </div>
</template>
