// Device Security & Hardware Fingerprinting Composable
// Silicon Marketing OMS (SM Flow)

export interface DevicePayload {
  id: string
  name: string
  type: 'DESKTOP' | 'MOBILE' | 'TABLET'
  browser: string
  os: string
  cpuCores: number
  gpuRenderer: string
  screenResolution: string
  hardwareHash: string
  pairingCode?: string
}

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

  // 2. Nothing Phone & CMF Series
  if (m === 'A065' || m.startsWith('A065')) return 'Nothing Phone (2a)'
  if (m === 'A065P' || m.startsWith('A065P')) return 'Nothing Phone (2a) Plus'
  if (m === 'A063') return 'Nothing Phone (2)'
  if (m === 'A059') return 'Nothing Phone (1)'
  if (m.startsWith('A015') || m.includes('CMF')) return 'CMF Phone 1 by Nothing'

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
  const currentDevice = useState<DevicePayload | null>('current_device_payload', () => null)
  const isDetecting = ref(false)

  // 1. Get or create persistent Device ID across localStorage, IndexedDB, and Cookie
  const getPersistentDeviceId = async (): Promise<string> => {
    if (import.meta.server) return 'DEV-SERVER'

    const STORAGE_KEY = 'sm_flow_hw_device_id'
    let deviceId = localStorage.getItem(STORAGE_KEY)

    // Check cookie fallback
    if (!deviceId) {
      const match = document.cookie.match(new RegExp('(^| )' + STORAGE_KEY + '=([^;]+)'))
      if (match) deviceId = decodeURIComponent(match[2])
    }

    if (!deviceId) {
      // Generate cryptographically random unique hardware-bound ID
      const randomBytes = new Uint8Array(12)
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(randomBytes)
      } else {
        for (let i = 0; i < 12; i++) randomBytes[i] = Math.floor(Math.random() * 256)
      }
      const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
      deviceId = `DEV-${hex.slice(0, 6)}-${hex.slice(6, 12)}-${hex.slice(12, 18)}`

      // Store in localStorage
      try {
        localStorage.setItem(STORAGE_KEY, deviceId)
      } catch (e) {
        console.warn('localStorage not accessible for device ID', e)
      }

      // Store in cookie (1 year persistence)
      try {
        const expires = new Date()
        expires.setFullYear(expires.getFullYear() + 2)
        document.cookie = `${STORAGE_KEY}=${encodeURIComponent(deviceId)};path=/;expires=${expires.toUTCString()};SameSite=Lax`
      } catch (e) {}
    }

    return deviceId
  }

  // 2. Query GPU unmasked renderer via WebGL
  const getGpuRenderer = (): string => {
    if (import.meta.server) return 'Server GPU'
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) return 'Standard Display Adapter'
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (!ext) return 'Generic WebGL Accelerator'
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'Integrated Graphics'
      return String(renderer).replace(/ANGLE\s*\((.*)\)/i, '$1').trim()
    } catch {
      return 'Standard Display Adapter'
    }
  }

  // 3. AudioContext hardware oscillator clock fingerprint
  const getAudioHash = async (): Promise<string> => {
    if (import.meta.server) return 'SERVER-AUDIO'
    try {
      const AudioCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
      if (!AudioCtx) return 'NO-AUDIO-CTX'
      const ctx = new AudioCtx(1, 44100, 44100)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(10000, ctx.currentTime)

      const comp = ctx.createDynamicsCompressor()
      comp.threshold.setValueAtTime(-50, ctx.currentTime)
      comp.knee.setValueAtTime(40, ctx.currentTime)
      comp.ratio.setValueAtTime(12, ctx.currentTime)
      comp.attack.setValueAtTime(0, ctx.currentTime)
      comp.release.setValueAtTime(0.25, ctx.currentTime)

      osc.connect(comp)
      comp.connect(ctx.destination)
      osc.start(0)

      const renderedBuffer = await ctx.startRendering()
      const samples = renderedBuffer.getChannelData(0)
      let sum = 0
      for (let i = 4500; i < 5000; i++) {
        sum += Math.abs(samples[i] || 0)
      }
      return sum.toFixed(6)
    } catch {
      return 'AUDIO-FALLBACK'
    }
  }

  // 4. Parse OS and Browser
  const parsePlatformDetails = () => {
    if (import.meta.server) return { os: 'Server', browser: 'Server', type: 'DESKTOP' as const }
    const ua = navigator.userAgent

    let os = 'Unknown OS'
    if (/Windows/i.test(ua)) os = 'Windows'
    else if (/Android/i.test(ua)) os = 'Android'
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS'
    else if (/Linux/i.test(ua)) os = 'Linux'

    let browser = 'Unknown Browser'
    if (/Edg/i.test(ua)) browser = 'Edge'
    else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome'
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
    else if (/Firefox/i.test(ua)) browser = 'Firefox'

    let type: 'DESKTOP' | 'MOBILE' | 'TABLET' = 'DESKTOP'
    const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const isTablet = /iPad|Tablet/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua))

    if (isTablet) type = 'TABLET'
    else if (isMobile) type = 'MOBILE'

    return { os, browser, type }
  }

  // 5. Gather full hardware fingerprint payload
  const detectDevice = async (): Promise<DevicePayload> => {
    if (currentDevice.value) return currentDevice.value

    isDetecting.value = true
    try {
      const deviceId = await getPersistentDeviceId()
      const { os, browser, type } = parsePlatformDetails()
      const gpu = getGpuRenderer()
      const audioHash = await getAudioHash()
      const cpuCores = navigator.hardwareConcurrency || 4
      const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0} @${window.devicePixelRatio || 1}x`

      // 6. Inspect exact hardware model (e.g. "SM-S928B" -> "Samsung Galaxy S24 Ultra")
      let rawModel = ''
      let manufacturer = ''
      let osVersion = ''

      if (typeof navigator !== 'undefined' && (navigator as any).userAgentData?.getHighEntropyValues) {
        try {
          const hints = await (navigator as any).userAgentData.getHighEntropyValues(['model', 'platformVersion'])
          if (hints?.model) rawModel = hints.model
          if (hints?.platformVersion) osVersion = hints.platformVersion
        } catch (e) {}
      }

      if (!rawModel && typeof navigator !== 'undefined') {
        const ua = navigator.userAgent
        const androidMatch = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build|[;)])/i)
        if (androidMatch && androidMatch[1]) {
          rawModel = androidMatch[1].trim()
        } else if (/iPhone/i.test(ua)) {
          rawModel = 'iPhone'
        } else if (/iPad/i.test(ua)) {
          rawModel = 'iPad'
        }
      }

      // Generate composite hardware hash
      const rawHardwareString = `${cpuCores}|${gpu}|${screenRes}|${audioHash}|${navigator.platform || ''}|${rawModel}`
      let hash = 0
      for (let i = 0; i < rawHardwareString.length; i++) {
        hash = (hash << 5) - hash + rawHardwareString.charCodeAt(i)
        hash |= 0
      }
      const hardwareHash = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()

      // Format friendly name
      let friendlyName = ''
      if (type === 'MOBILE' || type === 'TABLET') {
        const resolvedMarketingName = resolveMarketingDeviceName(manufacturer, rawModel, os, osVersion)
        friendlyName = `${resolvedMarketingName} (${os}${osVersion ? ' ' + osVersion : ''} • ${browser})`
      } else {
        const shortGpu = gpu.split('/')[0].split(',')[0].replace(/Direct3D.*/i, '').trim().slice(0, 24)
        friendlyName = `${os} PC (${browser}${shortGpu ? ' • ' + shortGpu : ''})`
      }

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

      currentDevice.value = payload
      return payload
    } finally {
      isDetecting.value = false
    }
  }

  return {
    currentDevice,
    isDetecting,
    detectDevice,
    getPersistentDeviceId
  }
}
