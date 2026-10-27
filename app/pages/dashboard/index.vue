<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Calendar, Building2, User as UserIcon, Filter, ChevronDown, Check, Search, X, Users } from 'lucide-vue-next'
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
const isScopeDropdownOpen = ref(false)
const scopeSearchQuery = ref('')

// Fetch active team members for Admin dropdown
const { data: allUsers } = useFetch<any[]>('/api/users')
const salesTeam = computed(() => {
  if (!allUsers.value) return []
  return allUsers.value.filter(u => u.role === 'SALES' || u.role === 'ADMIN')
})

const selectedRep = computed(() => {
  if (adminSelectedSalesPerson.value === 'all') return null
  return salesTeam.value.find(r => r.id === adminSelectedSalesPerson.value) || null
})

const filteredSalesTeam = computed(() => {
  if (!scopeSearchQuery.value.trim()) return salesTeam.value
  const q = scopeSearchQuery.value.toLowerCase().trim()
  return salesTeam.value.filter(r => 
    r.name?.toLowerCase().includes(q) || 
    r.role?.toLowerCase().includes(q)
  )
})

function getInitials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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
  return {
    salesPersonId: effectiveSalesPersonId.value || 'all',
    scope: isSales.value ? salesScope.value : (adminSelectedSalesPerson.value === 'all' ? 'all' : 'single')
  }
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
  const q: any = { 
    page: page.value, 
    limit: limit.value,
    salesPersonId: effectiveSalesPersonId.value || 'all',
    scope: isSales.value ? salesScope.value : (adminSelectedSalesPerson.value === 'all' ? 'all' : 'single')
  }
  if (search.value) q.search = search.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  if (isApproved.value) q.isApproved = isApproved.value
  return q
})

