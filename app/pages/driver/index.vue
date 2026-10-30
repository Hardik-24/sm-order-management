<template>
  <div v-if="user && !canAccessRoute('/driver')" class="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
    <AccessDenied pageName="Driver Portal" />
  </div>
  <div v-else class="min-h-screen bg-gray-100 flex flex-col font-sans pb-16">
    <!-- Top Header with Silicon Marketing Branding -->
    <header class="bg-[#1b3b5f] text-white shadow-md sticky top-0 z-30">
      <!-- Silicon Marketing Brand Ribbon -->
      <div class="px-4 py-1.5 bg-[#123e33] border-b border-emerald-800/60 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded bg-white/10 border border-white/20 flex items-center justify-center font-black text-[9px] text-emerald-200 tracking-tighter shadow-xs">
            SM
          </div>
          <div class="flex items-baseline gap-1 tracking-widest uppercase text-[11px]">
            <span class="font-light text-emerald-200/90">SILICON</span>
            <span class="font-extrabold text-white">MARKETING</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] uppercase tracking-wider bg-emerald-800/90 text-emerald-200 px-1.5 py-0.5 rounded font-bold border border-emerald-600/40">
            FLEET
          </span>
          <span class="text-[10px] text-emerald-200/70 font-mono">PORTAL</span>
        </div>
      </div>

      <!-- Driver Profile & Status Bar -->
      <div class="px-4 py-2.5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Profile Avatar with Account Initials -->
          <div class="relative">
            <div class="w-10 h-10 rounded-full bg-emerald-800 border-2 border-emerald-400/80 flex items-center justify-center font-black text-sm text-emerald-100 shadow-inner tracking-wider">
              {{ userInitials }}
            </div>
            <span 
              class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1b3b5f]"
              :class="activeTripOrderId ? 'bg-emerald-300 animate-ping' : 'bg-emerald-400'"
              title="Online"
            ></span>
          </div>
          <div>
            <h1 class="text-base font-bold leading-tight">{{ user?.name || 'Delivery Driver' }}</h1>
            <p class="text-[11px] text-white/80 flex items-center gap-1.5 mt-0.5">
              <span 
                class="w-1.5 h-1.5 rounded-full"
                :class="activeTripOrderId ? 'bg-emerald-300 animate-pulse' : 'bg-white/60'"
              ></span>
              {{ activeTripOrderId ? 'Trip in Progress • GPS Live' : 'Ready for Dispatch' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            @click="refreshData" 
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition"
            title="Refresh"
          >
            <RefreshCw class="w-4 h-4 text-white" :class="{ 'animate-spin': isRefreshing }" />
          </button>
          <button 
            @click="handleLogout" 
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition text-white/90 text-xs flex items-center gap-1"
            title="Sign Out"
          >
            <LogOut class="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <div class="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 sticky top-[84px] z-20 shadow-sm">
      <button 
        @click="activeTab = 'DELIVERIES'; fetchAssignedDeliveries()" 
        class="flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
        :class="activeTab === 'DELIVERIES' ? 'bg-[#1b3b5f] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        <PackageCheck class="w-4 h-4" />
        Active Deliveries ({{ assignedOrders.length }})
      </button>

      <button 
        @click="activeTab = 'HISTORY'; fetchTripHistory()" 
        class="flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
        :class="activeTab === 'HISTORY' ? 'bg-[#1b3b5f] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        <History class="w-4 h-4" />
        My Trips & Payouts
      </button>
    </div>

    <!-- Active Deliveries Tab Content -->
    <main v-if="activeTab === 'DELIVERIES'" class="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
      <!-- Keep Screen On Notice — shown only during active trip -->
      <div v-if="activeTrip" class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] text-amber-800 font-medium">
        <span class="text-base">📱</span>
        <span>Keep your screen <strong>ON</strong> while driving — GPS stops when the screen locks.</span>
      </div>

      <!-- Active Trip Sticky Banner -->
      <div v-if="activeTrip" class="bg-emerald-700 text-white p-4 rounded-2xl shadow-lg border border-emerald-600 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-300 animate-ping"></span>
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-200">
              {{ activeDeliveryStop ? `Stop ${activeDeliveryStop.stopSequence} Active` : 'Trip Active' }}
            </span>
          </div>
          <span class="text-xs font-mono bg-emerald-800/80 px-2 py-0.5 rounded text-white font-semibold">
            {{ activeTrip.orderNumber }}
          </span>
        </div>

        <!-- Customer & Destination Summary -->
        <div v-if="activeDeliveryStop || activeTrip.customerName" class="text-xs text-emerald-100 flex items-center justify-between bg-emerald-800/40 px-2.5 py-1.5 rounded-lg">
          <span class="font-bold text-white truncate max-w-[210px]">
            To: {{ activeDeliveryStop?.customerName || activeTrip.customerName }}
          </span>
          <span v-if="activeDeliveryStop?.city" class="text-[11px] text-emerald-200 opacity-90 truncate">
            {{ activeDeliveryStop.city }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 bg-emerald-800/60 p-3 rounded-xl text-center">
          <div>
            <span class="text-[10px] text-emerald-200 uppercase font-bold block">Distance</span>
            <span class="text-base sm:text-lg font-extrabold text-white">{{ displayDistanceKm }} <span class="text-xs font-normal">km</span></span>
          </div>
          <div>
            <span class="text-[10px] text-emerald-200 uppercase font-bold block flex items-center justify-center gap-1">
              <Clock class="w-2.5 h-2.5" /> Elapsed
            </span>
            <span class="text-base sm:text-lg font-extrabold text-white font-mono">{{ elapsedTimeFormatted }}</span>
          </div>
          <div>
            <span class="text-[10px] text-emerald-200 uppercase font-bold block">Est. Payout</span>
            <span class="text-base sm:text-lg font-extrabold text-white">₹{{ activeTrip.calculatedPayout || 0 }}</span>
          </div>
        </div>

        <div v-if="activeTripEta" class="bg-emerald-800/40 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-medium text-emerald-100">
          <span class="flex items-center gap-1.5"><Navigation class="w-3.5 h-3.5 opacity-80" /> Destination ETA</span>
          <span class="font-bold text-white">{{ activeTripEta }}</span>
        </div>

        <!-- On Hold Alert inside banner -->
        <div v-if="isHoldActive" class="w-full bg-red-600/95 text-white p-2.5 rounded-xl text-center space-y-1">
          <div class="flex items-center justify-center gap-1.5 font-bold text-xs">
            <AlertTriangle class="w-4 h-4 text-amber-300 animate-pulse" />
            <span>DELIVERY ON HOLD BY OFFICE — DO NOT UNLOAD</span>
          </div>
          <p class="text-[11px] text-red-100 font-medium">{{ currentHoldReason }}</p>
        </div>

        <div class="flex gap-2">
          <button 
            type="button"
            @click="openDirections(activeDeliveryStop || activeTrip)"
            class="flex-1 py-2.5 bg-white text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
          >
            <Navigation class="w-4 h-4 text-emerald-700" />
            Directions
          </button>
          <button 
            v-if="!isHoldActive"
            @click="activeDeliveryStop ? deliverStopPrompt(activeDeliveryStop.trip, activeDeliveryStop) : completeTripPrompt(activeTrip.orderId)" 
            class="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
          >
            <CheckCircle2 class="w-4 h-4" />
            Deliver Stop
          </button>
          <a 
            v-else
            href="tel:+919876543210"
            class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
          >
            <Phone class="w-4 h-4" />
            Call Office
          </a>
          <!-- Cancel Navigation / Accidental Start Reset Button -->
          <button
            type="button"
            @click="cancelNavigationPrompt"
            class="px-3 py-2.5 bg-emerald-900/60 hover:bg-red-900/80 text-emerald-100 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-emerald-500/40 hover:border-red-500/60 shadow active:scale-95 transition cursor-pointer"
            title="Cancel active navigation and reset delivery to ready"
          >
            <XCircle class="w-4 h-4 text-red-300" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      <!-- Loading State Skeleton -->
      <div v-if="isLoading" class="space-y-4">
        <div v-for="i in 2" :key="i" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex justify-between items-start mb-3">
            <div class="space-y-2 w-2/3">
              <div class="h-4 rounded animate-shimmer w-1/4"></div>
              <div class="h-5 rounded animate-shimmer w-3/4"></div>
              <div class="h-3 rounded animate-shimmer w-1/2"></div>
            </div>
            <div class="h-5 rounded-full animate-shimmer w-16"></div>
          </div>
          <div class="h-16 rounded-xl animate-shimmer mb-3"></div>
          <div class="flex gap-2">
            <div class="h-10 rounded-xl animate-shimmer flex-1"></div>
            <div class="h-10 rounded-xl animate-shimmer flex-1"></div>
          </div>
        </div>
      </div>

      <!-- Trips Manifest Section (Shown when driver has assigned multi-stop trips) -->
      <div v-else-if="assignedTrips.length > 0" class="space-y-4">
        <div 
          v-for="trip in assignedTrips" 
          :key="trip.id"
          class="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3 transition"
        >
          <!-- Trip Card Header -->
          <div class="flex items-start justify-between border-b border-gray-100 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-black font-mono text-[#1b3b5f] bg-emerald-50 px-2.5 py-1 rounded-lg">
                  {{ trip.tripNumber }}
                </span>
                <span 
                  class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :class="trip.status === 'IN_TRANSIT' ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-blue-100 text-blue-800'"
                >
                  {{ trip.status === 'IN_TRANSIT' ? 'In Transit' : 'Planned' }}
                </span>
              </div>
              <h2 class="text-sm font-bold text-gray-900 mt-1">Vehicle: {{ trip.vehicleNumber || 'Standard Delivery' }}</h2>
              <p class="text-xs text-gray-500">{{ trip.totalStops }} Stops • {{ trip.completedStops }} Delivered</p>
            </div>
            
            <div class="text-right">
              <span class="text-[10px] uppercase font-bold text-gray-400 block">Progress</span>
              <span class="text-xs font-extrabold text-[#1b3b5f]">
                {{ trip.completedStops }}/{{ trip.totalStops }}
              </span>
            </div>
          </div>

          <!-- Start Trip Action Bar (When Trip is Planned & No Active Stop) -->
          <div v-if="trip.status === 'PLANNED' && !activeTripOrderId" class="p-3.5 bg-emerald-50/90 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                <Truck class="w-4 h-4 text-[#1b3b5f]" />
                <span>Multi-Stop Route Ready</span>
              </div>
              <p class="text-[11px] text-emerald-800 mt-0.5">
                Deliver stops in sequence. Tap Start Delivery on Stop 1 below to begin navigation.
              </p>
            </div>
            <button
              v-if="trip.stops?.length > 0"
              type="button"
              @click="startStopDeliveryPrompt(trip, trip.stops.find((s: any) => s.status === 'PENDING') || trip.stops[0])"
              class="px-4 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-black rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
            >
              <Play class="w-4 h-4 fill-current" />
              <span>Start Delivery ➔</span>
            </button>
          </div>

          <!-- In Transit Live Indicator -->
          <div v-else-if="trip.status === 'IN_TRANSIT'" class="px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-emerald-800 font-bold">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500" :class="activeTripOrderId ? 'animate-ping' : ''"></span>
              <span>{{ activeDeliveryStop ? `Stop ${activeDeliveryStop.stopSequence} in Transit` : 'Trip in Progress • Ready for Next Stop' }}</span>
            </div>
            <span class="text-[11px] text-emerald-700 font-semibold">
              {{ trip.completedStops }}/{{ trip.totalStops }} Delivered
            </span>
          </div>

          <!-- Trip Stops Manifest with Driver Reorder Controls -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <span>Delivery Stops</span>
              <span class="text-[10px] text-gray-400 font-normal">Use ▲ / ▼ to reorder sequence</span>
            </div>

            <!-- TransitionGroup for silky-smooth sliding reorder animation -->
            <TransitionGroup 
              name="stop-slide" 
              tag="div" 
              class="space-y-3 relative"
            >
              <div 
                v-for="(stop, sIdx) in trip.stops" 
                :key="stop.id"
                class="p-3.5 rounded-xl border transition-all duration-300 space-y-3"
                :class="stop.status === 'DELIVERED' 
                  ? 'bg-gray-50/70 border-gray-200 opacity-70' 
                  : (activeTripOrderId === stop.orderId ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' : 'bg-white border-gray-200 hover:border-[#1b3b5f]/40 shadow-xs')"
              >
                <!-- Stop Top: Sequence Badge, Reorder, Order #, Status -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2.5 min-w-0 flex-1">
                    <span 
                      class="w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                      :class="stop.status === 'DELIVERED' 
                        ? 'bg-gray-200 text-gray-600' 
                        : (activeTripOrderId === stop.orderId ? 'bg-emerald-600 text-white animate-pulse' : 'bg-[#1b3b5f] text-white')"
                    >
                      {{ stop.stopSequence }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-xs text-[#1b3b5f] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          {{ stop.orderNumber }}
                        </span>
                      </div>
                      <!-- Full Customer Name (no truncation) -->
                      <h3 class="font-bold text-sm text-gray-900 mt-1 leading-snug break-words">
                        {{ stop.customerName }}
                      </h3>
                      <p v-if="stop.customerCompany" class="text-xs text-gray-500 font-medium">
                        {{ stop.customerCompany }}
                      </p>
                    </div>
                  </div>

                  <!-- Reorder arrows / Status badge -->
                  <div class="shrink-0 flex items-center gap-1.5">
                    <!-- Reorder arrows (only when not delivered and no stop actively in transit) -->
                    <div v-if="stop.status !== 'DELIVERED' && !activeTripOrderId" class="flex items-center gap-1">
                      <button
                        type="button"
                        @click="driverReorderStop(trip, sIdx, -1)"
                        :disabled="sIdx === 0"
                        class="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-20 transition cursor-pointer active:scale-95"
                        title="Move stop earlier"
                      >
                        <ArrowUp class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        @click="driverReorderStop(trip, sIdx, 1)"
                        :disabled="sIdx === trip.stops.length - 1"
                        class="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-20 transition cursor-pointer active:scale-95"
                        title="Move stop later"
                      >
                        <ArrowDown class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span v-if="stop.status === 'DELIVERED'" class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      ✓ Delivered
                    </span>
                    <span v-else-if="activeTripOrderId === stop.orderId" class="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      In Progress
                    </span>
                    <span v-else class="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Queued
                    </span>
                  </div>
                </div>

                <!-- Complete Untruncated Address Details -->
                <div class="bg-gray-50/90 p-3 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-2 text-gray-800 leading-relaxed break-words flex-1">
                      <MapPin class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div class="space-y-1 min-w-0 flex-1">
                        <p class="font-medium text-gray-900 text-xs leading-relaxed break-words">
                          {{ stop.addressLine }}
                        </p>
                        <p v-if="stop.landmark" class="text-[11px] text-gray-500">
                          <span class="font-semibold text-gray-700">Landmark:</span> {{ stop.landmark }}
                        </p>
                        <p v-if="stop.city" class="text-[11px] font-bold text-emerald-800">
                          📍 {{ stop.city }}
                        </p>
                        <p v-if="stop.itemsCount" class="text-[10px] text-gray-500 font-medium pt-0.5">
                          📦 {{ stop.itemsCount }} {{ stop.itemsCount === 1 ? 'item' : 'items' }} to unload
                        </p>
                      </div>
                    </div>
                    <a 
                      v-if="stop.customerPhone" 
                      :href="`tel:${stop.customerPhone}`"
                      class="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#1b3b5f] transition shrink-0 flex items-center gap-1 text-xs font-bold shadow-2xs"
                      title="Call Customer"
                    >
                      <Phone class="w-3.5 h-3.5 text-[#1b3b5f]" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>

                <!-- Stop Actions (Navigate & Mark Delivered / Start Delivery) -->
                <div v-if="stop.status !== 'DELIVERED'" class="flex gap-2 pt-1 border-t border-gray-100">
                  <button 
                    type="button"
                    @click="openDirections(stop)"
                    class="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Navigation class="w-3.5 h-3.5 text-blue-600" />
                    Directions
                  </button>

                  <!-- When THIS stop is actively in transit -->
                  <template v-if="activeTripOrderId === stop.orderId">
                    <button 
                      type="button"
                      @click="deliverStopPrompt(trip, stop)"
                      class="flex-1 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <CheckCircle2 class="w-3.5 h-3.5 text-white" />
                      Deliver Stop
                    </button>
                    <button 
                      type="button"
                      @click="cancelNavigationPrompt"
                      class="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-red-200"
                      title="Cancel Navigation"
                    >
                      <XCircle class="w-3.5 h-3.5 text-red-600" />
                      <span>Cancel</span>
                    </button>
                  </template>

                  <!-- When NO stop is actively in transit: driver can start delivery -->
                  <button 
                    v-else-if="!activeTripOrderId"
                    type="button"
                    @click="startStopDeliveryPrompt(trip, stop)"
                    class="flex-1 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <Play class="w-3.5 h-3.5 fill-current text-white" />
                    <span>Start Delivery</span>
                  </button>

                  <!-- When ANOTHER stop is actively in transit -->
                  <div 
                    v-else
                    class="flex-1 py-2 bg-gray-50 text-gray-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1 text-center"
                  >
                    <span>Finish active stop first</span>
                  </div>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>

      <!-- Empty State (No trips assigned) -->
      <div v-else class="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
        <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 class="w-7 h-7" />
        </div>
        <h3 class="text-base font-bold text-gray-800">All Done for Now!</h3>
        <p class="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
          You have no pending trips assigned. New dispatch trips will appear here automatically.
        </p>
      </div>
    </main>

    <!-- History & Payouts Tab Content -->
    <main v-else class="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
      <!-- Payout Summary Cards -->
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-center">
          <span class="text-[10px] uppercase font-bold text-gray-400 block">Total Trips</span>
          <span class="text-lg font-extrabold text-gray-900">{{ historyData.summary?.totalTrips || 0 }}</span>
        </div>
        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-center">
          <span class="text-[10px] uppercase font-bold text-gray-400 block">Total Distance</span>
          <span class="text-lg font-extrabold text-[#1b3b5f]">{{ historyData.summary?.totalKm || 0 }} <span class="text-xs font-normal">km</span></span>
        </div>
        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-center">
          <span class="text-[10px] uppercase font-bold text-gray-400 block">Total Payout</span>
          <span class="text-lg font-extrabold text-emerald-600">₹{{ historyData.summary?.totalPayout || 0 }}</span>
        </div>
      </div>

      <!-- History List -->
      <div v-if="historyData.trips?.length === 0" class="bg-white p-8 rounded-xl text-center border border-gray-200 text-gray-400">
        <History class="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p class="text-xs">No completed trips logged yet.</p>
      </div>

      <div v-else class="space-y-3">
        <div 
          v-for="trip in historyData.trips" 
          :key="trip.id"
          class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2"
        >
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold font-mono text-gray-900">{{ trip.orderNumber }}</span>
              <p class="text-xs text-gray-500">{{ trip.customerName }}</p>
            </div>
            <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
              + ₹{{ trip.calculatedPayout }}
            </span>
          </div>

          <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            <span>{{ new Date(trip.startTime).toLocaleDateString() }}</span>
            <span class="font-medium text-gray-700">{{ trip.totalDistanceKm || 0 }} km • {{ trip.durationMinutes ?? 0 }} min</span>
            <button 
              @click="viewRouteSnapshot(trip)" 
              class="text-[#1b3b5f] font-bold hover:underline flex items-center gap-1"
            >
              <MapPin class="w-3 h-3" />
              Route
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Silicon Marketing Footer Branding -->
    <footer class="mt-8 mb-4 text-center text-xs text-gray-400 space-y-1">
      <div class="flex items-center justify-center gap-1.5 text-gray-500 font-semibold text-[11px] tracking-wider uppercase">
        <div class="w-4 h-4 rounded bg-[#1b3b5f] text-white text-[9px] font-black flex items-center justify-center">
          SM
        </div>
        <span>Silicon Marketing</span>
      </div>
      <p class="text-[10px] text-gray-400">Order Management & Fleet Logistics • Mysuru</p>
    </footer>

    <!-- Red Full-Screen Alert Modal on HOLD (Dismissible, No Audio, Vibration Only) -->
    <div v-if="showHoldModal" class="fixed inset-0 z-50 bg-red-600 text-white flex flex-col justify-between p-6 sm:p-8">
      <div class="flex items-center justify-between w-full">
        <span class="text-xs font-mono bg-red-700/90 px-2.5 py-1 rounded text-red-100 font-bold">
          🚨 DISPATCH WARNING
        </span>
        <button 
          @click="showHoldModal = false" 
          class="w-9 h-9 rounded-full bg-red-700/90 hover:bg-red-800 flex items-center justify-center text-white transition active:scale-95"
          title="Close Screen"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex flex-col items-center text-center space-y-4 my-auto">
        <div class="w-20 h-20 rounded-full bg-white text-red-600 flex items-center justify-center shadow-2xl animate-pulse">
          <AlertTriangle class="w-12 h-12 stroke-[2.5]" />
        </div>

        <div class="space-y-1">
          <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            STOP! DO NOT UNLOAD
          </h1>
          <p class="text-sm font-bold text-red-100">
            This delivery was put ON HOLD by the office
          </p>
        </div>

        <div class="bg-red-700/80 border border-red-500/50 rounded-2xl p-4 max-w-sm w-full text-left space-y-2">
          <div>
            <span class="text-[10px] text-red-300 uppercase font-bold tracking-wider block">Order</span>
            <span class="text-sm font-bold text-white">{{ activeTrip?.orderNumber || 'Active Order' }} • {{ activeTrip?.customerName || 'Customer' }}</span>
          </div>
          <div>
            <span class="text-[10px] text-red-300 uppercase font-bold tracking-wider block">Reason</span>
            <span class="text-sm font-semibold text-amber-200">{{ currentHoldReason }}</span>
          </div>
        </div>
      </div>

      <div class="w-full max-w-sm mx-auto space-y-2.5 pt-4">
        <a 
          href="tel:+919876543210"
          class="w-full py-3.5 bg-white text-red-700 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
        >
          <Phone class="w-4 h-4 text-red-600" />
          Call Dispatch Office (+91 98765 43210)
        </a>
        <button 
          @click="showHoldModal = false"
          class="w-full py-2.5 bg-red-700/80 hover:bg-red-800 text-white rounded-xl font-bold text-xs border border-red-400/40 transition"
        >
          I Understand — Close This Screen
        </button>
      </div>
    </div>

    <!-- Route Snapshot Modal -->
    <div v-if="selectedSnapshotTrip" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="p-4 bg-[#1b3b5f] text-white flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold">Trip Route Snapshot</h3>
            <p class="text-xs text-white/80">{{ selectedSnapshotTrip.orderNumber }} • {{ selectedSnapshotTrip.customerName }}</p>
          </div>
          <button @click="selectedSnapshotTrip = null" class="p-1 rounded-full bg-white/10 hover:bg-white/20">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="h-72 w-full">
          <LiveTrackingMap
            :isSnapshot="true"
            :routeCoordinates="selectedSnapshotTrip.route || []"
            :startLocation="selectedSnapshotTrip.startLocation || (selectedSnapshotTrip.route?.length ? selectedSnapshotTrip.route[0] : null)"
            :destinationLocation="selectedSnapshotTrip.destinationCoords"
            :driverLocation="selectedSnapshotTrip.route?.length ? selectedSnapshotTrip.route[selectedSnapshotTrip.route.length - 1] : null"
            :distanceKm="selectedSnapshotTrip.totalDistanceKm"
            :durationMin="selectedSnapshotTrip.durationMinutes"
            :payout="selectedSnapshotTrip.calculatedPayout"
          />
        </div>

        <div class="p-4 bg-gray-50 flex items-center justify-between text-xs gap-3">
          <div>
            <span class="text-gray-400 block font-medium">Distance</span>
            <span class="font-bold text-gray-900 text-sm">{{ selectedSnapshotTrip.totalDistanceKm || 0 }} km</span>
          </div>
          <div>
            <span class="text-gray-400 block font-medium">Duration</span>
            <span class="font-bold text-gray-900 text-sm">{{ selectedSnapshotTrip.durationMinutes ?? 0 }} min</span>
          </div>
          <div>
            <span class="text-gray-400 block font-medium">Payout</span>
            <span class="font-bold text-emerald-700 text-sm">₹{{ selectedSnapshotTrip.calculatedPayout || 0 }}</span>
          </div>
          <button 
            @click="selectedSnapshotTrip = null" 
            class="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-bold transition ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Next Delivery Prompt Modal (Shown after a stop is delivered) -->
    <div v-if="showNextDeliveryModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-gray-100">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 class="w-6 h-6" />
          </div>
          <h3 class="text-base font-extrabold text-gray-900">Delivery Completed!</h3>
          <p class="text-xs text-gray-500">
            Order <strong class="text-gray-800">{{ completedStopInfo?.orderNumber }}</strong> for {{ completedStopInfo?.customerName }} marked delivered.
          </p>
        </div>

        <div v-if="nextDeliveryStop" class="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/70 space-y-1.5">
          <div class="flex items-center justify-between text-[11px] font-bold text-emerald-900">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
              Next Delivery in Trip
            </span>
            <span class="bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded-full font-mono text-[10px]">
              Stop {{ nextDeliveryStop.stopSequence }}
            </span>
          </div>
          <p class="text-xs font-bold text-gray-900">{{ nextDeliveryStop.customerName }}</p>
          <p class="text-[11px] text-gray-600 leading-tight flex items-start gap-1">
            <MapPin class="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
            <span>{{ nextDeliveryStop.addressLine }} {{ nextDeliveryStop.city ? `• ${nextDeliveryStop.city}` : '' }}</span>
          </p>
        </div>

        <div class="space-y-2 pt-1">
          <button
            v-if="nextDeliveryStop && currentTripContext"
            type="button"
            @click="showNextDeliveryModal = false; startStopDeliveryPrompt(currentTripContext, nextDeliveryStop)"
            class="w-full py-3 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Play class="w-4 h-4 fill-current" />
            <span>Start Delivery to {{ nextDeliveryStop.customerName }} ➔</span>
          </button>
          <button
            type="button"
            @click="showNextDeliveryModal = false"
            class="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const getCapacitor = () => {
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return (window as any).Capacitor
  }
  return null
}

const getPlugin = (pluginName: string) => {
  const cap = getCapacitor()
  if (cap && cap.Plugins && cap.Plugins[pluginName]) {
    return cap.Plugins[pluginName]
  }
  return null
}

const geo = {
  watchPosition: async (success: any, error: any, options: any) => {
    const cap = getCapacitor()
    const BackgroundGeolocation = getPlugin('BackgroundGeolocation')

    if (cap && cap.isNativePlatform() && BackgroundGeolocation) {
      // Use the hardcore Background Geolocation plugin
      return await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Tracking active. Tap to open app.",
          backgroundTitle: "SM Fleet",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10
        },
        (location: any, err: any) => {
          if (err) {
            error(err)
            return
          }
          if (location) {
            // Map plugin output to match HTML5 Geolocation API exactly
            success({
              coords: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.bearing
              },
              timestamp: location.time
            })
          }
        }
      )
    } else {
      return navigator.geolocation.watchPosition(success, error, options)
    }
  },
  clearWatch: async (id: any) => {
    const cap = getCapacitor()
    const BackgroundGeolocation = getPlugin('BackgroundGeolocation')

    if (cap && cap.isNativePlatform() && BackgroundGeolocation) {
      await BackgroundGeolocation.removeWatcher({ id })
    } else {
      navigator.geolocation.clearWatch(id)
    }
  },
  getCurrentPosition: async (success: any, error: any, options: any) => {
    const cap = getCapacitor()
    const CapGeolocation = getPlugin('Geolocation')

    if (cap && cap.isNativePlatform() && CapGeolocation) {
      try {
        const pos = await CapGeolocation.getCurrentPosition(options)
        success(pos)
      } catch (e) {
        if (error) error(e)
      }
    } else {
      navigator.geolocation.getCurrentPosition(success, error, options)
    }
  }
}
import { 
  Truck, LogOut, RefreshCw, PackageCheck, History, MapPin, 
  Phone, Box, ChevronDown, Navigation, Play, CheckCircle2, Loader2, X, AlertTriangle, Clock,
  ArrowUp, ArrowDown, XCircle
} from 'lucide-vue-next'
import LiveTrackingMap from '~/components/ui/LiveTrackingMap.vue'
import AccessDenied from '~/components/ui/AccessDenied.vue'
import { useSnackbar } from '~/composables/useSnackbar'

definePageMeta({ layout: false })

const { user, fetchUser, logout, canAccessRoute } = useAuth()
const { showSaving, showSaved, showEditing } = useSnackbar()

const userInitials = computed(() => {
  if (!user.value?.name) return 'D'
  const parts = user.value.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
})

const activeTab = ref<'DELIVERIES' | 'HISTORY'>('DELIVERIES')
const isRefreshing = ref(false)
const isLoading = ref(true)

const assignedOrders = ref<any[]>([])
const assignedTrips = ref<any[]>([])
const standaloneOrders = computed(() => {
  const tripOrderIds = new Set(
    assignedTrips.value.flatMap((t: any) => t.stops?.map((s: any) => s.orderId) || [])
  )
  return assignedOrders.value.filter((o: any) => !tripOrderIds.has(o.id))
})
const historyData = ref<{ trips: any[]; summary: any }>({ trips: [], summary: {} })
const activeTripOrderId = ref<string | null>(null)
const activeTrip = ref<any | null>(null)
const selectedSnapshotTrip = ref<any | null>(null)

// Modal state for Next Delivery transition
const showNextDeliveryModal = ref(false)
const completedStopInfo = ref<any>(null)
const nextDeliveryStop = ref<any>(null)
const currentTripContext = ref<any>(null)

// Computed helper to locate currently active stop inside multi-stop trips
const activeDeliveryStop = computed(() => {
  if (!activeTripOrderId.value) return null
  for (const trip of assignedTrips.value) {
    const s = trip.stops?.find((st: any) => st.orderId === activeTripOrderId.value)
    if (s) return { ...s, trip }
  }
  return null
})

async function driverReorderStop(trip: any, stopIndex: number, direction: number) {
  if (activeTripOrderId.value) {
    showEditing('Cannot reorder stops while a delivery is actively in progress!')
    return
  }

  const targetIndex = stopIndex + direction
  if (targetIndex < 0 || targetIndex >= trip.stops.length) return

  const newStops = [...trip.stops]
  const temp = newStops[stopIndex]
  newStops[stopIndex] = newStops[targetIndex]
  newStops[targetIndex] = temp

  trip.stops = newStops

  const stopOrder = newStops.map((s: any, idx: number) => ({
    stopId: s.id,
    stopSequence: idx + 1
  }))

  try {
    await $fetch('/api/driver/trip/reorder-stops', {
      method: 'PATCH',
      body: {
        tripId: trip.id,
        stopOrder
      }
    })
    try {
      notifyChange({ type: 'TRIP_CHANGE', action: 'REORDER_STOPS', tripId: trip.id, stopOrder })
    } catch (e) {}
    showSaved('Stop sequence updated!')
  } catch (e: any) {
    console.error('Failed to reorder stop', e)
    fetchAssignedDeliveries()
  }
}

// Driver clicks "Deliver Stop"
async function deliverStopPrompt(trip: any, stop: any) {
  if (!confirm(`Mark delivery completed for ${stop.customerName} (${stop.orderNumber})?`)) return

  showSaving('Completing delivery...')
  try {
    const res = await $fetch<{ success: boolean; isTripCompleted?: boolean; nextPendingStop?: any }>('/api/driver/trip', {
      method: 'POST',
      body: {
        action: 'deliver_stop',
        tripId: trip.id,
        stopId: stop.id,
        orderId: stop.orderId,
        coords: currentCoords || undefined
      }
    })

    stopGpsTracking()
    activeTripOrderId.value = null
    activeTrip.value = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sm_active_trip_order_id')
    }

    showSaved(`✓ Delivered to ${stop.customerName}!`)
    notifyDeliveryChange('complete', stop.orderId)
    await fetchAssignedDeliveries()

    if (res.isTripCompleted) {
      showSaved(`🎉 Entire trip completed! All stops delivered successfully!`)
      await fetchTripHistory()
    } else if (res.nextPendingStop) {
      completedStopInfo.value = stop
      nextDeliveryStop.value = res.nextPendingStop
      currentTripContext.value = trip
      showNextDeliveryModal.value = true
    }
  } catch (e: any) {
    console.error('Failed to deliver stop', e)
    showEditing(e.message || 'Failed to deliver stop')
  }
}

// Accidental Start Reset ("Cancel Navigation")
async function cancelNavigationPrompt() {
  const currentStop = activeDeliveryStop.value
  const targetOrderId = activeTripOrderId.value
  const tripId = currentStop?.trip?.id || activeTrip.value?.tripId || activeTrip.value?.id

  if (!confirm('Cancel active navigation for this delivery? The order will be reset to ready without deleting it.')) {
    return
  }

  showSaving('Cancelling navigation...')
  try {
    await $fetch('/api/driver/trip', {
      method: 'POST',
      body: {
        action: 'cancel_navigation',
        tripId: tripId || undefined,
        orderId: targetOrderId || undefined
      }
    })

    stopGpsTracking()
    activeTripOrderId.value = null
    activeTrip.value = null
    isHoldActive.value = false
    showHoldModal.value = false
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sm_active_trip_order_id')
    }

    notifyDeliveryChange('cancel_navigation', targetOrderId || '')
    showSaved('Active navigation cancelled. Delivery is ready to start again.')
    await fetchAssignedDeliveries()
  } catch (err: any) {
    console.error('Failed to cancel navigation:', err)
    showEditing(err.message || 'Failed to cancel navigation')
  }
}

