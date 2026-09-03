import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

function calculateOverallStatus(billing: string, packing: string, delivery: string) {
  if (delivery === 'DELIVERED') return 'DELIVERED';
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED';
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY';
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING';
  return 'CONFIRMED';
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'BILLING'])
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const body = await readBody(event)
  const { status, invoiceNumber, holdReason, items } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: { billingStatus: true, packingStatus: true, deliveryStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.id) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            totalPrice: item.totalPrice
          }
        })
      }
    }
  }

  const billingData: any = { status, invoiceNumber }
  if (status === 'GENERATED') {
    billingData.generatedById = user.id
    billingData.generatedAt = new Date()
  }
  
  let desc = `Billing status updated to ${status}.`
  if (status === 'ON_HOLD') {
    billingData.holdReason = holdReason
    if (holdReason) desc += ` Reason: ${holdReason}`
  } else {
    billingData.holdReason = null
  }

  const overallStatus = calculateOverallStatus(status, order.packingStatus?.status || 'PENDING', order.deliveryStatus?.status || 'WAITING')

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      overallStatus,
      billingStatus: { update: billingData },
      timeline: {
        create: {
          action: 'Billing Status Updated',
          description: desc,
          performedById: user.id
        }
      }
    },
    include: { billingStatus: true }
  })

  return updatedOrder
})
