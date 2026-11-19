import { getUserFromEvent, requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireActionPermission(event, 'canManageBatches')

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const batch = await prisma.order.findUnique({
    where: { id },
    include: {
      parentOrder: true,
      items: true,
      packingStatus: true,
      billingStatus: true,
      deliveryStatus: true
    }
  })

  if (!batch) {
    throw createError({ statusCode: 404, message: 'Batch not found' })
  }

  if (!batch.parentOrderId) {
    throw createError({ statusCode: 400, message: 'Hold toggle is only applicable to child fulfillment batches' })
  }

  if (batch.packingStatus?.status === 'PACKED') {
    throw createError({ statusCode: 400, message: 'Cannot put a batch on hold after packing is completed' })
  }

  if (batch.billingStatus?.status === 'GENERATED') {
    throw createError({ statusCode: 400, message: 'Cannot put a batch on hold after its bill has been generated' })
  }

  const newHoldState = !batch.isBatchOnHold
  const actionText = newHoldState ? 'Batch Placed On Hold' : 'Batch Released to Packing'
  const descText = newHoldState
    ? `Batch ${batch.batchNumber || ''} placed on hold (paused from warehouse packing) by ${user.name}.`
    : `Batch ${batch.batchNumber || ''} released from hold by ${user.name}. It is now active in the packing queue.`

  const updatedBatch = await prisma.order.update({
    where: { id },
    data: {
      isBatchOnHold: newHoldState,
      batchNotes: newHoldState ? 'Stock pending / On hold' : null,
      timeline: {
        create: {
          action: actionText,
          description: descText,
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
    action: newHoldState ? 'BATCH_HELD' : 'BATCH_RELEASED',
    orderId: updatedBatch.id,
    order: updatedBatch
  })

  if (updatedBatch.parentOrderId) {
    await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: newHoldState ? 'BATCH_HELD' : 'BATCH_RELEASED',
      orderId: updatedBatch.parentOrderId
    })
  }

  return {
    success: true,
    isBatchOnHold: updatedBatch.isBatchOnHold,
    message: descText,
    batch: updatedBatch
  }
})
