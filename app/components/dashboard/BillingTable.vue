<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { 
  Search, X, FileText, CheckCircle2, AlertCircle, ChevronRight, 
  Ban, Zap, IndianRupee, Clock, CheckCheck 
} from 'lucide-vue-next'
import { formatCurrency, formatDateTime, formatDate, formatTime } from '~~/app/lib/utils'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'
import TableFilterButtons from '~/components/dashboard/TableFilterButtons.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import type { Order } from '~/types'

const props = defineProps<{
  orders: Order[]
  isLoading?: boolean
  total: number
  page: number
  limit: number
  search?: string
  startDate?: string
  endDate?: string
  status?: string
  billingStatus?: string
  packingStatus?: string
  deliveryStatus?: string
}>()

const emit = defineEmits<{
  (e: 'update:page', val: number): void
  (e: 'update:limit', val: number): void
  (e: 'update:search', val: string): void
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'update:packingStatus', val: string): void
  (e: 'update:deliveryStatus', val: string): void
  (e: 'select', id: string): void
  (e: 'generate-invoice', id: string): void
}>()

const { animateStagger } = useGsapAnimation()
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)
const tableScrollRef = ref<HTMLElement | null>(null)
const tableRootRef = ref<HTMLElement | null>(null)

const triggerRowAnimation = () => {
  nextTick(() => {
    if (!props.isLoading) {
      if (tbodyRef.value) {
        const rows = tbodyRef.value.querySelectorAll('tr')
        const targetRows = Array.from(rows).slice(0, 15)
        animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
      }
      if (mobileListRef.value) {
        const targetCards = Array.from(mobileListRef.value.children).slice(0, 15)
        animateStagger(targetCards, { duration: 0.18, stagger: 0.015, y: 4 })
      }
    }
  })
}

watch([() => props.orders, () => props.isLoading], () => {
  triggerRowAnimation()
}, { immediate: false })

