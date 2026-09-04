<template>
  <div class="relative w-full h-full min-h-[350px] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
    <!-- Map Canvas Container -->
    <div ref="mapContainerRef" class="w-full h-full min-h-[350px]"></div>

    <!-- Status / Mode Badge Overlay -->
    <div class="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 text-xs font-medium">
      <span 
        class="w-2.5 h-2.5 rounded-full"
        :class="isLive ? 'bg-emerald-500 animate-ping' : 'bg-emerald-600'"
      ></span>
      <span class="text-gray-800 font-bold">
        {{ isLive ? 'Live GPS Active' : isSnapshot ? 'Verified Route Snapshot' : 'Delivery Route' }}
      </span>
      <span class="text-gray-400 text-[10px] pl-1 border-l border-gray-200">
        {{ engine === 'google' ? 'Google Maps' : 'OpenStreetMap' }}
      </span>
    </div>

    <!-- Stats Overlay (Distance & Duration) -->
    <div v-if="distanceKm !== undefined || durationMin !== undefined" class="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-white/95 backdrop-blur-sm px-3.5 py-2 rounded-xl shadow-md border border-gray-200 text-xs">
      <div v-if="distanceKm !== undefined" class="flex flex-col">
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Distance</span>
        <span class="font-bold text-[#1a5c4c] text-sm">{{ distanceKm }} km</span>
      </div>
      <div v-if="durationMin !== undefined" class="flex flex-col pl-3 border-l border-gray-200">
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Duration</span>
        <span class="font-bold text-gray-800 text-sm">{{ durationMin }} min</span>
      </div>
      <div v-if="payout !== undefined" class="flex flex-col pl-3 border-l border-gray-200">
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Payout</span>
        <span class="font-bold text-emerald-700 text-sm">₹{{ payout }}</span>
      </div>
    </div>

    <!-- Recenter / Fit View Button -->
    <button 
      @click="fitMapBounds" 
      class="absolute bottom-3 right-3 z-10 bg-white/95 hover:bg-white text-gray-700 p-2 rounded-lg shadow-md border border-gray-200 transition-colors"
      title="Fit Route to Screen"
    >
      <Compass class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { Compass } from 'lucide-vue-next'

interface LatLng {
  lat: number
  lng: number
}

const props = withDefaults(defineProps<{
  driverLocation?: LatLng | null
  startLocation?: LatLng | null
  destinationLocation?: LatLng | null
  routeCoordinates?: LatLng[]
  isLive?: boolean
  isSnapshot?: boolean
  distanceKm?: number
  durationMin?: number
  payout?: number
  defaultCenter?: LatLng
}>(), {
  defaultCenter: () => ({ lat: 12.2958, lng: 76.6394 }),
  isLive: false,
  isSnapshot: false,
  routeCoordinates: () => [],
})


const mapContainerRef = ref<HTMLElement | null>(null)
const engine = ref<'google' | 'leaflet'>('leaflet')

let googleMap: any = null
let googleDriverMarker: any = null
let googleDestMarker: any = null
let googlePolyline: any = null
let directionsRenderer: any = null
let directionsService: any = null

