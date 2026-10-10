<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Calendar, Filter, X, ChevronDown, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  startDate?: string
  endDate?: string
  status?: string
  billingStatus?: string
  packingStatus?: string
  deliveryStatus?: string
  isApproved?: string
}>(), {
  startDate: '',
  endDate: '',
  status: '',
  billingStatus: '',
  packingStatus: '',
  deliveryStatus: '',
  isApproved: ''
})

const emit = defineEmits<{
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'update:packingStatus', val: string): void
  (e: 'update:deliveryStatus', val: string): void
  (e: 'update:isApproved', val: string): void
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
  activeDropdown.value = null
}

onClickOutside(dateContainerRef, () => {
  isDatePickerOpen.value = false
})

onClickOutside(filtersContainerRef, () => {
  isFiltersOpen.value = false
  activeDropdown.value = null
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.status) count++
  if (props.billingStatus) count++
  if (props.packingStatus) count++
  if (props.deliveryStatus) count++
  if (props.isApproved !== undefined && props.isApproved !== '') count++
  return count
})

const clearFilters = () => {
  emit('update:status', '')
  emit('update:billingStatus', '')
  emit('update:packingStatus', '')
  emit('update:deliveryStatus', '')
  emit('update:isApproved', '')
  activeDropdown.value = null
  isFiltersOpen.value = false
}

const clearDates = () => {
  emit('update:startDate', '')
  emit('update:endDate', '')
  isDatePickerOpen.value = false
}

const formatDateYMD = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isPresetActive = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
  const now = new Date()
  const todayStr = formatDateYMD(now)
  if (preset === 'today') {
    return props.startDate === todayStr && props.endDate === todayStr
  }
  if (preset === 'yesterday') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    const yestStr = formatDateYMD(yest)
    return props.startDate === yestStr && props.endDate === yestStr
  }
  if (preset === 'last7') {
    const past = new Date(now)
    past.setDate(past.getDate() - 6)
    return props.startDate === formatDateYMD(past) && props.endDate === todayStr
  }
  if (preset === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return props.startDate === formatDateYMD(startOfMonth) && props.endDate === todayStr
  }
  return false
}

const setDatePreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
  const now = new Date()
  const todayStr = formatDateYMD(now)
  if (preset === 'today') {
    emit('update:startDate', todayStr)
    emit('update:endDate', todayStr)
  } else if (preset === 'yesterday') {
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    const yestStr = formatDateYMD(yest)
    emit('update:startDate', yestStr)
    emit('update:endDate', yestStr)
  } else if (preset === 'last7') {
    const past = new Date(now)
    past.setDate(past.getDate() - 6)
    emit('update:startDate', formatDateYMD(past))
    emit('update:endDate', todayStr)
  } else if (preset === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    emit('update:startDate', formatDateYMD(startOfMonth))
    emit('update:endDate', todayStr)
  }
}

