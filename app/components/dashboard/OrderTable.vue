<script setup lang="ts">
import { Search, Filter, MoreHorizontal, ChevronLeft, ChevronRight, Check, Calendar, X, ArrowRight, Clock, Package, Truck, IndianRupee, CheckCheck, Building2, User as UserIcon, AlertCircle, ChevronDown, ChevronUp, Layers, Pause, Plus } from 'lucide-vue-next'
import { formatTime, formatCurrency, getDisplayStatus, getOverallColor, getStatusColor, formatCustomerContact } from '~~/app/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
import LoadingTopBar from '~/components/ui/LoadingTopBar.vue'
import TableSkeletonRows from '~/components/ui/TableSkeletonRows.vue'
import { getEffectiveActionPermissions } from '~/utils/permissions'
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
  salesPersonId?: string
  scope?: string
  showScopeToggle?: boolean
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
  (e: 'update:salesPersonId', val: string): void
  (e: 'update:scope', val: string): void
  (e: 'select', orderId: string): void
  (e: 'split-order', orderId: string): void
}>()

import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useGsapAnimation } from '~/composables/useGsapAnimation'

const { user, hasRole, canManageBatches } = useAuth()
const { animateStagger, initContext } = useGsapAnimation()

const canViewAllCompanyOrders = computed(() => {
  if (!user.value) return false
  if (user.value.role === 'ADMIN') return true
  const perms = getEffectiveActionPermissions(user.value)
  return perms.canViewAllCompanyOrders ?? true
})

const shouldShowScopeToggle = computed(() => {
  if (props.showScopeToggle !== undefined) return props.showScopeToggle
  return props.scope !== undefined
})

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

// Workflow Pipeline Helpers for Desktop & Mobile Layouts
interface PipelineStep {
  key: string
  label: string
  shortLabel: string
  shortName: string
  status: 'completed' | 'in_progress' | 'waiting' | 'alert'
}

const getStepIcon = (key: string) => {
  switch (key) {
    case 'A': return CheckCheck
    case 'P': return Package
    case 'B': return IndianRupee
    case 'D': return Truck
    default: return Check
  }
}

const getOrderPipeline = (order: Order): { steps: PipelineStep[], summary: string } => {
  if (order.overallStatus === 'CANCELLED') {
    return {
      steps: [
        { key: 'A', label: 'Approval', shortLabel: 'A', shortName: 'Appr', status: 'alert' },
        { key: 'P', label: 'Packing', shortLabel: 'P', shortName: 'Pack', status: 'waiting' },
        { key: 'B', label: 'Billing', shortLabel: 'B', shortName: 'Bill', status: 'waiting' },
        { key: 'D', label: 'Delivery', shortLabel: 'D', shortName: 'Delv', status: 'waiting' },
      ],
      summary: 'Order Cancelled'
    }
  }

  // 1. Approval
  const isApproved = !!(order as any).isApproved
  const approvalStep: PipelineStep = {
    key: 'A',
    label: 'Approval',
    shortLabel: 'A',
    shortName: 'Appr',
    status: isApproved ? 'completed' : 'in_progress'
  }

  // 2. Packing
  const packStat = order.packingStatus?.status
  let packStatus: PipelineStep['status'] = 'waiting'
  if (packStat === 'PACKED' || packStat === 'COMPLETED') {
    packStatus = 'completed'
  } else if (packStat === 'IN_PROGRESS') {
    packStatus = 'in_progress'
  } else if (packStat === 'SHORTAGE' || packStat === 'ON_HOLD') {
    packStatus = 'alert'
  } else if (isApproved) {
    packStatus = 'in_progress'
  }

  const packingStep: PipelineStep = {
    key: 'P',
    label: 'Packing',
    shortLabel: 'P',
    shortName: 'Pack',
    status: packStatus
  }

  // 3. Billing
  const billStat = order.billingStatus?.status
  let billStatus: PipelineStep['status'] = 'waiting'
  if (billStat === 'GENERATED') {
    billStatus = 'completed'
  } else if (billStat === 'ON_HOLD' || billStat === 'ERROR') {
    billStatus = 'alert'
  } else if (packStatus === 'completed') {
    billStatus = 'in_progress'
  }

  const billingStep: PipelineStep = {
    key: 'B',
    label: 'Billing',
    shortLabel: 'B',
    shortName: 'Bill',
    status: billStatus
  }

  // 4. Delivery
  const delStat = order.deliveryStatus?.status
  let delStatus: PipelineStep['status'] = 'waiting'
  if (delStat === 'DELIVERED') {
    delStatus = 'completed'
  } else if (delStat === 'DISPATCHED' || delStat === 'ASSIGNED') {
    delStatus = 'in_progress'
  } else if (delStat === 'ON_HOLD') {
    delStatus = 'alert'
  }

  const deliveryStep: PipelineStep = {
    key: 'D',
    label: 'Delivery',
    shortLabel: 'D',
    shortName: 'Delv',
    status: delStatus
  }

  // Human-readable stage summary
  let summary = 'Order Received'
  if (delStat === 'DELIVERED') {
    summary = 'Delivered to Customer'
  } else if (delStat === 'DISPATCHED') {
    summary = 'Out for Delivery'
  } else if (order.overallStatus === 'READY' || (billStatus === 'completed' && packStatus === 'completed')) {
    summary = 'Ready for Dispatch'
  } else if (packStat === 'SHORTAGE') {
    summary = 'Packing Shortage'
  } else if (packStat === 'IN_PROGRESS') {
    summary = 'Packing In Progress'
  } else if (billStat === 'PENDING' && packStatus === 'completed') {
    summary = 'Billing Pending'
  } else if (!isApproved) {
    summary = 'Approval Pending'
  } else if (packStat === 'PENDING') {
    summary = 'Packing Queue'
  }

  return {
    steps: [approvalStep, packingStep, billingStep, deliveryStep],
    summary
  }
}

