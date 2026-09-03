<script setup lang="ts">
import { Search, Filter, MoreHorizontal, ChevronRight, Check, Calendar, X } from 'lucide-vue-next'
import { formatCurrency, formatTime, getDisplayStatus, getOverallColor } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import type { Order } from '~/types'

const props = defineProps<{
  orders: Order[]
  isLoading?: boolean
  total: number
  page: number
  limit: number
  search?: string
  startDate?: string
  endDate?: string
  status?: string
  billingStatus?: string
  packingStatus?: string
  deliveryStatus?: string
}>()

const emit = defineEmits<{
  (e: 'update:page', val: number): void
  (e: 'update:limit', val: number): void
  (e: 'update:search', val: string): void
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'update:packingStatus', val: string): void
  (e: 'update:deliveryStatus', val: string): void
  (e: 'select', orderId: string): void
}>()

import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useGsapAnimation } from '~/composables/useGsapAnimation'

const { animateStagger } = useGsapAnimation()
const tbodyRef = ref<HTMLElement | null>(null)

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tbodyRef.value && !props.isLoading) {
      const rows = tbodyRef.value.querySelectorAll('tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

watch([() => props.orders, () => props.isLoading], () => {
  triggerRowAnimation()
}, { immediate: false })

onMounted(() => {
  triggerRowAnimation()
})

const isDatePickerOpen = ref(false)
const isFiltersOpen = ref(false)

const dateFilterRef = ref(null)
const advancedFilterRef = ref(null)

onClickOutside(dateFilterRef, () => {
  isDatePickerOpen.value = false
})

onClickOutside(advancedFilterRef, () => {
  isFiltersOpen.value = false
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.status) count++
  if (props.billingStatus) count++
  if (props.packingStatus) count++
  if (props.deliveryStatus) count++
  return count
})

const clearFilters = () => {
  emit('update:status', '')
  emit('update:billingStatus', '')
  emit('update:packingStatus', '')
  emit('update:deliveryStatus', '')
  isFiltersOpen.value = false
}

const dateButtonText = computed(() => {
  if (props.startDate && props.endDate) {
    const start = new Date(props.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const end = new Date(props.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${start} - ${end}`
  } else if (props.startDate) {
    const start = new Date(props.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${start} onwards`
  } else if (props.endDate) {
    const end = new Date(props.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `Until ${end}`
  }
  return 'Date Range'
})

const formatTime = (dateStr: string) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
    <!-- Top Bar -->
    <div class="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between bg-white rounded-t-xl relative">
      <div class="relative w-64">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="h-4 w-4 text-gray-400" />
        </div>
        <input 
          :value="search"
          @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Search orders..."
          class="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]"
        />
      </div>
      
      <div class="flex flex-wrap items-center gap-2 ml-auto">
        <!-- Date Range Filter (Floating Popover) -->
        <div class="relative" ref="dateFilterRef">
          <button 
            @click="isDatePickerOpen = !isDatePickerOpen; isFiltersOpen = false"
            class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            :class="{ 'border-[#1a5c4c] ring-1 ring-[#1a5c4c]': startDate || endDate }"
          >
            <Calendar class="w-4 h-4 text-gray-500" :class="{ 'text-[#1a5c4c]': startDate || endDate }" />
            {{ dateButtonText }}
          </button>

          <!-- Date Popover Content -->
          <div v-if="isDatePickerOpen" class="absolute left-0 md:left-auto md:right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl z-[100] w-72 max-h-[80vh] flex flex-col transform translate-z-0">
            <div class="p-4 border-b border-gray-100 flex-shrink-0">
              <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Date Range</h4>
            </div>
            
            <div class="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Start Date</label>
                <input 
                  :value="startDate"
                  @input="e => emit('update:startDate', (e.target as HTMLInputElement).value)"
                  type="date" 
                  class="w-full text-sm border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">End Date</label>
                <input 
                  :value="endDate"
                  @input="e => emit('update:endDate', (e.target as HTMLInputElement).value)"
                  type="date" 
                  class="w-full text-sm border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                />
              </div>
            </div>

            <div class="p-4 pt-3 bg-gray-50 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
              <button @click="emit('update:startDate', ''); emit('update:endDate', '')" class="text-xs text-red-600 hover:underline">Clear</button>
              <button @click="isDatePickerOpen = false" class="px-3 py-1.5 bg-[#1a5c4c] text-white text-xs font-medium rounded hover:bg-[#1a5c4c]/90 transition-colors">Apply</button>
            </div>
          </div>
        </div>

        <!-- Advanced Filters -->
        <div class="relative" ref="advancedFilterRef">
          <button 
            @click="isFiltersOpen = !isFiltersOpen; isDatePickerOpen = false"
            class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            :class="{ 'border-[#1a5c4c] ring-1 ring-[#1a5c4c]': activeFilterCount > 0 }"
          >
            <Filter class="w-4 h-4 text-gray-500" :class="{ 'text-[#1a5c4c]': activeFilterCount > 0 }" />
            Filters
            <span v-if="activeFilterCount > 0" class="flex items-center justify-center w-5 h-5 ml-1 bg-[#1a5c4c] text-white text-[10px] font-bold rounded-full">
              {{ activeFilterCount }}
            </span>
          </button>

          <!-- Filters Popover Content -->
          <div v-if="isFiltersOpen" class="absolute left-0 md:left-auto md:right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl z-[100] w-80 max-h-[85vh] flex flex-col transform translate-z-0">
            <!-- Header -->
            <div class="p-5 pb-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Advanced Filters</h4>
              <button @click="isFiltersOpen = false" class="text-gray-400 hover:text-gray-600"><X class="w-4 h-4" /></button>
            </div>
            
            <!-- Scrollable Body -->
            <div class="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
              <!-- Overall Status -->
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Overall Status</label>
                <CustomSelect 
                  :modelValue="status"
                  @update:modelValue="val => emit('update:status', val)"
                  :options="[
                    {label: 'All Statuses', value: ''},
                    {label: 'Awaiting Billing & Packing', value: 'CONFIRMED'},
                    {label: 'Awaiting / Action Required', value: 'PROCESSING'},
                    {label: 'Ready for Dispatch', value: 'READY'},
                    {label: 'In Transit', value: 'DISPATCHED'},
                    {label: 'Delivered', value: 'DELIVERED'}
                  ]"
                  searchable
                  searchPlaceholder="Search statuses..."
                  class="w-full"
                />
              </div>

              <!-- Issue Tracking -->
              <div class="p-3 bg-red-50 border border-red-100 rounded-lg space-y-3">
                <label class="block text-xs font-bold text-red-800 uppercase tracking-widest">Needs Attention</label>
                
                <label class="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    :checked="packingStatus === 'SHORTAGE'"
                    @change="e => emit('update:packingStatus', (e.target as HTMLInputElement).checked ? 'SHORTAGE' : '')"
                    class="rounded text-red-600 focus:ring-red-500 border-red-300"
                  >
                  <span class="text-sm font-medium text-red-900">Packing Shortages</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    :checked="billingStatus === 'ERROR'"
                    @change="e => emit('update:billingStatus', (e.target as HTMLInputElement).checked ? 'ERROR' : '')"
                    class="rounded text-red-600 focus:ring-red-500 border-red-300"
                  >
                  <span class="text-sm font-medium text-red-900">Billing Errors</span>
                </label>
              </div>

              <!-- Department: Packing -->
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Packing Department</label>
                <CustomSelect 
                  :modelValue="packingStatus"
                  @update:modelValue="val => emit('update:packingStatus', val)"
                  :options="[
                    {label: 'Any State', value: ''},
                    {label: 'Pending', value: 'PENDING'},
                    {label: 'In Progress', value: 'IN_PROGRESS'},
                    {label: 'Packed', value: 'PACKED'},
                    {label: 'On Hold', value: 'ON_HOLD'}
                  ]"
                  searchable
                  searchPlaceholder="Search packing..."
                  class="w-full"
                />
              </div>

              <!-- Department: Delivery -->
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Delivery Department</label>
                <CustomSelect 
                  :modelValue="deliveryStatus"
                  @update:modelValue="val => emit('update:deliveryStatus', val)"
                  :options="[
                    {label: 'Any State', value: ''},
                    {label: 'Waiting', value: 'WAITING'},
                    {label: 'Assigned', value: 'ASSIGNED'},
                    {label: 'Dispatched', value: 'DISPATCHED'},
                    {label: 'Delivered', value: 'DELIVERED'},
                    {label: 'On Hold', value: 'ON_HOLD'}
                  ]"
                  searchable
                  searchPlaceholder="Search delivery..."
                  class="w-full"
                />
              </div>
            </div>

            <!-- Footer -->
            <div class="p-5 py-4 bg-gray-50 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
              <button @click="clearFilters" class="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Clear All</button>
              <button @click="isFiltersOpen = false" class="px-4 py-2 bg-[#1a5c4c] text-white text-sm font-medium rounded-md hover:bg-[#1a5c4c]/90 transition-colors shadow-sm">Show Results</button>
            </div>
          </div>
        </div>
      </div>
      
      <button class="p-2 border border-gray-300 rounded-md text-gray-500 bg-white hover:bg-gray-50">
        <MoreHorizontal class="w-4 h-4" />
      </button>
      
    </div>

    <!-- Table -->
    <div class="overflow-x-auto relative min-h-[200px]">
      <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse "></div>
      <table class="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th class="px-6 py-4 whitespace-nowrap">Order ID</th>
            <th class="px-6 py-4 whitespace-nowrap">Customer</th>
            <th class="px-6 py-4 whitespace-nowrap text-center">Items (Total)</th>
            <th class="px-6 py-4 whitespace-nowrap text-center">Packing Progress</th>
            <th class="px-6 py-4 whitespace-nowrap text-center">Status</th>
            <th class="px-6 py-4 whitespace-nowrap text-right">Action</th>
          </tr>
        </thead>
        <tbody ref="tbodyRef" class="divide-y divide-gray-200 bg-white relative">
          
            <tr 
              v-for="order in orders" 
            :key="order.id"
            @click="emit('select', order.id)"
            class="hover:bg-gray-50 cursor-pointer transition-colors group"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ order.orderNumber }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order.customer?.name || '-' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{{ order.items?.length || 0 }}</td>
            
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
              {{ order.items?.filter(i => i.packedQuantity === i.quantity).length || 0 }} / {{ order.items?.length || 0 }} SKUs
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <StatusBadge v-if="order.packingStatus?.status" :status="order.packingStatus.status" class="mx-auto" />
              <span v-else class="text-gray-400 block text-center">-</span>
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-right text-gray-400">
              <button @click.stop="emit('select', order.id)" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90 transition-colors">
                Pack Order
              </button>
            </td>
          </tr>
          <tr v-if="!orders?.length">
            <td colspan="10" class="px-6 py-8 text-center text-sm text-gray-500">
              No orders found.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Bottom -->
    <div class="px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between">
      <div class="text-sm text-gray-500">
        Showing {{ orders.length ? (page - 1) * limit + 1 : 0 }} to {{ Math.min(page * limit, total) }} of {{ total }} orders
      </div>
      <div class="flex items-center gap-4">
        <div class="flex gap-1">
          <button 
            @click="emit('update:page', Math.max(1, page - 1))"
            :disabled="page === 1"
            class="px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50"
          >&lt;</button>
          <span class="px-3 py-1 text-sm font-medium rounded bg-gray-100 text-gray-900">{{ page }}</span>
          <button 
            @click="emit('update:page', page + 1)"
            :disabled="page * limit >= total"
            class="px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50"
          >&gt;</button>
        </div>
        <select 
          :value="limit" 
          @change="e => emit('update:limit', parseInt((e.target as HTMLSelectElement).value))"
          class="text-sm border border-gray-300 rounded-md bg-white py-1 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-[#1a5c4c]"
        >
          <option :value="5">5 / page</option>
          <option :value="10">10 / page</option>
          <option :value="20">20 / page</option>
        </select>
      </div>
    </div>
  </div>
</template>
