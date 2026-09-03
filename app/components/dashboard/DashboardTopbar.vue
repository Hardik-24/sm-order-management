<template>
  <header class="flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-6 transition-all duration-300">
    <!-- Title & Breadcrumb -->
    <div class="flex items-center gap-4">
      

      <div class="flex flex-col">
        <h1 class="text-xl font-semibold text-[#1a1a1a] capitalize">{{ pageTitle }}</h1>
        <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Silicon Marketing / Workspace</span>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="flex-1 max-w-xl mx-8 hidden md:block relative">
      <div class="relative flex items-center w-full h-10 rounded-lg border border-gray-300 bg-[#f9fafb] px-3 focus-within:border-[#4ecdc4] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#4ecdc4] transition-colors">
        <Search class="w-4 h-4 text-gray-400 shrink-0" />
        <input 
          type="text" 
          v-model="searchQuery"
          @keyup.enter="handleSearch"
          @keyup.esc="showSuggestions = false; $event.target.blur()"
          @blur="setTimeout(() => showSuggestions = false, 200)"
          @focus="showSuggestions = searchQuery.trim().length > 0"
          placeholder="Search by Order ID or Company Name..."
          class="w-full bg-transparent px-3 text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:outline-none"
        />
        <button 
          v-if="searchQuery"
          @click="searchQuery = ''; showSuggestions = false"
          class="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Suggestions Dropdown -->
      <div v-if="showSuggestions && searchQuery" class="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
        <div v-if="isLoadingSuggestions" class="px-4 py-3 text-sm text-gray-500 flex items-center justify-center">
          <div class="w-4 h-4 border-2 border-[#1a5c4c] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div v-else-if="suggestions.length === 0" class="px-4 py-3 text-sm text-gray-500 text-center">
          No results found for "{{ searchQuery }}"
        </div>
        <div v-else class="flex flex-col max-h-[300px] overflow-y-auto">
          <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">Orders</div>
          <button 
            v-for="order in suggestions" 
            :key="order.id"
            @click="selectSuggestion(order)"
            class="flex items-start flex-col px-4 py-2.5 hover:bg-[#f2fcf9] border-b border-gray-100 last:border-0 transition-colors text-left"
          >
            <div class="flex items-center justify-between w-full">
              <span class="text-sm font-semibold text-[#1a1a1a]">{{ order.orderNumber }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full" :class="order.overallStatus === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'">{{ order.overallStatus }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-0.5">{{ order.customer?.company || order.customer?.name || 'Unknown Customer' }}</div>
          </button>
        </div>
      </div>
    </div>

    <!-- User Section -->
    <div class="flex items-center gap-5">
      <!-- Profile -->
      <div class="flex items-center gap-3">
        <div class="flex flex-col text-right hidden sm:flex">
          <span class="text-sm font-semibold text-[#1a1a1a]">{{ user?.name || 'Hardik' }}</span>
          <span class="text-[10px] text-gray-500 uppercase font-medium tracking-wide">{{ user?.role === 'ADMIN' ? 'Administrator' : user?.role || 'Administrator' }}</span>
        </div>
        
        <div class="relative group cursor-pointer">
          <img :src="'https://ui-avatars.com/api/?name=' + (user?.name || 'Hardik') + '&background=1a5c4c&color=e8e0d4'" alt="Profile" class="h-10 w-10 rounded-full object-cover shadow-sm border border-gray-100 transition-transform group-hover:scale-105" />
          
          <!-- Standard Speech Bubble Tooltip -->
          <div class="absolute top-full mt-2 right-0 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50 origin-top-right scale-95 group-hover:scale-100 pointer-events-none whitespace-nowrap">
            <div class="relative bg-gray-900 text-white rounded-md px-3 py-1.5 text-xs font-medium shadow-lg">
              <!-- Tail -->
              <div class="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
              Hi, {{ user?.name || 'Hardik' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Menu, FileText, Package, User as UserIcon, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const isSidebarCollapsed = useState('sidebarCollapsed', () => false)
const isMobileMenuOpen = useState('mobileMenuOpen', () => false)

const searchQuery = ref('')
const suggestions = ref<any[]>([])
const isLoadingSuggestions = ref(false)
const showSuggestions = ref(false)

const fetchSuggestions = useDebounceFn(async () => {
  if (!searchQuery.value.trim()) {
    suggestions.value = []
    return
  }
  isLoadingSuggestions.value = true
  try {
    const res = await $fetch<any>('/api/orders', {
      query: { search: searchQuery.value.trim(), limit: 5 }
    })
    suggestions.value = res.orders || []
  } catch (err) {
    console.error(err)
  } finally {
    isLoadingSuggestions.value = false
  }
}, 300)

watch(searchQuery, () => {
  if (searchQuery.value.trim()) {
    showSuggestions.value = true
    fetchSuggestions()
  } else {
    suggestions.value = []
    showSuggestions.value = false
  }
})

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    router.push({ path: '/dashboard/orders', query: { search: searchQuery.value.trim() } })
    searchQuery.value = ''
    showSuggestions.value = false
  }
}

const selectSuggestion = (order: any) => {
  router.push({ path: '/dashboard/orders', query: { search: order.orderNumber } })
  searchQuery.value = ''
  showSuggestions.value = false
}

const pageTitle = computed(() => {
  const path = route.path.split('/').filter(Boolean)
  if (path.length <= 1) return 'Overview'
  
  if (path[1] === 'orders' && path[2] === 'create') return 'Create Order'
  
  return path[1].replace(/-/g, ' ')
})
</script>
