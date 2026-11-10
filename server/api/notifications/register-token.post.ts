import { getUserFromEvent } from '~~/server/utils/auth'
import prisma from '~~/server/utils/prisma'
import { subscribeToTopic } from '~~/server/utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''

  if (!token) {
    throw createError({ statusCode: 400, message: 'FCM token is required' })
  }

  const user = getUserFromEvent(event)

  try {
    // 1. Subscribe token to general notification topics immediately
    await Promise.allSettled([
      subscribeToTopic(token, 'orders'),
      subscribeToTopic(token, 'general')
    ])

    // 2. Update TrustedDevice if deviceId is provided
    if (deviceId) {
      const existing = await prisma.trustedDevice.findUnique({
        where: { deviceId }
      })

      if (existing) {
        await prisma.trustedDevice.update({
          where: { deviceId },
          data: {
            fcmToken: token,
            userId: user?.id || existing.userId,
            lastUsedAt: new Date()
          }
        })
        console.log(`[Notifications] Attached FCM token to existing device ${deviceId}`)
      } else if (user) {
        // Create trusted device entry if not exists
        await prisma.trustedDevice.create({
          data: {
            deviceId,
            userId: user.id,
            deviceName: 'Mobile App Device',
            deviceType: 'MOBILE',
            fcmToken: token,
            isApproved: true,
            lastUsedAt: new Date()
          }
        })
        console.log(`[Notifications] Created trusted device ${deviceId} with FCM token`)
      }
    } else if (user) {
      // If no deviceId, update user's most recent trusted device
      const recentDevice = await prisma.trustedDevice.findFirst({
        where: { userId: user.id },
        orderBy: { lastUsedAt: 'desc' }
      })
      if (recentDevice) {
        await prisma.trustedDevice.update({
          where: { id: recentDevice.id },
          data: { fcmToken: token, lastUsedAt: new Date() }
        })
        console.log(`[Notifications] Attached FCM token to user ${user.id} recent device`)
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[Notifications] Failed to register token:', err?.message || err)
    return { success: false, error: err?.message || 'Failed to register token' }
  }
})
