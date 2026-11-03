import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Allow test notification from authenticated users or dev
  try {
    requireAuth(event)
  } catch {
    const query = getQuery(event)
    if (process.env.NODE_ENV === 'production' && query.secret !== process.env.NUXT_AUTH_SECRET) {
      throw createError({ statusCode: 401, message: 'Unauthorized test trigger' })
    }
  }

  const body = await readBody(event).catch(() => ({}))
  const title = body?.title?.trim() || '🔔 SM Flow Notification Test'
  const messageBody = body?.body?.trim() || 'Push notifications are working properly on your mobile device!'
  const target = body?.target || 'all' // 'all' | 'quotations' | 'orders' | deviceId

  // Fetch active registered devices
  const activeDevices = await prisma.trustedDevice.findMany({
    where: {
      fcmToken: { not: null },
      isApproved: true,
      isBlocked: false
    },
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  })

  let targetTokens: string[] | undefined = undefined
  let targetTopic: string | undefined = undefined

  if (target === 'quotations' || target === 'orders') {
    targetTopic = target
  } else if (target !== 'all') {
    // Specific device ID
    const singleDevice = activeDevices.find(d => d.id === target)
    if (singleDevice?.fcmToken) {
      targetTokens = [singleDevice.fcmToken]
    }
  } else {
    // 'all' -> Direct multicast to all active devices + topic broadcast
    targetTokens = activeDevices.map(d => d.fcmToken!).filter(Boolean)
    targetTopic = 'orders'
  }

  const success = await sendPushNotification({
    title,
    body: messageBody,
    topic: targetTopic,
    tokens: targetTokens,
    data: {
      type: 'SYSTEM_TEST',
      timestamp: new Date().toISOString()
    }
  })

  const targetDeviceNames = (targetTokens && targetTokens.length > 0)
    ? activeDevices
        .filter(d => targetTokens!.includes(d.fcmToken!))
        .map(d => `${d.deviceModel || 'Mobile Device'} (${d.user?.name || 'User'})`)
    : activeDevices.map(d => `${d.deviceModel || 'Mobile Device'} (${d.user?.name || 'User'})`)

  return {
    success,
    deviceCount: activeDevices.length,
    targetCount: targetTokens ? targetTokens.length : activeDevices.length,
    devices: targetDeviceNames,
    message: success
      ? `Push notification sent to ${targetTokens?.length ?? activeDevices.length} active device(s)!`
      : 'Failed to dispatch push notification. Check server logs.'
  }
})
