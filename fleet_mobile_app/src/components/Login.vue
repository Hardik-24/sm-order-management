<template>
  <div class="min-h-screen bg-[#1a5c4c] flex flex-col justify-center items-center p-6 text-white font-sans">
    <div class="w-full max-w-sm bg-white text-[#1a1a1a] rounded-2xl shadow-2xl p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-[#1a5c4c] tracking-widest">SM FLEET</h1>
        <p class="text-sm text-gray-500 mt-2">Driver Authentication</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email</label>
          <input 
            v-model="email" 
            type="email" 
            required
            class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]"
            placeholder="driver@siliconmarketing.com"
          >
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Password</label>
          <input 
            v-model="password" 
            type="password" 
            required
            class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]"
            placeholder="••••••••"
          >
        </div>

        <div v-if="errorMsg" class="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">
          {{ errorMsg }}
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full bg-[#1a5c4c] hover:bg-[#134237] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-4"
        >
          {{ loading ? 'AUTHENTICATING...' : 'SIGN IN' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['login-success'])

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

// This should point to the live Vercel API
const API_URL = 'https://sm-order-management.vercel.app' 
// For local testing on emulator, you might use http://10.0.2.2:3000

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(data.message || 'Login failed')
    }
    
    // We expect { user, token }
    if (data.token) {
      emit('login-success', { user: data.user, token: data.token })
    } else {
      throw new Error('No token received from server')
    }
  } catch (err: any) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}
</script>
