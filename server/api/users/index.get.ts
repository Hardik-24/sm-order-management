import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      vehicleNumber: true,
      vehicleName: true,
      isActive: true,
      allowedPages: true,
      actionPermissions: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { name: 'asc' }
  })

  return users
})
