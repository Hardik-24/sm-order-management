import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { resolveDestinationPin, loadCustomerPins } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  
  const isUnlimited = Number(query.limit) === -1 || query.limit === 'unlimited'
  const page = isUnlimited ? 1 : (Number(query.page) || 1)
  const limit = isUnlimited ? -1 : (Number(query.limit) || 10)
  const search = query.search as string
  const status = query.status as string
  const billingStatus = query.billingStatus as string
  const packingStatus = query.packingStatus as string
  const deliveryStatus = query.deliveryStatus as string
  const startDate = query.startDate as string
  const endDate = query.endDate as string
  const isApproved = query.isApproved as string
  const isUrgent = query.isUrgent as string
  const sortBy = (query.sortBy as string) || 'createdAt'
  const sortOrder = (query.sortOrder as string) || 'desc'

  const skip = isUnlimited ? undefined : (page - 1) * limit
  const take = isUnlimited ? undefined : limit

  const andConditions: any[] = []
  
  if (search) {
    andConditions.push({
      OR: [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { company: { contains: search, mode: 'insensitive' } } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } },
        { customer: { city: { contains: search, mode: 'insensitive' } } }
      ]
    })
  }

  if (isApproved !== undefined && isApproved !== '') {
    andConditions.push({ isApproved: isApproved === 'true' })
  }
  if (isUrgent !== undefined && isUrgent !== '') {
    andConditions.push({ isUrgent: isUrgent === 'true' })
  }
  if (status) {
    if (status === '!CANCELLED' || status === 'ACTIVE') {
      andConditions.push({ overallStatus: { not: 'CANCELLED' } })
    } else {
      andConditions.push({ overallStatus: status })
    }
  }
  if (billingStatus) {
    if (billingStatus === 'ON_HOLD') {
      andConditions.push({ billingStatus: { status: { in: ['ON_HOLD', 'ERROR'] } } })
    } else {
      andConditions.push({ billingStatus: { status: billingStatus } })
    }
  }
  if (packingStatus) {
    andConditions.push({ packingStatus: { status: packingStatus } })
  }
  if (deliveryStatus) {
    if (deliveryStatus === 'WAITING') {
      andConditions.push({ deliveryStatus: { status: { in: ['WAITING', 'ASSIGNED'] } } })
    } else {
      andConditions.push({ deliveryStatus: { status: deliveryStatus } })
    }
  }

  // Salesperson scoping: Admin can select any rep; Sales can toggle All Company vs My Orders
  const salesPersonId = (query.salesPersonId as string) || ''
  const scope = (query.scope as string) || ''
  if (user.role === 'ADMIN') {
    if (salesPersonId && salesPersonId !== 'all') {
      andConditions.push({ salesPersonId })
    }
  } else if (user.role === 'SALES') {
    if (scope === 'mine' || salesPersonId === 'mine' || salesPersonId === user.id) {
      andConditions.push({ salesPersonId: user.id })
    }
  }
  
  if (startDate || endDate) {
    const dateCondition: any = {}
    if (startDate) {
      const d = new Date(`${startDate}T00:00:00`)
      if (!isNaN(d.getTime())) dateCondition.gte = d
    }
    if (endDate) {
      const d = new Date(`${endDate}T23:59:59.999`)
      if (!isNaN(d.getTime())) dateCondition.lte = d
    }
    if (dateCondition.gte || dateCondition.lte) {
      andConditions.push({
        OR: [
          { orderDate: dateCondition },
          { createdAt: dateCondition }
        ]
      })
    }
  }

  const where: any = andConditions.length > 0 ? { AND: andConditions } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: { select: { id: true, name: true, company: true, address: true, city: true, latitude: true, longitude: true, landmark: true, privilegeTier: true, isPriorityClient: true, addresses: true } },
        salesPerson: { select: { name: true } },
        approvedBy: { select: { name: true } },
        billingStatus: { select: { status: true, invoiceNumber: true, invoiceDate: true, invoicePdfUrl: true } },
        packingStatus: { select: { status: true } },
        deliveryStatus: { select: { status: true, driverName: true } },
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
    totalPages: isUnlimited ? 1 : (Math.ceil(total / limit) || 1)
  }
})
