// Auth middleware - protects /dashboard and /driver routes
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()

  // If we don't have user data yet, try to fetch from server
  if (!user.value) {
    await fetchUser()
  }

  // If already logged in and visiting login, redirect to appropriate portal
  if (to.path === '/login' && user.value) {
    if (user.value.role === 'DELIVERY') {
      return navigateTo('/driver')
    }
    return navigateTo('/dashboard')
  }

  // Only protect dashboard and driver routes
  if (!to.path.startsWith('/dashboard') && !to.path.startsWith('/driver')) return

  // If still no user, redirect to login
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // Delivery drivers trying to access office dashboard are routed directly to mobile driver portal
  if (to.path.startsWith('/dashboard') && user.value.role === 'DELIVERY') {
    return navigateTo('/driver')
  }
})
