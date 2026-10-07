<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Calendar, Filter, X } from 'lucide-vue-next'
import CustomSelect from '~/components/ui/CustomSelect.vue'

const props = withDefaults(defineProps<{
  startDate?: string
  endDate?: string
  status?: string
  billingStatus?: string
  packingStatus?: string
  deliveryStatus?: string
  paymentStatus?: string
}>(), {
  startDate: '',
  endDate: '',
  status: '',
  billingStatus: '',
  packingStatus: '',
  deliveryStatus: '',
  paymentStatus: ''
})

const emit = defineEmits<{
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'update:packingStatus', val: string): void
  (e: 'update:deliveryStatus', val: string): void
  (e: 'update:paymentStatus', val: string): void
}>()

const isDatePickerOpen = ref(false)
const isFiltersOpen = ref(false)

const dateContainerRef = ref<HTMLElement | null>(null)
const filtersContainerRef = ref<HTMLElement | null>(null)
const dateButtonRef = ref<HTMLElement | null>(null)
const filtersButtonRef = ref<HTMLElement | null>(null)

// Smart screen-safe placement state
const dateOpenUpward = ref(false)
const dateAlignLeft = ref(false)
const dateMaxHeight = ref(500)

const filtersOpenUpward = ref(false)
const filtersAlignLeft = ref(false)
const filtersMaxHeight = ref(560)

const updateDatePlacement = () => {
  if (typeof window === 'undefined' || !dateButtonRef.value) return
  const rect = dateButtonRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  
  // Open upward if space below is too tight (< 380px) and space above is larger
  dateOpenUpward.value = spaceBelow < 380 && spaceAbove > spaceBelow
  
  // Check horizontal alignment to avoid overflowing left edge on desktop
  dateAlignLeft.value = rect.right < 300
  
  // Constrain max height so popover never goes outside viewport
  const available = dateOpenUpward.value ? spaceAbove - 24 : spaceBelow - 24
  dateMaxHeight.value = Math.max(260, Math.min(available, 520))
}

const updateFiltersPlacement = () => {
  if (typeof window === 'undefined' || !filtersButtonRef.value) return
  const rect = filtersButtonRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  
  // Open upward if space below is too tight (< 440px) and space above is larger
  filtersOpenUpward.value = spaceBelow < 440 && spaceAbove > spaceBelow
  
  // Check horizontal alignment
  filtersAlignLeft.value = rect.right < 330
  
  // Constrain max height so popover never goes outside viewport
  const available = filtersOpenUpward.value ? spaceAbove - 24 : spaceBelow - 24
  filtersMaxHeight.value = Math.max(280, Math.min(available, 580))
}

const toggleDatePicker = () => {
  if (isDatePickerOpen.value) {
    isDatePickerOpen.value = false
  } else {
    updateDatePlacement()
    isDatePickerOpen.value = true
    isFiltersOpen.value = false
  }
}

const toggleFilters = () => {
  if (isFiltersOpen.value) {
    isFiltersOpen.value = false
  } else {
    updateFiltersPlacement()
    isFiltersOpen.value = true
    isDatePickerOpen.value = false
  }
}

const closeAll = () => {
  isDatePickerOpen.value = false
  isFiltersOpen.value = false
}

onClickOutside(dateContainerRef, () => {
  isDatePickerOpen.value = false
})

onClickOutside(filtersContainerRef, () => {
  isFiltersOpen.value = false
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.status) count++
  if (props.billingStatus) count++
  if (props.packingStatus) count++
  if (props.deliveryStatus) count++
  if (props.paymentStatus) count++
  return count
})

const clearFilters = () => {
  emit('update:status', '')
  emit('update:billingStatus', '')
  emit('update:packingStatus', '')
  emit('update:deliveryStatus', '')
  emit('update:paymentStatus', '')
  isFiltersOpen.value = false
}

const clearDates = () => {
  emit('update:startDate', '')
  emit('update:endDate', '')
  isDatePickerOpen.value = false
}

