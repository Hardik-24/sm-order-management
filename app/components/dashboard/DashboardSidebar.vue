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
          <span class="brand-silicon font-light text-gray-400 transition-colors group-hover:text-sky-300">SILICON</span> 
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

      <!-- HOME -->
      <div v-if="canAccessRoute('/dashboard')">
        <nav class="flex flex-col gap-1">
          <NuxtLink to="/dashboard" title="Home" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Home class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Home</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- OPERATIONS -->
      <div v-if="(['ADMIN', 'SUPERVISOR', 'SALES'].includes(user?.role || '') && canAccessRoute('/dashboard/orders/create')) || (['ADMIN', 'SUPERVISOR', 'SALES'].includes(user?.role || '') && canAccessRoute('/dashboard/approve-orders')) || canAccessRoute('/dashboard/packing') || canAccessRoute('/dashboard/billing') || canAccessRoute('/dashboard/delivery') || canAccessRoute('/dashboard/inventory') || canAccessDriverApp">
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">OPERATIONS</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink v-if="['ADMIN', 'SUPERVISOR', 'SALES'].includes(user?.role || '') && canAccessRoute('/dashboard/orders/create')" to="/dashboard/orders/create" title="Create Order" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/orders/create') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <PenTool class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/orders/create') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Create Order</span>
          </NuxtLink>
          <NuxtLink v-if="['ADMIN', 'SUPERVISOR', 'SALES'].includes(user?.role || '') && canAccessRoute('/dashboard/approve-orders')" to="/dashboard/approve-orders" title="Approve Orders" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/approve-orders') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <CheckCheck class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/approve-orders') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Approve Orders</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/packing')" to="/dashboard/packing" title="Packing" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/packing') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Package class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/packing') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Packing</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/billing')" to="/dashboard/billing" title="Billing" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/billing') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <IndianRupee class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/billing') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Billing</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/delivery')" to="/dashboard/delivery" title="Delivery" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/delivery') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Truck class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/delivery') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Delivery</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/inventory')" to="/dashboard/inventory" title="Stock Status" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/inventory') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Boxes class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/inventory') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Stock Status</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessDriverApp" to="/driver" target="_blank" title="Driver Portal" class="flex items-center gap-3 rounded-md py-2 text-sm transition-colors text-sky-400 hover:bg-gray-800/50 hover:text-sky-300" :class="[isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Navigation class="shrink-0 w-4 h-4" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap text-xs">Driver App ↗</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- DASHBOARD -->
      <div v-if="canAccessRoute('/dashboard/analytics') || canAccessRoute('/dashboard/orders') || canAccessRoute('/dashboard/order-requests') || canAccessRoute('/dashboard/quotations') || canAccessRoute('/dashboard/chat')">
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">DASHBOARD</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink v-if="canAccessRoute('/dashboard/analytics')" to="/dashboard/analytics" title="Analytics" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/analytics') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <BarChart3 class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/analytics') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Analytics</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/orders')" to="/dashboard/orders" title="Orders" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/orders') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <ClipboardList class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/orders') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Orders</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/order-requests')" to="/dashboard/order-requests" title="Order Requests" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors relative" :class="[isLinkActive('/dashboard/order-requests') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Inbox class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/order-requests') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap flex-1">Order Requests</span>
            <span v-if="pendingRequestsCount > 0 && !isSidebarCollapsed" class="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
              {{ pendingRequestsCount }}
            </span>
            <span v-if="pendingRequestsCount > 0 && isSidebarCollapsed" class="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#1c1c1c]"></span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/quotations')" to="/dashboard/quotations" title="Quotations" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/quotations') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Calculator class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/quotations') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Quotations</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/chat')" to="/dashboard/chat" title="Team Chat" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/chat') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <MessageSquare class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/chat') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Team Chat</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- DATA -->
      <div v-if="canAccessRoute('/dashboard/customers') || canAccessRoute('/dashboard/products') || canAccessRoute('/dashboard/vouchers')">
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">DATA</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink v-if="canAccessRoute('/dashboard/customers')" to="/dashboard/customers" title="Customers" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/customers') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <User class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/customers') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Customers</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/products')" to="/dashboard/products" title="Products" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/products') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Box class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/products') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Products</span>
          </NuxtLink>
          <NuxtLink v-if="canAccessRoute('/dashboard/vouchers')" to="/dashboard/vouchers" title="BUSY Vouchers" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/vouchers') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Receipt class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/vouchers') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">BUSY Vouchers</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- ADMINISTRATION -->
      <div v-if="user?.role === 'ADMIN' && canAccessRoute('/dashboard/admin')">
        <h3 v-if="!isSidebarCollapsed" class="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">ADMINISTRATION</h3>
        <div v-else class="mb-3 h-3 flex justify-center border-b border-gray-800 mx-2"></div>
        <nav class="flex flex-col gap-1">
          <NuxtLink to="/dashboard/admin" title="Admin" class="flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors" :class="[isLinkActive('/dashboard/admin') ? 'bg-[#182d47] text-[#e8e0d4]' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200', isSidebarCollapsed ? 'justify-center px-0' : 'px-3']">
            <Settings class="shrink-0 w-4 h-4 transition-colors" :class="isLinkActive('/dashboard/admin') ? 'text-sky-400' : 'text-gray-400'" />
            <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap">Admin</span>
          </NuxtLink>
        </nav>
      </div>
    </div>

    <!-- User Profile Bottom Section -->
    <div ref="profileCardRef" class="mt-auto p-4 flex flex-col gap-2 border-t border-gray-800/50 bg-[#1c1c1c] shrink-0">
      <div class="flex items-center bg-[#242424] hover:bg-[#2a2a2a] cursor-pointer rounded-xl p-3 border border-gray-700/50 transition-colors" :class="isSidebarCollapsed ? 'justify-center' : 'justify-between'">
        <div class="flex items-center gap-3 overflow-hidden">
          <img :src="'https://ui-avatars.com/api/?name=' + (user?.name || 'User') + '&background=1b3b5f&color=e8e0d4'" alt="User" class="h-9 w-9 rounded-full shrink-0 object-cover" />
          <div v-if="!isSidebarCollapsed" class="flex flex-col overflow-hidden whitespace-nowrap">
            <span class="text-sm font-medium text-gray-200 truncate">{{ user?.name || 'User' }}</span>
            <span class="text-[10px] text-gray-500 truncate">{{ user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'SUPERVISOR' ? 'Supervisor' : user?.role || 'Staff' }}</span>
          </div>
        </div>
      </div>
      <button @click="logout" title="Logout" class="flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 cursor-pointer" :class="isSidebarCollapsed ? 'justify-center px-0' : 'px-4'">
        <LogOut class="shrink-0 w-4 h-4 text-red-400" />
        <span v-if="!isSidebarCollapsed" class="font-medium whitespace-nowrap text-red-400">Logout</span>
      </button>
    </div>
  </aside>

  
  <!-- Mobile Bottom Navigation -->
  <aside
    class="flex md:hidden flex-col bg-[#1c1c1c] text-white w-full fixed bottom-0 inset-x-0 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] border-t border-gray-800 pb-[env(safe-area-inset-bottom,0px)]"
    :class="isSheetElevated ? 'z-[800]' : 'z-[400]'"
  >
    <!-- Backdrop when category sheet is open -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="activeMobileSheet !== null"
        class="fixed inset-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] bg-black/60 backdrop-blur-xs z-[205]"
        @click="closeMobileSheet"
      />
    </Transition>

    <!-- Slide-up Category Sheet (Opens upwards above the bottom navigation bar) -->
    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
      @after-leave="onSheetAfterLeave"
    >
      <div
        v-if="activeMobileSheet !== null"
        class="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 bg-[#1c1c1c] border-t border-gray-800 shadow-2xl flex flex-col max-h-[calc(78dvh-3.5rem)] overflow-y-auto z-[210] rounded-t-2xl pb-4 overscroll-contain"
      >
        <!-- Drag indicator bar -->
        <div class="w-10 h-1 bg-gray-700/80 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

        <!-- 1. OPERATIONS SHEET -->
        <div v-if="activeMobileSheet === 'operations'" class="flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800/80">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Layers class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-gray-100 leading-none">Operations</h3>
                <p class="text-[10px] text-gray-400 mt-1 leading-none">Fulfillment & order processing</p>
              </div>
            </div>
            <button @click="closeMobileSheet" class="text-gray-400 hover:text-white p-1 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Grid items -->
          <div class="grid grid-cols-2 gap-2 p-3">
            <NuxtLink
              v-if="['ADMIN', 'SUPERVISOR', 'SALES'].includes(user?.role || '') && canAccessRoute('/dashboard/approve-orders')"
              to="/dashboard/approve-orders"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98] relative"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/approve-orders') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <CheckCheck class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-gray-100 leading-tight">Approve Orders</span>
                  <span v-if="pendingApprovalCount > 0" class="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-amber-500/30">
                    {{ pendingApprovalCount }}
                  </span>
                </div>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Review pending orders</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/packing')"
              to="/dashboard/packing"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/packing') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Package class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Packing</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Pick & pack items</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/billing')"
              to="/dashboard/billing"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/billing') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <IndianRupee class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Billing</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Invoicing & GST</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/delivery')"
              to="/dashboard/delivery"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/delivery') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Truck class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Delivery</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Dispatch & transit</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessDriverApp"
              to="/driver"
              target="_blank"
              @click="onSheetItemClick"
              class="col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
            >
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Navigation class="w-4 h-4" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-semibold text-gray-100">Driver App ↗</span>
                  <span class="text-[10px] text-gray-400">Launch driver tracking app</span>
                </div>
              </div>
              <ExternalLink class="w-4 h-4 text-sky-400 mr-1" />
            </NuxtLink>
          </div>
        </div>

        <!-- 2. CREATE SHEET -->
        <div v-if="activeMobileSheet === 'create'" class="flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800/80">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <PlusCircle class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-gray-100 leading-none">Create</h3>
                <p class="text-[10px] text-gray-400 mt-1 leading-none">Directly open creation form</p>
              </div>
            </div>
            <button @click="closeMobileSheet" class="text-gray-400 hover:text-white p-1 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- 2 Clear Action Cards -->
          <div class="grid grid-cols-1 gap-2.5 p-3.5">
            <NuxtLink
              v-if="['ADMIN', 'SUPERVISOR', 'SALES'].includes(user?.role || '') && canAccessRoute('/dashboard/orders/create')"
              to="/dashboard/orders/create"
              @click="onSheetItemClick"
              class="flex items-center justify-between p-3.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': route.path === '/dashboard/orders/create' }"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <PenTool class="w-5 h-5" />
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold text-gray-100">Create Order</span>
                  <span class="text-[11px] text-gray-400">Full sales order entry form</span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-gray-500" />
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/quotations')"
              to="/dashboard/quotations?create=1"
              @click="handleCreateQuotationNav"
              class="flex items-center justify-between p-3.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': route.path.startsWith('/dashboard/quotations') && (route.query.create === '1' || route.query.create === 'true') }"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Calculator class="w-5 h-5" />
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold text-gray-100">Create Quotation</span>
                  <span class="text-[11px] text-gray-400">Directly opens new quotation form</span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-gray-500" />
            </NuxtLink>
          </div>
        </div>

        <!-- 3. DATA & REPORTS SHEET -->
        <div v-if="activeMobileSheet === 'data'" class="flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800/80">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <BarChart3 class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-gray-100 leading-none">Data & Reports</h3>
                <p class="text-[10px] text-gray-400 mt-1 leading-none">Records, catalog & analytics</p>
              </div>
            </div>
            <button @click="closeMobileSheet" class="text-gray-400 hover:text-white p-1 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Grid items -->
          <div class="grid grid-cols-2 gap-2 p-3">
            <NuxtLink
              v-if="canAccessRoute('/dashboard/orders')"
              to="/dashboard/orders"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/orders') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <ClipboardList class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Orders</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Sales orders</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/inventory')"
              to="/dashboard/inventory"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/inventory') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Boxes class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Stock Status</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Stock levels</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/analytics')"
              to="/dashboard/analytics"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/analytics') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <BarChart3 class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Analytics</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Sales metrics</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/order-requests')"
              to="/dashboard/order-requests"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98] relative"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/order-requests') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Inbox class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-gray-100 leading-tight">Order Requests</span>
                  <span v-if="pendingRequestsCount > 0" class="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-amber-500/30">
                    {{ pendingRequestsCount }}
                  </span>
                </div>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Customer drafts</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/quotations')"
              to="/dashboard/quotations"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/quotations') && !route.query.create }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Calculator class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Quotations</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Estimates & rates</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/customers')"
              to="/dashboard/customers"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/customers') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <User class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Customers</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Client directory</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/products')"
              to="/dashboard/products"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/products') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Box class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Products</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Items & catalog</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/chat')"
              to="/dashboard/chat"
              @click="onSheetItemClick"
              class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/chat') }"
            >
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <MessageSquare class="w-4 h-4" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-gray-100 leading-tight">Team Chat</span>
                <span class="text-[10px] text-gray-400 leading-tight mt-0.5">Staff messaging</span>
              </div>
            </NuxtLink>

            <NuxtLink
              v-if="canAccessRoute('/dashboard/vouchers')"
              to="/dashboard/vouchers"
              @click="onSheetItemClick"
              class="col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-all active:scale-[0.98]"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/vouchers') }"
            >
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Receipt class="w-4 h-4" />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-semibold text-gray-100">BUSY Vouchers</span>
                  <span class="text-[10px] text-gray-400">Sales accounting sync</span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-gray-500" />
            </NuxtLink>
          </div>
        </div>

        <!-- 4. SETTINGS & ACCOUNT SHEET -->
        <div v-if="activeMobileSheet === 'more'" class="flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800/80">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Settings class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-gray-100 leading-none">Settings</h3>
                <p class="text-[10px] text-gray-400 mt-1 leading-none">System info & user profile</p>
              </div>
            </div>
            <button @click="closeMobileSheet" class="text-gray-400 hover:text-white p-1 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="flex flex-col p-3 gap-2.5">
            <!-- Profile Card -->
            <div class="flex items-center justify-between p-3 rounded-xl bg-[#242424] border border-gray-800/80">
              <div class="flex items-center gap-3 min-w-0">
                <img
                  :src="'https://ui-avatars.com/api/?name=' + (user?.name || 'User') + '&background=1b3b5f&color=e8e0d4'"
                  alt="User"
                  class="h-10 w-10 rounded-full shrink-0 object-cover border border-gray-700"
                />
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-semibold text-gray-100 truncate">{{ user?.name || 'User' }}</span>
                  <span class="text-[10px] text-gray-400 leading-tight mt-0.5">{{ user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'SUPERVISOR' ? 'Supervisor' : user?.role || 'Staff' }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#1a1a1a] border border-gray-800 shrink-0">
                <div class="relative flex h-2 w-2 shrink-0">
                  <span v-if="dbStatus === 'connecting'" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2" :class="dbStatus === 'connected' ? 'bg-green-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'"></span>
                </div>
                <span class="text-[10px] font-medium text-gray-400">
                  {{ dbStatus === 'connected' ? 'Connected' : dbStatus === 'error' ? 'Offline' : 'Syncing' }}
                </span>
              </div>
            </div>

            <!-- Admin link -->
            <NuxtLink
              v-if="user?.role === 'ADMIN' && canAccessRoute('/dashboard/admin')"
              to="/dashboard/admin"
              @click="onSheetItemClick"
              class="flex items-center justify-between p-3 rounded-xl bg-[#242424] hover:bg-[#2a2a2a] border border-gray-800/80 transition-colors"
              :class="{ 'ring-1 ring-sky-500/60 bg-[#182d47]/50 border-sky-500/40 text-sky-300': isLinkActive('/dashboard/admin') }"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Settings class="w-4 h-4" />
                </div>
                <div class="flex flex-col">
                  <span class="text-xs font-semibold text-gray-100">Admin</span>
                  <span class="text-[10px] text-gray-400">Permissions, users & system</span>
                </div>
              </div>
              <ChevronRight class="w-4 h-4 text-gray-500" />
            </NuxtLink>

            <!-- Logout button -->
            <button
              @click="logout"
              type="button"
              class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium text-xs transition-colors cursor-pointer active:scale-[0.99] mt-0.5"
            >
              <LogOut class="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 5 Fixed Navigation Tabs (Zero horizontal scroll, perfectly symmetric, role-aware) -->
    <div class="grid grid-cols-5 h-14 w-full items-stretch relative z-[215] bg-[#1c1c1c] select-none">
      <!-- 1. OPERATIONS -->
      <button
        type="button"
        :disabled="!hasOperationsAccess"
        @click="toggleMobileSheet('operations')"
        class="flex flex-col items-center justify-center relative py-1 transition-all active:scale-95"
        :class="[
          !hasOperationsAccess
            ? 'opacity-30 cursor-not-allowed pointer-events-none text-gray-600'
            : activeMobileSheet === 'operations' || (isOperationsActive && !activeMobileSheet)
              ? 'text-sky-400 font-semibold cursor-pointer'
              : 'text-gray-400 hover:text-gray-200 cursor-pointer'
        ]"
      >
        <div class="relative">
          <Layers class="w-5 h-5 transition-transform" :class="{ 'scale-110': activeMobileSheet === 'operations' }" />
          <span v-if="hasOperationsAccess && pendingApprovalCount > 0" class="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#1c1c1c]"></span>
        </div>
        <span class="text-[10px] tracking-tight mt-1 leading-none">Operations</span>
      </button>

      <!-- 2. CREATE -->
      <button
        type="button"
        :disabled="!hasCreateAccess"
        @click="toggleMobileSheet('create')"
        class="flex flex-col items-center justify-center relative py-1 transition-all active:scale-95"
        :class="[
          !hasCreateAccess
            ? 'opacity-30 cursor-not-allowed pointer-events-none text-gray-600'
            : activeMobileSheet === 'create' || (isCreateActive && !activeMobileSheet)
              ? 'text-sky-400 font-semibold cursor-pointer'
              : 'text-gray-400 hover:text-gray-200 cursor-pointer'
        ]"
      >
        <PlusCircle class="w-5 h-5 transition-transform" :class="{ 'scale-110': activeMobileSheet === 'create' }" />
        <span class="text-[10px] tracking-tight mt-1 leading-none">Create</span>
      </button>

      <!-- 3. HOME (Center Anchor) -->
      <NuxtLink
        v-if="hasHomeAccess"
        to="/dashboard"
        @click="onDirectTabClick"
        class="flex flex-col items-center justify-center relative py-1 transition-all active:scale-95 group cursor-pointer"
        :class="[isHomeActive && !activeMobileSheet ? 'text-sky-400 font-semibold' : 'text-gray-400 hover:text-gray-200']"
      >
        <div
          class="w-10 h-7 rounded-xl flex items-center justify-center transition-all"
          :class="[isHomeActive && !activeMobileSheet ? 'bg-sky-500/15 border border-sky-500/30 text-sky-400' : 'bg-transparent text-gray-400 group-hover:text-gray-200']"
        >
          <Home class="w-5 h-5" />
        </div>
        <span class="text-[10px] tracking-tight mt-0.5 leading-none">Home</span>
      </NuxtLink>
      <div
        v-else
        class="flex flex-col items-center justify-center relative py-1 opacity-30 cursor-not-allowed select-none text-gray-600"
      >
        <div class="w-10 h-7 rounded-xl flex items-center justify-center">
          <Home class="w-5 h-5" />
        </div>
        <span class="text-[10px] tracking-tight mt-0.5 leading-none">Home</span>
      </div>

      <!-- 4. DATA & REPORTS -->
      <button
        type="button"
        :disabled="!hasDataReportsAccess"
        @click="toggleMobileSheet('data')"
        class="flex flex-col items-center justify-center relative py-1 transition-all active:scale-95"
        :class="[
          !hasDataReportsAccess
            ? 'opacity-30 cursor-not-allowed pointer-events-none text-gray-600'
            : activeMobileSheet === 'data' || (isDataActive && !activeMobileSheet)
              ? 'text-sky-400 font-semibold cursor-pointer'
              : 'text-gray-400 hover:text-gray-200 cursor-pointer'
        ]"
      >
        <div class="relative">
          <BarChart3 class="w-5 h-5 transition-transform" :class="{ 'scale-110': activeMobileSheet === 'data' }" />
          <span v-if="hasDataReportsAccess && pendingRequestsCount > 0" class="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#1c1c1c]"></span>
        </div>
        <span class="text-[10px] tracking-tight mt-1 leading-none">Data</span>
      </button>

      <!-- 5. SETTINGS -->
      <button
        type="button"
        :disabled="!hasSettingsAccess"
        @click="toggleMobileSheet('more')"
        class="flex flex-col items-center justify-center relative py-1 transition-all active:scale-95"
        :class="[
          !hasSettingsAccess
            ? 'opacity-30 cursor-not-allowed pointer-events-none text-gray-600'
            : activeMobileSheet === 'more' || (isSettingsActive && !activeMobileSheet)
              ? 'text-sky-400 font-semibold cursor-pointer'
              : 'text-gray-400 hover:text-gray-200 cursor-pointer'
        ]"
      >
        <div class="relative">
          <Settings class="w-5 h-5 transition-transform" :class="{ 'scale-110': activeMobileSheet === 'more' }" />
          <span
            v-if="dbStatus === 'error'"
            class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400 ring-2 ring-[#1c1c1c]"
          ></span>
        </div>
        <span class="text-[10px] tracking-tight mt-1 leading-none">Settings</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { 
  Home,
  LayoutDashboard, 
  BarChart3,
  ClipboardList, 
  PenTool, 
  IndianRupee, 
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
  MessageSquare,
  Inbox,
  CheckCheck,
  Calculator,
  Receipt,
  ShoppingBag,
  Layers,
  ChevronRight,
  ExternalLink,
  PlusCircle
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { watch, ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'

const route = useRoute()
const { user, logout, canAccessRoute } = useAuth()
const isSidebarCollapsed = useState('sidebarCollapsed', () => false)
const isMobileMenuOpen = useState('mobileMenuOpen', () => false)

type MobileSheetType = 'operations' | 'create' | 'data' | 'more' | null
const activeMobileSheet = ref<MobileSheetType>(null)
const isSheetElevated = ref(false)

watch(activeMobileSheet, (val) => {
  isMobileMenuOpen.value = val !== null
  if (val !== null) {
    isSheetElevated.value = true
  }
})

const onSheetAfterLeave = () => {
  if (activeMobileSheet.value === null) {
    isSheetElevated.value = false
  }
}

watch(isMobileMenuOpen, (open) => {
  if (!open) {
    activeMobileSheet.value = null
  }
})

// Tab 1: Operations access
const hasOperationsAccess = computed(() => {
  const canApprove = ['ADMIN', 'SUPERVISOR', 'SALES'].includes(user.value?.role || '') && canAccessRoute('/dashboard/approve-orders')
  const canPack = canAccessRoute('/dashboard/packing')
  const canBill = canAccessRoute('/dashboard/billing')
  const canDeliver = canAccessRoute('/dashboard/delivery')
  const canDriver = canAccessDriverApp.value
  return canApprove || canPack || canBill || canDeliver || canDriver
})

// Tab 2: Create access
const hasCreateAccess = computed(() => {
  const canCreateOrder = ['ADMIN', 'SUPERVISOR', 'SALES'].includes(user.value?.role || '') && canAccessRoute('/dashboard/orders/create')
  const canCreateQuote = canAccessRoute('/dashboard/quotations')
  return canCreateOrder || canCreateQuote
})

// Tab 3: Home access
const hasHomeAccess = computed(() => {
  return canAccessRoute('/dashboard')
})

// Tab 4: Data & Reports access
const hasDataReportsAccess = computed(() => {
  const routes = [
    '/dashboard/orders',
    '/dashboard/inventory',
    '/dashboard/analytics',
    '/dashboard/order-requests',
    '/dashboard/quotations',
    '/dashboard/customers',
    '/dashboard/products',
    '/dashboard/vouchers',
    '/dashboard/chat'
  ]
  return routes.some(r => canAccessRoute(r))
})

// Tab 5: Settings access
const hasSettingsAccess = computed(() => true)

const toggleMobileSheet = (sheet: 'operations' | 'create' | 'data' | 'more') => {
  if (sheet === 'operations' && !hasOperationsAccess.value) return
  if (sheet === 'create' && !hasCreateAccess.value) return
  if (sheet === 'data' && !hasDataReportsAccess.value) return
  if (sheet === 'more' && !hasSettingsAccess.value) return
  activeMobileSheet.value = activeMobileSheet.value === sheet ? null : sheet
}

const closeMobileSheet = () => {
  activeMobileSheet.value = null
}

const onDirectTabClick = () => {
  activeMobileSheet.value = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('close-order-panel'))
    window.dispatchEvent(new CustomEvent('close-all-modals'))
  }
  scrollToTop()
}

const onSheetItemClick = () => {
  activeMobileSheet.value = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('close-order-panel'))
    window.dispatchEvent(new CustomEvent('close-all-modals'))
  }
  scrollToTop()
}