watch(() => props.page, () => {
  nextTick(() => {
    tableRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

onMounted(() => {
  triggerRowAnimation()
})

const getPrivilegeColor = (tier: string) => {
  switch (tier) {
    case 'GOLD': return 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/40'
    case 'SILVER': return 'bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-300/40'
    default: return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}

const getItemsCountText = (order: any) => {
  const count = order.items?.length || 0
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

const getTotalNos = (order: any) => {
  if (!order.items || !order.items.length) return '0 nos.'
  const totalUnits = order.items.reduce((sum: number, itm: any) => sum + (Number(itm.quantity) || 0), 0)
  return `${totalUnits} nos.`
}
</script>

<template>
  <div ref="tableRootRef" class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative">
    
    <!-- Toolbar (Search & Filter Bar) -->
    <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3.5 bg-gray-50/50">
      <!-- Search Input -->
      <div class="relative w-full sm:w-80">
        <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
        <input 
          :value="search"
          @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Search order #, customer, invoice..." 
          class="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all"
        />
        <button 
          v-if="search" 
          @click="emit('update:search', '')"
          class="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Filter Controls -->
      <div class="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
        <TableFilterButtons
          :startDate="startDate"
          :endDate="endDate"
          :status="status"
          :billingStatus="billingStatus"
          :packingStatus="packingStatus"
          :deliveryStatus="deliveryStatus"
          @update:startDate="val => emit('update:startDate', val)"
          @update:endDate="val => emit('update:endDate', val)"
          @update:status="val => emit('update:status', val)"
          @update:billingStatus="val => emit('update:billingStatus', val)"
          @update:packingStatus="val => emit('update:packingStatus', val)"
          @update:deliveryStatus="val => emit('update:deliveryStatus', val)"
        />
        <RowsPerPageSelect 
          :modelValue="limit" 
          :options="[10, 20, 50, -1]"
          @update:modelValue="val => { emit('update:limit', val); emit('update:page', 1) }"
        />
      </div>
    </div>

    <!-- Table Area with Pulsing Blur and Skeleton Support -->
    <div class="relative min-h-[220px]">
      <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 animate-pulse pointer-events-none"></div>

      <!-- DESKTOP / TABLET VIEW: Multi-Column Table -->
      <div ref="tableScrollRef" class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th class="px-5 py-3.5 whitespace-nowrap">Order</th>
              <th class="px-5 py-3.5">Customer & Tier</th>
              <th class="px-5 py-3.5">Items</th>
              <th class="px-5 py-3.5 whitespace-nowrap">Amount</th>
              <th class="px-5 py-3.5 whitespace-nowrap">Billing Status</th>
              <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-100 bg-white relative">
            
            <!-- Skeleton Rows -->
            <template v-if="isLoading && (!orders || orders.length === 0)">
              <tr v-for="i in 6" :key="'skel-' + i" class="animate-pulse hover:bg-transparent">
                <td class="px-5 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-24 mb-1.5"></div>
                  <div class="h-3 bg-gray-100 rounded w-16"></div>
                </td>
                <td class="px-5 py-4">
                  <div class="h-4 bg-gray-200 rounded w-36 mb-1.5"></div>
                  <div class="h-3 bg-gray-100 rounded w-24"></div>
                </td>
                <td class="px-5 py-4">
                  <div class="h-4 bg-gray-200 rounded w-40 mb-1.5"></div>
                  <div class="h-3 bg-gray-100 rounded w-16"></div>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <div class="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <div class="h-6 bg-gray-200 rounded-full w-28"></div>
                </td>
                <td class="px-5 py-4 text-right whitespace-nowrap pr-5">
                  <div class="h-8 bg-gray-200 rounded-lg w-28 ml-auto"></div>
                </td>
              </tr>
            </template>

            <!-- Empty State -->
            <tr v-else-if="!isLoading && (!orders || orders.length === 0)" class="text-center py-8">
              <td colspan="6" class="py-14 text-center text-gray-400">
                <FileText class="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p class="text-sm font-semibold text-gray-700">No invoices found</p>
                <p class="text-xs text-gray-400 mt-0.5">No orders matching your criteria were found.</p>
              </td>
            </tr>

            <!-- Data Rows (Matching Approve Orders row typography and classes) -->
            <tr 
              v-else 
              v-for="order in orders" 
              :key="order.id"
              @click="emit('select', order.id)"
              class="cursor-pointer transition-colors duration-150 group"
              :class="order.overallStatus === 'CANCELLED' 
                ? 'bg-gray-100/60 hover:bg-gray-100/80 text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
                : (order.isUrgent ? 'bg-rose-50/25 hover:bg-rose-50/40 border-l-4 border-l-rose-500' : 'hover:bg-gray-50/80')"
            >
              <!-- 1. Order ID -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-gray-900 group-hover:text-[#1a5c4c] transition-colors">
                    {{ order.orderNumber }}
                  </span>
                  <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 !text-gray-600 border border-rose-500">
                    🚫 CANCELLED
                  </span>
                  <span v-else-if="order.isUrgent" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                    ⚡ URGENT
                  </span>
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                  {{ formatDateTime(order.createdAt) }}
                </p>
              </td>

              <!-- 2. Customer & Tier -->
              <td class="px-5 py-3.5 min-w-0">
                <div class="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5" :title="order.customer?.name || 'Walk-in Customer'">
                  <span class="truncate">{{ order.customer?.name || 'Walk-in Customer' }}</span>
                  <span 
                    v-if="order.customer?.privilegeTier" 
                    class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border shadow-2xs"
                    :class="getPrivilegeColor(order.customer.privilegeTier)"
                  >
                    {{ order.customer.privilegeTier }}
                  </span>
                  <span v-if="order.customer?.isPriorityClient" class="text-amber-500 font-bold text-xs shrink-0" title="Priority Client">★</span>
                </div>
                <p class="text-[11px] text-gray-500 truncate mt-0.5" :title="[order.customer?.company, order.customer?.city || order.customer?.phone].filter(Boolean).join(' • ') || '—'">
                  {{ [order.customer?.company, order.customer?.city || order.customer?.phone].filter(Boolean).join(' • ') || '—' }}
                </p>
              </td>

              <!-- 3. Items -->
              <td class="px-5 py-3.5 whitespace-nowrap" :title="order.items?.map((i: any) => i.sku || i.product?.sku || i.productName || i.product?.name).filter(Boolean).join(', ') || '—'">
                <div class="text-xs font-bold text-gray-800">
                  {{ getItemsCountText(order) }}
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5">
                  {{ getTotalNos(order) }}
                </p>
              </td>

              <!-- 4. Amount -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <span class="text-xs font-bold text-gray-900 tabular-nums">
                  {{ formatCurrency(order.totalAmount || 0) }}
                </span>
              </td>

              <!-- 5. Billing Status -->
              <td class="px-5 py-3.5 whitespace-nowrap">
                <div v-if="order.billingStatus?.status === 'GENERATED'" class="inline-flex flex-col items-start gap-0.5">
                  <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                    <span>Generated</span>
                  </div>
                  <span v-if="order.billingStatus?.invoiceNumber" class="text-[11px] text-gray-500 font-semibold pl-1">
                    #{{ order.billingStatus.invoiceNumber }}
                  </span>
                </div>

                <div v-else-if="order.billingStatus?.status === 'ON_HOLD'" class="inline-flex flex-col items-start gap-0.5">
                  <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                    <AlertCircle class="w-3.5 h-3.5 text-orange-600" />
                    <span>On Hold</span>
                  </div>
                  <span v-if="(order.billingStatus as any)?.holdReason" class="text-[11px] text-orange-600 truncate max-w-[140px] pl-1" :title="(order.billingStatus as any)?.holdReason">
                    {{ (order.billingStatus as any)?.holdReason }}
                  </span>
                </div>

                <div v-else class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock class="w-3.5 h-3.5 text-amber-600" />
                  <span>Awaiting Billing</span>
                </div>
              </td>

              <!-- 7. Action Button -->
              <td class="px-5 py-3.5 text-right whitespace-nowrap pr-5">
                <div class="flex items-center justify-end gap-2">
                  <button 
                    v-if="order.billingStatus?.status === 'PENDING' && order.overallStatus !== 'CANCELLED'"
                    @click.stop="emit('generate-invoice', order.id)"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a5c4c] text-white hover:bg-[#14473b] shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <IndianRupee class="w-3.5 h-3.5" />
                    <span>Generate Bill</span>
                  </button>
                  <button 
                    v-else
                    @click.stop="emit('select', order.id)"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <span>View Bill</span>
                    <ChevronRight class="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="tableScrollRef" />

      <!-- MOBILE VIEW: 2-Line High-Density Non-Scrollable Cards -->
      <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
        <!-- Skeleton Mobile Cards -->
        <template v-if="isLoading && (!orders || orders.length === 0)">
          <div v-for="i in 5" :key="'mob-skel-' + i" class="p-3.5 animate-pulse space-y-2">
            <div class="flex justify-between">
              <div class="h-4 bg-gray-200 rounded w-24"></div>
              <div class="h-4 bg-gray-200 rounded w-20"></div>
            </div>
            <div class="flex justify-between">
              <div class="h-3 bg-gray-100 rounded w-32"></div>
              <div class="h-6 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </template>

        <!-- Mobile Data Cards (Matching Approve Orders typography) -->
        <div 
          v-else 
          v-for="order in orders" 
          :key="'mob-bill-' + order.id"
          @click="emit('select', order.id)"
          class="px-3.5 py-3 cursor-pointer transition-colors flex flex-col gap-1.5"
          :class="order.overallStatus === 'CANCELLED' 
            ? 'bg-gray-100/60 active:bg-gray-100/80 text-gray-400 opacity-60 border-l-4 border-l-gray-400' 
            : (order.isUrgent ? 'bg-rose-50/25 active:bg-rose-50/40 border-l-4 border-l-rose-500' : 'hover:bg-gray-50 active:bg-gray-100')"
        >
          <!-- LINE 1: Identity & Billing Status -->
          <div class="flex items-center justify-between gap-2 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-xs font-bold text-gray-900 shrink-0">
                {{ order.orderNumber }}
              </span>
              <span v-if="order.overallStatus === 'CANCELLED'" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 text-gray-600 border border-rose-500">
                🚫 CANCELLED
              </span>
              <span v-else-if="order.isUrgent" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                ⚡ URGENT
              </span>
              <span class="text-gray-300 text-xs shrink-0">&bull;</span>
              <span class="text-xs font-semibold text-gray-700 truncate" :title="order.customer?.company || order.customer?.name || ''">
                {{ order.customer?.name || order.customer?.company || 'Walk-in' }}
              </span>
            </div>
            
            <!-- Billing Status Badge -->
            <span 
              class="inline-flex items-center justify-center rounded-full font-semibold px-2 py-0.5 text-[10px] shrink-0"
              :class="[
                order.billingStatus?.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                order.billingStatus?.status === 'ON_HOLD' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              ]"
            >
              {{ order.billingStatus?.status === 'GENERATED' ? 'Generated' : order.billingStatus?.status === 'ON_HOLD' ? 'On Hold' : 'Awaiting' }}
            </span>
          </div>

          <!-- LINE 2: Amount, Items, Time & Quick Action -->
          <div class="flex items-center justify-between gap-2 min-w-0 pt-0.5">
            <div class="flex items-baseline gap-1.5 shrink-0">
              <span class="text-xs font-bold text-gray-900 tabular-nums">
                {{ formatCurrency(order.totalAmount || 0) }}
              </span>
              <span class="text-[11px] text-gray-400 font-normal">
                ({{ getTotalNos(order) }})
              </span>
              <span class="text-gray-300 text-[10px]">&bull;</span>
              <span class="text-[11px] text-gray-400 tabular-nums">
                {{ formatDateTime(order.createdAt) }}
              </span>
            </div>

            <!-- Direct 1-Tap Action Button -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                v-if="order.billingStatus?.status === 'PENDING' && order.overallStatus !== 'CANCELLED'"
                @click.stop="emit('generate-invoice', order.id)"
                class="px-2.5 py-1 bg-[#1a5c4c] text-white text-[11px] font-semibold rounded-md hover:bg-[#154a3d] active:scale-95 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <IndianRupee class="w-3 h-3" />
                <span>Generate</span>
              </button>
              <button 
                v-else
                @click.stop="emit('select', order.id)"
                class="px-2.5 py-1 border border-gray-200 bg-white text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>View</span>
                <ChevronRight class="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="!isLoading && (!orders || orders.length === 0)" class="px-4 py-8 text-center text-sm text-gray-500">
          <FileText class="w-8 h-8 text-gray-300 mx-auto mb-2" />
          No invoices found.
        </div>
      </div>
    </div>

    <!-- Pagination Footer -->
    <div class="p-4 border-t border-gray-200 bg-white rounded-b-xl flex items-center justify-between gap-4">
      <p class="text-xs text-gray-500 whitespace-nowrap">
        Showing <span class="font-medium text-gray-900">{{ orders.length ? (limit === -1 ? 1 : (page - 1) * limit + 1) : 0 }}</span>
        to <span class="font-medium text-gray-900">{{ limit === -1 ? total : Math.min(page * limit, total) }}</span>
        of <span class="font-medium text-gray-900">{{ total }}</span> orders
      </p>

      <div class="flex items-center justify-center gap-2">
        <button
          :disabled="page <= 1"
          @click="emit('update:page', page - 1)"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Previous
        </button>
        <span class="text-xs font-medium text-gray-700 px-1">{{ page }} / {{ limit === -1 ? 1 : (Math.ceil(total / limit) || 1) }}</span>
        <button
          :disabled="limit === -1 || page >= Math.ceil(total / limit)"
          @click="emit('update:page', page + 1)"
          class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
