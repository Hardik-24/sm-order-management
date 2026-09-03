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

  const ordersToday = await prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } })
  const ordersYesterday = await prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } })

  let ordersTodayChange = 0
  if (ordersYesterday > 0) {
    ordersTodayChange = ((ordersToday - ordersYesterday) / ordersYesterday) * 100
  } else if (ordersToday > 0) {
    ordersTodayChange = 100
  }

  const awaitingBilling = await prisma.order.count({ 
    where: { 
      billingStatus: { status: 'PENDING' },
      overallStatus: { not: 'DELIVERED' }
    } 
  })
  
  const packing = await prisma.order.count({ 
    where: { 
      packingStatus: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      overallStatus: { not: 'DELIVERED' }
    } 
  })

  const readyForDelivery = await prisma.order.count({
    where: { 
      deliveryStatus: { status: 'WAITING' }, 
      billingStatus: { status: 'GENERATED' }, 
      packingStatus: { status: 'PACKED' }
    }
  })

  const delivered = await prisma.order.count({
    where: { overallStatus: 'DELIVERED', createdAt: { gte: today, lt: tomorrow } }
  })

  const confirmed = await prisma.order.count({ 
    where: { overallStatus: 'CONFIRMED' } 
  })
  
  const orderFlow = {
    new: confirmed,
    packing: packing,
    billing: awaitingBilling,
    issues: 0,
    ready: readyForDelivery,
    delivery: await prisma.order.count({ where: { overallStatus: 'DISPATCHED' } }),
    delivered: delivered
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const billingPending = await prisma.order.findMany({
    where: { billingStatus: { status: 'PENDING' }, createdAt: { lt: oneHourAgo } },
    include: { customer: true }, take: 5
  })
  const readyOrders = await prisma.order.findMany({
    where: { deliveryStatus: { status: 'WAITING' }, billingStatus: { status: 'GENERATED' }, packingStatus: { status: 'PACKED' } },
    include: { customer: true }, take: 5
  })

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
