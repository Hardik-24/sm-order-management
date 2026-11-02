import { requireRole, unrevokeDeviceSession } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, ['ADMIN'])
  const body = await readBody(event)

  const deviceId = body?.deviceId?.trim()
  if (!deviceId) {
    throw createError({ statusCode: 400, message: 'Device ID is required' })
  }

  // Remove device from in-memory revoked set if present
  unrevokeDeviceSession(deviceId)

  const device = await prisma.trustedDevice.findUnique({
    where: { deviceId }
  })

  if (!device) {
    throw createError({ statusCode: 404, message: 'Device not found' })
  }

  const updated = await prisma.trustedDevice.update({
    where: { deviceId },
    data: {
      isApproved: true,
      isBlocked: false,
      approvedAt: new Date(),
      approvedById: admin.id,
      approvedByName: admin.name || 'Administrator',
      pairingCode: null,
      pairingExpiresAt: null
    }
  })

  return {
    success: true,
    device: updated
  }
})
