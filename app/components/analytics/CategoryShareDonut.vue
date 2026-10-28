<template>
  <div class="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
    <!-- Header: Title, Active Filter Badge -->
    <div class="flex items-center justify-between pb-3 border-b border-gray-100">
      <div>
        <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
          <PieChart class="w-4 h-4 text-indigo-600" />
          Category Revenue Distribution
        </h2>
        <p class="text-xs text-gray-500 mt-0.5">Product segment revenue contribution & sales volume share</p>
      </div>

      <button
        v-if="selectedCategory"
        @click="emit('select-category', null)"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer border border-indigo-200"
        title="Clear category filter"
      >
        <span>{{ selectedCategory }}</span>
        <X class="w-3 h-3" />
      </button>
    </div>

    <!-- Chart & Legend Container -->
    <div class="flex flex-col md:flex-row items-center gap-6 mt-4">
      <!-- SVG Donut Chart with Center Readout -->
      <div class="relative w-48 h-48 sm:w-52 sm:h-52 shrink-0">
        <svg class="w-full h-full -rotate-90 transform overflow-visible" viewBox="0 0 160 160">
          <!-- Background Base Ring -->
          <circle 
            cx="80" 
            cy="80" 
            r="60" 
            fill="none" 
            stroke="#f1f5f9" 
            stroke-width="20" 
          />

          <!-- Segment Arcs -->
          <circle 
            v-for="(seg, idx) in segments" 
            :key="seg.name"
            cx="80" 
            cy="80" 
            r="60" 
            fill="none" 
            :stroke="seg.color" 
            :stroke-width="hoveredIndex === idx || selectedCategory === seg.name ? 24 : 19" 
            :stroke-dasharray="`${seg.dashLength} ${circumference}`" 
            :stroke-dashoffset="seg.dashOffset" 
            class="transition-all duration-300 cursor-pointer"
            :class="hoveredIndex === idx || selectedCategory === seg.name ? 'opacity-100 drop-shadow-md' : (hoveredIndex !== null ? 'opacity-40' : 'opacity-90')"
            @mouseenter="hoveredIndex = idx"
            @mouseleave="hoveredIndex = null"
            @click="toggleCategory(seg.name)"
          />
        </svg>

        <!-- Dynamic Center Readout -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
          <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider truncate max-w-[120px]">
            {{ activeSegment ? activeSegment.name : 'Total Turnover' }}
          </span>
          <span class="text-base sm:text-lg font-black text-gray-900 tracking-tight mt-0.5 tabular-nums">
            {{ activeSegment ? formatCrores(activeSegment.revenue) : formatCrores(totalRevenue) }}
          </span>
          <span 
            v-if="activeSegment"
            class="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.2 rounded-full border border-indigo-100 mt-1"
          >
            {{ activeSegment.sharePct }}% share
          </span>
          <span v-else class="text-[10px] text-gray-400 mt-0.5">
            {{ categories.length }} Categories
          </span>
        </div>
      </div>

      <!-- Segment Legend Grid -->
      <div class="flex-1 w-full space-y-1.5 max-h-56 overflow-y-auto pr-1 no-scrollbar text-xs">
        <div
          v-for="(seg, idx) in segments"
          :key="seg.name"
          @mouseenter="hoveredIndex = idx"
          @mouseleave="hoveredIndex = null"
          @click="toggleCategory(seg.name)"
          class="flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer"
          :class="[
            selectedCategory === seg.name 
              ? 'bg-indigo-50 border border-indigo-200' 
              : hoveredIndex === idx 
                ? 'bg-gray-50 border border-gray-200' 
                : 'hover:bg-gray-50/70 border border-transparent'
          ]"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: seg.color }"></span>
            <span class="font-bold text-gray-800 truncate" :title="seg.name">{{ seg.name }}</span>
            <span v-if="selectedCategory === seg.name" class="text-[9px] font-bold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.2 rounded">
              Active Filter
            </span>
          </div>

          <div class="flex items-center gap-2.5 text-right shrink-0">
            <span class="font-extrabold text-gray-900 tabular-nums">{{ formatCurrency(seg.revenue) }}</span>
            <span class="font-bold text-gray-500 w-10 text-right tabular-nums">{{ seg.sharePct }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Interactive Hint -->
    <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
      <span>Tip: Click any segment to filter high-performing SKUs below</span>
      <span v-if="selectedCategory" class="text-indigo-600 font-semibold cursor-pointer" @click="emit('select-category', null)">Reset filter</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PieChart, X } from 'lucide-vue-next'

export interface CategoryShareItem {
  name: string
  invoiceCount?: number
  totalQty?: number
  revenue: number
  sharePct: number
}

const props = withDefaults(defineProps<{
  categories?: CategoryShareItem[]
  selectedCategory?: string | null
}>(), {
  categories: () => [],
  selectedCategory: null
})

const emit = defineEmits<{
  (e: 'select-category', categoryName: string | null): void
}>()

const hoveredIndex = ref<number | null>(null)

// Circle Geometry
const radius = 60
const circumference = 2 * Math.PI * radius // ~376.99

// Palette
const colorPalette = [
  '#059669', // Emerald
  '#0284c7', // Sky
  '#4f46e5', // Indigo
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#e11d48', // Rose
  '#0d9488', // Teal
  '#64748b'  // Slate
]

const totalRevenue = computed(() => {
  return props.categories.reduce((sum, c) => sum + (c.revenue || 0), 0)
})

const segments = computed(() => {
  if (!props.categories.length || totalRevenue.value === 0) return []

  let accumulatedPct = 0
  return props.categories.map((c, i) => {
    const share = (c.revenue || 0) / totalRevenue.value
    const dashLength = share * circumference
    const dashOffset = -(accumulatedPct * circumference)
    accumulatedPct += share

    return {
      ...c,
      color: colorPalette[i % colorPalette.length],
      dashLength,
      dashOffset
    }
  })
})

const activeSegment = computed(() => {
  if (hoveredIndex.value !== null && segments.value[hoveredIndex.value]) {
    return segments.value[hoveredIndex.value]
  }
  if (props.selectedCategory) {
    return segments.value.find(s => s.name === props.selectedCategory) || null
  }
  return null
})

const toggleCategory = (catName: string) => {
  if (props.selectedCategory === catName) {
    emit('select-category', null)
  } else {
    emit('select-category', catName)
  }
}

// Helpers
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
