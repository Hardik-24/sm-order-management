import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import fs from 'node:fs'
import path from 'node:path'
import prisma from './prisma'
import { appendDebugLog } from '../api/notifications/debug-log'

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
  broadcastToTopic?: boolean
  tokens?: string[]
  userId?: string
  userIds?: string[]
  includeAdmins?: boolean // Default TRUE: all notifications route to admins
}

/**
 * Sends push notifications to mobile devices via Firebase Cloud Messaging (FCM).
 * Rule:
 * 1. Admins (role: 'ADMIN') receive ALL notifications unless includeAdmins is explicitly false.
 * 2. Specific non-admin users only receive notifications if they are linked to the event (via userId or userIds).
 * 3. Topic broadcasting to 'orders' is restricted so non-admins are never spammed with unrelated alerts.
 * Non-blocking: Errors are logged but will never throw or interrupt business flow.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const app = initFirebaseAdmin()
  if (!app) {
    appendDebugLog({ level: 'error', message: 'Push notification failed: Firebase Admin not initialized' })
    return false
  }

  let anySuccess = false
  appendDebugLog({
    level: 'info',
    message: `Triggering push: "${payload.title}" (${payload.body})`,
    data: { 
      topic: payload.topic, 
      userId: payload.userId, 
      userIds: payload.userIds?.join(',') || '', 
      tokenCount: String(payload.tokens?.length || 0) 
    }
  })

  try {
    const messaging = getMessaging(app)

    // A. Optional topic broadcast (ONLY if explicitly enabled via broadcastToTopic === true, e.g. Admin tests)
    if (payload.topic && payload.broadcastToTopic === true) {
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
              channelId: 'sm_flow_alerts_v2',
              priority: 'high',
              defaultSound: true,
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

    // B. Collect explicit or targeted device tokens from DB
    const allTokens = new Set<string>()

    if (payload.tokens !== undefined) {
      // Caller explicitly provided a tokens array: strictly respect it (e.g. manual admin test tool)
      for (const t of payload.tokens) {
        if (t && typeof t === 'string' && t.trim()) allTokens.add(t.trim())
      }
    } else {
      // 1. Admins: Send all notifications to admin by default
      const shouldIncludeAdmins = payload.includeAdmins !== false
      if (shouldIncludeAdmins) {
        try {
          const adminDevices = await prisma.trustedDevice.findMany({
            where: {
              fcmToken: { not: null },
              isApproved: true,
              isBlocked: false,
              user: {
                role: 'ADMIN',
                isActive: true
              }
            },
            select: { fcmToken: true }
          })
          for (const d of adminDevices) {
            if (d.fcmToken && d.fcmToken.trim()) allTokens.add(d.fcmToken.trim())
          }
        } catch (dbErr) {
          console.warn('[FCM] Failed to query admin device tokens:', dbErr)
        }
      }

      // 2. Specific Linked Users (non-admins or staff associated with this specific event/entity)
      const linkedUserIds = new Set<string>()
      if (payload.userId && typeof payload.userId === 'string' && payload.userId.trim()) {
        linkedUserIds.add(payload.userId.trim())
      }
      if (Array.isArray(payload.userIds)) {
        for (const uid of payload.userIds) {
          if (uid && typeof uid === 'string' && uid.trim()) linkedUserIds.add(uid.trim())
        }
      }

      if (linkedUserIds.size > 0) {
        try {
          const userDevices = await prisma.trustedDevice.findMany({
            where: {
              userId: { in: Array.from(linkedUserIds) },
              fcmToken: { not: null },
              isApproved: true,
              isBlocked: false,
              user: {
                isActive: true
              }
            },
            select: { fcmToken: true }
          })
          for (const d of userDevices) {
            if (d.fcmToken && d.fcmToken.trim()) allTokens.add(d.fcmToken.trim())
          }
        } catch (dbErr) {
          console.warn('[FCM] Failed to query linked user device tokens:', dbErr)
        }
      }
    }

    const targetTokens = Array.from(allTokens)

    // C. Multicast direct send to all target device tokens (Admins + Linked users)
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
              channelId: 'sm_flow_alerts_v2',
              priority: 'high',
              defaultSound: true,
              defaultVibrateTimings: true
            }
          }
        })
        console.log(`[FCM] Targeted multicast: ${response.successCount} delivered, ${response.failureCount} failed out of ${targetTokens.length}`)
        appendDebugLog({
          level: response.successCount > 0 ? 'success' : 'warn',
          message: `Push delivered: ${response.successCount} ok, ${response.failureCount} failed (${payload.title})`
        })
        if (response.successCount > 0) anySuccess = true
      } catch (multiErr: any) {
        console.warn('[FCM] Targeted multicast error:', multiErr?.message || multiErr)
      }
    } else {
      console.log(`[FCM] No registered target device tokens found for "${payload.title}"`)
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
