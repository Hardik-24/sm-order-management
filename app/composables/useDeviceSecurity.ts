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

      // Generate composite hardware hash
      const rawHardwareString = `${cpuCores}|${gpu}|${screenRes}|${audioHash}|${navigator.platform || ''}`
      let hash = 0
      for (let i = 0; i < rawHardwareString.length; i++) {
        hash = (hash << 5) - hash + rawHardwareString.charCodeAt(i)
        hash |= 0
      }
      const hardwareHash = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()

      // Clean friendly name: e.g. "Windows PC (Chrome • NVIDIA RTX 3060)"
      const shortGpu = gpu.split('/')[0].split(',')[0].replace(/Direct3D.*/i, '').trim().slice(0, 24)
      const friendlyName = `${os} ${type === 'DESKTOP' ? 'PC' : (type === 'MOBILE' ? 'Phone' : 'Tablet')} (${browser}${shortGpu ? ' • ' + shortGpu : ''})`

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
