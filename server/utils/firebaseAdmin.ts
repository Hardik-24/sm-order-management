import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import fs from 'node:fs'
import path from 'node:path'
import prisma from './prisma'

let firebaseApp: App | null = null

function getServiceAccount(): ServiceAccount | null {
  // 1. Check environment variable (Vercel production / local .env)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim()
      if (raw.startsWith('{')) {
        return JSON.parse(raw)
      }
      // Try base64 decoding
      const decoded = Buffer.from(raw, 'base64').toString('utf8')
      return JSON.parse(decoded)
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e)
    }
  }

  // 2. Check local file paths
  const candidatePaths = [
    path.resolve(process.cwd(), 'oms_mobile_app/android/app/sm-flow-firebase-adminsdk-fbsvc-27fed2302c.json'),
    path.resolve(process.cwd(), 'firebase-service-account.json'),
    path.resolve(process.cwd(), 'service-account.json')
  ]

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw)
      } catch (e) {
        console.error(`[FirebaseAdmin] Failed to read service account from ${p}:`, e)
      }
    }
  }

  return null
}

export function initFirebaseAdmin(): App | null {
  if (firebaseApp) return firebaseApp

  const sa = getServiceAccount()
  if (!sa) {
    console.warn('[FirebaseAdmin] Service account credentials not found. Push notifications will be skipped.')
    return null
  }

  try {
    const existingApps = getApps()
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0]!
    } else {
      firebaseApp = initializeApp({
        credential: cert(sa)
      })
    }
    return firebaseApp
  } catch (err) {
    console.error('[FirebaseAdmin] Failed to initialize Firebase Admin app:', err)
    return null
  }
}

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  topic?: string
  tokens?: string[]
}

/**
 * Sends push notifications to mobile devices via Firebase Cloud Messaging (FCM).
 * Employs Dual Delivery:
 * 1. Broadcasts to Topic (e.g. 'orders', 'quotations')
 * 2. Directly multicasts to active registered device tokens for guaranteed sub-second delivery
 * Non-blocking: Errors are logged but will never throw or interrupt business flow.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const app = initFirebaseAdmin()
  if (!app) return false

  let anySuccess = false

  try {
    const messaging = getMessaging(app)

    // A. Broadcast to topic
    if (payload.topic) {
      try {
        const response = await messaging.send({
          topic: payload.topic,
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: payload.data || {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'sm_flow_notifications',
              sound: 'default',
              priority: 'high',
              defaultVibrateTimings: true
            }
          }
        })
        console.log(`[FCM] Notification sent to topic "${payload.topic}":`, response)
        anySuccess = true
      } catch (topicErr: any) {
        console.warn(`[FCM] Topic "${payload.topic}" send warning:`, topicErr?.message || topicErr)
      }
    }

    // B. Collect explicit or registered device tokens from DB
    let targetTokens = (payload.tokens || []).filter(t => Boolean(t && t.trim()))

    if (targetTokens.length === 0) {
      try {
        const activeDevices = await prisma.trustedDevice.findMany({
          where: {
            fcmToken: { not: null },
            isApproved: true,
            isBlocked: false
          },
          select: { fcmToken: true }
        })
        targetTokens = activeDevices.map(d => d.fcmToken!).filter(Boolean)
      } catch (dbErr) {
        console.warn('[FCM] Failed to query trusted device tokens:', dbErr)
      }
    }

    // C. Multicast direct send to all device tokens for instant arrival
    if (targetTokens.length > 0) {
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: targetTokens,
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: payload.data || {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'sm_flow_notifications',
              sound: 'default',
              priority: 'high',
              defaultVibrateTimings: true
            }
          }
        })
        console.log(`[FCM] Direct multicast: ${response.successCount} delivered, ${response.failureCount} failed out of ${targetTokens.length}`)
        if (response.successCount > 0) anySuccess = true
      } catch (multiErr: any) {
        console.warn('[FCM] Direct multicast error:', multiErr?.message || multiErr)
      }
    }

    return anySuccess
  } catch (err: any) {
    console.error('[FCM] Error sending push notification:', err?.message || err)
    return false
  }
}

/**
 * Subscribes a device token to a topic (e.g. 'orders', 'quotations')
 */
export async function subscribeToTopic(tokens: string | string[], topic: string): Promise<boolean> {
  const app = initFirebaseAdmin()
  if (!app) return false

  try {
    const tokenList = Array.isArray(tokens) ? tokens : [tokens]
    const valid = tokenList.filter(t => Boolean(t && t.trim()))
    if (valid.length === 0) return false

    const response = await getMessaging(app).subscribeToTopic(valid, topic)
    console.log(`[FCM] Subscribed ${response.successCount} tokens to topic "${topic}"`)
    return true
  } catch (err) {
    console.error(`[FCM] Failed subscribing to topic ${topic}:`, err)
    return false
  }
}