// Start Delivery for an Individual Stop
async function startStopDeliveryPrompt(trip: any, stop: any) {
  if (activeTripOrderId.value && activeTripOrderId.value !== stop.orderId) {
    showEditing('You already have an active delivery in progress! Finish or cancel it first.')
    return
  }

  showSaving(`Starting delivery to ${stop.customerName}... Acquiring GPS.`)

  const cap = getCapacitor()
  if (!navigator.geolocation && !(cap && cap.isNativePlatform())) {
    showEditing('Please allow Location / GPS access on your phone to start delivery.')
    return
  }

  const geoPlugin = geo
  let bestPos: any = null
  let watchHandle: any = null
  let timeoutHandle: any = null
  let resolved = false

  const doStart = async (pos: any) => {
    if (resolved) return
    resolved = true
    if (watchHandle !== null) geoPlugin.clearWatch(watchHandle)
    if (timeoutHandle) clearTimeout(timeoutHandle)

    currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }

    try {
      const dest = (stop.latitude && stop.longitude) 
        ? { lat: stop.latitude, lng: stop.longitude }
        : (stop.coords?.lat && stop.coords?.lng) 
          ? { lat: stop.coords.lat, lng: stop.coords.lng }
          : undefined

      const res = await $fetch<{ success: boolean; trip: any }>('/api/driver/trip', {
        method: 'POST',
        body: {
          action: 'start',
          tripId: trip.id,
          stopId: stop.id,
          orderId: stop.orderId,
          coords: currentCoords,
          destinationCoords: dest
        }
      })

      activeTripOrderId.value = stop.orderId
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sm_active_trip_order_id', stop.orderId)
      }

      activeTrip.value = res.trip || {
        orderId: stop.orderId,
        orderNumber: stop.orderNumber,
        customerName: stop.customerName,
        deliveryAddress: stop.addressLine,
        startTime: new Date().toISOString(),
        totalDistanceKm: 0,
        destinationCoords: dest
      }

      ensureElapsedTimerStarted()
      lastNavPt = currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng } : null

      startGpsTracking()
      notifyDeliveryChange('start', stop.orderId)
      showSaved(`Delivery started for #${stop.orderNumber}! Live tracking active. Drive safe!`)
      await fetchAssignedDeliveries()
    } catch (e: any) {
      console.error('Failed to start stop delivery:', e)
      showEditing(e?.data?.statusMessage || e?.data?.message || e?.message || 'Failed to start delivery. Please try again.')
    }
  }

  geoPlugin.watchPosition(
    (pos: any) => {
      const accuracy = pos.coords.accuracy
      if (!bestPos || accuracy < bestPos.coords.accuracy) {
        bestPos = pos
      }
      if (accuracy <= 50) {
        doStart(pos)
      }
    },
    (_err: any) => {
      if (!resolved) {
        geoPlugin.getCurrentPosition(
          (pos: any) => doStart(pos),
          (_e: any) => {
            if (!resolved) {
              resolved = true
              showEditing('Please allow Location / GPS access on your phone to start delivery.')
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
        )
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
  ).then((id: any) => { watchHandle = id })

  timeoutHandle = setTimeout(() => {
    if (!resolved) {
      if (bestPos) {
        doStart(bestPos)
      } else {
        geoPlugin.getCurrentPosition(
          (pos: any) => doStart(pos),
          (_e: any) => {
            if (!resolved) {
              resolved = true
              showEditing('Could not get GPS fix. Please ensure location services are enabled.')
            }
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
        )
      }
    }
  }, 4000)
}

// Starts the next pending stop in the manifest
async function startManifestTripPrompt(trip: any) {
  const nextPending = trip.stops?.find((s: any) => s.status === 'PENDING') || trip.stops?.[0]
  if (nextPending) {
    await startStopDeliveryPrompt(trip, nextPending)
  }
}

// Auto-refresh driver screen when office assigns a new order or puts one on hold
const { onOrderSync } = useRealtimeSync()
onOrderSync(() => {
  if (activeTab.value === 'DELIVERIES') {
    fetchAssignedDeliveries()
  } else {
    fetchTripHistory()
  }
})

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

const activeTripEta = computed(() => {
  if (!activeTrip.value?.currentLocation || !activeTrip.value?.destinationCoords) return null
  const { lat: cLat, lng: cLng } = activeTrip.value.currentLocation
  const { lat: dLat, lng: dLng } = activeTrip.value.destinationCoords
  const remainingKm = calculateDistanceKm(cLat, cLng, dLat, dLng)
  if (remainingKm < 0.1) return 'Arriving soon'
  const speedKmh = activeTrip.value.currentLocation.speed ? (activeTrip.value.currentLocation.speed * 3.6) : 25
  const avgSpeed = Math.max(speedKmh, 15) // Assume at least 15km/h in city traffic
  const mins = Math.round((remainingKm / avgSpeed) * 60)
  return `${remainingKm} km left (~${mins} min)`
})

const currentTimeMs = ref(Date.now())
let elapsedTimer: ReturnType<typeof setInterval> | null = null

const elapsedTimeFormatted = computed(() => {
  if (!activeTrip.value?.startTime) return '0m 00s'
  const start = new Date(activeTrip.value.startTime).getTime()
  if (!start || isNaN(start)) return '0m 00s'
  const diffSec = Math.max(0, Math.floor((currentTimeMs.value - start) / 1000))
  const hrs = Math.floor(diffSec / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)
  const secs = diffSec % 60

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs.toString().padStart(2, '0')}s`
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
})

const displayDistanceKm = ref(0)
let distanceSimInterval: ReturnType<typeof setInterval> | null = null

watch(() => activeTrip.value?.totalDistanceKm, (newVal) => {
  if (newVal === undefined) {
    displayDistanceKm.value = 0
    return
  }
  // Only accept server distance if it's strictly larger.
  // Never downgrade to server's Haversine distance while local client is actively tracking.
  if (newVal > displayDistanceKm.value) {
    displayDistanceKm.value = newVal
  }
  
  if (distanceSimInterval) clearInterval(distanceSimInterval)
  
  // Smoothly increment over the next 12 seconds
  const target = newVal
  distanceSimInterval = setInterval(() => {
    if (activeTrip.value?.currentLocation?.speed) {
       const speedKmH = activeTrip.value.currentLocation.speed * 3.6
       const kmPerSecond = speedKmH / 3600
       displayDistanceKm.value = Math.round((displayDistanceKm.value + kmPerSecond) * 100) / 100
    }
  }, 1000)
}, { immediate: true })

const isHoldActive = ref(false)
const showHoldModal = ref(false)
const currentHoldReason = ref('')

function triggerHoldLockdown(reason?: string | null) {
  currentHoldReason.value = reason || 'Placed on hold by dispatch office'
  if (!isHoldActive.value) {
    isHoldActive.value = true
    showHoldModal.value = true

    // Silent vibration pattern: Vibrate 500ms, pause 200ms, vibrate 500ms (NO AUDIO)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([500, 200, 500, 200, 500])
      } catch (e) {}
    }
  }
}

let watchId: number | null = null
let pingInterval: any = null
let currentCoords: { lat: number; lng: number; speed?: number; heading?: number } | null = null
let offlineGpsQueue: Array<{ lat: number; lng: number; speed?: number; heading?: number; timestamp: number }> = []

let wakeLockSentinel: any = null
let audioKeepAliveCtx: any = null
let silentOscillator: any = null

async function requestScreenWakeLock() {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null
      })
    } catch (e) {
      console.warn('Screen WakeLock error:', e)
    }
  }
}

function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release()
    } catch (e) {}
    wakeLockSentinel = null
  }
}

function startBackgroundAudioKeepAlive() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    if (!audioKeepAliveCtx) {
      audioKeepAliveCtx = new AudioContextClass()
    }

    if (audioKeepAliveCtx.state === 'suspended') {
      audioKeepAliveCtx.resume()
    }

    if (!silentOscillator) {
      silentOscillator = audioKeepAliveCtx.createOscillator()
      const gainNode = audioKeepAliveCtx.createGain()
      gainNode.gain.value = 0.0001
      silentOscillator.frequency.value = 440
      silentOscillator.connect(gainNode)
      gainNode.connect(audioKeepAliveCtx.destination)
      silentOscillator.start()
    }
  } catch (e) {
    console.warn('Background audio keep-alive not started:', e)
  }
}

function stopBackgroundAudioKeepAlive() {
  try {
    if (silentOscillator) {
      silentOscillator.stop()
      silentOscillator.disconnect()
      silentOscillator = null
    }
    if (audioKeepAliveCtx) {
      audioKeepAliveCtx.close()
      audioKeepAliveCtx = null
    }
  } catch (e) {}
}

// Fetch driver assigned deliveries
async function fetchAssignedDeliveries() {
  try {
    const [data, tripsRes] = await Promise.all([
      $fetch<any[]>('/api/driver/assigned').catch(() => []),
      $fetch<any>('/api/driver/trips').catch(() => ({ trips: [] }))
    ])
    assignedOrders.value = data || []
    assignedTrips.value = tripsRes?.trips || []

    // Check if active trip was cancelled or modified by office
    if (activeTripOrderId.value) {
      const activeOrder = data.find((o) => o.id === activeTripOrderId.value)

      // ONLY cancel if DB status explicitly moved to WAITING or ASSIGNED
      // (do NOT cancel just because in-memory trip is missing — that can happen on serverless cold starts)
      const dbStatusCancelled = !activeOrder || activeOrder.deliveryStatus === 'WAITING' || activeOrder.deliveryStatus === 'ASSIGNED'

      if (dbStatusCancelled) {
        const num = activeOrder?.orderNumber || 'your order'
        stopGpsTracking()
        activeTripOrderId.value = null
        activeTrip.value = null
        isHoldActive.value = false
        showHoldModal.value = false
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('sm_active_trip_order_id')
        }
        showEditing(`⚠️ Trip for #${num} was cancelled by the dispatch office.`)
      } else if (activeOrder.deliveryStatus === 'ON_HOLD') {
        triggerHoldLockdown(activeOrder.holdReason)
      } else if (activeOrder.deliveryStatus === 'DISPATCHED') {
        // Trip is still live — update trip data if server returned it, otherwise keep existing state
        if (activeOrder.trip && activeOrder.trip.status === 'IN_TRANSIT') {
          activeTrip.value = activeOrder.trip
        }
        if (isHoldActive.value) {
          isHoldActive.value = false
          showHoldModal.value = false
        }
      }
      // In all non-cancelled cases, do NOT touch activeTripOrderId/activeTrip further
      return
    }

    // No active trip tracked locally — check if server knows of one in progress
    const active = data.find((o) => o.trip && o.trip.status === 'IN_TRANSIT')

    if (active) {
      activeTripOrderId.value = active.id
      activeTrip.value = active.trip
      startGpsTracking()
    } else if (tripsRes?.trips?.length > 0) {
      for (const t of tripsRes.trips) {
        const activeStop = t.stops?.find((s: any) => s.status === 'IN_TRANSIT')
        if (activeStop) {
          activeTripOrderId.value = activeStop.orderId
          const orderMatch = data.find((o: any) => o.id === activeStop.orderId)
          activeTrip.value = orderMatch?.trip || {
            orderId: activeStop.orderId,
            orderNumber: activeStop.orderNumber,
            customerName: activeStop.customerName,
            deliveryAddress: activeStop.addressLine,
            startTime: t.startTime || new Date().toISOString(),
            totalDistanceKm: 0,
            destinationCoords: (activeStop.latitude && activeStop.longitude) 
              ? { lat: activeStop.latitude, lng: activeStop.longitude } 
              : undefined
          }
          startGpsTracking()
          break
        }
      }
    }
    // If nothing active and we weren't tracking, leave state alone (no false clears)
  } catch (e) {
    console.error('Failed to load deliveries:', e)
  }
}

// Fetch driver trip history
async function fetchTripHistory() {
  try {
    const data = await $fetch<{ trips: any[]; summary: any }>('/api/driver/history')
    historyData.value = data
  } catch (e) {
    console.error('Failed to load history:', e)
  }
}

async function refreshData() {
  isRefreshing.value = true
  await Promise.all([fetchAssignedDeliveries(), fetchTripHistory()])
  isRefreshing.value = false
}

function broadcastLocation(pt: any) {
  if (!activeTripOrderId.value || !supabaseClient) return
  supabaseClient.channel(`trip_${activeTripOrderId.value}`).send({
    type: 'broadcast',
    event: 'LOCATION_UPDATE',
    payload: {
      coords: pt,
      distanceKm: displayDistanceKm.value,
      eta: activeTripEta.value
    }
  }).catch(() => {})
}

// Start continuous GPS tracking via phone browser
function startGpsTracking() {
  const cap = getCapacitor()
  if (!navigator.geolocation && !(cap && cap.isNativePlatform())) {
    alert('GPS Geolocation is not supported by your mobile browser.')
    return
  }

  // Engage mobile screen wake lock and background audio keep-alive
  requestScreenWakeLock()
  startBackgroundAudioKeepAlive()

  if (watchId === null) {
    geo.watchPosition(
      (pos: any) => {
        // 1. Accuracy Filter: Allow standard phone GPS fixes up to 80 meters (phones in vehicles often range 40-75m)
        if (pos.coords.accuracy && pos.coords.accuracy > 80) {
          return // Drop extreme noisy jump
        }

        const pt = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined, // km/h
          heading: pos.coords.heading || undefined,
          timestamp: pos.timestamp || Date.now(),
        }
        currentCoords = pt
        if (activeTrip.value) {
          activeTrip.value.currentLocation = pt
        }

        broadcastLocation(pt)

        const last = offlineGpsQueue[offlineGpsQueue.length - 1]
        
        // If queue is empty, accept the first point
        if (!last) {
          offlineGpsQueue.push(pt)
          return
        }

        // Haversine formula to calculate exact distance in meters between last point and new point
        const R = 6371e3 // Earth radius in meters
        const φ1 = last.lat * (Math.PI / 180)
        const φ2 = pt.lat * (Math.PI / 180)
        const Δφ = (pt.lat - last.lat) * (Math.PI / 180)
        const Δλ = (pt.lng - last.lng) * (Math.PI / 180)
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        const distanceMeters = R * c

        // 2. Speed Sanity Check: Reject impossible jumps (> 150 km/h = ~41.6 m/s) over short intervals
        const timeDiffSeconds = Math.max(0.5, (pt.timestamp - last.timestamp) / 1000)
        if (distanceMeters > 30) {
          const speedMps = distanceMeters / timeDiffSeconds
          if (speedMps > 42) {
            return // Reject spike: teleported > 150 km/h
          }
        }

        // 3. Distance & Heartbeat Threshold:
        // Accept new point if moved >= 10 meters, OR if >= 15 seconds elapsed (stationary heartbeat)
        const timeElapsedMs = pt.timestamp - last.timestamp
        if (distanceMeters >= 10) {
          offlineGpsQueue.push(pt)
        } else if (timeElapsedMs >= 15000) {
          // Stationary heartbeat: keep timestamp fresh so tracking reflects active live state
          offlineGpsQueue.push({
            ...pt,
            speed: 0,
          })
        }

        // Buffer guard: cap queue to prevent memory bloat during prolonged disconnections
        if (offlineGpsQueue.length > 300) {
          offlineGpsQueue.shift()
        }
      },
      (err) => {
        console.warn('GPS watch error:', err)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    ).then((id: any) => { watchId = id })
  }

  // Periodic batch store-and-forward ping to backend every 12 seconds
  if (!pingInterval) {
    pingInterval = setInterval(async () => {
      if (activeTripOrderId.value && offlineGpsQueue.length > 0) {
        const pointsToSend = [...offlineGpsQueue]
        try {
          const res = await $fetch<{ 
            success: boolean; 
            trip: any;
            orderStatus?: string;
            holdReason?: string | null;
          }>('/api/driver/trip', {
            method: 'POST',
            body: {
              action: 'ping',
              orderId: activeTripOrderId.value,
              points: pointsToSend,
            }
          })

          // On successful delivery: remove sent batch from queue
          offlineGpsQueue.splice(0, pointsToSend.length)

          // ONLY cancel if DB status explicitly moved to WAITING or ASSIGNED
          if (res.orderStatus === 'WAITING' || res.orderStatus === 'ASSIGNED') {
            stopGpsTracking()
            activeTripOrderId.value = null
            activeTrip.value = null
            isHoldActive.value = false
            showHoldModal.value = false
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('sm_active_trip_order_id')
            }
            showEditing('⚠️ Your trip was cancelled by the dispatch office.')
            fetchAssignedDeliveries()
            return
          }

          if (res.trip) {
            activeTrip.value = res.trip
          }

          if (res.orderStatus === 'ON_HOLD') {
            triggerHoldLockdown(res.holdReason)
          } else if (res.orderStatus === 'DISPATCHED' && isHoldActive.value) {
            isHoldActive.value = false
            showHoldModal.value = false
          }
        } catch (e) {
          // Network dead-zone or offline: keep points safely in queue!
          console.warn('GPS ping failed (offline or network dead-zone), points preserved in phone buffer:', pointsToSend.length)
        }
      }
    }, 12000)
  }
}

