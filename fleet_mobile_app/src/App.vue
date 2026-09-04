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

onMounted(async () => {
  try {
    // Make status bar transparent and text light, app draws underneath it
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch (e) {
    // Ignore on web
  }

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
  padding-top: env(safe-area-inset-top, 40px) !important;
}
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 20px) !important;
}
</style>
