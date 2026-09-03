<template>
  <div class="flex h-screen w-full overflow-hidden bg-[#faf8f5] flex-col md:flex-row">
    <!-- Sidebar (Top on mobile, Left on desktop) -->
    <DashboardSidebar class="shrink-0" />
    
    <!-- Topbar (Mobile only) -->
    <DashboardTopbar class="md:hidden shrink-0" />
    
    <div class="flex flex-1 flex-col overflow-hidden relative">
      <!-- Topbar (Desktop only) -->
      <DashboardTopbar class="hidden md:flex shrink-0" />
      
      <main class="flex-1 overflow-y-auto p-4 md:p-6 relative">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import DashboardSidebar from '~/components/dashboard/DashboardSidebar.vue'
import DashboardTopbar from '~/components/dashboard/DashboardTopbar.vue'
</script>
