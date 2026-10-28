<template>
  <div class="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
    <!-- Header: Title & Info -->
    <div class="flex items-center justify-between pb-3 border-b border-gray-100">
      <div>
        <h2 class="text-base font-bold text-gray-900 flex items-center gap-2">
          <Zap class="w-4 h-4 text-emerald-600" />
          Catalog Health & Stock Runway Distribution
        </h2>
        <p class="text-xs text-gray-500 mt-0.5">Estimated stock cover and inventory velocity health segmentation</p>
      </div>

      <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
        {{ totalTracked }} Active SKUs
      </span>
    </div>

    <!-- Segmented Health Bar -->
    <div class="mt-4 space-y-2">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>Inventory Coverage Breakdown</span>
        <span class="font-bold text-gray-800">{{ healthyRatio }}% in Healthy Rotation</span>
      </div>

      <div class="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-2xs">
        <!-- Critical Risk -->
        <div 
          class="bg-rose-500 hover:brightness-110 transition-all relative group cursor-pointer"
          :style="{ width: `${riskPct}%` }"
          @click="emit('select-tab', 'risk')"
        >
          <span class="opacity-0 group-hover:opacity-100 absolute -top-8 left-2 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none transition-opacity">
            Stockout Risk: {{ stockoutCount }} SKUs ({{ riskPct }}%)
          </span>
        </div>

        <!-- Fast Moving -->
        <div 
          class="bg-emerald-500 hover:brightness-110 transition-all relative group cursor-pointer"
          :style="{ width: `${fastPct}%` }"
          @click="emit('select-tab', 'fast')"
        >
          <span class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none transition-opacity">
            Fast Moving: {{ fastCount }} SKUs ({{ fastPct }}%)
          </span>
        </div>

        <!-- Dead Stock -->
        <div 
          class="bg-amber-400 hover:brightness-110 transition-all relative group cursor-pointer"
          :style="{ width: `${deadPct}%` }"
          @click="emit('select-tab', 'dead')"
        >
          <span class="opacity-0 group-hover:opacity-100 absolute -top-8 right-2 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none transition-opacity">
            Dead Stock: {{ deadCount }} SKUs ({{ deadPct }}%)
          </span>
        </div>
      </div>
    </div>

    <!-- Quick Actionable Segment Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 text-xs">
      <div 
        @click="emit('select-tab', 'fast')"
        class="p-3 rounded-xl border transition-all cursor-pointer bg-emerald-50/60 border-emerald-200/80 hover:bg-emerald-50"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-emerald-900 flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Fast Moving
          </span>
          <span class="font-extrabold text-emerald-700">{{ fastCount }} SKUs</span>
        </div>
        <div class="text-[11px] text-gray-600 mt-1">High stock turnover & steady orders</div>
      </div>

      <div 
        @click="emit('select-tab', 'risk')"
        class="p-3 rounded-xl border transition-all cursor-pointer bg-rose-50/60 border-rose-200/80 hover:bg-rose-50"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-rose-900 flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Stockout Risk
          </span>
          <span class="font-extrabold text-rose-700">{{ stockoutCount }} SKUs</span>
        </div>
        <div class="text-[11px] text-gray-600 mt-1">Stock &le; 10 units (Urgent PO)</div>
      </div>

      <div 
        @click="emit('select-tab', 'dead')"
        class="p-3 rounded-xl border transition-all cursor-pointer bg-amber-50/60 border-amber-200/80 hover:bg-amber-50"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-amber-900 flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Dead Stock
          </span>
          <span class="font-extrabold text-amber-700">{{ deadCount }} SKUs</span>
        </div>
        <div class="text-[11px] text-gray-600 mt-1">Zero sales recorded, capital locked</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Zap } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  fastCount?: number
  stockoutCount?: number
  deadCount?: number
}>(), {
  fastCount: 0,
  stockoutCount: 0,
  deadCount: 0
})

const emit = defineEmits<{
  (e: 'select-tab', tabName: 'fast' | 'dead' | 'risk' | 'negative'): void
}>()

const totalTracked = computed(() => {
  return props.fastCount + props.stockoutCount + props.deadCount
})

const riskPct = computed(() => {
  if (totalTracked.value === 0) return 0
  return Number(((props.stockoutCount / totalTracked.value) * 100).toFixed(1))
})

const fastPct = computed(() => {
  if (totalTracked.value === 0) return 0
  return Number(((props.fastCount / totalTracked.value) * 100).toFixed(1))
})

const deadPct = computed(() => {
  if (totalTracked.value === 0) return 0
  return Number(((props.deadCount / totalTracked.value) * 100).toFixed(1))
})

const healthyRatio = computed(() => {
  if (totalTracked.value === 0) return 100
  return Math.round((props.fastCount / totalTracked.value) * 100)
})
</script>
