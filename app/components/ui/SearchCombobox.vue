<template>
  <div ref="containerRef" class="relative w-full">
    <!-- The Unified Combobox Input Field -->
    <div 
      class="group relative flex items-center w-full transition-all duration-150 rounded-xl border bg-slate-50/70 hover:bg-slate-50 focus-within:bg-white"
      :class="[
        isOpen 
          ? 'border-[#1b3b5f] ring-2 ring-[#1b3b5f]/15 shadow-sm' 
          : 'border-slate-200/90 hover:border-slate-300 shadow-2xs',
        disabled ? 'opacity-60 bg-gray-100 cursor-not-allowed' : ''
      ]"
    >
      <!-- Left Search / Brand Icon -->
      <div class="pl-3 pr-1.5 flex items-center justify-center text-slate-400 group-focus-within:text-[#1b3b5f] pointer-events-none shrink-0 transition-colors">
        <component :is="iconComponent" class="w-4 h-4" />
      </div>

      <!-- Live Text Input (Tap to type immediately!) -->
      <input
        ref="inputRef"
        type="text"
        :value="isEditing ? searchQuery : displayLabel"
        @focus="onFocus"
        @input="onInput"
        @keydown.down.prevent="onKeyDown"
        @keydown.up.prevent="onKeyUp"
        @keydown.enter.prevent="onKeyEnter"
        @keydown.esc.prevent="closeDropdown"
        :placeholder="displayLabel || placeholder"
        :disabled="disabled"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        class="w-full py-2.5 pr-8 bg-transparent text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none truncate tracking-tight"
      />

      <!-- Right Action Icons: Clear (X) or Dropdown Arrow -->
      <div class="pr-2.5 flex items-center gap-1 shrink-0">
        <!-- Clear button when a selection or search text exists -->
        <button
          v-if="(modelValue || searchQuery) && !disabled"
          type="button"
          tabindex="-1"
          @click.stop="clearSelection"
          class="w-5 h-5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          title="Clear search"
        >
          <X class="w-3.5 h-3.5" />
        </button>

        <!-- Dropdown toggle arrow -->
        <button
          type="button"
          tabindex="-1"
          @click.stop="toggleDropdown"
          class="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-transform duration-150 cursor-pointer"
          :class="{ 'rotate-180': isOpen }"
        >
          <ChevronDown class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Teleported Floating Dropdown Menu -->
    <Teleport to="body">
      <!-- Backdrop to close on tap outside -->
      <div 
        v-if="isOpen" 
        @click="closeDropdown" 
        class="fixed inset-0 z-[99998]"
      ></div>

      <!-- Dropdown Results Window -->
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="fixed bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-[99999] overflow-hidden flex flex-col will-change-transform animate-in fade-in zoom-in-95 duration-100"
        :style="dropdownStyle"
        @click.stop
      >
        <!-- Top Status Bar in Menu -->
        <div class="px-3.5 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-[#1b3b5f]"></span>
            <span>{{ filteredOptions.length }} matching results</span>
          </span>
          <span v-if="searchQuery" class="text-slate-500 lowercase font-normal italic truncate max-w-[140px]">for "{{ searchQuery }}"</span>
        </div>

        <!-- Scrollable Option Items -->
        <ul ref="listRef" class="overflow-y-auto p-1.5 flex-1 divide-y divide-slate-50 overscroll-contain">
          <li
            v-for="(option, index) in filteredOptions"
            :key="option.value"
            @click="selectOption(option)"
            class="p-2.5 rounded-xl cursor-pointer flex flex-col justify-center transition-all duration-100"
            :class="{
              'bg-[#1b3b5f]/10 text-[#1b3b5f] font-bold border-l-4 border-l-[#1b3b5f]': String(modelValue) === String(option.value),
              'bg-slate-100 text-slate-900': focusedIndex === index && String(modelValue) !== String(option.value),
              'hover:bg-slate-50 text-slate-800': focusedIndex !== index && String(modelValue) !== String(option.value)
            }"
            @mouseenter="focusedIndex = index"
          >
            <!-- Line 1: Primary Label & Badges -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span class="text-xs sm:text-sm font-extrabold tracking-tight truncate leading-snug">
                  {{ option.label }}
                </span>
                
                <!-- SKU / Code pill -->
                <span 
                  v-if="option.sku && option.sku !== option.label"
                  class="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {{ option.sku }}
                </span>

                <!-- Tier / Custom Badge -->
                <span 
                  v-if="option.badge"
                  class="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider"
                  :class="option.badgeClass || 'bg-amber-100 text-amber-900 border border-amber-300'"
                >
                  {{ option.badge }}
                </span>

                <!-- Not in Busy badge -->
                <span 
                  v-if="option.isBusySynced === false"
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300"
                >
                  Not in Busy
                </span>
              </div>

              <!-- Checkmark on current selection -->
              <Check v-if="String(modelValue) === String(option.value)" class="w-4 h-4 text-[#1b3b5f] shrink-0 ml-1" />
            </div>

            <!-- Line 2: Secondary info (Stock, Location, Category, Phone) -->
            <div 
              v-if="option.subtitle || option.stock !== undefined || option.city || option.phone" 
              class="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap"
            >
              <!-- Live Stock Badge (if item) -->
              <span 
                v-if="option.stock !== undefined"
                class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded border"
                :class="[
                  Number(option.stock) <= 0 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : Number(option.stock) < 10 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                ]"
              >
                <span 
                  class="w-1.5 h-1.5 rounded-full"
                  :class="[
                    Number(option.stock) <= 0 
                      ? 'bg-rose-500' 
                      : Number(option.stock) < 10 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500'
                  ]"
                ></span>
                <span>{{ option.stock }} {{ option.unit || 'units' }}</span>
              </span>

              <!-- City / Location -->
              <span v-if="option.city" class="flex items-center gap-0.5 font-semibold text-slate-600">
                <MapPin class="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span>{{ option.city }}</span>
              </span>

              <!-- Phone -->
              <span v-if="option.phone" class="font-mono text-slate-500">
                {{ option.phone }}
              </span>

              <!-- Category / Subtitle -->
              <span v-if="option.subtitle" class="text-slate-400 truncate">
                {{ option.subtitle }}
              </span>
            </div>
          </li>

          <!-- Empty match message -->
          <li v-if="filteredOptions.length === 0" class="py-6 px-4 text-center">
            <p class="text-xs font-bold text-slate-700">No matching results found</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Try searching with a different name, code, or keyword.</p>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Search, X, ChevronDown, Check, MapPin } from 'lucide-vue-next'

