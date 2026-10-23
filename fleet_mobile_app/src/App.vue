<template>
  <Login v-if="!isAuthenticated" @login-success="onLoginSuccess" />
  <Dashboard v-else @logout="logout" />
  <Snackbar />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Preferences } from '@capacitor/preferences'
import { StatusBar, Style } from '@capacitor/status-bar'
import Login from './components/Login.vue'
import Dashboard from './components/Dashboard.vue'
import Snackbar from './components/Snackbar.vue'

const isAuthenticated = ref(false)

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

onMounted(async () => {
  try {
    // Keep status bar solid with dark style and brand background; do NOT overlay so webview respects status bar
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#0f2744' })
  } catch (e) {
    // Ignore on web
  }

  // Ask for location and notification permissions on every app launch if not granted
  await requestPermissionsOnStartup()

  const { value } = await Preferences.get({ key: 'auth_token' })
  if (value) {
    isAuthenticated.value = true
  }
})

async function onLoginSuccess(payload: { token: string }) {
  await Preferences.set({ key: 'auth_token', value: payload.token })
  isAuthenticated.value = true
}

async function logout() {
  await Preferences.remove({ key: 'auth_token' })
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
