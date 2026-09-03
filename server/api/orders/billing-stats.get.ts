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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

  const [pendingOrders, urgentOrders, generatedToday, onHold] = await Promise.all([
    prisma.order.count({ where: { ...where, billingStatus: { status: 'PENDING' } } }),
    prisma.order.count({ where: { ...where, billingStatus: { status: 'PENDING' }, createdAt: { lt: twoHoursAgo } } }),
    prisma.order.count({ where: { ...where, billingStatus: { status: 'GENERATED' }, updatedAt: { gte: today, lt: tomorrow } } }),
    prisma.order.count({ where: { ...where, billingStatus: { status: 'ON_HOLD' } } })
  ])

  return { 
    pending: pendingOrders, 
    urgent: urgentOrders,
    generatedToday,
    onHold
  }
})
