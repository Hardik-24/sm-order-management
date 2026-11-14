import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'SALES'])
  const id = event.context.params?.id

  if (!id) {
    throw createError({ statusCode: 400, message: 'Request ID is required' })
  }

  const body = await readBody(event)
  const { status, declinedReason } = body

  if (!status || !['PENDING', 'CONFIRMED', 'DECLINED'].includes(status)) {
    throw createError({ statusCode: 400, message: 'Valid status is required (PENDING, CONFIRMED, DECLINED)' })
  }

  const updated = await prisma.orderRequest.update({
    where: { id },
    data: {
      status,
      declinedReason: declinedReason ? declinedReason.trim() : null
    }
  })

  // Multi-device WebSocket broadcast (<100ms)
  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_REQUEST_CHANGE', {
    type: 'ORDER_REQUEST_CHANGE',
    action: 'ORDER_REQUEST_UPDATED',
    requestId: id,
    request: updated
  })

  return {
    success: true,
    request: updated
  }
})