const handleCreateQuotationNav = () => {
  activeMobileSheet.value = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('close-order-panel'))
    window.dispatchEvent(new CustomEvent('open-create-quotation'))
  }
  scrollToTop()
}

const isHomeActive = computed(() => route.path === '/dashboard')

const isOperationsActive = computed(() => {
  const opsRoutes = [
    '/dashboard/approve-orders',
    '/dashboard/packing',
    '/dashboard/billing',
    '/dashboard/delivery'
  ]
  return opsRoutes.some(p => route.path.startsWith(p)) || route.path.startsWith('/driver')
})

const isCreateActive = computed(() => {
  if (route.path === '/dashboard/orders/create') return true
  if (route.path.startsWith('/dashboard/quotations') && (route.query.create === '1' || route.query.create === 'true')) return true
  return false
})

const isDataActive = computed(() => {
  if (isCreateActive.value) return false
  const dataRoutes = [
    '/dashboard/orders',
    '/dashboard/inventory',
    '/dashboard/analytics',
    '/dashboard/order-requests',
    '/dashboard/quotations',
    '/dashboard/chat',
    '/dashboard/customers',
    '/dashboard/products',
    '/dashboard/vouchers'
  ]
  return dataRoutes.some(p => route.path.startsWith(p))
})

const isSettingsActive = computed(() => {
  return route.path.startsWith('/dashboard/admin')
})

