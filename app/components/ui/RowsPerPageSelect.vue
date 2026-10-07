<template>
  <div class="relative inline-block text-left select-none">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg shadow-xs hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-1 focus:ring-[#1a5c4c]"
    >
      <span>{{ currentLabel }}</span>
      <ChevronDown class="w-3.5 h-3.5 text-gray-400 transition-transform duration-150" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Overlay Backdrop -->
    <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 z-[90]"></div>

    <!-- Dropdown Menu -->
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div 
        v-if="isOpen" 
        class="absolute right-0 top-full mt-1.5 min-w-[110px] bg-white border border-gray-200 rounded-xl shadow-2xl z-[100] p-1 divide-y divide-gray-50"
      >
        <button
          v-for="opt in formattedOptions"
          :key="opt.value"
          type="button"
          @click="select(opt.value)"
          class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between transition-colors"
          :class="modelValue === opt.value ? 'bg-[#1a5c4c]/10 text-[#1a5c4c] font-bold' : 'text-gray-700 hover:bg-gray-100 font-medium'"
        >
          <span>{{ opt.label }}</span>
          <Check v-if="modelValue === opt.value" class="w-3.5 h-3.5 text-[#1a5c4c] shrink-0 ml-1.5" />
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: number
  options?: Array<number | { label: string; value: number }>
  direction?: 'up' | 'down'
}>(), {
  options: () => [10, 20, 50, -1],
  direction: 'down'
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)

const formattedOptions = computed(() => {
  return props.options.map(opt => {
    if (typeof opt === 'number') {
      return {
        label: opt === -1 ? 'Unlimited' : `${opt} / page`,
        value: opt
      }
    }
    return opt
  })
})

const currentLabel = computed(() => {
  const found = formattedOptions.value.find(o => o.value === props.modelValue)
  if (found) return found.label
  return props.modelValue === -1 ? 'Unlimited' : `${props.modelValue} / page`
})

const select = (val: number) => {
  emit('update:modelValue', val)
  isOpen.value = false
}
</script>