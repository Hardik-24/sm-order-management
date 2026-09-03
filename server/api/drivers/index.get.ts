import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'DELIVERY', 'SALES', 'BILLING', 'PACKING'])
  
  // Fetch active users with DELIVERY or ADMIN roles who can drive
  const drivers = await prisma.user.findMany({
    where: {
      role: { in: ['DELIVERY', 'ADMIN'] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' }
  })

  return drivers
})
