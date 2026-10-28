<template>
  <tbody v-if="!isMobileOnly" class="divide-y divide-gray-100 bg-white">
    <tr v-for="r in rows" :key="'skel-row-' + r" class="pointer-events-none">
      <td 
        v-for="c in cols" 
        :key="'skel-col-' + c"
        :class="[
          'px-5 py-4',
          c === 1 ? 'w-[20%]' : (c === cols ? 'text-right' : '')
        ]"
      >
        <div 
          class="h-4 rounded-md animate-shimmer"
          :style="{
            width: getCellWidth(c, r)
          }"
        ></div>
        <div 
          v-if="hasSublines && (c === 1 || c === 2)" 
          class="h-2.5 rounded-md animate-shimmer mt-2"
          :style="{
            width: getSublineWidth(c, r)
          }"
        ></div>
      </td>
    </tr>
  </tbody>

  <!-- Mobile Card Skeleton List -->
  <div v-if="renderMobile" class="divide-y divide-gray-100 bg-white md:hidden">
    <div v-for="m in rows" :key="'skel-mob-' + m" class="p-4 space-y-2 pointer-events-none">
      <div class="flex items-center justify-between">
        <div class="h-4 w-28 rounded-md animate-shimmer"></div>
        <div class="h-4 w-16 rounded-full animate-shimmer"></div>
      </div>
      <div class="h-3.5 w-44 rounded-md animate-shimmer"></div>
      <div class="flex items-center gap-2 pt-1">
        <div class="h-3 w-16 rounded animate-shimmer"></div>
        <div class="h-3 w-20 rounded animate-shimmer"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  rows?: number
  cols?: number
  hasSublines?: boolean
  isMobileOnly?: boolean
  renderMobile?: boolean
}>(), {
  rows: 5,
  cols: 6,
  hasSublines: true,
  isMobileOnly: false,
  renderMobile: false
})

const widthsByCol = [
  ['65%', '75%', '55%', '80%', '60%'],
  ['85%', '70%', '90%', '65%', '80%'],
  ['45%', '50%', '40%', '55%', '45%'],
  ['70%', '85%', '60%', '75%', '65%'],
  ['55%', '60%', '50%', '45%', '60%'],
  ['35%', '40%', '30%', '45%', '35%']
]

const getCellWidth = (col: number, row: number) => {
  const colIdx = Math.min(col - 1, widthsByCol.length - 1)
  const rowIdx = (row - 1) % 5
  return widthsByCol[colIdx][rowIdx] || '60%'
}

const getSublineWidth = (col: number, row: number) => {
  return ((row % 2 === 0) ? '40%' : '50%')
}
</script>
