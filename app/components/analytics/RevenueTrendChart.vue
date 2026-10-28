<template>
  <div class="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
    <!-- Header: Title, Metric Mode Toggle & Stats Ribbon -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
      <div>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <TrendingUp class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Monthly Revenue & Sales Velocity
              <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-flex">
                Live Timeline
              </span>
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Historical monthly billing performance and transaction volume trends
            </p>
          </div>
        </div>
      </div>

      <!-- Mode Switcher (Revenue vs Volume) -->
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80 shrink-0">
          <button
            type="button"
            @click="chartMode = 'revenue'"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            :class="chartMode === 'revenue' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
          >
            <IndianRupee class="w-3.5 h-3.5 text-emerald-600" />
            <span>Revenue (₹)</span>
          </button>
          <button
            type="button"
            @click="chartMode = 'volume'"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            :class="chartMode === 'volume' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
          >
            <BarChart2 class="w-3.5 h-3.5 text-sky-600" />
            <span>Invoices (Count)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Performance Ribbon -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 px-3.5 bg-slate-50/80 rounded-xl border border-slate-100 my-4 text-xs">
      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Peak Month</span>
        <div class="font-bold text-gray-900 mt-0.5 flex items-baseline gap-1 truncate">
          <span class="text-emerald-700">{{ peakMonth?.label || 'N/A' }}</span>
          <span class="text-[11px] text-gray-500 font-normal">({{ chartMode === 'revenue' ? formatCrores(peakMonth?.revenue) : `${peakMonth?.count || 0} bills` }})</span>
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Monthly Average</span>
        <div class="font-bold text-gray-900 mt-0.5 tabular-nums">
          {{ chartMode === 'revenue' ? formatCurrency(averageMonthlyRevenue) : `${averageMonthlyCount} invoices/mo` }}
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Recorded</span>
        <div class="font-bold text-gray-900 mt-0.5 tabular-nums">
          {{ chartMode === 'revenue' ? formatCrores(totalTimelineRevenue) : `${totalTimelineInvoices} total bills` }}
        </div>
      </div>

      <div>
        <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Recent Momentum</span>
        <div class="font-bold mt-0.5 flex items-center gap-1" :class="latestMoMGrowth >= 0 ? 'text-emerald-700' : 'text-rose-600'">
          <span>{{ latestMoMGrowth >= 0 ? '▲ +' : '▼ ' }}{{ Math.abs(latestMoMGrowth) }}%</span>
          <span class="text-[10px] text-gray-400 font-normal">MoM</span>
        </div>
      </div>
    </div>

    <!-- Interactive SVG Chart Area -->
    <div 
      ref="containerRef"
      class="relative w-full h-64 sm:h-72 select-none touch-none mt-2"
      @mousemove="handlePointerMove"
      @mouseleave="hoveredIndex = null"
      @touchstart="handleTouch"
      @touchmove="handleTouch"
      @touchend="hoveredIndex = null"
    >
      <svg 
        class="w-full h-full overflow-visible"
        :viewBox="`0 0 ${viewWidth} ${viewHeight}`"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Horizontal Guide Lines -->
        <g class="text-gray-200 stroke-current" stroke-dasharray="3 3" stroke-width="1">
          <line :x1="padLeft" :y1="padTop" :x2="viewWidth - padRight" :y2="padTop" />
          <line :x1="padLeft" :y1="padTop + chartH * 0.33" :x2="viewWidth - padRight" :y2="padTop + chartH * 0.33" />
          <line :x1="padLeft" :y1="padTop + chartH * 0.66" :x2="viewWidth - padRight" :y2="padTop + chartH * 0.66" />
          <line :x1="padLeft" :y1="viewHeight - padBottom" :x2="viewWidth - padRight" :y2="viewHeight - padBottom" stroke-dasharray="0" stroke="#e2e8f0" stroke-width="1.5" />
        </g>

        <!-- Y-Axis Labels -->
        <g class="text-[10px] font-medium fill-gray-400 font-mono" text-anchor="end">
          <text :x="padLeft - 8" :y="padTop + 4">{{ chartMode === 'revenue' ? formatCrores(maxVal) : maxVal }}</text>
          <text :x="padLeft - 8" :y="padTop + chartH * 0.5 + 4">{{ chartMode === 'revenue' ? formatCrores(maxVal / 2) : Math.round(maxVal / 2) }}</text>
          <text :x="padLeft - 8" :y="viewHeight - padBottom">{{ chartMode === 'revenue' ? '₹0' : '0' }}</text>
        </g>

        <!-- Smooth Filled Area -->
        <path 
          v-if="areaPath"
          :d="areaPath" 
          :fill="chartMode === 'revenue' ? 'url(#revenueGradient)' : 'url(#volumeGradient)'" 
          class="transition-all duration-500 ease-out"
        />

        <!-- Smooth Curve Line -->
        <path 
          v-if="linePath"
          :d="linePath" 
          fill="none" 
          :stroke="chartMode === 'revenue' ? '#059669' : '#0284c7'" 
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-all duration-500 ease-out"
        />

        <!-- Data Point Circles -->
        <g v-for="(p, i) in points" :key="p.ym">
          <circle 
            :cx="p.x" 
            :cy="p.y" 
            :r="hoveredIndex === i ? 6 : 4" 
            :fill="hoveredIndex === i ? '#ffffff' : (chartMode === 'revenue' ? '#059669' : '#0284c7')" 
            :stroke="chartMode === 'revenue' ? '#059669' : '#0284c7'" 
            stroke-width="2.5"
            class="transition-all duration-200 cursor-pointer"
          />
        </g>

        <!-- Interactive Vertical Scrubber Line -->
        <line 
          v-if="activePoint"
          :x1="activePoint.x" 
          :y1="padTop" 
          :x2="activePoint.x" 
          :y2="viewHeight - padBottom" 
          stroke="#1b3b5f" 
          stroke-width="1.5"
          stroke-dasharray="4 3"
          class="pointer-events-none transition-all duration-75"
        />

        <!-- X-Axis Month Labels -->
        <g class="text-[11px] font-semibold fill-gray-500" text-anchor="middle">
          <text 
            v-for="(p, i) in points" 
            :key="p.ym"
            :x="p.x" 
            :y="viewHeight - 6"
            :class="hoveredIndex === i ? 'fill-gray-900 font-bold' : ''"
          >
            {{ p.label }}
          </text>
        </g>
      </svg>

      <!-- Glass-Morphic Scrubber Tooltip -->
      <div 
        v-if="activePoint"
        class="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full transition-all duration-100 ease-out"
        :style="{ left: `${activePointPixelX}px`, top: `${activePointPixelY - 14}px` }"
      >
        <div class="bg-gray-900/95 backdrop-blur-md text-white rounded-xl py-2 px-3 shadow-xl border border-white/10 text-xs min-w-[170px] space-y-1">
          <div class="flex items-center justify-between border-b border-gray-700/80 pb-1 gap-2">
            <span class="font-bold text-gray-200">{{ activePoint.label }}</span>
            <span 
              v-if="activePoint.momGrowth !== null"
              class="px-1.5 py-0.2 rounded text-[10px] font-bold"
              :class="activePoint.momGrowth >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'"
            >
              {{ activePoint.momGrowth >= 0 ? '+' : '' }}{{ activePoint.momGrowth }}% MoM
            </span>
          </div>

          <div class="flex items-center justify-between text-[11px] pt-0.5">
            <span class="text-gray-400">Total Billed:</span>
            <span class="font-extrabold text-emerald-400 tabular-nums">{{ formatCurrency(activePoint.revenue) }}</span>
          </div>

          <div class="flex items-center justify-between text-[11px]">
            <span class="text-gray-400">Invoices:</span>
            <span class="font-bold text-sky-300 tabular-nums">{{ activePoint.count }} bills</span>
          </div>

          <div class="flex items-center justify-between text-[10.5px] text-gray-400 border-t border-gray-800 pt-1">
            <span>Avg Ticket:</span>
            <span class="text-gray-200 tabular-nums">{{ formatCurrency(activePoint.avgInvoiceValue) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { TrendingUp, BarChart2, IndianRupee } from 'lucide-vue-next'

export interface MonthTrendItem {
  ym: string
  label: string
  count: number
  revenue: number
  taxable: number
  tax: number
  avgInvoiceValue: number
  momGrowth: number | null
}

const props = withDefaults(defineProps<{
  timeline?: MonthTrendItem[]
}>(), {
  timeline: () => []
})

const chartMode = ref<'revenue' | 'volume'>('revenue')
const hoveredIndex = ref<number | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// Virtual SVG Viewport
const viewWidth = 640
const viewHeight = 220
const padLeft = 46
const padRight = 24
const padTop = 18
const padBottom = 26
const chartW = viewWidth - padLeft - padRight
const chartH = viewHeight - padTop - padBottom

// Max ceiling calculation
const maxVal = computed(() => {
  if (!props.timeline.length) return 100
  const vals = props.timeline.map(d => chartMode.value === 'revenue' ? (d.revenue || 0) : (d.count || 0))
  const max = Math.max(...vals, 0)
  return max > 0 ? max * 1.12 : 100 // 12% headroom for pleasant aesthetics
})

// Points Mapping
const points = computed(() => {
  const data = props.timeline
  if (!data.length) return []
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2
  return data.map((d, i) => {
    const val = chartMode.value === 'revenue' ? (d.revenue || 0) : (d.count || 0)
    const ratio = Math.min(1, Math.max(0, val / maxVal.value))
    const x = padLeft + (data.length > 1 ? i * stepX : chartW / 2)
    const y = viewHeight - padBottom - (ratio * chartH)
    return {
      ...d,
      x,
      y,
      val
    }
  })
})

// Catmull-Rom or Cardinal Spline for Smooth Curves
function generateSmoothPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

const linePath = computed(() => generateSmoothPath(points.value))

const areaPath = computed(() => {
  if (!points.value.length) return ''
  const smoothLine = generateSmoothPath(points.value)
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const baseline = viewHeight - padBottom
  return `${smoothLine} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
})

// Active Scrubber tracking
const activePoint = computed(() => {
  if (hoveredIndex.value === null || !points.value[hoveredIndex.value]) return null
  return points.value[hoveredIndex.value]
})

const activePointPixelX = computed(() => {
  if (!containerRef.value || !activePoint.value) return 0
  const rect = containerRef.value.getBoundingClientRect()
  return (activePoint.value.x / viewWidth) * rect.width
})

const activePointPixelY = computed(() => {
  if (!containerRef.value || !activePoint.value) return 0
  const rect = containerRef.value.getBoundingClientRect()
  return (activePoint.value.y / viewHeight) * rect.height
})

// Scrubber Pointer interaction
const handlePointerMove = (e: MouseEvent) => {
  if (!containerRef.value || !points.value.length) return
  const rect = containerRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const svgX = (mouseX / rect.width) * viewWidth

  // Find closest point by X coordinate
  let closestIdx = 0
  let minDist = Infinity
  points.value.forEach((p, idx) => {
    const dist = Math.abs(p.x - svgX)
    if (dist < minDist) {
      minDist = dist
      closestIdx = idx
    }
  })
  hoveredIndex.value = closestIdx
}

const handleTouch = (e: TouchEvent) => {
  if (!containerRef.value || !points.value.length || !e.touches[0]) return
  const rect = containerRef.value.getBoundingClientRect()
  const touchX = e.touches[0].clientX - rect.left
  const svgX = (touchX / rect.width) * viewWidth

  let closestIdx = 0
  let minDist = Infinity
  points.value.forEach((p, idx) => {
    const dist = Math.abs(p.x - svgX)
    if (dist < minDist) {
      minDist = dist
      closestIdx = idx
    }
  })
  hoveredIndex.value = closestIdx
}

// Summary Metrics
const peakMonth = computed(() => {
  if (!props.timeline.length) return null
  return props.timeline.reduce((prev, curr) => {
    const prevVal = chartMode.value === 'revenue' ? prev.revenue : prev.count
    const currVal = chartMode.value === 'revenue' ? curr.revenue : curr.count
    return currVal > prevVal ? curr : prev
  }, props.timeline[0])
})

const totalTimelineRevenue = computed(() => {
  return props.timeline.reduce((sum, d) => sum + (d.revenue || 0), 0)
})

const totalTimelineInvoices = computed(() => {
  return props.timeline.reduce((sum, d) => sum + (d.count || 0), 0)
})

const averageMonthlyRevenue = computed(() => {
  if (!props.timeline.length) return 0
  return Math.round(totalTimelineRevenue.value / props.timeline.length)
})

const averageMonthlyCount = computed(() => {
  if (!props.timeline.length) return 0
  return Math.round(totalTimelineInvoices.value / props.timeline.length)
})

const latestMoMGrowth = computed(() => {
  if (!props.timeline.length) return 0
  const last = props.timeline[props.timeline.length - 1]
  return last?.momGrowth !== null && last?.momGrowth !== undefined ? last.momGrowth : 0
})

// Format helpers
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
