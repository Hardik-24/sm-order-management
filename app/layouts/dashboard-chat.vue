<template>
  <div class="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#faf8f5] flex-col md:flex-row fixed inset-0 md:static md:h-screen overscroll-none">
    <!-- Sidebar (Top on mobile, Left on desktop) -->
    <DashboardSidebar class="shrink-0" />
    
    <!-- Mobile top spacer to offset fixed top mobile menu bar -->
    <div class="h-14 md:hidden shrink-0" aria-hidden="true"></div>
    
    <div class="flex flex-1 flex-col overflow-hidden relative min-w-0 min-h-0">
      <!-- Topbar (Desktop only - Mobile has dedicated WhatsApp header) -->
      <DashboardTopbar class="hidden md:flex shrink-0" />
      
      <!-- Full-bleed page content -->
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
