<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, Check, Shield, AlertTriangle, AlertCircle, 
  Receipt, Package, Truck, SlidersHorizontal, 
  CheckCheck, Loader2, ArrowRight
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { formatCurrency } from '~~/app/lib/utils'

const props = defineProps<{
  isOpen: boolean
  order: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', updatedOrder: any): void
}>()

const { showSaved } = useSnackbar()
const { notifyChange } = useRealtimeSync()

// Form state
const isSubmitting = ref(false)
const isApproved = ref(false)
const billingStatus = ref<string>('PENDING')
const invoiceNumber = ref('')
const billingHoldReason = ref('')

const packingStatus = ref<string>('PENDING')
const packingHoldReason = ref('')

const deliveryStatus = ref<string>('WAITING')
const deliveryHoldReason = ref('')
const driverName = ref('')

const autoCalculateOverall = ref(true)
const overallStatus = ref<string>('CONFIRMED')
const notes = ref('')

// Initialize or reset form values
const initForm = () => {
  if (!props.order) return
  isApproved.value = Boolean(props.order.isApproved)
  billingStatus.value = props.order.billingStatus?.status || 'PENDING'
  invoiceNumber.value = props.order.billingStatus?.invoiceNumber || ''
  billingHoldReason.value = props.order.billingStatus?.holdReason || ''

  packingStatus.value = props.order.packingStatus?.status || 'PENDING'
  packingHoldReason.value = props.order.packingStatus?.holdReason || ''

  deliveryStatus.value = props.order.deliveryStatus?.status || 'WAITING'
  deliveryHoldReason.value = props.order.deliveryStatus?.holdReason || ''
  driverName.value = props.order.deliveryStatus?.driverName || ''

  autoCalculateOverall.value = true
  overallStatus.value = props.order.overallStatus || 'CONFIRMED'
  notes.value = ''
}

watch(() => [props.isOpen, props.order], ([open]) => {
  if (open) {
    initForm()
  }
}, { immediate: true })

