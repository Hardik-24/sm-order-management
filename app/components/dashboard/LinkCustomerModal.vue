<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[360] flex items-center justify-center p-2 sm:p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeModal"></div>

      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[92vh] overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/50 shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f] text-white flex items-center justify-center shadow-xs shrink-0">
              <Link2 class="w-5 h-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 truncate">
                <span>Link to Busy Customer Ledger</span>
              </h2>
              <p class="text-xs text-gray-500 mt-0.5 truncate">
                Order <strong class="font-mono text-gray-800">{{ order?.orderNumber }}</strong>
              </p>
            </div>
          </div>
          <button 
            type="button" 
            @click="closeModal" 
            class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          <!-- Current Provisional Lead Card -->
          <div class="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800">Current Lead on Order</span>
              <span class="text-[9px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                Not in Busy
              </span>
            </div>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {{ getInitials(order?.customer?.name || 'Lead') }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-extrabold text-gray-900 truncate">{{ order?.customer?.name }}</p>
                <p class="text-xs text-gray-600 truncate mt-0.5">
                  {{ [order?.customer?.company, order?.customer?.city, order?.customer?.phone].filter(Boolean).join(' • ') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Advisory Notice -->
          <div class="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
            <Info class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p class="text-[11px] leading-relaxed">
              To generate an invoice and post to Busy, select the official Customer Ledger from Busy below. Downstream reporting will cleanly tie to this account.
            </p>
          </div>

          <!-- Customer Picker Dropdown -->
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Select Verified Busy Customer *
            </label>
            <CustomSelect
              v-model="selectedCustomerId"
              :options="busyCustomerOptions"
              searchable
              searchPlaceholder="Search customer code, name, city, GSTIN..."
              placeholder="Search & choose Busy customer..."
              class="w-full bg-white"
            />
          </div>

          <!-- Selected Customer Preview -->
          <div v-if="chosenCustomer" class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-150">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <CheckCircle2 class="w-3 h-3 text-emerald-600" /> Target Ledger Selected
              </span>
              <span v-if="chosenCustomer.customerCode" class="text-[10px] font-mono font-bold bg-white text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                {{ chosenCustomer.customerCode }}
              </span>
            </div>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {{ getInitials(chosenCustomer.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-extrabold text-gray-900 truncate">{{ chosenCustomer.name }}</p>
                <p class="text-xs text-gray-600 truncate mt-0.5">
                  {{ [chosenCustomer.company, chosenCustomer.city, chosenCustomer.phone].filter(Boolean).join(' • ') }}
                </p>
                <p v-if="chosenCustomer.gstNumber" class="text-[11px] font-mono text-gray-500 mt-0.5">
                  GST: {{ chosenCustomer.gstNumber }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            @click="closeModal"
            :disabled="isSubmitting"
            class="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmLink"
            :disabled="isSubmitting || !selectedCustomerId"
            class="px-4 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
            <Link2 v-else class="w-3.5 h-3.5" />
            <span>{{ isSubmitting ? 'Linking...' : 'Link to Order' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Link2, Info, CheckCircle2, Loader2 } from 'lucide-vue-next'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const props = defineProps<{
  isOpen: boolean
  order: any
}>()

const emit = defineEmits(['close', 'linked'])

const { showSaved } = useSnackbar()
const { notifyChange } = useRealtimeSync()

const customersList = ref<any[]>([])
const isLoadingCustomers = ref(false)
const selectedCustomerId = ref('')
const isSubmitting = ref(false)

const loadCustomers = async () => {
  if (customersList.value.length) return
  isLoadingCustomers.value = true
  try {
    const data = await $fetch<any[]>('/api/customers')
    customersList.value = data || []
  } catch (err) {
    console.error('Failed to load customers for linking:', err)
  } finally {
    isLoadingCustomers.value = false
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    selectedCustomerId.value = ''
    loadCustomers()
  }
})

const busyCustomerOptions = computed(() => {
  return customersList.value
    .filter(c => c.id !== props.order?.customerId)
    .map(c => {
      const codeStr = c.customerCode ? `[${c.customerCode}] ` : ''
      const compStr = c.company && c.company !== c.name ? ` (${c.company})` : ''
      return {
        label: `${codeStr}${c.name}${compStr}`,
        value: c.id,
        subtitle: [c.city, c.phone, c.gstNumber ? `GST: ${c.gstNumber}` : null].filter(Boolean).join(' • ')
      }
    })
})

const chosenCustomer = computed(() => {
  if (!selectedCustomerId.value) return null
  return customersList.value.find(c => c.id === selectedCustomerId.value) || null
})

const getInitials = (name?: string) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const closeModal = () => {
  if (!isSubmitting.value) emit('close')
}

const confirmLink = async () => {
  if (!props.order?.id || !selectedCustomerId.value) return
  isSubmitting.value = true
  try {
    const res = await $fetch<{ success: boolean; order: any }>(`/api/orders/${props.order.id}/link-customer`, {
      method: 'POST',
      body: { customerId: selectedCustomerId.value }
    })
    showSaved(`Order linked to ${chosenCustomer.value?.name || 'Busy customer'}!`)
    notifyChange({ orderId: props.order.id, action: 'ORDER_UPDATED' })
    emit('linked', res.order)
    closeModal()
  } catch (err: any) {
    console.error('Failed to link customer:', err)
    alert(err?.data?.message || err?.message || 'Failed to link customer')
  } finally {
    isSubmitting.value = false
  }
}
</script>
