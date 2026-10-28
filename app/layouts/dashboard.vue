<template>
  <div class="flex h-screen w-full overflow-hidden bg-[#faf8f5] flex-col md:flex-row">
    <!-- Navigation Bar / Sidebar (Desktop: left sidebar; Mobile: fixed bottom bar) -->
    <DashboardSidebar class="shrink-0" />

    <!-- Topbar (Mobile only) - cleanly sits at top of mobile viewport -->
    <DashboardTopbar class="md:hidden shrink-0" />
    
    <div class="flex flex-1 flex-col overflow-hidden relative min-w-0">
      <!-- Topbar (Desktop only) -->
      <DashboardTopbar class="hidden md:flex shrink-0" />
      
      <main ref="mainContentRef" class="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6 relative max-w-full">
        <!-- If user does not have permission for current route, render Access Denied -->
        <AccessDenied v-if="!isRouteAllowed" :pageName="currentPageName" />
        <slot v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import DashboardSidebar from '~/components/dashboard/DashboardSidebar.vue'
import DashboardTopbar from '~/components/dashboard/DashboardTopbar.vue'
import AccessDenied from '~/components/ui/AccessDenied.vue'
import { APP_PAGES, getPageKeyFromPath } from '~/utils/permissions'

const { user, fetchUser, canAccessRoute } = useAuth()
const route = useRoute()
const { onOrderSync } = useRealtimeSync()

const mainContentRef = ref<HTMLElement | null>(null)

const scrollToTop = () => {
  if (mainContentRef.value) {
    mainContentRef.value.scrollTop = 0
  }
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

// Reset scroll to top whenever navigation occurs
watch(() => route.fullPath, () => {
  scrollToTop()
  nextTick(() => {
    scrollToTop()
    setTimeout(scrollToTop, 60)
  })
})

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
