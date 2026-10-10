import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  
  const where: any = {}
  
  if (query.startDate || query.endDate) {
    where.orderDate = {}
    if (query.startDate) {
      const sd = new Date(`${query.startDate as string}T00:00:00`)
      if (!isNaN(sd.getTime())) where.orderDate.gte = sd
    }
    if (query.endDate) {
      const ed = new Date(`${query.endDate as string}T23:59:59.999`)
      if (!isNaN(ed.getTime())) where.orderDate.lte = ed
    }
  }

  const [pending, inProgress, packed, total] = await Promise.all([
    prisma.order.count({ where: { ...where, packingStatus: { status: 'PENDING' } } }),
    prisma.order.count({ where: { ...where, packingStatus: { status: 'IN_PROGRESS' } } }),
    prisma.order.count({ where: { ...where, packingStatus: { status: 'PACKED' } } }),
    prisma.order.count({ where })
  ])

  return { pending, inProgress, packed, total }
})
