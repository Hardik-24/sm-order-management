import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readBody(event)

  const userId = body?.userId
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!targetUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Generate 6-digit numeric pairing code (e.g. 748291)
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes validity
  const tempDeviceId = `PAIR-${code}-${Date.now().toString().slice(-4)}`

  // Store temporary pairing record
  const device = await prisma.trustedDevice.create({
    data: {
      deviceId: tempDeviceId,
      userId: targetUser.id,
      deviceName: body?.deviceName || `${targetUser.name}'s Device (Pairing)`,
      deviceType: body?.deviceType || 'DESKTOP',
      pairingCode: code,
      pairingExpiresAt: expiresAt,
      isApproved: false
    }
  })

  return {
    success: true,
    code,
    expiresAt,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role
    }
  }
})
