<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div class="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Bell class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">Push Notification Diagnostics</h3>
            <p class="text-xs text-gray-500">Live Firebase and device registration debug panel</p>
          </div>
        </div>
        <button @click="$emit('close')" data-modal-close="true" title="Close (Esc)" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-5 overflow-y-auto">
        <!-- Status Grid -->
        <div class="grid grid-cols-2 gap-3 text-xs">
          <!-- Container -->
          <div class="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
            <span class="text-gray-500">Container Mode</span>
            <div class="mt-1 flex items-center gap-1.5 font-bold">
              <span v-if="state.isOMSApp" class="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" /> Android App
              </span>
              <span v-else class="text-amber-700 flex items-center gap-1">
                <AlertCircle class="w-3.5 h-3.5 text-amber-600" /> Web Browser
              </span>
            </div>
          </div>

          <!-- Capacitor Bridge -->
          <div class="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
            <span class="text-gray-500">Native Bridge</span>
            <div class="mt-1 flex items-center gap-1.5 font-bold">
              <span v-if="state.isNativePlatform" class="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" /> Active
              </span>
              <span v-else class="text-gray-600">
                Unavailable
              </span>
            </div>
          </div>

          <!-- Permission -->
          <div class="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
            <span class="text-gray-500">Notification Permission</span>
            <div class="mt-1 flex items-center gap-1.5 font-bold">
              <span v-if="state.permission === 'granted'" class="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" /> Granted
              </span>
              <span v-else-if="state.permission === 'denied'" class="text-rose-700 flex items-center gap-1">
                <XCircle class="w-3.5 h-3.5 text-rose-600" /> Denied
              </span>
              <span v-else class="text-amber-700 flex items-center gap-1">
                <AlertCircle class="w-3.5 h-3.5 text-amber-600" /> {{ state.permission }}
              </span>
            </div>
          </div>

          <!-- FCM Token -->
          <div class="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
            <span class="text-gray-500">FCM Push Token</span>
            <div class="mt-1 font-bold truncate">
              <span v-if="state.token" class="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span class="truncate font-mono">{{ state.token.slice(0, 12) }}...</span>
              </span>
              <span v-else class="text-gray-500 italic">Not registered</span>
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button
            @click="handleRegister"
            :disabled="state.isRunning"
            class="flex-1 min-w-[180px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': state.isRunning }" />
            {{ state.token ? 'Re-register FCM Token' : 'Register Push Notifications' }}
          </button>

          <button
            @click="handleSendTest"
            class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Send class="w-4 h-4" />
            Send Test Push
          </button>

          <button
            @click="copyLogs"
            class="px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy logs to clipboard"
          >
            <Copy class="w-4 h-4" />
            <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
          </button>
        </div>

        <!-- Live Diagnostics Terminal / Log -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span>Diagnostics Log</span>
            <button @click="clearLogs" class="text-gray-400 hover:text-gray-600 text-[11px]">Clear</button>
          </div>
          <div class="bg-gray-900 text-gray-200 rounded-xl p-3.5 font-mono text-xs max-h-48 overflow-y-auto space-y-1 shadow-inner">
            <div v-if="logs.length === 0" class="text-gray-500 italic text-[11px]">
              No events logged yet. Tap "Register Push Notifications" above to test.
            </div>
            <div v-for="(log, idx) in logs" :key="idx" class="leading-relaxed flex items-start gap-2">
              <span class="text-gray-500 text-[10px] shrink-0">[{{ log.time }}]</span>
              <span
                :class="{
                  'text-emerald-400': log.level === 'success',
                  'text-rose-400': log.level === 'error',
                  'text-amber-300': log.level === 'warn',
                  'text-gray-300': log.level === 'info'
                }"
                class="break-all"
              >
                {{ log.text }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
        <button @click="$emit('close')" class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
          Close
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Bell, X, CheckCircle2, AlertCircle, XCircle, RefreshCw, Send, Copy } from 'lucide-vue-next'
import { usePushDiagnostics } from '~/composables/usePushDiagnostics'

const props = defineProps<{
  isOpen: boolean
}>()

defineEmits<{
  (e: 'close'): void
}>()

const { state, logs, checkStatus, registerPush, sendTestPush, addLog } = usePushDiagnostics()
const copied = ref(false)

const handleRegister = async () => {
  await registerPush()
}

const handleSendTest = async () => {
  await sendTestPush()
}

const clearLogs = () => {
  logs.value = []
}

const copyLogs = async () => {
  const content = [
    `--- SM FLOW PUSH DIAGNOSTICS ---`,
    `Time: ${new Date().toISOString()}`,
    `Container: ${state.isOMSApp ? 'Android App' : 'Browser'}`,
    `Native Bridge: ${state.isNativePlatform ? 'Connected' : 'No'}`,
    `Permission: ${state.permission}`,
    `Token: ${state.token || 'None'}`,
    `Last Error: ${state.lastError || 'None'}`,
    `\n--- LOGS ---`,
    ...logs.value.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.text}`)
  ].join('\n')

  try {
    await navigator.clipboard.writeText(content)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    checkStatus()
  }
})

onMounted(() => {
  if (props.isOpen) {
    checkStatus()
  }
})
</script>
