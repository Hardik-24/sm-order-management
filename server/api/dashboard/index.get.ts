import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [
    ordersToday,
    ordersYesterday,
    awaitingBilling,
    packing,
    readyForDelivery,
    delivered,
    confirmed,
    dispatched,
    billingPending,
    readyOrders
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.order.count({ 
      where: { 
        billingStatus: { status: 'PENDING' },
        overallStatus: { not: 'DELIVERED' }
      } 
    }),
    prisma.order.count({ 
      where: { 
        packingStatus: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        overallStatus: { not: 'DELIVERED' }
      } 
    }),
    prisma.order.count({
      where: { 
        deliveryStatus: { status: 'WAITING' }, 
        billingStatus: { status: 'GENERATED' }, 
        packingStatus: { status: 'PACKED' }
      }
    }),
    prisma.order.count({
      where: { overallStatus: 'DELIVERED', createdAt: { gte: today, lt: tomorrow } }
    }),
    prisma.order.count({ 
      where: { overallStatus: 'CONFIRMED' } 
    }),
    prisma.order.count({ where: { overallStatus: 'DISPATCHED' } }),
    prisma.order.findMany({
      where: { billingStatus: { status: 'PENDING' }, createdAt: { lt: oneHourAgo } },
      include: { customer: true }, take: 5
    }),
    prisma.order.findMany({
      where: { deliveryStatus: { status: 'WAITING' }, billingStatus: { status: 'GENERATED' }, packingStatus: { status: 'PACKED' } },
      include: { customer: true }, take: 5
    })
  ])

  let ordersTodayChange = 0
  if (ordersYesterday > 0) {
    ordersTodayChange = ((ordersToday - ordersYesterday) / ordersYesterday) * 100
  } else if (ordersToday > 0) {
    ordersTodayChange = 100
  }

  const orderFlow = {
    new: confirmed,
    packing: packing,
    billing: awaitingBilling,
    issues: 0,
    ready: readyForDelivery,
    delivery: dispatched,
    delivered: delivered
  }

  const needsAttention = [
    ...billingPending.map(o => ({ 
      id: o.id, 
      orderNumber: o.orderNumber, 
      customerName: o.customer.name, 
      statusText: 'Billing Pending',
      timeAgo: '1h+',
      actionText: 'Generate Bill'
    })),
    ...readyOrders.map(o => ({ 
      id: o.id, 
      orderNumber: o.orderNumber, 
      customerName: o.customer.name, 
      statusText: 'Ready for delivery',
      timeAgo: 'Now',
      actionText: 'Dispatch'
    }))
  ]

  return { ordersToday, ordersTodayChange, awaitingBilling, packing, readyForDelivery, delivered, orderFlow, needsAttention }
})
