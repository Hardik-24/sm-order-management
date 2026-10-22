import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'SALES', 'DELIVERY'])
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
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
