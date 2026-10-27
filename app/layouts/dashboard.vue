<template>
  <div class="flex h-screen w-full overflow-hidden bg-[#faf8f5] flex-col md:flex-row">
    <!-- Topbar (Mobile only) - cleanly sits at top of mobile viewport -->
    <DashboardTopbar class="md:hidden shrink-0" />
    
    <div class="flex flex-1 flex-col overflow-hidden relative min-w-0">
      <!-- Topbar (Desktop only) -->
      <DashboardTopbar class="hidden md:flex shrink-0" />
      
      <main class="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6 relative max-w-full">
        <!-- If user does not have permission for current route, render Access Denied -->
        <AccessDenied v-if="!isRouteAllowed" :pageName="currentPageName" />
        <slot v-else />
      </main>
    </div>

    <!-- Navigation Bar / Sidebar (Desktop: left sidebar; Mobile: fixed bottom bar) -->
    <DashboardSidebar class="shrink-0" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DashboardSidebar from '~/components/dashboard/DashboardSidebar.vue'
import DashboardTopbar from '~/components/dashboard/DashboardTopbar.vue'
import AccessDenied from '~/components/ui/AccessDenied.vue'
import { APP_PAGES, getPageKeyFromPath } from '~/utils/permissions'

const { user, fetchUser, canAccessRoute } = useAuth()
const route = useRoute()
const { onOrderSync } = useRealtimeSync()

const isRouteAllowed = computed(() => {
  if (!user.value) return true
  return canAccessRoute(route.path)
})

const currentPageName = computed(() => {
  const key = getPageKeyFromPath(route.path)
  const def = APP_PAGES.find(p => p.key === key)
  return def ? def.label : ''
})

// Listen for realtime permission or user changes to block or permit access immediately
onOrderSync(async (event) => {
  if (
    event?.type === 'USER_CHANGE' ||
    event?.type === 'DB_USER_CHANGE' ||
    event?.action === 'USER_UPDATED' ||
    event?.action === 'USER_PERMISSIONS_UPDATED'
  ) {
    if (!event.userId || event.userId === user.value?.id) {
      if (event.allowedPages !== undefined && user.value) {
        user.value.allowedPages = event.allowedPages
      }
      await fetchUser()
    }
  }
})
</script>
