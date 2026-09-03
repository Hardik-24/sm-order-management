<template>
  <div style="font-family: sans-serif; padding: 20px;">
    <h2>SM Fleet (Native Proto)</h2>
    
    <div v-if="!tripStarted" style="margin-top: 20px;">
      <button @click="startNativeTracking" style="padding: 15px 30px; background: #1a5c4c; color: white; border: none; border-radius: 8px; font-weight: bold;">
        Start Native GPS Tracking
      </button>
    </div>

    <div v-else style="margin-top: 20px; padding: 15px; border: 2px solid #4ecdc4; border-radius: 8px;">
      <h3 style="color: #1a5c4c; margin-top: 0;">🟢 Tracking Active (Background)</h3>
      <p><strong>Lat:</strong> {{ currentLat }}</p>
      <p><strong>Lng:</strong> {{ currentLng }}</p>
      <p><strong>Speed:</strong> {{ speed }} km/h</p>
      <p style="font-size: 12px; color: gray;">This app uses native OS APIs. You can lock your phone screen, and it will continue logging.</p>
      
      <button @click="stopTracking" style="margin-top: 10px; padding: 10px 20px; background: #e53e3e; color: white; border: none; border-radius: 8px; font-weight: bold;">
        Stop & Complete
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Geolocation } from '@capacitor/geolocation'

const tripStarted = ref(false)
const currentLat = ref<number | null>(null)
const currentLng = ref<number | null>(null)
const speed = ref<number | null>(null)
let watchId: string | null = null

async function startNativeTracking() {
  // Request native OS permissions (iOS/Android)
  const permissions = await Geolocation.requestPermissions()
  
  if (permissions.location !== 'granted') {
    alert('Location permissions denied by the OS.')
    return
  }

  tripStarted.value = true

  // Capacitor native watch (works much better in background than browser)
  watchId = await Geolocation.watchPosition(
    { enableHighAccuracy: true, timeout: 10000 },
    (position, err) => {
      if (err || !position) return
      
      currentLat.value = position.coords.latitude
      currentLng.value = position.coords.longitude
      speed.value = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0
      
      // In a full app, we would batch these and send via HTTP:
      // fetch('https://sm-order-management.vercel.app/api/driver/trip', ...)
    }
  )
}

function stopTracking() {
  if (watchId) {
    Geolocation.clearWatch({ id: watchId })
    watchId = null
  }
  tripStarted.value = false
  currentLat.value = null
  currentLng.value = null
  speed.value = null
}
</script>