const dateButtonText = computed(() => {
  if (props.startDate && props.endDate) {
    if (isPresetActive('today')) return 'Today'
    if (isPresetActive('yesterday')) return 'Yesterday'
    if (isPresetActive('last7')) return 'Last 7 Days'
    if (isPresetActive('thisMonth')) return 'This Month'
    if (props.startDate === props.endDate) {
      return new Date(`${props.startDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }
    const start = new Date(`${props.startDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const end = new Date(`${props.endDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${start} - ${end}`
  } else if (props.startDate) {
    const start = new Date(`${props.startDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${start} onwards`
  } else if (props.endDate) {
    const end = new Date(`${props.endDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `Until ${end}`
  }
  return 'Date Range'
})

const activeDropdown = ref<string | null>(null)

const toggleDropdown = (name: string) => {
  if (activeDropdown.value === name) {
    activeDropdown.value = null
  } else {
    activeDropdown.value = name
  }
}

const selectOption = (field: 'status' | 'billingStatus' | 'packingStatus' | 'deliveryStatus' | 'isApproved', val: string) => {
  if (field === 'status') emit('update:status', val)
  else if (field === 'billingStatus') emit('update:billingStatus', val)
  else if (field === 'packingStatus') emit('update:packingStatus', val)
  else if (field === 'deliveryStatus') emit('update:deliveryStatus', val)
  else if (field === 'isApproved') emit('update:isApproved', val)
  activeDropdown.value = null
}

const getOptionLabel = (val: string | undefined, options: { label: string; value: string; dot?: string }[]) => {
  const found = options.find(o => o.value === (val || ''))
  return found ? found.label : options[0].label
}

const getStatusDot = (val: string | undefined, options: { label: string; value: string; dot?: string }[]) => {
  const found = options.find(o => o.value === (val || ''))
  return found?.dot || 'bg-gray-300'
}

const overallStatusOptions = [
  { label: 'All Statuses', value: '', dot: 'bg-gray-300' },
  { label: 'Awaiting Billing & Packing', value: 'CONFIRMED', dot: 'bg-amber-400' },
  { label: 'Awaiting / Action Required', value: 'PROCESSING', dot: 'bg-amber-500' },
  { label: 'Ready for Dispatch', value: 'READY', dot: 'bg-emerald-500' },
  { label: 'In Transit', value: 'DISPATCHED', dot: 'bg-blue-500' },
  { label: 'Delivered', value: 'DELIVERED', dot: 'bg-emerald-600' },
  { label: 'Cancelled', value: 'CANCELLED', dot: 'bg-rose-500' }
]

const billingStatusOptions = [
  { label: 'All Billing States', value: '', dot: 'bg-gray-300' },
  { label: 'Pending', value: 'PENDING', dot: 'bg-amber-400' },
  { label: 'Generated', value: 'GENERATED', dot: 'bg-emerald-500' },
  { label: 'On Hold', value: 'ON_HOLD', dot: 'bg-rose-500' }
]

const packingStatusOptions = [
  { label: 'All Packing States', value: '', dot: 'bg-gray-300' },
  { label: 'Pending', value: 'PENDING', dot: 'bg-gray-400' },
  { label: 'In Progress', value: 'IN_PROGRESS', dot: 'bg-blue-500' },
  { label: 'Packed', value: 'PACKED', dot: 'bg-emerald-500' },
  { label: 'On Hold', value: 'ON_HOLD', dot: 'bg-amber-500' }
]

const deliveryStatusOptions = [
  { label: 'All Delivery States', value: '', dot: 'bg-gray-300' },
  { label: 'Waiting', value: 'WAITING', dot: 'bg-gray-400' },
  { label: 'Assigned', value: 'ASSIGNED', dot: 'bg-blue-400' },
  { label: 'Dispatched', value: 'DISPATCHED', dot: 'bg-blue-600' },
  { label: 'Delivered', value: 'DELIVERED', dot: 'bg-emerald-500' },
  { label: 'On Hold', value: 'ON_HOLD', dot: 'bg-amber-500' }
]

const approvalStatusOptions = [
  { label: 'All Orders', value: '', dot: 'bg-gray-300' },
  { label: 'Approved', value: 'true', dot: 'bg-emerald-500' },
  { label: 'Pending Approval', value: 'false', dot: 'bg-amber-400' }
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
        class="fixed sm:absolute inset-x-4 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:inset-x-auto bg-white border border-gray-200 shadow-2xl rounded-xl z-[100] w-auto sm:w-80 flex flex-col transform translate-z-0"
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
        
        <!-- Inputs and Presets -->
        <div class="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <!-- Quick Presets -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Quick Presets</label>
            <div class="grid grid-cols-2 gap-1.5">
              <button 
                type="button"
                @click="setDatePreset('today')"
                class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors"
                :class="isPresetActive('today') ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c] font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                Today
              </button>
              <button 
                type="button"
                @click="setDatePreset('yesterday')"
                class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors"
                :class="isPresetActive('yesterday') ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c] font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                Yesterday
              </button>
              <button 
                type="button"
                @click="setDatePreset('last7')"
                class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors"
                :class="isPresetActive('last7') ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c] font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                Last 7 Days
              </button>
              <button 
                type="button"
                @click="setDatePreset('thisMonth')"
                class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors"
                :class="isPresetActive('thisMonth') ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c] font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                This Month
              </button>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-3 space-y-3">
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
        <div class="p-4 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Filters</h4>
            <span v-if="activeFilterCount > 0" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1a5c4c]/10 text-[#1a5c4c]">
              {{ activeFilterCount }} active
            </span>
          </div>
          <button @click="isFiltersOpen = false" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Scrollable Body with custom dropdown menus -->
        <div class="p-4 space-y-3.5 overflow-y-auto flex-1 min-h-0">
          <!-- 1. Overall Status -->
          <div class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Overall Status</label>
              <button 
                v-if="status" 
                type="button"
                @click.stop="emit('update:status', '')"
                class="text-[10px] font-semibold text-[#1a5c4c] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative">
              <button
                type="button"
                @click="toggleDropdown('status')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="status ? 'border-[#1a5c4c] bg-[#1a5c4c]/5 text-gray-900 ring-1 ring-[#1a5c4c]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(status, overallStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(status, overallStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1a5c4c]': activeDropdown === 'status' }" />
              </button>

              <!-- Dropdown Menu -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform opacity-0 -translate-y-1 scale-98"
                enter-to-class="transform opacity-100 translate-y-0 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform opacity-100 translate-y-0 scale-100"
                leave-to-class="transform opacity-0 -translate-y-1 scale-98"
              >
                <div 
                  v-if="activeDropdown === 'status'"
                  class="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in overallStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('status', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="status === opt.value ? 'bg-[#1a5c4c]/10 text-[#1a5c4c] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="status === opt.value" class="w-3.5 h-3.5 text-[#1a5c4c] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 2. Billing Department -->
          <div class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Billing Department</label>
              <button 
                v-if="billingStatus" 
                type="button"
                @click.stop="emit('update:billingStatus', '')"
                class="text-[10px] font-semibold text-[#1a5c4c] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative">
              <button
                type="button"
                @click="toggleDropdown('billingStatus')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="billingStatus ? 'border-[#1a5c4c] bg-[#1a5c4c]/5 text-gray-900 ring-1 ring-[#1a5c4c]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(billingStatus, billingStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(billingStatus, billingStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1a5c4c]': activeDropdown === 'billingStatus' }" />
              </button>

              <!-- Dropdown Menu -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform opacity-0 -translate-y-1 scale-98"
                enter-to-class="transform opacity-100 translate-y-0 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform opacity-100 translate-y-0 scale-100"
                leave-to-class="transform opacity-0 -translate-y-1 scale-98"
              >
                <div 
                  v-if="activeDropdown === 'billingStatus'"
                  class="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in billingStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('billingStatus', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="billingStatus === opt.value ? 'bg-[#1a5c4c]/10 text-[#1a5c4c] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="billingStatus === opt.value" class="w-3.5 h-3.5 text-[#1a5c4c] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 3. Packing Department -->
          <div class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Packing Department</label>
              <button 
                v-if="packingStatus" 
                type="button"
                @click.stop="emit('update:packingStatus', '')"
                class="text-[10px] font-semibold text-[#1a5c4c] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative">
              <button
                type="button"
                @click="toggleDropdown('packingStatus')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="packingStatus ? 'border-[#1a5c4c] bg-[#1a5c4c]/5 text-gray-900 ring-1 ring-[#1a5c4c]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(packingStatus, packingStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(packingStatus, packingStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1a5c4c]': activeDropdown === 'packingStatus' }" />
              </button>

              <!-- Dropdown Menu -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform opacity-0 -translate-y-1 scale-98"
                enter-to-class="transform opacity-100 translate-y-0 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform opacity-100 translate-y-0 scale-100"
                leave-to-class="transform opacity-0 -translate-y-1 scale-98"
              >
                <div 
                  v-if="activeDropdown === 'packingStatus'"
                  class="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in packingStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('packingStatus', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="packingStatus === opt.value ? 'bg-[#1a5c4c]/10 text-[#1a5c4c] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="packingStatus === opt.value" class="w-3.5 h-3.5 text-[#1a5c4c] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 4. Delivery Department (opens upward) -->
          <div class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Delivery Department</label>
              <button 
                v-if="deliveryStatus" 
                type="button"
                @click.stop="emit('update:deliveryStatus', '')"
                class="text-[10px] font-semibold text-[#1a5c4c] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative">
              <button
                type="button"
                @click="toggleDropdown('deliveryStatus')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="deliveryStatus ? 'border-[#1a5c4c] bg-[#1a5c4c]/5 text-gray-900 ring-1 ring-[#1a5c4c]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(deliveryStatus, deliveryStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(deliveryStatus, deliveryStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1a5c4c]': activeDropdown === 'deliveryStatus' }" />
              </button>

              <!-- Dropdown Menu (opens upward) -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform opacity-0 translate-y-1 scale-98"
                enter-to-class="transform opacity-100 translate-y-0 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform opacity-100 translate-y-0 scale-100"
                leave-to-class="transform opacity-0 translate-y-1 scale-98"
              >
                <div 
                  v-if="activeDropdown === 'deliveryStatus'"
                  class="absolute left-0 right-0 bottom-full mb-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in deliveryStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('deliveryStatus', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="deliveryStatus === opt.value ? 'bg-[#1a5c4c]/10 text-[#1a5c4c] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="deliveryStatus === opt.value" class="w-3.5 h-3.5 text-[#1a5c4c] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 5. Approval Status (opens upward) -->
          <div class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Approval Status</label>
              <button 
                v-if="isApproved !== undefined && isApproved !== ''" 
                type="button"
                @click.stop="emit('update:isApproved', '')"
                class="text-[10px] font-semibold text-[#1a5c4c] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative">
              <button
                type="button"
                @click="toggleDropdown('isApproved')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="(isApproved !== undefined && isApproved !== '') ? 'border-[#1a5c4c] bg-[#1a5c4c]/5 text-gray-900 ring-1 ring-[#1a5c4c]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(isApproved, approvalStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(isApproved, approvalStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1a5c4c]': activeDropdown === 'isApproved' }" />
              </button>

              <!-- Dropdown Menu (opens upward) -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform opacity-0 translate-y-1 scale-98"
                enter-to-class="transform opacity-100 translate-y-0 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform opacity-100 translate-y-0 scale-100"
                leave-to-class="transform opacity-0 translate-y-1 scale-98"
              >
                <div 
                  v-if="activeDropdown === 'isApproved'"
                  class="absolute left-0 right-0 bottom-full mb-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in approvalStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click="selectOption('isApproved', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="isApproved === opt.value ? 'bg-[#1a5c4c]/10 text-[#1a5c4c] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="isApproved === opt.value" class="w-3.5 h-3.5 text-[#1a5c4c] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-3.5 bg-gray-50/90 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <button 
            type="button"
            @click="clearFilters" 
            class="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
          >
            Clear All
          </button>
          <button 
            type="button"
            @click="isFiltersOpen = false" 
            class="px-4 py-2 bg-[#1a5c4c] text-white text-xs font-semibold rounded-xl hover:bg-[#1a5c4c]/90 transition-all shadow-sm cursor-pointer"
          >
            Show Results
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
