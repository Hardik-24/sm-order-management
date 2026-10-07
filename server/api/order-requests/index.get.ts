import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const query = getQuery(event)
  const isUnlimited = String(query.limit) === '-1' || query.limit === 'unlimited'
  const page = isUnlimited ? 1 : Math.max(1, parseInt(query.page as string, 10) || 1)
  const limit = isUnlimited ? -1 : Math.max(1, Math.min(100, parseInt(query.limit as string, 10) || 10))
  const skip = isUnlimited ? undefined : (page - 1) * limit
  const take = isUnlimited ? undefined : limit
  const search = (query.search as string || '').trim()
  const status = (query.status as string || 'ALL').toUpperCase()
  const startDate = query.startDate as string
  const endDate = query.endDate as string

  const where: any = {}

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (search) {
    where.OR = [
      { requestNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      where.createdAt.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  const [requests, total, pendingCount, confirmedCount, declinedCount] = await Promise.all([
    prisma.orderRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                stock: true,
                price: true,
                unit: true
              }
            }
          }
        },
        convertedOrder: {
          select: {
            id: true,
            orderNumber: true,
            overallStatus: true
          }
        },
        confirmedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.orderRequest.count({ where }),
    prisma.orderRequest.count({ where: { status: 'PENDING' } }),
    prisma.orderRequest.count({ where: { status: 'CONFIRMED' } }),
    prisma.orderRequest.count({ where: { status: 'DECLINED' } }),
  ])

  return {
    requests,
    total,
    page,
    limit,
    totalPages: isUnlimited ? 1 : (Math.ceil(total / limit) || 1),
    counts: {
      pending: pendingCount,
      confirmed: confirmedCount,
      declined: declinedCount,
      all: pendingCount + confirmedCount + declinedCount
    }
  }
})
