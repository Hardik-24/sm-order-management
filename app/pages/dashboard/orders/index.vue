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
  watch: [page, limit, search, status, billingStatus, packingStatus, deliveryStatus, startDate, endDate]
})

const handleSelect = (id: string) => {
  selectedOrderId.value = id
  isPanelOpen.value = true
}

const handlePanelClose = () => {
  isPanelOpen.value = false
  selectedOrderId.value = null
}

const handlePanelUpdate = () => {
  refresh()
}
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
