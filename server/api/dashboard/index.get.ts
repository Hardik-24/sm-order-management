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
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [
    ordersToday,
    ordersYesterday,
    pendingApproval,
    awaitingBilling,
    packing,
    readyForDelivery,
    delivered,
    dispatched,
    pendingApprovalOrders,
    billingPending,
    readyOrders,
    recentOrders
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.order.count({
      where: {
        isApproved: false,
        overallStatus: { notIn: ['CANCELLED', 'DELIVERED'] }
      }
    }),
    prisma.order.count({ 
      where: { 
        isApproved: true,
        billingStatus: { status: 'PENDING' },
        overallStatus: { not: 'DELIVERED' }
      } 
    }),
    prisma.order.count({ 
      where: { 
        isApproved: true,
        packingStatus: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        overallStatus: { not: 'DELIVERED' }
      } 
    }),
    prisma.order.count({
      where: { 
        isApproved: true,
        deliveryStatus: { status: 'WAITING' },
        billingStatus: { status: 'GENERATED' },
        packingStatus: { status: 'PACKED' }
      }
    }),
    prisma.order.count({
      where: { overallStatus: 'DELIVERED', createdAt: { gte: today, lt: tomorrow } }
    }),
    prisma.order.count({ where: { overallStatus: 'DISPATCHED' } }),
    prisma.order.findMany({
      where: {
        isApproved: false,
        overallStatus: { notIn: ['CANCELLED', 'DELIVERED'] }
      },
      include: { customer: true },
      take: 5
    }),
    prisma.order.findMany({
      where: { isApproved: true, billingStatus: { status: 'PENDING' }, createdAt: { lt: oneHourAgo } },
      include: { customer: true },
      take: 5
    }),
    prisma.order.findMany({
      where: { isApproved: true, deliveryStatus: { status: 'WAITING' }, billingStatus: { status: 'GENERATED' }, packingStatus: { status: 'PACKED' } },
      include: { customer: true },
      take: 5
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        overallStatus: { not: 'CANCELLED' }
      },
      select: {
        id: true,
        createdAt: true,
        totalAmount: true
      }
    })
  ])

  let ordersTodayChange = 0
  if (ordersYesterday > 0) {
    ordersTodayChange = ((ordersToday - ordersYesterday) / ordersYesterday) * 100
  } else if (ordersToday > 0) {
    ordersTodayChange = 100
  }

  // 1. Last 7 Days (daily order counts & value)
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)

    const matches = recentOrders.filter(o => {
      const oDate = new Date(o.createdAt)
      return oDate >= d && oDate < nextD
    })

    const count = matches.length
    const totalAmount = matches.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)

    last7Days.push({
      key: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      shortDate: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      count,
      totalAmount,
      isToday: i === 0
    })
  }

  // 2. Today Hourly (7 clean 2-hour buckets)
  const hourlySlots = [
    { start: 8, end: 10, label: '8-10 AM' },
    { start: 10, end: 12, label: '10-12 PM' },
    { start: 12, end: 14, label: '12-2 PM' },
    { start: 14, end: 16, label: '2-4 PM' },
    { start: 16, end: 18, label: '4-6 PM' },
    { start: 18, end: 20, label: '6-8 PM' },
    { start: 20, end: 24, label: 'Late' }
  ]

  const todayOrders = recentOrders.filter(o => {
    const oDate = new Date(o.createdAt)
    return oDate >= today && oDate < tomorrow
  })

  const todayHourly = hourlySlots.map(slot => {
    const matches = todayOrders.filter(o => {
      const h = new Date(o.createdAt).getHours()
      return h >= slot.start && h < slot.end
    })
    const count = matches.length
    const totalAmount = matches.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    return {
      label: slot.label,
      count,
      totalAmount
    }
  })

  // 3. Last 30 Days (daily intake)
  const last30Days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)

    const matches = recentOrders.filter(o => {
      const oDate = new Date(o.createdAt)
      return oDate >= d && oDate < nextD
    })

    last30Days.push({
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      count: matches.length,
      totalAmount: matches.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
      isToday: i === 0
    })
  }

  const orderTrends = {
    last7Days,
    todayHourly,
    last30Days
  }

  const orderFlow = {
    sales: ordersToday,
    approval: pendingApproval,
    packing: packing,
    billing: awaitingBilling,
    delivery: dispatched,
    delivered: delivered,
    total: ordersToday + pendingApproval + packing + awaitingBilling + dispatched
  }

  const needsAttention = [
    ...pendingApprovalOrders.map(o => ({ 
      id: o.id, 
      orderNumber: o.orderNumber, 
      customerName: o.customer.name, 
      statusText: 'Pending Approval',
      timeAgo: 'Action needed',
      actionText: 'Review'
    })),
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

  return {
    ordersToday,
    ordersTodayChange,
    pendingApproval,
    packing,
    awaitingBilling,
    readyForDelivery,
    delivered,
    orderFlow,
    orderTrends,
    needsAttention
  }
})
