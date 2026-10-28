<template>
  <div class="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
    <!-- Header: Title, Sort & Search -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
      <div>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
            <Boxes class="w-4 h-4" />
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Category Capital Allocation & Margin Spreads
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Capital deployed across brands and product segments with cost-to-retail margin spreads
            </p>
          </div>
        </div>
      </div>

      <!-- Controls: Sort Switcher & Search -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div class="bg-gray-100 p-1 rounded-xl flex items-center border border-gray-200/80 shrink-0 text-xs">
          <button
            type="button"
            @click="sortBy = 'cost'"
            class="px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer"
            :class="sortBy === 'cost' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
          >
            By Capital (Cost)
          </button>
          <button
            type="button"
            @click="sortBy = 'margin'"
            class="px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer"
            :class="sortBy === 'margin' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
          >
            By Margin %
          </button>
          <button
            type="button"
            @click="sortBy = 'units'"
            class="px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer"
            :class="sortBy === 'units' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
          >
            By Units
          </button>
        </div>

        <div class="relative w-full sm:w-48">
          <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search category..."
            class="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>
    </div>

    <!-- Interactive Horizontal Bar Breakdown -->
    <div class="mt-4 space-y-3.5">
      <div 
        v-for="cat in sortedCategories" 
        :key="cat.name"
        class="p-3 rounded-xl bg-gray-50/60 hover:bg-indigo-50/30 border border-gray-200/70 transition-all text-xs"
      >
        <!-- Category Title & Metrics -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-bold text-gray-900 truncate max-w-[200px]" :title="cat.name">{{ cat.name }}</span>
            <span class="text-[10px] text-gray-500 bg-gray-200/60 px-1.5 py-0.2 rounded font-medium">{{ cat.productCount }} SKUs</span>
            <span class="text-[10px] text-gray-500 font-mono">{{ formatNumber(cat.totalUnits) }} units</span>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <span class="font-extrabold text-gray-900 tabular-nums">{{ formatCurrency(cat.costValue) }}</span>
              <span class="text-[10px] text-gray-400 block">Landed Cost</span>
            </div>
            <div class="text-right">
              <span class="font-extrabold text-emerald-700 tabular-nums">{{ formatCurrency(cat.saleValue) }}</span>
              <span class="text-[10px] text-gray-400 block">Retail Value</span>
            </div>
            <span 
              class="px-2.5 py-1 rounded-full text-[11px] font-black shrink-0"
              :class="cat.marginSpread >= 20 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-sky-100 text-sky-800 border border-sky-200'"
            >
              +{{ cat.marginSpread }}% Spread
            </span>
          </div>
        </div>

        <!-- Comparative Dual Progress Bars -->
        <div class="space-y-1">
          <!-- Cost Value Bar -->
          <div class="w-full h-2 bg-gray-200/70 rounded-full overflow-hidden flex">
            <div 
              class="bg-indigo-600 rounded-full transition-all duration-500"
              :style="{ width: `${getBarWidth(cat.costValue)}%` }"
            ></div>
          </div>
          <!-- Sale Value Bar -->
          <div class="w-full h-2 bg-gray-200/70 rounded-full overflow-hidden flex">
            <div 
              class="bg-emerald-500 rounded-full transition-all duration-500"
              :style="{ width: `${getBarWidth(cat.saleValue)}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Legend -->
    <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
      <div class="flex items-center gap-4">
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Cost Value (Landed Capital)
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Retail Value (Potential Revenue)
        </span>
      </div>
      <span class="text-gray-400">Total Categories: {{ sortedCategories.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Boxes, Search } from 'lucide-vue-next'

export interface CategorySpreadItem {
  name: string
  productCount: number
  totalUnits: number
  costValue: number
  saleValue: number
  avgCostPrice: number
  avgSalePrice: number
  marginSpread: number
}

const props = withDefaults(defineProps<{
  categories?: CategorySpreadItem[]
}>(), {
  categories: () => []
})

const sortBy = ref<'cost' | 'margin' | 'units'>('cost')
const searchQuery = ref('')

const maxVal = computed(() => {
  if (!props.categories.length) return 1
  const vals = props.categories.map(c => Math.max(c.costValue || 0, c.saleValue || 0))
  return Math.max(...vals, 1)
})

const getBarWidth = (val: number) => {
  if (val <= 0) return 0
  return Math.min(100, Math.max(2, Math.round((val / maxVal.value) * 100)))
}

const sortedCategories = computed(() => {
  let list = [...props.categories]
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(c => c.name.toLowerCase().includes(q))
  }

  if (sortBy.value === 'cost') {
    list.sort((a, b) => (b.costValue || 0) - (a.costValue || 0))
  } else if (sortBy.value === 'margin') {
    list.sort((a, b) => (b.marginSpread || 0) - (a.marginSpread || 0))
  } else if (sortBy.value === 'units') {
    list.sort((a, b) => (b.totalUnits || 0) - (a.totalUnits || 0))
  }
  return list
})

function formatCurrency(val: number | undefined): string {
  if (!val) return '₹0'
  return '₹' + Math.round(val).toLocaleString('en-IN')
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '0'
  return Math.round(num).toLocaleString('en-IN')
}
</script>
