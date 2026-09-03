<template>
  <Login v-if="!isAuthenticated" @login-success="onLoginSuccess" />
  
  <div v-else class="min-h-screen bg-[#faf8f5] text-[#1a1a1a] flex flex-col font-sans">
    <!-- Top Nav -->
    <header class="bg-[#1a5c4c] text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-10 safe-area-pt">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
          <Truck class="w-5 h-5 text-[#4ecdc4]" />
        </div>
        <div>
          <h1 class="font-bold text-lg leading-tight tracking-wide">SM FLEET</h1>
          <p class="text-xs text-white/70">Driver: {{ currentUser?.name || 'Loading...' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button @click="logout" class="text-xs uppercase bg-white/20 px-2 py-1 rounded">Logout</button>
        <div class="w-3 h-3 rounded-full" :class="isTracking ? 'bg-[#4ecdc4] animate-pulse' : 'bg-red-400'"></div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 p-4 flex flex-col gap-4">
      
      <!-- Status Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Current Status</h2>
        
        <div v-if="!isTracking" class="text-center py-6">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-xl font-medium mb-2">Ready for Dispatch</h3>
          <p class="text-sm text-gray-500 mb-6">Start tracking to begin your route and log GPS coordinates natively.</p>
          
          <button 
            @click="startTrip" 
            class="w-full bg-[#1a5c4c] hover:bg-[#134237] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Play class="w-5 h-5" />
            START TRIP
          </button>
        </div>

        <div v-else class="space-y-4">
          <div class="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Elapsed Time</p>
              <p class="text-2xl font-bold font-mono text-[#1a5c4c]">{{ formattedTime }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Speed</p>
              <p class="text-xl font-bold text-gray-800">{{ currentSpeed }} <span class="text-sm font-normal text-gray-500">km/h</span></p>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-xs text-gray-500 uppercase mb-1">Latitude</p>
              <p class="font-mono text-sm text-gray-800 truncate">{{ currentLat?.toFixed(6) || '--' }}</p>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-xs text-gray-500 uppercase mb-1">Longitude</p>
              <p class="font-mono text-sm text-gray-800 truncate">{{ currentLng?.toFixed(6) || '--' }}</p>
            </div>
          </div>
          
          <p class="text-xs text-center text-gray-400">
            <ShieldCheck class="w-3 h-3 inline mr-1 -mt-0.5" />
            Native background tracking active. You can safely lock your screen.
          </p>

          <button 
            @click="completeTrip" 
            class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 mt-4"
          >
            <Square class="w-5 h-5" />
            COMPLETE TRIP
          </button>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Geolocation } from '@capacitor/geolocation'
import { Preferences } from '@capacitor/preferences'
import { Truck, MapPin, Play, Square, ShieldCheck } from 'lucide-vue-next'
import Login from './components/Login.vue'

const isAuthenticated = ref(false)
const currentUser = ref<any>(null)
let authToken = ''
const API_URL = 'https://sm-order-management.vercel.app'

onMounted(async () => {
  const { value } = await Preferences.get({ key: 'auth_token' })
  const { value: userStr } = await Preferences.get({ key: 'user' })
  
  if (value && userStr) {
    authToken = value
    currentUser.value = JSON.parse(userStr)
    isAuthenticated.value = true
  }
})

async function onLoginSuccess(payload: { user: any, token: string }) {
  await Preferences.set({ key: 'auth_token', value: payload.token })
  await Preferences.set({ key: 'user', value: JSON.stringify(payload.user) })
  authToken = payload.token
  currentUser.value = payload.user
  isAuthenticated.value = true
}

async function logout() {
  await Preferences.remove({ key: 'auth_token' })
  await Preferences.remove({ key: 'user' })
  isAuthenticated.value = false
  currentUser.value = null
  authToken = ''
  completeTrip() // stop tracking if active
}

// --- Tracking Logic ---
const isTracking = ref(false)
const currentLat = ref<number | null>(null)
const currentLng = ref<number | null>(null)
const currentSpeed = ref<number>(0)
const startTime = ref<number | null>(null)
const elapsedTime = ref(0)
let timerInterval: any = null
let watchId: string | null = null

const formattedTime = computed(() => {
  const totalSeconds = elapsedTime.value
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

async function startTrip() {
  const permissions = await Geolocation.requestPermissions()
  if (permissions.location !== 'granted') {
    alert('Location permissions are required to track deliveries.')
    return
  }

  isTracking.value = true
  startTime.value = Date.now()
  elapsedTime.value = 0
  
  timerInterval = setInterval(() => {
    elapsedTime.value = Math.floor((Date.now() - startTime.value!) / 1000)
  }, 1000)

  // In a real app we'd create the trip route in Supabase here via POST API
  // fetch(`${API_URL}/api/driver/trip`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: ... })

  watchId = await Geolocation.watchPosition(
    { enableHighAccuracy: true, timeout: 10000 },
    (position, err) => {
      if (err || !position) return
      
      currentLat.value = position.coords.latitude
      currentLng.value = position.coords.longitude
      currentSpeed.value = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0
      
      // Ping the server with Bearer token!
      // fetch(`${API_URL}/api/driver/trip`, {
      //   method: 'POST',
      //   headers: { 
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${authToken}`
      //   },
      //   body: JSON.stringify({ action: 'ping', lat: currentLat.value, lng: currentLng.value })
      // })
    }
  )
}

function completeTrip() {
  if (watchId) {
    Geolocation.clearWatch({ id: watchId })
    watchId = null
  }
  if (timerInterval) clearInterval(timerInterval)
  
  isTracking.value = false
  currentLat.value = null
  currentLng.value = null
  currentSpeed.value = 0
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (watchId) Geolocation.clearWatch({ id: watchId })
})
</script>

<style>
.safe-area-pt {
  padding-top: env(safe-area-inset-top, 16px);
}
</style>
