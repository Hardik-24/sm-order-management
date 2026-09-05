<script setup lang="ts">
import { ref } from 'vue'
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
const startDate = ref('')
const endDate = ref('')
const selectedOrderId = ref<string | null>(null)
const isPanelOpen = ref(false)

const nuxtApp = useNuxtApp()
const { data, refresh, pending } = useFetch('/api/orders', {
  query: { 
    page, 
    limit,
    search,
    status,
    billingStatus,
    packingStatus,
    deliveryStatus,
    startDate,
    endDate
  },
  watch: [page, limit, search, status, billingStatus, packingStatus, deliveryStatus, startDate, endDate],
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
  // Clear the cached key so subsequent fetches always get fresh DB data
  const cachedKeys = Object.keys(nuxtApp.payload.data).filter(k => k.startsWith('/api/orders') || k.includes('orders'))
  cachedKeys.forEach(k => {
    delete nuxtApp.payload.data[k]
  })
  refresh()
}

// Realtime instant synchronization across all devices
const { onOrderSync } = useRealtimeSync()
onOrderSync((event) => {
  if (event?.order) {
    applyOrderUpdate(event.order)
  }
  const cachedKeys = Object.keys(nuxtApp.payload.data).filter(k => k.startsWith('/api/orders') || k.includes('orders'))
  cachedKeys.forEach(k => {
    delete nuxtApp.payload.data[k]
  })
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
