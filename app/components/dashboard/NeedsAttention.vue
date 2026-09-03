<script setup lang="ts">
import { ref } from 'vue'
import { FileText, Package, Truck, X } from 'lucide-vue-next'
import type { NeedsAttentionItem } from '~/types'

withDefaults(defineProps<{
  items?: NeedsAttentionItem[]
}>(), {
  items: () => []
})

const isModalOpen = ref(false)

const getIcon = (statusType: string | undefined) => {
  const s = (statusType || '').toLowerCase()
  if (s.includes('billing')) return FileText
  if (s.includes('packing') || s.includes('shortage')) return Package
  if (s.includes('delivery') || s.includes('ready')) return Truck
  return FileText
}

const getCircleClass = (statusType: string | undefined) => {
  const s = (statusType || '').toLowerCase()
  if (s.includes('billing') || s.includes('attention')) return 'bg-orange-50 text-orange-600'
  if (s.includes('shortage') || s.includes('error')) return 'bg-red-50 text-red-600'
  if (s.includes('delivery') || s.includes('ready')) return 'bg-green-50 text-green-600'
  return 'bg-gray-50 text-gray-600'
}

const getTextColorClass = (statusType: string | undefined) => {
  const s = (statusType || '').toLowerCase()
  if (s.includes('billing') || s.includes('attention')) return 'text-orange-600'
  if (s.includes('shortage') || s.includes('error')) return 'text-red-600'
  if (s.includes('delivery') || s.includes('ready')) return 'text-green-600'
  return 'text-gray-600'
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm h-full flex flex-col">
    <div class="flex items-center justify-between mb-6 flex-shrink-0">
      <h2 class="text-lg font-medium text-gray-900">Needs Attention</h2>
      <button @click="isModalOpen = true" class="text-sm text-[#1a5c4c] font-bold hover:text-[#1a5c4c]/80 transition-colors">
        View all ({{ items?.length || 0 }})
      </button>
    </div>

    <div class="space-y-3 flex-grow">
      <div v-if="!items?.length" class="text-sm text-gray-500">No items need attention.</div>
      <div 
        v-for="item in items.slice(0, 3)" 
        :key="item.id"
        class="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0"
      >
        <div :class="['w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', getCircleClass(item.statusText)]">
          <component :is="getIcon(item.statusText)" class="w-5 h-5" />
        </div>
        
        <div class="flex-grow min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 pr-2">
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate">{{ item.orderNumber }}</div>
            <div class="text-xs text-gray-500 truncate">{{ item.customerName }}</div>
          </div>
          
          <div class="flex-shrink-0 sm:text-right">
            <div :class="['text-[11px] font-bold uppercase tracking-wider', getTextColorClass(item.statusText)]">
              {{ item.statusText }}
            </div>
            <div v-if="item.timeAgo" :class="['text-[10px] font-medium mt-0.5', getTextColorClass(item.statusText)]">
              {{ item.timeAgo }}
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- All Alerts Modal -->
  <Teleport to="body">
    <div v-if="isModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="isModalOpen = false"></div>
      
      <!-- Modal Content -->
      <div class="relative bg-[#faf8f5] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] m-4 overflow-hidden transform transition-all">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <h2 class="text-lg font-bold text-gray-900">Needs Attention ({{ items.length }})</h2>
          <button @click="isModalOpen = false" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-1">
          <div v-if="!items?.length" class="text-sm text-gray-500 text-center py-8">
            No items need attention. Everything is running smoothly!
          </div>
          <div class="space-y-4">
            <div 
              v-for="item in items" 
              :key="item.id"
              class="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div class="flex items-center gap-4 flex-grow min-w-0">
                <div :class="['w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', getCircleClass(item.statusText)]">
                  <component :is="getIcon(item.statusText)" class="w-6 h-6" />
                </div>
                
                <div class="min-w-0">
                  <div class="text-sm font-bold text-gray-900 truncate">{{ item.orderNumber }}</div>
                  <div class="text-xs text-gray-500 truncate mt-0.5">{{ item.customerName }}</div>
                </div>
              </div>
              
              <div class="flex-shrink-0 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 sm:text-right min-w-[140px]">
                <div :class="['text-[11px] font-bold uppercase tracking-wider', getTextColorClass(item.statusText)]">
                  {{ item.statusText }}
                </div>
                <div v-if="item.timeAgo" :class="['text-[10px] font-medium mt-1 flex items-center sm:justify-end gap-1.5', getTextColorClass(item.statusText)]">
                  <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  {{ item.timeAgo }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
