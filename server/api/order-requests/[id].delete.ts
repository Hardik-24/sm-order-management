import { defineEventHandler, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireAuth, requireRole } from '~~/server/utils/auth'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  // According to request, give admin the option to delete order requests
  requireRole(event, ['ADMIN'])

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, message: 'Request ID is required' })
  }

  // Check if it exists
  const orderRequest = await prisma.orderRequest.findUnique({
    where: { id }
  })

  if (!orderRequest) {
    throw createError({ statusCode: 404, message: 'Order request not found' })
  }

  // Delete the order request. Prisma will cascade delete the items.
  await prisma.orderRequest.delete({
    where: { id }
  })

  // Multi-device WebSocket broadcast (<100ms)
  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_REQUEST_CHANGE', {
    type: 'ORDER_REQUEST_CHANGE',
    action: 'ORDER_REQUEST_DELETED',
    requestId: id,
    requestNumber: orderRequest.requestNumber
  })

  return { success: true, message: 'Order request deleted successfully' }
})