export interface ComboboxOption {
  value: string | number
  label: string
  subtitle?: string
  sku?: string
  stock?: number
  unit?: string
  city?: string
  phone?: string
  badge?: string
  badgeClass?: string
  isBusySynced?: boolean
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    options: ComboboxOption[]
    placeholder?: string
    disabled?: boolean
    icon?: any
  }>(),
  {
    modelValue: '',
    options: () => [],
    placeholder: 'Search...',
    disabled: false,
    icon: null
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'select', option: ComboboxOption | null): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const isOpen = ref(false)
const isEditing = ref(false)
const searchQuery = ref('')
const focusedIndex = ref(0)
const isFlippedUp = ref(false)
const dropdownStyle = ref<Record<string, string>>({})

const iconComponent = computed(() => props.icon || Search)

// Label for current selected value
const selectedOption = computed(() => {
  if (props.modelValue === undefined || props.modelValue === null || props.modelValue === '') return null
  return props.options.find(opt => String(opt.value) === String(props.modelValue)) || null
})

const displayLabel = computed(() => {
  return selectedOption.value ? selectedOption.value.label : ''
})

// Filtered options based on user typing
const filteredOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.options.slice(0, 80) // Return top 80 options for super fast DOM rendering
  }

  const terms = query.split(/\s+/).filter(Boolean)
  const matches: ComboboxOption[] = []

  for (const opt of props.options) {
    const searchableString = [
      opt.label,
      opt.sku,
      opt.subtitle,
      opt.city,
      opt.phone,
      opt.badge
    ].filter(Boolean).join(' ').toLowerCase()

    const allMatch = terms.every(term => searchableString.includes(term))
    if (allMatch) {
      matches.push(opt)
      if (matches.length >= 80) break // limit 80 for silky 60fps performance
    }
  }

  return matches
})

