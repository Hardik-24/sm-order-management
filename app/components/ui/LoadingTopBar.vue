<template>
  <div 
    v-if="loading" 
    class="absolute top-0 left-0 right-0 h-[2.5px] bg-[#1b3b5f]/15 overflow-hidden z-20 pointer-events-none rounded-t-xl"
  >
    <div class="h-full bg-gradient-to-r from-[#1b3b5f] via-[#4ecdc4] to-[#1b3b5f] absolute animate-indeterminate"></div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
}>(), {
  loading: false
})
</script>
