<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] md:max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        
        <!-- Modal Top Header -->
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
                Organized account-wise • Only Admin-approved physical devices can sign in
              </p>
            </div>
          </div>
          <button 
            @click="emit('close')" 
            data-modal-close="true"
            title="Close"
            class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Mode Toggle & Action Banner -->
        <div class="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap shrink-0">
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
                {{ lockdownMode === 'ENFORCING' ? 'Active: Unapproved devices cannot log in.' : 'Disabled: Any device can log in with password.' }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="confirmLogoutAllOthers"
              :disabled="isLoggingOutOthers"
              class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Log out all accounts from all devices except your current session"
            >
              <LogOut class="w-3.5 h-3.5" />
              <span>Log Out All Others</span>
            </button>
            <button
              type="button"
              @click="openPairingModal()"
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

        <!-- Search & Filter Controls -->
        <div class="px-3 sm:px-6 py-2.5 bg-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <!-- Search Input -->
          <div class="relative w-full md:flex-1 md:min-w-[200px]">
            <Search class="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              v-model="searchQuery"
              type="text"
              placeholder="Search by staff name, email, or device ID..."
              class="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:bg-white transition-all text-gray-900"
            />
          </div>

          <!-- Filter Bars (Horizontally scrollable on small screens) -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto overflow-hidden">
            <!-- Status Filters (Scrollable on small screens) -->
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto shrink-0 touch-pan-x">
              <button
                type="button"
                @click="selectedStatusFilter = 'ALL'"
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                :class="selectedStatusFilter === 'ALL' 
                  ? 'bg-[#1b3b5f] text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100 bg-transparent'"
              >
                All Devices
              </button>
              <button
                type="button"
                @click="selectedStatusFilter = 'PENDING'"
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0"
                :class="selectedStatusFilter === 'PENDING' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : (allPendingDevices.length > 0 ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100' : 'text-gray-600 hover:bg-gray-100 bg-transparent')"
              >
                <span v-if="allPendingDevices.length > 0" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                <span>Pending ({{ allPendingDevices.length }})</span>
              </button>
              <button
                type="button"
                @click="selectedStatusFilter = 'APPROVED'"
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                :class="selectedStatusFilter === 'APPROVED' 
                  ? 'bg-emerald-700 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100 bg-transparent'"
              >
                Approved ({{ totalApprovedDevicesCount }})
              </button>
              <button
                type="button"
                @click="selectedStatusFilter = 'BLOCKED'"
                class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                :class="selectedStatusFilter === 'BLOCKED' 
                  ? 'bg-red-700 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100 bg-transparent'"
              >
                Blocked ({{ totalBlockedCount }})
              </button>
            </div>

            <!-- Role Filters (Scrollable on small screens) -->
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto shrink-0 sm:border-l sm:border-gray-200 sm:pl-2.5 touch-pan-x">
              <button
                v-for="role in ['ALL', 'ADMIN', 'SALES', 'BILLING', 'PACKING', 'DELIVERY']"
                :key="role"
                type="button"
                @click="selectedRoleFilter = role"
                class="px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                :class="selectedRoleFilter === role 
                  ? 'bg-gray-900 text-white shadow-xs' 
                  : 'text-gray-500 hover:bg-gray-100 bg-transparent'"
              >
                {{ role === 'ALL' ? 'All Roles' : role }}
              </button>
            </div>
          </div>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50/50">

          <!-- 1. PENDING APPROVAL REQUESTS (High Priority Banner if any exist) -->
          <div v-if="allPendingDevices.length > 0" class="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-amber-500 animate-ping"></div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Pending Authorization Requests ({{ allPendingDevices.length }})
                </h4>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="clearAllPendingRequests"
                  :disabled="isClearingPending || allPendingDevices.length === 0"
                  class="px-2.5 py-1 text-xs font-bold text-red-700 bg-white hover:bg-red-50 rounded-lg border border-red-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Discard all pending device authorization requests"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Clear All Requests</span>
                </button>
                <span class="text-[11px] font-bold text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                  Action Required
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div 
                v-for="dev in allPendingDevices" 
                :key="dev.id"
                class="bg-white border border-amber-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Smartphone v-if="dev.deviceType === 'MOBILE'" class="w-4 h-4" />
                      <Tablet v-else-if="dev.deviceType === 'TABLET'" class="w-4 h-4" />
                      <Monitor v-else class="w-4 h-4" />
                    </div>
                    <div class="min-w-0">
                      <span class="text-xs font-bold text-gray-900 truncate block">{{ dev.deviceName || 'New Device' }}</span>
                      <span class="text-[10px] text-gray-500 font-mono">{{ dev.deviceId }}</span>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                    {{ dev.user?.name || 'Staff' }}
                  </span>
                </div>

                <div class="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                  <span>Role: <strong>{{ dev.user?.role }}</strong></span>
                  <span>•</span>
                  <span>IP: {{ dev.ipAddress || 'Unknown' }}</span>
                  <span v-if="dev.cpuCores">• {{ dev.cpuCores }} Cores</span>
                </div>

                <div class="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    @click="approveDevice(dev.deviceId)"
                    :disabled="actionInProgress === dev.deviceId"
                    class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Check class="w-3.5 h-3.5" />
                    <span>Approve Access</span>
                  </button>
                  <button
                    type="button"
                    @click="revokeDevice(dev.deviceId, true)"
                    :disabled="actionInProgress === dev.deviceId"
                    class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    Block
                  </button>
                  <button
                    type="button"
                    @click="discardPendingDevice(dev.deviceId)"
                    :disabled="actionInProgress === dev.deviceId"
                    title="Discard / Reject Request"
                    class="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg border border-gray-200 transition cursor-pointer disabled:opacity-50"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. USER-WISE GROUPED SECTION -->
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs text-gray-500 px-1">
              <span class="font-bold uppercase tracking-wider">
                Accounts & Enrolled Hardware ({{ filteredUsersWithDevices.length }} {{ filteredUsersWithDevices.length === 1 ? 'Account' : 'Accounts' }})
              </span>
              <span>
                {{ totalApprovedDevicesCount }} Total Devices Whitelisted
              </span>
            </div>

            <!-- Empty search state -->
            <div v-if="filteredUsersWithDevices.length === 0" class="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
              <Users class="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
              <p class="text-xs text-gray-600 font-medium">No accounts match your search filter.</p>
              <button 
                type="button" 
                @click="searchQuery = ''; selectedRoleFilter = 'ALL'" 
                class="text-xs text-[#1b3b5f] font-bold mt-2 hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            </div>

            <!-- User Cards -->
            <div 
              v-for="u in filteredUsersWithDevices" 
              :key="u.id"
              class="bg-white border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 transition-all hover:border-gray-300"
              :class="u.hasPending ? 'border-amber-300 ring-2 ring-amber-300/30' : 'border-gray-200'"
            >
              <!-- User Account Header -->
              <div class="flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 pb-3">
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Avatar Initial -->
                  <div class="w-10 h-10 rounded-full bg-[#1b3b5f]/10 text-[#1b3b5f] font-black text-sm flex items-center justify-center border border-[#1b3b5f]/20 shrink-0">
                    {{ u.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h5 class="text-sm font-bold text-gray-900 truncate">{{ u.name }}</h5>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="userRoleColors[u.role] || 'bg-gray-100 text-gray-700'">
                        {{ u.role }}
                      </span>
                      <span v-if="u.isActive === false" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Inactive Account
                      </span>
                      <span v-if="u.id === currentUserId" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1b3b5f] text-white">
                        You (Primary Admin)
                      </span>
                      <span v-if="u.hasPending" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                        Pending Request
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 font-mono mt-0.5 truncate">{{ u.email }}</p>
                  </div>
                </div>

                <!-- Right: Device Count & Quick Pair Button -->
                <div class="flex items-center gap-2">
                  <span 
                    class="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                    :class="u.approvedDevices.length > 0 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : 'bg-gray-50 text-gray-500 border-gray-200'"
                  >
                    {{ u.approvedDevices.length }} {{ u.approvedDevices.length === 1 ? 'Device' : 'Devices' }} Authorized
                  </span>
                  <button
                    type="button"
                    @click="openPairingModal(u.id)"
                    class="px-2.5 py-1 text-xs font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 hover:bg-[#1b3b5f]/20 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Generate pairing code for this account"
                  >
                    <KeyRound class="w-3.5 h-3.5" />
                    <span class="hidden sm:inline">Pair Device</span>
                  </button>
                </div>
              </div>

              <!-- User's Enrolled Devices -->
              <div v-if="u.devices.length === 0" class="text-center py-5 bg-gray-50/70 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">
                No physical devices enrolled for {{ u.name }} yet.
              </div>

              <div v-else class="space-y-2">
                <div 
                  v-for="dev in u.devices" 
                  :key="dev.id"
                  class="rounded-xl p-3 border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                  :class="[
                    dev.isBlocked ? 'bg-red-50/40 border-red-200 text-red-900' :
                    (!dev.isApproved ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300/40' : 'bg-gray-50/60 border-gray-200 hover:bg-gray-50')
                  ]"
                >
                  <div class="flex items-start gap-3 min-w-0">
                    <div 
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border"
                      :class="dev.isApproved 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : (dev.isBlocked ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200')"
                    >
                      <Smartphone v-if="dev.deviceType === 'MOBILE'" class="w-4 h-4" />
                      <Tablet v-else-if="dev.deviceType === 'TABLET'" class="w-4 h-4" />
                      <Monitor v-else class="w-4 h-4" />
                    </div>

                    <div class="min-w-0 space-y-0.5">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-gray-900 text-xs">{{ dev.deviceName || 'Authorized Device' }}</span>
                        <span v-if="dev.deviceId === currentDeviceId" class="text-[9px] font-bold px-1.5 py-0.2 bg-[#1b3b5f] text-white rounded">
                          Current Device
                        </span>
                        <span 
                          class="font-mono text-[10px] px-1.5 py-0.5 rounded border"
                          :class="dev.isApproved 
                            ? 'bg-white text-gray-600 border-gray-200' 
                            : 'bg-amber-200 text-amber-900 border-amber-300 font-bold'"
                        >
                          {{ dev.deviceId }}
                        </span>
                        <span v-if="!dev.isApproved && !dev.isBlocked" class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded">
                          Pending Approval
                        </span>
                        <span v-if="dev.isBlocked" class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded">
                          Blocked
                        </span>
                      </div>

                      <div class="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                        <span>Last Active: {{ formatDate(dev.lastUsedAt) }}</span>
                        <span v-if="dev.ipAddress">• IP: {{ dev.ipAddress }}</span>
                        <span v-if="dev.cpuCores">• {{ dev.cpuCores }} Cores</span>
                        <span v-if="dev.screenResolution">• {{ dev.screenResolution }}</span>
                        <span v-if="dev.gpuRenderer" class="truncate max-w-[200px]" :title="dev.gpuRenderer">• {{ dev.gpuRenderer }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions for this device -->
                  <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <!-- Pending Actions -->
                    <template v-if="!dev.isApproved && !dev.isBlocked">
                      <button
                        type="button"
                        @click="approveDevice(dev.deviceId)"
                        :disabled="actionInProgress === dev.deviceId"
                        class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Check class="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        @click="revokeDevice(dev.deviceId, true)"
                        :disabled="actionInProgress === dev.deviceId"
                        class="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        @click="discardPendingDevice(dev.deviceId)"
                        :disabled="actionInProgress === dev.deviceId"
                        title="Discard / Reject Request"
                        class="p-1 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg border border-gray-200 transition cursor-pointer disabled:opacity-50"
                      >
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </template>

                    <!-- Approved Device Actions -->
                    <template v-else-if="dev.isApproved">
                      <button
                        type="button"
                        @click="revokeDevice(dev.deviceId, false)"
                        :disabled="actionInProgress === dev.deviceId || dev.deviceId === currentDeviceId"
                        :title="dev.deviceId === currentDeviceId ? 'Cannot revoke your own active admin session' : 'Revoke device authorization'"
                        class="px-2.5 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                      >
                        Revoke Access
                      </button>
                    </template>

                    <!-- Blocked Device Actions -->
                    <template v-else-if="dev.isBlocked">
                      <button
                        type="button"
                        @click="approveDevice(dev.deviceId)"
                        class="px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer font-bold"
                      >
                        Unblock
                      </button>
                      <button
                        type="button"
                        @click="deleteDevice(dev.deviceId)"
                        class="px-2.5 py-1 text-xs text-gray-400 hover:text-red-700 rounded-lg transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  </Teleport>

  <!-- ── Temporary Pairing Code Generator Modal ────────────────────────────── -->
  <Teleport to="body">
    <div v-if="isPairingModalOpen" class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-black/60 backdrop-blur-xs">
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

        <p class="text-xs text-gray-500 leading-relaxed">
          Generate a one-time 6-digit code for a staff member. When they enter their login and this code on their new phone or PC, their physical hardware is permanently registered and authorized.
        </p>

        <!-- Select User (Custom Styled Combobox) -->
        <div class="space-y-1.5 relative">
          <label class="block text-xs font-bold text-gray-700">Select Staff Member</label>
          
          <!-- Custom Trigger Button -->
          <button
            type="button"
            @click="isStaffDropdownOpen = !isStaffDropdownOpen"
            class="w-full px-3.5 py-2.5 border rounded-xl text-left bg-white transition flex items-center justify-between gap-2 shadow-2xs hover:border-[#1b3b5f]/40 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 cursor-pointer"
            :class="isStaffDropdownOpen ? 'border-[#1b3b5f] ring-2 ring-[#1b3b5f]/10' : 'border-gray-200'"
          >
            <div v-if="selectedStaffUser" class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-[#1b3b5f]/10 text-[#1b3b5f] font-black text-xs flex items-center justify-center shrink-0 border border-[#1b3b5f]/20">
                {{ selectedStaffUser.name.charAt(0) }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-gray-900 truncate">{{ selectedStaffUser.name }}</span>
                  <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full border" :class="userRoleColors[selectedStaffUser.role] || 'bg-gray-100 text-gray-700'">
                    {{ selectedStaffUser.role }}
                  </span>
                </div>
                <span class="text-[10px] text-gray-500 font-mono block truncate">{{ selectedStaffUser.email }}</span>
              </div>
            </div>
            <div v-else class="flex items-center gap-2 text-gray-400 text-xs py-1">
              <Users class="w-4 h-4 text-gray-400" />
              <span>Choose staff member...</span>
            </div>
            
            <ChevronDown class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" :class="isStaffDropdownOpen ? 'rotate-180 text-[#1b3b5f]' : ''" />
          </button>

          <!-- Click catcher backdrop when dropdown open -->
          <div v-if="isStaffDropdownOpen" class="fixed inset-0 z-40" @click="isStaffDropdownOpen = false"></div>

          <!-- Custom Dropdown Menu -->
          <div 
            v-if="isStaffDropdownOpen" 
            class="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 space-y-2"
          >
            <!-- Quick Search Input -->
            <div class="relative">
              <Search class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                v-model="staffSearchQuery"
                type="text"
                placeholder="Search staff name, email, or role..."
                class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1b3b5f] focus:bg-white text-gray-900"
              />
            </div>

            <!-- Scrollable Staff Options -->
            <div class="max-h-52 overflow-y-auto space-y-1 pr-1">
              <button
                v-for="u in filteredStaffList"
                :key="u.id"
                type="button"
                @click="selectStaff(u.id)"
                class="w-full p-2 rounded-lg text-left transition flex items-center justify-between gap-2 cursor-pointer group"
                :class="pairingUserId === u.id ? 'bg-[#1b3b5f]/10 text-[#1b3b5f]' : 'hover:bg-gray-50 text-gray-700'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div 
                    class="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border"
                    :class="pairingUserId === u.id ? 'bg-[#1b3b5f] text-white border-transparent' : 'bg-gray-100 text-gray-700 border-gray-200 group-hover:bg-white'"
                  >
                    {{ u.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900 truncate">{{ u.name }}</span>
                      <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full border" :class="userRoleColors[u.role] || 'bg-gray-100 text-gray-700'">
                        {{ u.role }}
                      </span>
                      <span v-if="u.isActive === false" class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Inactive
                      </span>
                    </div>
                    <span class="text-[10px] text-gray-400 font-mono block truncate">{{ u.email }}</span>
                  </div>
                </div>

                <Check v-if="pairingUserId === u.id" class="w-4 h-4 text-[#1b3b5f] shrink-0" />
              </button>

              <div v-if="filteredStaffList.length === 0" class="text-center py-4 text-xs text-gray-400">
                No staff members match "{{ staffSearchQuery }}"
              </div>
            </div>
          </div>
        </div>

        <!-- Generated Code Display -->
        <div v-if="generatedPairingCode" class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 animate-in fade-in zoom-in-95 duration-200">
          <span class="text-xs text-emerald-800 font-bold uppercase tracking-wider block">One-Time Pairing Code</span>
          <div class="text-3xl font-mono font-black text-[#1b3b5f] tracking-widest py-1 select-all">
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
  Loader2,
  Users,
  Search,
  LogOut,
  Trash2,
  ChevronDown
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useDeviceSecurity } from '~/composables/useDeviceSecurity'
import { useAuth } from '~/composables/useAuth'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { user } = useAuth()
const { showSaving, showSaved } = useSnackbar()
const { getPersistentDeviceId } = useDeviceSecurity()
const { notifyChange } = useRealtimeSync()

const isLoading = ref(false)
const lockdownMode = ref('ENFORCING')
const devicesList = ref<any[]>([])
const usersList = ref<any[]>([])
const actionInProgress = ref<string | null>(null)
const currentDeviceId = ref('')
const currentUserId = computed(() => user.value?.id || '')

// Search and Filter State
const searchQuery = ref('')
const selectedRoleFilter = ref('ALL')
const selectedStatusFilter = ref<'ALL' | 'PENDING' | 'APPROVED' | 'BLOCKED'>('ALL')

// Pairing Modal State
const isPairingModalOpen = ref(false)
const pairingUserId = ref('')
const generatedPairingCode = ref('')
const isGeneratingCode = ref(false)
const isStaffDropdownOpen = ref(false)
const staffSearchQuery = ref('')

const userRoleColors: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-800 border-purple-200',
  SALES: 'bg-blue-50 text-blue-800 border-blue-200',
  BILLING: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PACKING: 'bg-amber-50 text-amber-800 border-amber-200',
  DELIVERY: 'bg-cyan-50 text-cyan-800 border-cyan-200',
}

const allPendingDevices = computed(() => devicesList.value.filter(d => !d.isApproved && !d.isBlocked))
const totalApprovedDevicesCount = computed(() => devicesList.value.filter(d => d.isApproved && !d.isBlocked).length)
const totalBlockedCount = computed(() => devicesList.value.filter(d => d.isBlocked).length)

// Selected staff member in pairing modal
const selectedStaffUser = computed(() => {
  return usersList.value.find(u => u.id === pairingUserId.value)
})

const filteredStaffList = computed(() => {
  const q = staffSearchQuery.value.trim().toLowerCase()
  if (!q) return usersList.value
  return usersList.value.filter(u => 
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.role || '').toLowerCase().includes(q)
  )
})

const selectStaff = (userId: string) => {
  pairingUserId.value = userId
  isStaffDropdownOpen.value = false
  staffSearchQuery.value = ''
  generatedPairingCode.value = ''
}

// Group Devices User-Wise
const usersWithDevices = computed(() => {
  return usersList.value.map(u => {
    const userDevices = devicesList.value.filter(d => d.userId === u.id)
    const approved = userDevices.filter(d => d.isApproved && !d.isBlocked)
    const pending = userDevices.filter(d => !d.isApproved && !d.isBlocked)
    const blocked = userDevices.filter(d => d.isBlocked)
    return {
      ...u,
      devices: userDevices,
      approvedDevices: approved,
      pendingDevices: pending,
      blockedDevices: blocked,
      hasPending: pending.length > 0
    }
  })
})

const filteredUsersWithDevices = computed(() => {
  let list = usersWithDevices.value

  if (selectedRoleFilter.value !== 'ALL') {
    list = list.filter(u => u.role === selectedRoleFilter.value)
  }

  if (selectedStatusFilter.value === 'PENDING') {
    list = list.filter(u => u.pendingDevices.length > 0)
  } else if (selectedStatusFilter.value === 'APPROVED') {
    list = list.filter(u => u.approvedDevices.length > 0)
  } else if (selectedStatusFilter.value === 'BLOCKED') {
    list = list.filter(u => u.blockedDevices.length > 0)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(u => {
      const nameMatch = (u.name || '').toLowerCase().includes(q)
      const emailMatch = (u.email || '').toLowerCase().includes(q)
      const roleMatch = (u.role || '').toLowerCase().includes(q)
      const deviceMatch = u.devices.some((d: any) => 
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.deviceId || '').toLowerCase().includes(q) ||
        (d.ipAddress || '').toLowerCase().includes(q)
      )
      return nameMatch || emailMatch || roleMatch || deviceMatch
    })
  }

  // Always prioritize users with pending device requests at the top
  return [...list].sort((a, b) => (b.hasPending ? 1 : 0) - (a.hasPending ? 1 : 0))
})

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
    notifyChange({
      type: 'DEVICE_CHANGE',
      action: 'DEVICE_APPROVED',
      deviceId
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
    // High-speed WebSocket broadcast to kick user device instantly
    notifyChange({
      type: 'DEVICE_CHANGE',
      action: block ? 'DEVICE_BLOCKED' : 'DEVICE_REVOKED',
      deviceId
    })
    showSaved(block ? 'Device blocked' : 'Device authorization revoked')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed revoking device')
  } finally {
    actionInProgress.value = null
  }
}

const discardPendingDevice = async (deviceId: string) => {
  if (!confirm('Discard and remove this pending authorization request?')) return
  actionInProgress.value = deviceId
  showSaving('Discarding request...')
  try {
    await $fetch('/api/admin/devices/revoke', {
      method: 'POST',
      body: { deviceId, delete: true }
    })
    notifyChange({
      type: 'DEVICE_CHANGE',
      action: 'DEVICE_DELETED',
      deviceId
    })
    showSaved('Pending request discarded')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed discarding request')
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
    notifyChange({
      type: 'DEVICE_CHANGE',
      action: 'DEVICE_DELETED',
      deviceId
    })
    showSaved('Device record deleted')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed deleting device')
  } finally {
    actionInProgress.value = null
  }
}

const isClearingPending = ref(false)

const clearAllPendingRequests = async () => {
  const count = allPendingDevices.value.length
  if (count === 0) return
  if (!confirm(`Are you sure you want to discard all ${count} pending authorization requests?`)) return

  isClearingPending.value = true
  showSaving('Clearing all pending requests...')
  try {
    const res = await $fetch<{ success: boolean; count: number; message: string }>('/api/admin/devices/clear-pending', {
      method: 'POST'
    })
    notifyChange({
      type: 'DEVICE_CHANGE',
      action: 'DEVICE_PENDING_CLEARED'
    })
    showSaved(res.message || `Cleared ${count} pending requests`)
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || 'Failed clearing pending requests')
  } finally {
    isClearingPending.value = false
  }
}

const isLoggingOutOthers = ref(false)

const confirmLogoutAllOthers = async () => {
  const confirmed = window.confirm(
    'Are you sure you want to log out all other accounts and devices?\n\n' +
    'This will immediately invalidate all active sessions across other phones and PCs. Only your current admin device will stay authorized.'
  )
  if (!confirmed) return

  isLoggingOutOthers.value = true
  showSaving('Logging out all other devices...')
  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/admin/devices/logout-all-others', {
      method: 'POST',
      body: { deviceId: currentDeviceId.value }
    })
    notifyChange({
      type: 'DEVICE_CHANGE',
      action: 'LOGOUT_ALL_OTHERS',
      exemptDeviceId: currentDeviceId.value
    })
    showSaved(res.message || 'All other devices logged out')
    await fetchDevices()
  } catch (err: any) {
    alert(err?.data?.message || err?.message || 'Failed to log out other devices')
  } finally {
    isLoggingOutOthers.value = false
  }
}

const openPairingModal = (preselectedUserId?: string) => {
  pairingUserId.value = preselectedUserId || ''
  generatedPairingCode.value = ''
  isStaffDropdownOpen.value = false
  staffSearchQuery.value = ''
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
