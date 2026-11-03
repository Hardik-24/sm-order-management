<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform -translate-y-8 opacity-0 scale-95"
    enter-to-class="transform translate-y-0 opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100 scale-100"
    leave-to-class="transform -translate-y-8 opacity-0 scale-95"
  >
    <div 
      v-if="currentStatus !== 'IDLE'" 
      class="fixed inset-x-0 z-[9999] pointer-events-none flex justify-center px-3"
      :style="{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }"
    >
      <div 
        class="pointer-events-auto w-full max-w-sm rounded-2xl shadow-2xl backdrop-blur-md border px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-all"
        :class="themeClasses"
      >
        <!-- Icon & Status -->
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-xl shadow-xs" :class="iconBadgeClasses">
            <WifiOff v-if="currentStatus === 'OFFLINE'" class="w-4 h-4 text-rose-600 animate-pulse" />
            <Wifi v-else-if="currentStatus === 'CLIENT_SLOW'" class="w-4 h-4 text-amber-600" />
            <Database v-else-if="currentStatus === 'SERVER_SLOW'" class="w-4 h-4 text-sky-400 animate-pulse" />
            <ServerCrash v-else-if="currentStatus === 'SERVER_ERROR'" class="w-4 h-4 text-rose-600" />
            <CheckCircle2 v-else-if="currentStatus === 'RECONNECTED'" class="w-4 h-4 text-emerald-600" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold tracking-tight truncate" :class="titleColorClass">
                {{ statusTitle }}
              </span>
              <span 
                class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                :class="pillTagClasses"
              >
                {{ statusTag }}
              </span>
            </div>
            <p class="text-[11px] leading-tight mt-0.5 line-clamp-2" :class="descColorClass">
              {{ diagnosticDetails || defaultDescription }}
            </p>
          </div>
        </div>

        <!-- Action / Dismiss -->
        <div class="flex items-center gap-1 shrink-0">
          <button 
            v-if="currentStatus !== 'RECONNECTED'"
            type="button" 
            @click="handleRetry" 
            :disabled="isRetrying"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            :class="retryButtonClasses"
            title="Retry"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isRetrying }" />
            <span>{{ isRetrying ? 'Testing' : 'Retry' }}</span>
          </button>

          <button 
            type="button" 
            @click="dismiss" 
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Wifi,
  WifiOff,
  Database,
  ServerCrash,
  CheckCircle2,
  RefreshCw,
  X
} from 'lucide-vue-next'
import { useNetworkDiagnostics } from '../composables/useNetworkDiagnostics'

const { currentStatus, diagnosticDetails, runDiagnostics, clearStatus } = useNetworkDiagnostics()

const isRetrying = ref(false)

const handleRetry = async () => {
  isRetrying.value = true
  try {
    await runDiagnostics()
  } finally {
    setTimeout(() => {
      isRetrying.value = false
    }, 500)
  }
}

const dismiss = () => {
  clearStatus(false)
}

const statusTitle = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
      return 'No Mobile Signal'
    case 'CLIENT_SLOW':
      return 'Weak Signal Detected'
    case 'SERVER_SLOW':
      return 'Cloud Database Slow'
    case 'SERVER_ERROR':
      return 'Server Unavailable'
    case 'RECONNECTED':
      return 'Signal Restored'
    default:
      return 'Connecting'
  }
})

const statusTag = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
      return 'Device Offline'
    case 'CLIENT_SLOW':
      return 'Cellular Data'
    case 'SERVER_SLOW':
      return 'Cloud Server'
    case 'SERVER_ERROR':
      return 'Cloud Error'
    case 'RECONNECTED':
      return 'Online'
    default:
      return 'Status'
  }
})

const defaultDescription = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
      return 'Driver device is disconnected from cellular network.'
    case 'CLIENT_SLOW':
      return 'Elevator, basement, or poor coverage area detected.'
    case 'SERVER_SLOW':
      return 'Your phone internet is active, but Supabase is taking longer than usual.'
    case 'SERVER_ERROR':
      return 'Could not establish connection to the cloud backend.'
    case 'RECONNECTED':
      return 'Mobile connection is fully operational.'
    default:
      return ''
  }
})

const themeClasses = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
      return 'bg-white/95 border-rose-200 text-gray-900 ring-1 ring-rose-500/20'
    case 'CLIENT_SLOW':
      return 'bg-white/95 border-amber-200 text-gray-900 ring-1 ring-amber-500/20'
    case 'SERVER_SLOW':
      return 'bg-[#0f2744]/95 border-sky-800 text-white shadow-2xl'
    case 'SERVER_ERROR':
      return 'bg-white/95 border-rose-300 text-gray-900 ring-1 ring-rose-500/30'
    case 'RECONNECTED':
      return 'bg-white/95 border-emerald-200 text-gray-900 ring-1 ring-emerald-500/20'
    default:
      return 'bg-white/95 border-gray-200 text-gray-900'
  }
})

const iconBadgeClasses = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
      return 'bg-rose-50 border border-rose-200'
    case 'CLIENT_SLOW':
      return 'bg-amber-50 border border-amber-200'
    case 'SERVER_SLOW':
      return 'bg-sky-950/80 border border-sky-700'
    case 'SERVER_ERROR':
      return 'bg-rose-50 border border-rose-200'
    case 'RECONNECTED':
      return 'bg-emerald-50 border border-emerald-200'
    default:
      return 'bg-gray-50 border border-gray-200'
  }
})

const titleColorClass = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
    case 'SERVER_ERROR':
      return 'text-rose-950'
    case 'CLIENT_SLOW':
      return 'text-amber-950'
    case 'SERVER_SLOW':
      return 'text-white'
    case 'RECONNECTED':
      return 'text-emerald-950'
    default:
      return 'text-gray-950'
  }
})

const descColorClass = computed(() => {
  switch (currentStatus.value) {
    case 'SERVER_SLOW':
      return 'text-sky-200/90'
    case 'OFFLINE':
    case 'SERVER_ERROR':
      return 'text-rose-800'
    case 'CLIENT_SLOW':
      return 'text-amber-800'
    case 'RECONNECTED':
      return 'text-emerald-800'
    default:
      return 'text-gray-600'
  }
})

const pillTagClasses = computed(() => {
  switch (currentStatus.value) {
    case 'OFFLINE':
    case 'SERVER_ERROR':
      return 'bg-rose-100 text-rose-800 border border-rose-200'
    case 'CLIENT_SLOW':
      return 'bg-amber-100 text-amber-900 border border-amber-200'
    case 'SERVER_SLOW':
      return 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
    case 'RECONNECTED':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    default:
      return 'bg-gray-100 text-gray-700'
  }
})

const retryButtonClasses = computed(() => {
  switch (currentStatus.value) {
    case 'SERVER_SLOW':
      return 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
    case 'OFFLINE':
    case 'SERVER_ERROR':
      return 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
    case 'CLIENT_SLOW':
      return 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
    default:
      return 'bg-[#1b3b5f] hover:bg-[#132c49] text-white shadow-xs'
  }
})
</script>
