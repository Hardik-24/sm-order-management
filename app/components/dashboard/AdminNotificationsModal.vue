<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        
        <!-- Modal Top Header -->
        <div class="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0">
              <Bell class="w-5 h-5 text-rose-600" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base sm:text-lg font-bold text-[#1a1a1a] truncate">
                  Notification Management
                </h3>
                <span 
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs"
                  :class="activeDevicesCount > 0 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'"
                >
                  {{ activeDevicesCount > 0 ? `${activeDevicesCount} Active Device${activeDevicesCount > 1 ? 's' : ''}` : 'No Active Devices' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 truncate">
                Broadcast instant push alerts, test mobile device delivery, and configure automated notification rules
              </p>
            </div>
          </div>
          <button 
            @click="emit('close')" 
            data-modal-close="true"
            title="Close (Esc)"
            class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Scrollable Modal Content -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          <!-- SECTION 1: Instant Test Push Broadcast -->
          <div class="bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/40 border border-indigo-100/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Send class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-sm font-bold text-gray-900">Broadcast Push Notification</h4>
                  <p class="text-xs text-gray-500">Send an instant test alert to all connected mobile devices</p>
                </div>
              </div>

              <button
                type="button"
                @click="fetchActiveDevices"
                :disabled="isLoadingDevices"
                title="Refresh active devices"
                class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white transition cursor-pointer"
              >
                <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingDevices }" />
              </button>
            </div>

            <!-- Test Form Inputs -->
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Notification Title</label>
                <input
                  type="text"
                  v-model="testForm.title"
                  placeholder="e.g. 🔔 SM Flow Alert: System Test"
                  class="w-full text-xs sm:text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Message Body</label>
                <textarea
                  v-model="testForm.body"
                  rows="2"
                  placeholder="e.g. Test push notification delivered successfully to your device!"
                  class="w-full text-xs sm:text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition resize-none"
                ></textarea>
              </div>

              <!-- Target Audience Selector -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-medium text-gray-600">Send To:</span>
                <button
                  type="button"
                  @click="testForm.target = 'all'"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                  :class="testForm.target === 'all' 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'"
                >
                  All Devices (Broadcast)
                </button>
                <button
                  type="button"
                  @click="testForm.target = 'quotations'"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                  :class="testForm.target === 'quotations' 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'"
                >
                  Quotations Topic
                </button>
                <button
                  type="button"
                  @click="testForm.target = 'orders'"
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                  :class="testForm.target === 'orders' 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'"
                >
                  Orders Topic
                </button>
              </div>
            </div>

            <!-- Send Test Button -->
            <div class="pt-1 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                @click="sendTestNotification"
                :disabled="isSendingTest"
                class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Loader2 v-if="isSendingTest" class="w-4 h-4 animate-spin" />
                <Send v-else class="w-4 h-4" />
                <span>{{ isSendingTest ? 'Sending Notification...' : 'Send Test Notification to All Active Devices' }}</span>
              </button>

              <span class="text-[11px] text-gray-500">
                Delivers with high priority, sound & banner
              </span>
            </div>

            <!-- Feedback Result Alert -->
            <div 
              v-if="testResult" 
              class="p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all"
              :class="testResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'"
            >
              <CheckCircle2 v-if="testResult.success" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <AlertCircle v-else class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div class="flex-1">
                <span class="font-bold block">{{ testResult.message }}</span>
                <span v-if="testResult.devices && testResult.devices.length > 0" class="text-[11px] opacity-90 mt-0.5 block">
                  Targeted: {{ testResult.devices.join(', ') }}
                </span>
              </div>
              <button @click="testResult = null" class="text-gray-400 hover:text-gray-600 p-0.5">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- SECTION 2: Automated Notification Rules / Event Triggers -->
          <div class="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-bold text-gray-900">Automated Notification Rules</h4>
                <p class="text-xs text-gray-500">Choose which operational events send push alerts to mobile devices</p>
              </div>
              <span class="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
                Trigger Rules
              </span>
            </div>

            <!-- Rules Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              <!-- 1. Storefront Order Requests -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Inbox class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">Storefront Order Requests</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Storefront</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when a customer submits an incoming order or cart inquiry on the digital storefront.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.storefrontRequests"
                  @click="notifications.storefrontRequests = !notifications.storefrontRequests"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.storefrontRequests ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.storefrontRequests ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- 2. Price Quotations -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Calculator class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">Price Quotations</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Quotes</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when a quotation is drafted, priced, or converted into an order.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.quotations"
                  @click="notifications.quotations = !notifications.quotations"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.quotations ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.quotations ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- 3. New Sales Orders -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ClipboardList class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">New Sales Orders</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Orders</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when a new sales order is booked into the system.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.orders"
                  @click="notifications.orders = !notifications.orders"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.orders ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.orders ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- 4. Order Modifications / Edits -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                    <FileEdit class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">Order Modifications</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-orange-100 text-orange-800">Edits</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when an existing order's items, pricing, or details are modified.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.orderEdits"
                  @click="notifications.orderEdits = !notifications.orderEdits"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.orderEdits ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.orderEdits ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- 5. Order Approvals -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCheck class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">Order Approvals</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">Approvals</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when an order is approved or cancelled in the approval queue.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.orderApprovals"
                  @click="notifications.orderApprovals = !notifications.orderApprovals"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.orderApprovals ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.orderApprovals ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- 6. Warehouse Packing -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Package class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">Warehouse Packing</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800">Packing</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when warehouse completes packing and marks order ready for dispatch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.packing"
                  @click="notifications.packing = !notifications.packing"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.packing ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.packing ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- 7. Delivery & Fleet Trips -->
              <div class="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-3 transition-colors hover:bg-gray-50">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-gray-900">Delivery & Fleet Trips</span>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">Fleet</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Alert team when a delivery run is dispatched or a driver marks an order delivered.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="notifications.delivery"
                  @click="notifications.delivery = !notifications.delivery"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-1"
                  :class="notifications.delivery ? 'bg-[#1b3b5f]' : 'bg-gray-300'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
                    :class="notifications.delivery ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>

            </div>

            <!-- Save Rules Button -->
            <div class="pt-2 flex items-center justify-between gap-3 flex-wrap border-t border-gray-100">
              <span v-if="saveSuccessMsg" class="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check class="w-4 h-4" />
                {{ saveSuccessMsg }}
              </span>
              <span v-else class="text-xs text-gray-400">
                Changes apply immediately across all endpoints
              </span>

              <button
                type="button"
                @click="saveNotificationRules"
                :disabled="isSavingRules || !hasRuleChanges"
                class="px-5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-xs ml-auto"
                :class="hasRuleChanges && !isSavingRules
                  ? 'bg-[#1b3b5f] hover:bg-[#132c49] text-white cursor-pointer'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-70'"
              >
                <Loader2 v-if="isSavingRules" class="w-3.5 h-3.5 animate-spin" />
                <Check v-else class="w-3.5 h-3.5" />
                <span>{{ isSavingRules ? 'Saving Changes...' : (hasRuleChanges ? 'Save Notification Rules' : 'No Changes to Save') }}</span>
              </button>
            </div>
          </div>

          <!-- SECTION 3: Active Push Registered Hardware Devices -->
          <div class="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Smartphone class="w-4 h-4 text-gray-500" />
                <h4 class="text-sm font-bold text-gray-900">Registered Devices</h4>
              </div>
              <span class="text-xs text-gray-500">{{ activeDevices.length }} connected</span>
            </div>

            <div v-if="isLoadingDevices" class="py-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 class="w-4 h-4 animate-spin text-[#1b3b5f]" />
              <span>Loading registered devices...</span>
            </div>

            <div v-else-if="activeDevices.length === 0" class="py-6 text-center text-xs text-gray-400 italic">
              No hardware devices currently registered with push tokens. Sign in via the Android mobile app to register your device.
            </div>

            <div v-else class="space-y-2">
              <div 
                v-for="device in activeDevices" 
                :key="device.id"
                class="p-3 rounded-xl border border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 text-xs"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Smartphone class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-gray-900 truncate">{{ device.deviceName || device.deviceModel || 'Mobile Device' }}</span>
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                        {{ device.os || device.platform || 'Android' }}
                      </span>
                    </div>
                    <span class="text-gray-500 text-[11px] block truncate">
                      Bound to: <strong class="text-gray-700">{{ device.user?.name || 'User' }}</strong> ({{ device.user?.role || 'Staff' }})
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-3 shrink-0 text-right">
                  <div class="hidden sm:block">
                    <span class="text-[10px] text-gray-400 block">Last Active</span>
                    <span class="text-[11px] text-gray-600 font-medium">{{ formatTime(device.lastUsedAt) }}</span>
                  </div>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Push Ready
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
          <button 
            type="button"
            @click="emit('close')" 
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { 
  Bell, 
  Send, 
  X, 
  Loader2, 
  Check, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone,
  Inbox,
  Calculator,
  ClipboardList,
  FileEdit,
  CheckCheck,
  Package,
  Truck
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', payload: any): void
}>()

// Active Devices State
const activeDevices = ref<any[]>([])
const isLoadingDevices = ref(false)
const activeDevicesCount = computed(() => activeDevices.value.length)

// Test Notification Form
const testForm = reactive({
  title: '🔔 SM Flow Alert: System Test',
  body: 'Push notification delivered successfully to your mobile device!',
  target: 'all' as 'all' | 'quotations' | 'orders'
})

const isSendingTest = ref(false)
const testResult = ref<{
  success: boolean
  message: string
  devices?: string[]
} | null>(null)

// Notification Rules State (Core OMS Workflows)
const notifications = reactive({
  storefrontRequests: true,
  quotations: true,
  orders: true,
  orderEdits: true,
  orderApprovals: true,
  packing: false,
  delivery: true
})

const isSavingRules = ref(false)
const saveSuccessMsg = ref('')
const initialNotifications = ref<string>('')

const hasRuleChanges = computed(() => {
  if (!initialNotifications.value) return false
  return JSON.stringify(notifications) !== initialNotifications.value
})

const fetchActiveDevices = async () => {
  try {
    isLoadingDevices.value = true
    const res = await $fetch<any>('/api/notifications/active-devices')
    if (res && res.success) {
      activeDevices.value = res.devices || []
    }
  } catch (err) {
    console.warn('Failed to fetch active devices:', err)
  } finally {
    isLoadingDevices.value = false
  }
}

const loadNotificationSettings = async () => {
  try {
    const res = await $fetch<any>('/api/settings')
    if (res && res.notifications) {
      notifications.storefrontRequests = res.notifications.storefrontRequests !== false
      notifications.quotations = res.notifications.quotations !== false
      notifications.orders = res.notifications.orders !== false
      notifications.orderEdits = res.notifications.orderEdits !== false
      notifications.orderApprovals = res.notifications.orderApprovals !== false
      notifications.packing = res.notifications.packing === true
      notifications.delivery = res.notifications.delivery !== false
    }
  } catch (err) {
    console.warn('Failed to load notification settings:', err)
  } finally {
    initialNotifications.value = JSON.stringify(notifications)
  }
}

const sendTestNotification = async () => {
  try {
    isSendingTest.value = true
    testResult.value = null

    const res = await $fetch<any>('/api/notifications/test', {
      method: 'POST',
      body: {
        title: testForm.title.trim() || '🔔 SM Flow Notification Test',
        body: testForm.body.trim() || 'Push notification delivered successfully!',
        target: testForm.target
      }
    })

    if (res && res.success) {
      testResult.value = {
        success: true,
        message: res.message || 'Push notification sent successfully!',
        devices: res.devices || []
      }
    } else {
      testResult.value = {
        success: false,
        message: res?.message || 'Failed to dispatch push notification. Check server logs.'
      }
    }
  } catch (err: any) {
    testResult.value = {
      success: false,
      message: err?.data?.message || err?.message || 'Network error occurred while triggering test notification.'
    }
  } finally {
    isSendingTest.value = false
  }
}

const saveNotificationRules = async () => {
  try {
    isSavingRules.value = true
    saveSuccessMsg.value = ''

    const res = await $fetch<any>('/api/settings', {
      method: 'POST',
      body: {
        notifications: {
          storefrontRequests: notifications.storefrontRequests,
          quotations: notifications.quotations,
          orders: notifications.orders,
          orderEdits: notifications.orderEdits,
          orderApprovals: notifications.orderApprovals,
          packing: notifications.packing,
          delivery: notifications.delivery
        }
      }
    })

    if (res && res.success) {
      initialNotifications.value = JSON.stringify(notifications)
      saveSuccessMsg.value = 'Settings saved!'
      emit('saved', notifications)
      setTimeout(() => {
        saveSuccessMsg.value = ''
      }, 3000)
    }
  } catch (err: any) {
    console.error('Failed saving notification settings:', err)
  } finally {
    isSavingRules.value = false
  }
}

const formatTime = (ts: string | Date | null) => {
  if (!ts) return 'Never'
  const d = new Date(ts)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(() => props.isOpen, (open) => {
  if (open) {
    fetchActiveDevices()
    loadNotificationSettings()
    testResult.value = null
    saveSuccessMsg.value = ''
  }
})

onMounted(() => {
  if (props.isOpen) {
    fetchActiveDevices()
    loadNotificationSettings()
  }
})
</script>
