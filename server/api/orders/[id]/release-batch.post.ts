import { getUserFromEvent, requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireActionPermission(event, 'canManageBatches')

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const batchOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      parentOrder: true,
      items: true
    }
  })

  if (!batchOrder) {
    throw createError({ statusCode: 404, message: 'Batch not found' })
  }

  if (!batchOrder.isBatchOnHold) {
    return {
      success: true,
      message: 'Batch is already released for packing',
      order: batchOrder
    }
  }

  const updatedBatch = await prisma.order.update({
    where: { id },
    data: {
      isBatchOnHold: false,
      batchNotes: null,
      timeline: {
        create: {
          action: 'Batch Released to Packing',
          description: `Batch ${batchOrder.batchNumber || ''} released from hold by ${user.name}. It is now ready for packing.`,
          performedById: user.id
        }
      }
    },
    include: {
      items: true,
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      customer: true
    }
  })

  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
    type: 'ORDER_CHANGE',
    action: 'BATCH_RELEASED',
    orderId: updatedBatch.id,
    order: updatedBatch
  })

  if (updatedBatch.parentOrderId) {
    await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'BATCH_RELEASED',
      orderId: updatedBatch.parentOrderId
    })
  }

  return {
    success: true,
    message: `Batch ${batchOrder.batchNumber || ''} successfully released for packing!`,
    order: updatedBatch
  }
})
