<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ShoppingBag, FileText, Package, Box, Truck, AlertCircle, ArrowRight } from 'lucide-vue-next'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'

const props = withDefaults(defineProps<{
  flow?: any
}>(), {
  flow: () => ({})
})

const { animateStagger, animateProgressBar, initContext } = useGsapAnimation()
const containerRef = ref<HTMLElement | null>(null)

const stages = [
  { name: 'Awaiting Both', icon: ShoppingBag, key: 'new', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
  { name: 'Awaiting Billing', icon: FileText, key: 'billing', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { name: 'Awaiting Packing', icon: Package, key: 'packing', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { name: 'Action Required', icon: AlertCircle, key: 'issues', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { name: 'Ready for Dispatch', icon: Box, key: 'ready', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { name: 'In Transit', icon: Truck, key: 'delivery', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' }
]

const getPercentage = (key: string) => {
  if (!props.flow) return 0
  const total = Object.values(props.flow).reduce((a: any, b: any) => a + (typeof b === 'number' ? b : 0), 0)
  if (total === 0) return 0
  return Math.round(((props.flow[key] || 0) / total) * 100)
}

onMounted(() => {
  initContext(containerRef.value || undefined)
  if (containerRef.value) {
    const nodes = containerRef.value.querySelectorAll('.pipeline-node')
    animateStagger(nodes, { duration: 0.35, stagger: 0.06, y: 10 })
  }
})
</script>

<template>
  <div ref="containerRef" class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm h-full">
    <h2 class="text-lg font-medium text-gray-900 mb-8">Today's Order Flow</h2>
    
    <div class="flex flex-row items-start justify-between gap-2 overflow-x-auto pb-4">
      <template v-for="(stage, index) in stages" :key="stage.key">
        <div class="pipeline-node flex flex-col items-center flex-shrink-0 min-w-[70px]">
          <div :class="['w-12 h-12 flex items-center justify-center rounded-full border-2 mb-4 hover:scale-105 transition-transform duration-200', stage.bg, stage.border, stage.color]">
            <component :is="stage.icon" class="w-5 h-5" />
          </div>
          <span class="text-xs font-medium text-gray-600 mb-1">{{ stage.name }}</span>
          <OdometerNumber :value="flow?.[stage.key] || 0" class="text-2xl font-semibold text-gray-900 mb-4" />
          
          <div class="w-full flex items-center justify-center flex-col gap-1 border-t border-gray-100 pt-3">
            <span class="text-[11px] font-medium text-gray-500">{{ getPercentage(stage.key) }}%</span>
            <div class="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1 max-w-[40px]">
              <div class="h-full bg-[#1a5c4c] rounded-full transition-all duration-500 ease-out" :style="{ width: `${getPercentage(stage.key)}%` }"></div>
            </div>
          </div>
        </div>

        <div v-if="index < stages.length - 1" class="flex-grow flex items-center justify-center px-1 mt-6 min-w-[20px]">
          <ArrowRight class="w-4 h-4 text-gray-300" />
        </div>
      </template>
    </div>
  </div>
</template>
