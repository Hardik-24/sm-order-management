<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ShoppingBag, ArrowUp, ArrowDown, Box, Truck, CheckCheck, IndianRupee } from 'lucide-vue-next'
import type { DashboardStats } from '~/types'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'

const props = withDefaults(defineProps<{
  stats?: DashboardStats | null
  isLoading?: boolean
  activeFilter?: string | null
}>(), {
  stats: null,
  isLoading: false,
  activeFilter: null
})

const emit = defineEmits<{
  (e: 'selectCard', cardKey: string): void
}>()

const { animateStagger, initContext } = useGsapAnimation()
const containerRef = ref<HTMLElement | null>(null)

watch(() => props.isLoading, (loading) => {
  if (!loading && containerRef.value) {
    const cards = containerRef.value.querySelectorAll('.stat-card')
    animateStagger(cards, { duration: 0.24, stagger: 0.03, y: 6 })
  }
})

onMounted(() => {
  initContext(containerRef.value || undefined)
  if (containerRef.value) {
    const cards = containerRef.value.querySelectorAll('.stat-card')
    animateStagger(cards, { duration: 0.35, stagger: 0.05, y: 15 })
  }
})
</script>

<template>
  <div ref="containerRef" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 select-none">
    <!-- 1. Orders Placed (Sales) -->
    <div 
      @click="emit('selectCard', 'ordersToday')"
      class="stat-card rounded-xl border p-3 sm:p-5 flex flex-col justify-between transition-all duration-200 group cursor-pointer active:scale-[0.98]"
      :class="activeFilter === 'ordersToday' 
        ? '!bg-blue-100/90 !border-[#1b3b5f] ring-2 ring-[#1b3b5f]/30 shadow-md' 
        : 'bg-white border-[#e5e2dc] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-[#1b3b5f]/40 hover:bg-[#1b3b5f]/5'"
      title="Click to filter table by today's orders"
    >
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 
          class="uppercase tracking-wider text-[10px] font-semibold transition-colors"
          :class="activeFilter === 'ordersToday' ? 'text-[#1b3b5f] font-bold' : 'text-gray-500 group-hover:text-[#1b3b5f]'"
        >
          Orders Placed
        </h3>
        <div 
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
          :class="activeFilter === 'ordersToday' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-[#e8eff7] text-[#1b3b5f]'"
        >
          <ShoppingBag class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.ordersToday ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-bold" 
            :class="activeFilter === 'ordersToday' ? 'text-[#1b3b5f]' : 'text-[#1a1a1a]'"
          />
        </div>
        <p v-if="(stats?.ordersTodayChange ?? 0) !== 0" class="text-[10px] sm:text-[11px] font-medium flex items-center gap-1" :class="activeFilter === 'ordersToday' ? 'text-blue-900 font-semibold' : ((stats?.ordersTodayChange ?? 0) >= 0 ? 'text-green-600' : 'text-gray-400')">
          <component :is="(stats?.ordersTodayChange ?? 0) >= 0 ? ArrowUp : ArrowDown" class="w-3 h-3" />
          {{ Math.abs(Math.round(stats?.ordersTodayChange ?? 0)) }}% vs yesterday
        </p>
        <p v-else class="text-[10px] sm:text-[11px] font-medium" :class="activeFilter === 'ordersToday' ? 'text-blue-900 font-semibold' : 'text-gray-400'">Today's new intake</p>
      </div>
    </div>

    <!-- 2. Pending Approval (Approval) -->
    <div 
      @click="emit('selectCard', 'pendingApproval')"
      class="stat-card rounded-xl border p-3 sm:p-5 flex flex-col justify-between transition-all duration-200 group cursor-pointer active:scale-[0.98]"
      :class="activeFilter === 'pendingApproval' 
        ? '!bg-amber-100/90 !border-amber-500 ring-2 ring-amber-500/30 shadow-md' 
        : 'bg-white border-[#e5e2dc] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-amber-300 hover:bg-amber-50/20'"
      title="Click to filter table by pending approval orders"
    >
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 
          class="uppercase tracking-wider text-[10px] font-semibold transition-colors"
          :class="activeFilter === 'pendingApproval' ? 'text-amber-900 font-bold' : 'text-gray-500 group-hover:text-amber-700'"
        >
          Pending Approval
        </h3>
        <div 
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
          :class="activeFilter === 'pendingApproval' ? 'bg-amber-500 text-white shadow-xs' : 'bg-[#fef3c7] text-[#d97706]'"
        >
          <CheckCheck class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.pendingApproval ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-bold" 
            :class="activeFilter === 'pendingApproval' ? 'text-amber-950' : 'text-[#1a1a1a]'"
          />
        </div>
        <p class="text-[10px] sm:text-[11px] font-medium" :class="activeFilter === 'pendingApproval' ? 'text-amber-900 font-semibold' : 'text-amber-600'">Awaiting review</p>
      </div>
    </div>

    <!-- 3. In Packing (Packing) -->
    <div 
      @click="emit('selectCard', 'packing')"
      class="stat-card rounded-xl border p-3 sm:p-5 flex flex-col justify-between transition-all duration-200 group cursor-pointer active:scale-[0.98]"
      :class="activeFilter === 'packing' 
        ? '!bg-blue-100/90 !border-blue-500 ring-2 ring-blue-500/30 shadow-md' 
        : 'bg-white border-[#e5e2dc] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-blue-300 hover:bg-blue-50/20'"
      title="Click to filter table by orders currently in packing"
    >
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 
          class="uppercase tracking-wider text-[10px] font-semibold transition-colors"
          :class="activeFilter === 'packing' ? 'text-blue-900 font-bold' : 'text-gray-500 group-hover:text-blue-700'"
        >
          In Packing
        </h3>
        <div 
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
          :class="activeFilter === 'packing' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-600'"
        >
          <Box class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.packing ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-bold" 
            :class="activeFilter === 'packing' ? 'text-blue-950' : 'text-[#1a1a1a]'"
          />
        </div>
        <p class="text-[10px] sm:text-[11px] font-medium" :class="activeFilter === 'packing' ? 'text-blue-900 font-semibold' : 'text-blue-600'">Warehouse preparing</p>
      </div>
    </div>

    <!-- 4. Awaiting Billing (Billing) -->
    <div 
      @click="emit('selectCard', 'awaitingBilling')"
      class="stat-card rounded-xl border p-3 sm:p-5 flex flex-col justify-between transition-all duration-200 group cursor-pointer active:scale-[0.98]"
      :class="activeFilter === 'awaitingBilling' 
        ? '!bg-indigo-100/90 !border-indigo-500 ring-2 ring-indigo-500/30 shadow-md' 
        : 'bg-white border-[#e5e2dc] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50/20'"
      title="Click to filter table by orders awaiting billing"
    >
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 
          class="uppercase tracking-wider text-[10px] font-semibold transition-colors"
          :class="activeFilter === 'awaitingBilling' ? 'text-indigo-900 font-bold' : 'text-gray-500 group-hover:text-indigo-700'"
        >
          Awaiting Billing
        </h3>
        <div 
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
          :class="activeFilter === 'awaitingBilling' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-600'"
        >
          <IndianRupee class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.awaitingBilling ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-bold" 
            :class="activeFilter === 'awaitingBilling' ? 'text-indigo-950' : 'text-[#1a1a1a]'"
          />
        </div>
        <p class="text-[10px] sm:text-[11px] font-medium" :class="activeFilter === 'awaitingBilling' ? 'text-indigo-900 font-semibold' : 'text-indigo-600'">Invoice generation</p>
      </div>
    </div>

    <!-- 5. Delivered Today (Delivery) -->
    <div 
      @click="emit('selectCard', 'delivered')"
      class="stat-card rounded-xl border p-3 sm:p-5 flex flex-col justify-between transition-all duration-200 group cursor-pointer active:scale-[0.98]"
      :class="activeFilter === 'delivered' 
        ? '!bg-emerald-100/90 !border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' 
        : 'bg-white border-[#e5e2dc] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-emerald-300 hover:bg-emerald-50/20'"
      title="Click to filter table by orders delivered today"
    >
      <div class="flex justify-between items-start mb-2 sm:mb-4">
        <h3 
          class="uppercase tracking-wider text-[10px] font-semibold transition-colors"
          :class="activeFilter === 'delivered' ? 'text-emerald-900 font-bold' : 'text-gray-500 group-hover:text-emerald-700'"
        >
          Delivered Today
        </h3>
        <div 
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
          :class="activeFilter === 'delivered' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-600'"
        >
          <Truck class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div>
        <div class="mb-1 sm:mb-2">
          <OdometerNumber 
            :value="stats?.delivered ?? 0" 
            :loading="isLoading" 
            class="text-2xl sm:text-[32px] leading-none font-bold" 
            :class="activeFilter === 'delivered' ? 'text-emerald-950' : 'text-[#1a1a1a]'"
          />
        </div>
        <p class="text-[10px] sm:text-[11px] font-medium" :class="activeFilter === 'delivered' ? 'text-emerald-900 font-semibold' : 'text-emerald-600'">Fulfilled & closed</p>
      </div>
    </div>
  </div>
</template>
