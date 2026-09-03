import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { deleteTrip } from '~~/server/utils/driverTrips'

function calculateOverallStatus(billing: string, packing: string, delivery: string) {
  if (delivery === 'DELIVERED') return 'DELIVERED';
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED';
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY';
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING';
  return 'CONFIRMED';
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'DELIVERY'])
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const body = await readBody(event)
  const { status, driverName, dispatchDate, eta, deliveredAt, holdReason } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: { billingStatus: true, packingStatus: true, deliveryStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (status === 'WAITING' || status === 'ASSIGNED') {
    await deleteTrip(id)
  }

  const deliveryData: any = { status }
  if (driverName !== undefined) deliveryData.driverName = driverName
  if (dispatchDate !== undefined) deliveryData.dispatchDate = dispatchDate ? new Date(dispatchDate) : null
  if (eta !== undefined) deliveryData.eta = eta ? new Date(eta) : null
  if (deliveredAt !== undefined) deliveryData.deliveredAt = deliveredAt ? new Date(deliveredAt) : null
  if (status === 'DELIVERED' && !deliveryData.deliveredAt) deliveryData.deliveredAt = new Date()

  let desc = `Delivery status updated to ${status}.`
  if (status === 'ON_HOLD') {
    deliveryData.holdReason = holdReason
    if (holdReason) desc += ` Reason: ${holdReason}`
  } else {
    deliveryData.holdReason = null
  }

  const overallStatus = calculateOverallStatus(order.billingStatus?.status || 'PENDING', order.packingStatus?.status || 'PENDING', status)

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      overallStatus,
      deliveryStatus: { update: deliveryData },
      timeline: {
        create: {
          action: 'Delivery Status Updated',
          description: desc,
          performedById: user.id
        }
      }
    },
    include: { deliveryStatus: true }
  })

  return updatedOrder
})
