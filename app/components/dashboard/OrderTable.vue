<script setup lang="ts">
import { Search, Filter, MoreHorizontal, ChevronRight, Check, Calendar, X } from 'lucide-vue-next'
import { formatCurrency, formatTime, getDisplayStatus, getOverallColor, getStatusColor } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
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
  paymentStatus?: string
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
  (e: 'update:paymentStatus', val: string): void
  (e: 'select', orderId: string): void
}>()

import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useGsapAnimation } from '~/composables/useGsapAnimation'

const { user, hasRole } = useAuth()
const { animateStagger, initContext } = useGsapAnimation()

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


const formatTime = (dateStr: string) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Pipeline Dot Status Helpers for Mobile View (Standardized 4-Color System)
const getBillingDot = (order: Order) => {
  const status = order.billingStatus?.status
  if (status === 'GENERATED') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Billing: Generated' }
  if (status === 'ON_HOLD' || status === 'ERROR') return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Billing: On Hold' }
  return { bg: 'bg-gray-300', text: 'text-gray-500', label: 'Billing: Pending' }
}

const getPackingDot = (order: Order) => {
  const status = order.packingStatus?.status
  if (status === 'PACKED' || status === 'COMPLETED') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Packing: Packed' }
  if (status === 'IN_PROGRESS') return { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Packing: In Progress' }
  if (status === 'ON_HOLD' || status === 'SHORTAGE') return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Packing: Shortage/Hold' }
  return { bg: 'bg-gray-300', text: 'text-gray-500', label: 'Packing: Waiting' }
}

const getDeliveryDot = (order: Order) => {
  const status = order.deliveryStatus?.status
  if (status === 'DELIVERED') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Delivery: Delivered' }
  if (status === 'DISPATCHED' || status === 'ASSIGNED') return { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Delivery: In Transit/Assigned' }
  if (status === 'ON_HOLD') return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Delivery: On Hold' }
  return { bg: 'bg-gray-300', text: 'text-gray-500', label: 'Delivery: Waiting' }
}

const getPaymentDot = (order: Order) => {
  const status = order.paymentStatus?.status || 'UNPAID'
  if (status === 'PAID') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Payment: Paid' }
  if (status === 'PARTIAL') return { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Payment: Partial' }
  if (status === 'OVERDUE') return { bg: 'bg-rose-500', text: 'text-rose-700', label: 'Payment: Overdue' }
  return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Payment: Unpaid' }
}
</script>

<template>
  <div ref="tableRootRef" class="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
    <!-- Top Bar -->
    <div class="p-4 border-b border-gray-200 bg-white rounded-t-xl relative flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center w-full md:w-auto">
          <div class="relative w-full md:w-80 lg:w-96">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search class="h-4 w-4 text-gray-400" />
            </div>
            <input 
              :value="search"
              @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
              type="text" 
              placeholder="Search orders, customers..."
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
          
          <NuxtLink 
            v-if="hasRole('ADMIN', 'SALES')" 
            to="/dashboard/orders/create"
            class="px-4 py-2 bg-[#1a5c4c] text-white text-sm font-medium rounded-lg hover:bg-[#1a5c4c]/90 transition-colors shadow-sm whitespace-nowrap text-center"
          >
            + Create New Order
          </NuxtLink>
        </div>
        
        <div class="flex items-center gap-3">
          <TableFilterButtons
            :startDate="startDate"
            :endDate="endDate"
            :status="status"
            :billingStatus="billingStatus"
            :packingStatus="packingStatus"
            :deliveryStatus="deliveryStatus"
            :paymentStatus="paymentStatus"
            @update:startDate="val => emit('update:startDate', val)"
            @update:endDate="val => emit('update:endDate', val)"
            @update:status="val => emit('update:status', val)"
            @update:billingStatus="val => emit('update:billingStatus', val)"
            @update:packingStatus="val => emit('update:packingStatus', val)"
            @update:deliveryStatus="val => emit('update:deliveryStatus', val)"
            @update:paymentStatus="val => emit('update:paymentStatus', val)"
          />
          <RowsPerPageSelect 
            :modelValue="limit" 
            :options="[10, 20, 50, -1]"
            @update:modelValue="val => { emit('update:limit', val); emit('update:page', 1) }"
          />
        </div>
    </div>
    
    <div class="relative min-h-[200px]">
      <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse"></div>

      <!-- DESKTOP / TABLET VIEW: Full Multi-column Table -->
      <div class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse min-w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th class="px-6 py-4 whitespace-nowrap">Order ID</th>
              <th class="px-6 py-4 whitespace-nowrap">Customer</th>
              <th class="px-6 py-4 whitespace-nowrap">Items</th>
              <th class="px-6 py-4 whitespace-nowrap">Amount</th>
              <th class="px-6 py-4 whitespace-nowrap">Billing</th>
              <th class="px-6 py-4 whitespace-nowrap">Packing</th>
              <th class="px-6 py-4 whitespace-nowrap">Delivery</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Payment</th>
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

              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span v-if="order.paymentStatus?.status === 'PAID'" class="text-green-500 flex items-center justify-center w-6 h-6 border border-green-500 rounded-full mx-auto" title="Fully Paid">
                  <Check class="w-4 h-4" />
                </span>
                <span 
                  v-else 
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border mx-auto"
                  :class="getStatusColor(order.paymentStatus?.status || 'UNPAID')"
                >
                  {{ order.paymentStatus?.status || 'UNPAID' }}
                </span>
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
              <td colspan="11" class="px-6 py-8 text-center text-sm text-gray-500">
                No orders found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MOBILE VIEW: 2-Line High-Density Non-Scrollable Rows -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in orders" 
          :key="'mob-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors flex flex-col gap-1.5"
        >
          <!-- LINE 1: Identity & Overall Status -->
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
            
            <!-- Overall Status Badge (Cleanly anchored on top right) -->
            <StatusBadge 
              :status="order.overallStatus" 
              :display="getDisplayStatus(order)"
              :class="getOverallColor(order)"
              class="!text-[10px] !py-0.5 !px-2.5 shrink-0 max-w-[125px] truncate"
            />
          </div>

          <!-- LINE 2: Amount, Items, Time & Pipeline Dots (B, P, D) -->
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

            <!-- Pipeline Status Dots (B, P, D) + Chevron -->
            <div class="flex items-center gap-1.5 shrink-0">
              <!-- B / P / D Indicator Group -->
              <div class="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-full px-2 py-0.5" title="Pipeline Status (Billing • Packing • Delivery)">
                <!-- Billing Dot -->
                <div 
                  class="flex items-center gap-1" 
                  :title="getBillingDot(order).label"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getBillingDot(order).bg"></span>
                  <span class="text-[9px] font-bold" :class="getBillingDot(order).text">B</span>
                </div>

                <span class="text-gray-200 text-[9px] leading-none">|</span>

                <!-- Packing Dot -->
                <div 
                  class="flex items-center gap-1" 
                  :title="getPackingDot(order).label"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getPackingDot(order).bg"></span>
                  <span class="text-[9px] font-bold" :class="getPackingDot(order).text">P</span>
                </div>

                <span class="text-gray-200 text-[9px] leading-none">|</span>

                <!-- Delivery Dot -->
                <div 
                  class="flex items-center gap-1" 
                  :title="getDeliveryDot(order).label"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getDeliveryDot(order).bg"></span>
                  <span class="text-[9px] font-bold" :class="getDeliveryDot(order).text">D</span>
                </div>

                <span class="text-gray-200 text-[9px] leading-none">|</span>

                <!-- Payment Dot -->
                <div 
                  class="flex items-center gap-1" 
                  :title="getPaymentDot(order).label"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getPaymentDot(order).bg"></span>
                  <span class="text-[9px] font-bold" :class="getPaymentDot(order).text">₹</span>
                </div>
              </div>

              <ChevronRight class="w-4 h-4 text-gray-300 shrink-0" />
            </div>
          </div>
        </div>

        <div v-if="!orders?.length" class="px-4 py-8 text-center text-sm text-gray-500">
          No orders found.
        </div>
      </div>
    </div>

    <!-- Pagination Bottom -->
    <div class="p-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between gap-4">
      <p class="text-xs text-gray-500 whitespace-nowrap">
        Showing <span class="font-medium text-gray-900">{{ orders.length ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
        to <span class="font-medium text-gray-900">{{ limit === -1 ? total : Math.min(page * limit, total) }}</span>
        of <span class="font-medium text-gray-900">{{ total }}</span> orders
      </p>

      <div class="flex items-center justify-center gap-2">
        <button
          :disabled="page <= 1"
          @click="emit('update:page', Math.max(1, page - 1))"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (Math.ceil(total / limit) || 1) }}</span>
        <button
          :disabled="limit === -1 || page * limit >= total"
          @click="emit('update:page', page + 1)"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
