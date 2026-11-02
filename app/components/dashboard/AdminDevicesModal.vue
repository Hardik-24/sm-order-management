<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        
        <!-- Modal Header -->
        <div class="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center border border-[#1b3b5f]/20 shrink-0">
              <ShieldCheck class="w-5 h-5 text-[#1b3b5f]" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base sm:text-lg font-bold text-[#1a1a1a] truncate">
                  Hardware Device Whitelist
                </h3>
                <span 
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                  :class="lockdownMode === 'ENFORCING' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-50 text-amber-800 border-amber-300'"
                >
                  {{ lockdownMode === 'ENFORCING' ? 'Strict Lockdown Active' : 'Lockdown Disabled' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 truncate">
                Only Admin-approved physical devices and hardware chips are permitted to sign in
              </p>
            </div>
          </div>
          <button 
            @click="emit('close')" 
            class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Mode Toggle & Action Banner -->
        <div class="px-4 sm:px-6 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div class="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              :aria-checked="lockdownMode === 'ENFORCING'"
              @click="toggleLockdownMode"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
              :class="lockdownMode === 'ENFORCING' ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                :class="lockdownMode === 'ENFORCING' ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
            <div class="text-xs">
              <span class="font-bold text-gray-900 block">Strict Hardware Lockdown</span>
              <span class="text-gray-500 text-[11px]">
                {{ lockdownMode === 'ENFORCING' ? 'Enforced: Unapproved devices cannot log in.' : 'Warning: Anyone with password can log in from any PC/phone.' }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="openPairingModal"
              class="px-3.5 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <KeyRound class="w-3.5 h-3.5" />
              <span>Pair New Device</span>
            </button>
            <button
              type="button"
              @click="fetchDevices"
              :disabled="isLoading"
              title="Refresh Devices"
              class="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-200 transition cursor-pointer"
            >
              <RefreshCw class="w-4 h-4" :class="isLoading ? 'animate-spin' : ''" />
            </button>
          </div>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          <!-- 1. PENDING APPROVALS SECTION -->
          <div v-if="pendingDevices.length > 0" class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-amber-900">
                Pending Approval Requests ({{ pendingDevices.length }})
              </h4>
            </div>

            <div class="space-y-2.5">
              <div 
                v-for="dev in pendingDevices" 
                :key="dev.id"
                class="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Smartphone v-if="dev.deviceType === 'MOBILE'" class="w-4 h-4" />
                    <Tablet v-else-if="dev.deviceType === 'TABLET'" class="w-4 h-4" />
                    <Monitor v-else class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 space-y-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-bold text-gray-900">{{ dev.deviceName || 'New Device' }}</span>
                      <span class="text-[10px] font-mono px-2 py-0.5 bg-amber-200/80 text-amber-900 font-bold rounded">
                        {{ dev.deviceId }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                      <span>User: <strong class="text-gray-900">{{ dev.user?.name || 'Staff' }}</strong> ({{ dev.user?.role }})</span>
                      <span>•</span>
                      <span>IP: {{ dev.ipAddress || 'Unknown' }}</span>
                      <span v-if="dev.cpuCores">• {{ dev.cpuCores }} Cores</span>
                      <span v-if="dev.screenResolution">• {{ dev.screenResolution }}</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-amber-200/50">
                  <button
                    type="button"
                    @click="approveDevice(dev.deviceId)"
                    :disabled="actionInProgress === dev.deviceId"
                    class="flex-1 sm:flex-initial px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Check class="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    @click="revokeDevice(dev.deviceId, true)"
                    :disabled="actionInProgress === dev.deviceId"
                    class="flex-1 sm:flex-initial px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Ban class="w-3.5 h-3.5" />
                    <span>Block</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. APPROVED DEVICES LIST -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500">
                Authorized Hardware Devices ({{ approvedDevices.length }})
              </h4>
              <span class="text-[11px] text-gray-500">
                1 device per staff member recommended
              </span>
            </div>

            <div v-if="approvedDevices.length === 0" class="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <ShieldCheck class="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
              <p class="text-xs text-gray-600 font-medium">No approved devices yet.</p>
              <p class="text-[11px] text-gray-500 mt-0.5">Your current device will be auto-approved on first admin login.</p>
            </div>

            <div v-else class="space-y-2">
              <div 
                v-for="dev in approvedDevices" 
                :key="dev.id"
                class="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-gray-300 transition-all shadow-2xs"
              >
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 mt-0.5">
                    <Smartphone v-if="dev.deviceType === 'MOBILE'" class="w-4 h-4" />
                    <Tablet v-else-if="dev.deviceType === 'TABLET'" class="w-4 h-4" />
                    <Monitor v-else class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 space-y-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-bold text-gray-900">{{ dev.deviceName || 'Authorized Device' }}</span>
                      <span v-if="dev.deviceId === currentDeviceId" class="text-[10px] font-bold px-2 py-0.5 bg-[#1b3b5f] text-white rounded-full">
                        This Device (You)
                      </span>
                      <span class="text-[10px] font-mono px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {{ dev.deviceId }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span>Owner: <strong class="text-gray-800">{{ dev.user?.name || 'Staff' }}</strong> ({{ dev.user?.role }})</span>
                      <span>•</span>
                      <span>Last Active: {{ formatDate(dev.lastUsedAt) }}</span>
                      <span v-if="dev.ipAddress">• {{ dev.ipAddress }}</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    @click="revokeDevice(dev.deviceId, false)"
                    :disabled="actionInProgress === dev.deviceId || dev.deviceId === currentDeviceId"
                    :title="dev.deviceId === currentDeviceId ? 'Cannot revoke your own active admin session' : 'Revoke device authorization'"
                    class="px-2.5 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                  >
                    Revoke Access
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. BLOCKED DEVICES (if any) -->
          <div v-if="blockedDevices.length > 0" class="space-y-3 pt-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-red-700">
              Blocked Devices ({{ blockedDevices.length }})
            </h4>
            <div class="space-y-2">
              <div 
                v-for="dev in blockedDevices" 
                :key="dev.id"
                class="bg-red-50/50 border border-red-200/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span class="font-bold text-gray-900">{{ dev.deviceName }}</span>
                  <span class="font-mono text-[10px] text-gray-500 ml-2">{{ dev.deviceId }}</span>
                  <p class="text-[11px] text-red-600 mt-0.5">{{ dev.blockedReason || 'Blocked by Admin' }}</p>
                </div>
                <button
                  type="button"
                  @click="deleteDevice(dev.deviceId)"
                  class="text-xs text-gray-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-100 transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  </Teleport>

  <!-- ── Temporary Pairing Code Generator Modal ────────────────────────────── -->
  <Teleport to="body">
    <div v-if="isPairingModalOpen" class="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center">
              <KeyRound class="w-4 h-4 text-[#1b3b5f]" />
            </div>
            <h4 class="text-base font-bold text-gray-900">Generate Pairing Code</h4>
          </div>
          <button @click="isPairingModalOpen = false" class="text-gray-400 hover:text-gray-600 p-1">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-gray-500">
          Generate a one-time 6-digit code for a staff member. When they enter their login and this code on their new phone or PC, their physical hardware is permanently registered and authorized.
        </p>

        <!-- Select User -->
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-gray-700">Select Staff Member</label>
          <select 
            v-model="pairingUserId" 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1b3b5f]/20 focus:outline-none"
          >
            <option value="" disabled>Choose staff member...</option>
            <option v-for="u in usersList" :key="u.id" :value="u.id">
              {{ u.name }} ({{ u.role }} - {{ u.email }})
            </option>
          </select>
        </div>

        <!-- Generated Code Display -->
        <div v-if="generatedPairingCode" class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
          <span class="text-xs text-emerald-800 font-bold uppercase tracking-wider block">One-Time Pairing Code</span>
          <div class="text-3xl font-mono font-black text-[#1b3b5f] tracking-widest py-1">
            {{ generatedPairingCode }}
          </div>
          <p class="text-[11px] text-emerald-700">
            Valid for 15 minutes. Staff member enters this code during login on their new device.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            @click="isPairingModalOpen = false"
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
          >
            Close
          </button>
          <button
            v-if="!generatedPairingCode"
            type="button"
            @click="generatePairingCode"
            :disabled="!pairingUserId || isGeneratingCode"
            class="px-4 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isGeneratingCode" class="w-3.5 h-3.5 animate-spin" />
            <span>Generate Code</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  ShieldCheck,
  X,
  Smartphone,
  Tablet,
  Monitor,
  Check,
  Ban,
  KeyRound,
  RefreshCw,
  Loader2
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useDeviceSecurity } from '~/composables/useDeviceSecurity'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { showSaving, showSaved } = useSnackbar()
const { getPersistentDeviceId } = useDeviceSecurity()

const isLoading = ref(false)
const lockdownMode = ref('ENFORCING')
const devicesList = ref<any[]>([])
const usersList = ref<any[]>([])
const actionInProgress = ref<string | null>(null)
const currentDeviceId = ref('')

// Pairing Modal State
const isPairingModalOpen = ref(false)
const pairingUserId = ref('')
const generatedPairingCode = ref('')
const isGeneratingCode = ref(false)

const pendingDevices = computed(() => devicesList.value.filter(d => !d.isApproved && !d.isBlocked))
const approvedDevices = computed(() => devicesList.value.filter(d => d.isApproved && !d.isBlocked))
const blockedDevices = computed(() => devicesList.value.filter(d => d.isBlocked))

onMounted(async () => {
  currentDeviceId.value = await getPersistentDeviceId()
})

const fetchDevices = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<any>('/api/admin/devices')
    if (data.success) {
      devicesList.value = data.devices || []
      usersList.value = data.users || []
      lockdownMode.value = data.lockdownMode || 'ENFORCING'
    }
  } catch (err) {
    console.error('Failed fetching devices:', err)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    fetchDevices()
  }
})

