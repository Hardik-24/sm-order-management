// POST /api/admin/devices/logout-all-others - Log out all sessions across all devices except current admin
import { requireRole } from '~~/server/utils/auth'
import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionUser = requireRole(event, ['ADMIN'])
  const body = await readBody(event).catch(() => ({}))

  // Determine the current device ID
  let currentDeviceId = body?.deviceId || getCookie(event, 'sm_flow_hw_device_id')
  
  if (!currentDeviceId) {
    // Fall back to the admin's most recently active approved device
    const adminDevice = await prisma.trustedDevice.findFirst({
      where: {
        userId: sessionUser.id,
        isApproved: true,
        isBlocked: false
      },
      orderBy: { lastUsedAt: 'desc' }
    })
    currentDeviceId = adminDevice?.deviceId
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000)

  // 1. Set global session invalidation cutoff in system_settings
  await prisma.systemSetting.upsert({
    where: { key: 'session_min_valid_iat' },
    create: { key: 'session_min_valid_iat', value: String(nowEpochSeconds) },
    update: { value: String(nowEpochSeconds) }
  })

  // 2. Exempt the current admin user and their current device
  await prisma.systemSetting.upsert({
    where: { key: 'session_exempt_user_id' },
    create: { key: 'session_exempt_user_id', value: sessionUser.id },
    update: { value: sessionUser.id }
  })

  if (currentDeviceId) {
    await prisma.systemSetting.upsert({
      where: { key: 'session_exempt_device_id' },
      create: { key: 'session_exempt_device_id', value: currentDeviceId },
      update: { value: currentDeviceId }
    })

    // 3. Keep current admin device approved
    await prisma.trustedDevice.updateMany({
      where: { deviceId: currentDeviceId },
      data: { isApproved: true, lastUsedAt: new Date() }
    })

    // 4. Revoke approval for ALL other devices in the system
    const revoked = await prisma.trustedDevice.updateMany({
      where: {
        deviceId: { not: currentDeviceId }
      },
      data: {
        isApproved: false,
        pairingCode: null,
        pairingExpiresAt: null
      }
    })

    return {
      success: true,
      currentDeviceId,
      exemptUserId: sessionUser.id,
      revokedDevicesCount: revoked.count,
      message: `All other devices (${revoked.count}) and account sessions have been logged out. Only your current device is authorized.`
    }
  }

  return {
    success: true,
    message: 'Global session cutoff applied. All existing non-admin sessions have been invalidated.'
  }
})
