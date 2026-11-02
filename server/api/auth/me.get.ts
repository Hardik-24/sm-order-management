import { getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionUser = getUserFromEvent(event)
  if (!sessionUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  // 1. Check global session invalidation cutoff
  const tokenIat = (sessionUser as any)?.iat
  if (tokenIat) {
    const globalCutoffSetting = await prisma.systemSetting.findUnique({
      where: { key: 'session_min_valid_iat' }
    })
    if (globalCutoffSetting?.value) {
      const minIat = parseInt(globalCutoffSetting.value, 10)
      const exemptSetting = await prisma.systemSetting.findUnique({
        where: { key: 'session_exempt_user_id' }
      })
      const exemptUserId = exemptSetting?.value

      // If user is not exempt and token was issued before the cutoff -> revoke session
      if (sessionUser.id !== exemptUserId && tokenIat < minIat) {
        throw createError({ statusCode: 401, statusMessage: 'Session expired. Please log in again.' })
      }
    }
  }

  // 2. Hardware device authorization check during active session
  const lockdownSetting = await prisma.systemSetting.findUnique({
    where: { key: 'hardware_device_lockdown' }
  })
  const isLockdown = !lockdownSetting || lockdownSetting.value !== 'OFF'
  if (isLockdown) {
    const deviceIdCookie = getCookie(event, 'sm_flow_hw_device_id')
    if (deviceIdCookie) {
      const dev = await prisma.trustedDevice.findUnique({
        where: { deviceId: deviceIdCookie }
      })
      if (dev && (!dev.isApproved || dev.isBlocked)) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Device not authorized. Please ask your administrator to approve this device.'
        })
      }
    }
  }

  // Fetch latest user details from DB to ensure real-time accuracy of permissions and active status
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      allowedPages: true,
      actionPermissions: true,
      isActive: true,
    },
  })

  if (!dbUser || !dbUser.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User account inactive or not found' })
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      avatar: dbUser.avatar,
      allowedPages: (dbUser.allowedPages as any) || [],
      actionPermissions: (dbUser.actionPermissions as any) || null,
    },
  }
})
