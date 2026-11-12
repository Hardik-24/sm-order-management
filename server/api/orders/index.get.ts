import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { resolveDestinationPin, loadCustomerPins } from '~~/server/utils/customerPins'
import { buildMultiTokenPrismaOr } from '~~/server/utils/search'

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
    const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
      { orderNumber: { contains: token, mode: 'insensitive' } },
      { customer: { company: { contains: token, mode: 'insensitive' } } },
      { customer: { name: { contains: token, mode: 'insensitive' } } },
      { customer: { phone: { contains: token, mode: 'insensitive' } } },
      { customer: { city: { contains: token, mode: 'insensitive' } } }
    ])
    if (multiTokenFilter?.AND) {
      andConditions.push(...multiTokenFilter.AND)
    }
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
    if (billingStatus === '!GENERATED' || billingStatus === 'NOT_BILLED') {
      andConditions.push({ billingStatus: { status: { not: 'GENERATED' } } })
    } else if (billingStatus === 'ON_HOLD') {
      andConditions.push({ billingStatus: { status: { in: ['ON_HOLD', 'ERROR'] } } })
    } else {
      andConditions.push({ billingStatus: { status: billingStatus } })
    }
  }
  if (packingStatus) {
    if (packingStatus === '!PACKED' || packingStatus === 'NOT_PACKED') {
      andConditions.push({ packingStatus: { status: { not: 'PACKED' } } })
    } else {
      andConditions.push({ packingStatus: { status: packingStatus } })
    }
  }
  if (deliveryStatus) {
    if (deliveryStatus === '!DELIVERED' || deliveryStatus === 'NOT_DELIVERED') {
      andConditions.push({ deliveryStatus: { status: { not: 'DELIVERED' } } })
    } else if (deliveryStatus === 'WAITING') {
      andConditions.push({ deliveryStatus: { status: { in: ['WAITING', 'ASSIGNED'] } } })
    } else {
      andConditions.push({ deliveryStatus: { status: deliveryStatus } })
    }
  }

  // Salesperson scoping: Admin, Supervisors, and users with company view can filter by any rep
  const salesPersonId = (query.salesPersonId as string) || ''
  const scope = (query.scope as string) || ''
  const canViewAllCompany = user.role === 'ADMIN' || (user.actionPermissions?.canViewAllCompanyOrders ?? true)

  if (canViewAllCompany) {
    if (salesPersonId && salesPersonId !== 'all' && salesPersonId !== 'mine') {
      andConditions.push({ salesPersonId })
    } else if (salesPersonId === 'mine' || scope === 'mine') {
      andConditions.push({ salesPersonId: user.id })
    }
  } else {
    andConditions.push({ salesPersonId: user.id })
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
        customer: { select: { id: true, name: true, company: true, alias: true, phone: true, alternatePhone: true, address: true, city: true, latitude: true, longitude: true, landmark: true, privilegeTier: true, isPriorityClient: true, isBusySynced: true, addresses: true } },
        salesPerson: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
        billingStatus: { select: { status: true, invoiceNumber: true, invoiceDate: true, invoicePdfUrl: true } },
        packingStatus: { select: { status: true } },
        deliveryStatus: { select: { status: true, driverName: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true, unit: true, price: true, isBusySynced: true } }
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

    const hasUnsyncedBusyItems = order.items?.some((i: any) => i.isBusySynced === false || i.product?.isBusySynced === false) || false

    return {
      ...order,
      hasUnsyncedBusyItems,
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