function stopGpsTracking() {
  if (watchId !== null) {
    geo.clearWatch(watchId)
    watchId = null
  }
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
  offlineGpsQueue = []
  releaseScreenWakeLock()
  stopBackgroundAudioKeepAlive()
}

// Driver clicks "Start Trip"
async function startTripPrompt(order: any) {
  if (activeTripOrderId.value && activeTripOrderId.value !== order.id) {
    showEditing('You already have an active trip in progress! Complete it first.')
    return
  }

  showSaving('Acquiring precise GPS location...')

  // Wait for a satellite-accurate GPS fix (accuracy < 50m) before starting trip
  // This prevents WiFi/cell-tower triangulation (which can be 200-500m off) being used as start point
  const cap = getCapacitor()
  
  if (cap && cap.isNativePlatform()) {
     const bgGeo = getPlugin('BackgroundGeolocation')
     alert("DEBUG: Native Platform detected. BackgroundGeolocation plugin exists? " + !!bgGeo)
  }

  if (!navigator.geolocation && !(cap && cap.isNativePlatform())) {
    showEditing('Please allow Location / GPS access on your phone to start trip.')
    return
  }

  let bestPos: GeolocationPosition | null = null
  let watchHandle: any = null
  let timeoutHandle: any = null
  let resolved = false

  const doStart = async (pos: GeolocationPosition | any) => {
    if (resolved) return
    resolved = true
    if (watchHandle !== null) geo.clearWatch(watchHandle)
    if (timeoutHandle) clearTimeout(timeoutHandle)

    currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }

    try {
      const dest = order.destinationCoords || (order.customer?.latitude ? { lat: order.customer.latitude, lng: order.customer.longitude } : undefined)
      const res = await $fetch<{ success: boolean; trip: any }>('/api/driver/trip', {
        method: 'POST',
        body: {
          action: 'start',
          orderId: order.id,
          coords: currentCoords,
          destinationCoords: dest,
        }
      })
      activeTripOrderId.value = order.id
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sm_active_trip_order_id', order.id)
      }
      activeTrip.value = res.trip
      startGpsTracking()
      notifyDeliveryChange('start', order.id)
      showSaved(`Trip started for #${order.orderNumber}! GPS is live. Drive safe!`)
      await fetchAssignedDeliveries()
    } catch (e: any) {
      console.error('Failed to start trip:', e)
      showEditing(e?.data?.statusMessage || e?.data?.message || 'Failed to start trip. Please try again.')
    }
  }

  geo.watchPosition(
    (pos: any) => {
      const accuracy = pos.coords.accuracy
      // Accept this fix if it's better than 50m, or update best known position
      if (!bestPos || accuracy < bestPos.coords.accuracy) {
        bestPos = pos
      }
      if (accuracy <= 50) {
        // Good enough satellite fix — use it immediately
        doStart(pos)
      }
    },
    (_err: any) => {
      if (!resolved) {
        if (bestPos) {
          doStart(bestPos)
        } else {
          if (watchHandle !== null) geo.clearWatch(watchHandle)
          if (timeoutHandle) clearTimeout(timeoutHandle)
          showEditing('Please allow Location / GPS access on your phone to start trip.')
        }
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
  ).then((id: any) => { watchHandle = id })

  // Fallback: after 12 seconds, use the best position we got (even if >50m)
  timeoutHandle = setTimeout(() => {
    if (!resolved) {
      if (bestPos) {
        showSaving('Starting trip with best available location...')
        doStart(bestPos)
      } else {
        resolved = true
        if (watchHandle !== null) geo.clearWatch(watchHandle)
        showEditing('Could not get GPS location. Please enable Location Services and try again.')
      }
    }
  }, 12000)
}

function notifyDeliveryChange(action: string, orderId: string) {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('sm_delivery_channel')
      channel.postMessage({ type: 'DELIVERY_STATUS_CHANGED', action, orderId })
      channel.close()
    } catch (e) {}
  }
  try {
    const { notifyChange } = useRealtimeSync()
    notifyChange({ type: 'DELIVERY_STATUS_CHANGED', action, orderId })
  } catch (e) {}
}

