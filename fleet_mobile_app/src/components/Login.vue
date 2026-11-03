<template>
  <div class="min-h-screen bg-[#1b3b5f] flex flex-col justify-center items-center p-4 sm:p-6 text-white font-sans">
    <div class="w-full max-w-sm bg-white text-[#1a1a1a] rounded-2xl shadow-2xl p-6 sm:p-8">
      <div class="text-center mb-6">
        <img src="/icon.png" alt="SM Fleet" class="w-16 h-16 mx-auto mb-3 rounded-2xl shadow-md" />
        <h1 class="text-2xl font-bold text-[#1b3b5f] tracking-widest">SM FLEET</h1>
        <p class="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Driver Mobile Terminal</p>
      </div>

      <!-- Remote Revocation / Account Deleted Banner -->
      <div v-if="reasonMsg" class="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
        <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div class="leading-relaxed font-medium">
          {{ reasonMsg }}
        </div>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Driver Email</label>
          <input 
            v-model="email" 
            type="email" 
            required
            class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b3b5f] transition-all"
            placeholder="driver@siliconmarketing.com"
          >
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
          <input 
            v-model="password" 
            type="password" 
            required
            class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b3b5f] transition-all"
            placeholder="••••••••"
          >
        </div>

        <!-- Generic Error Message (Only when not device pending) -->
        <div v-if="errorMsg && !isDevicePending" class="text-rose-600 text-xs text-center font-medium bg-rose-50 border border-rose-100 py-2.5 px-3 rounded-xl">
          {{ errorMsg }}
        </div>

        <!-- Hardware Device Approval Required Card -->
        <div v-if="isDevicePending" class="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <div class="flex items-start gap-2.5">
            <ShieldAlert class="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 class="text-xs font-bold text-amber-900">Device Approval Required</h4>
              <p class="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                This device is awaiting Admin authorization. Share your Device ID with an administrator or enter a 6-digit pairing code.
              </p>
            </div>
          </div>

          <!-- Detected Phone Model Badge -->
          <div v-if="devicePayload?.name" class="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100/80 border border-amber-300/80 rounded-lg text-[10px] font-bold text-amber-950">
            <span class="text-amber-800">📱 Device:</span>
            <span class="truncate font-extrabold">{{ devicePayload.name }}</span>
          </div>

          <!-- Copyable Device ID Box -->
          <div class="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2 shadow-2xs">
            <span class="font-mono text-[11px] font-bold text-gray-800 truncate mr-2">{{ pendingDeviceId }}</span>
            <button 
              type="button" 
              @click="copyDeviceId" 
              class="flex items-center gap-1 text-[11px] font-bold text-[#1b3b5f] hover:text-[#132c49] shrink-0 cursor-pointer"
            >
              <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span>{{ copied ? 'COPIED' : 'COPY' }}</span>
            </button>
          </div>

          <!-- Pairing Code Section -->
          <div class="pt-1 border-t border-amber-200/60">
            <div v-if="!showPairingInput">
              <button 
                type="button" 
                @click="showPairingInput = true" 
                class="w-full text-center text-xs font-bold text-[#1b3b5f] hover:underline flex items-center justify-center gap-1.5 py-1 cursor-pointer"
              >
                <KeyRound class="w-3.5 h-3.5" />
                <span>Have a 6-digit pairing code?</span>
              </button>
            </div>

            <div v-else class="space-y-2 pt-1">
              <label class="block text-[10px] font-bold uppercase tracking-wider text-amber-900">Enter Admin Pairing Code</label>
              <div class="flex gap-2">
                <input 
                  v-model="pairingCode" 
                  type="text" 
                  maxlength="6"
                  placeholder="e.g. 849201" 
                  class="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 text-center font-mono font-bold text-sm tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]"
                />
                <button 
                  type="submit" 
                  :disabled="loading || !pairingCode.trim()"
                  class="px-4 py-2 bg-[#1b3b5f] text-white text-xs font-bold rounded-lg hover:bg-[#132c49] disabled:opacity-50 transition cursor-pointer"
                >
                  Authorize
                </button>
              </div>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full bg-[#1b3b5f] hover:bg-[#132c49] text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-md flex items-center justify-center gap-2 mt-4 cursor-pointer"
        >
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <span>{{ loading ? 'AUTHENTICATING...' : (isDevicePending ? 'CHECK AUTHORIZATION' : 'SIGN IN') }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  ShieldAlert,
  AlertTriangle,
  KeyRound,
  Copy,
  Check,
  Loader2
} from 'lucide-vue-next'
import { useDeviceSecurity, type DevicePayload } from '../composables/useDeviceSecurity'
import { useNetworkDiagnostics } from '../composables/useNetworkDiagnostics'

const props = defineProps<{
  reasonMsg?: string
}>()

const emit = defineEmits<{
  (e: 'login-success', payload: { user: any; token: string }): void
}>()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

// Hardware Lockdown States
const isDevicePending = ref(false)
const pendingDeviceId = ref('')
const pairingCode = ref('')
const showPairingInput = ref(false)
const copied = ref(false)
const devicePayload = ref<DevicePayload | null>(null)

const { detectDevice } = useDeviceSecurity()

// Live API endpoint
const API_URL = 'https://sm-order-management.vercel.app'

onMounted(async () => {
  try {
    devicePayload.value = await detectDevice()
  } catch (err) {
    console.warn('[DeviceSecurity] Failed to detect hardware fingerprint:', err)
  }
})

function copyDeviceId() {
  if (pendingDeviceId.value) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(pendingDeviceId.value)
    }
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  
  try {
    const dev = devicePayload.value || (await detectDevice().catch(() => null))
    const payloadToSend: any = dev ? { ...dev } : {}
    if (pairingCode.value.trim()) {
      payloadToSend.pairingCode = pairingCode.value.trim().toUpperCase()
    }

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.value.trim().toLowerCase(),
        password: password.value,
        device: payloadToSend
      })
    })
    
    const data = await res.json().catch(() => ({}))
    
    if (!res.ok) {
      const isDeviceIssue = 
        res.status === 403 || 
        data?.data?.code === 'DEVICE_NOT_APPROVED' || 
        data?.code === 'DEVICE_NOT_APPROVED' ||
        String(data?.message || '').toLowerCase().includes('device')

      if (isDeviceIssue) {
        isDevicePending.value = true
        pendingDeviceId.value = data?.data?.deviceId || dev?.id || 'DEV-MOBILE'
        errorMsg.value = data?.data?.message || data?.message || 'Device approval required by Administrator.'
        return
      }

      throw new Error(data?.message || data?.data?.message || 'Login failed')
    }
    
    if (data.token) {
      emit('login-success', { user: data.user, token: data.token })
    } else {
      throw new Error('No token received from server')
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'An error occurred during sign in'
  } finally {
    loading.value = false
  }
}
</script>
