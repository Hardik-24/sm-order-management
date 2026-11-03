<template>
  <Login 
    v-if="!isAuthenticated" 
    :reason-msg="sessionNoticeMsg" 
    @login-success="onLoginSuccess" 
  />
  <Dashboard 
    v-else 
    :current-user="currentUser" 
    @logout="handleManualLogout" 
  />
  <Snackbar />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Preferences } from '@capacitor/preferences'
import { StatusBar, Style } from '@capacitor/status-bar'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import Login from './components/Login.vue'
import Dashboard from './components/Dashboard.vue'
import Snackbar from './components/Snackbar.vue'
import { useDeviceSecurity } from './composables/useDeviceSecurity'

const SUPABASE_URL = 'https://xfzvkqjkbwwdqtxgasrh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmenZrcWprYnd3ZHF0eGdhc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Njg1MzYsImV4cCI6MjEwNDE0NDUzNn0.0D6O8IL-2Dg53GIuMoti0yA2seDfj4XVpPj1aarfb4s'

const isAuthenticated = ref(false)
const currentUser = ref<any>(null)
const sessionNoticeMsg = ref('')

let supabase: any = null
let securityChannel: RealtimeChannel | null = null

const { detectDevice, getPersistentDeviceId } = useDeviceSecurity()

async function requestPermissionsOnStartup() {
  const cap = (window as any).Capacitor
  if (cap && cap.isNativePlatform()) {
    try {
      const navPlugin = cap.Plugins?.NavigationPlugin
      if (navPlugin?.requestPermissions) {
        await navPlugin.requestPermissions()
      }
    } catch (e) {}

    try {
      const Geo = cap.Plugins?.Geolocation
      if (Geo?.requestPermissions) {
        await Geo.requestPermissions()
      }
    } catch (e) {}
  } else {
    // Browser / PWA: ask for location and notification
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 6000, enableHighAccuracy: true })
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch (e) {}
    }
  }
}

async function forceLogout(reason: string) {
  console.warn('[AppSecurity] Force logging out device:', reason)
  sessionNoticeMsg.value = reason
  try {
    await Preferences.remove({ key: 'auth_token' })
    await Preferences.remove({ key: 'auth_user' })
  } catch {}
  currentUser.value = null
  isAuthenticated.value = false
}

async function setupRealtimeSecurity() {
  if (securityChannel) return

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: { eventsPerSecond: 20 }
      }
    })

    const myDeviceId = await getPersistentDeviceId()

    securityChannel = supabase.channel('sm_orders_realtime', {
      config: { broadcast: { ack: false, self: false } }
    })

    // 1. Broadcast: Device Revocation / Lockdown / Admin Logout All
    securityChannel.on('broadcast', { event: 'DEVICE_CHANGE' }, async (msg: any) => {
      const payload = msg?.payload || msg
      const targetDevId = payload.deviceId || payload.record?.deviceId || payload.record?.device_id

      if (targetDevId && targetDevId === myDeviceId) {
        const action = payload.action || payload.type
        if (action === 'DEVICE_REVOKED' || action === 'DEVICE_BLOCKED' || action === 'DEVICE_DELETED') {
          await forceLogout('Your device access was revoked remotely by an administrator.')
          return
        }
      }

      if (payload.action === 'LOGOUT_ALL_OTHERS' || payload.type === 'LOGOUT_ALL_OTHERS') {
        if (payload.exemptDeviceId && payload.exemptDeviceId !== myDeviceId) {
          await forceLogout('An administrator has logged out all devices across the company.')
          return
        }
      }
    })

    // 2. Broadcast: User Account Deletion / Deactivation
    securityChannel.on('broadcast', { event: 'USER_CHANGE' }, async (msg: any) => {
      const payload = msg?.payload || msg
      const myId = currentUser.value?.id
      const myEmail = currentUser.value?.email?.toLowerCase()

      const targetUserId = payload.userId
      const targetEmail = payload.email?.toLowerCase()

      const isMe = (targetUserId && targetUserId === myId) || (targetEmail && myEmail && targetEmail === myEmail)
      if (isMe) {
        const action = payload.action || payload.type
        if (action === 'USER_DELETED') {
          await forceLogout('Your user account has been deleted by an administrator.')
          return
        }
        if (action === 'USER_DEACTIVATED' || payload.isActive === false) {
          await forceLogout('Your user account has been deactivated by an administrator.')
          return
        }
      }
    })

    // 3. Postgres Changes on trusted_devices
    securityChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_devices' }, async (payload: any) => {
      const rec = payload.new || payload.old
      const devId = rec?.device_id || rec?.deviceId

      if (devId && devId === myDeviceId) {
        if (payload.eventType === 'DELETE') {
          await forceLogout('Your device registration was removed by an administrator.')
          return
        }
        if (payload.new && (payload.new.is_approved === false || payload.new.is_blocked === true)) {
          await forceLogout('Your device authorization was revoked by an administrator.')
          return
        }
      }
    })

    // 4. Postgres Changes on users
    securityChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async (payload: any) => {
      const myId = currentUser.value?.id
      const myEmail = currentUser.value?.email?.toLowerCase()
      const rec = payload.new || payload.old

      const isMe = (rec?.id && rec.id === myId) || (rec?.email && myEmail && rec.email.toLowerCase() === myEmail)
      if (isMe) {
        if (payload.eventType === 'DELETE') {
          await forceLogout('Your user account was deleted by an administrator.')
          return
        }
        if (payload.new && (payload.new.is_active === false || payload.new.isActive === false)) {
          await forceLogout('Your user account was deactivated by an administrator.')
          return
        }
      }
    })

    securityChannel.subscribe()
  } catch (err) {
    console.warn('[AppSecurity] Failed setting up realtime security channel:', err)
  }
}

onMounted(async () => {
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#0f2744' })
  } catch (e) {}

  await requestPermissionsOnStartup()
  await detectDevice().catch(() => null)

  const { value: token } = await Preferences.get({ key: 'auth_token' })
  const { value: userStr } = await Preferences.get({ key: 'auth_user' })
  
  if (token) {
    isAuthenticated.value = true
    if (userStr) {
      try {
        currentUser.value = JSON.parse(userStr)
      } catch {}
    }
  }

  // Setup security watcher on launch
  await setupRealtimeSecurity()
})

onBeforeUnmount(() => {
  if (securityChannel && supabase) {
    supabase.removeChannel(securityChannel)
  }
})

async function onLoginSuccess(payload: { user: any; token: string }) {
  sessionNoticeMsg.value = ''
  await Preferences.set({ key: 'auth_token', value: payload.token })
  if (payload.user) {
    await Preferences.set({ key: 'auth_user', value: JSON.stringify(payload.user) })
    currentUser.value = payload.user
  }
  isAuthenticated.value = true
}

async function handleManualLogout() {
  sessionNoticeMsg.value = ''
  await Preferences.remove({ key: 'auth_token' })
  await Preferences.remove({ key: 'auth_user' })
  currentUser.value = null
  isAuthenticated.value = false
}
</script>

<style>
/* Global Safe Area Padding classes */
.safe-area-pt {
  padding-top: env(safe-area-inset-top, 0px) !important;
}
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0px) !important;
}
</style>
