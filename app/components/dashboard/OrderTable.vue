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

const { user, hasRole } = useAuth()
const { animateStagger, initContext } = useGsapAnimation()

const isDatePickerOpen = ref(false)
const isFiltersOpen = ref(false)

const dateFilterRef = ref(null)
const advancedFilterRef = ref(null)
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
    <div class="p-4 border-b border-gray-200 bg-white rounded-t-xl relative flex flex-col gap-4">
      <!-- Search and Date Row -->
      <div class="flex flex-wrap gap-4 items-center justify-between">
        <div class="relative w-full md:w-64">
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
        
        <NuxtLink 
          v-if="hasRole('ADMIN', 'SALES')" 
          to="/dashboard/orders/create"
          class="px-4 py-2 bg-[#1a5c4c] text-white text-sm font-medium rounded-md hover:bg-[#1a5c4c]/90 transition-colors shadow-sm ml-0 md:-ml-2 whitespace-nowrap"
        >
          + Create New Order
        </NuxtLink>
        
        <div class="flex items-center gap-2 w-full md:w-auto ml-auto">
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
        </div>
      </div>

      <!-- Individual Filters Row -->
      <div class="flex flex-wrap items-center gap-3 w-full bg-gray-50/50 p-2 rounded-lg border border-gray-100">
        <CustomSelect 
          :modelValue="status"
          @update:modelValue="val => emit('update:status', val)"
          :options="[
            {label: 'Overall Status: All', value: ''},
            {label: 'Awaiting Billing & Packing', value: 'CONFIRMED'},
            {label: 'Action Required', value: 'PROCESSING'},
            {label: 'Ready', value: 'READY'},
            {label: 'Dispatched', value: 'DISPATCHED'},
            {label: 'Delivered', value: 'DELIVERED'}
          ]"
          searchable
          searchPlaceholder="Search statuses..."
          class="w-56"
        />

        <CustomSelect 
          :modelValue="billingStatus"
          @update:modelValue="val => emit('update:billingStatus', val)"
          :options="[
            {label: 'Billing: All', value: ''},
            {label: 'Pending', value: 'PENDING'},
            {label: 'Generated', value: 'GENERATED'},
            {label: 'On Hold', value: 'ON_HOLD'}
          ]"
          searchable
          searchPlaceholder="Search billing..."
          class="w-48"
        />

        <CustomSelect 
          :modelValue="packingStatus"
          @update:modelValue="val => emit('update:packingStatus', val)"
          :options="[
            {label: 'Packing: All', value: ''},
            {label: 'Pending', value: 'PENDING'},
            {label: 'In Progress', value: 'IN_PROGRESS'},
            {label: 'Packed', value: 'PACKED'},
            {label: 'On Hold', value: 'ON_HOLD'}
          ]"
          searchable
          searchPlaceholder="Search packing..."
          class="w-48"
        />

        <CustomSelect 
          :modelValue="deliveryStatus"
          @update:modelValue="val => emit('update:deliveryStatus', val)"
          :options="[
            {label: 'Delivery: All', value: ''},
            {label: 'Waiting', value: 'WAITING'},
            {label: 'Assigned', value: 'ASSIGNED'},
            {label: 'Dispatched', value: 'DISPATCHED'},
            {label: 'Delivered', value: 'DELIVERED'},
            {label: 'On Hold', value: 'ON_HOLD'}
          ]"
          searchable
          searchPlaceholder="Search delivery..."
          class="w-48"
        />
        
        <button v-if="activeFilterCount > 0" @click="clearFilters" class="text-sm text-red-600 hover:text-red-700 font-medium px-2 py-1.5 ml-auto">Clear Filters</button>
      </div>
    </div>
    
    <div class="overflow-x-auto relative min-h-[200px]">
      <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse "></div>
      <table class="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th class="px-6 py-4 whitespace-nowrap">Order ID</th>
            <th class="px-6 py-4 whitespace-nowrap">Customer</th>
            <th class="px-6 py-4 whitespace-nowrap">Items</th>
            <th class="px-6 py-4 whitespace-nowrap">Amount</th>
            <th class="px-6 py-4 whitespace-nowrap">Billing</th>
            <th class="px-6 py-4 whitespace-nowrap">Packing</th>
            <th class="px-6 py-4 whitespace-nowrap">Delivery</th>
            <th class="px-6 py-4 whitespace-nowrap">Overall Status</th>
            <th class="px-6 py-4 whitespace-nowrap">Created</th>
            <th class="px-6 py-4 whitespace-nowrap"></th>
          </tr>
        </thead>
        <tbody ref="tbodyRef" class="divide-y divide-gray-200 bg-white">
          <tr 
            v-for="order in orders" 
            :key="order.id"
            @click="emit('select', order.id)"
            class="hover:bg-gray-50 cursor-pointer transition-colors group"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ order.orderNumber }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order.customer?.name || '—' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order.items?.length || 0 }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(order.totalAmount || 0) }}</td>
            
            <td class="px-6 py-4 whitespace-nowrap">
              <span v-if="order.billingStatus?.status === 'GENERATED'" class="text-green-500 flex items-center justify-center w-6 h-6 border border-green-500 rounded-full mx-auto">
                <Check class="w-4 h-4" />
              </span>
              <StatusBadge v-else-if="order.billingStatus?.status" :status="order.billingStatus.status" class="mx-auto" />
              <span v-else class="text-gray-400 block text-center">—</span>
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap">
              <span v-if="order.packingStatus?.status === 'COMPLETED'" class="text-green-500 flex items-center justify-center w-6 h-6 border border-green-500 rounded-full mx-auto">
                <Check class="w-4 h-4" />
              </span>
              <span v-else-if="!order.packingStatus || order.packingStatus.status === 'NOT_STARTED'" class="text-gray-400 block text-center">—</span>
              <StatusBadge v-else :status="order.packingStatus.status" class="mx-auto" />
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap">
              <span v-if="order.deliveryStatus?.status === 'DELIVERED'" class="text-green-500 flex items-center justify-center w-6 h-6 border border-green-500 rounded-full mx-auto">
                <Check class="w-4 h-4" />
              </span>
              <span v-else-if="!order.deliveryStatus || order.deliveryStatus.status === 'NOT_STARTED'" class="text-gray-400 block text-center">—</span>
              <StatusBadge v-else :status="order.deliveryStatus.status" class="mx-auto" />
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap">
                <StatusBadge 
                  :status="order.overallStatus" 
                  :display="getDisplayStatus(order)"
                  :class="getOverallColor(order)"
                />
              </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatTime(order.createdAt) }}
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-gray-700 ml-auto" />
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
    <div class="p-4 border-t border-gray-200 flex items-center justify-between bg-white rounded-b-xl">
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
