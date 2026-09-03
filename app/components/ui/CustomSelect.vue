<template>
  <div class="relative" :class="isOpen ? 'z-50' : 'z-10'">
    <!-- Trigger -->
    <div 
      @click="toggleOpen"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] text-sm bg-white text-gray-700 cursor-pointer flex items-center justify-between transition-colors hover:bg-gray-50"
    >
      <span class="block w-full text-left line-clamp-2" :title="displayLabel">{{ displayLabel }}</span>
      <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 ml-2" />
    </div>

    <!-- Backdrop -->
    <div v-if="isOpen" @click.stop="isOpen = false" class="fixed inset-0 z-40"></div>

    <!-- Dropdown -->
    <div v-if="isOpen" class="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
      <div v-if="searchable" class="p-2 border-b border-gray-100 bg-gray-50">
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input 
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] bg-white"
            @click.stop
            @keydown.down.prevent="handleKeydown('down')"
            @keydown.up.prevent="handleKeydown('up')"
            @keydown.enter.prevent="selectFocused"
          />
        </div>
      </div>
      <div v-else tabindex="0" ref="hiddenFocus" class="sr-only" 
        @keydown.down.prevent="handleKeydown('down')"
        @keydown.up.prevent="handleKeydown('up')"
        @keydown.enter.prevent="selectFocused"
      ></div>
      <ul ref="listRef" class="max-h-64 overflow-y-auto p-1" @scroll="onScroll">
        <li 
          v-for="(option, index) in filteredOptions" 
          :key="index"
          @click="selectOption(option.value)"
          class="px-3 py-2 text-sm rounded cursor-pointer flex flex-col justify-center"
          :class="{
            'text-[#1a5c4c] font-medium bg-[#1a5c4c]/5': modelValue === option.value,
            'bg-gray-100': focusedIndex === index && modelValue !== option.value,
            'hover:bg-gray-100': focusedIndex !== index
          }"
          @mouseenter="onMouseEnter($event, option, index)"
          @mouseleave="onMouseLeave"
        >
          <div class="flex items-center justify-between w-full min-w-0">
            <span class="truncate">{{ option.label }}</span>
            <Check v-if="modelValue === option.value" class="w-4 h-4 shrink-0 ml-2" />
          </div>
          <span v-if="option.subtitle" class="text-[10px] text-gray-400 text-right mt-0.5 truncate">{{ option.subtitle }}</span>
        </li>
        <li v-if="filteredOptions.length === 0" class="px-3 py-4 text-sm text-center text-gray-500">
          No options found.
        </li>
      </ul>
    </div>

    <!-- Custom Floating Tooltip -->
    <Teleport to="body">
      <div 
        v-if="hoveredOption"
        class="fixed z-[300] bg-gray-900 text-white rounded-md px-3 py-2 text-xs font-medium shadow-lg pointer-events-none whitespace-normal max-w-sm"
        :style="{ 
          top: tooltipY + 'px', 
          left: tooltipX + 'px',
          transform: isTooltipFlipped ? 'translateY(-100%)' : 'none'
        }"
      >
        <!-- Tail -->
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
      tooltipX.value = rect.left + 16
      
      // If the tooltip would go off the bottom of the screen (assuming max 80px height), flip it above!
      if (rect.bottom + 80 > window.innerHeight) {
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
    hoveredOption.value = null // Hide tooltip while scrolling to prevent detaching
  }
}

const toggleOpen = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    hoveredOption.value = null
    focusedIndex.value = props.options.findIndex(o => o.value === props.modelValue)
    if (focusedIndex.value === -1) focusedIndex.value = 0
    nextTick(() => {
      if (props.searchable && searchInput.value) {
        searchInput.value.focus()
      } else if (hiddenFocus.value) {
        hiddenFocus.value.focus()
      }
      scrollToFocused()
    })
  } else {
    hoveredOption.value = null
  }
}

watch(isOpen, (newVal) => {
  if (!newVal) {
    hoveredOption.value = null
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

// Add global keydown listener when open for non-searchable dropdowns
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value || props.searchable) return
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
  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })
}
</script>

