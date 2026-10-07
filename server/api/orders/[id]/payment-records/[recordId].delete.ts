import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'BILLING', 'SALES'])

  const orderId = event.context.params?.id
  const recordId = event.context.params?.recordId

  if (!orderId || !recordId) {
    throw createError({ statusCode: 400, message: 'Missing order ID or record ID' })
  }

  const record = await prisma.paymentRecord.findUnique({
    where: { id: recordId }
  })

  if (!record || record.orderId !== orderId) {
    throw createError({ statusCode: 404, message: 'Payment receipt not found' })
  }

  if (record.isVoided) {
    throw createError({ statusCode: 400, message: 'This receipt is already voided' })
  }

  const body = await readBody(event).catch(() => ({})) || {}
  const voidReason = body.reason?.trim() || `Voided by ${user.name}`

  // Mark record as voided
  await prisma.paymentRecord.update({
    where: { id: recordId },
    data: {
      isVoided: true,
      voidedAt: new Date(),
      voidReason
    }
  })

  // Get order
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  const orderTotal = Number(order.totalAmount || 0)

  // Calculate sum of remaining active records
  const remainingActive = await prisma.paymentRecord.findMany({
    where: { orderId, isVoided: false },
    orderBy: { createdAt: 'desc' }
  })

  const newAmountPaid = remainingActive.reduce((acc, r) => acc + Number(r.amount), 0)
  const newBalanceDue = Math.max(0, orderTotal - newAmountPaid)
  const newStatus = newAmountPaid <= 0 ? 'UNPAID' : (newBalanceDue <= 0 ? 'PAID' : 'PARTIAL')
  const latestRecord = remainingActive[0] || null

  // Update order's payment status
  const updatedPaymentStatus = await prisma.paymentStatus.upsert({
    where: { orderId },
    create: {
      orderId,
      status: newStatus as any,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paymentMethod: latestRecord?.paymentMethod || null,
      referenceNo: latestRecord?.referenceNo || null,
      paidAt: newStatus === 'PAID' ? new Date() : null
    },
    update: {
      status: newStatus as any,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paymentMethod: latestRecord?.paymentMethod || null,
      referenceNo: latestRecord?.referenceNo || null,
      paidAt: newStatus === 'PAID' ? new Date() : null
    }
  })

  // Create timeline entry
  await prisma.orderTimeline.create({
    data: {
      orderId,
      action: 'Payment Receipt Voided',
      description: `Payment receipt of ₹${Number(record.amount).toLocaleString('en-IN')} (${record.paymentMethod}) was voided by ${user.name}. Reason: ${voidReason}. Remaining balance: ₹${newBalanceDue.toLocaleString('en-IN')}`,
      performedById: user.id
    }
  })

  // Return full updated order
  const updatedOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      salesPerson: { select: { id: true, name: true } },
      items: { include: { product: true } },
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      paymentStatus: true,
      paymentRecords: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      },
      timeline: { include: { performedBy: true }, orderBy: { timestamp: 'desc' } }
    }
  })

  return {
    success: true,
    paymentStatus: updatedPaymentStatus,
    order: updatedOrder
  }
})