// ── Batch Sub-Rows & Multi-Batch Helpers ──────────────────────────────
const expandedOrderIds = ref<Record<string, boolean>>({})
const toggleExpand = (orderId: string) => {
  expandedOrderIds.value[orderId] = !expandedOrderIds.value[orderId]
}
const isExpanded = (orderId: string) => Boolean(expandedOrderIds.value[orderId])

const hasBatches = (order: any) => Boolean(order.batches && order.batches.length > 0)
const hasHoldBatches = (order: any) => Boolean(order.batches?.some((b: any) => b.isBatchOnHold))
const getHoldBatchesCount = (order: any) => order.batches?.filter((b: any) => b.isBatchOnHold).length || 0
const getBatchesDeliveredCount = (order: any) => order.batches?.filter((b: any) => b.deliveryStatus?.status === 'DELIVERED').length || 0
const getBatchesPackedCount = (order: any) => order.batches?.filter((b: any) => b.packingStatus?.status === 'PACKED' || b.packingStatus?.status === 'COMPLETED').length || 0

const getBatchUnits = (batch: any) => {
  return batch.items?.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0) || 0
}

const getOrderBatchedUnits = (order: any) => {
  return order.batches?.reduce((sum: number, b: any) => sum + getBatchUnits(b), 0) || 0
}

const getOrderTotalOrderedUnits = (order: any) => {
  return order.items?.reduce((sum: number, itm: any) => sum + (Number(itm.approvedQuantity ?? itm.quantity) || 0), 0) || 0
}

const getOrderPendingPoolUnits = (order: any) => {
  return Math.max(0, getOrderTotalOrderedUnits(order) - getOrderBatchedUnits(order))
}

const getBatchPipeline = (batch: any) => {
  // 1. Packing
  const packStat = batch.packingStatus?.status
  let packStatus: 'completed' | 'in_progress' | 'paused' | 'waiting' = 'waiting'
  let packText = 'Pending'

  if (batch.isBatchOnHold) {
    packStatus = 'paused'
    packText = 'On Hold'
  } else if (packStat === 'PACKED' || packStat === 'COMPLETED') {
    packStatus = 'completed'
    packText = 'Packed'
  } else if (packStat === 'IN_PROGRESS') {
    packStatus = 'in_progress'
    packText = 'Packing'
  } else {
    packStatus = 'in_progress'
    packText = 'Pending'
  }

  // 2. Billing
  const billStat = batch.billingStatus?.status
  let billStatus: 'completed' | 'in_progress' | 'paused' | 'waiting' = 'waiting'
  let billText = 'Waiting'

  if (billStat === 'GENERATED' || batch.billingStatus?.invoiceNumber) {
    billStatus = 'completed'
    billText = 'Invoiced'
  } else if (billStat === 'ERROR' || billStat === 'ON_HOLD') {
    billStatus = 'paused'
    billText = 'Error'
  } else if (packStatus === 'completed') {
    billStatus = 'in_progress'
    billText = 'Pending'
  }

  // 3. Delivery
  const delStat = batch.deliveryStatus?.status
  let delStatus: 'completed' | 'in_progress' | 'paused' | 'waiting' = 'waiting'
  let delText = 'Waiting'

  if (delStat === 'DELIVERED') {
    delStatus = 'completed'
    delText = 'Delivered'
  } else if (delStat === 'DISPATCHED' || delStat === 'ASSIGNED') {
    delStatus = 'in_progress'
    delText = 'Out for Delivery'
  } else if (delStat === 'ON_HOLD') {
    delStatus = 'paused'
    delText = 'On Hold'
  }

  return [
    { key: 'P', label: 'Packing', status: packStatus, statusText: packText },
    { key: 'B', label: 'Billing', status: billStatus, statusText: billText },
    { key: 'D', label: 'Delivery', status: delStatus, statusText: delText },
  ]
}

const shouldShowCustomerCompany = (customer?: { name?: string | null; company?: string | null } | null) => {
  if (!customer?.company || !customer?.name) return false
  const nameNorm = customer.name.trim().toLowerCase()
  const compNorm = customer.company.trim().toLowerCase()
  return compNorm.length > 0 && compNorm !== nameNorm
}

const getCustomerSubtitle = (customer?: any) => {
  return formatCustomerContact(customer)
}

const getItemsTotalQuantity = (order: Order) => {
  if (!order.items || !order.items.length) return '0 nos.'
  const totalUnits = order.items.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0)
  return `${totalUnits} nos.`
}
</script>

