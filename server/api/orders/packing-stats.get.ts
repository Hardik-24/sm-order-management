import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  
  const where: any = {
    overallStatus: { not: 'CANCELLED' }
  }
  
  if (query.startDate || query.endDate) {
    const dateCondition: any = {}
    if (query.startDate) {
      const sd = new Date(`${query.startDate as string}T00:00:00`)
      if (!isNaN(sd.getTime())) dateCondition.gte = sd
    }
    if (query.endDate) {
      const ed = new Date(`${query.endDate as string}T23:59:59.999`)
      if (!isNaN(ed.getTime())) dateCondition.lte = ed
    }
    if (dateCondition.gte || dateCondition.lte) {
      where.OR = [
        { orderDate: dateCondition },
        { createdAt: dateCondition }
      ]
    }
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

  const [pending, urgent, inProgress, packed, onHold, total] = await Promise.all([
    prisma.order.count({ where: { ...where, packingStatus: { status: 'PENDING' } } }),
    prisma.order.count({ 
      where: { 
        ...where, 
        packingStatus: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        OR: [
          { isUrgent: true },
          { createdAt: { lt: twoHoursAgo } }
        ]
      } 
    }),
    prisma.order.count({ where: { ...where, packingStatus: { status: 'IN_PROGRESS' } } }),
    prisma.order.count({ where: { ...where, packingStatus: { status: 'PACKED' } } }),
    prisma.order.count({ where: { ...where, packingStatus: { status: 'ON_HOLD' } } }),
    prisma.order.count({ where })
  ])

  return { pending, urgent, inProgress, packed, onHold, total }
})
