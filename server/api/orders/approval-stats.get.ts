import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)

  const where: any = {}

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

  const [pending, urgent, approved, total] = await Promise.all([
    prisma.order.count({
      where: {
        ...where,
        isApproved: false,
        overallStatus: { not: 'CANCELLED' }
      }
    }),
    prisma.order.count({
      where: {
        ...where,
        isUrgent: true,
        isApproved: false,
        overallStatus: { not: 'CANCELLED' }
      }
    }),
    prisma.order.count({
      where: {
        ...where,
        isApproved: true,
        overallStatus: { not: 'CANCELLED' }
      }
    }),
    prisma.order.count({
      where
    })
  ])

  return {
    pending,
    urgent,
    approved,
    total
  }
})