// Status options
const billingOptions = [
  { value: 'PENDING', label: 'Pending', desc: 'Awaiting Invoice', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'GENERATED', label: 'Generated', desc: 'Invoice Issued', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'ON_HOLD', label: 'On Hold', desc: 'Billing Blocked', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'ERROR', label: 'Error', desc: 'Flagged Issue', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' }
]

const packingOptions = [
  { value: 'PENDING', label: 'Pending', desc: 'Queued for Packing', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'IN_PROGRESS', label: 'In Progress', desc: 'Packing Underway', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'PACKED', label: 'Packed', desc: 'Fully Packed & Boxed', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'ON_HOLD', label: 'On Hold', desc: 'Inventory Shortage', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' }
]

const deliveryOptions = [
  { value: 'WAITING', label: 'Waiting (Reset)', desc: 'Ready for Trip Planning', badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'ASSIGNED', label: 'Assigned', desc: 'Driver Assigned to Trip', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'DISPATCHED', label: 'Dispatched', desc: 'In Transit / On Road', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'DELIVERED', label: 'Delivered', desc: 'Manual / Handover Done', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'ON_HOLD', label: 'On Hold', desc: 'Logistics Hold', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' }
]

const overallOptions = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'READY', label: 'Ready' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' }
]

// Projected auto overall status
const projectedOverallStatus = computed(() => {
  if (deliveryStatus.value === 'DELIVERED') return 'DELIVERED'
  if (deliveryStatus.value === 'DISPATCHED' || deliveryStatus.value === 'ASSIGNED') return 'DISPATCHED'
  if (billingStatus.value === 'GENERATED' && packingStatus.value === 'PACKED') return 'READY'
  if (billingStatus.value !== 'PENDING' || packingStatus.value !== 'PENDING') return 'PROCESSING'
  return 'CONFIRMED'
})

// Count pending changes
const changedCount = computed(() => {
  if (!props.order) return 0
  let count = 0
  if (isApproved.value !== Boolean(props.order.isApproved)) count++
  if (billingStatus.value !== (props.order.billingStatus?.status || 'PENDING')) count++
  if (invoiceNumber.value.trim() !== (props.order.billingStatus?.invoiceNumber || '')) count++
  if (packingStatus.value !== (props.order.packingStatus?.status || 'PENDING')) count++
  if (deliveryStatus.value !== (props.order.deliveryStatus?.status || 'WAITING')) count++
  if (driverName.value.trim() !== (props.order.deliveryStatus?.driverName || '')) count++
  if (!autoCalculateOverall.value && overallStatus.value !== props.order.overallStatus) count++
  if (notes.value.trim()) count++
  return count
})

const closeModal = () => {
  if (!isSubmitting.value) {
    emit('close')
  }
}

// Submit admin status updates
const submitStatusUpdate = async () => {
  if (!props.order || isSubmitting.value) return

  isSubmitting.value = true
  try {
    const payload = {
      isApproved: isApproved.value,
      billingStatus: billingStatus.value,
      invoiceNumber: billingStatus.value === 'GENERATED' ? invoiceNumber.value.trim() : undefined,
      billingHoldReason: billingStatus.value === 'ON_HOLD' ? billingHoldReason.value.trim() : undefined,
      packingStatus: packingStatus.value,
      packingHoldReason: packingStatus.value === 'ON_HOLD' ? packingHoldReason.value.trim() : undefined,
      deliveryStatus: deliveryStatus.value,
      deliveryHoldReason: deliveryStatus.value === 'ON_HOLD' ? deliveryHoldReason.value.trim() : undefined,
      driverName: ['DELIVERED', 'DISPATCHED', 'ASSIGNED'].includes(deliveryStatus.value) ? driverName.value.trim() : undefined,
      autoCalculateOverall: autoCalculateOverall.value,
      overallStatus: autoCalculateOverall.value ? projectedOverallStatus.value : overallStatus.value,
      notes: notes.value.trim() || undefined
    }

    const res = await $fetch<any>(`/api/orders/${props.order.id}/admin-status`, {
      method: 'PATCH',
      body: payload
    })

    showSaved('Order department statuses updated successfully!')
    notifyChange({ orderId: props.order.id, action: 'ORDER_UPDATED' })
    emit('updated', res.order)
    emit('close')
  } catch (err: any) {
    console.error('Failed to update status:', err)
    alert(err.data?.message || 'Failed to update department statuses.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
        @click="closeModal"
      ></div>

      <!-- Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[calc(100vh-4.5rem)] md:max-h-[92vh] overflow-hidden border border-gray-200">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#faf8f5] shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Shield class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  Edit Department Statuses
                </h2>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-purple-600 text-white tracking-wider uppercase">
                  Status Override
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span class="font-mono font-bold text-gray-900">{{ order?.orderNumber }}</span>
                <span>&bull;</span>
                <span>{{ order?.customer?.company || order?.customer?.name }}</span>
                <span>&bull;</span>
                <span class="font-bold text-[#1b3b5f]">{{ formatCurrency(order?.totalAmount || 0) }}</span>
              </p>
            </div>
          </div>

          <button 
            @click="closeModal" 
            :disabled="isSubmitting"
            class="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Banner Note -->
        <div class="bg-purple-50/70 border-b border-purple-100 px-6 py-2.5 flex items-center gap-2.5 text-xs text-purple-900 shrink-0">
          <AlertTriangle class="w-4 h-4 text-purple-600 shrink-0" />
          <p>
            Direct override applies immediate status changes across departments and permanently records an audit entry in the order timeline.
          </p>
        </div>

        <!-- Scrollable Body -->
        <div class="p-6 overflow-y-auto space-y-6">
          
          <!-- 1. Approval Desk -->
          <div class="bg-gray-50/70 rounded-xl p-4 border border-gray-200/80 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-teal-50 text-[#1b3b5f] border border-teal-100">
                  <CheckCheck class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">1. Approval Desk</h3>
                  <p class="text-[11px] text-gray-500">Order approval required before packing & fulfillment</p>
                </div>
              </div>

              <span 
                class="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                :class="isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
              >
                {{ isApproved ? '✓ Approved' : '⏳ Pending Review' }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                @click="isApproved = true"
                class="px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer"
                :class="isApproved ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
              >
                <Check class="w-4 h-4" />
                <span>Mark Approved</span>
              </button>
              <button
                type="button"
                @click="isApproved = false"
                class="px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer"
                :class="!isApproved ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'"
              >
                <AlertCircle class="w-4 h-4" />
                <span>Keep / Set Pending</span>
              </button>
            </div>
          </div>

          <!-- 2. Billing Department -->
          <div class="bg-gray-50/70 rounded-xl p-4 border border-gray-200/80 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <Receipt class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">2. Billing & Invoicing</h3>
                  <p class="text-[11px] text-gray-500">Controls GST invoice generation and billing gate</p>
                </div>
              </div>

              <span class="text-xs font-mono font-bold text-gray-500">
                Current: {{ order?.billingStatus?.status || 'PENDING' }}
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                v-for="opt in billingOptions"
                :key="opt.value"
                type="button"
                @click="billingStatus = opt.value"
                class="px-3 py-2 rounded-lg text-left border transition cursor-pointer"
                :class="billingStatus === opt.value ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'"
              >
                <div class="font-bold text-xs">{{ opt.label }}</div>
                <div class="text-[10px] opacity-80 mt-0.5">{{ opt.desc }}</div>
              </button>
            </div>

            <!-- Optional Invoice Number if Generated -->
            <div v-if="billingStatus === 'GENERATED'" class="pt-2 border-t border-gray-200/60">
              <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Invoice Number (Optional)
              </label>
              <input 
                type="text" 
                v-model="invoiceNumber" 
                placeholder="e.g. INV-2026-1045" 
                class="w-full text-xs font-mono border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
              />
            </div>

            <!-- Optional Hold Reason if On Hold -->
            <div v-if="billingStatus === 'ON_HOLD'" class="pt-2 border-t border-gray-200/60">
              <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Billing Hold Reason
              </label>
              <input 
                type="text" 
                v-model="billingHoldReason" 
                placeholder="e.g. Rate clarification requested by client" 
                class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
              />
            </div>
          </div>

          <!-- 3. Packing Desk -->
          <div class="bg-gray-50/70 rounded-xl p-4 border border-gray-200/80 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                  <Package class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">3. Packing & Fulfillment</h3>
                  <p class="text-[11px] text-gray-500">Warehouse physical staging, bundle verification & boxing</p>
                </div>
              </div>

              <span class="text-xs font-mono font-bold text-gray-500">
                Current: {{ order?.packingStatus?.status || 'PENDING' }}
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                v-for="opt in packingOptions"
                :key="opt.value"
                type="button"
                @click="packingStatus = opt.value"
                class="px-3 py-2 rounded-lg text-left border transition cursor-pointer"
                :class="packingStatus === opt.value ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'"
              >
                <div class="font-bold text-xs">{{ opt.label }}</div>
                <div class="text-[10px] opacity-80 mt-0.5">{{ opt.desc }}</div>
              </button>
            </div>

            <!-- Optional Hold Reason if On Hold -->
            <div v-if="packingStatus === 'ON_HOLD'" class="pt-2 border-t border-gray-200/60">
              <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Packing Hold Reason
              </label>
              <input 
                type="text" 
                v-model="packingHoldReason" 
                placeholder="e.g. Awaiting 18mm MDF arrival from central warehouse" 
                class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
              />
            </div>
          </div>

          <!-- 4. Delivery & Logistics -->
          <div class="bg-gray-50/70 rounded-xl p-4 border border-gray-200/80 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Truck class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">4. Delivery & Logistics</h3>
                  <p class="text-[11px] text-gray-500">Dispatch staging, driver transit, and final delivery/handover</p>
                </div>
              </div>

              <span class="text-xs font-mono font-bold text-gray-500">
                Current: {{ order?.deliveryStatus?.status || 'WAITING' }}
              </span>
            </div>

            <!-- Informative Note -->
            <div class="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-lg text-xs text-blue-900 flex items-start gap-2">
              <span class="font-bold text-blue-700 shrink-0">Tip:</span>
              <span>To dispatch via Our Fleet with driver GPS tracking, use the Trip Planner on the Delivery page. Setting status here is for manual/offline record corrections.</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
              <button
                v-for="opt in deliveryOptions"
                :key="opt.value"
                type="button"
                @click="deliveryStatus = opt.value"
                class="px-3 py-2 rounded-lg text-left border transition cursor-pointer"
                :class="deliveryStatus === opt.value ? 'bg-[#1b3b5f] text-white border-[#1b3b5f] shadow-xs' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'"
              >
                <div class="font-bold text-xs">{{ opt.label }}</div>
                <div class="text-[10px] opacity-80 mt-0.5 truncate">{{ opt.desc }}</div>
              </button>
            </div>

            <!-- Receiver / Driver / Vehicle details -->
            <div v-if="['DELIVERED', 'DISPATCHED', 'ASSIGNED'].includes(deliveryStatus)" class="pt-2 border-t border-gray-200/60">
              <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                {{ deliveryStatus === 'DELIVERED' ? 'Handover / Receiver / Vehicle Details (Optional)' : 'Assigned Driver / Vehicle Details (Optional)' }}
              </label>
              <input 
                type="text" 
                v-model="driverName" 
                :placeholder="deliveryStatus === 'DELIVERED' ? 'e.g. Handed over to Mr. Rajesh (Customer Tempo KA-09-EA-1234)' : 'e.g. Driver Ramesh (KA-09-A-1234)'" 
                class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
              />
            </div>

            <!-- Optional Hold Reason if On Hold -->
            <div v-if="deliveryStatus === 'ON_HOLD'" class="pt-2 border-t border-gray-200/60">
              <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Delivery Hold Reason
              </label>
              <input 
                type="text" 
                v-model="deliveryHoldReason" 
                placeholder="e.g. Site gate closed / Customer requested tomorrow morning" 
                class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
              />
            </div>
          </div>

          <!-- 5. Overall Workflow Status -->
          <div class="bg-purple-50/40 rounded-xl p-4 border border-purple-200/70 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
                  <SlidersHorizontal class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-xs font-bold text-purple-950 uppercase tracking-wider">5. Overall Pipeline Status</h3>
                  <p class="text-[11px] text-purple-700">Master lifecycle status shown across dashboard and tracking</p>
                </div>
              </div>

              <span class="text-xs font-bold text-purple-900 bg-purple-100/70 px-2.5 py-0.5 rounded-full border border-purple-200">
                {{ autoCalculateOverall ? `Auto: ${projectedOverallStatus}` : `Manual: ${overallStatus}` }}
              </span>
            </div>

            <div class="pt-1">
              <label class="flex items-center gap-2.5 text-xs font-semibold text-gray-800 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  v-model="autoCalculateOverall" 
                  class="rounded text-[#1b3b5f] focus:ring-[#1b3b5f] w-4 h-4" 
                />
                <span>Auto-calculate overall status from departments (Recommended)</span>
              </label>
            </div>

            <!-- Manual Selection when unchecked -->
            <div v-if="!autoCalculateOverall" class="pt-2 border-t border-purple-200/50">
              <p class="text-[11px] text-gray-500 mb-2">Manually select master status:</p>
              <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <button
                  v-for="opt in overallOptions"
                  :key="opt.value"
                  type="button"
                  @click="overallStatus = opt.value"
                  class="px-2.5 py-2 rounded-lg text-center border font-bold text-xs transition cursor-pointer"
                  :class="overallStatus === opt.value ? 'bg-purple-700 text-white border-purple-700 shadow-xs' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- 7. Reason / Notes -->
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Override Reason / Internal Notes (Optional)
            </label>
            <textarea 
              rows="2" 
              v-model="notes" 
              placeholder="e.g. Manually marked packed and ready per telephone confirmation from warehouse foreman..."
              class="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f] resize-none"
            ></textarea>
            <p class="text-[10px] text-gray-400 mt-1">
              This note will be logged in the permanent order timeline alongside the admin user ID.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <span class="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" :class="changedCount > 0 ? 'bg-purple-600 animate-pulse' : 'bg-gray-300'"></span>
              <span>{{ changedCount > 0 ? `${changedCount} change(s) configured` : 'No changes pending' }}</span>
            </span>
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              @click="closeModal" 
              :disabled="isSubmitting"
              class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button" 
              @click="submitStatusUpdate"
              :disabled="isSubmitting || changedCount === 0"
              class="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
              <Shield v-else class="w-3.5 h-3.5" />
              <span>Apply Department Statuses</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
