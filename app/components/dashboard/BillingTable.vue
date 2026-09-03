<script setup lang="ts">
import { Search, Filter, MoreHorizontal, ChevronRight, Check, Calendar, X, FileText } from 'lucide-vue-next'
import { formatCurrency, formatTime, getDisplayStatus, getOverallColor, getStatusColor } from '~~/app/lib/utils'
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
}>()

const emit = defineEmits<{
  (e: 'update:page', val: number): void
  (e: 'update:limit', val: number): void
  (e: 'update:search', val: string): void
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'select', id: string): void
  (e: 'generate-invoice', id: string): void
}>()

import { ref, nextTick, watch, onMounted } from 'vue'
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
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col relative">
    
    <!-- Toolbar -->
    <div class="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="relative w-full md:w-96">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          :value="search"
          @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Search orders, customers, invoice..." 
          class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all"
        />
      </div>

      <div class="flex items-center gap-2 overflow-x-auto">
        <div class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50">
          <Calendar class="w-4 h-4 text-gray-500" />
          <span class="whitespace-nowrap">Date Range</span>
        </div>
        
        <div class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50">
          <Filter class="w-4 h-4 text-gray-500" />
          <span class="whitespace-nowrap">Filters</span>
        </div>
        

      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto relative min-h-[200px]">
      <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse "></div>
      <table class="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            <th class="px-6 py-4 whitespace-nowrap">Order ID</th>
            <th class="px-6 py-4 whitespace-nowrap">Customer</th>
            <th class="px-6 py-4 whitespace-nowrap">Salesperson</th>
            <th class="px-6 py-4 whitespace-nowrap">Items</th>
            <th class="px-6 py-4 whitespace-nowrap">Amount</th>
            <th class="px-6 py-4 whitespace-nowrap">Created</th>
            <th class="px-6 py-4 whitespace-nowrap">Status</th>
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
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ order.customer?.name || '—' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ order.salesPerson?.name || '—' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order.items?.length || 0 }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ formatCurrency(order.totalAmount || 0) }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div class="flex flex-col">
                <span>{{ formatTime(order.createdAt).split(',')[1] }}</span>
                <span class="text-xs text-gray-400">{{ formatTime(order.createdAt).split(',')[0] }}</span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span 
                :class="[
                  'inline-flex items-center rounded-full font-medium px-2.5 py-0.5 text-[11px] tracking-wide uppercase',
                  order.billingStatus?.status === 'GENERATED' ? 'bg-green-100 text-green-700 border border-green-200' :
                  order.billingStatus?.status === 'ON_HOLD' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                  'bg-amber-100 text-amber-700 border border-amber-200'
                ]"
              >
                {{ order.billingStatus?.status === 'GENERATED' ? 'Generated' : order.billingStatus?.status === 'ON_HOLD' ? 'On Hold' : 'Awaiting Billing' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <div class="flex items-center justify-end gap-2">
                <button 
                  v-if="order.billingStatus?.status === 'PENDING'"
                  @click.stop="emit('generate-invoice', order.id)"
                  class="px-3 py-1.5 bg-[#1a5c4c] text-white text-xs font-semibold rounded-md hover:bg-[#154a3d] transition-colors shadow-sm"
                >
                  Generate Invoice
                </button>
                <button 
                  v-else
                  @click.stop="emit('select', order.id)"
                  class="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                >
                  View Invoice
                </button>
                <button class="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                  <MoreHorizontal class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!orders?.length">
            <td colspan="8" class="px-6 py-12 text-center text-sm text-gray-500">
              <div class="flex flex-col items-center justify-center">
                <FileText class="w-8 h-8 text-gray-300 mb-2" />
                <p>No invoices found matching your criteria.</p>
              </div>
            </td>
          </tr>
          </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
      <div class="text-sm text-gray-500">
        Showing {{ orders.length ? (page - 1) * limit + 1 : 0 }} to {{ Math.min(page * limit, total) }} of {{ total }} orders
      </div>
      <div class="flex items-center gap-4">
        <select 
          :value="limit" 
          @change="e => emit('update:limit', parseInt((e.target as HTMLSelectElement).value))"
          class="text-sm border border-gray-300 rounded-md bg-white py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c]"
        >
          <option :value="5">5 / page</option>
          <option :value="10">10 / page</option>
          <option :value="25">25 / page</option>
          <option :value="50">50 / page</option>
        </select>
        
        <div class="flex items-center gap-1">
          <button 
            @click="emit('update:page', page - 1)" 
            :disabled="page === 1"
            class="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight class="w-4 h-4 rotate-180" />
          </button>
          
          <div class="flex items-center px-2">
            <template v-for="p in Math.ceil(total / limit)" :key="p">
              <button 
                v-if="p === 1 || p === Math.ceil(total / limit) || Math.abs(p - page) <= 1"
                @click="emit('update:page', p)"
                :class="[
                  'w-8 h-8 rounded-md text-sm font-medium flex items-center justify-center transition-colors',
                  p === page ? 'bg-[#1a5c4c] text-white' : 'text-gray-600 hover:bg-gray-100'
                ]"
              >
                {{ p }}
              </button>
              <span v-else-if="Math.abs(p - page) === 2" class="px-1 text-gray-400">...</span>
            </template>
          </div>
          
          <button 
            @click="emit('update:page', page + 1)" 
            :disabled="page >= Math.ceil(total / limit)"
            class="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
