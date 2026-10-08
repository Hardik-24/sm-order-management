import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { resolveDestinationPin, loadCustomerPins } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  
  const isUnlimited = Number(query.limit) === -1 || query.limit === 'unlimited'
  const page = isUnlimited ? 1 : (Number(query.page) || 1)
  const limit = isUnlimited ? -1 : (Number(query.limit) || 10)
  const search = query.search as string
  const status = query.status as string
  const billingStatus = query.billingStatus as string
  const packingStatus = query.packingStatus as string
  const deliveryStatus = query.deliveryStatus as string
  const paymentStatus = query.paymentStatus as string
  const startDate = query.startDate as string
  const endDate = query.endDate as string
  const isApproved = query.isApproved as string
  const isUrgent = query.isUrgent as string
  const sortBy = (query.sortBy as string) || 'createdAt'
  const sortOrder = (query.sortOrder as string) || 'desc'

  const skip = isUnlimited ? undefined : (page - 1) * limit
  const take = isUnlimited ? undefined : limit

  const where: any = {}
  
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { company: { contains: search, mode: 'insensitive' } } },
      { customer: { name: { contains: search, mode: 'insensitive' } } }
    ]
  }

  if (isApproved !== undefined && isApproved !== '') {
    where.isApproved = isApproved === 'true'
  }
  if (isUrgent !== undefined && isUrgent !== '') {
    where.isUrgent = isUrgent === 'true'
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
  if (paymentStatus) {
    if (paymentStatus === 'UNPAID') {
      where.OR = [
        { paymentStatus: { status: 'UNPAID' } },
        { paymentStatus: null }
      ]
    } else {
      where.paymentStatus = { status: paymentStatus }
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
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: { select: { id: true, name: true, company: true, city: true, latitude: true, longitude: true, landmark: true, privilegeTier: true, isPriorityClient: true } },
        salesPerson: { select: { name: true } },
        approvedBy: { select: { name: true } },
        billingStatus: { select: { status: true, invoiceNumber: true, invoiceDate: true, invoicePdfUrl: true } },
        packingStatus: { select: { status: true } },
        deliveryStatus: { select: { status: true, driverName: true } },
        paymentStatus: { select: { status: true, amountPaid: true, balanceDue: true, paymentMethod: true, referenceNo: true, dueDate: true, paidAt: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, unit: true, price: true } }
          }
        },
        _count: { select: { items: true } }
      }
    }),
    prisma.order.count({ where })
  ])

  const preloadedPins = loadCustomerPins()

  const formattedOrders = orders.map((order) => {
    const pin = resolveDestinationPin(
      order.customerId,
      order.customer.name,
      order.deliveryAddress,
      order.customer.city,
      order.customer,
      preloadedPins
    )
    const total = Number(order.totalAmount || 0)
    const ps = order.paymentStatus || {
      status: 'UNPAID',
      amountPaid: 0,
      balanceDue: total,
      paymentMethod: null,
      referenceNo: null,
      dueDate: null,
      paidAt: null
    }

    return {
      ...order,
      paymentStatus: ps,
      destinationCoords: pin ? { lat: pin.lat, lng: pin.lng, areaName: pin.areaName, landmark: pin.landmark } : null,
      hasDestinationPin: !!pin,
    }
  })

  return {
    orders: formattedOrders,
    total,
    page,
    limit,
    totalPages: isUnlimited ? 1 : (Math.ceil(total / limit) || 1)
  }
})
