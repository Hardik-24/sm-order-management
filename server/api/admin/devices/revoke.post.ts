import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readBody(event)

  const deviceId = body?.deviceId?.trim()
  const shouldBlock = Boolean(body?.block)
  const shouldDelete = Boolean(body?.delete)

  if (!deviceId) {
    throw createError({ statusCode: 400, message: 'Device ID is required' })
  }

  if (shouldDelete) {
    await prisma.trustedDevice.delete({
      where: { deviceId }
    })
    return { success: true, message: 'Device deleted' }
  }

  const updated = await prisma.trustedDevice.update({
    where: { deviceId },
    data: {
      isApproved: false,
      isBlocked: shouldBlock,
      blockedReason: shouldBlock ? (body?.reason || 'Blocked by Administrator') : null
    }
  })

  return {
    success: true,
    device: updated
  }
})
