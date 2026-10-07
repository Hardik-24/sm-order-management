<script setup lang="ts">
import { Search, Filter, MoreHorizontal, ChevronRight, Check, Calendar, X, FileText } from 'lucide-vue-next'
import { formatCurrency, formatTime, getDisplayStatus, getOverallColor, getStatusColor } from '~~/app/lib/utils'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import { onClickOutside } from '@vueuse/core'
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
  (e: 'select', id: string): void
  (e: 'generate-invoice', id: string): void
}>()

import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useGsapAnimation } from '~/composables/useGsapAnimation'

const { animateStagger } = useGsapAnimation()
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)


const triggerRowAnimation = () => {
  nextTick(() => {
    if (!props.isLoading) {
      if (tbodyRef.value) {
        const rows = tbodyRef.value.querySelectorAll('tr')
        const targetRows = Array.from(rows).slice(0, 15)
        animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
      }
      if (mobileListRef.value) {
        const targetCards = Array.from(mobileListRef.value.children).slice(0, 15)
        animateStagger(targetCards, { duration: 0.18, stagger: 0.015, y: 4 })
      }
    }
  })
}

watch([() => props.orders, () => props.isLoading], () => {
  triggerRowAnimation()
}, { immediate: false })

const tableRootRef = ref<HTMLElement | null>(null)

watch(() => props.page, () => {
  nextTick(() => {
    tableRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

onMounted(() => {
  triggerRowAnimation()
})
</script>

<template>
  <div ref="tableRootRef" class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col relative">
    
    <!-- Toolbar -->
    <div class="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="relative w-full md:w-80 lg:w-96">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search class="h-4 w-4 text-gray-400" />
        </div>
        <input 
          :value="search"
          @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Search orders, customers, invoice..." 
          class="block w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all shadow-sm"
        />
        <button 
          v-if="search"
          @click="emit('update:search', '')"
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="flex items-center gap-3">
        <TableFilterButtons
          :startDate="startDate"
          :endDate="endDate"
          :status="status"
          :billingStatus="billingStatus"
          :packingStatus="packingStatus"
          :deliveryStatus="deliveryStatus"
          @update:startDate="val => emit('update:startDate', val)"
          @update:endDate="val => emit('update:endDate', val)"
          @update:status="val => emit('update:status', val)"
          @update:billingStatus="val => emit('update:billingStatus', val)"
          @update:packingStatus="val => emit('update:packingStatus', val)"
          @update:deliveryStatus="val => emit('update:deliveryStatus', val)"
        />
        <RowsPerPageSelect 
          :modelValue="limit" 
          :options="[10, 20, 50, -1]"
          @update:modelValue="val => { emit('update:limit', val); emit('update:page', 1) }"
        />
      </div>
    </div>

    <!-- Table Area -->
    <div class="relative min-h-[200px]">
      <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse"></div>

      <!-- DESKTOP / TABLET VIEW: Full Multi-column Table -->
      <div class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse min-w-full">
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

      <!-- MOBILE VIEW: 2-Line High-Density Non-Scrollable Rows -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in orders" 
          :key="'mob-bill-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors flex flex-col gap-1.5"
        >
          <!-- LINE 1: Identity & Billing Status -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-sm font-semibold text-gray-900 shrink-0">
                {{ order.orderNumber }}
              </span>
              <span class="text-gray-300 text-xs shrink-0">•</span>
              <span class="text-xs font-medium text-gray-700 truncate" :title="order.customer?.name || ''">
                {{ order.customer?.name || 'Walk-in Customer' }}
              </span>
            </div>
            
            <!-- Billing Status Badge (Extended to left so left edge aligns with button below) -->
            <span 
              :class="[
                'inline-flex items-center justify-center rounded-full font-medium px-2.5 py-0.5 text-[10px] tracking-wide uppercase shrink-0 min-w-[105px] text-center',
                order.billingStatus?.status === 'GENERATED' ? 'bg-green-100 text-green-700 border border-green-200' :
                order.billingStatus?.status === 'ON_HOLD' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                'bg-amber-100 text-amber-700 border border-amber-200'
              ]"
            >
              {{ order.billingStatus?.status === 'GENERATED' ? 'Generated' : order.billingStatus?.status === 'ON_HOLD' ? 'On Hold' : 'Awaiting Bill' }}
            </span>
          </div>

          <!-- LINE 2: Amount, Items, Time & Quick Action -->
          <div class="flex items-center justify-between gap-2 min-w-0 pt-0.5">
            <div class="flex items-baseline gap-1.5 shrink-0">
              <span class="text-xs font-bold text-[#1a5c4c]">
                {{ formatCurrency(order.totalAmount || 0) }}
              </span>
              <span class="text-[11px] text-gray-400 font-normal">
                ({{ order.items?.length || 0 }} pcs)
              </span>
              <span class="text-gray-200 text-[10px]">•</span>
              <span class="text-[11px] text-gray-400 tabular-nums">
                {{ formatTime(order.createdAt) }}
              </span>
            </div>

            <!-- Direct 1-Tap Action Button -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                v-if="order.billingStatus?.status === 'PENDING'"
                @click.stop="emit('generate-invoice', order.id)"
                class="px-2.5 py-1 bg-[#1a5c4c] text-white text-[11px] font-semibold rounded-md hover:bg-[#154a3d] active:scale-95 transition-all shadow-xs"
              >
                Generate Bill
              </button>
              <button 
                v-else
                @click.stop="emit('select', order.id)"
                class="px-2.5 py-1 border border-gray-200 bg-gray-50 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                View
              </button>
              
              <ChevronRight class="w-4 h-4 text-gray-300 shrink-0 -mr-1" />
            </div>
          </div>
        </div>

        <div v-if="!orders?.length" class="px-4 py-8 text-center text-sm text-gray-500">
          <FileText class="w-8 h-8 text-gray-300 mx-auto mb-2" />
          No invoices found.
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="p-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between gap-4">
      <p class="text-xs text-gray-500 whitespace-nowrap">
        Showing <span class="font-medium text-gray-900">{{ orders.length ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
        to <span class="font-medium text-gray-900">{{ limit === -1 ? total : Math.min(page * limit, total) }}</span>
        of <span class="font-medium text-gray-900">{{ total }}</span> orders
      </p>

      <div class="flex items-center justify-center gap-2">
        <button
          :disabled="page <= 1"
          @click="emit('update:page', page - 1)"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (Math.ceil(total / limit) || 1) }}</span>
        <button
          :disabled="limit === -1 || page >= Math.ceil(total / limit)"
          @click="emit('update:page', page + 1)"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