const { data: ordersData, pending: ordersPending, refresh: refreshOrders } = useFetch<any>('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

// Watch scope changes to immediately reset page to 1 and reload data
watch([adminSelectedSalesPerson, salesScope], () => {
  page.value = 1
  refreshDashboard()
  refreshOrders()
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

        <!-- 2. ADMIN ROLE SCOPE DROPDOWN: Executive Filter (All Company vs Specific Sales Rep) -->
        <div v-else-if="isAdmin" class="relative w-full sm:w-auto">
          <!-- Trigger Button -->
          <button
            type="button"
            @click="isScopeDropdownOpen = !isScopeDropdownOpen"
            class="w-full sm:w-auto inline-flex items-center justify-between gap-3 px-3.5 py-2 bg-white hover:bg-gray-50/90 border rounded-xl text-xs font-semibold shadow-2xs transition-all duration-200 cursor-pointer select-none active:scale-[0.99]"
            :class="adminSelectedSalesPerson !== 'all' 
              ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-[#1b3b5f] ring-2 ring-[#1b3b5f]/15' 
              : 'border-gray-200 text-gray-800 hover:border-gray-300'"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <!-- Icon / Avatar -->
              <div 
                v-if="adminSelectedSalesPerson === 'all'" 
                class="w-7 h-7 rounded-lg bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center shrink-0 border border-[#1b3b5f]/15"
              >
                <Building2 class="w-3.5 h-3.5" />
              </div>
              <div 
                v-else 
                class="w-7 h-7 rounded-lg bg-[#1b3b5f] text-white flex items-center justify-center font-bold text-[10.5px] shrink-0 shadow-xs"
              >
                {{ getInitials(selectedRep?.name || '') }}
              </div>

              <div class="flex flex-col text-left min-w-0">
                <span class="text-[9.5px] uppercase font-bold tracking-wider leading-none mb-0.5" :class="adminSelectedSalesPerson !== 'all' ? 'text-[#1b3b5f]' : 'text-gray-400'">
                  {{ adminSelectedSalesPerson === 'all' ? 'Company Scope' : 'Filtering By Rep' }}
                </span>
                <span class="font-bold text-gray-900 truncate text-xs">
                  {{ adminSelectedSalesPerson === 'all' ? 'All Company (Team)' : selectedRep?.name }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0 ml-1">
              <span v-if="adminSelectedSalesPerson !== 'all'" class="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-[#1b3b5f] text-white">
                {{ selectedRep?.role || 'REP' }}
              </span>
              <ChevronDown class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="{ 'rotate-180': isScopeDropdownOpen }" />
            </div>
          </button>

          <!-- Backdrop click to close -->
          <div v-if="isScopeDropdownOpen" @click="isScopeDropdownOpen = false" class="fixed inset-0 z-40"></div>

          <!-- Dropdown Menu -->
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform opacity-0 scale-95 -translate-y-1"
            enter-to-class="transform opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform opacity-100 scale-100 translate-y-0"
            leave-to-class="transform opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="isScopeDropdownOpen"
              class="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-full sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-200/90 py-2 z-50 overflow-hidden"
            >
              <div class="px-3.5 py-2 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p class="text-xs font-bold text-gray-900">Dashboard View Scope</p>
                  <p class="text-[11px] text-gray-500">Filter KPIs & pipeline by salesperson</p>
                </div>
                <button 
                  v-if="adminSelectedSalesPerson !== 'all'"
                  @click="adminSelectedSalesPerson = 'all'; isScopeDropdownOpen = false"
                  class="text-[11px] font-bold text-[#1b3b5f] hover:underline cursor-pointer"
                >
                  Reset to All
                </button>
              </div>

              <!-- Quick Search if team has members -->
              <div v-if="salesTeam.length > 3" class="p-2 border-b border-gray-100">
                <div class="relative">
                  <Search class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    v-model="scopeSearchQuery"
                    type="text"
                    placeholder="Search rep name or role..."
                    class="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f]"
                  />
                </div>
              </div>

              <div class="max-h-64 overflow-y-auto py-1">
                <!-- Option: All Company -->
                <button
                  type="button"
                  @click="adminSelectedSalesPerson = 'all'; isScopeDropdownOpen = false"
                  class="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left cursor-pointer"
                  :class="adminSelectedSalesPerson === 'all' ? 'bg-[#1b3b5f]/5' : ''"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-blue-50 text-[#1b3b5f] flex items-center justify-center shrink-0 border border-blue-100">
                      <Building2 class="w-4 h-4" />
                    </div>
                    <div>
                      <p class="text-xs font-bold" :class="adminSelectedSalesPerson === 'all' ? 'text-[#1b3b5f]' : 'text-gray-900'">
                        All Company
                      </p>
                      <p class="text-[11px] text-gray-500">Entire team aggregated view</p>
                    </div>
                  </div>
                  <Check v-if="adminSelectedSalesPerson === 'all'" class="w-4 h-4 text-[#1b3b5f]" />
                </button>

                <div class="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50/70 border-y border-gray-100/80 my-1 flex items-center justify-between">
                  <span>Sales Representatives</span>
                  <span>{{ salesTeam.length }} Total</span>
                </div>

                <!-- Sales Team Options -->
                <button
                  v-for="rep in filteredSalesTeam"
                  :key="rep.id"
                  type="button"
                  @click="adminSelectedSalesPerson = rep.id; isScopeDropdownOpen = false"
                  class="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left cursor-pointer"
                  :class="adminSelectedSalesPerson === rep.id ? 'bg-[#1b3b5f]/5' : ''"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0 border border-gray-200">
                      {{ getInitials(rep.name) }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs font-bold truncate" :class="adminSelectedSalesPerson === rep.id ? 'text-[#1b3b5f]' : 'text-gray-900'">
                        {{ rep.name }}
                      </p>
                      <span class="inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200">
                        {{ rep.role }}
                      </span>
                    </div>
                  </div>
                  <Check v-if="adminSelectedSalesPerson === rep.id" class="w-4 h-4 text-[#1b3b5f] shrink-0" />
                </button>

                <div v-if="filteredSalesTeam.length === 0" class="px-3.5 py-4 text-center text-xs text-gray-500">
                  No team member matching "{{ scopeSearchQuery }}"
                </div>
              </div>
            </div>
          </transition>
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
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Recent Orders</h2>
          <p class="text-xs text-gray-500 mt-0.5">
            <span v-if="isAdmin && adminSelectedSalesPerson !== 'all' && selectedRep">
              Showing orders created by <strong class="text-gray-900 font-semibold">{{ selectedRep.name }}</strong>
            </span>
            <span v-else-if="isSales && salesScope === 'mine'">
              Showing your <strong class="text-gray-900 font-semibold">personal orders</strong>
            </span>
            <span v-else>
              Showing orders across the <strong class="text-gray-900 font-semibold">entire company</strong>
            </span>
          </p>
        </div>
        <div v-if="(isAdmin && adminSelectedSalesPerson !== 'all') || (isSales && salesScope === 'mine')" class="self-start sm:self-auto">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1b3b5f]/10 text-[#1b3b5f] border border-[#1b3b5f]/15">
            <UserIcon class="w-3.5 h-3.5" />
            Filtered: {{ isAdmin ? (selectedRep?.name || 'Representative') : 'My Orders' }}
          </span>
        </div>
      </div>
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
