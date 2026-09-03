<template>
  <div v-if="isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <!-- Header -->
      <div class="px-6 py-4 bg-[#1a1a1a] text-white flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#1a5c4c] flex items-center justify-center text-white">
            <MapPin class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base text-[#e8e0d4]">Set Customer Delivery Pin</h3>
            <p class="text-xs text-gray-400 truncate max-w-md">{{ customerName }} • {{ customerCompany || deliveryAddress }}</p>
          </div>
        </div>
        <button @click="close" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto space-y-4 flex-1">
        <!-- Currently Saved Pin Banner -->
        <div v-if="savedPinInfo" class="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in">
          <div class="flex items-center gap-2.5 text-xs text-emerald-900 min-w-0">
            <div class="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MapPin class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <p class="font-bold flex items-center gap-1.5 text-emerald-950 flex-wrap">
                <span>Currently Saved Pin:</span>
                <span class="font-mono bg-emerald-100/80 px-1.5 py-0.5 rounded text-emerald-800 text-[11px]">{{ savedPinInfo.lat.toFixed(4) }}, {{ savedPinInfo.lng.toFixed(4) }}</span>
              </p>
              <p v-if="savedPinInfo.landmark" class="text-[11px] text-emerald-700 truncate mt-0.5 font-medium">
                Landmark: {{ savedPinInfo.landmark }}
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="deletePin"
            :disabled="isDeleting"
            class="px-3 py-1.5 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
            title="Delete this saved pin"
          >
            <Trash2 v-if="!isDeleting" class="w-3.5 h-3.5 text-rose-600" />
            <Loader2 v-else class="w-3.5 h-3.5 animate-spin text-rose-600" />
            <span>{{ isDeleting ? 'Deleting...' : 'Delete Pin' }}</span>
          </button>
        </div>

        <!-- Address info card -->
        <div class="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
          <Info class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div class="text-xs text-amber-900 leading-relaxed">
            <p class="font-semibold mb-0.5">Customer Delivery Address:</p>
            <p class="text-amber-800">{{ deliveryAddress || 'Mysore, Karnataka' }}</p>
            <p class="mt-1 text-[11px] text-amber-700">Search a nearby landmark below, or click anywhere on the map to set the exact gate pin.</p>
          </div>
        </div>

        <!-- Search Landmark / Colony / Road -->
        <div class="relative">
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Search Landmark, Colony or Area</label>
          <div class="relative">
            <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              v-model="searchQuery"
              @keydown.enter.prevent="searchLocation(false)"
              type="text"
              placeholder="e.g. Hebbal Industrial Area, Vontikoppal, Ring Road, or factory name..."
              class="w-full pl-9 pr-24 py-2.5 text-xs bg-white border border-gray-300 rounded-xl focus:border-[#1a5c4c] focus:ring-2 focus:ring-[#1a5c4c]/20 focus:outline-none shadow-sm transition-all"
            />
            <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                v-if="searchQuery"
                type="button"
                @click="clearSearch"
                class="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition"
              >
                <X class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="searchLocation(false)"
                :disabled="isSearching || !searchQuery.trim()"
                class="px-3 py-1 bg-[#1a5c4c] text-white hover:bg-[#14483b] disabled:opacity-40 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Loader2 v-if="isSearching" class="w-3.5 h-3.5 animate-spin" />
                <span>{{ isSearching ? 'Searching...' : 'Find' }}</span>
              </button>
            </div>
          </div>

          <!-- Suggestions Dropdown Box -->
          <div 
            v-if="searchResults.length > 0" 
            class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto p-1.5 divide-y divide-gray-100 z-50 animate-in fade-in slide-in-from-top-1"
          >
            <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 rounded-t-lg">
              Suggested Locations in Mysore (Click to set pin):
            </div>
            <button
              v-for="(res, idx) in searchResults"
              :key="idx"
              type="button"
              @click="selectSearchResult(res)"
              class="w-full text-left px-3 py-2.5 text-xs hover:bg-emerald-50 rounded-lg flex items-start gap-2.5 transition-colors group cursor-pointer"
            >
              <div class="w-6 h-6 rounded-full bg-emerald-100 text-[#1a5c4c] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#1a5c4c] group-hover:text-white transition-colors">
                <MapPin class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-gray-900 group-hover:text-[#1a5c4c] transition-colors truncate">{{ res.title }}</p>
                <p class="text-[11px] text-gray-500 truncate mt-0.5">{{ res.subtitle }}</p>
              </div>
            </button>
          </div>

          <!-- No Results Indicator -->
          <div v-else-if="hasSearched && !isSearching && searchResults.length === 0 && searchQuery.trim()" class="mt-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <Info class="w-4 h-4 text-amber-600 shrink-0" />
            <span>No exact matches found. You can search another landmark or click directly on the map.</span>
          </div>
        </div>

        <!-- Interactive Map Container -->
        <div class="relative w-full h-72 min-h-[300px] rounded-xl border border-gray-200 overflow-hidden bg-gray-100 z-0">
          <div ref="pickerMapRef" class="w-full h-full min-h-[300px]"></div>
          
          <div class="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-600 shadow border border-gray-200 pointer-events-none">
            Click map to move pin 📍
          </div>
        </div>

        <!-- Lat / Lng / Landmark Inputs -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Latitude</label>
            <input 
              v-model.number="currentLat" 
              type="number" 
              step="0.0001" 
              class="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#1a5c4c] focus:outline-none"
              placeholder="12.3080"
              @input="onCoordInput"
            />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Longitude</label>
            <input 
              v-model.number="currentLng" 
              type="number" 
              step="0.0001" 
              class="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#1a5c4c] focus:outline-none"
              placeholder="76.6420"
              @input="onCoordInput"
            />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Gate / Landmark (Optional)</label>
            <input 
              v-model="landmark" 
              type="text" 
              class="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#1a5c4c] focus:outline-none"
              placeholder="e.g. Opposite Gate #2"
            />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            v-if="savedPinInfo"
            type="button"
            @click="deletePin"
            :disabled="isDeleting"
            class="px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Remove currently saved pin"
          >
            <Trash2 v-if="!isDeleting" class="w-3.5 h-3.5 text-rose-600" />
            <Loader2 v-else class="w-3.5 h-3.5 animate-spin text-rose-600" />
            <span>{{ isDeleting ? 'Deleting...' : 'Delete Pin' }}</span>
          </button>
          <div class="text-xs text-gray-500">
            <span v-if="currentLat && currentLng" class="font-medium text-emerald-700">
              ✓ Pin ready: {{ currentLat.toFixed(4) }}, {{ currentLng.toFixed(4) }}
            </span>
            <span v-else class="text-amber-600 font-medium">Please drop a pin on the map</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button 
            type="button" 
            @click="close" 
            class="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="savePin" 
            :disabled="!currentLat || !currentLng || isSaving || isDeleting"
            class="px-5 py-2 text-xs font-bold text-white bg-[#1a5c4c] hover:bg-[#14483b] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
            <span>{{ isSaving ? 'Saving...' : 'Save Delivery Pin' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { MapPin, X, Info, Loader2, Search, Trash2 } from 'lucide-vue-next'
import { useRuntimeConfig } from '#app'
import { useSnackbar } from '~/composables/useSnackbar'

const { showSaving, showSaved } = useSnackbar()

const props = defineProps<{
  isOpen: boolean
  customerId?: string
  customerName: string
  customerCompany?: string
  deliveryAddress?: string
  initialLat?: number
  initialLng?: number
  initialLandmark?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', pin: { lat: number; lng: number; landmark?: string; areaName?: string } | null): void
}>()

const config = useRuntimeConfig()
const pickerMapRef = ref<HTMLDivElement | null>(null)

const currentLat = ref<number>(props.initialLat || 12.3080)
const currentLng = ref<number>(props.initialLng || 76.6420)
const landmark = ref<string>(props.initialLandmark || '')
const selectedPresetName = ref<string>('')
const isSaving = ref(false)
const isDeleting = ref(false)
const savedPinInfo = ref<{ lat: number; lng: number; landmark?: string } | null>(null)

const searchQuery = ref('')
const searchResults = ref<Array<{ title: string; subtitle: string; lat?: number; lng?: number; placeId?: string }>>([])
const isSearching = ref(false)
const hasSearched = ref(false)
let debounceTimer: any = null

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  hasSearched.value = false
}

// Live debounced search as user types
watch(searchQuery, (newVal) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!newVal || newVal.trim().length < 2) {
    searchResults.value = []
    hasSearched.value = false
    return
  }
  debounceTimer = setTimeout(() => {
    searchLocation(false)
  }, 350)
})

async function searchLocation(autoSelectFirst = false) {
  const query = searchQuery.value.trim()
  if (!query) return

  isSearching.value = true
  hasSearched.value = true

  const apiKey = (config.public as any).googleMapsApiKey
  if (apiKey && (window as any).google?.maps?.places) {
    try {
      const autocomplete = new (window as any).google.maps.places.AutocompleteService()
      autocomplete.getPlacePredictions(
        { 
          input: query,
          componentRestrictions: { country: 'in' },
          locationBias: {
            radius: 35000,
            center: { lat: 12.3080, lng: 76.6420 }
          }
        }, 
        (predictions: any, status: any) => {
          isSearching.value = false
          if (status === 'OK' && predictions && predictions.length > 0) {
            searchResults.value = predictions.slice(0, 6).map((p: any) => ({
              title: p.structured_formatting?.main_text || p.description.split(',')[0],
              subtitle: p.structured_formatting?.secondary_text || p.description,
              placeId: p.place_id,
            }))
            if (autoSelectFirst && searchResults.value.length === 1) {
              selectSearchResult(searchResults.value[0])
            }
          } else {
            // Fallback to Geocoder if no POI predictions
            runGoogleGeocoder(query, autoSelectFirst)
          }
        }
      )
      return
    } catch (e) {
      console.warn('Google Places autocomplete failed, falling back to Geocoder:', e)
    }
  }

  // Fallback to Geocoder / Nominatim
  if (apiKey && (window as any).google?.maps) {
    runGoogleGeocoder(query, autoSelectFirst)
    return
  }

  // OpenStreetMap Nominatim Fallback
  try {
    const res = await $fetch<any[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Mysore, Karnataka')}&limit=6`
    )
    isSearching.value = false
    if (res && res.length > 0) {
      searchResults.value = res.map((r: any) => ({
        title: r.display_name.split(',')[0],
        subtitle: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      }))
      if (autoSelectFirst && searchResults.value.length === 1) {
        selectSearchResult(searchResults.value[0])
      }
    } else {
      searchResults.value = []
    }
  } catch (err) {
    console.error('Nominatim search failed:', err)
    isSearching.value = false
    searchResults.value = []
  }
}

function runGoogleGeocoder(query: string, autoSelectFirst = false) {
  try {
    const geocoder = new (window as any).google.maps.Geocoder()
    geocoder.geocode(
      { 
        address: `${query}, Mysore, Karnataka`, 
        componentRestrictions: { country: 'IN' } 
      }, 
      (results: any, status: any) => {
        isSearching.value = false
        if (status === 'OK' && results && results.length > 0) {
          searchResults.value = results.slice(0, 6).map((r: any) => ({
            title: r.formatted_address.split(',')[0],
            subtitle: r.formatted_address,
            lat: r.geometry.location.lat(),
            lng: r.geometry.location.lng(),
          }))
          if (autoSelectFirst && searchResults.value.length === 1) {
            selectSearchResult(searchResults.value[0])
          }
        } else {
          searchResults.value = []
        }
      }
    )
  } catch (e) {
    isSearching.value = false
    searchResults.value = []
  }
}

function selectSearchResult(result: { title: string; subtitle: string; lat?: number; lng?: number; placeId?: string }) {
  if (result.lat && result.lng) {
    const lat = Math.round(Number(result.lat) * 100000) / 100000
    const lng = Math.round(Number(result.lng) * 100000) / 100000
    currentLat.value = lat
    currentLng.value = lng
    selectedPresetName.value = result.title
    if (!landmark.value) {
      landmark.value = result.title
    }
    updateMapPosition(lat, lng)
  } else if (result.placeId && (window as any).google?.maps) {
    try {
      if (googleMap && (window as any).google.maps.places?.PlacesService) {
        const placesService = new (window as any).google.maps.places.PlacesService(googleMap)
        placesService.getDetails({ placeId: result.placeId, fields: ['geometry', 'name', 'formatted_address'] }, (place: any, status: any) => {
          if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const lat = Math.round(place.geometry.location.lat() * 100000) / 100000
            const lng = Math.round(place.geometry.location.lng() * 100000) / 100000
            currentLat.value = lat
            currentLng.value = lng
            selectedPresetName.value = place.name || result.title
            landmark.value = place.name || result.title
            updateMapPosition(lat, lng)
            return
          }
          runGeocoderPlaceId(result.placeId!, result.title)
        })
        searchResults.value = []
        hasSearched.value = false
        return
      }
    } catch (e) {
      console.warn('PlacesService details failed, falling back to geocoder:', e)
    }

    runGeocoderPlaceId(result.placeId, result.title)
  }

  searchResults.value = []
  hasSearched.value = false
}

