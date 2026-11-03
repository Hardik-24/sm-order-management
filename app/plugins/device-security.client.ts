export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const { onOrderSync } = useRealtimeSync()
  const { logout, fetchUser, user } = useAuth()
  const { detectDevice } = useDeviceSecurity()

  // Realtime instant kick on device revocation or admin lockdown
  onOrderSync(async (event) => {
    if (!event) return

    // 1. Individual Device Revocation / Block / Deletion
    const isDeviceAction = 
      event.type === 'DEVICE_CHANGE' ||
      event.type === 'DEVICE_REVOCATION' ||
      event.type === 'DB_DEVICE_CHANGE' ||
      event.action === 'DEVICE_REVOKED' ||
      event.action === 'DEVICE_BLOCKED' ||
      event.action === 'DEVICE_DELETED'

    if (isDeviceAction) {
      try {
        const currentDev = await detectDevice()
        const targetDevId = event.deviceId || event.record?.deviceId || event.record?.device_id

        if (currentDev?.id && targetDevId && currentDev.id === targetDevId) {
          // If this is a Postgres change and the device is still approved, do not kick
          if (event.type === 'DB_DEVICE_CHANGE' && event.record?.is_approved === true && !event.record?.is_blocked) {
            return
          }
          console.warn('[DeviceSecurity] Current device authorization revoked remotely. Logging out immediately.')
          await logout()
          return
        }
      } catch (err) {
        console.error('[DeviceSecurity] Error handling device revocation event:', err)
      }
    }

    // 2. Global Invalidation (Admin "Log Out All Others")
    if (event.action === 'LOGOUT_ALL_OTHERS' || event.type === 'LOGOUT_ALL_OTHERS') {
      try {
        const currentDev = await detectDevice()
        if (event.exemptDeviceId && currentDev?.id !== event.exemptDeviceId) {
          console.warn('[DeviceSecurity] Global session invalidation enforced. Logging out immediately.')
          await logout()
          return
        }
      } catch (err) {
        console.error('[DeviceSecurity] Error handling logout all others:', err)
      }
    }

    // 3. User Account Deletion or Deactivation Kick
    const currentUserId = user.value?.id
    const currentUserEmail = user.value?.email?.toLowerCase()

    if (currentUserId) {
      const isUserAction =
        event.type === 'USER_CHANGE' ||
        event.type === 'DB_USER_CHANGE' ||
        event.action === 'USER_DELETED' ||
        event.action === 'USER_DEACTIVATED'

      if (isUserAction) {
        try {
          const targetUserId = event.userId || event.record?.id || event.oldRecord?.id
          const targetEmail = (event.email || event.record?.email || event.oldRecord?.email)?.toLowerCase()

          const matchesCurrentUser =
            (targetUserId && targetUserId === currentUserId) ||
            (targetEmail && currentUserEmail && targetEmail === currentUserEmail)

          if (matchesCurrentUser) {
            // Check if deleted or deactivated
            const isDeleted =
              event.action === 'USER_DELETED' ||
              (event.type === 'DB_USER_CHANGE' && event.eventType === 'DELETE')

            const isDeactivated =
              event.action === 'USER_DEACTIVATED' ||
              event.isActive === false ||
              (event.type === 'DB_USER_CHANGE' && (event.record?.is_active === false || event.record?.isActive === false))

            if (isDeleted || isDeactivated) {
              console.warn(`[DeviceSecurity] Current user account was ${isDeleted ? 'deleted' : 'deactivated'} remotely. Logging out immediately.`)
              await logout()
              return
            }
          }
        } catch (err) {
          console.error('[DeviceSecurity] Error handling user account revocation:', err)
        }
      }
    }
  })
})
