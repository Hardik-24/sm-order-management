<template>
  <!-- Desktop Sidebar -->
  <aside 
    class="hidden md:flex h-full flex-col bg-[#1c1c1c] text-white transition-all duration-300 ease-in-out relative z-20 shrink-0 border-r border-gray-800"
    :class="isSidebarCollapsed ? 'w-[80px]' : 'w-[260px]'"
  >
    <!-- Header (Logo + Toggle) -->
    <div class="flex items-center w-full shrink-0" :class="isSidebarCollapsed ? 'justify-center pt-6' : 'justify-between px-6 pt-6'">
      <div v-if="!isSidebarCollapsed" class="flex items-center cursor-pointer group" @mouseenter="onLogoHover">
        <span ref="logoTextRef" class="text-sm tracking-widest uppercase flex items-center gap-1.5 select-none py-0.5">
          <span class="brand-silicon font-light text-gray-400 transition-colors group-hover:text-emerald-300">SILICON</span> 
          <span class="brand-marketing font-bold text-gray-100 transition-colors group-hover:text-white">MARKETING</span>
        </span>
      </div>
      <button @click="isSidebarCollapsed = !isSidebarCollapsed" class="text-gray-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800">
        <PanelLeft v-if="isSidebarCollapsed" class="w-5 h-5" />
        <PanelLeftClose v-else class="w-5 h-5" />
      </button>
    </div>

    <!-- Navigation Area -->
    <div ref="navContainerRef" class="flex-1 p-4 flex flex-col gap-6 overflow-y-auto overflow-x-hidden no-scrollbar mt-2">
      
      <!-- DB Connection Status -->
      <div>
        <div class="flex items-center gap-3 rounded-md py-2 px-3 text-sm bg-[#242424] border border-gray-800 transition-colors" :class="isSidebarCollapsed ? 'justify-center px-0' : 'px-3'">
          <div class="relative flex h-3 w-3 shrink-0">
            <span v-if="dbStatus === 'connecting'" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3" :class="dbStatus === 'connected' ? 'bg-green-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'"></span>
          </div>
          <span v-if="!isSidebarCollapsed" class="font-medium text-gray-400 whitespace-nowrap">
            {{ dbStatus === 'connected' ? 'DB Connected' : dbStatus === 'error' ? 'DB Disconnected' : 'Connecting...' }}
          </span>
        </div>
      </div>

      <!-- DASHBOARD -->
      <div>
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">DASHBOARD</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink to="/dashboard" title="Overview" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path === '/dashboard' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <LayoutDashboard class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Overview</span>
          </NuxtLink>
          <NuxtLink to="/dashboard/orders" title="Orders" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/orders') && route.path !== '/dashboard/orders/create' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <ClipboardList class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Orders</span>
          </NuxtLink>
          <NuxtLink v-if="['ADMIN', 'SALES'].includes(user?.role || '')" to="/dashboard/orders/create" title="Create Order" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path === '/dashboard/orders/create' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <PenTool class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Create Order</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- OPERATIONS -->
      <div>
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">OPERATIONS</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink to="/dashboard/inventory" title="Inventory" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/inventory') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Boxes class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Inventory</span>
          </NuxtLink>
          <NuxtLink to="/dashboard/chat" title="Team Chat" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/chat') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <MessageSquare class="shrink-0 w-4 h-4 text-emerald-400" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Team Chat</span>
          </NuxtLink>
          <NuxtLink to="/dashboard/billing" title="Billing" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/billing') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Receipt class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Billing</span>
          </NuxtLink>
          <NuxtLink to="/dashboard/packing" title="Packing" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/packing') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Package class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Packing</span>
          </NuxtLink>
          <NuxtLink to="/dashboard/delivery" title="Delivery" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/delivery') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Truck class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Delivery</span>
          </NuxtLink>
          <NuxtLink v-if="['ADMIN', 'DELIVERY'].includes(user?.role || '')" to="/driver" target="_blank" title="Driver Portal" class="flex items-center gap-3 rounded-md py-2 text-sm transition-colors text-emerald-400 hover:bg-gray-800/50 hover:text-emerald-300" :class="[isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Navigation class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap text-xs">Driver App ↗</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- DATA -->
      <div>
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">DATA</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink to="/dashboard/customers" title="Customers" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/customers') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <User class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Customers</span>
          </NuxtLink>
          <NuxtLink to="/dashboard/products" title="Products" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/products') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Box class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Products</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- ADMINISTRATION -->
      <div v-if="user?.role === 'ADMIN'">
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">ADMINISTRATION</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink to="/dashboard/admin" title="Admin" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/admin') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Settings class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Admin</span>
          </NuxtLink>
        </nav>
      </div>
    </div>

    <!-- User Profile Bottom Section -->
    <div ref="profileCardRef" class="mt-auto p-4 flex flex-col gap-2 border-t border-gray-800/50 bg-[#1c1c1c] shrink-0">
      <div class="flex items-center bg-[#242424] hover:bg-[#2a2a2a] cursor-pointer rounded-xl p-3 border border-gray-700/50 transition-colors" :class="isSidebarCollapsed ? 'justify-center' : 'justify-between'">
        <div class="flex items-center gap-3 overflow-hidden">
          <img :src="'https://ui-avatars.com/api/?name=' + (user?.name || 'Hardik') + '&background=1a5c4c&color=e8e0d4'" alt="Hardik" class="h-9 w-9 rounded-full shrink-0 object-cover" />
          <div v-if="!isSidebarCollapsed" class="flex flex-col overflow-hidden whitespace-nowrap">
            <span class="text-sm font-medium text-gray-200 truncate">{{ user?.name || 'Hardik' }}</span>
            <span class="text-[10px] text-gray-500 truncate">{{ user?.role === 'ADMIN' ? 'Administrator' : user?.role || 'Administrator' }}</span>
          </div>
        </div>
      </div>
      <button @click="logout" title="Logout" class="flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200" :class="isSidebarCollapsed ? 'justify-center px-0' : 'px-4'">
        <LogOut class="shrink-0 w-4 h-4" />
        <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Logout</span>
      </button>
    </div>
  </aside>

  
  <!-- Mobile Top Navigation -->
  <aside class="flex md:hidden flex-col bg-[#1c1c1c] text-white w-full z-[100] relative shadow-md shrink-0">
    <!-- Horizontal Scroll Icons + Toggle Button -->
    <div class="flex items-center w-full h-14 border-b border-gray-800">
      
      <!-- Scrollable Icons Area -->
      <div class="flex-1 flex flex-row items-center overflow-x-auto no-scrollbar px-3 gap-6 h-full">
        <NuxtLink to="/dashboard" :class="[route.path === '/dashboard' ? 'text-[#4ecdc4]' : 'text-gray-400']"><LayoutDashboard class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/orders" :class="[route.path.startsWith('/dashboard/orders') && route.path !== '/dashboard/orders/create' ? 'text-[#4ecdc4]' : 'text-gray-400']"><ClipboardList class="w-5 h-5" /></NuxtLink>
        <NuxtLink v-if="['ADMIN', 'SALES'].includes(user?.role || '')" to="/dashboard/orders/create" :class="[route.path === '/dashboard/orders/create' ? 'text-[#4ecdc4]' : 'text-gray-400']"><PenTool class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/inventory" :class="[route.path.startsWith('/dashboard/inventory') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Boxes class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/chat" :class="[route.path.startsWith('/dashboard/chat') ? 'text-[#4ecdc4]' : 'text-gray-400']"><MessageSquare class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/billing" :class="[route.path.startsWith('/dashboard/billing') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Receipt class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/packing" :class="[route.path.startsWith('/dashboard/packing') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Package class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/delivery" :class="[route.path.startsWith('/dashboard/delivery') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Truck class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/customers" :class="[route.path.startsWith('/dashboard/customers') ? 'text-[#4ecdc4]' : 'text-gray-400']"><User class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/products" :class="[route.path.startsWith('/dashboard/products') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Box class="w-5 h-5" /></NuxtLink>
        <NuxtLink v-if="user?.role === 'ADMIN'" to="/dashboard/admin" :class="[route.path.startsWith('/dashboard/admin') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Settings class="w-5 h-5" /></NuxtLink>
      </div>

      <!-- Toggle Expand -->
      <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="h-full px-4 flex items-center justify-center bg-[#141414] border-l border-gray-800 text-gray-400 hover:text-white shrink-0 shadow-[-4px_0_10px_rgba(0,0,0,0.5)]">
        <Menu v-if="!isMobileMenuOpen" class="w-5 h-5" />
        <X v-else class="w-5 h-5" />
      </button>
    </div>

    <!-- Expanded Menu Content (Absolute to push over content smoothly without jumping) -->
    <div v-if="isMobileMenuOpen" ref="mobileMenuContentRef" class="absolute top-14 inset-x-0 bg-[#1c1c1c] border-b border-gray-800 shadow-2xl flex flex-col p-4 max-h-[70vh] overflow-y-auto z-[90]">
      
      <!-- Brand in Mobile Expanded Header -->
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-gray-800/80">
        <span ref="mobileLogoRef" class="text-sm tracking-widest uppercase flex items-center gap-1.5 select-none">
          <span class="brand-silicon font-light text-gray-400">SILICON</span> 
          <span class="brand-marketing font-bold text-gray-100">MARKETING</span>
        </span>
      </div>
      <div class="flex flex-col gap-1 mb-4">
        <div class="flex items-center gap-3 rounded-md py-2 px-3 text-sm bg-[#242424] border border-gray-800">
          <div class="relative flex h-3 w-3 shrink-0">
            <span v-if="dbStatus === 'connecting'" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3" :class="dbStatus === 'connected' ? 'bg-green-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'"></span>
          </div>
          <span class="font-medium text-gray-400">
            {{ dbStatus === 'connected' ? 'DB Connected' : dbStatus === 'error' ? 'DB Disconnected' : 'Connecting...' }}
          </span>
        </div>
      </div>

      <!-- DASHBOARD -->
      <div class="flex flex-col gap-1 mb-6">
        <h3 class="block mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">DASHBOARD</h3>
        <NuxtLink to="/dashboard" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path === '/dashboard' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <LayoutDashboard class="w-4 h-4" /> <span class="font-medium">Overview</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/orders" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/orders') && route.path !== '/dashboard/orders/create' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <ClipboardList class="w-4 h-4" /> <span class="font-medium">Orders</span>
        </NuxtLink>
        <NuxtLink v-if="['ADMIN', 'SALES'].includes(user?.role || '')" to="/dashboard/orders/create" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path === '/dashboard/orders/create' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <PenTool class="w-4 h-4" /> <span class="font-medium">Create Order</span>
        </NuxtLink>
      </div>

      <!-- OPERATIONS -->
      <div class="flex flex-col gap-1 mb-6">
        <h3 class="block mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">OPERATIONS</h3>
        <NuxtLink to="/dashboard/inventory" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/inventory') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Boxes class="w-4 h-4" /> <span class="font-medium">Inventory</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/chat" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors text-emerald-400 hover:bg-gray-800/50" :class="[route.path.startsWith('/dashboard/chat') ? 'bg-[#223933] text-emerald-300' : '']">
          <MessageSquare class="w-4 h-4" /> <span class="font-medium">Team Chat</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/billing" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/billing') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Receipt class="w-4 h-4" /> <span class="font-medium">Billing</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/packing" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/packing') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Package class="w-4 h-4" /> <span class="font-medium">Packing</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/delivery" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/delivery') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Truck class="w-4 h-4" /> <span class="font-medium">Delivery</span>
        </NuxtLink>
        <NuxtLink v-if="['ADMIN', 'DELIVERY'].includes(user?.role || '')" to="/driver" target="_blank" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors text-emerald-400 hover:bg-gray-800/50">
          <Navigation class="w-4 h-4" /> <span class="font-medium text-xs">Driver App ↗</span>
        </NuxtLink>
      </div>

      <!-- DATA -->
      <div class="flex flex-col gap-1 mb-6">
        <h3 class="block mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">DATA</h3>
        <NuxtLink to="/dashboard/customers" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/customers') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <User class="w-4 h-4" /> <span class="font-medium">Customers</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/products" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/products') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Box class="w-4 h-4" /> <span class="font-medium">Products</span>
        </NuxtLink>
      </div>
      
      <div v-if="user?.role === 'ADMIN'" class="flex flex-col gap-1 mb-4">
        <h3 class="block mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">ADMINISTRATION</h3>
        <NuxtLink to="/dashboard/admin" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/admin') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Settings class="w-4 h-4" /> <span class="font-medium">Admin</span>
        </NuxtLink>
      </div>

      <div class="mt-2 pt-4 border-t border-gray-800">
        <button @click="logout" class="flex w-full items-center gap-3 rounded-lg py-2.5 px-3 text-sm text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200">
          <LogOut class="w-4 h-4" />
          <span class="font-medium whitespace-nowrap">Logout</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { 
  LayoutDashboard, 
  ClipboardList, 
  PenTool, 
  Receipt, 
  Package, 
  Boxes, 
  Truck, 
  Navigation, 
  User, 
  Box, 
  Settings, 
  PanelLeft, 
  PanelLeftClose, 
  PanelTop, 
  PanelTopClose, 
  Menu, 
  X, 
  LogOut,
  MessageSquare 
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { watch, ref, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'

const route = useRoute()
const { user, logout } = useAuth()
const isSidebarCollapsed = useState('sidebarCollapsed', () => false)
const isMobileMenuOpen = useState('mobileMenuOpen', () => false)

const logoTextRef = ref<HTMLElement | null>(null)
const mobileLogoRef = ref<HTMLElement | null>(null)
const navContainerRef = ref<HTMLElement | null>(null)
const profileCardRef = ref<HTMLElement | null>(null)
const mobileMenuContentRef = ref<HTMLElement | null>(null)

let gsapCtx: gsap.Context | null = null

const dbStatus = ref<'connecting' | 'connected' | 'error'>('connecting')
let pollInterval: ReturnType<typeof setInterval>

const checkDb = async () => {
  dbStatus.value = 'connecting'
  try {
    const res = await $fetch<{ status: string }>('/api/health')
    dbStatus.value = res.status === 'ok' ? 'connected' : 'error'
  } catch {
    dbStatus.value = 'error'
  }
}

/**
 * Animate "SILICON MARKETING" brand text with tracked reveal & blur unmask
 */
const animateBrandText = (el: HTMLElement | null) => {
  if (!el) return
  const silicon = el.querySelector('.brand-silicon')
  const marketing = el.querySelector('.brand-marketing')
  
  if (silicon && marketing) {
    const tl = gsap.timeline()
    tl.fromTo(silicon,
      { opacity: 0, x: -16, letterSpacing: '0.08em' },
      { opacity: 1, x: 0, letterSpacing: '0.24em', duration: 0.75, ease: 'power3.out' }
    )
    .fromTo(marketing,
      { opacity: 0, x: 16, filter: 'blur(5px)' },
      { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' },
      '-=0.5'
    )
  }
}

/**
 * Interactive hover shimmer on the brand logo
 */
const onLogoHover = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  if (!target) return
  const silicon = target.querySelector('.brand-silicon')
  const marketing = target.querySelector('.brand-marketing')
  
  if (silicon && marketing) {
    gsap.to(silicon, {
      color: '#4ecdc4',
      duration: 0.25,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut'
    })
    gsap.to(marketing, {
      letterSpacing: '+=0.05em',
      duration: 0.28,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut'
    })
  }
}

/**
 * Smooth cascading downward stagger for sidebar menu links
 */
const animateNavItems = () => {
  if (!navContainerRef.value) return
  const items = navContainerRef.value.querySelectorAll('nav a, h3')
  if (items.length) {
    gsap.fromTo(items,
      { opacity: 0, x: -12 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.022, ease: 'power2.out', clearProps: 'transform,opacity' }
    )
  }
}

/**
 * Bottom user card entrance
 */
const animateProfileSection = () => {
  if (profileCardRef.value) {
    gsap.fromTo(profileCardRef.value,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, delay: 0.15, ease: 'power2.out', clearProps: 'transform,opacity' }
    )
  }
}

/**
 * Mobile menu expand animation
 */
const animateMobileMenu = () => {
  if (!mobileMenuContentRef.value) return
  const links = mobileMenuContentRef.value.querySelectorAll('nav a, h3, div')
  gsap.fromTo(mobileMenuContentRef.value,
    { opacity: 0, y: -10 },
    { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
  )
  if (links.length) {
    gsap.fromTo(links,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.3, stagger: 0.018, ease: 'power2.out', clearProps: 'transform,opacity' }
    )
  }
}

onMounted(() => {
  checkDb()
  pollInterval = setInterval(checkDb, 30000)

  gsapCtx = gsap.context(() => {
    nextTick(() => {
      animateBrandText(logoTextRef.value)
      animateNavItems()
      animateProfileSection()
    })
  })
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  gsapCtx?.revert()
})

// Trigger re-animation when expanding sidebar
watch(isSidebarCollapsed, (collapsed) => {
  if (!collapsed) {
    nextTick(() => {
      animateBrandText(logoTextRef.value)
      animateNavItems()
    })
  }
})

// Trigger mobile menu animation
watch(isMobileMenuOpen, (open) => {
  if (open) {
    nextTick(() => {
      animateBrandText(mobileLogoRef.value)
      animateMobileMenu()
    })
  }
})

watch(() => route.path, () => {
  isMobileMenuOpen.value = false
})
</script>
