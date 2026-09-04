<template>
  <Login v-if="!isAuthenticated" @login-success="onLoginSuccess" />
  <Dashboard v-else @logout="logout" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Preferences } from '@capacitor/preferences'
import Login from './components/Login.vue'
import Dashboard from './components/Dashboard.vue'

const isAuthenticated = ref(false)

onMounted(async () => {
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
