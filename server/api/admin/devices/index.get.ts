import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const [devices, users, setting] = await Promise.all([
    prisma.trustedDevice.findMany({
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
      orderBy: [
        { isApproved: 'asc' }, // PENDING first
        { lastUsedAt: 'desc' }
      ]
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.systemSetting.findUnique({
      where: { key: 'hardware_device_lockdown' }
    })
  ])

  return {
    success: true,
    lockdownMode: setting?.value || 'ENFORCING',
    devices,
    users
  }
})
