<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ShoppingBag, ArrowUp, ArrowDown, Box, Truck, CheckCheck, Receipt } from 'lucide-vue-next'
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
  <div ref="containerRef" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
    <!-- 1. Orders Placed (Sales) -->
    <NuxtLink to="/dashboard/orders" class="stat-card rounded-xl border border-gray-100 bg-white p-3 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-200 cursor-pointer group">
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500 group-hover:text-emerald-700 transition-colors">Orders Placed</h3>
        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-[#e6f4f1] text-[#1a5c4c] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <ShoppingBag class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.ordersToday ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p v-if="(stats?.ordersTodayChange ?? 0) !== 0" class="text-[10px] sm:text-[11px] font-medium flex items-center gap-1" :class="(stats?.ordersTodayChange ?? 0) >= 0 ? 'text-green-600' : 'text-gray-400'">
          <component :is="(stats?.ordersTodayChange ?? 0) >= 0 ? ArrowUp : ArrowDown" class="w-3 h-3" />
          {{ Math.abs(Math.round(stats?.ordersTodayChange ?? 0)) }}% vs yesterday
        </p>
        <p v-else class="text-[10px] sm:text-[11px] text-gray-400 font-medium">Today's new intake</p>
      </div>
    </NuxtLink>

    <!-- 2. Pending Approval (Approval) -->
    <NuxtLink to="/dashboard/approve-orders" class="stat-card rounded-xl border border-gray-100 bg-white p-3 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md hover:border-amber-200 transition-all duration-200 cursor-pointer group">
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500 group-hover:text-amber-700 transition-colors">Pending Approval</h3>
        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <CheckCheck class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.pendingApproval ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[10px] sm:text-[11px] text-amber-600 font-medium">Awaiting review</p>
      </div>
    </NuxtLink>

    <!-- 3. In Packing (Packing) -->
    <NuxtLink to="/dashboard/packing" class="stat-card rounded-xl border border-gray-100 bg-white p-3 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer group">
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500 group-hover:text-blue-700 transition-colors">In Packing</h3>
        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Box class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.packing ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[10px] sm:text-[11px] text-blue-600 font-medium">Warehouse preparing</p>
      </div>
    </NuxtLink>

    <!-- 4. Awaiting Billing (Billing) -->
    <NuxtLink to="/dashboard/billing" class="stat-card rounded-xl border border-gray-100 bg-white p-3 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer group">
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500 group-hover:text-indigo-700 transition-colors">Awaiting Billing</h3>
        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Receipt class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.awaitingBilling ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[10px] sm:text-[11px] text-indigo-600 font-medium">Invoice generation</p>
      </div>
    </NuxtLink>

    <!-- 5. Delivered Today (Delivery) -->
    <NuxtLink to="/dashboard/delivery" class="stat-card rounded-xl border border-gray-100 bg-white p-3 sm:p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-200 cursor-pointer group">
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 class="uppercase tracking-wider text-[10px] font-semibold text-gray-500 group-hover:text-emerald-700 transition-colors">Delivered Today</h3>
        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Truck class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.delivered ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-semibold text-[#1a1a1a]" 
          />
        </div>
        <p class="text-[10px] sm:text-[11px] text-emerald-600 font-medium">Fulfilled & closed</p>
      </div>
    </NuxtLink>
  </div>
</template>
