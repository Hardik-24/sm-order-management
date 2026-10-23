<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: [
    async () => {
      const { user, fetchUser } = useAuth()
      if (!user.value) {
        await fetchUser()
      }
      if (user.value) {
        if (user.value.role === 'DELIVERY') {
          return navigateTo('/driver', { replace: true })
        }
        return navigateTo('/dashboard', { replace: true })
      }
      return navigateTo('/login', { replace: true })
    }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-[#1c1c1c]"></div>
</template>
