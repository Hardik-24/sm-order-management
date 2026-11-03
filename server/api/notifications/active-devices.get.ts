import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  try {
    const devices = await prisma.trustedDevice.findMany({
      where: {
        fcmToken: { not: null },
        isApproved: true,
        isBlocked: false
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { lastUsedAt: 'desc' }
    })

    return {
      success: true,
      count: devices.length,
      devices: devices.map(d => ({
        id: d.id,
        deviceModel: d.deviceModel || 'Unknown Device',
        platform: d.platform || 'ANDROID',
        lastUsedAt: d.lastUsedAt,
        createdAt: d.createdAt,
        user: d.user,
        tokenSnippet: d.fcmToken ? `${d.fcmToken.slice(0, 10)}...${d.fcmToken.slice(-6)}` : null
      }))
    }
  } catch (err: any) {
    console.error('[active-devices GET] Error:', err)
    return {
      success: false,
      count: 0,
      devices: []
    }
  }
})