let leafletMap: any = null
let leafletDriverMarker: any = null
let leafletDestMarker: any = null
let leafletPolyline: any = null

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) return resolve((window as any).L)

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve((window as any).L)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function loadGoogleMaps(apiKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).google && (window as any).google.maps) {
      return resolve((window as any).google.maps)
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`
    script.onload = () => resolve((window as any).google.maps)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function initLeaflet() {
  if (!mapContainerRef.value) return
  const L = await loadLeaflet()

  const startPt = props.driverLocation || (props.routeCoordinates.length > 0 ? props.routeCoordinates[0] : props.defaultCenter)
  leafletMap = L.map(mapContainerRef.value).setView([startPt.lat, startPt.lng], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(leafletMap)

  const truckIcon = L.divIcon({
    className: 'custom-truck-icon',
    html: `<div style="background:#1a5c4c;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.3);border:2px solid white;font-size:16px;">🚚</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })

  const destIcon = L.divIcon({
    className: 'custom-dest-icon',
    html: `<div style="background:#ef4444;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.3);border:2px solid white;font-size:16px;">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

  const startPinIcon = L.divIcon({
    className: 'custom-start-icon',
    html: `<div style="background:#059669;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;font-size:13px;">🟢</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  // Permanent start pin — locked to driver's GPS at trip start
  if (props.startLocation) {
    L.marker([props.startLocation.lat, props.startLocation.lng], { icon: startPinIcon })
      .addTo(leafletMap)
      .bindPopup('<b>Trip Started Here</b>')
  }

  // Moving truck marker — driver's current GPS position
  const start = props.driverLocation || (props.routeCoordinates.length > 0 ? props.routeCoordinates[0] : null)
  if (start) {
    leafletDriverMarker = L.marker([start.lat, start.lng], { icon: truckIcon })
      .addTo(leafletMap)
      .bindPopup('<b>Driver Location</b>')
  }

  // Destination / Customer pin
  const end = props.destinationLocation
  if (end) {
    leafletDestMarker = L.marker([end.lat, end.lng], { icon: destIcon })
      .addTo(leafletMap)
      .bindPopup('<b>Delivery Address</b>')
  }

  updateLeafletRoute(L)

  setTimeout(() => {
    if (leafletMap) {
      leafletMap.invalidateSize()
      fitMapBounds()
    }
  }, 120)
}

function updateLeafletRoute(L?: any) {
  const leaflet = L || (window as any).L
  if (!leaflet || !leafletMap) return

  const coords = props.routeCoordinates.map((c) => [c.lat, c.lng])
  if (leafletPolyline) {
    leafletPolyline.setLatLngs(coords)
  } else if (coords.length > 0) {
    leafletPolyline = leaflet.polyline(coords, {
      color: '#1a5c4c',
      weight: 5,
      opacity: 0.9,
      dashArray: props.isLive ? '6, 6' : undefined,
    }).addTo(leafletMap)
  }
}

async function initGoogleMaps(apiKey: string) {
  if (!mapContainerRef.value) return
  const googleMaps = await loadGoogleMaps(apiKey)

  const startPt = props.driverLocation || (props.routeCoordinates.length > 0 ? props.routeCoordinates[0] : props.defaultCenter)
  googleMap = new googleMaps.Map(mapContainerRef.value, {
    center: startPt,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  })

  const truckSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="17" fill="#1a5c4c" stroke="#ffffff" stroke-width="2.5" />
      <text x="19" y="24" font-size="16" text-anchor="middle" fill="#ffffff">🚚</text>
    </svg>
  `)}`

  const destSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="17" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" />
      <text x="19" y="24" font-size="16" text-anchor="middle" fill="#ffffff">📍</text>
    </svg>
  `)}`

  const startPinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#059669" stroke="#ffffff" stroke-width="2.5" />
      <text x="16" y="21" font-size="13" text-anchor="middle" fill="#ffffff">🟢</text>
    </svg>
  `)}`

  // Permanent start pin — locked at driver's GPS when trip was started
  if (props.startLocation) {
    new googleMaps.Marker({
      position: props.startLocation,
      map: googleMap,
      icon: {
        url: startPinSvg,
        scaledSize: new googleMaps.Size(32, 32),
        anchor: new googleMaps.Point(16, 16),
      },
      title: 'Trip Started Here',
    })
  }

  // Moving truck marker
  const start = props.driverLocation || (props.routeCoordinates.length > 0 ? props.routeCoordinates[0] : null)
  if (start) {
    googleDriverMarker = new googleMaps.Marker({
      position: start,
      map: googleMap,
      icon: {
        url: truckSvg,
        scaledSize: new googleMaps.Size(38, 38),
        anchor: new googleMaps.Point(19, 19),
      },
      title: 'Driver Location',
    })
  }

  // Destination / Customer pin
  const end = props.destinationLocation
  if (end) {
    googleDestMarker = new googleMaps.Marker({
      position: end,
      map: googleMap,
      icon: {
        url: destSvg,
        scaledSize: new googleMaps.Size(38, 38),
        anchor: new googleMaps.Point(19, 19),
      },
      title: 'Delivery Address',
    })
  }

  updateGoogleRoute(googleMaps)
  setTimeout(() => {
    if (googleMap && (window as any).google?.maps) {
      (window as any).google.maps.event.trigger(googleMap, 'resize')
      fitMapBounds()
    }
  }, 120)
}

function renderGoogleDirections(maps: any) {
  if (!props.isLive || !props.driverLocation || !props.destinationLocation || !googleMap) {
    if (directionsRenderer) directionsRenderer.setMap(null)
    return
  }

  try {
    if (!directionsService) directionsService = new maps.DirectionsService()
    if (!directionsRenderer) {
      directionsRenderer = new maps.DirectionsRenderer({
        map: googleMap,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeOpacity: 0.5,
          strokeWeight: 4,
        }
      })
    } else {
      directionsRenderer.setMap(googleMap)
    }

    directionsService.route({
      origin: props.driverLocation,
      destination: props.destinationLocation,
      travelMode: maps.TravelMode.DRIVING,
    }, (result: any, status: any) => {
      if (status === 'OK' && directionsRenderer) {
        directionsRenderer.setDirections(result)
      }
    })
  } catch (e) {
    console.warn('Google Directions render failed:', e)
  }
}

