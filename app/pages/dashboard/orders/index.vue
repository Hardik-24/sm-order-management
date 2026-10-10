<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import OrderTable from '~/components/dashboard/OrderTable.vue'
import OrderDetailPanel from '~/components/dashboard/OrderDetailPanel.vue'

definePageMeta({ layout: 'dashboard' })

// Assuming useAuth is auto-imported
const { hasRole } = useAuth()

const page = ref(1)
const limit = ref(10)
const search = ref('')
const status = ref('')
const billingStatus = ref('')
const packingStatus = ref('')
const deliveryStatus = ref('')
const isApproved = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedOrderId = ref<string | null>(null)
const isPanelOpen = ref(false)

// Reset page to 1 whenever any filter or search changes
watch([search, status, billingStatus, packingStatus, deliveryStatus, isApproved, startDate, endDate], () => {
  page.value = 1
})

const queryObj = computed(() => {
  const q: Record<string, any> = { 
    page: page.value, 
    limit: limit.value 
  }
  if (search.value && search.value.trim()) q.search = search.value.trim()
  if (status.value) q.status = status.value
  if (billingStatus.value) q.billingStatus = billingStatus.value
  if (packingStatus.value) q.packingStatus = packingStatus.value
  if (deliveryStatus.value) q.deliveryStatus = deliveryStatus.value
  if (isApproved.value !== '') q.isApproved = isApproved.value
  if (startDate.value) q.startDate = startDate.value
  if (endDate.value) q.endDate = endDate.value
  return q
})

const nuxtApp = useNuxtApp()
const { data, refresh, pending } = useFetch('/api/orders', {
  query: queryObj,
  watch: [queryObj]
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
      data.value.orders[idx] = {
        ...data.value.orders[idx],
        ...updatedOrder,
        customer: updatedOrder.customer || data.value.orders[idx].customer,
        totalAmount: updatedOrder.totalAmount !== undefined ? updatedOrder.totalAmount : data.value.orders[idx].totalAmount,
        items: updatedOrder.items || data.value.orders[idx].items,
      }
    }
  }
}

const handlePanelUpdate = (updatedOrder?: any) => {
  if (updatedOrder) {
    applyOrderUpdate(updatedOrder)
  }
  // 
  refresh()
}

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) {
    applyOrderUpdate(event.order)
  }
  // 
  refresh()
})
</script>

<template>
  <div>

    <!-- Table -->
    <OrderTable 
      :orders="data?.orders || []"
      :isLoading="pending"
      :total="data?.total || 0"
      v-model:page="page"
      v-model:limit="limit"
      v-model:search="search"
      v-model:status="status"
      v-model:billingStatus="billingStatus"
      v-model:packingStatus="packingStatus"
      v-model:deliveryStatus="deliveryStatus"
      v-model:isApproved="isApproved"
      v-model:startDate="startDate"
      v-model:endDate="endDate"
      @select="handleSelect"
    />

    <!-- Detail Panel -->
    <OrderDetailPanel 
      :orderId="selectedOrderId"
      :isOpen="isPanelOpen"
      @close="handlePanelClose"
      @updated="handlePanelUpdate"
    />
  </div>
</template>
