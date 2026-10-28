<template>
  <div class="min-h-[70vh] flex items-center justify-center p-4">
    <div class="max-w-xl w-full bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden text-center transition-all">
      <!-- Top banner strip -->
      <div class="h-2 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500"></div>

      <div class="p-8 sm:p-10 flex flex-col items-center">
        <!-- Shield Icon with soft background glow -->
        <div class="relative mb-6">
          <div class="w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-inner">
            <ShieldAlert class="w-10 h-10 stroke-[1.75]" />
          </div>
          <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-xs">
            <Lock class="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>

        <!-- Title & Subtitle -->
        <h2 class="text-2xl font-bold text-gray-900 tracking-tight mb-2">Access Restricted</h2>
        <p class="text-gray-600 text-sm max-w-md leading-relaxed mb-6">
          You don't have permission to access 
          <span class="font-semibold text-gray-900">{{ pageName || 'this page' }}</span>.
          Access permissions for your account are controlled by an Administrator.
        </p>

        <!-- Allowed Pages Quick Links (if any) -->
        <div v-if="accessiblePages.length > 0" class="w-full bg-[#faf8f5] rounded-xl p-4 border border-[#e5e2dc] mb-6 text-left">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-[#e5e2dc]">
            <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Pages You Can Access</span>
            <span class="text-xs font-semibold text-[#1b3b5f]">{{ accessiblePages.length }} available</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <NuxtLink
              v-for="page in accessiblePages"
              :key="page.key"
              :to="page.path"
              class="px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded-lg border border-gray-200 hover:border-[#1b3b5f] hover:text-[#1b3b5f] hover:bg-[#1b3b5f]/5 transition-all flex items-center justify-between group shadow-2xs"
            >
              <span class="truncate">{{ page.label }}</span>
              <ArrowRight class="w-3 h-3 text-gray-400 group-hover:text-[#1b3b5f] group-hover:translate-x-0.5 transition-transform shrink-0 ml-1" />
            </NuxtLink>
          </div>
        </div>

        <div v-else class="w-full bg-amber-50 rounded-xl p-4 border border-amber-200 mb-6 text-left">
          <p class="text-xs text-amber-800">
            No pages are currently assigned to your account. Please notify your administrator to enable access.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center justify-center gap-3 w-full">
          <button 
            @click="goBack" 
            type="button" 
            class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft class="w-4 h-4" />
            Go Back
          </button>

          <NuxtLink 
            v-if="accessiblePages.length > 0"
            :to="primaryAccessiblePath" 
            class="px-5 py-2.5 text-sm font-medium text-white bg-[#1b3b5f] hover:bg-[#132c49] rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <Home class="w-4 h-4" />
            Open {{ primaryAccessibleLabel }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ShieldAlert, Lock, ArrowRight, ArrowLeft, Home } from 'lucide-vue-next'
import { APP_PAGES, getPageKeyFromPath, getEffectiveAllowedPages } from '~/utils/permissions'

const props = defineProps<{
  pageName?: string
}>()

const router = useRouter()
const { user } = useAuth()

const allowedKeys = computed(() => getEffectiveAllowedPages(user.value))

const accessiblePages = computed(() => {
  return APP_PAGES.filter(p => p.key !== 'ADMIN' && allowedKeys.value.includes(p.key))
})

const primaryAccessiblePath = computed(() => {
  if (allowedKeys.value.includes('OVERVIEW')) return '/dashboard'
  return accessiblePages.value[0]?.path || '/dashboard'
})

const primaryAccessibleLabel = computed(() => {
  if (allowedKeys.value.includes('OVERVIEW')) return 'Home'
  return accessiblePages.value[0]?.label || 'Dashboard'
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push(primaryAccessiblePath.value)
  }
}
</script>
