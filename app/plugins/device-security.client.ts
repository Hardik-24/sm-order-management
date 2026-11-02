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
  })
})
