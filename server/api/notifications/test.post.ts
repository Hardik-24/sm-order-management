import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Allow test notification from authenticated users or dev
  try {
    requireAuth(event)
  } catch {
    // If not authenticated, check if in dev or explicit test key
    const query = getQuery(event)
    if (process.env.NODE_ENV === 'production' && query.secret !== process.env.NUXT_AUTH_SECRET) {
      throw createError({ statusCode: 401, message: 'Unauthorized test trigger' })
    }
  }

  const body = await readBody(event).catch(() => ({}))
  const title = body?.title || 'SM Flow Notification Test 🔔'
  const messageBody = body?.body || 'Push notifications are configured and functioning properly!'
  const topic = body?.topic || 'orders'
  const tokens = body?.token ? [body.token] : body?.tokens

  const success = await sendPushNotification({
    title,
    body: messageBody,
    topic: tokens ? undefined : topic,
    tokens: tokens || undefined,
    data: {
      type: 'SYSTEM_TEST',
      timestamp: new Date().toISOString()
    }
  })

  return {
    success,
    message: success ? 'Push notification dispatched successfully!' : 'Failed to dispatch push notification. Check server logs.'
  }
})
