<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar, Building2, User as UserIcon, Filter, ChevronDown } from 'lucide-vue-next'
import { formatDate } from '~/lib/utils'

import StatCards from '~/components/dashboard/StatCards.vue'
import OrderVolumeChart from '~/components/dashboard/OrderVolumeChart.vue'
import NeedsAttention from '~/components/dashboard/NeedsAttention.vue'
import OrderTable from '~/components/dashboard/OrderTable.vue'

import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'

definePageMeta({
  layout: 'dashboard'
})

const { user } = useAuth()
const isSales = computed(() => user.value?.role === 'SALES')
const isAdmin = computed(() => user.value?.role === 'ADMIN')

// 1. Sales rep toggle: defaults to 'mine' (personal target view)
const salesScope = ref<'mine' | 'all'>('mine')

// 2. Admin dropdown: defaults to 'all' (company-wide view)
const adminSelectedSalesPerson = ref<string>('all')

// Fetch active team members for Admin dropdown
const { data: allUsers } = useFetch<any[]>('/api/users')
const salesTeam = computed(() => {
  if (!allUsers.value) return []
  return allUsers.value.filter(u => u.role === 'SALES' || u.role === 'ADMIN')
})

// Resolve active filter for dashboard & orders
const effectiveSalesPersonId = computed(() => {
  if (isAdmin.value) {
    return adminSelectedSalesPerson.value !== 'all' ? adminSelectedSalesPerson.value : undefined
  }
  if (isSales.value) {
    return salesScope.value === 'mine' ? user.value?.id : undefined
  }
  return undefined
})

const currentDate = new Date()

// Dashboard stats query (reactive to scope changes)
const dashboardQuery = computed(() => {
  const q: any = {}
  if (effectiveSalesPersonId.value) {
    q.salesPersonId = effectiveSalesPersonId.value
  }
  return q
})

const { data: dashboardData, pending: dashboardPending, refresh: refreshDashboard } = useFetch<any>('/api/dashboard', {
  query: dashboardQuery,
  watch: [dashboardQuery]
})

const page = ref(1)
const limit = ref(5)
const search = ref('')
const startDate = ref('')
const endDate = ref('')
const status = ref('')
const billingStatus = ref('')
const packingStatus = ref('')
const deliveryStatus = ref('')
const isApproved = ref('')

const isPanelOpen = ref(false)
const selectedOrderId = ref<string | null>(null)

// Recent orders table query (reactive to scope changes)
const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }
  if (search.value) q.search = search.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  if (isApproved.value) q.isApproved = isApproved.value
  if (effectiveSalesPersonId.value) {
    q.salesPersonId = effectiveSalesPersonId.value
  }
  return q
})

const { data: ordersData, pending: ordersPending, refresh: refreshOrders } = useFetch<any>('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync(() => {
  refreshDashboard()
  refreshOrders()
})

const handleOrderSelect = (orderId: string) => {
  selectedOrderId.value = orderId
  isPanelOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Banner with Role-Based Scope Controls -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
      <div>
        <p class="text-sm text-gray-600 font-medium">
          Here's what's happening across Silicon Marketing today.
        </p>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <!-- 1. SALES ROLE TOGGLE: All Company vs My Orders -->
        <div v-if="isSales" class="inline-flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80 shadow-2xs">
          <button
            type="button"
            @click="salesScope = 'all'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            :class="salesScope === 'all' ? 'bg-white text-[#1b3b5f] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'"
          >
            <Building2 class="w-3.5 h-3.5" />
            <span>All Company</span>
          </button>
          <button
            type="button"
            @click="salesScope = 'mine'"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            :class="salesScope === 'mine' ? 'bg-white text-[#1b3b5f] shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'"
          >
            <UserIcon class="w-3.5 h-3.5" />
            <span>My Orders</span>
          </button>
        </div>

        <!-- 2. ADMIN ROLE DROPDOWN: All Company or Specific Sales Rep -->
        <div v-else-if="isAdmin" class="flex items-center gap-2">
          <span class="text-xs text-gray-500 font-medium hidden sm:inline">Scope:</span>
          <div class="relative">
            <select
              v-model="adminSelectedSalesPerson"
              class="appearance-none bg-white border border-gray-200 text-gray-800 text-xs font-semibold rounded-xl pl-8 pr-8 py-1.5 shadow-2xs hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition cursor-pointer"
            >
              <option value="all">🏢 All Company (Entire Team)</option>
              <optgroup label="Filter by Sales Rep">
                <option v-for="rep in salesTeam" :key="rep.id" :value="rep.id">
                  👤 {{ rep.name }} ({{ rep.role }})
                </option>
              </optgroup>
            </select>
            <Filter class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <!-- Date & Calendar Indicator -->
        <div class="flex items-center gap-2 text-[13px] text-gray-500 font-medium pl-1">
          {{ formatDate(currentDate) }}
          <Calendar class="w-4 h-4 ml-0.5 text-[#1b3b5f]" />
        </div>
      </div>
    </div>

    <!-- Stat Cards (non-clickable, hover border animation intact) -->
    <StatCards :stats="dashboardData" :isLoading="dashboardPending" />

    <!-- Order Velocity Chart & Attention -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div class="lg:col-span-3">
        <OrderVolumeChart :trends="dashboardData?.orderTrends" :isLoading="dashboardPending" />
      </div>
      <div class="lg:col-span-2">
        <NeedsAttention :items="dashboardData?.needsAttention || []" />
      </div>
    </div>

    <!-- Recent Orders Table -->
    <div>
      <h2 class="text-lg font-medium text-gray-900 mb-4">Recent Orders</h2>
      <OrderTable 
        :orders="ordersData?.orders || []"
        :isLoading="ordersPending"
        :total="ordersData?.total || 0"
        v-model:page="page"
        v-model:limit="limit"
        v-model:search="search"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:status="status"
        v-model:billingStatus="billingStatus"
        v-model:packingStatus="packingStatus"
        v-model:deliveryStatus="deliveryStatus"
        v-model:isApproved="isApproved"
        @select="handleOrderSelect"
      />
    </div>

    <!-- Slide-out Order Detail Panel -->
    <OrderDetailPanel 
      :order-id="selectedOrderId"
      :is-open="isPanelOpen"
      context="overview"
      @close="isPanelOpen = false"
      @updated="() => { refreshOrders(); refreshDashboard(); }"
    />
  </div>
</template>
