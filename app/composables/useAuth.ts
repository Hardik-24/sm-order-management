// Auth composable for client-side auth state management
import type { SessionUser, UserRole } from '~/types'

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth_user', () => null)
  const isLoggedIn = computed(() => !!user.value)

  /** Login with email and password */
  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const data = await $fetch<{ user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      user.value = data.user
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.data?.message || 'Login failed' }
    }
  }

  /** Logout and clear session */
  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    user.value = null
    navigateTo('/login')
  }

  /** Fetch current session from server */
  async function fetchUser() {
    try {
      const reqHeaders = useRequestHeaders(['cookie'])
      const data = await $fetch<{ user: SessionUser }>('/api/auth/me', {
        headers: reqHeaders.cookie ? { cookie: reqHeaders.cookie } : undefined
      })
      user.value = data.user
    } catch {
      user.value = null
    }
  }

  /** Check if user has one of the allowed roles */
  function hasRole(...roles: UserRole[]): boolean {
    if (!user.value) return false
    return roles.includes(user.value.role)
  }

  return {
    user,
    isLoggedIn,
    login,
    logout,
    fetchUser,
    hasRole,
  }
}