const toggleLockdownMode = async () => {
  const newMode = lockdownMode.value === 'ENFORCING' ? 'OFF' : 'ENFORCING'
  showSaving()
  try {
    const res = await $fetch<any>('/api/admin/devices/toggle-lockdown', {
      method: 'POST',
      body: { mode: newMode }
    })
    lockdownMode.value = res.lockdownMode
    showSaved(newMode === 'ENFORCING' ? 'Strict Hardware Lockdown Enabled' : 'Hardware Lockdown Disabled')
  } catch (err: any) {
    alert(err?.data?.message || 'Failed updating lockdown mode')
  }
}

const approveDevice = async (deviceId: string) => {
  actionInProgress.value = deviceId
  showSaving()
  try {
    await $fetch('/api/admin/devices/approve', {
      method: 'POST',
      body: { deviceId }
    })
    showSaved('Device approved successfully')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed approving device')
  } finally {
    actionInProgress.value = null
  }
}

const revokeDevice = async (deviceId: string, block = false) => {
  if (!confirm(block ? 'Are you sure you want to permanently BLOCK this device?' : 'Revoke this device authorization?')) return
  actionInProgress.value = deviceId
  showSaving()
  try {
    await $fetch('/api/admin/devices/revoke', {
      method: 'POST',
      body: { deviceId, block }
    })
    showSaved(block ? 'Device blocked' : 'Device authorization revoked')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed revoking device')
  } finally {
    actionInProgress.value = null
  }
}

const deleteDevice = async (deviceId: string) => {
  if (!confirm('Permanently remove this device record?')) return
  actionInProgress.value = deviceId
  try {
    await $fetch('/api/admin/devices/revoke', {
      method: 'POST',
      body: { deviceId, delete: true }
    })
    showSaved('Device record deleted')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed deleting device')
  } finally {
    actionInProgress.value = null
  }
}

const openPairingModal = () => {
  pairingUserId.value = ''
  generatedPairingCode.value = ''
  isPairingModalOpen.value = true
}

const generatePairingCode = async () => {
  if (!pairingUserId.value) return
  isGeneratingCode.value = true
  try {
    const res = await $fetch<any>('/api/admin/devices/pair', {
      method: 'POST',
      body: { userId: pairingUserId.value }
    })
    generatedPairingCode.value = res.code
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed generating code')
  } finally {
    isGeneratingCode.value = false
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never'
  const d = new Date(dateString)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}
</script>
