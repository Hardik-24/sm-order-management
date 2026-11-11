import { requireActionPermission, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { syncOrderTripState } from '~~/server/utils/tripSync'
import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { isNotificationEnabled } from '~~/server/utils/notificationSettings'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireActionPermission(event, 'canCancelOrders')

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const reason = (body?.reason || '').trim()

  if (!reason) {
    throw createError({ statusCode: 400, message: 'A mandatory cancellation reason is required' })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { deliveryStatus: true, billingStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (order.billingStatus?.status === 'GENERATED' || order.billingStatus?.invoiceNumber) {
    throw createError({ 
      statusCode: 400, 
      message: 'This order cannot be cancelled because its bill/invoice has already been generated.' 
    })
  }

  if (order.overallStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Order is already cancelled' })
  }

  if (order.overallStatus === 'DELIVERED') {
    throw createError({ statusCode: 400, message: 'Cannot cancel an order that has already been delivered' })
  }

  // Remove from any active or planned trips
  await syncOrderTripState(prisma, id, 'CANCELLED', {
    notes: `Order cancelled: ${reason}`,
    userId: user.id
  })

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      overallStatus: 'CANCELLED',
      cancelReason: reason,
      cancelledById: user.id,
      cancelledAt: new Date(),
      deliveryStatus: {
        update: {
          status: 'WAITING',
          driverName: null,
          dispatchDate: null,
          eta: null,
          deliveredAt: null,
          holdReason: `Cancelled: ${reason}`
        }
      },
      timeline: {
        create: {
          action: 'Order Cancelled',
          description: `Order marked as Cancelled by ${user.name}. Reason: ${reason}`,
          performedById: user.id
        }
      }
    },
    include: {
      customer: true,
      items: { include: { product: true } },
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      timeline: { include: { performedBy: true }, orderBy: { timestamp: 'desc' } }
    }
  })

  // Non-blocking Push Notification dispatch with await for Serverless container safety
  if (await isNotificationEnabled('orders')) {
    try {
      await sendPushNotification({
        title: `❌ Order Cancelled: ${updatedOrder.orderNumber}`,
        body: `${updatedOrder.customer?.company || updatedOrder.customer?.name || 'Customer'} • Reason: ${reason}`,
        userIds: [updatedOrder.salesPersonId].filter(Boolean),
        data: {
          orderNumber: updatedOrder.orderNumber,
          orderId: updatedOrder.id,
          type: 'ORDER_CANCELLED'
        }
      })
    } catch (pushErr) {
      console.warn('[FCM] Order cancel push failed:', pushErr)
    }
  }

  return updatedOrder
})
