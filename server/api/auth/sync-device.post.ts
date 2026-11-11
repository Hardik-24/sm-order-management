import { getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getClientIp } from '~~/server/utils/rateLimit'
import { subscribeToTopic } from '~~/server/utils/firebaseAdmin'
import { appendDebugLog } from '~~/server/api/notifications/debug-log'

export default defineEventHandler(async (event) => {
  const sessionUser = getUserFromEvent(event)
  if (!sessionUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody(event)
  const device = body?.device
  const fcmToken = typeof body?.fcmToken === 'string' ? body.fcmToken.trim() : (typeof device?.fcmToken === 'string' ? device.fcmToken.trim() : null)

  if (!device?.id) {
    throw createError({ statusCode: 400, statusMessage: 'No device ID provided' })
  }

  const ipAddress = getClientIp(event)
  const deviceId = String(device.id).trim()

  if (fcmToken) {
    appendDebugLog({
      deviceId,
      deviceName: device.name,
      level: 'info',
      message: `Received FCM token in sync-device: ${fcmToken.slice(0, 15)}...`,
      data: { userId: sessionUser.id }
    })
    if (sessionUser.role === 'ADMIN') {
      Promise.allSettled([
        subscribeToTopic(fcmToken, 'orders'),
        subscribeToTopic(fcmToken, 'general')
      ]).catch(() => {})
    }
  }

  // 1. If user is ADMIN:
  if (sessionUser.role === 'ADMIN') {
    const adminApprovedCount = await prisma.trustedDevice.count({
      where: {
        userId: sessionUser.id,
        isApproved: true,
        isBlocked: false
      }
    })

    const existing = await prisma.trustedDevice.findUnique({
      where: { deviceId }
    })

    // Auto-approve only if Admin has 0 approved devices (first-time bootstrap)
    // or if this device was already approved!
    if (adminApprovedCount === 0 || (existing && existing.isApproved && !existing.isBlocked)) {
      const adminDevice = await prisma.trustedDevice.upsert({
        where: { deviceId },
        create: {
          deviceId,
          userId: sessionUser.id,
          deviceName: device.name || 'Primary Admin Device',
          deviceType: device.type || 'DESKTOP',
          browser: device.browser,
          os: device.os,
          cpuCores: device.cpuCores,
          gpuRenderer: device.gpuRenderer,
          screenResolution: device.screenResolution,
          hardwareHash: device.hardwareHash,
          ipAddress,
          fcmToken: fcmToken || null,
          isApproved: true,
          approvedAt: new Date(),
          approvedByName: 'Primary Admin Auto-Enrolled'
        },
        update: {
          lastUsedAt: new Date(),
          ipAddress,
          browser: device.browser,
          os: device.os,
          ...(fcmToken ? { fcmToken } : {})
        }
      })

      return {
        success: true,
        isApproved: true,
        device: adminDevice
      }
    }

    // Otherwise, secondary device for Admin remains pending/unapproved
    if (existing) {
      await prisma.trustedDevice.update({
        where: { id: existing.id },
        data: { 
          lastUsedAt: new Date(), 
          ipAddress,
          deviceName: device.name && !device.name.startsWith('Unregistered') ? device.name : existing.deviceName,
          browser: device.browser || existing.browser,
          os: device.os || existing.os,
          ...(fcmToken ? { fcmToken } : {})
        }
      })
    } else {
      await prisma.trustedDevice.create({
        data: {
          deviceId,
          userId: sessionUser.id,
          deviceName: device.name || 'Admin Secondary Device',
          deviceType: device.type || 'DESKTOP',
          browser: device.browser,
          os: device.os,
          cpuCores: device.cpuCores,
          gpuRenderer: device.gpuRenderer,
          screenResolution: device.screenResolution,
          hardwareHash: device.hardwareHash,
          ipAddress,
          isApproved: false
        }
      })
    }

    deleteCookie(event, 'auth_token', { path: '/' })
    throw createError({
      statusCode: 403,
      statusMessage: 'Device Approval Required',
      data: {
        code: 'DEVICE_NOT_APPROVED',
        deviceId,
        message: 'This device is pending Admin authorization.'
      }
    })
  }

  // 2. Regular staff member
  const existing = await prisma.trustedDevice.findUnique({
    where: { deviceId }
  })

  if (existing) {
    if (existing.isApproved && !existing.isBlocked) {
      await prisma.trustedDevice.update({
        where: { id: existing.id },
        data: { 
          lastUsedAt: new Date(), 
          ipAddress,
          deviceName: device.name && !device.name.startsWith('Unregistered') ? device.name : existing.deviceName,
          browser: device.browser || existing.browser,
          os: device.os || existing.os,
          ...(fcmToken ? { fcmToken } : {})
        }
      })
      return { success: true, isApproved: true, device: existing }
    }

    deleteCookie(event, 'auth_token', { path: '/' })
    throw createError({
      statusCode: 403,
      statusMessage: 'Device Approval Required',
      data: {
        code: 'DEVICE_NOT_APPROVED',
        deviceId,
        message: 'This device is not authorized. Please ask your administrator to approve this device.'
      }
    })
  }

  // Register as pending
  await prisma.trustedDevice.create({
    data: {
      deviceId,
      userId: sessionUser.id,
      deviceName: device.name || `${sessionUser.name}'s Device`,
      deviceType: device.type || 'DESKTOP',
      browser: device.browser,
      os: device.os,
      cpuCores: device.cpuCores,
      gpuRenderer: device.gpuRenderer,
      screenResolution: device.screenResolution,
      hardwareHash: device.hardwareHash,
      ipAddress,
      isApproved: false
    }
  })

  deleteCookie(event, 'auth_token', { path: '/' })
  throw createError({
    statusCode: 403,
    statusMessage: 'Device Approval Required',
    data: {
      code: 'DEVICE_NOT_APPROVED',
      deviceId,
      message: 'This device is pending Admin authorization.'
    }
  })
})
