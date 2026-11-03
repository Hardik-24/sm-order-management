import { ref } from 'vue'
import { Preferences } from '@capacitor/preferences'

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

      const rawString = `${deviceId}|${cpuCores}|${gpu}|${screenRes}|${os}`
      let hash = 0
      for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i)
        hash |= 0
      }
      const hardwareHash = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()
      const friendlyName = `SM Fleet ${os} Mobile (${browser})`

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
