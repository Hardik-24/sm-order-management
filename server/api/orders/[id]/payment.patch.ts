import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES', 'BILLING'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event) || {}
  const { amountReceived, status, paymentMethod, referenceNo, dueDate, notes, markFullPaid } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: { paymentStatus: true, customer: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  const orderTotal = Number(order.totalAmount || 0)
  const currentPaid = Number(order.paymentStatus?.amountPaid || 0)

  let newAmountPaid = currentPaid
  let newBalanceDue = Number(order.paymentStatus?.balanceDue ?? (orderTotal - currentPaid))
  let newStatus = order.paymentStatus?.status || 'UNPAID'
  let paidAt = order.paymentStatus?.paidAt || null
  let recordedPaymentAmount = 0

  let timelineDescription = ''

  if (markFullPaid) {
    const delta = Math.max(0, orderTotal - currentPaid)
    recordedPaymentAmount = delta
    newAmountPaid = orderTotal
    newBalanceDue = 0
    newStatus = 'PAID'
    paidAt = new Date()
    timelineDescription = `Payment Completed: Order marked as fully paid (₹${orderTotal.toLocaleString('en-IN')}) via ${paymentMethod || 'Direct Payment'}${referenceNo ? ` (Ref: ${referenceNo})` : ''}`
  } else if (typeof amountReceived === 'number' && amountReceived > 0) {
    recordedPaymentAmount = amountReceived
    newAmountPaid = Math.min(orderTotal, currentPaid + amountReceived)
    newBalanceDue = Math.max(0, orderTotal - newAmountPaid)
    newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIAL'
    if (newStatus === 'PAID') {
      paidAt = new Date()
    }
    timelineDescription = `Payment Received: ₹${amountReceived.toLocaleString('en-IN')} recorded via ${paymentMethod || 'Direct Payment'}${referenceNo ? ` (Ref: ${referenceNo})` : ''}. Remaining balance: ₹${newBalanceDue.toLocaleString('en-IN')}`
  } else if (status) {
    newStatus = status
    if (status === 'PAID') {
      newAmountPaid = orderTotal
      newBalanceDue = 0
      paidAt = new Date()
      timelineDescription = `Payment status updated to PAID (Full balance cleared)`
    } else if (status === 'UNPAID') {
      newAmountPaid = 0
      newBalanceDue = orderTotal
      paidAt = null
      timelineDescription = `Payment status reset to UNPAID — previous active receipts marked as voided`
      await prisma.paymentRecord.updateMany({
        where: { orderId: id, isVoided: false },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidReason: notes ? `Order reset to UNPAID: ${notes}` : `Order reset to UNPAID by ${user.name}`
        }
      })
    } else {
      if (typeof body.amountPaid === 'number') {
        newAmountPaid = Math.min(orderTotal, Math.max(0, body.amountPaid))
        newBalanceDue = Math.max(0, orderTotal - newAmountPaid)
      }
      timelineDescription = `Payment status updated to ${status}${referenceNo ? ` (Ref: ${referenceNo})` : ''}`
    }
  } else {
    if (typeof body.amountPaid === 'number') {
      newAmountPaid = Math.min(orderTotal, Math.max(0, body.amountPaid))
      newBalanceDue = Math.max(0, orderTotal - newAmountPaid)
    }
    timelineDescription = `Payment details updated by ${user.name}`
  }

  const isUnpaid = newStatus === 'UNPAID'

  // Upsert PaymentStatus
  const updatedPayment = await prisma.paymentStatus.upsert({
    where: { orderId: id },
    create: {
      orderId: id,
      status: newStatus as any,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paymentMethod: isUnpaid ? null : (paymentMethod || null),
      referenceNo: isUnpaid ? null : (referenceNo || null),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      paidAt
    },
    update: {
      status: newStatus as any,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paymentMethod: isUnpaid ? null : (paymentMethod !== undefined ? paymentMethod : undefined),
      referenceNo: isUnpaid ? null : (referenceNo !== undefined ? referenceNo : undefined),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      paidAt
    }
  })

  // Create payment record installment if amount was received
  if (recordedPaymentAmount > 0) {
    await prisma.paymentRecord.create({
      data: {
        orderId: id,
        amount: recordedPaymentAmount,
        paymentMethod: paymentMethod || 'Direct Payment',
        referenceNo: referenceNo || null,
        notes: notes || null,
        recordedById: user.id
      }
    })
  }

  // Add timeline entry
  await prisma.orderTimeline.create({
    data: {
      orderId: id,
      action: 'Payment Updated',
      description: timelineDescription,
      performedById: user.id
    }
  })

  // Return full updated order
  const updatedOrder = await prisma.order.findUnique({
    where: { id },
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
    paymentStatus: updatedPayment,
    order: updatedOrder
  }
})
