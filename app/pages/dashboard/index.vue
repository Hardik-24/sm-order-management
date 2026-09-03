<script setup lang="ts">
import { ref } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { formatDate } from '~/lib/utils'

import StatCards from '~/components/dashboard/StatCards.vue'
import OrderFlowPipeline from '~/components/dashboard/OrderFlowPipeline.vue'
import NeedsAttention from '~/components/dashboard/NeedsAttention.vue'
import OrderTable from '~/components/dashboard/OrderTable.vue'

import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'

definePageMeta({
  layout: 'dashboard'
})

const currentDate = new Date()

const { data: dashboardData, pending: dashboardPending } = useFetch('/api/dashboard')

const page = ref(1)
const limit = ref(5)
const search = ref('')
const startDate = ref('')
const endDate = ref('')
const status = ref('')
const billingStatus = ref('')
const packingStatus = ref('')
const deliveryStatus = ref('')

const isPanelOpen = ref(false)
const selectedOrderId = ref<string | null>(null)

const queryObj = computed(() => {
  const q: any = { page: page.value, limit: limit.value }
  if (search.value) q.search = search.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  return q
})

const { data: ordersData, pending: ordersPending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
})

const handleOrderSelect = (orderId: string) => {
  selectedOrderId.value = orderId
  isPanelOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Banner -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
      <div>
        <p class="text-sm text-gray-600 font-medium">Here's what's happening across Silicon Marketing today.</p>
      </div>
      <div class="flex items-center gap-2 text-[13px] text-gray-500 font-medium">
        {{ formatDate(currentDate) }}
        <Calendar class="w-4 h-4 ml-1" />
      </div>
    </div>

    <!-- Stat Cards (always rendered, numbers animate when data arrives) -->
    <StatCards :stats="dashboardData" :isLoading="dashboardPending" />

    <!-- Pipeline & Attention -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div class="lg:col-span-3">
        <OrderFlowPipeline :flow="dashboardData?.orderFlow" />
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
        @select="handleOrderSelect"
      />
    </div>

    <!-- Slide-out Order Detail Panel -->
    <OrderDetailPanel 
      :order-id="selectedOrderId"
      :is-open="isPanelOpen"
      @close="isPanelOpen = false"
    />
  </div>
</template>
