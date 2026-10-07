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
      <!-- Notifications -->
      <div class="relative" ref="notificationContainer">
        <button 
          @click="toggleNotifications"
          class="relative p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
          title="Notifications"
        >
          <Bell class="w-5 h-5" />
          <span 
            v-if="unreadCount > 0" 
            class="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold shadow-sm ring-2 ring-white"
          >
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span class="relative">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
          </span>
        </button>

        <!-- Notification Dropdown -->
        <div 
          v-if="showNotifications" 
          class="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 origin-top-right transition-all"
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 class="text-sm font-semibold text-[#1a1a1a]">Notifications</h3>
            <span v-if="unreadCount > 0" class="text-xs text-gray-500">{{ unreadCount }} unread</span>
          </div>
          
          <div class="max-h-[320px] overflow-y-auto">
            <div v-if="isLoadingNotifications" class="p-4 text-center text-sm text-gray-500">
              Loading...
            </div>
            <div v-else-if="notifications.length === 0" class="p-4 text-center text-sm text-gray-500">
              No recent notifications
            </div>
            <div 
              v-else 
              v-for="notif in notifications" 
              :key="notif.id"
              @click="handleNotificationClick(notif)"
              class="flex flex-col px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-[#f2fcf9] cursor-pointer transition-colors"
            >
              <div class="flex items-start gap-3">
                <img :src="notif.performedBy?.avatar || 'https://ui-avatars.com/api/?name=' + (notif.performedBy?.name || 'User') + '&background=1a5c4c&color=e8e0d4'" class="w-8 h-8 rounded-full flex-shrink-0" />
                <div class="flex flex-col">
                  <span class="text-sm text-[#1a1a1a] leading-tight">
                    <span class="font-semibold">{{ notif.performedBy?.name || 'Someone' }}</span> 
                    {{ formatNotificationDesc(notif) }}
                  </span>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-semibold text-[#1a5c4c]" v-if="notif.order?.orderNumber">{{ notif.order.orderNumber }}</span>
                    <span class="text-[10px] text-gray-400">{{ formatTimeAgo(new Date(notif.timestamp)) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Menu, FileText, Package, User as UserIcon, X, Bell } from 'lucide-vue-next'
import { useDebounceFn, onClickOutside } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const isSidebarCollapsed = useState('sidebarCollapsed', () => false)
const isMobileMenuOpen = useState('mobileMenuOpen', () => false)

// Notifications State
const showNotifications = ref(false)
const isLoadingNotifications = ref(false)
const notifications = ref<any[]>([])
const unreadCount = ref(0)
const lastSeenTimestamp = ref<number>(0)
const notificationContainer = ref(null)

// Initialize last seen from localStorage on client
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('sm_notifications_last_seen')
  if (stored) {
    lastSeenTimestamp.value = parseInt(stored, 10) || 0
  }
}

onClickOutside(notificationContainer, () => {
  if (showNotifications.value) {
    showNotifications.value = false
  }
})

const calculateUnreadCount = () => {
  if (!lastSeenTimestamp.value) {
    unreadCount.value = Math.min(notifications.value.length, 5)
    return
  }
  const unread = notifications.value.filter(n => new Date(n.timestamp).getTime() > lastSeenTimestamp.value)
  unreadCount.value = unread.length
}

const fetchNotifications = async (silent = false) => {
  try {
    if (!silent) isLoadingNotifications.value = true
    const res = await $fetch<any>('/api/notifications', {
      params: { _t: Date.now() }
    })
    if (res && res.notifications) {
      notifications.value = res.notifications
      if (!showNotifications.value) {
        calculateUnreadCount()
      }
    }
  } catch (error) {
    console.error('Failed to fetch notifications', error)
  } finally {
    if (!silent) isLoadingNotifications.value = false
  }
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    unreadCount.value = 0
    if (notifications.value.length > 0) {
      lastSeenTimestamp.value = new Date(notifications.value[0].timestamp).getTime()
    } else {
      lastSeenTimestamp.value = Date.now()
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('sm_notifications_last_seen', String(lastSeenTimestamp.value))
    }
  }
}

const formatNotificationDesc = (notif: any) => {
  if (!notif.description) return notif.action
  const name = notif.performedBy?.name || ''
  let desc = notif.description
  if (name && desc.startsWith(name)) {
    desc = desc.substring(name.length).trim()
  }
  return desc
}

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 10) return "just now"
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + "y ago"
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + "mo ago"
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + "d ago"
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + "h ago"
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + "m ago"
  return `${seconds}s ago`
}

const handleNotificationClick = (notif: any) => {
  showNotifications.value = false
  if (notif.order?.orderNumber) {
    router.push({ path: '/dashboard/orders', query: { search: notif.order.orderNumber } })
  }
}

// Subscribe to Realtime Sync via Supabase WebSocket + Local BroadcastChannel
const { onOrderSync } = useRealtimeSync()
const unsubscribeSync = onOrderSync((event) => {
  // Instantly refresh notifications list whenever any order timeline or status updates across all connected devices
  fetchNotifications(true)
})

onMounted(() => {
  fetchNotifications()
})

onUnmounted(() => {
  if (unsubscribeSync) unsubscribeSync()
})

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
