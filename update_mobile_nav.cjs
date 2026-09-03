const fs = require('fs')

// 1. Remove hamburger from Topbar
let topbar = fs.readFileSync('app/components/dashboard/DashboardTopbar.vue', 'utf8')
topbar = topbar.replace(/<!-- Hamburger Menu \(Mobile Only\) -->[\s\S]*?<\/button>/, '')
fs.writeFileSync('app/components/dashboard/DashboardTopbar.vue', topbar)

// 2. Rewrite Mobile Sidebar
let sidebar = fs.readFileSync('app/components/dashboard/DashboardSidebar.vue', 'utf8')

const mobileSidebarHtml = `
  <!-- Mobile Top Navigation -->
  <aside class="flex md:hidden flex-col bg-[#1c1c1c] text-white w-full z-[100] relative shadow-md shrink-0">
    <!-- Horizontal Scroll Icons + Toggle Button -->
    <div class="flex items-center w-full h-14 border-b border-gray-800">
      
      <!-- Scrollable Icons Area -->
      <div class="flex-1 flex flex-row items-center overflow-x-auto no-scrollbar px-3 gap-6 h-full">
        <NuxtLink to="/dashboard" :class="[route.path === '/dashboard' ? 'text-[#4ecdc4]' : 'text-gray-400']"><LayoutDashboard class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/orders" :class="[route.path.startsWith('/dashboard/orders') && route.path !== '/dashboard/orders/create' ? 'text-[#4ecdc4]' : 'text-gray-400']"><List class="w-5 h-5" /></NuxtLink>
        <NuxtLink v-if="['ADMIN', 'SALES'].includes(user?.role || '')" to="/dashboard/orders/create" :class="[route.path === '/dashboard/orders/create' ? 'text-[#4ecdc4]' : 'text-gray-400']"><PenTool class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/billing" :class="[route.path.startsWith('/dashboard/billing') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Receipt class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/packing" :class="[route.path.startsWith('/dashboard/packing') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Package class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/delivery" :class="[route.path.startsWith('/dashboard/delivery') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Truck class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/customers" :class="[route.path.startsWith('/dashboard/customers') ? 'text-[#4ecdc4]' : 'text-gray-400']"><User class="w-5 h-5" /></NuxtLink>
        <NuxtLink to="/dashboard/products" :class="[route.path.startsWith('/dashboard/products') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Box class="w-5 h-5" /></NuxtLink>
        <NuxtLink v-if="user?.role === 'ADMIN'" to="/dashboard/admin" :class="[route.path.startsWith('/dashboard/admin') ? 'text-[#4ecdc4]' : 'text-gray-400']"><Settings class="w-5 h-5" /></NuxtLink>
      </div>

      <!-- Toggle Expand -->
      <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="h-full px-4 flex items-center justify-center bg-[#141414] border-l border-gray-800 text-gray-400 hover:text-white shrink-0 shadow-[-4px_0_10px_rgba(0,0,0,0.5)]">
        <PanelLeft v-if="!isMobileMenuOpen" class="w-5 h-5" />
        <PanelLeftClose v-else class="w-5 h-5" />
      </button>
    </div>

    <!-- Expanded Menu Content (Absolute to push over content smoothly without jumping) -->
    <div v-if="isMobileMenuOpen" class="absolute top-14 inset-x-0 bg-[#1c1c1c] border-b border-gray-800 shadow-2xl flex flex-col p-4 max-h-[70vh] overflow-y-auto z-[90]">
      
      <!-- DASHBOARD -->
      <div class="flex flex-col gap-1 mb-6">
        <h3 class="block mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">DASHBOARD</h3>
        <NuxtLink to="/dashboard" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path === '/dashboard' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <LayoutDashboard class="w-4 h-4" /> <span class="font-medium">Overview</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/orders" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/orders') && route.path !== '/dashboard/orders/create' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <List class="w-4 h-4" /> <span class="font-medium">Orders</span>
        </NuxtLink>
        <NuxtLink v-if="['ADMIN', 'SALES'].includes(user?.role || '')" to="/dashboard/orders/create" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path === '/dashboard/orders/create' ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <PenTool class="w-4 h-4" /> <span class="font-medium">Create Order</span>
        </NuxtLink>
      </div>

      <!-- OPERATIONS -->
      <div class="flex flex-col gap-1 mb-6">
        <h3 class="block mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">OPERATIONS</h3>
        <NuxtLink to="/dashboard/billing" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/billing') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Receipt class="w-4 h-4" /> <span class="font-medium">Billing</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/packing" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/packing') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Package class="w-4 h-4" /> <span class="font-medium">Packing</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/delivery" class="flex items-center gap-3 rounded-md py-2.5 px-3 text-sm transition-colors" :class="[route.path.startsWith('/dashboard/delivery') ? 'bg-[#223933] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50']">
          <Truck class="w-4 h-4" /> <span class="font-medium">Delivery</span>
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
`

sidebar = sidebar.replace(/<!-- Mobile Top Navigation -->[\s\S]*?<\/template>/, mobileSidebarHtml)
fs.writeFileSync('app/components/dashboard/DashboardSidebar.vue', sidebar)
