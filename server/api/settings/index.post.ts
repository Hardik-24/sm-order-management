import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const body = await readBody(event)
  const { quotationAnonymousMode, notifications } = body

  // 1. Quotation Mode
  if (quotationAnonymousMode !== undefined) {
    const strVal = quotationAnonymousMode ? 'true' : 'false'
    await prisma.systemSetting.upsert({
      where: { key: 'quotation_anonymous_mode' },
      update: { value: strVal },
      create: { key: 'quotation_anonymous_mode', value: strVal }
    })
  }

  // 2. Notification Preferences
  if (notifications && typeof notifications === 'object') {
    const keyMap: Record<string, string> = {
      quotations: 'push_notif_quotations',
      orders: 'push_notif_orders',
      orderRequests: 'push_notif_order_requests',
      delivery: 'push_notif_delivery',
      vouchers: 'push_notif_vouchers',
      lowStock: 'push_notif_low_stock'
    }

    const updates = Object.entries(keyMap)
      .filter(([field]) => notifications[field] !== undefined)
      .map(([field, dbKey]) => {
        const strVal = notifications[field] ? 'true' : 'false'
        return prisma.systemSetting.upsert({
          where: { key: dbKey },
          update: { value: strVal },
          create: { key: dbKey, value: strVal }
        })
      })

    if (updates.length > 0) {
      await Promise.all(updates)
    }
  }

  return {
    success: true,
    quotationAnonymousMode: quotationAnonymousMode !== undefined ? Boolean(quotationAnonymousMode) : undefined,
    notifications
  }
})
