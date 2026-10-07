<template>
  <div ref="containerRef" class="relative">
    <!-- Trigger -->
    <div 
      @click="toggleOpen"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] text-sm bg-white text-gray-700 cursor-pointer flex items-center justify-between transition-colors hover:bg-gray-50 select-none"
    >
      <span class="block w-full text-left line-clamp-2" :title="displayLabel">{{ displayLabel }}</span>
      <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
    </div>

    <!-- Teleported Floating Dropdown & Backdrop -->
    <Teleport to="body">
      <!-- Backdrop with smooth fade -->
      <transition
        enter-active-class="transition-opacity duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="isOpen" 
          @click.stop="isOpen = false" 
          class="fixed inset-0 z-[99998]"
        ></div>
      </transition>

      <!-- Dropdown Menu with Hardware Accelerated Scale/Fade -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div 
          v-if="isOpen" 
          ref="dropdownRef"
          class="fixed bg-white border border-gray-200 rounded-xl shadow-2xl z-[99999] overflow-hidden flex flex-col will-change-transform"
          :class="isFlippedUp ? 'origin-bottom' : 'origin-top'"
          :style="dropdownStyle"
          @click.stop
        >
          <!-- Search Bar (Shrink-0 ensures it is ALWAYS visible and never hidden) -->
          <div v-if="searchable" class="p-2 border-b border-gray-100 bg-gray-50 shrink-0">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input 
                ref="searchInput"
                v-model="searchQuery"
                type="text"
                :placeholder="searchPlaceholder"
                class="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] bg-white text-gray-900"
                @click.stop
              />
            </div>
          </div>
          <div v-else tabindex="0" ref="hiddenFocus" class="sr-only"></div>

        <!-- Scrollable Option List -->
        <ul ref="listRef" class="overflow-y-auto p-1 flex-1 min-h-0 divide-y divide-gray-50" @scroll="onScroll">
          <li 
            v-for="(option, index) in filteredOptions" 
            :key="index"
            @click="selectOption(option.value)"
            class="px-3 py-2 text-sm rounded-lg cursor-pointer flex flex-col justify-center transition-colors"
            :class="{
              'text-[#1a5c4c] font-semibold bg-[#1a5c4c]/5': modelValue === option.value,
              'bg-gray-100': focusedIndex === index && modelValue !== option.value,
              'hover:bg-gray-50': focusedIndex !== index
            }"
            @mouseenter="onMouseEnter($event, option, index)"
            @mouseleave="onMouseLeave"
          >
            <div class="flex items-center justify-between w-full min-w-0">
              <span class="truncate">{{ option.label }}</span>
              <Check v-if="modelValue === option.value" class="w-4 h-4 shrink-0 ml-2 text-[#1a5c4c]" />
            </div>
            <span v-if="option.subtitle" class="text-[10px] text-gray-400 text-right mt-0.5 truncate">{{ option.subtitle }}</span>
          </li>
          <li v-if="filteredOptions.length === 0" class="px-3 py-4 text-sm text-center text-gray-500">
            No options found.
          </li>
        </ul>
      </div>
    </transition>

    <!-- Custom Floating Tooltip -->
      <div 
        v-if="hoveredOption"
        class="fixed z-[100000] bg-gray-900 text-white rounded-md px-3 py-2 text-xs font-medium shadow-lg pointer-events-none whitespace-normal max-w-sm"
        :style="{ 
          top: tooltipY + 'px', 
          left: tooltipX + 'px',
          transform: isTooltipFlipped ? 'translateY(-100%)' : 'none'
        }"
      >
        <div class="absolute left-4 w-2 h-2 bg-gray-900 rotate-45"
             :class="isTooltipFlipped ? '-bottom-1' : '-top-1'"></div>
        <div>{{ hoveredOption.label }}</div>
        <div v-if="hoveredOption.subtitle" class="text-gray-400 text-[10px] mt-1">{{ hoveredOption.subtitle }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { ChevronDown, Search, Check } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: any
  options: { label: string; value: any; subtitle?: string }[]
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchQuery = ref('')
const focusedIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)
const hiddenFocus = ref<HTMLElement | null>(null)
const listRef = ref<HTMLUListElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const dropdownStyle = ref<Record<string, string>>({})

const displayLabel = computed(() => {
  const selected = props.options.find(o => o.value === props.modelValue)
  return selected ? selected.label : (props.placeholder || 'Select...')
})

const filteredOptions = computed(() => {
  if (!props.searchable || !searchQuery.value) return props.options
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.options
  
  const terms = q.split(/\s+/).filter(Boolean)
  return props.options.filter(o => {
    const text = `${o.label || ''} ${o.subtitle || ''}`.toLowerCase()
    return terms.every(term => text.includes(term))
  })
})

const hoveredOption = ref<{ label: string; value: any; subtitle?: string } | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
const isTooltipFlipped = ref(false)
const isKeyboardScroll = ref(false)
let keyboardScrollTimer: any = null

