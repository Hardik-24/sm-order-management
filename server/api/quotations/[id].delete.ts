import { defineEventHandler } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireActionPermission } from '~~/server/utils/auth'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  // Allow ADMIN or any user granted the canDeleteQuotations action permission
  await requireActionPermission(event, 'canDeleteQuotations')

  const id = event.context.params?.id
  if (!id) {
    return { success: false, error: 'Quotation ID required' }
  }

  let p = getPrisma()

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
