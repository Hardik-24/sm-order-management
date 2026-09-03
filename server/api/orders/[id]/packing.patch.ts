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
  await requireRole(event, ['ADMIN', 'PACKING'])
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const body = await readBody(event)
  const { status, assignedToId, items, holdReason } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: { billingStatus: true, packingStatus: true, deliveryStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (items && items.length > 0) {
    for (const item of items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { packedQuantity: item.packedQuantity }
      })
    }
  }

  const packingData: any = { status }
  if (assignedToId) packingData.assignedToId = assignedToId

  let desc = `Packing status updated to ${status}.`
  if (status === 'ON_HOLD') {
    packingData.holdReason = holdReason
    if (holdReason) desc += ` Reason: ${holdReason}`
  } else {
    packingData.holdReason = null
  }

  const overallStatus = calculateOverallStatus(order.billingStatus?.status || 'PENDING', status, order.deliveryStatus?.status || 'WAITING')

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      overallStatus,
      packingStatus: { update: packingData },
      timeline: {
        create: {
          action: 'Packing Status Updated',
          description: desc,
          performedById: user.id
        }
      }
    },
    include: { packingStatus: true }
  })

  return updatedOrder
})