function updateGoogleRoute(googleMaps?: any) {
  const maps = googleMaps || (window as any).google?.maps
  if (!maps || !googleMap) return

  if (googlePolyline) {
    googlePolyline.setPath(props.routeCoordinates)
  } else if (props.routeCoordinates.length > 0) {
    googlePolyline = new maps.Polyline({
      path: props.routeCoordinates,
      geodesic: true,
      strokeColor: '#1a5c4c',
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: googleMap,
    })
  }

  renderGoogleDirections(maps)
}

let hasFitInitially = false

function fitMapBounds(force = false) {
  const points: LatLng[] = []
  if (props.startLocation) points.push(props.startLocation)
  if (props.driverLocation) points.push(props.driverLocation)
  if (props.destinationLocation) points.push(props.destinationLocation)
  points.push(...props.routeCoordinates)

  if (points.length === 0) return

  if (!force && hasFitInitially && props.isLive) {
    return // Don't interrupt user zoom / pan while tracking live pings
  }

  hasFitInitially = true

  if (engine.value === 'google' && googleMap && (window as any).google?.maps) {
    const bounds = new (window as any).google.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(p))
    googleMap.fitBounds(bounds)
  } else if (engine.value === 'leaflet' && leafletMap && (window as any).L) {
    const bounds = (window as any).L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
  }
}

watch(() => props.driverLocation, (newLoc) => {
  if (!newLoc) return

  if (engine.value === 'google' && googleDriverMarker) {
    googleDriverMarker.setPosition(newLoc)
  } else if (engine.value === 'leaflet' && leafletDriverMarker) {
    leafletDriverMarker.setLatLng([newLoc.lat, newLoc.lng])
  }

  if (!hasFitInitially) {
    fitMapBounds()
  }

  if (props.isLive) {
    if (engine.value === 'leaflet') updateLeafletRoute()
    else updateGoogleRoute()
  }
}, { deep: true })

watch(() => props.routeCoordinates, () => {
  if (engine.value === 'leaflet') updateLeafletRoute()
  else updateGoogleRoute()
  if (!hasFitInitially) {
    fitMapBounds()
  }
}, { deep: true })

onMounted(async () => {
  const apiKey = 'AIzaSyCuH_BQBFYCt4vcFDL3CkUV1byZNuiLuYg'
  if (apiKey && apiKey.trim() !== '') {
    try {
      engine.value = 'google'
      await initGoogleMaps(apiKey)
      return
    } catch (e) {
      console.warn('Google Maps initialization failed, falling back to Leaflet:', e)
    }
  }

  engine.value = 'leaflet'
  await initLeaflet()
})

onBeforeUnmount(() => {
  if (leafletMap) {
    leafletMap.remove()
    leafletMap = null
  }
})
</script>

<style>
.custom-truck-icon, .custom-dest-icon {
  background: transparent !important;
  border: none !important;
}
</style>
