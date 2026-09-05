<template>
  <div class="flex h-screen w-full overflow-hidden bg-[#faf8f5] flex-col md:flex-row">
    <!-- Sidebar (Top on mobile, Left on desktop) -->
    <DashboardSidebar class="shrink-0" />
    
    <!-- Topbar (Mobile only) -->
    <DashboardTopbar class="md:hidden shrink-0" />
    
    <div class="flex flex-1 flex-col overflow-hidden relative min-w-0">
      <!-- Topbar (Desktop only) -->
      <DashboardTopbar class="hidden md:flex shrink-0" />
      
      <!-- No padding, no overflow-y-auto — the page content fills everything -->
      <main class="flex-1 overflow-hidden relative flex flex-col min-h-0">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import DashboardSidebar from '~/components/dashboard/DashboardSidebar.vue'
import DashboardTopbar from '~/components/dashboard/DashboardTopbar.vue'
</script>
