import { getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getClientIp } from '~~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  const sessionUser = getUserFromEvent(event)
  if (!sessionUser) {
    return { success: false, message: 'Not authenticated' }
  }

  const body = await readBody(event)
  const device = body?.device

  if (!device?.id) {
    return { success: false, message: 'No device ID provided' }
  }

  const ipAddress = getClientIp(event)
  const deviceId = String(device.id).trim()

  // 1. If user is ADMIN, auto-approve this current device to guarantee zero lockout
  if (sessionUser.role === 'ADMIN') {
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
        isApproved: true,
        approvedAt: new Date(),
        approvedByName: 'Primary Admin Auto-Enrolled'
      },
      update: {
        isApproved: true,
        approvedAt: new Date(),
        approvedByName: 'Primary Admin Auto-Enrolled',
        lastUsedAt: new Date(),
        ipAddress,
        browser: device.browser,
        os: device.os
      }
    })

    return {
      success: true,
      isApproved: true,
      device: adminDevice
    }
  }

  // 2. Regular staff member
  const existing = await prisma.trustedDevice.findUnique({
    where: { deviceId }
  })

  if (existing) {
    if (existing.isApproved && !existing.isBlocked) {
      await prisma.trustedDevice.update({
        where: { id: existing.id },
        data: { lastUsedAt: new Date(), ipAddress }
      })
      return { success: true, isApproved: true, device: existing }
    }
    return { success: true, isApproved: false, isBlocked: existing.isBlocked, device: existing }
  }

  // Register as pending
  const created = await prisma.trustedDevice.create({
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

  return {
    success: true,
    isApproved: false,
    device: created
  }
})
