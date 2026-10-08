import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const reason = (body?.reason || '').trim()

  if (!reason) {
    throw createError({ statusCode: 400, message: 'A mandatory cancellation reason is required' })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { deliveryStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (order.overallStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Order is already cancelled' })
  }

  if (order.overallStatus === 'DELIVERED') {
    throw createError({ statusCode: 400, message: 'Cannot cancel an order that has already been delivered' })
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      overallStatus: 'CANCELLED',
      cancelReason: reason,
      cancelledById: user.id,
      cancelledAt: new Date(),
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

  return updatedOrder
})