const canAccessDriverApp = computed(() => {
  return canAccessRoute('/driver')
})

const isLinkActive = (path: string) => {
  if (path === '/dashboard') return route.path === '/dashboard'
  if (path === '/dashboard/orders') return route.path.startsWith('/dashboard/orders') && route.path !== '/dashboard/orders/create'
  if (path === '/dashboard/orders/create') return route.path === '/dashboard/orders/create'
  return route.path.startsWith(path)
}

const logoTextRef = ref<HTMLElement | null>(null)
const navContainerRef = ref<HTMLElement | null>(null)
const profileCardRef = ref<HTMLElement | null>(null)

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

const pendingRequestsCount = ref(0)
const fetchPendingRequestsCount = async () => {
  try {
    const res = await $fetch<any>('/api/order-requests', { params: { limit: 1 } })
    if (res?.counts) {
      pendingRequestsCount.value = res.counts.pending || 0
    }
  } catch {
    // silent
  }
}

const pendingApprovalCount = ref(0)
const fetchPendingApprovalCount = async () => {
  try {
    const res = await $fetch<any>('/api/orders', { params: { isApproved: 'false', status: '!CANCELLED', limit: 1 } })
    if (res?.total !== undefined) {
      pendingApprovalCount.value = res.total || 0
    }
  } catch {
    // silent
  }
}

const { onOrderSync } = useRealtimeSync()
const unsubscribeSync = onOrderSync(() => {
  fetchPendingRequestsCount()
  fetchPendingApprovalCount()
})

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

onMounted(() => {
  checkDb()
  fetchPendingRequestsCount()
  fetchPendingApprovalCount()
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
  if (unsubscribeSync) unsubscribeSync()
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

const scrollToTop = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const mainEl = document.querySelector('main')
    if (mainEl) {
      mainEl.scrollTop = 0
    }
  }
}

const scrollToTopAndClose = () => {
  activeMobileSheet.value = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('close-order-panel'))
  }
  scrollToTop()
}

watch(() => route.path, () => {
  activeMobileSheet.value = null
  isMobileMenuOpen.value = false
  isSheetElevated.value = false
})
</script>

