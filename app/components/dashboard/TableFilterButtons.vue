<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Calendar, Filter, X, ChevronDown, Check, User as UserIcon, Users, Search } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  startDate?: string
  endDate?: string
  status?: string
  billingStatus?: string
  packingStatus?: string
  deliveryStatus?: string
  isApproved?: string
  salesPersonId?: string
  salesPersons?: any[]
  showOverallStatus?: boolean
  showApprovalStatus?: boolean
  showPackingStatus?: boolean
  showBillingStatus?: boolean
  showDeliveryStatus?: boolean
  showPlacedBy?: boolean
  showDateFilter?: boolean
}>(), {
  startDate: '',
  endDate: '',
  status: '',
  billingStatus: '',
  packingStatus: '',
  deliveryStatus: '',
  isApproved: '',
  salesPersonId: '',
  salesPersons: undefined,
  showOverallStatus: true,
  showApprovalStatus: true,
  showPackingStatus: true,
  showBillingStatus: true,
  showDeliveryStatus: true,
  showPlacedBy: true,
  showDateFilter: true
})

const emit = defineEmits<{
  (e: 'update:startDate', val: string): void
  (e: 'update:endDate', val: string): void
  (e: 'update:status', val: string): void
  (e: 'update:billingStatus', val: string): void
  (e: 'update:packingStatus', val: string): void
  (e: 'update:deliveryStatus', val: string): void
  (e: 'update:isApproved', val: string): void
  (e: 'update:salesPersonId', val: string): void
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

const isDesktop = ref(false)
const isMounted = ref(false)

const updateDeviceSize = () => {
  if (typeof window !== 'undefined') {
    isDesktop.value = window.innerWidth >= 640
  }
}

const updateDatePlacement = () => {
  if (typeof window === 'undefined' || !dateButtonRef.value) return
  const rect = dateButtonRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  
  // Dynamically flip upward when space below is tight (< 340px) and there is more room above
  dateOpenUpward.value = spaceBelow < 340 && spaceAbove > spaceBelow
  
  // Check horizontal alignment to avoid overflowing left edge on desktop
  dateAlignLeft.value = rect.left < 300 || rect.right < 340
  
  // Constrain max height so popover never goes outside viewport
  const available = dateOpenUpward.value ? spaceAbove - 16 : spaceBelow - 16
  dateMaxHeight.value = Math.max(240, Math.min(available, 520))
}

const updateFiltersPlacement = () => {
  if (typeof window === 'undefined' || !filtersButtonRef.value) return
  const rect = filtersButtonRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  
  // Dynamically flip upward when space below is tight (< 360px) and there is more room above
  filtersOpenUpward.value = spaceBelow < 360 && spaceAbove > spaceBelow
  
  // Check horizontal alignment
  filtersAlignLeft.value = rect.left < 320 || rect.right < 350
  
  // Constrain max height so popover never goes outside viewport
  const available = filtersOpenUpward.value ? spaceAbove - 16 : spaceBelow - 16
  filtersMaxHeight.value = Math.max(260, Math.min(available, 580))
}

const handleViewportUpdate = () => {
  updateDeviceSize()
  if (isDatePickerOpen.value) updateDatePlacement()
  if (isFiltersOpen.value) updateFiltersPlacement()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    isMounted.value = true
    updateDeviceSize()
    window.addEventListener('scroll', handleViewportUpdate, true)
    window.addEventListener('resize', handleViewportUpdate, { passive: true })
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleViewportUpdate, true)
    window.removeEventListener('resize', handleViewportUpdate)
  }
})

const toggleDatePicker = () => {
  updateDeviceSize()
  if (isDatePickerOpen.value) {
    isDatePickerOpen.value = false
  } else {
    updateDatePlacement()
    isDatePickerOpen.value = true
    isFiltersOpen.value = false
  }
}

const toggleFilters = () => {
  updateDeviceSize()
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
  if (!isDesktop.value) return
  isDatePickerOpen.value = false
})

onClickOutside(filtersContainerRef, () => {
  if (!isDesktop.value) return
  isFiltersOpen.value = false
  activeDropdown.value = null
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.showOverallStatus && props.status) count++
  if (props.showBillingStatus && props.billingStatus) count++
  if (props.showPackingStatus && props.packingStatus) count++
  if (props.showDeliveryStatus && props.deliveryStatus) count++
  if (props.showApprovalStatus && props.isApproved !== undefined && props.isApproved !== '') count++
  if (props.showPlacedBy && props.salesPersonId) count++
  return count
})

