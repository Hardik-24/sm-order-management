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
      where.orderDate.gte = new Date(query.startDate as string)
    }
    if (query.endDate) {
      const ed = new Date(query.endDate as string)
      ed.setHours(23, 59, 59, 999)
      where.orderDate.lte = ed
    }
  }

  const [waiting, dispatched, delivered, total] = await Promise.all([
    prisma.order.count({ where: { ...where, deliveryStatus: { status: { in: ['WAITING', 'ASSIGNED'] } } } }),
    prisma.order.count({ where: { ...where, deliveryStatus: { status: 'DISPATCHED' } } }),
    prisma.order.count({ where: { ...where, deliveryStatus: { status: 'DELIVERED' } } }),
    prisma.order.count({ where })
  ])

  return { waiting, dispatched, delivered, total }
})
