<script setup lang="ts">
import { Search, Filter, MoreHorizontal, ChevronRight, Check, Calendar, X } from 'lucide-vue-next'
import { formatTime, getDisplayStatus, getOverallColor, getStatusColor } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
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
  isApproved?: string
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
  (e: 'update:isApproved', val: string): void
  (e: 'select', orderId: string): void
}>()

import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useGsapAnimation } from '~/composables/useGsapAnimation'

const { user, hasRole } = useAuth()
const { animateStagger, initContext } = useGsapAnimation()

const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)

const tableScrollRef = ref<HTMLElement | null>(null)

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

// Pipeline Dot Status Helpers for Mobile View (Approval • Packing • Billing • Delivery)
const getApprovalDot = (order: Order) => {
  if ((order as any).isApproved) return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Approval: Approved' }
  return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Approval: Pending' }
}

const getPackingDot = (order: Order) => {
  const status = order.packingStatus?.status
  if (status === 'PACKED' || status === 'COMPLETED') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Packing: Packed' }
  if (status === 'IN_PROGRESS') return { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Packing: In Progress' }
  if (status === 'ON_HOLD' || status === 'SHORTAGE') return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Packing: Shortage/Hold' }
  return { bg: 'bg-gray-300', text: 'text-gray-500', label: 'Packing: Waiting' }
}

const getBillingDot = (order: Order) => {
  const status = order.billingStatus?.status
  if (status === 'GENERATED') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Billing: Generated' }
  if (status === 'ON_HOLD' || status === 'ERROR') return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Billing: On Hold' }
  return { bg: 'bg-gray-300', text: 'text-gray-500', label: 'Billing: Pending' }
}

const getDeliveryDot = (order: Order) => {
  const status = order.deliveryStatus?.status
  if (status === 'DELIVERED') return { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'Delivery: Delivered' }
  if (status === 'DISPATCHED' || status === 'ASSIGNED') return { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Delivery: In Transit/Assigned' }
  if (status === 'ON_HOLD') return { bg: 'bg-amber-500', text: 'text-amber-700', label: 'Delivery: On Hold' }
  return { bg: 'bg-gray-300', text: 'text-gray-500', label: 'Delivery: Waiting' }
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
            :isApproved="isApproved"
            @update:startDate="val => emit('update:startDate', val)"
            @update:endDate="val => emit('update:endDate', val)"
            @update:status="val => emit('update:status', val)"
            @update:billingStatus="val => emit('update:billingStatus', val)"
            @update:packingStatus="val => emit('update:packingStatus', val)"
            @update:deliveryStatus="val => emit('update:deliveryStatus', val)"
            @update:isApproved="val => emit('update:isApproved', val)"
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
      <div ref="tableScrollRef" class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse min-w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th class="px-6 py-4 whitespace-nowrap">Order ID</th>
              <th class="px-6 py-4 whitespace-nowrap">Customer</th>
              <th class="px-6 py-4 whitespace-nowrap">Items</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Approval</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Packing</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Billing</th>
              <th class="px-6 py-4 whitespace-nowrap text-center">Delivery</th>
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
              class="cursor-pointer transition-colors group"
              :class="order.overallStatus === 'CANCELLED' 
                ? 'bg-gray-100/75 hover:bg-gray-200/60 text-gray-400 [&_td]:!text-gray-400 [&_span]:!text-gray-400 [&_div]:!text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
                : ((order as any).isUrgent ? 'bg-rose-50/20 hover:bg-gray-50 border-l-4 border-l-rose-500' : 'hover:bg-gray-50')"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <div class="flex items-center gap-1.5">
                  <span>{{ order.orderNumber }}</span>
                  <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 !text-gray-600 border border-rose-500">
                    🚫 CANCELLED
                  </span>
                  <span v-else-if="(order as any).isUrgent" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                    ⚡ URGENT
                  </span>
                  <span v-if="(order as any).isApproved && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div class="flex items-center gap-1.5">
                  <span>{{ order.customer?.name || '—' }}</span>
                  <span v-if="(order.customer as any)?.isPriorityClient" class="text-amber-500 font-bold text-xs" title="Priority Client">★</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order.items?.length || 0 }}</td>
              
              <!-- 1. Approval -->
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span v-if="(order as any).isApproved" class="text-emerald-600 flex items-center justify-center w-6 h-6 border border-emerald-500 rounded-full mx-auto" title="Approved">
                  <Check class="w-4 h-4" />
                </span>
                <span 
                  v-else 
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mx-auto"
                >
                  Pending
                </span>
              </td>

              <!-- 2. Packing -->
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span v-if="order.packingStatus?.status === 'PACKED' || order.packingStatus?.status === 'COMPLETED'" class="text-emerald-600 flex items-center justify-center w-6 h-6 border border-emerald-500 rounded-full mx-auto" title="Packed">
                  <Check class="w-4 h-4" />
                </span>
                <span v-else-if="!order.packingStatus || order.packingStatus.status === 'NOT_STARTED'" class="text-gray-400 block text-center">—</span>
                <StatusBadge v-else :status="order.packingStatus.status" class="mx-auto" />
              </td>

              <!-- 3. Billing -->
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span v-if="order.billingStatus?.status === 'GENERATED'" class="text-emerald-600 flex items-center justify-center w-6 h-6 border border-emerald-500 rounded-full mx-auto" title="Generated">
                  <Check class="w-4 h-4" />
                </span>
                <StatusBadge v-else-if="order.billingStatus?.status" :status="order.billingStatus.status" class="mx-auto" />
                <span v-else class="text-gray-400 block text-center">—</span>
              </td>
              
              <!-- 4. Delivery -->
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span v-if="order.deliveryStatus?.status === 'DELIVERED'" class="text-emerald-600 flex items-center justify-center w-6 h-6 border border-emerald-500 rounded-full mx-auto" title="Delivered">
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
      
      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="tableScrollRef" />

      <!-- MOBILE VIEW: 2-Line High-Density Non-Scrollable Rows -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in orders" 
          :key="'mob-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-3 cursor-pointer transition-colors flex flex-col gap-1.5"
          :class="order.overallStatus === 'CANCELLED' 
            ? 'bg-gray-100/75 active:bg-gray-200/60 text-gray-400 [&_span]:!text-gray-400 [&_p]:!text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
            : ((order as any).isUrgent ? 'bg-rose-50/20 active:bg-gray-100 border-l-4 border-l-rose-500' : 'hover:bg-gray-50 active:bg-gray-100')"
        >
          <!-- LINE 1: Identity & Overall Status -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span class="text-sm font-semibold text-gray-900 shrink-0">
                {{ order.orderNumber }}
              </span>
              <span v-if="order.overallStatus === 'CANCELLED'" class="text-[9px] font-bold text-gray-600 bg-gray-200 px-1 py-0.2 rounded border border-rose-500">
                🚫 CANCELLED
              </span>
              <span v-else-if="(order as any).isUrgent" class="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                ⚡ URGENT
              </span>
              <span class="text-gray-300 text-xs shrink-0">•</span>
              <span class="text-xs font-medium text-gray-700 truncate" :title="order.customer?.name || ''">
                {{ order.customer?.name || 'Walk-in Customer' }}
              </span>
              <span v-if="(order.customer as any)?.isPriorityClient" class="text-amber-500 font-bold text-xs">★</span>
            </div>
            
            <!-- Overall Status Badge (Cleanly anchored on top right) -->
            <StatusBadge 
              :status="order.overallStatus" 
              :display="getDisplayStatus(order)"
              :class="getOverallColor(order)"
              class="!text-[10px] !py-0.5 !px-2.5 shrink-0 max-w-[125px] truncate"
            />
          </div>

          <!-- LINE 2: Items, Time & Pipeline Dots -->
          <div class="flex items-center justify-between gap-2 min-w-0 pt-0.5">
            <div class="flex items-baseline gap-1.5 shrink-0">
              <span class="text-xs font-medium text-gray-700">
                {{ order.items?.length || 0 }} items
              </span>
              <span class="text-gray-200 text-[10px]">•</span>
              <span class="text-[11px] text-gray-400 tabular-nums">
                {{ formatTime(order.createdAt) }}
              </span>
            </div>

            <!-- Pipeline Status Dots (A, P, B, D) + Chevron -->
            <div class="flex items-center gap-1.5 shrink-0">
              <!-- A / P / B / D Indicator Group -->
              <div class="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-full px-2 py-0.5" title="Pipeline Status (Approval • Packing • Billing • Delivery)">
                <!-- Approval Dot -->
                <div 
                  class="flex items-center gap-1" 
                  :title="getApprovalDot(order).label"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getApprovalDot(order).bg"></span>
                  <span class="text-[9px] font-bold" :class="getApprovalDot(order).text">A</span>
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

                <!-- Billing Dot -->
                <div 
                  class="flex items-center gap-1" 
                  :title="getBillingDot(order).label"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getBillingDot(order).bg"></span>
                  <span class="text-[9px] font-bold" :class="getBillingDot(order).text">B</span>
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