const dateButtonText = computed(() => {
  if (props.startDate && props.endDate) {
    const start = new Date(props.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const end = new Date(props.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${start} - ${end}`
  } else if (props.startDate) {
    const start = new Date(props.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${start} onwards`
  } else if (props.endDate) {
    const end = new Date(props.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `Until ${end}`
  }
  return 'Date Range'
})

const overallStatusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Awaiting Billing & Packing', value: 'CONFIRMED' },
  { label: 'Awaiting / Action Required', value: 'PROCESSING' },
  { label: 'Ready for Dispatch', value: 'READY' },
  { label: 'In Transit', value: 'DISPATCHED' },
  { label: 'Delivered', value: 'DELIVERED' }
]

const billingStatusOptions = [
  { label: 'All Billing States', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Generated', value: 'GENERATED' },
  { label: 'On Hold', value: 'ON_HOLD' }
]

const packingStatusOptions = [
  { label: 'All Packing States', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Packed', value: 'PACKED' },
  { label: 'On Hold', value: 'ON_HOLD' }
]

const deliveryStatusOptions = [
  { label: 'All Delivery States', value: '' },
  { label: 'Waiting', value: 'WAITING' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Dispatched', value: 'DISPATCHED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'On Hold', value: 'ON_HOLD' }
]

const paymentStatusOptions = [
  { label: 'All Payment States', value: '' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partially Paid', value: 'PARTIAL' },
  { label: 'Fully Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' }
]
</script>

<template>
  <div class="flex items-center justify-end gap-2 w-full sm:w-auto ml-auto">
    <!-- Backdrop for mobile viewport safety -->
    <Transition name="fade">
      <div 
        v-if="isDatePickerOpen || isFiltersOpen" 
        class="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[90] sm:hidden" 
        @click="closeAll"
      />
    </Transition>

    <!-- Date Range Filter -->
    <div class="relative" ref="dateContainerRef">
      <button 
        ref="dateButtonRef"
        type="button"
        @click="toggleDatePicker"
        class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        :class="{ 'border-[#1a5c4c] ring-1 ring-[#1a5c4c] text-[#1a5c4c]': startDate || endDate }"
      >
        <Calendar class="w-4 h-4 text-gray-500" :class="{ 'text-[#1a5c4c]': startDate || endDate }" />
        <span class="whitespace-nowrap">{{ dateButtonText }}</span>
      </button>

      <!-- Date Popover Content -->
      <div 
        v-if="isDatePickerOpen" 
        class="fixed sm:absolute inset-x-4 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:inset-x-auto bg-white border border-gray-200 shadow-2xl rounded-xl z-[100] w-auto sm:w-72 flex flex-col transform translate-z-0"
        :class="[
          dateOpenUpward ? 'sm:bottom-full sm:mb-2 sm:top-auto' : 'sm:top-full sm:mt-2 sm:bottom-auto',
          dateAlignLeft ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'
        ]"
        :style="{ maxHeight: dateMaxHeight + 'px' }"
      >
        <!-- Header -->
        <div class="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Select Date Range</h4>
          <button @click="isDatePickerOpen = false" class="text-gray-400 hover:text-gray-600 p-1">
            <X class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Inputs -->
        <div class="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
            <input 
              :value="startDate"
              @input="e => emit('update:startDate', (e.target as HTMLInputElement).value)"
              type="date" 
              class="w-full text-sm border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none" 
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
            <input 
              :value="endDate"
              @input="e => emit('update:endDate', (e.target as HTMLInputElement).value)"
              type="date" 
              class="w-full text-sm border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none" 
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <button @click="clearDates" class="text-xs text-red-600 hover:underline font-medium">Clear</button>
          <button @click="isDatePickerOpen = false" class="px-4 py-1.5 bg-[#1a5c4c] text-white text-xs font-medium rounded-lg hover:bg-[#1a5c4c]/90 transition-colors shadow-sm">Apply</button>
        </div>
      </div>
    </div>

    <!-- Filters Popover -->
    <div class="relative" ref="filtersContainerRef">
      <button 
        ref="filtersButtonRef"
        type="button"
        @click="toggleFilters"
        class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        :class="{ 'border-[#1a5c4c] ring-1 ring-[#1a5c4c] text-[#1a5c4c]': activeFilterCount > 0 }"
      >
        <Filter class="w-4 h-4 text-gray-500" :class="{ 'text-[#1a5c4c]': activeFilterCount > 0 }" />
        <span>Filters</span>
        <span v-if="activeFilterCount > 0" class="flex items-center justify-center w-5 h-5 ml-1 bg-[#1a5c4c] text-white text-[10px] font-bold rounded-full">
          {{ activeFilterCount }}
        </span>
      </button>

      <!-- Filters Popover Content -->
      <div 
        v-if="isFiltersOpen" 
        class="fixed sm:absolute inset-x-4 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:inset-x-auto bg-white border border-gray-200 shadow-2xl rounded-xl z-[100] w-auto sm:w-80 flex flex-col transform translate-z-0"
        :class="[
          filtersOpenUpward ? 'sm:bottom-full sm:mb-2 sm:top-auto' : 'sm:top-full sm:mt-2 sm:bottom-auto',
          filtersAlignLeft ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'
        ]"
        :style="{ maxHeight: filtersMaxHeight + 'px' }"
      >
        <!-- Header -->
        <div class="p-4 pb-3.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Filters</h4>
          <button @click="isFiltersOpen = false" class="text-gray-400 hover:text-gray-600 p-1">
            <X class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Scrollable Body with all 3 departments + overall status -->
        <div class="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <!-- Overall Status -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Overall Status</label>
            <CustomSelect 
              :modelValue="status"
              @update:modelValue="val => emit('update:status', val)"
              :options="overallStatusOptions"
              searchable
              searchPlaceholder="Search statuses..."
              class="w-full"
            />
          </div>

          <!-- Billing Department -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Billing Department</label>
            <CustomSelect 
              :modelValue="billingStatus"
              @update:modelValue="val => emit('update:billingStatus', val)"
              :options="billingStatusOptions"
              searchable
              searchPlaceholder="Search billing..."
              class="w-full"
            />
          </div>

          <!-- Packing Department -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Packing Department</label>
            <CustomSelect 
              :modelValue="packingStatus"
              @update:modelValue="val => emit('update:packingStatus', val)"
              :options="packingStatusOptions"
              searchable
              searchPlaceholder="Search packing..."
              class="w-full"
            />
          </div>

          <!-- Delivery Department -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Delivery Department</label>
            <CustomSelect 
              :modelValue="deliveryStatus"
              @update:modelValue="val => emit('update:deliveryStatus', val)"
              :options="deliveryStatusOptions"
              searchable
              searchPlaceholder="Search delivery..."
              class="w-full"
            />
          </div>

          <!-- Payment Status -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Payment Status</label>
            <CustomSelect 
              :modelValue="paymentStatus"
              @update:modelValue="val => emit('update:paymentStatus', val)"
              :options="paymentStatusOptions"
              searchable
              searchPlaceholder="Search payments..."
              class="w-full"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <button @click="clearFilters" class="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Clear All</button>
          <button @click="isFiltersOpen = false" class="px-4 py-2 bg-[#1a5c4c] text-white text-sm font-medium rounded-md hover:bg-[#1a5c4c]/90 transition-colors shadow-sm">Show Results</button>
        </div>
      </div>
    </div>
  </div>
</template>