const updateTooltipPosition = () => {
  if (listRef.value && focusedIndex.value >= 0 && focusedIndex.value < filteredOptions.value.length) {
    const li = listRef.value.children[focusedIndex.value] as HTMLElement
    if (li) {
      const rect = li.getBoundingClientRect()
      tooltipX.value = Math.max(12, Math.min(rect.left + 16, (typeof window !== 'undefined' ? window.innerWidth : 800) - 280))
      
      if (rect.bottom + 80 > (typeof window !== 'undefined' ? window.innerHeight : 600)) {
        isTooltipFlipped.value = true
        tooltipY.value = rect.top - 6
      } else {
        isTooltipFlipped.value = false
        tooltipY.value = rect.bottom + 6
      }
      
      hoveredOption.value = filteredOptions.value[focusedIndex.value]
    }
  }
}

const onMouseEnter = (e: MouseEvent, option: any, index: number) => {
  focusedIndex.value = index
  hoveredOption.value = option
  updateTooltipPosition()
}

const onMouseLeave = () => {
  hoveredOption.value = null
}

const onScroll = () => {
  if (isKeyboardScroll.value) {
    updateTooltipPosition()
  } else {
    hoveredOption.value = null
  }
}

const scrollToFocused = () => {
  if (listRef.value && listRef.value.children[focusedIndex.value]) {
    const li = listRef.value.children[focusedIndex.value] as HTMLElement
    if (li && li.scrollIntoView) {
      li.scrollIntoView({ block: 'nearest' })
    }
  }
}

const isFlippedUp = ref(false)

const updatePosition = (force = false) => {
  if ((!isOpen.value && !force) || !containerRef.value || typeof window === 'undefined') return
  const rect = containerRef.value.getBoundingClientRect()

  // If the select trigger is completely scrolled offscreen, close it
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    isOpen.value = false
    return
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Width calculation: minimum 260px if searchable, but never wider than viewport minus margin
  let width = rect.width
  if (props.searchable && width < 260) {
    width = Math.min(300, viewportWidth - 16)
  }
  width = Math.max(160, Math.min(width, viewportWidth - 16))

  // Safe horizontal positioning (8px margin from edges)
  let left = rect.left
  if (left + width > viewportWidth - 8) {
    left = viewportWidth - width - 8
  }
  if (left < 8) {
    left = 8
  }

  // Safe vertical positioning
  const spaceBelow = viewportHeight - rect.bottom - 12
  const spaceAbove = rect.top - 12

  // Open upward only if space below is really restricted (< 220px) AND above has more space
  const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow
  isFlippedUp.value = flipUp
  
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    zIndex: '99999',
  }

  if (flipUp) {
    const maxHeight = Math.max(160, Math.min(spaceAbove, 320))
    style.bottom = `${Math.round(viewportHeight - rect.top + 4)}px`
    style.maxHeight = `${Math.round(maxHeight)}px`
  } else {
    const maxHeight = Math.max(160, Math.min(spaceBelow, 320))
    style.top = `${Math.round(rect.bottom + 4)}px`
    style.maxHeight = `${Math.round(maxHeight)}px`
  }

  dropdownStyle.value = style
}

const toggleOpen = () => {
  if (!isOpen.value) {
    searchQuery.value = ''
    hoveredOption.value = null
    focusedIndex.value = props.options.findIndex(o => o.value === props.modelValue)
    if (focusedIndex.value === -1) focusedIndex.value = 0

    // Synchronously calculate exact coordinates BEFORE showing dropdown (zero lag/jump)
    updatePosition(true)
    isOpen.value = true

    nextTick(() => {
      if (props.searchable && searchInput.value) {
        searchInput.value.focus()
      } else if (hiddenFocus.value) {
        hiddenFocus.value.focus()
      }
      scrollToFocused()
    })
  } else {
    isOpen.value = false
    hoveredOption.value = null
  }
}

const onWindowScroll = () => updatePosition()
const onWindowResize = () => updatePosition()

watch(isOpen, (newVal) => {
  if (newVal) {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', onWindowScroll, true)
      window.addEventListener('resize', onWindowResize)
    }
  } else {
    hoveredOption.value = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', onWindowScroll, true)
      window.removeEventListener('resize', onWindowResize)
    }
  }
})

const handleKeydown = (direction: 'up' | 'down') => {
  if (direction === 'down') {
    focusedIndex.value = Math.min(filteredOptions.value.length - 1, focusedIndex.value + 1)
  } else {
    focusedIndex.value = Math.max(0, focusedIndex.value - 1)
  }
  
  isKeyboardScroll.value = true
  clearTimeout(keyboardScrollTimer)
  keyboardScrollTimer = setTimeout(() => { isKeyboardScroll.value = false }, 200)

  nextTick(() => {
    if (listRef.value) {
      const li = listRef.value.children[focusedIndex.value] as HTMLElement
      if (li && li.scrollIntoView) {
        li.scrollIntoView({ block: 'nearest' })
      }
      updateTooltipPosition()
    }
  })
}

const selectFocused = () => {
  const opt = filteredOptions.value[focusedIndex.value]
  if (opt) {
    selectOption(opt.value)
  }
}

const selectOption = (val: any) => {
  emit('update:modelValue', val)
  isOpen.value = false
}

watch(searchQuery, () => {
  focusedIndex.value = 0
})

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    handleKeydown('down')
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    handleKeydown('up')
  } else if (e.key === 'Enter') {
    e.preventDefault()
    selectFocused()
  } else if (e.key === 'Escape') {
    isOpen.value = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleGlobalKeydown)
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
    window.removeEventListener('scroll', onWindowScroll, true)
    window.removeEventListener('resize', onWindowResize)
  }
})
</script>

