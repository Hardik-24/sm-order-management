import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  
  const fulfillableUnits = [
    { parentOrderId: { not: null } },
    { batches: { none: {} } }
  ]
  
  const where: any = {
    overallStatus: { not: 'CANCELLED' },
    isApproved: true,
    OR: fulfillableUnits
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
      where.AND = [
        {
          OR: [
            { orderDate: dateCondition },
            { createdAt: dateCondition }
          ]
        }
      ]
    }
  }

  const [pending, urgent, inProgress, packed, onHold, total] = await Promise.all([
    prisma.order.count({ where: { ...where, isBatchOnHold: false, packingStatus: { status: 'PENDING' } } }),
    prisma.order.count({ 
      where: { 
        ...where, 
        isBatchOnHold: false,
        isUrgent: true,
        packingStatus: { status: { not: 'PACKED' } }
      } 
    }),
    prisma.order.count({ where: { ...where, isBatchOnHold: false, packingStatus: { status: 'IN_PROGRESS' } } }),
    prisma.order.count({ where: { ...where, packingStatus: { status: 'PACKED' } } }),
    prisma.order.count({ 
      where: { 
        ...where, 
        OR: [
          { packingStatus: { status: 'ON_HOLD' } },
          { isBatchOnHold: true }
        ] 
      } 
    }),
    prisma.order.count({ where })
  ])

  return { pending, urgent, inProgress, packed, onHold, total }
})
