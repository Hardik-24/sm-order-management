import { ref } from 'vue'
import { Preferences } from '@capacitor/preferences'
import { Device } from '@capacitor/device'

export interface DevicePayload {
  id: string
  name: string
  type: 'MOBILE' | 'TABLET' | 'DESKTOP'
  browser: string
  os: string
  cpuCores: number
  gpuRenderer: string
  screenResolution: string
  hardwareHash: string
  pairingCode?: string
}

const STORAGE_KEY = 'sm_flow_hw_device_id'
const cachedDevicePayload = ref<DevicePayload | null>(null)
const isDetecting = ref(false)

/**
 * Maps raw hardware manufacturer & model codes to clean commercial names
 * e.g. "SM-S928B" -> "Samsung Galaxy S24 Ultra", "A065" -> "Nothing Phone (2a)"
 */
export function resolveMarketingDeviceName(
  manufacturer?: string,
  model?: string,
  os?: string,
  osVersion?: string,
  fallbackName?: string
): string {
  const mfr = (manufacturer || '').trim()
  const rawModel = (model || '').trim()
  const m = rawModel.toUpperCase()

  // 1. Samsung Galaxy S-Series, Z-Series & Note Series
  if (m.startsWith('SM-S938')) return 'Samsung Galaxy S25 Ultra'
  if (m.startsWith('SM-S936')) return 'Samsung Galaxy S25+'
  if (m.startsWith('SM-S931')) return 'Samsung Galaxy S25'
  if (m.startsWith('SM-S928')) return 'Samsung Galaxy S24 Ultra'
  if (m.startsWith('SM-S926')) return 'Samsung Galaxy S24+'
  if (m.startsWith('SM-S921')) return 'Samsung Galaxy S24'
  if (m.startsWith('SM-S918')) return 'Samsung Galaxy S23 Ultra'
  if (m.startsWith('SM-S916')) return 'Samsung Galaxy S23+'
  if (m.startsWith('SM-S911')) return 'Samsung Galaxy S23'
  if (m.startsWith('SM-S908')) return 'Samsung Galaxy S22 Ultra'
  if (m.startsWith('SM-S906')) return 'Samsung Galaxy S22+'
  if (m.startsWith('SM-S901')) return 'Samsung Galaxy S22'
  if (m.startsWith('SM-G998')) return 'Samsung Galaxy S21 Ultra'
  if (m.startsWith('SM-G996')) return 'Samsung Galaxy S21+'
  if (m.startsWith('SM-G991')) return 'Samsung Galaxy S21'
  if (m.startsWith('SM-G988')) return 'Samsung Galaxy S20 Ultra'
  if (m.startsWith('SM-N986')) return 'Samsung Galaxy Note 20 Ultra'
  if (m.startsWith('SM-S721')) return 'Samsung Galaxy S24 FE'
  if (m.startsWith('SM-S711')) return 'Samsung Galaxy S23 FE'
  if (m.startsWith('SM-F956')) return 'Samsung Galaxy Z Fold6'
  if (m.startsWith('SM-F946')) return 'Samsung Galaxy Z Fold5'
  if (m.startsWith('SM-F936')) return 'Samsung Galaxy Z Fold4'
  if (m.startsWith('SM-F741')) return 'Samsung Galaxy Z Flip6'
  if (m.startsWith('SM-F731')) return 'Samsung Galaxy Z Flip5'
  if (m.startsWith('SM-F721')) return 'Samsung Galaxy Z Flip4'

  // Samsung Galaxy A, M & F series
  if (m.startsWith('SM-A556')) return 'Samsung Galaxy A55 5G'
  if (m.startsWith('SM-A356')) return 'Samsung Galaxy A35 5G'
  if (m.startsWith('SM-A546')) return 'Samsung Galaxy A54 5G'
  if (m.startsWith('SM-A346')) return 'Samsung Galaxy A34 5G'
  if (m.startsWith('SM-A256')) return 'Samsung Galaxy A25 5G'
  if (m.startsWith('SM-A156') || m.startsWith('SM-A155')) return 'Samsung Galaxy A15'
  if (m.startsWith('SM-A057') || m.startsWith('SM-A055')) return 'Samsung Galaxy A05'
  if (m.startsWith('SM-M556')) return 'Samsung Galaxy M55 5G'
  if (m.startsWith('SM-M346')) return 'Samsung Galaxy M34 5G'
  if (m.startsWith('SM-M146')) return 'Samsung Galaxy M14 5G'
  if (m.startsWith('SM-F546')) return 'Samsung Galaxy F54 5G'
  if (m.startsWith('SM-')) return `Samsung Galaxy (${rawModel})`

  // 2. Nothing Phone & CMF Series (Global & Indian Variants)
  if (m === 'A142' || m.startsWith('A142') || m === 'A065' || m.startsWith('A065')) return 'Nothing Phone (2a)'
  if (m === 'A065P' || m.startsWith('A065P')) return 'Nothing Phone (2a) Plus'
  if (m === 'A063') return 'Nothing Phone (2)'
  if (m === 'A059') return 'Nothing Phone (1)'
  if (m.startsWith('A015') || m.includes('CMF')) return 'CMF Phone 1 by Nothing'
  if (m.startsWith('A1') || m.startsWith('A0')) return `Nothing (${rawModel})`

  // 3. OnePlus Series
  if (m.startsWith('CPH258')) return 'OnePlus 12'
  if (m.startsWith('CPH260')) return 'OnePlus 12R'
  if (m.startsWith('CPH244') || m.startsWith('CPH245')) return 'OnePlus 11'
  if (m.startsWith('CPH2487')) return 'OnePlus 11R'
  if (m.startsWith('CPH2413')) return 'OnePlus 10 Pro'
  if (m.startsWith('CPH2423')) return 'OnePlus 10R'
  if (m.startsWith('CPH2629')) return 'OnePlus Nord 4'
  if (m.startsWith('CPH2613')) return 'OnePlus Nord CE 4'
  if (m.startsWith('CPH2619')) return 'OnePlus Nord CE 4 Lite'
  if (m.startsWith('CPH2569')) return 'OnePlus Nord 3'
  if (m.startsWith('CPH251')) return 'OnePlus Nord CE 3'
  if (m.startsWith('CPH') && mfr.toLowerCase().includes('oneplus')) return `OnePlus (${rawModel})`

  // 4. Google Pixel Series
  if (m.startsWith('PIXEL 9 PRO')) return 'Google Pixel 9 Pro'
  if (m.startsWith('PIXEL 9')) return 'Google Pixel 9'
  if (m.startsWith('PIXEL 8A')) return 'Google Pixel 8a'
  if (m.startsWith('PIXEL 8 PRO')) return 'Google Pixel 8 Pro'
  if (m.startsWith('PIXEL 8')) return 'Google Pixel 8'
  if (m.startsWith('PIXEL 7A')) return 'Google Pixel 7a'
  if (m.startsWith('PIXEL 7 PRO')) return 'Google Pixel 7 Pro'
  if (m.startsWith('PIXEL 7')) return 'Google Pixel 7'
  if (m.startsWith('PIXEL 6A')) return 'Google Pixel 6a'

  // 5. Apple iPhone Models
  if (m.startsWith('IPHONE17,1')) return 'iPhone 16 Pro'
  if (m.startsWith('IPHONE17,2')) return 'iPhone 16 Pro Max'
  if (m.startsWith('IPHONE17,3')) return 'iPhone 16'
  if (m.startsWith('IPHONE17,4')) return 'iPhone 16 Plus'
  if (m.startsWith('IPHONE16,1')) return 'iPhone 15 Pro'
  if (m.startsWith('IPHONE16,2')) return 'iPhone 15 Pro Max'
  if (m.startsWith('IPHONE15,4')) return 'iPhone 15'
  if (m.startsWith('IPHONE15,5')) return 'iPhone 15 Plus'
  if (m.startsWith('IPHONE15,2')) return 'iPhone 14 Pro'
  if (m.startsWith('IPHONE15,3')) return 'iPhone 14 Pro Max'
  if (m.startsWith('IPHONE14,7')) return 'iPhone 14'
  if (m.startsWith('IPHONE14,8')) return 'iPhone 14 Plus'
  if (m.startsWith('IPHONE14,2')) return 'iPhone 13 Pro'
  if (m.startsWith('IPHONE14,3')) return 'iPhone 13 Pro Max'
  if (m.startsWith('IPHONE14,5')) return 'iPhone 13'
  if (m.startsWith('IPHONE13,')) return 'iPhone 12 Series'

  // 6. Generic Manufacturer + Model formatting
  if (mfr && rawModel) {
    const cleanMfr = mfr.charAt(0).toUpperCase() + mfr.slice(1)
    if (rawModel.toLowerCase().startsWith(cleanMfr.toLowerCase())) {
      return rawModel
    }
    return `${cleanMfr} ${rawModel}`
  }

  if (rawModel) return rawModel
  if (mfr) return `${mfr.charAt(0).toUpperCase() + mfr.slice(1)} Device`

  return fallbackName || 'Mobile Phone'
}

