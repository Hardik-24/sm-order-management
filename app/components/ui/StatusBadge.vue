<script setup lang="ts">
import { computed } from 'vue'
import { getStatusColor, formatStatus } from '~/lib/utils'

const props = withDefaults(defineProps<{
  status: string
  display?: string
  size?: 'sm' | 'md'
}>(), {
  size: 'sm'
})

const displayStatus = computed(() => {
  if (props.display) return props.display
  if (!props.status || typeof props.status !== 'string') return ''
  return formatStatus(props.status)
})

const colorClass = computed(() => getStatusColor(props.status))
</script>

<template>
  <span 
    :class="[
      'inline-flex items-center justify-center whitespace-nowrap text-center rounded-full font-medium status-badge',
      size === 'sm' ? 'px-2.5 py-0.5 text-[10px] sm:text-xs' : 'px-3 py-1 text-sm',
      colorClass
    ]"
  >
    {{ displayStatus }}
  </span>
</template>
