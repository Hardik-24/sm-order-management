<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-xs" @click="closeModal"></div>
      
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100vh-4.5rem)] md:max-h-[92vh] overflow-hidden border border-[#e5e2dc]">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-amber-50/70 shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="p-2 sm:p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <Car class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="min-w-0">
              <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 truncate">
                Hand Over to Party Vehicle
              </h2>
              <p class="text-xs text-amber-900/80 font-medium mt-0.5 truncate">
                {{ order?.orderNumber }} • {{ order?.customer?.name }}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            @click="closeModal" 
            class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          <!-- Order Highlights Banner -->
          <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Customer / Firm</span>
              <span class="font-bold text-gray-900">{{ order?.customer?.name }}</span>
            </div>
            <div v-if="order?.customer?.company" class="flex items-center justify-between">
              <span class="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Company</span>
              <span class="font-medium text-gray-800">{{ order?.customer?.company }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Total Items / Quantity</span>
              <span class="font-bold text-gray-900">
                {{ order?.items?.length || 0 }} products ({{ totalUnits }} units)
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Order Value</span>
              <span class="font-bold text-emerald-800">{{ formatCurrency(order?.totalAmount || 0) }}</span>
            </div>
            <div v-if="order?.deliveryAddress" class="pt-2 border-t border-gray-200 text-gray-600 leading-snug">
              <span class="text-[10px] uppercase font-bold text-gray-400 block tracking-wider mb-0.5">Destination / Note</span>
              <span class="text-gray-700">{{ order.deliveryAddress }}</span>
            </div>
          </div>

          <!-- Notice -->
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <PackageCheck class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div class="leading-relaxed">
              Confirming this handover will mark the order's delivery status as <strong>DELIVERED</strong> directly, recording the party vehicle pickup in the order timeline.
            </div>
          </div>

          <!-- Handover Details Form -->
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Vehicle & Collection Details (Optional)
            </h4>

            <!-- Vehicle Number -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5">
                Party Vehicle / Registration Number
              </label>
              <input
                v-model="form.vehicleNumber"
                type="text"
                placeholder="e.g. KA-09-EA-5678, Auto, Commercial Pickup..."
                class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Driver / Collector Name -->
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1.5">
                  Driver / Receiver Name
                </label>
                <input
                  v-model="form.driverName"
                  type="text"
                  placeholder="e.g. Ramesh (Driver), Client"
                  class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>

              <!-- Contact Phone -->
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1.5">
                  Driver Phone Number
                </label>
                <input
                  v-model="form.driverPhone"
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
              </div>
            </div>

            <!-- Handover Note -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5">
                Handover Notes / Gate Pass
              </label>
              <textarea
                v-model="form.notes"
                rows="2"
                placeholder="e.g. Signed physical delivery challan, goods verified by driver..."
                class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 resize-none"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            @click="closeModal"
            class="w-full sm:w-auto text-center px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg text-xs hover:bg-gray-100 transition cursor-pointer"
            :disabled="isSubmitting"
          >
            Cancel
          </button>

          <button
            type="button"
            @click="confirmHandover"
            :disabled="isSubmitting"
            class="w-full sm:w-auto justify-center px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <PackageCheck v-else class="w-4 h-4" />
            <span>{{ isSubmitting ? 'Recording Handover...' : 'Confirm Hand Over' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Car, X, PackageCheck, Loader2 } from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const props = defineProps<{
  isOpen: boolean
  order: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'handedOver'): void
}>()

const { showSaving, showSaved } = useSnackbar()
const { notifyChange } = useRealtimeSync()

const isSubmitting = ref(false)
const form = ref({
  vehicleNumber: '',
  driverName: '',
  driverPhone: '',
  notes: ''
})

watch(() => props.isOpen, (open) => {
  if (open) {
    form.value = {
      vehicleNumber: '',
      driverName: '',
      driverPhone: '',
      notes: ''
    }
  }
})

const totalUnits = computed(() => {
  if (!props.order?.items?.length) return 0
  return props.order.items.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0)
})

const closeModal = () => {
  if (isSubmitting.value) return
  emit('close')
}

const confirmHandover = async () => {
  if (!props.order?.id) return

  isSubmitting.value = true
  showSaving()

  try {
    const details = [
      form.value.vehicleNumber ? `Vehicle: ${form.value.vehicleNumber.trim()}` : '',
      form.value.driverName ? `Collector: ${form.value.driverName.trim()}` : '',
      form.value.driverPhone ? `Ph: ${form.value.driverPhone.trim()}` : ''
    ].filter(Boolean).join(' • ')

    const driverName = details ? `Party Vehicle (${details})` : 'Party Vehicle'

    await $fetch(`/api/orders/${props.order.id}/delivery`, {
      method: 'PATCH',
      body: {
        status: 'DELIVERED',
        driverName,
        deliveredAt: new Date().toISOString(),
        notes: form.value.notes?.trim() || undefined
      }
    })

    notifyChange({ orderId: props.order.id, action: 'ORDER_UPDATED' })
    showSaved('Order marked as handed over to party vehicle')
    emit('handedOver')
    emit('close')
  } catch (err: any) {
    console.error('Failed to hand over order', err)
    alert(err.data?.message || 'Failed to record handover')
  } finally {
    isSubmitting.value = false
  }
}
</script>
