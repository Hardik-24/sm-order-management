import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Fetch all orders with their paymentStatus to compute accurate aggregate financial sums
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      totalAmount: true,
      createdAt: true,
      paymentStatus: {
        select: {
          status: true,
          amountPaid: true,
          balanceDue: true,
          dueDate: true,
          paidAt: true,
          updatedAt: true
        }
      }
    }
  })

  let totalOutstanding = 0
  let totalReceivable = 0
  let collectedToday = 0
  let unpaidCount = 0
  let partialCount = 0
  let paidCount = 0
  let overdueCount = 0

  for (const order of orders) {
    const total = Number(order.totalAmount || 0)
    totalReceivable += total

    const ps = order.paymentStatus
    const status = ps?.status || 'UNPAID'
    const paid = Number(ps?.amountPaid || 0)
    const balance = Number(ps?.balanceDue ?? (total - paid))

    if (status === 'PAID') {
      paidCount++
      if (ps?.paidAt && ps.paidAt >= today && ps.paidAt < tomorrow) {
        collectedToday += total
      }
    } else if (status === 'PARTIAL') {
      partialCount++
      totalOutstanding += balance
      if (ps?.updatedAt && ps.updatedAt >= today && ps.updatedAt < tomorrow && paid > 0) {
        collectedToday += paid
      }
      if (ps?.dueDate && new Date(ps.dueDate) < today) {
        overdueCount++
      }
    } else if (status === 'OVERDUE') {
      overdueCount++
      totalOutstanding += balance
    } else {
      // UNPAID or no record yet
      unpaidCount++
      totalOutstanding += balance
      if (ps?.dueDate && new Date(ps.dueDate) < today) {
        overdueCount++
      }
    }
  }

  return {
    totalOutstanding,
    totalReceivable,
    collectedToday,
    unpaidCount,
    partialCount,
    paidCount,
    overdueCount
  }
})
