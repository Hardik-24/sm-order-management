import { defineEventHandler, createError } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireActionPermission } from '~~/server/utils/auth'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  // Allow ADMIN or any user granted the canDeleteQuotations action permission
  const user = await requireActionPermission(event, 'canDeleteQuotations')

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Quotation ID required' })
  }

  let p = getPrisma()

  // Find quotation to check conversion status
  let quote: any = null
  try {
    quote = await p.quotation.findUnique({
      where: { id },
      select: { id: true, quoteNumber: true, status: true, convertedOrderId: true }
    })
  } catch (err) {
    p = resetPrisma()
    quote = await p.quotation.findUnique({
      where: { id },
      select: { id: true, quoteNumber: true, status: true, convertedOrderId: true }
    })
  }

  if (!quote) {
    throw createError({ statusCode: 404, statusMessage: 'Quotation not found' })
  }

  // Only ADMIN can delete converted quotations
  const isConverted = quote.status === 'CONVERTED' || Boolean(quote.convertedOrderId)
  if (isConverted && user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Converted quotations cannot be deleted except by an Administrator'
    })
  }

  try {
    await p.quotation.delete({
      where: { id }
    })
    await broadcastRealtimeEvent('sm_orders_realtime', 'QUOTATION_CHANGE', {
      type: 'QUOTATION_CHANGE',
      action: 'QUOTATION_DELETED',
      quotationId: id
    })
    return { success: true }
  } catch (err: any) {
    p = resetPrisma()
    await p.quotation.delete({
      where: { id }
    })
    await broadcastRealtimeEvent('sm_orders_realtime', 'QUOTATION_CHANGE', {
      type: 'QUOTATION_CHANGE',
      action: 'QUOTATION_DELETED',
      quotationId: id
    })
    return { success: true }
  }
})