function runGeocoderPlaceId(placeId: string, title: string) {
  try {
    const geocoder = new (window as any).google.maps.Geocoder()
    geocoder.geocode({ placeId }, (results: any, status: any) => {
      if (status === 'OK' && results && results[0]?.geometry?.location) {
        const loc = results[0].geometry.location
        const lat = Math.round(loc.lat() * 100000) / 100000
        const lng = Math.round(loc.lng() * 100000) / 100000
        currentLat.value = lat
        currentLng.value = lng
        selectedPresetName.value = title
        landmark.value = title
        updateMapPosition(lat, lng)
      }
    })
  } catch (err) {
    console.error('Geocoder placeId failed:', err)
  }
}

const presets = ref<Record<string, { lat: number; lng: number; name: string }>>({
  'hebbal': { lat: 12.3550, lng: 76.6020, name: 'Hebbal Industrial Area' },
  'hootagalli': { lat: 12.3520, lng: 76.5780, name: 'Hootagalli Industrial Area' },
  'kuvempunagar': { lat: 12.2850, lng: 76.6260, name: 'Kuvempunagar' },
  'vijayanagar': { lat: 12.3380, lng: 76.6080, name: 'Vijayanagar' },
  'saraswathipuram': { lat: 12.3020, lng: 76.6340, name: 'Saraswathipuram' },
  'gokulam': { lat: 12.3290, lng: 76.6320, name: 'Gokulam' },
  'yadavagiri': { lat: 12.3240, lng: 76.6410, name: 'Yadavagiri Industrial Estate' },
  'metagalli': { lat: 12.3480, lng: 76.6360, name: 'Metagalli' },
  'bannimantap': { lat: 12.3360, lng: 76.6500, name: 'Bannimantap' },
  'jp nagar': { lat: 12.2710, lng: 76.6490, name: 'JP Nagar' },
  'nanjangud': { lat: 12.1180, lng: 76.6820, name: 'Nanjangud' },
})