// Driver clicks "Complete Trip"
async function completeTripPrompt(orderId: string) {
  if (!confirm('Are you at the customer address? Mark order as DELIVERED and complete trip?')) return

  showSaving('Completing trip & finalizing payout...')

  try {
    const pointsToSend = offlineGpsQueue.length > 0 ? [...offlineGpsQueue] : undefined
    const res = await $fetch<{ success: boolean; trip: any }>('/api/driver/trip', {
      method: 'POST',
      body: {
        action: 'complete',
        orderId,
        coords: currentCoords,
        points: pointsToSend,
      }
    })

    stopGpsTracking()
    activeTripOrderId.value = null
    activeTrip.value = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sm_active_trip_order_id')
    }
    notifyDeliveryChange('complete', orderId)

    const dist = res.trip?.totalDistanceKm || 0
    const dur = res.trip?.durationMinutes ?? 0
    const payout = res.trip?.calculatedPayout || 0

    showSaved(`Delivery complete! ${dist} km • ${dur} min • ₹${payout} earned!`)
    await refreshData()
    activeTab.value = 'HISTORY'
  } catch (e) {
    console.error('Failed to complete trip:', e)
    showEditing('Error completing trip. Please try again.')
  }
}

function viewRouteSnapshot(trip: any) {
  selectedSnapshotTrip.value = trip
}

