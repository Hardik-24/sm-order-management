import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN'])
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const order = await prisma.order.findUnique({
    where: { id },
    include: { billingStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (order.billingStatus?.status === 'GENERATED' || order.billingStatus?.invoiceNumber) {
    throw createError({ 
      statusCode: 400, 
      message: 'This order cannot be deleted because its bill/invoice has already been generated.' 
    })
  }

  await prisma.order.delete({ where: { id } })

  // Multi-device WebSocket broadcast (<100ms)
  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
    type: 'ORDER_CHANGE',
    action: 'ORDER_DELETED',
    orderId: id,
    orderNumber: order.orderNumber
  })

  return { success: true }
})
