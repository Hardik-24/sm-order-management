import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { buildMultiTokenPrismaOr } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN', 'DELIVERY', 'SALES'])
  const query = getQuery(event)

  const status = query.status as string | undefined
  const driverId = query.driverId as string | undefined
  const search = query.search as string | undefined

  const where: any = {}
  if (status && status !== 'ALL') {
    where.status = status
  }
  if (driverId) {
    where.driverId = driverId
  }
  if (search) {
    const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
      { tripNumber: { contains: token, mode: 'insensitive' } },
      { driverName: { contains: token, mode: 'insensitive' } },
      { vehicleNumber: { contains: token, mode: 'insensitive' } },
      {
        stops: {
          some: {
            OR: [
              { customerName: { contains: token, mode: 'insensitive' } },
              { addressLine: { contains: token, mode: 'insensitive' } },
              { order: { orderNumber: { contains: token, mode: 'insensitive' } } }
            ]
          }
        }
      }
    ])
    if (multiTokenFilter) {
      where.AND = multiTokenFilter.AND
    }
  }

  const trips = await prisma.trip.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      stops: {
        orderBy: { stopSequence: 'asc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              overallStatus: true,
              deliveryStatus: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  company: true,
                  phone: true
                }
              },
              items: {
                select: {
                  id: true,
                  productName: true,
                  quantity: true,
                  unitPrice: true
                }
              }
            }
          }
        }
      }
    }
  })

  // Calculate summary metrics
  const counts = {
    total: await prisma.trip.count(),
    planned: await prisma.trip.count({ where: { status: 'PLANNED' } }),
    inTransit: await prisma.trip.count({ where: { status: 'IN_TRANSIT' } }),
    completed: await prisma.trip.count({ where: { status: 'COMPLETED' } })
  }

  return {
    success: true,
    trips,
    counts
  }
})