const clearFilters = () => {
  emit('update:status', '')
  emit('update:billingStatus', '')
  emit('update:packingStatus', '')
  emit('update:deliveryStatus', '')
  emit('update:isApproved', '')
  emit('update:salesPersonId', '')
  activeDropdown.value = null
  salesPersonSearch.value = ''
  isFiltersOpen.value = false
}

// Sales Persons list & searching
const salesPersonSearch = ref('')
const { data: fetchedUsers } = useFetch<any[]>('/api/users')

const salesPersonsList = computed(() => {
  if (props.salesPersons && props.salesPersons.length) return props.salesPersons
  if (!fetchedUsers.value) return []
  return fetchedUsers.value.filter(u => u.role === 'SALES' || u.role === 'ADMIN' || u.role === 'SUPERVISOR')
})

const filteredSalesPersonsList = computed(() => {
  const list = salesPersonsList.value
  if (!salesPersonSearch.value.trim()) return list
  const q = salesPersonSearch.value.trim().toLowerCase()
  return list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q))
})

const selectedSalesPerson = computed(() => {
  if (!props.salesPersonId || props.salesPersonId === 'all') return null
  return salesPersonsList.value.find(u => u.id === props.salesPersonId) || null
})

const getInitials = (name?: string) => {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const selectSalesPerson = (id: string) => {
  emit('update:salesPersonId', id)
  activeDropdown.value = null
  salesPersonSearch.value = ''
}

const resetDates = () => {
  emit('update:startDate', '')
  emit('update:endDate', '')
}

const clearDates = () => {
  resetDates()
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
    if (name === 'deliveryStatus' || name === 'billingStatus') {
      nextTick(() => {
        const el = document.querySelector(`.dropdown-menu-${name}`) as HTMLElement | null
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })
    }
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

const onFilterSectionClick = (e: MouseEvent) => {
  if (!activeDropdown.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.filter-dropdown-menu')) {
    activeDropdown.value = null
  }
}

// 1. Overall Status
const overallStatusOptions = [
  { label: 'All Active Orders', value: '', dot: 'bg-gray-300' },
  { label: 'All Orders (Incl. Cancelled)', value: 'ALL', dot: 'bg-gray-400' },
  { label: 'Awaiting Billing & Packing', value: 'CONFIRMED', dot: 'bg-amber-400' },
  { label: 'Awaiting / Action Required', value: 'PROCESSING', dot: 'bg-amber-500' },
  { label: 'Ready for Dispatch', value: 'READY', dot: 'bg-emerald-500' },
  { label: 'In Transit', value: 'DISPATCHED', dot: 'bg-blue-500' },
  { label: 'Delivered', value: 'DELIVERED', dot: 'bg-emerald-600' },
  { label: 'Cancelled', value: 'CANCELLED', dot: 'bg-rose-500' }
]

// 2. Approval Status
const approvalStatusOptions = [
  { label: 'All Orders', value: '', dot: 'bg-gray-300' },
  { label: 'Approved', value: 'true', dot: 'bg-emerald-500' },
  { label: 'Pending Approval', value: 'false', dot: 'bg-amber-400' }
]

// 3. Packing Department (On Hold is orange)
const packingStatusOptions = [
  { label: 'All Packing States', value: '', dot: 'bg-gray-300' },
  { label: 'Pending', value: 'PENDING', dot: 'bg-gray-400' },
  { label: 'In Progress', value: 'IN_PROGRESS', dot: 'bg-blue-500' },
  { label: 'Packed', value: 'PACKED', dot: 'bg-emerald-500' },
  { label: 'On Hold', value: 'ON_HOLD', dot: 'bg-amber-500' }
]

// 4. Billing Department (On Hold is red)
const billingStatusOptions = [
  { label: 'All Billing States', value: '', dot: 'bg-gray-300' },
  { label: 'Pending', value: 'PENDING', dot: 'bg-amber-400' },
  { label: 'Generated', value: 'GENERATED', dot: 'bg-emerald-500' },
  { label: 'On Hold', value: 'ON_HOLD', dot: 'bg-rose-500' }
]

// 5. Delivery Department (On Hold is orange)
const deliveryStatusOptions = [
  { label: 'All Delivery States', value: '', dot: 'bg-gray-300' },
  { label: 'Waiting', value: 'WAITING', dot: 'bg-gray-400' },
  { label: 'Assigned', value: 'ASSIGNED', dot: 'bg-blue-400' },
  { label: 'Dispatched', value: 'DISPATCHED', dot: 'bg-blue-600' },
  { label: 'Delivered', value: 'DELIVERED', dot: 'bg-emerald-500' },
  { label: 'On Hold', value: 'ON_HOLD', dot: 'bg-amber-500' }
]
</script>

<template>
  <div class="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
    <!-- Date Range Filter -->
    <div v-if="showDateFilter" class="relative flex-1 sm:flex-initial" ref="dateContainerRef" :class="{ 'z-50': isDatePickerOpen && isDesktop }">
      <button 
        ref="dateButtonRef"
        type="button"
        @click="toggleDatePicker"
        class="w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs sm:shadow-sm cursor-pointer whitespace-nowrap"
        :class="{ 'border-[#1b3b5f] ring-1 ring-[#1b3b5f] text-[#1b3b5f]': startDate || endDate }"
      >
        <Calendar class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 shrink-0" :class="{ 'text-[#1b3b5f]': startDate || endDate }" />
        <span class="truncate max-w-[85px] sm:max-w-none">{{ dateButtonText }}</span>
        <span v-if="startDate || endDate" class="w-1.5 h-1.5 rounded-full bg-[#1b3b5f] shrink-0" />
      </button>

      <!-- Date Popover Content -->
      <Teleport to="body" :disabled="!isMounted || isDesktop">
        <div 
          v-if="isDatePickerOpen" 
          :class="isDesktop ? 'contents' : 'fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]'"
        >
          <!-- Mobile Backdrop -->
          <div 
            v-if="!isDesktop" 
            class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            @click="closeAll" 
          />

          <!-- Popover Card -->
          <div 
            class="bg-white border border-gray-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
            :class="isDesktop ? [
              'absolute z-50 w-80',
              dateOpenUpward ? 'bottom-full mb-2 top-auto' : 'top-full mt-2 bottom-auto',
              dateAlignLeft ? 'left-0 right-auto' : 'right-0 left-auto'
            ] : 'relative z-10 w-full max-w-sm max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] animate-in zoom-in-95 duration-150'"
            :style="{ maxHeight: isDesktop ? (dateMaxHeight + 'px') : undefined }"
            @click.stop
          >
            <!-- Header -->
        <div class="p-4 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div class="flex items-center gap-2 truncate">
            <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Date Range</h4>
            <span v-if="startDate || endDate" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1b3b5f]/10 text-[#1b3b5f] truncate max-w-[130px]">
              {{ dateButtonText }}
            </span>
          </div>
          <button @click="isDatePickerOpen = false" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Inputs and Presets -->
        <div class="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <!-- Quick Presets -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Quick Presets</label>
              <button 
                v-if="startDate || endDate" 
                type="button"
                @click.stop="resetDates"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button"
                @click="setDatePreset('today')"
                class="px-3 py-2 text-xs rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer"
                :class="isPresetActive('today') ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-[#1b3b5f] font-semibold ring-1 ring-[#1b3b5f]/20' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="isPresetActive('today') ? 'bg-[#1b3b5f]' : 'bg-gray-300'" />
                  <span class="truncate">Today</span>
                </div>
                <Check v-if="isPresetActive('today')" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1" />
              </button>

              <button 
                type="button"
                @click="setDatePreset('yesterday')"
                class="px-3 py-2 text-xs rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer"
                :class="isPresetActive('yesterday') ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-[#1b3b5f] font-semibold ring-1 ring-[#1b3b5f]/20' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="isPresetActive('yesterday') ? 'bg-[#1b3b5f]' : 'bg-gray-300'" />
                  <span class="truncate">Yesterday</span>
                </div>
                <Check v-if="isPresetActive('yesterday')" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1" />
              </button>

              <button 
                type="button"
                @click="setDatePreset('last7')"
                class="px-3 py-2 text-xs rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer"
                :class="isPresetActive('last7') ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-[#1b3b5f] font-semibold ring-1 ring-[#1b3b5f]/20' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="isPresetActive('last7') ? 'bg-[#1b3b5f]' : 'bg-gray-300'" />
                  <span class="truncate">Last 7 Days</span>
                </div>
                <Check v-if="isPresetActive('last7')" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1" />
              </button>

              <button 
                type="button"
                @click="setDatePreset('thisMonth')"
                class="px-3 py-2 text-xs rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer"
                :class="isPresetActive('thisMonth') ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-[#1b3b5f] font-semibold ring-1 ring-[#1b3b5f]/20' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="isPresetActive('thisMonth') ? 'bg-[#1b3b5f]' : 'bg-gray-300'" />
                  <span class="truncate">This Month</span>
                </div>
                <Check v-if="isPresetActive('thisMonth')" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1" />
              </button>
            </div>
          </div>

          <!-- Custom Date Range -->
          <div class="pt-3.5 border-t border-gray-100 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Custom Date Range</label>
              <button 
                v-if="startDate || endDate" 
                type="button"
                @click.stop="resetDates"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="space-y-2.5">
              <div class="space-y-1">
                <label class="text-[11px] font-medium text-gray-500 block">From Date</label>
                <div class="relative">
                  <input 
                    :value="startDate"
                    @input="e => emit('update:startDate', (e.target as HTMLInputElement).value)"
                    type="date" 
                    class="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all text-gray-800 bg-white focus:outline-none cursor-pointer"
                    :class="startDate ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 hover:border-gray-300 focus:border-gray-400'"
                  />
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-[11px] font-medium text-gray-500 block">To Date</label>
                <div class="relative">
                  <input 
                    :value="endDate"
                    @input="e => emit('update:endDate', (e.target as HTMLInputElement).value)"
                    type="date" 
                    class="w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all text-gray-800 bg-white focus:outline-none cursor-pointer"
                    :class="endDate ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 hover:border-gray-300 focus:border-gray-400'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-3.5 bg-gray-50/90 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <button 
            type="button"
            @click="clearDates" 
            class="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
          >
            Clear All
          </button>
          <button 
            type="button"
            @click="isDatePickerOpen = false" 
            class="px-4 py-2 bg-[#1b3b5f] text-white text-xs font-semibold rounded-xl hover:bg-[#1b3b5f]/90 transition-all shadow-sm cursor-pointer"
          >
            Show Results
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</div>

    <!-- Filters Popover -->
    <div class="relative flex-1 sm:flex-initial" ref="filtersContainerRef" :class="{ 'z-50': isFiltersOpen && isDesktop }">
      <button 
        ref="filtersButtonRef"
        type="button"
        @click="toggleFilters"
        class="w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs sm:shadow-sm cursor-pointer whitespace-nowrap"
        :class="{ 'border-[#1b3b5f] ring-1 ring-[#1b3b5f] text-[#1b3b5f]': activeFilterCount > 0 }"
      >
        <Filter class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 shrink-0" :class="{ 'text-[#1b3b5f]': activeFilterCount > 0 }" />
        <span>Filters</span>
        <span v-if="activeFilterCount > 0" class="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 ml-0.5 sm:ml-1 bg-[#1b3b5f] text-white text-[9px] sm:text-[10px] font-bold rounded-full shrink-0">
          {{ activeFilterCount }}
        </span>
      </button>

      <!-- Filters Popover Content -->
      <Teleport to="body" :disabled="!isMounted || isDesktop">
        <div 
          v-if="isFiltersOpen" 
          :class="isDesktop ? 'contents' : 'fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]'"
        >
          <!-- Mobile Backdrop -->
          <div 
            v-if="!isDesktop" 
            class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            @click="closeAll" 
          />

          <!-- Filters Popover Card -->
          <div 
            class="bg-white border border-gray-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
            :class="isDesktop ? [
              'absolute z-50 w-80',
              filtersOpenUpward ? 'bottom-full mb-2 top-auto' : 'top-full mt-2 bottom-auto',
              filtersAlignLeft ? 'left-0 right-auto' : 'right-0 left-auto'
            ] : 'relative z-10 w-full max-w-sm max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] animate-in zoom-in-95 duration-150'"
            :style="{ maxHeight: isDesktop ? (filtersMaxHeight + 'px') : undefined }"
            @click.stop
          >
            <!-- Header -->
        <div class="p-4 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0" @click="activeDropdown = null">
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Filters</h4>
            <span v-if="activeFilterCount > 0" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1b3b5f]/10 text-[#1b3b5f]">
              {{ activeFilterCount }} active
            </span>
          </div>
          <button @click="isFiltersOpen = false" class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Scrollable Body with custom dropdown menus in requested order -->
        <div 
          class="p-4 space-y-3.5 overflow-y-auto flex-1 min-h-0 transition-all duration-200" 
          :class="{
            'pb-44': activeDropdown === 'deliveryStatus',
            'pb-28': activeDropdown === 'billingStatus',
            'pb-36': activeDropdown === 'salesPerson'
          }"
          @click="onFilterSectionClick"
        >
          <!-- 1. Overall Status -->
          <div v-if="showOverallStatus" class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Overall Status</label>
              <button 
                v-if="status" 
                type="button"
                @click.stop="emit('update:status', '')"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative filter-dropdown-menu" :class="{ 'z-20': activeDropdown === 'status' }">
              <button
                type="button"
                @click.stop="toggleDropdown('status')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="status ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-gray-900 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(status, overallStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(status, overallStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1b3b5f]': activeDropdown === 'status' }" />
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
                  class="dropdown-menu-status absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in overallStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click.stop="selectOption('status', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="status === opt.value ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="status === opt.value" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Placed By (Sales Person) Filter -->
          <div v-if="showPlacedBy" class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Placed By (Sales Person)</label>
              <button 
                v-if="salesPersonId" 
                type="button"
                @click.stop="emit('update:salesPersonId', '')"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative filter-dropdown-menu" :class="{ 'z-20': activeDropdown === 'salesPerson' }">
              <button
                type="button"
                @click.stop="toggleDropdown('salesPerson')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="salesPersonId ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-gray-900 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <div 
                    v-if="selectedSalesPerson"
                    class="w-5 h-5 rounded-full bg-[#1b3b5f] text-white flex items-center justify-center font-bold text-[9px] shrink-0"
                  >
                    {{ getInitials(selectedSalesPerson.name) }}
                  </div>
                  <UserIcon v-else class="w-4 h-4 text-gray-400 shrink-0" />
                  <span class="truncate font-medium text-xs sm:text-sm">
                    {{ selectedSalesPerson ? selectedSalesPerson.name : 'All Sales Persons' }}
                  </span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1b3b5f]': activeDropdown === 'salesPerson' }" />
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
                  v-if="activeDropdown === 'salesPerson'"
                  class="dropdown-menu-salesPerson absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-56 overflow-y-auto divide-y divide-gray-50"
                >
                  <!-- Search input inside dropdown -->
                  <div v-if="salesPersonsList.length > 4" class="p-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10" @click.stop>
                    <div class="relative">
                      <Search class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                      <input 
                        v-model="salesPersonSearch" 
                        type="text" 
                        placeholder="Search sales person..." 
                        class="w-full pl-8 pr-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]" 
                      />
                    </div>
                  </div>

                  <!-- All Sales Persons option -->
                  <button
                    type="button"
                    @click.stop="selectSalesPerson('')"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="!salesPersonId ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <div class="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                        <Users class="w-3 h-3" />
                      </div>
                      <span class="truncate">All Sales Persons</span>
                    </div>
                    <Check v-if="!salesPersonId" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>

                  <!-- Filtered Reps List -->
                  <button
                    v-for="rep in filteredSalesPersonsList"
                    :key="rep.id"
                    type="button"
                    @click.stop="selectSalesPerson(rep.id)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="salesPersonId === rep.id ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate min-w-0">
                      <div class="w-5 h-5 rounded-full bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center font-bold text-[9px] shrink-0">
                        {{ getInitials(rep.name) }}
                      </div>
                      <div class="truncate">
                        <span class="font-medium truncate block">{{ rep.name }}</span>
                        <span v-if="rep.role" class="text-[9px] text-gray-400 uppercase tracking-wider block">{{ rep.role }}</span>
                      </div>
                    </div>
                    <Check v-if="salesPersonId === rep.id" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>

                  <div v-if="filteredSalesPersonsList.length === 0" class="p-3 text-center text-xs text-gray-400">
                    No sales person found
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 2. Approval Status -->
          <div v-if="showApprovalStatus" class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Approval Status</label>
              <button 
                v-if="isApproved !== undefined && isApproved !== ''" 
                type="button"
                @click.stop="emit('update:isApproved', '')"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative filter-dropdown-menu" :class="{ 'z-20': activeDropdown === 'isApproved' }">
              <button
                type="button"
                @click.stop="toggleDropdown('isApproved')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="(isApproved !== undefined && isApproved !== '') ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-gray-900 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(isApproved, approvalStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(isApproved, approvalStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1b3b5f]': activeDropdown === 'isApproved' }" />
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
                  v-if="activeDropdown === 'isApproved'"
                  class="dropdown-menu-isApproved absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in approvalStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click.stop="selectOption('isApproved', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="isApproved === opt.value ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="isApproved === opt.value" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 3. Packing Department -->
          <div v-if="showPackingStatus" class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Packing Department</label>
              <button 
                v-if="packingStatus" 
                type="button"
                @click.stop="emit('update:packingStatus', '')"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative filter-dropdown-menu" :class="{ 'z-20': activeDropdown === 'packingStatus' }">
              <button
                type="button"
                @click.stop="toggleDropdown('packingStatus')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="packingStatus ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-gray-900 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(packingStatus, packingStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(packingStatus, packingStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1b3b5f]': activeDropdown === 'packingStatus' }" />
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
                  class="dropdown-menu-packingStatus absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in packingStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click.stop="selectOption('packingStatus', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="packingStatus === opt.value ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="packingStatus === opt.value" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 4. Billing Department -->
          <div v-if="showBillingStatus" class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Billing Department</label>
              <button 
                v-if="billingStatus" 
                type="button"
                @click.stop="emit('update:billingStatus', '')"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative filter-dropdown-menu" :class="{ 'z-20': activeDropdown === 'billingStatus' }">
              <button
                type="button"
                @click.stop="toggleDropdown('billingStatus')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="billingStatus ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-gray-900 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(billingStatus, billingStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(billingStatus, billingStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1b3b5f]': activeDropdown === 'billingStatus' }" />
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
                  class="dropdown-menu-billingStatus absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in billingStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click.stop="selectOption('billingStatus', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="billingStatus === opt.value ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="billingStatus === opt.value" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 5. Delivery Department -->
          <div v-if="showDeliveryStatus" class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Delivery Department</label>
              <button 
                v-if="deliveryStatus" 
                type="button"
                @click.stop="emit('update:deliveryStatus', '')"
                class="text-[10px] font-semibold text-[#1b3b5f] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>
            
            <div class="relative filter-dropdown-menu" :class="{ 'z-20': activeDropdown === 'deliveryStatus' }">
              <button
                type="button"
                @click.stop="toggleDropdown('deliveryStatus')"
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between transition-all duration-150 text-left cursor-pointer"
                :class="deliveryStatus ? 'border-[#1b3b5f] bg-[#1b3b5f]/5 text-gray-900 ring-1 ring-[#1b3b5f]/20 font-medium' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="getStatusDot(deliveryStatus, deliveryStatusOptions)" />
                  <span class="truncate font-medium text-xs sm:text-sm">{{ getOptionLabel(deliveryStatus, deliveryStatusOptions) }}</span>
                </div>
                <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="{ 'rotate-180 text-[#1b3b5f]': activeDropdown === 'deliveryStatus' }" />
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
                  v-if="activeDropdown === 'deliveryStatus'"
                  class="dropdown-menu-deliveryStatus absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 max-h-52 overflow-y-auto divide-y divide-gray-50"
                >
                  <button
                    v-for="opt in deliveryStatusOptions"
                    :key="opt.value"
                    type="button"
                    @click.stop="selectOption('deliveryStatus', opt.value)"
                    class="w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer"
                    :class="deliveryStatus === opt.value ? 'bg-[#1b3b5f]/10 text-[#1b3b5f] font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                  >
                    <div class="flex items-center gap-2.5 truncate">
                      <span class="w-2 h-2 rounded-full shrink-0" :class="opt.dot" />
                      <span class="truncate">{{ opt.label }}</span>
                    </div>
                    <Check v-if="deliveryStatus === opt.value" class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0 ml-1.5" />
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-3.5 bg-gray-50/90 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0" @click="activeDropdown = null">
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
            class="px-4 py-2 bg-[#1b3b5f] text-white text-xs font-semibold rounded-xl hover:bg-[#1b3b5f]/90 transition-all shadow-sm cursor-pointer"
          >
            Show Results
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</div>
  </div>
</template>
