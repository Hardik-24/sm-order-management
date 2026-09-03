<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { User, Lock, Eye, EyeOff, ArrowRight, Shield, Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: false
})

const router = useRouter()
const route = useRoute()
const { user, login } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(false)
const errorMsg = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  errorMsg.value = ''
  isLoading.value = true
  
  const result = await login(email.value, password.value)
  
  if (result.success) {
    const redirect = route.query.redirect as string
    if (redirect && redirect.startsWith('/')) {
      router.push(redirect)
    } else if (user.value?.role === 'DELIVERY') {
      router.push('/driver')
    } else {
      router.push('/dashboard')
    }
  } else {
    errorMsg.value = result.error || 'Invalid credentials'
  }
  
  isLoading.value = false
}
</script>

<template>
  <div class="h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row bg-[#faf8f5]">
    <!-- LEFT HALF -->
    <div class="hidden md:flex relative w-1/2 h-full items-center justify-center">
      <img src="/images/bg-login.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0" />
      <div class="absolute inset-0 bg-black/60 z-10"></div>
      
      <div class="relative z-20 flex flex-col items-center text-center px-8">
        <img src="/images/logo-icon.png" alt="SMI Logo" class="w-[200px] mb-8" />
        <h1 class="text-[#e8e0d4] text-lg uppercase tracking-[0.15em] font-medium">
          Order Management System
        </h1>
      </div>
    </div>

    <!-- RIGHT HALF -->
    <div class="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 h-full overflow-hidden">
      <div class="w-full max-w-[360px]">
        <!-- Mobile Logo (hidden on desktop) -->
        <div class="flex md:hidden justify-center mb-10">
          <img src="/images/logo-original.png" alt="Silicon Marketing" class="w-[180px]" />
        </div>
        
        <h2 class="text-2xl font-light text-[#1a1a1a] mb-1.5">Welcome back</h2>
        <p class="text-sm text-gray-500 mb-10">Sign in to access the Silicon Marketing workspace.</p>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div v-if="errorMsg" class="p-3 bg-red-100 text-red-600 rounded-lg text-sm">
            {{ errorMsg }}
          </div>

          <!-- Email -->
          <div class="space-y-1.5">
            <label class="block uppercase tracking-[0.1em] text-[10px] font-semibold text-gray-500">
              Work Email / Username
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User class="h-4 w-4 text-gray-400" />
              </div>
              <input 
                v-model="email"
                type="text" 
                placeholder="Enter your email or username"
                class="block w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#4ecdc4] focus:border-transparent transition-shadow"
                required
              />
            </div>
          </div>

          <!-- Password -->
          <div class="space-y-1.5">
            <label class="block uppercase tracking-[0.1em] text-[10px] font-semibold text-gray-500">
              Password
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock class="h-4 w-4 text-gray-400" />
              </div>
              <input 
                v-model="password"
                :type="showPassword ? 'text' : 'password'" 
                placeholder="••••••••"
                class="block w-full pl-9 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#4ecdc4] focus:border-transparent transition-shadow"
                required
              />
              <button 
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <EyeOff v-if="showPassword" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Options -->
          <div class="flex items-center justify-between text-xs mt-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="rememberMe" type="checkbox" class="rounded border-gray-300 text-[#1a5c4c] focus:ring-[#4ecdc4]" />
              <span class="text-gray-600">Remember me</span>
            </label>
            <a href="#" class="text-[#1a5c4c] hover:underline font-medium">Forgot password?</a>
          </div>

          <!-- Submit -->
          <button 
            type="submit"
            :disabled="isLoading"
            class="w-full flex items-center justify-center gap-2 bg-[#1a5c4c] text-white uppercase tracking-[0.1em] text-xs py-3 rounded-lg hover:bg-[#1a5c4c]/90 transition-colors disabled:opacity-70 font-medium mt-6"
          >
            <template v-if="isLoading">
              <Loader2 class="w-4 h-4 animate-spin" />
              Signing in...
            </template>
            <template v-else>
              Sign In
              <ArrowRight class="w-4 h-4" />
            </template>
          </button>
        </form>

        <!-- Footer -->
        <div class="mt-6">
          <div class="relative flex items-center py-3">
            <div class="flex-grow border-t border-gray-200"></div>
            <span class="flex-shrink-0 mx-4 text-gray-300">
              <Shield class="w-4 h-4" />
            </span>
            <div class="flex-grow border-t border-gray-200"></div>
          </div>
          
          <p class="text-[11px] text-gray-400 text-center mt-1">
            Authorized Silicon Marketing personnel only.
          </p>
          <p class="text-[11px] text-gray-400 text-center mt-0.5">
            Need help signing in? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
