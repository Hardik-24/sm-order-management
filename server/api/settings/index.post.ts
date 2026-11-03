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

  // 2. Notification Preferences (Strictly Core OMS Operations)
  if (notifications && typeof notifications === 'object') {
    const keyMap: Record<string, string[]> = {
      storefrontRequests: ['push_notif_storefront_requests', 'push_notif_order_requests'],
      quotations: ['push_notif_quotations'],
      orders: ['push_notif_orders'],
      orderApprovals: ['push_notif_order_approvals'],
      packing: ['push_notif_packing'],
      delivery: ['push_notif_delivery']
    }

    const updates: Promise<any>[] = []

    for (const [field, dbKeys] of Object.entries(keyMap)) {
      if (notifications[field] !== undefined) {
        const strVal = notifications[field] ? 'true' : 'false'
        for (const dbKey of dbKeys) {
          updates.push(
            prisma.systemSetting.upsert({
              where: { key: dbKey },
              update: { value: strVal },
              create: { key: dbKey, value: strVal }
            })
          )
        }
      }
    }

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
