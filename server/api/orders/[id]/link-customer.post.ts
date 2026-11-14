import { requireActionPermission, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
    const user = await requireActionPermission(event, 'canLinkBusyData')

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const { customerId } = body
  if (!customerId) throw createError({ statusCode: 400, message: 'customerId is required' })

  const [order, targetCustomer] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { customer: true, billingStatus: true }
    }),
    prisma.customer.findUnique({
      where: { id: customerId }
    })
  ])

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
  if (!targetCustomer) throw createError({ statusCode: 404, message: 'Customer not found' })

  if (order.billingStatus?.status === 'GENERATED') {
    throw createError({ statusCode: 400, message: 'Cannot re-link customer after bill/invoice has already been generated' })
  }

  const oldCustomerName = order.customer?.name || 'Provisional Lead'

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const ord = await tx.order.update({
      where: { id },
      data: {
        customerId: targetCustomer.id,
        paymentTerms: targetCustomer.paymentTerms || order.paymentTerms
      },
      include: {
        customer: true,
        billingStatus: true,
        packingStatus: true,
        deliveryStatus: true,
        items: {
          include: {
            product: true
          }
        },
        timeline: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { timestamp: 'desc' }
        }
      }
    })

    await tx.orderTimeline.create({
      data: {
        orderId: id,
        action: 'Customer Linked to Busy',
        description: `Customer updated from provisional lead "${oldCustomerName}" to verified Busy customer "${targetCustomer.name}" (${targetCustomer.customerCode || targetCustomer.company || 'Linked'}) by ${user.name || 'Billing Staff'}`,
        performedById: user.id
      }
    })

    return ord
  })

  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
    type: 'ORDER_CHANGE',
    action: 'ORDER_UPDATED',
    orderId: id,
    order: updatedOrder
  })

  return {
    success: true,
    order: updatedOrder
  }
})
