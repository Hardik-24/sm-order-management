<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ShoppingBag, ArrowUp, FileText, Box, Truck, CheckCircle2 } from 'lucide-vue-next'
import type { DashboardStats } from '~/types'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'

const props = withDefaults(defineProps<{
  stats?: DashboardStats | null
  isLoading?: boolean
}>(), {
  stats: null,
  isLoading: false
})

const { animateStagger, initContext } = useGsapAnimation()
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  initContext(containerRef.value || undefined)
  if (containerRef.value) {
    const cards = containerRef.value.querySelectorAll('.stat-card')
    animateStagger(cards, { duration: 0.35, stagger: 0.05, y: 15 })
  }
})
</script>

<template>
  <div ref="containerRef" class="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-5">
    <!-- Orders Today -->
    <div class="stat-card rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div class="flex justify-between items-start mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500">Orders Today</h3>
        <div class="w-9 h-9 rounded-full bg-[#e6f4f1] text-[#1a5c4c] flex items-center justify-center">
          <ShoppingBag class="w-4 h-4" />
        </div>
      </div>
      <div>
        <div class="mb-2">
          <OdometerNumber 
            :value="stats?.ordersToday ?? 0" 
            :loading="isLoading" 
            class="text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[11px] text-green-600 font-medium flex items-center gap-1">
          <ArrowUp class="w-3 h-3" />
          12% vs yesterday
        </p>
      </div>
    </div>

    <!-- Awaiting Billing -->
    <div class="stat-card rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div class="flex justify-between items-start mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500">Awaiting Billing</h3>
        <div class="w-9 h-9 rounded-full bg-[#fdf3eb] text-[#d97706] flex items-center justify-center">
          <FileText class="w-4 h-4" />
        </div>
      </div>
      <div>
        <div class="mb-2">
          <OdometerNumber 
            :value="stats?.awaitingBilling ?? 0" 
            :loading="isLoading" 
            class="text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[11px] text-gray-400 font-medium">Needs attention</p>
      </div>
    </div>

    <!-- Packing -->
    <div class="stat-card rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div class="flex justify-between items-start mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500">Packing</h3>
        <div class="w-9 h-9 rounded-full bg-[#fdf3eb] text-[#d97706] flex items-center justify-center">
          <Box class="w-4 h-4" />
        </div>
      </div>
      <div>
        <div class="mb-2">
          <OdometerNumber 
            :value="stats?.packing ?? 0" 
            :loading="isLoading" 
            class="text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[11px] text-gray-400 font-medium">Currently being prepared</p>
      </div>
    </div>

    <!-- Ready For Delivery -->
    <div class="stat-card rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div class="flex justify-between items-start mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500">Ready For Delivery</h3>
        <div class="w-9 h-9 rounded-full bg-[#e6f4f1] text-[#1a5c4c] flex items-center justify-center">
          <Truck class="w-4 h-4" />
        </div>
      </div>
      <div>
        <div class="mb-2">
          <OdometerNumber 
            :value="stats?.readyForDelivery ?? 0" 
            :loading="isLoading" 
            class="text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[11px] text-gray-400 font-medium">Ready to dispatch</p>
      </div>
    </div>

    <!-- Delivered -->
    <div class="stat-card col-span-2 md:col-span-1 rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div class="flex justify-between items-start mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500">Delivered</h3>
        <div class="w-9 h-9 rounded-full bg-[#e6f4f1] text-[#1a5c4c] flex items-center justify-center">
          <CheckCircle2 class="w-4 h-4" />
        </div>
      </div>
      <div>
        <div class="mb-2">
          <OdometerNumber 
            :value="stats?.delivered ?? 0" 
            :loading="isLoading" 
            class="text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[11px] text-gray-400 font-medium">Today</p>
      </div>
    </div>
  </div>
</template>
