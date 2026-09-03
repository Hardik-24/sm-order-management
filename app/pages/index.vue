<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'

definePageMeta({
  layout: false
})
</script>

<template>
  <div class="h-[100dvh] w-full overflow-hidden relative flex items-center justify-center">
    <!-- Background Image with Overlay -->
    <div class="absolute inset-0 z-0">
      <img src="/images/bg-login.jpg" alt="Background" class="w-full h-full object-cover" />
      <div class="absolute inset-0 bg-black/60"></div>
    </div>

    <!-- Content -->
    <div class="relative z-10 flex flex-col items-center text-center px-4">
      <img src="/images/logo-icon.png" alt="SMI Logo" class="w-[280px] mb-8" />
      
      <h1 class="text-[#e8e0d4] text-xl md:text-2xl uppercase tracking-[0.15em] mb-4 font-medium">
        Order Management System
      </h1>
      
      <p class="text-[#e8e0d4]/80 text-sm md:text-base mb-12 max-w-md">
        One workspace. Every order. Complete visibility.
      </p>

      <NuxtLink 
        to="/dashboard"
        class="group flex items-center gap-3 px-8 py-4 border border-[#4ecdc4] bg-transparent text-[#e8e0d4] uppercase tracking-widest text-sm font-medium transition-colors duration-300 hover:bg-[#1a5c4c] hover:border-[#1a5c4c]"
      >
        Enter Dashboard
        <ArrowRight class="w-5 h-5 transition-transform group-hover:translate-x-1" />
      </NuxtLink>
    </div>
  </div>
</template>
