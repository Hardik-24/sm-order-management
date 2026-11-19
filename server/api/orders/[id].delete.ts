import { requireRole, getUserFromEvent, requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const order = await prisma.order.findUnique({
    where: { id },
    include: { billingStatus: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  const isChildBatch = Boolean(order.parentOrderId)
  if (isChildBatch) {
    // Permission to delete a batch
    await requireActionPermission(event, 'canManageBatches')
  } else {
    // Only Admin can delete master orders
    await requireRole(event, ['ADMIN'])
  }

  if (order.billingStatus?.status === 'GENERATED' || order.billingStatus?.invoiceNumber) {
    throw createError({ 
      statusCode: 400, 
      message: 'This cannot be deleted because its bill/invoice has already been generated.' 
    })
  }

  const parentOrderId = order.parentOrderId

  await prisma.order.delete({ where: { id } })

  // If this was a child batch, update parent order batch count and timeline
  if (isChildBatch && parentOrderId) {
    const remainingBatches = await prisma.order.count({
      where: { parentOrderId }
    })
    await prisma.order.update({
      where: { id: parentOrderId },
      data: { batchCount: remainingBatches }
    })

    await prisma.orderTimeline.create({
      data: {
        orderId: parentOrderId,
        action: 'BATCH_DELETED',
        description: `Batch #${order.batchNumber || ''} (${order.orderNumber}) was deleted by ${user?.name || 'Admin'}. All allocated units returned to the pending pool.`,
        performedById: user?.id
      }
    })

    // Broadcast parent order update so open drawers recalculate their pending pool immediately
    await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'ORDER_UPDATED',
      orderId: parentOrderId
    })
  }

  // Multi-device WebSocket broadcast (<100ms)
  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
    type: 'ORDER_CHANGE',
    action: 'ORDER_DELETED',
    orderId: id,
    orderNumber: order.orderNumber,
    parentOrderId: parentOrderId || null
  })

  return { 
    success: true, 
    isBatch: isChildBatch, 
    parentOrderId: parentOrderId || null,
    message: isChildBatch 
      ? `Batch #${order.batchNumber || ''} deleted successfully. Allocated items returned to the pending pool.`
      : 'Order deleted successfully.'
  }
})