// Calculate exact fixed position for Teleported menu
const updatePosition = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  const menuHeight = Math.min(320, Math.max(160, filteredOptions.value.length * 54 + 40))

  const shouldFlip = spaceBelow < menuHeight && spaceAbove > spaceBelow
  isFlippedUp.value = shouldFlip

  const width = Math.min(rect.width, viewportWidth - 20)
  const left = Math.min(Math.max(10, rect.left), viewportWidth - width - 10)

  const availableHeight = shouldFlip ? spaceAbove - 12 : spaceBelow - 12
  const finalMaxHeight = Math.min(320, Math.max(120, availableHeight))
  const finalTop = shouldFlip 
    ? Math.max(10, rect.top - Math.min(menuHeight, finalMaxHeight) - 6) 
    : (rect.bottom + 6)

  dropdownStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${finalMaxHeight}px`,
    top: `${finalTop}px`
  }
}

const openDropdown = () => {
  if (props.disabled) return
  isOpen.value = true
  updatePosition()
  nextTick(() => {
    updatePosition()
  })
}

const closeDropdown = () => {
  isOpen.value = false
  isEditing.value = false
  searchQuery.value = ''
  focusedIndex.value = 0
}

const toggleDropdown = () => {
  if (props.disabled) return
  if (isOpen.value) {
    closeDropdown()
  } else {
    isEditing.value = true
    searchQuery.value = ''
    openDropdown()
    inputRef.value?.focus()
  }
}

const onFocus = () => {
  if (props.disabled) return
  isEditing.value = true
  searchQuery.value = ''
  focusedIndex.value = 0
  openDropdown()
}

const onInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  searchQuery.value = val
  isEditing.value = true
  focusedIndex.value = 0
  if (!isOpen.value) {
    openDropdown()
  } else {
    nextTick(updatePosition)
  }
}

const selectOption = (opt: ComboboxOption) => {
  emit('update:modelValue', String(opt.value))
  emit('select', opt)
  closeDropdown()
}

const clearSelection = () => {
  emit('update:modelValue', '')
  emit('select', null)
  searchQuery.value = ''
  isEditing.value = true
  inputRef.value?.focus()
  openDropdown()
}

// Keyboard handling
const onKeyDown = () => {
  if (!isOpen.value) {
    openDropdown()
    return
  }
  if (focusedIndex.value < filteredOptions.value.length - 1) {
    focusedIndex.value++
    scrollFocusedIntoView()
  }
}

const onKeyUp = () => {
  if (!isOpen.value) {
    openDropdown()
    return
  }
  if (focusedIndex.value > 0) {
    focusedIndex.value--
    scrollFocusedIntoView()
  }
}

const onKeyEnter = () => {
  if (isOpen.value && filteredOptions.value[focusedIndex.value]) {
    selectOption(filteredOptions.value[focusedIndex.value])
  } else if (!isOpen.value) {
    openDropdown()
  }
}

const scrollFocusedIntoView = () => {
  nextTick(() => {
    if (!listRef.value) return
    const el = listRef.value.children[focusedIndex.value] as HTMLElement
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Watch scroll/resize to update dropdown position
const onScrollOrResize = () => {
  if (isOpen.value) {
    updatePosition()
  }
}

onMounted(() => {
  window.addEventListener('resize', onScrollOrResize)
  window.addEventListener('scroll', onScrollOrResize, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('scroll', onScrollOrResize, true)
})
</script>