<template>
  <div ref="tableRootRef" class="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col relative z-20 overflow-visible">
    <!-- Top Bar -->
    <div class="p-4 border-b border-gray-200 bg-white rounded-t-xl relative flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center w-full md:w-auto">
        <!-- Segmented Scope Toggle: All Company vs My Orders (Mobile: full row at top above search; Desktop: inline) -->
        <div
          v-if="shouldShowScopeToggle && canViewAllCompanyOrders"
          class="inline-flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80 shadow-2xs w-full sm:w-auto justify-center sm:justify-start shrink-0 order-first sm:order-2"
        >
          <button
            type="button"
            @click="emit('update:scope', 'all'); emit('update:page', 1)"
            class="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            :class="(scope || 'all') === 'all' ? 'bg-white text-[#1b3b5f] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'"
          >
            <Building2 class="w-3.5 h-3.5" />
            <span>All Company</span>
          </button>
          <button
            type="button"
            @click="emit('update:scope', 'mine'); emit('update:page', 1)"
            class="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            :class="scope === 'mine' ? 'bg-white text-[#1b3b5f] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'"
          >
            <UserIcon class="w-3.5 h-3.5" />
            <span>My Orders</span>
          </button>
        </div>

        <!-- Search Bar: Under toggle on mobile, leftmost on desktop -->
        <div class="relative w-full md:w-80 lg:w-96 order-2 sm:order-1">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search class="h-4 w-4 text-gray-400" />
          </div>
          <input 
            :value="search"
            @input="e => { emit('update:search', (e.target as HTMLInputElement).value); emit('update:page', 1) }"
            data-quick-search="true"
            type="text" 
            placeholder="Search orders, customers..."
            class="block w-full pl-10 pr-14 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition-all shadow-sm"
          />
          <div v-if="!search" class="hidden sm:flex absolute inset-y-0 right-0 pr-2.5 items-center pointer-events-none">
            <kbd class="px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded shadow-2xs">Ctrl K</kbd>
          </div>
          <button 
            v-else
            @click="{ emit('update:search', ''); emit('update:page', 1) }"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        
        <NuxtLink 
          v-if="hasRole('ADMIN', 'SALES')" 
          to="/dashboard/orders/create"
          class="px-4 py-2 bg-[#1b3b5f] text-white text-sm font-medium rounded-lg hover:bg-[#1b3b5f]/90 transition-colors shadow-sm whitespace-nowrap text-center order-3"
        >
          + Create New Order
        </NuxtLink>
      </div>
        
        <div class="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-nowrap">
          <TableFilterButtons
            :startDate="startDate"
            :endDate="endDate"
            :status="status"
            :billingStatus="billingStatus"
            :packingStatus="packingStatus"
            :deliveryStatus="deliveryStatus"
            :isApproved="isApproved"
            :salesPersonId="salesPersonId"
            @update:startDate="val => { emit('update:startDate', val); emit('update:page', 1) }"
            @update:endDate="val => { emit('update:endDate', val); emit('update:page', 1) }"
            @update:status="val => { emit('update:status', val); emit('update:page', 1) }"
            @update:billingStatus="val => { emit('update:billingStatus', val); emit('update:page', 1) }"
            @update:packingStatus="val => { emit('update:packingStatus', val); emit('update:page', 1) }"
            @update:deliveryStatus="val => { emit('update:deliveryStatus', val); emit('update:page', 1) }"
            @update:isApproved="val => { emit('update:isApproved', val); emit('update:page', 1) }"
            @update:salesPersonId="val => { emit('update:salesPersonId', val); emit('update:page', 1) }"
          />
          <RowsPerPageSelect 
            :modelValue="limit" 
            :options="[10, 20, 50, -1]"
            @update:modelValue="val => { emit('update:limit', val); emit('update:page', 1) }"
          />
        </div>
    </div>
    
    <div class="relative min-h-[200px]">
      <LoadingTopBar :loading="isLoading" />
      <div v-if="isLoading && orders?.length" class="absolute inset-0 bg-white/30 backdrop-blur-[1px] z-10 pointer-events-none transition-opacity duration-200"></div>

      <!-- DESKTOP / TABLET VIEW: Redesigned 6-Column Layout with Connected Workflow Pipeline -->
      <div ref="tableScrollRef" class="hidden md:block overflow-x-auto no-scrollbar" style="scrollbar-width: none; -ms-overflow-style: none;">
        <table class="w-full text-left border-collapse min-w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th class="w-[16%] px-5 py-3.5 whitespace-nowrap">Order</th>
              <th class="w-[22%] px-5 py-3.5">Customer</th>
              <th class="w-[13%] px-5 py-3.5">Items</th>
              <th class="w-[28%] px-5 py-3.5">Workflow Pipeline</th>
              <th class="w-[13%] px-5 py-3.5">Status</th>
              <th class="w-[8%] px-5 py-3.5 text-right whitespace-nowrap pr-5">Action</th>
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
              <!-- 1. ORDER -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-gray-900 group-hover:text-[#1b3b5f] transition-colors">
                    {{ order.orderNumber }}
                  </span>
                  <button 
                    v-if="hasBatches(order)" 
                    type="button"
                    @click.stop="toggleExpand(order.id)"
                    class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold transition shadow-2xs border cursor-pointer select-none"
                    :class="isExpanded(order.id) ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'"
                    title="Click to view fulfillment batches"
                  >
                    <span>⚡ {{ order.batches.length }} Batches</span>
                    <span v-if="hasHoldBatches(order)" class="px-1 py-0.1 rounded text-[8px] bg-amber-500 text-white font-black">Hold</span>
                    <ChevronDown class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-180': isExpanded(order.id) }" />
                  </button>
                  <span v-else-if="order.batchNumber" class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                    Batch {{ order.batchNumber }}/{{ order.batchCount || order.parentOrder?.batchCount || '?' }}
                  </span>
                  <span v-if="order.vehicleMode === 'PARTY_VEHICLE' && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Customer Pickup / Party Vehicle">
                    🚗 Party
                  </span>
                  <span v-else-if="order.vehicleMode === 'THIRD_PARTY' && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200" title="Third Party (Porter / Rapido)">
                    📦 3rd Party
                  </span>
                  <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 !text-gray-600 border border-rose-500">
                    🚫 CANCELLED
                  </span>
                  <span v-else-if="(order as any).isUrgent" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                    ⚡ URGENT
                  </span>
                  <span v-if="(order as any).hasUnsyncedBusyItems || order.customer?.isBusySynced === false" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300" title="Contains customer or product not yet in Busy">
                    <AlertCircle class="w-2.5 h-2.5 text-amber-600" />
                    Not in Busy
                  </span>
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                  {{ formatTime(order.createdAt) }}
                </p>
              </td>

              <!-- 2. CUSTOMER -->
              <td class="px-5 py-3.5 min-w-0">
                <div class="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5" :title="order.customer?.name || 'Walk-in Customer'">
                  <span class="truncate">{{ order.customer?.name || 'Walk-in Customer' }}</span>
                  <span v-if="(order.customer as any)?.isPriorityClient" class="text-amber-500 font-bold text-xs shrink-0" title="Priority Client">★</span>
                </div>
                <p class="text-[11px] text-gray-500 truncate mt-0.5" :title="getCustomerSubtitle(order.customer)">
                  {{ getCustomerSubtitle(order.customer) }}
                </p>
              </td>

              <!-- 3. ITEMS (No Price/Amount) -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div class="text-xs font-bold text-gray-800">
                  {{ order.items?.length || 0 }} {{ (order.items?.length === 1) ? 'item' : 'items' }}
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5">
                  {{ getItemsTotalQuantity(order) }}
                </p>
              </td>

              <!-- 4. WORKFLOW PIPELINE -->
              <td class="px-5 py-3.5 min-w-0" :title="'Pipeline: ' + getOrderPipeline(order).summary">
                <!-- If order has batches: Show Batch Fulfillment Summary with Expand Button -->
                <div v-if="hasBatches(order)" class="flex flex-col gap-1.5" @click.stop="toggleExpand(order.id)">
                  <div class="flex items-center gap-2 flex-wrap">
                    <!-- Approval State Pill -->
                    <span 
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                      :class="order.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-blue-50 text-blue-700 border border-blue-300 animate-pulse'"
                    >
                      <CheckCheck class="w-3 h-3" />
                      <span>{{ order.isApproved ? 'Approved' : 'Pending' }}</span>
                    </span>

                    <!-- Batches Accordion Toggle Pill -->
                    <button 
                      type="button"
                      @click.stop="toggleExpand(order.id)"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs border cursor-pointer select-none"
                      :class="isExpanded(order.id) 
                        ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' 
                        : 'bg-indigo-50/80 text-[#1b3b5f] border-indigo-200/90 hover:bg-indigo-100'"
                    >
                      <Layers class="w-3.5 h-3.5" />
                      <span>{{ order.batches.length }} Batches</span>
                      
                      <!-- On Hold Alert Badge -->
                      <span 
                        v-if="hasHoldBatches(order)" 
                        class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500 text-white font-black"
                        :title="`${getHoldBatchesCount(order)} batch(es) currently on hold`"
                      >
                        {{ getHoldBatchesCount(order) }} On Hold
                      </span>

                      <ChevronDown 
                        class="w-3.5 h-3.5 transition-transform duration-200" 
                        :class="{ 'rotate-180': isExpanded(order.id) }" 
                      />
                    </button>
                  </div>

                  <!-- Micro Summary Line -->
                  <div class="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <span v-if="getBatchesDeliveredCount(order) > 0" class="text-emerald-700 font-bold">
                      {{ getBatchesDeliveredCount(order) }}/{{ order.batches.length }} Delivered
                    </span>
                    <span v-else-if="getBatchesPackedCount(order) > 0" class="text-blue-700 font-bold">
                      {{ getBatchesPackedCount(order) }}/{{ order.batches.length }} Packed
                    </span>
                    <span v-else class="text-gray-500">
                      {{ order.batches.length }} In Progress
                    </span>

                    <span v-if="getOrderPendingPoolUnits(order) > 0" class="text-amber-800 font-semibold">
                      • {{ getOrderPendingPoolUnits(order) }} pcs Pool
                    </span>
                    <span v-else class="text-emerald-600 font-semibold">
                      • Fully Batched
                    </span>
                  </div>
                </div>

                <!-- Unsplit Orders: Standard Linear Stepper Icons -->
                <div v-else class="flex items-start gap-1 sm:gap-2">
                  <template v-for="(step, idx) in getOrderPipeline(order).steps" :key="step.key">
                    <!-- Step Node (Icon + Micro-label) -->
                    <div class="flex flex-col items-center shrink-0">
                      <div 
                        class="relative flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 transition-all shadow-xs"
                        :class="[
                          step.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-400' :
                          step.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-400 animate-pulse ring-2 ring-blue-400/20' :
                          step.status === 'alert' ? 'bg-rose-50 text-rose-700 border border-rose-400' :
                          'bg-gray-50 text-gray-400 border border-gray-200/90 opacity-60'
                        ]"
                        :title="step.label + ': ' + (step.status === 'completed' ? 'Completed' : step.status === 'in_progress' ? 'In Progress' : step.status === 'alert' ? 'Action Needed' : 'Waiting')"
                      >
                        <!-- Exact Icon from Sidebar Menu -->
                        <component 
                          :is="getStepIcon(step.key)" 
                          :class="[
                            step.key === 'B' ? 'w-3 h-3' : 'w-3.5 h-3.5',
                            step.status === 'completed' ? 'stroke-[2.2]' : 'stroke-[1.8]'
                          ]"
                        />

                        <!-- Completed mini check badge -->
                        <span 
                          v-if="step.status === 'completed'" 
                          class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[7px] font-black shadow-xs ring-1 ring-white"
                        >
                          ✓
                        </span>
                      </div>
                      
                      <!-- Micro-Label under icon -->
                      <span 
                        class="text-[9px] font-semibold mt-1 tracking-tight"
                        :class="[
                          step.status === 'completed' ? 'text-emerald-700' :
                          step.status === 'in_progress' ? 'text-blue-700 font-bold' :
                          step.status === 'alert' ? 'text-rose-600 font-bold' :
                          'text-gray-400'
                        ]"
                      >
                        {{ step.shortName }}
                      </span>
                    </div>

                    <!-- Connector Line (between steps) -->
                    <div 
                      v-if="idx < getOrderPipeline(order).steps.length - 1"
                      class="w-3 sm:w-5 h-0.5 rounded-full shrink-0 mt-3 transition-colors"
                      :class="getOrderPipeline(order).steps[idx + 1].status !== 'waiting' ? 'bg-emerald-400' : 'bg-gray-200'"
                    ></div>
                  </template>
                </div>
              </td>

              <!-- 5. STATUS -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <StatusBadge 
                  :status="order.overallStatus" 
                  :display="getDisplayStatus(order)"
                  :class="getOverallColor(order)"
                  class="!text-[11px] !py-0.5 !px-2.5"
                />
              </td>

              <!-- 6. ACTION -->
              <td class="px-5 py-3.5 whitespace-nowrap text-right pr-5">
                <button 
                  type="button"
                  @click.stop="emit('select', order.id)"
                  class="inline-flex items-center gap-1 text-xs font-semibold text-[#1b3b5f] bg-[#1b3b5f]/5 hover:bg-[#1b3b5f]/15 px-2.5 py-1.5 rounded-lg border border-[#1b3b5f]/20 group-hover:border-[#1b3b5f]/40 transition-all shadow-xs"
                >
                  <span>View</span>
                  <ArrowRight class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </td>
            </tr>

            <!-- Expanded Sub-Row for Batches & Pending Pool (Desktop) -->
            <tr v-if="hasBatches(order) && isExpanded(order.id)" :key="'batches-expand-' + order.id" class="bg-gray-50/70 border-b border-gray-200 animate-in fade-in duration-150">
              <td colspan="6" class="p-0">
                <div class="pl-8 sm:pl-12 pr-5 py-3.5 bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50/70 border-y border-gray-200/90 space-y-2.5">
                  <!-- Sub-row Header -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Layers class="w-4 h-4 text-[#1b3b5f]" />
                      <span class="text-xs font-bold text-gray-900 uppercase tracking-wider">
                        Fulfillment Batches for {{ order.orderNumber }}
                      </span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1b3b5f]/10 text-[#1b3b5f]">
                        {{ order.batches.length }} Created
                      </span>
                    </div>

                    <div class="flex items-center gap-3 text-xs">
                      <span class="text-gray-500">
                        Batched: <strong class="text-gray-900 tabular-nums">{{ getOrderBatchedUnits(order) }} pcs</strong>
                      </span>
                      <span class="text-gray-300">&bull;</span>
                      <span :class="getOrderPendingPoolUnits(order) > 0 ? 'text-amber-800 font-semibold' : 'text-emerald-700 font-semibold'">
                        Pending Pool: <strong class="tabular-nums">{{ getOrderPendingPoolUnits(order) }} pcs</strong>
                      </span>
                    </div>
                  </div>

                  <!-- Batches Cards / Rows -->
                  <div class="space-y-2">
                    <div 
                      v-for="b in order.batches" 
                      :key="'sub-batch-' + b.id"
                      @click.stop="emit('select', b.id)"
                      class="bg-white rounded-xl border p-3 flex items-center justify-between gap-4 transition hover:border-[#1b3b5f]/50 hover:shadow-xs cursor-pointer group/batch"
                      :class="b.isBatchOnHold ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'"
                    >
                      <!-- Left: Batch Number + Order Number + On Hold Badge + Units + Amount -->
                      <div class="flex items-center gap-2.5 min-w-[200px]">
                        <span class="px-2 py-1 rounded-md text-xs font-black bg-[#1b3b5f]/10 text-[#1b3b5f] border border-[#1b3b5f]/20 shrink-0">
                          Batch {{ b.batchNumber }}
                        </span>
                        <div>
                          <div class="flex items-center gap-1.5">
                            <span class="font-bold text-xs text-gray-900 group-hover/batch:text-[#1b3b5f] transition-colors font-mono">
                              {{ b.orderNumber }}
                            </span>
                            <!-- ON HOLD BADGE -->
                            <span 
                              v-if="b.isBatchOnHold" 
                              class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300"
                            >
                              <Pause class="w-2.5 h-2.5 fill-current" />
                              <span>On Hold</span>
                            </span>
                            <span 
                              v-else
                              class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              Active
                            </span>
                          </div>
                          <p class="text-[11px] text-gray-500 tabular-nums mt-0.5">
                            {{ getBatchUnits(b) }} pcs &bull; {{ formatCurrency(b.totalAmount || 0) }}
                          </p>
                        </div>
                      </div>

                      <!-- Middle: Batch Pipeline (P -> B -> D) with exact step styling -->
                      <div class="flex items-center gap-3 sm:gap-5 min-w-0">
                        <template v-for="(step, sIdx) in getBatchPipeline(b)" :key="'batch-pipe-' + b.id + '-' + step.key">
                          <div class="flex flex-col items-center shrink-0 min-w-[55px]">
                            <div 
                              class="relative flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 transition-all shadow-2xs"
                              :class="[
                                step.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-500' :
                                step.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-400 animate-pulse ring-2 ring-blue-400/20' :
                                step.status === 'paused' ? 'bg-amber-50 text-amber-700 border border-amber-400' :
                                'bg-gray-50 text-gray-400 border border-gray-200/90 opacity-60'
                              ]"
                            >
                              <Package v-if="step.key === 'P'" class="w-3.5 h-3.5" />
                              <IndianRupee v-else-if="step.key === 'B'" class="w-3 h-3" />
                              <Truck v-else-if="step.key === 'D'" class="w-3.5 h-3.5" />

                              <!-- Completed mini check -->
                              <span 
                                v-if="step.status === 'completed'" 
                                class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[7px] font-black shadow-xs ring-1 ring-white"
                              >
                                ✓
                              </span>
                            </div>
                            <!-- Status text under icon -->
                            <span 
                              class="text-[9px] font-semibold mt-1 tracking-tight"
                              :class="[
                                step.status === 'completed' ? 'text-emerald-700 font-bold' :
                                step.status === 'in_progress' ? 'text-blue-700 font-bold' :
                                step.status === 'paused' ? 'text-amber-700 font-bold' :
                                'text-gray-400'
                              ]"
                            >
                              {{ step.statusText }}
                            </span>
                          </div>

                          <!-- Connector line -->
                          <div 
                            v-if="sIdx < getBatchPipeline(b).length - 1"
                            class="w-4 sm:w-6 h-0.5 rounded-full shrink-0 -mt-4 transition-colors"
                            :class="getBatchPipeline(b)[sIdx + 1].status !== 'waiting' ? 'bg-emerald-400' : 'bg-gray-200'"
                          ></div>
                        </template>
                      </div>

                      <!-- Right: Open Batch Drawer Button -->
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-xs font-bold text-[#1b3b5f] group-hover/batch:underline flex items-center gap-1">
                          <span>View Batch</span>
                          <ArrowRight class="w-3.5 h-3.5 transition-transform group-hover/batch:translate-x-0.5" />
                        </span>
                      </div>
                    </div>

                    <!-- Pending Pool Action Row (if units remain unbatched) -->
                    <div 
                      v-if="getOrderPendingPoolUnits(order) > 0"
                      class="bg-amber-50/50 rounded-xl border border-dashed border-amber-300 p-3 flex items-center justify-between gap-4"
                    >
                      <div class="flex items-center gap-2 text-xs text-amber-900 font-medium">
                        <AlertCircle class="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>{{ getOrderPendingPoolUnits(order) }} units</strong> remain in pending pool awaiting batch allocation.
                        </span>
                      </div>

                      <button 
                        v-if="canManageBatches"
                        type="button"
                        @click.stop="emit('split-order', order.id)"
                        class="px-3 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                      >
                        <Plus class="w-3.5 h-3.5" />
                        <span>Create Batch</span>
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            <TableSkeletonRows v-if="isLoading && !orders?.length" :cols="6" :rows="6" />
            <tr v-else-if="!orders?.length && !isLoading">
              <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500">
                No orders found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="tableScrollRef" />

      <!-- MOBILE VIEW: 4-Line High-Density Non-Scrollable Rows -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <div 
          v-for="order in orders" 
          :key="'mob-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-2.5 cursor-pointer transition-colors flex flex-col gap-1"
          :class="order.overallStatus === 'CANCELLED' 
            ? 'bg-gray-100/75 active:bg-gray-200/60 text-gray-400 [&_span]:!text-gray-400 [&_p]:!text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
            : ((order as any).isUrgent ? 'bg-rose-50/20 active:bg-gray-100 border-l-4 border-l-rose-500' : 'hover:bg-gray-50 active:bg-gray-100')"
        >
          <!-- LINE 1: Order Number & Badges (Left) + Overall Status Badge (Right) -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span class="text-sm font-bold text-gray-950 shrink-0 font-mono">
                {{ order.orderNumber }}
              </span>
              <button 
                v-if="hasBatches(order)" 
                type="button"
                @click.stop="toggleExpand(order.id)"
                class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold transition shadow-2xs border cursor-pointer select-none"
                :class="isExpanded(order.id) ? 'bg-[#1b3b5f] text-white border-[#1b3b5f]' : 'bg-amber-50 text-amber-900 border-amber-300'"
              >
                <span>⚡ {{ order.batches.length }} Batches</span>
                <span v-if="hasHoldBatches(order)" class="px-1 py-0.1 rounded text-[8px] bg-amber-500 text-white font-black">Hold</span>
                <ChevronDown class="w-2.5 h-2.5 transition-transform duration-200" :class="{ 'rotate-180': isExpanded(order.id) }" />
              </button>
              <span v-else-if="order.batchNumber" class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                Batch {{ order.batchNumber }}/{{ order.batchCount || order.parentOrder?.batchCount || '?' }}
              </span>
              <span v-if="order.vehicleMode === 'PARTY_VEHICLE' && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Customer Pickup / Party Vehicle">
                🚗 Party
              </span>
              <span v-else-if="order.vehicleMode === 'THIRD_PARTY' && order.overallStatus !== 'CANCELLED'" class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200" title="Third Party (Porter / Rapido)">
                📦 3rd Party
              </span>
              <span v-if="order.overallStatus === 'CANCELLED'" class="text-[9px] font-bold text-gray-600 bg-gray-200 px-1.5 py-0.2 rounded border border-rose-500">
                🚫 CANCELLED
              </span>
              <span v-else-if="(order as any).isUrgent" class="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 animate-pulse">
                ⚡ URGENT
              </span>
              <span v-if="(order as any).hasUnsyncedBusyItems || order.customer?.isBusySynced === false" class="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-300">
                ⚠️ Not in Busy
              </span>
            </div>
            
            <!-- Overall Status Badge (Cleanly anchored on top right) -->
            <StatusBadge 
              :status="order.overallStatus" 
              :display="getDisplayStatus(order)"
              :class="getOverallColor(order)"
              class="!text-[10px] !py-0.5 !px-2.5 shrink-0 whitespace-nowrap leading-tight"
            />
          </div>

          <!-- LINE 2: Full Customer Name -->
          <div class="flex items-center gap-1.5 min-w-0 leading-tight">
            <span class="font-semibold text-gray-900 text-xs break-words" :title="order.customer?.name || ''">
              {{ order.customer?.name || 'Walk-in Customer' }}
            </span>
            <span v-if="(order.customer as any)?.isPriorityClient" class="text-amber-500 font-bold text-xs shrink-0" title="Priority Client">★</span>
          </div>

          <!-- LINE 3: Phone • City (Left) + Time • Item Count (Right) -->
          <div class="flex items-center justify-between gap-2 text-[11px] text-gray-500 min-w-0 leading-none">
            <span class="truncate min-w-0 font-medium text-gray-500" :title="formatCustomerContact(order.customer)">
              {{ formatCustomerContact(order.customer) !== '—' ? formatCustomerContact(order.customer) : (order.customer?.city || '') }}
            </span>
            <div class="flex items-center gap-1.5 shrink-0 text-gray-400 tabular-nums">
              <span class="text-gray-500 font-medium">{{ formatTime(order.createdAt) }}</span>
              <span class="text-gray-300">•</span>
              <span class="text-gray-600 font-semibold">{{ order.items?.length || 0 }} {{ (order.items?.length === 1) ? 'item' : 'items' }}</span>
            </div>
          </div>

          <!-- LINE 4: Batched Order Pipeline vs Unsplit Pipeline -->
          <div class="flex items-center pt-1.5 mt-0.5 border-t border-gray-100">
            <!-- If has batches: show Approval Badge + View Batches Pill -->
            <div v-if="hasBatches(order)" class="flex items-center justify-between flex-1 min-w-0 pr-1" @click.stop="toggleExpand(order.id)">
              <span 
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                :class="order.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-blue-50 text-blue-700 border border-blue-300'"
              >
                <CheckCheck class="w-3 h-3" />
                <span>{{ order.isApproved ? 'Approved' : 'Pending' }}</span>
              </span>

              <button 
                type="button" 
                @click.stop="toggleExpand(order.id)"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                <span>{{ isExpanded(order.id) ? 'Hide Batches' : `${order.batches.length} Batches` }}</span>
                <span v-if="hasHoldBatches(order)" class="px-1 py-0.2 rounded text-[8px] bg-amber-500 text-white font-extrabold">Hold</span>
                <ChevronDown class="w-3.5 h-3.5 transition-transform duration-200" :class="{ 'rotate-180': isExpanded(order.id) }" />
              </button>
            </div>

            <!-- Normal linear stepper if no batches -->
            <div v-else class="flex items-center justify-between flex-1 min-w-0 pr-1">
              <template v-for="(step, idx) in getOrderPipeline(order).steps" :key="'mob-step-' + step.key">
                <!-- Step Node -->
                <div 
                  class="flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 transition-all shadow-2xs"
                  :class="[
                    step.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-400' :
                    step.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-400 animate-pulse ring-2 ring-blue-400/20' :
                    step.status === 'alert' ? 'bg-rose-50 text-rose-700 border border-rose-400' :
                    'bg-gray-50 text-gray-400 border border-gray-200/90 opacity-60'
                  ]"
                  :title="step.label"
                >
                  <component 
                    :is="getStepIcon(step.key)" 
                    :class="[
                      step.key === 'B' ? 'w-3 h-3' : 'w-3.5 h-3.5',
                      step.status === 'completed' ? 'stroke-[2.2]' : 'stroke-[1.8]'
                    ]"
                  />
                </div>

                <!-- Connector Line -->
                <div 
                  v-if="idx < getOrderPipeline(order).steps.length - 1"
                  class="flex-1 mx-1.5 h-0.5 rounded-full transition-colors"
                  :class="getOrderPipeline(order).steps[idx + 1].status !== 'waiting' ? 'bg-emerald-400' : 'bg-gray-200'"
                ></div>
              </template>
            </div>

            <ChevronRight class="w-4 h-4 text-gray-300 shrink-0 ml-1" />
          </div>

          <!-- Mobile Expanded Sub-batches Section -->
          <div v-if="hasBatches(order) && isExpanded(order.id)" class="mt-2 pt-2 border-t border-dashed border-gray-200 space-y-2 animate-in fade-in duration-150">
            <div 
              v-for="b in order.batches" 
              :key="'mob-sub-batch-' + b.id"
              @click.stop="emit('select', b.id)"
              class="p-2.5 rounded-xl border bg-gray-50/70 space-y-2 cursor-pointer transition active:bg-gray-100"
              :class="b.isBatchOnHold ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'"
            >
              <!-- Line A: Batch Number, On Hold badge, Units -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1b3b5f]/10 text-[#1b3b5f]">
                    Batch {{ b.batchNumber }}
                  </span>
                  <span class="font-bold text-xs text-gray-900 font-mono">{{ b.orderNumber }}</span>
                  <!-- ON HOLD BADGE -->
                  <span v-if="b.isBatchOnHold" class="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    ⏸ On Hold
                  </span>
                  <span v-else class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
                <span class="text-xs font-extrabold text-gray-800 tabular-nums">
                  {{ getBatchUnits(b) }} pcs
                </span>
              </div>

              <!-- Line B: 3-step pipeline icons for the batch -->
              <div class="flex items-center justify-between pt-1 border-t border-gray-150">
                <template v-for="(step, sIdx) in getBatchPipeline(b)" :key="'mob-b-pipe-' + b.id + '-' + step.key">
                  <div class="flex items-center gap-1">
                    <div 
                      class="flex items-center justify-center w-5 h-5 rounded-full text-xs"
                      :class="[
                        step.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        step.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        step.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-400 opacity-60'
                      ]"
                    >
                      <Package v-if="step.key === 'P'" class="w-3 h-3" />
                      <IndianRupee v-else-if="step.key === 'B'" class="w-2.5 h-2.5" />
                      <Truck v-else-if="step.key === 'D'" class="w-3 h-3" />
                    </div>
                    <span 
                      class="text-[10px] font-semibold" 
                      :class="step.status === 'completed' ? 'text-emerald-700 font-bold' : (step.status === 'paused' ? 'text-amber-700 font-bold' : 'text-gray-500')"
                    >
                      {{ step.statusText }}
                    </span>
                  </div>
                  <div v-if="sIdx < 2" class="w-3 h-0.5 bg-gray-200"></div>
                </template>
              </div>
            </div>

            <!-- Mobile Pending Pool Row -->
            <div v-if="getOrderPendingPoolUnits(order) > 0" class="p-2 bg-amber-50 rounded-lg border border-dashed border-amber-300 flex items-center justify-between gap-2">
              <span class="text-[11px] text-amber-900 font-semibold">
                Pending Pool: <strong>{{ getOrderPendingPoolUnits(order) }} pcs</strong>
              </span>
              <button 
                v-if="canManageBatches"
                type="button" 
                @click.stop="emit('split-order', order.id)" 
                class="px-2 py-1 bg-[#1b3b5f] text-white text-[10px] font-bold rounded shadow-2xs active:scale-95 cursor-pointer"
              >
                + Create Batch
              </button>
            </div>
          </div>
        </div>

        <TableSkeletonRows v-if="isLoading && !orders?.length" :cols="6" :rows="5" :isMobileOnly="true" :renderMobile="true" />

        <div v-else-if="!orders?.length && !isLoading" class="px-4 py-8 text-center text-sm text-gray-500">
          No orders found.
        </div>
      </div>
    </div>

    <!-- Pagination Bottom -->
    <div class="p-3 sm:p-4 border-t border-gray-200 bg-white rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
      <p class="text-[11px] sm:text-xs text-gray-500 whitespace-nowrap text-center sm:text-left">
        Showing <span class="font-medium text-gray-900">{{ orders.length ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
        to <span class="font-medium text-gray-900">{{ limit === -1 ? total : Math.min(page * limit, total) }}</span>
        of <span class="font-medium text-gray-900">{{ total }}</span> orders
      </p>

      <div class="flex items-center justify-center gap-1.5 sm:gap-2">
        <button
          :disabled="page <= 1"
          @click="emit('update:page', Math.max(1, page - 1))"
          class="p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeft class="w-4 h-4" />
          <span class="hidden sm:inline">Previous</span>
        </button>
        <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (Math.ceil(total / limit) || 1) }}</span>
        <button
          :disabled="limit === -1 || page * limit >= total"
          @click="emit('update:page', page + 1)"
          class="p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          title="Next Page"
        >
          <span class="hidden sm:inline">Next</span>
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