async function handleLogout() {
  if (activeTripOrderId.value) {
    if (!confirm('You have a delivery in progress. Are you sure you want to log out?')) return
  }
  stopGpsTracking()
  await logout()
  navigateTo('/login')
}

let driverSyncChannel: BroadcastChannel | null = null
let autoPollTimer: any = null

function performDriverPoll() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  fetchAssignedDeliveries()
}

function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    if (activeTripOrderId.value) {
      requestScreenWakeLock()
      startBackgroundAudioKeepAlive()
    }
    fetchAssignedDeliveries()
  }
}

// Open Google Maps Driving Directions from Driver's Current Location to Pinned Customer Location
function openDirections(order: any) {
  const lat = order.coords?.lat || order.destinationCoords?.lat || order.customer?.latitude || order.trip?.destinationCoords?.lat
  const lng = order.coords?.lng || order.destinationCoords?.lng || order.customer?.longitude || order.trip?.destinationCoords?.lng

  // Block directions if no pin exists
  if (!lat || !lng) {
    showEditing('📍 Cannot open directions: No destination pin has been set for this customer! Please contact the dispatch office to set the pin on the dashboard.')
    return
  }

  const dest = `${lat},${lng}`

  const cap = getCapacitor()
  // If driver current coordinates are already known via live GPS, launch turn-by-turn navigation with exact origin & driving mode
  if (currentCoords && currentCoords.lat && currentCoords.lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentCoords.lat},${currentCoords.lng}&destination=${dest}&travelmode=driving`, '_blank')
  } else if ((typeof navigator !== 'undefined' && navigator.geolocation) || (cap && cap.isNativePlatform())) {
    geo.getCurrentPosition(
      (pos: any) => {
        currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const origin = `${pos.coords.latitude},${pos.coords.longitude}`
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`, '_blank')
      },
      () => {
        window.open(`https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${dest}&travelmode=driving`, '_blank')
      },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
    )
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${dest}&travelmode=driving`, '_blank')
  }
}

onMounted(async () => {
  // Prompt for location and notification permissions on startup if not granted
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 6000, enableHighAccuracy: true })
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch (e) {}
  }

  isLoading.value = true
  if (!user.value) {
    await fetchUser()
  }
  await refreshData()
  isLoading.value = false

  // 1. Cross-tab instant 0ms broadcast sync (same device / testing)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      driverSyncChannel = new BroadcastChannel('sm_delivery_channel')
      driverSyncChannel.onmessage = (event) => {
        if (event.data?.type === 'DELIVERY_STATUS_CHANGED') {
          fetchAssignedDeliveries()
        }
      }
    } catch (e) {}
  }

  // 2. Cross-device mobile auto-poll (every 6 seconds while driver is looking at screen)
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseKey

  if (supabaseUrl && supabaseKey) {
    import('@supabase/supabase-js').then(({ createClient }) => {
      supabaseClient = createClient(supabaseUrl, supabaseKey)
      realtimeDriverChannel = supabaseClient.channel('sm_orders_realtime', {
        config: { broadcast: { ack: false, self: false } }
      })
      realtimeDriverChannel
        .on('broadcast', { event: 'ORDER_CHANGE' }, () => {
          fetchAssignedDeliveries()
        })
        .on('broadcast', { event: 'TRIP_CHANGE' }, () => {
          fetchAssignedDeliveries()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_statuses' }, () => {
          fetchAssignedDeliveries()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
          fetchAssignedDeliveries()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stops' }, () => {
          fetchAssignedDeliveries()
        })
        .subscribe()
    })
  } else {
    autoPollTimer = setInterval(performDriverPoll, 6000)
  }

  // 3. Instant wakeup when driver unlocks phone or switches back to browser
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // 4. Live elapsed time ticker (every second)
  elapsedTimer = setInterval(() => {
    currentTimeMs.value = Date.now()
  }, 1000)
})

let realtimeDriverChannel: any = null
let supabaseClient: any = null

onBeforeUnmount(() => {
  stopGpsTracking()
  if (distanceSimInterval) clearInterval(distanceSimInterval)
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (driverSyncChannel) driverSyncChannel.close()
  if (autoPollTimer) clearInterval(autoPollTimer)
  if (realtimeDriverChannel) realtimeDriverChannel.unsubscribe()
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
})
</script>

<style scoped>
/* Smooth sliding animation when stops are reordered with arrows */
.stop-slide-move {
  transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease;
  z-index: 10;
}
.stop-slide-enter-active,
.stop-slide-leave-active {
  transition: all 0.35s ease;
}
.stop-slide-enter-from,
.stop-slide-leave-to {
  opacity: 0;
  transform: translateY(15px);
}
</style>