export const useDeviceSecurity = () => {
  const getPersistentDeviceId = async (): Promise<string> => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY })
      if (value) {
        try { localStorage.setItem(STORAGE_KEY, value) } catch {}
        return value
      }
    } catch {}

    try {
      const local = localStorage.getItem(STORAGE_KEY)
      if (local) {
        await Preferences.set({ key: STORAGE_KEY, value: local })
        return local
      }
    } catch {}

    // Generate unique hardware-bound device ID
    const randomBytes = new Uint8Array(12)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(randomBytes)
    } else {
      for (let i = 0; i < 12; i++) randomBytes[i] = Math.floor(Math.random() * 256)
    }
    const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const newId = `DEV-${hex.slice(0, 6)}-${hex.slice(6, 12)}-${hex.slice(12, 18)}`

    try {
      await Preferences.set({ key: STORAGE_KEY, value: newId })
      localStorage.setItem(STORAGE_KEY, newId)
    } catch {}

    return newId
  }

  const getGpuRenderer = (): string => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) return 'Mali/Adreno Mobile GPU'
      const ext = (gl as any).getExtension('WEBGL_debug_renderer_info')
      if (!ext) return 'Standard Mobile Accelerator'
      const renderer = (gl as any).getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'Mobile GPU'
      return String(renderer).replace(/ANGLE\s*\((.*)\)/i, '$1').trim()
    } catch {
      return 'Mobile GPU'
    }
  }

  const parsePlatformDetails = () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null
    const platform = cap?.getPlatform ? cap.getPlatform() : 'web'

    let os = 'Android'
    if (platform === 'ios' || /iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
    else if (platform === 'android' || /Android/i.test(ua)) os = 'Android'
    else if (/Windows/i.test(ua)) os = 'Windows'

    let browser = 'SM Fleet App'
    if (cap?.isNativePlatform && cap.isNativePlatform()) {
      browser = 'SM Fleet Capacitor App'
    } else if (/Chrome/i.test(ua)) {
      browser = 'Mobile Chrome'
    }

    return { os, browser, type: 'MOBILE' as const }
  }

  const detectDevice = async (): Promise<DevicePayload> => {
    if (cachedDevicePayload.value) return cachedDevicePayload.value

    isDetecting.value = true
    try {
      const deviceId = await getPersistentDeviceId()
      const { os, browser, type } = parsePlatformDetails()
      const gpu = getGpuRenderer()
      const cpuCores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4
      const screenRes = typeof window !== 'undefined' 
        ? `${window.screen?.width || 0}x${window.screen?.height || 0} @${window.devicePixelRatio || 1}x`
        : '360x800 @2x'

      // Detailed hardware inspection via Capacitor Device plugin
      let rawModel = ''
      let manufacturer = ''
      let osVersion = ''
      let hardwareDeviceName = ''

      try {
        const info = await Device.getInfo()
        rawModel = info.model || ''
        manufacturer = info.manufacturer || ''
        osVersion = info.osVersion || ''
        hardwareDeviceName = info.name || ''
      } catch (e) {
        // Fallback to browser UA if Capacitor plugin unavailable
      }

      // Fallback 1: userAgentData Client Hints (Chromium / Webview)
      if (!rawModel && typeof navigator !== 'undefined' && (navigator as any).userAgentData?.getHighEntropyValues) {
        try {
          const hints = await (navigator as any).userAgentData.getHighEntropyValues(['model', 'platformVersion'])
          if (hints?.model) rawModel = hints.model
          if (hints?.platformVersion && !osVersion) osVersion = hints.platformVersion
        } catch (e) {}
      }

      // Fallback 2: Regex extraction from User-Agent string
      if (!rawModel && typeof navigator !== 'undefined') {
        const ua = navigator.userAgent
        const androidMatch = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build|[;)])/i)
        if (androidMatch && androidMatch[1]) {
          rawModel = androidMatch[1].trim()
        }
      }

      // Resolve friendly marketing model name (e.g. "Nothing Phone (2a)", "Samsung Galaxy S24 Ultra")
      const resolvedMarketingName = resolveMarketingDeviceName(
        manufacturer,
        rawModel,
        os,
        osVersion,
        hardwareDeviceName
      )

      const rawString = `${deviceId}|${cpuCores}|${gpu}|${screenRes}|${os}|${rawModel}|${manufacturer}`
      let hash = 0
      for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i)
        hash |= 0
      }
      const hardwareHash = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()

      // High-clarity friendly name for the Admin Whitelist:
      // e.g. "Nothing Phone (2a) (Android 14 • SM Fleet App)"
      const friendlyName = `${resolvedMarketingName} (${os}${osVersion ? ' ' + osVersion : ''} • ${browser})`

      const payload: DevicePayload = {
        id: deviceId,
        name: friendlyName,
        type,
        browser,
        os,
        cpuCores,
        gpuRenderer: gpu,
        screenResolution: screenRes,
        hardwareHash
      }

      cachedDevicePayload.value = payload
      return payload
    } finally {
      isDetecting.value = false
    }
  }

  return {
    cachedDevicePayload,
    isDetecting,
    detectDevice,
    getPersistentDeviceId
  }
}
