import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { resolveDestinationPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 10
  const search = query.search as string
  const status = query.status as string
  const billingStatus = query.billingStatus as string
  const packingStatus = query.packingStatus as string
  const deliveryStatus = query.deliveryStatus as string
  const startDate = query.startDate as string
  const endDate = query.endDate as string
  const sortBy = (query.sortBy as string) || 'createdAt'
  const sortOrder = (query.sortOrder as string) || 'desc'

  const skip = (page - 1) * limit

  const where: any = {}
  
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { company: { contains: search, mode: 'insensitive' } } }
    ]
  }

  if (status) where.overallStatus = status
  if (billingStatus) where.billingStatus = { status: billingStatus }
  if (packingStatus) where.packingStatus = { status: packingStatus }
  if (deliveryStatus) {
    if (deliveryStatus === 'WAITING') {
      where.deliveryStatus = { status: { in: ['WAITING', 'ASSIGNED'] } }
    } else {
      where.deliveryStatus = { status: deliveryStatus }
    }
  }
  
  if (startDate || endDate) {
    where.orderDate = {}
    if (startDate) where.orderDate.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.orderDate.lte = end
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: true,
        salesPerson: { select: { name: true } },
        billingStatus: true,
        packingStatus: true,
        deliveryStatus: true,
        items: { select: { quantity: true, packedQuantity: true } },
        _count: { select: { items: true } }
      }
    }),
    prisma.order.count({ where })
  ])

  const formattedOrders = orders.map((order) => {
    const pin = resolveDestinationPin(
      order.customerId,
      order.customer.name,
      order.deliveryAddress,
      order.customer.city,
      order.customer
    )
    return {
      ...order,
      destinationCoords: pin ? { lat: pin.lat, lng: pin.lng, areaName: pin.areaName, landmark: pin.landmark } : null,
      hasDestinationPin: !!pin,
    }
  })

  return {
    orders: formattedOrders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
})