let googleMap: any = null
let googleMarker: any = null
let leafletMap: any = null
let leafletMarker: any = null

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

function onCoordInput() {
  if (currentLat.value && currentLng.value) {
    updateMapPosition(currentLat.value, currentLng.value)
  }
}

function updateMapPosition(lat: number, lng: number) {
  if (googleMap && googleMarker) {
    const pos = new (window as any).google.maps.LatLng(lat, lng)
    googleMarker.setPosition(pos)
    googleMap.panTo(pos)
  } else if (leafletMap && leafletMarker) {
    leafletMarker.setLatLng([lat, lng])
    leafletMap.panTo([lat, lng])
  }
}

async function initMap() {
  if (!pickerMapRef.value) return

  const lat = currentLat.value || 12.3080
  const lng = currentLng.value || 76.6420

  const apiKey = (config.public as any).googleMapsApiKey
  if (apiKey && apiKey.trim() !== '') {
    try {
      const googleMaps = await loadGoogleMaps(apiKey)
      googleMap = new googleMaps.Map(pickerMapRef.value, {
        center: { lat, lng },
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      const destSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
          <circle cx="19" cy="19" r="17" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" />
          <text x="19" y="24" font-size="16" text-anchor="middle" fill="#ffffff">📍</text>
        </svg>
      `)}`

      googleMarker = new googleMaps.Marker({
        position: { lat, lng },
        map: googleMap,
        draggable: true,
        icon: {
          url: destSvg,
          scaledSize: new googleMaps.Size(38, 38),
          anchor: new googleMaps.Point(19, 19),
        },
      })

      googleMaps.event.addListener(googleMap, 'click', (event: any) => {
        const clickedLat = event.latLng.lat()
        const clickedLng = event.latLng.lng()
        currentLat.value = Math.round(clickedLat * 100000) / 100000
        currentLng.value = Math.round(clickedLng * 100000) / 100000
        googleMarker.setPosition(event.latLng)
        selectedPresetName.value = ''
      })

      googleMaps.event.addListener(googleMarker, 'dragend', (event: any) => {
        const draggedLat = event.latLng.lat()
        const draggedLng = event.latLng.lng()
        currentLat.value = Math.round(draggedLat * 100000) / 100000
        currentLng.value = Math.round(draggedLng * 100000) / 100000
        selectedPresetName.value = ''
      })

      setTimeout(() => {
        if (googleMap && (window as any).google?.maps) {
          (window as any).google.maps.event.trigger(googleMap, 'resize')
          googleMap.panTo({ lat, lng })
        }
      }, 150)
      return
    } catch (e) {
      console.warn('Google Maps load failed in pin modal, falling back to Leaflet:', e)
    }
  }

  // Leaflet Fallback
  try {
    const L = await loadLeaflet()
    if (!pickerMapRef.value) return
    if (leafletMap) {
      leafletMap.remove()
      leafletMap = null
    }

    leafletMap = L.map(pickerMapRef.value).setView([lat, lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(leafletMap)

    const destIcon = L.divIcon({
      className: 'custom-dest-icon',
      html: `
        <div style="width:36px;height:36px;background:#ef4444;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 10px rgba(0,0,0,0.3);">
          📍
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })

    leafletMarker = L.marker([lat, lng], { draggable: true, icon: destIcon }).addTo(leafletMap)

    leafletMap.on('click', (e: any) => {
      currentLat.value = Math.round(e.latlng.lat * 100000) / 100000
      currentLng.value = Math.round(e.latlng.lng * 100000) / 100000
      leafletMarker.setLatLng(e.latlng)
      selectedPresetName.value = ''
    })

    leafletMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng()
      currentLat.value = Math.round(pos.lat * 100000) / 100000
      currentLng.value = Math.round(pos.lng * 100000) / 100000
      selectedPresetName.value = ''
    })

    setTimeout(() => {
      if (leafletMap) {
        leafletMap.invalidateSize()
        leafletMap.panTo([lat, lng])
      }
    }, 150)
  } catch (err) {
    console.error('Failed to init Leaflet in pin modal:', err)
  }
}

async function savePin() {
  const latNum = Number(currentLat.value)
  const lngNum = Number(currentLng.value)

  if (isNaN(latNum) || isNaN(lngNum) || latNum === 0 || lngNum === 0) {
    showSaved('Please drop or select a pin on the map first')
    return
  }

  isSaving.value = true
  showSaving('Saving customer delivery pin...')

  try {
    const key = props.customerId || props.customerName || props.deliveryAddress || 'default'
    const res = await $fetch<{ success: boolean; pin: any }>('/api/customers/pins', {
      method: 'POST',
      body: {
        customerKey: key,
        customerId: props.customerId || undefined,
        customerName: props.customerName || undefined,
        customerCompany: props.customerCompany || undefined,
        deliveryAddress: props.deliveryAddress || undefined,
        lat: latNum,
        lng: lngNum,
        landmark: landmark.value || undefined,
        areaName: selectedPresetName.value || undefined,
      }
    })

    // Broadcast instant sync to driver app tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('sm_delivery_channel')
        channel.postMessage({ type: 'DELIVERY_STATUS_CHANGED', action: 'PIN_UPDATED', customerId: props.customerId })
        channel.close()
      }
    } catch (e) {}

    showSaved(`Delivery pin saved for ${props.customerCompany || props.customerName || 'Customer'}!`)

    emit('saved', {
      lat: latNum,
      lng: lngNum,
      landmark: landmark.value,
      areaName: selectedPresetName.value,
    })
    close()
  } catch (e: any) {
    console.error('Failed to save pin:', e)
    showSaved(e?.data?.statusMessage || 'Failed to save pin. Please try again.')
  } finally {
    isSaving.value = false
  }
}

async function deletePin() {
  if (!confirm(`Are you sure you want to remove the saved delivery pin for ${props.customerCompany || props.customerName || 'this customer'}?`)) {
    return
  }

  isDeleting.value = true
  showSaving('Removing customer delivery pin...')

  try {
    await $fetch('/api/customers/pins', {
      method: 'DELETE',
      query: {
        customerId: props.customerId || undefined,
        customerName: props.customerName || undefined,
        customerCompany: props.customerCompany || undefined,
      }
    })

    savedPinInfo.value = null
    currentLat.value = 12.3080
    currentLng.value = 76.6420
    landmark.value = ''
    selectedPresetName.value = ''

    // Broadcast instant sync to driver app tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('sm_delivery_channel')
        channel.postMessage({ type: 'DELIVERY_STATUS_CHANGED', action: 'PIN_DELETED', customerId: props.customerId })
        channel.close()
      }
    } catch (e) {}

    showSaved('Customer delivery pin removed successfully.')
    emit('saved', null)
    close()
  } catch (e: any) {
    console.error('Failed to delete pin:', e)
    showSaved(e?.data?.statusMessage || 'Failed to remove pin. Please try again.')
  } finally {
    isDeleting.value = false
  }
}

function close() {
  emit('close')
}

watch(() => props.isOpen, async (open) => {
  if (open) {
    let lat = props.initialLat
    let lng = props.initialLng
    let lm = props.initialLandmark

    let foundSaved = false
    if (lat && lng) {
      foundSaved = true
    } else {
      try {
        const data = await $fetch<{ pins: Record<string, any> }>('/api/customers/pins')
        const pins = data?.pins || {}
        const idKey = (props.customerId || '').toLowerCase().trim()
        const nameKey = (props.customerName || '').toLowerCase().trim()
        const compKey = (props.customerCompany || '').toLowerCase().trim()

        const existing = (idKey ? pins[idKey] : null) || (nameKey ? pins[nameKey] : null) || (compKey ? pins[compKey] : null)
        if (existing) {
          lat = existing.lat
          lng = existing.lng
          lm = existing.landmark || existing.areaName
          foundSaved = true
        }
      } catch (e) {
        console.warn('Could not auto-fetch pin on modal open:', e)
      }
    }

    if (foundSaved && lat && lng) {
      savedPinInfo.value = {
        lat: Number(lat),
        lng: Number(lng),
        landmark: lm || '',
      }
    } else {
      savedPinInfo.value = null
    }

    currentLat.value = lat || 12.3080
    currentLng.value = lng || 76.6420
    landmark.value = lm || ''
    selectedPresetName.value = lm || ''
    await nextTick()
    setTimeout(() => {
      initMap()
    }, 100)
  } else {
    if (googleMap) googleMap = null
    if (leafletMap) {
      leafletMap.remove()
      leafletMap = null
    }
  }
})
</script>
