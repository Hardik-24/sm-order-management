<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import BillingTable from '~/components/dashboard/BillingTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'
import GenerateBillModal from '~/components/dashboard/GenerateBillModal.vue'
import { FileText, FileClock, Clock, CheckCircle, ChevronRight, Box, Truck } from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'

definePageMeta({ layout: 'dashboard' })

const page = ref(1)
const limit = ref(10)
const search = ref('')
const startDate = ref('')
const endDate = ref('')
const status = ref('')
const billingStatus = ref('')
const packingStatus = ref('')
const deliveryStatus = ref('')
const selectedOrderId = ref<string | null>(null)
const isPanelOpen = ref(false)

const activeTab = ref<'ALL' | 'PENDING' | 'GENERATED'>('PENDING')

const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }
  
  if (billingStatus.value) {
    q.billingStatus = billingStatus.value
  } else if (activeTab.value !== 'ALL') {
    q.billingStatus = activeTab.value
  }

  if (search.value) q.search = search.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  return q
})

const statsQuery = computed(() => {
  const q: any = {}
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  return q
})

const { data: statsData, refresh: refreshStats } = useFetch('/api/orders/billing-stats', {
  query: statsQuery,
  watch: [statsQuery]
})

const nuxtApp = useNuxtApp()
const { data, refresh, pending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj],
  getCachedData(key) {
    return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
  }
})

const handleSelect = (id: string) => {
  selectedOrderId.value = id
  isPanelOpen.value = true
}

const handlePanelClose = () => {
  isPanelOpen.value = false
  selectedOrderId.value = null
}

const applyOrderUpdate = (updatedOrder: any) => {
  if (!updatedOrder || !updatedOrder.id) return
  if (data.value && Array.isArray(data.value.orders)) {
    const idx = data.value.orders.findIndex((o: any) => o.id === updatedOrder.id)
    if (idx !== -1) {
      data.value.orders[idx] = { ...data.value.orders[idx], ...updatedOrder }
    }
  }
}

const handleUpdate = (updatedOrder?: any) => {
  if (updatedOrder) applyOrderUpdate(updatedOrder)
  const cachedKeys = Object.keys(nuxtApp.payload.data).filter(k => k.startsWith('/api/orders') || k.includes('orders'))
  cachedKeys.forEach(k => delete nuxtApp.payload.data[k])
  refresh()
  refreshStats()
}

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) applyOrderUpdate(event.order)
  const cachedKeys = Object.keys(nuxtApp.payload.data).filter(k => k.startsWith('/api/orders') || k.includes('orders'))
  cachedKeys.forEach(k => delete nuxtApp.payload.data[k])
  refresh()
  refreshStats()
})

const isGenerateModalOpen = ref(false)
const generatingOrderId = ref<string | null>(null)

const openGenerateModal = (id: string) => {
  generatingOrderId.value = id
  isGenerateModalOpen.value = true
}

const onInvoiceGenerated = () => {
  handleUpdate()
}

// GSAP Animations
const { animateNumber, animateStagger, initContext } = useGsapAnimation()
const statsContainer = ref<HTMLElement | null>(null)
const numPending = ref<HTMLElement | null>(null)
const numUrgent = ref<HTMLElement | null>(null)
const numGenerated = ref<HTMLElement | null>(null)
const numOnHold = ref<HTMLElement | null>(null)

const triggerStatAnimations = () => {
  if (!statsData.value) return
  nextTick(() => {
    animateNumber(numPending.value, statsData.value?.pending || 0, { duration: 0.6 })
    animateNumber(numUrgent.value, statsData.value?.urgent || 0, { duration: 0.6 })
    animateNumber(numGenerated.value, statsData.value?.generatedToday || 0, { duration: 0.65 })
    animateNumber(numOnHold.value, statsData.value?.onHold || 0, { duration: 0.7 })
  })
}

onMounted(() => {
  initContext(statsContainer.value || undefined)
  if (statsContainer.value) {
    animateStagger(statsContainer.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  triggerStatAnimations()
})

watch(statsData, () => {
  triggerStatAnimations()
}, { deep: true })
</script>

<template>
  <div class="space-y-8">
    <GenerateBillModal 
      :isOpen="isGenerateModalOpen"
      :orderId="generatingOrderId"
      @close="isGenerateModalOpen = false"
      @generated="onInvoiceGenerated"
    />

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[#1a1a1a]">Billing Overview</h1>
      </div>
    </div>

    <!-- Quick Stats matching reference UI -->
    <div ref="statsContainer" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Awaiting Billing -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-amber-50 p-2.5 rounded-lg text-amber-600 border border-amber-100/50">
              <FileClock class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-amber-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Awaiting Billing</p>
            <h3 ref="numPending" class="text-2xl font-bold text-gray-900 mb-0.5">0</h3>
            <p class="text-xs text-gray-500">Orders to invoice</p>
          </div>
        </div>
      </div>

      <!-- Urgent / SLA Breached -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-red-50 p-2.5 rounded-lg text-red-600 border border-red-100/50">
              <Clock class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-red-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Urgent (SLA)</p>
            <h3 ref="numUrgent" class="text-2xl font-bold text-gray-900 mb-0.5">0</h3>
            <p class="text-xs text-red-500 font-medium">Waiting > 2 hours</p>
          </div>
        </div>
      </div>

      <!-- Invoices Generated Today -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-[#1a5c4c]/10 p-2.5 rounded-lg text-[#1a5c4c] border border-[#1a5c4c]/20">
              <CheckCircle class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-[#1a5c4c] rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Invoices Generated</p>
            <h3 ref="numGenerated" class="text-2xl font-bold text-gray-900 mb-0.5">0</h3>
            <p class="text-xs text-gray-500">Completed today</p>
          </div>
        </div>
      </div>

      <!-- Flagged / On Hold -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-5 shadow-sm">
        <div class="flex gap-4">
          <div class="flex flex-col justify-between">
            <div class="bg-orange-50 p-2.5 rounded-lg text-orange-600 border border-orange-100/50">
              <FileText class="w-5 h-5" />
            </div>
            <div class="w-8 h-1 bg-orange-500 rounded-full mt-6"></div>
          </div>
          <div class="flex flex-col justify-center">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Flagged / On Hold</p>
            <h3 ref="numOnHold" class="text-2xl font-bold text-gray-900 mb-0.5">0</h3>
            <p class="text-xs text-orange-500 font-medium">Needs clarification</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex gap-8">
        <button 
          v-for="tab in ['PENDING', 'GENERATED', 'ON_HOLD', 'ALL']" :key="tab"
          @click="activeTab = tab as any; page = 1"
          class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
        >
          {{ tab === 'ALL' ? 'All Invoices' : tab === 'PENDING' ? 'Awaiting Billing' : tab === 'ON_HOLD' ? 'On Hold' : 'Invoiced Today' }}
        </button>
      </nav>
    </div>

    <!-- Table -->
    <div class="relative">
      <BillingTable 
        :isLoading="pending"
        :orders="data?.orders || []"
        :total="data?.total || 0"
        v-model:page="page"
        v-model:limit="limit"
        v-model:search="search"
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:status="status"
        v-model:billingStatus="billingStatus"
        @select="handleSelect"
        @generate-invoice="openGenerateModal"
      />
    </div>

    <!-- Detail Panel -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      context="billing"
      @close="handlePanelClose"
      @updated="handleUpdate"
    />

  </div>
</template>
