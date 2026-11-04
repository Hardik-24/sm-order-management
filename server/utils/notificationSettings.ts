import { prisma } from './prisma'

export type NotificationKey = 
  | 'storefront_requests' 
  | 'quotations' 
  | 'orders' 
  | 'order_edits'
  | 'order_approvals' 
  | 'packing' 
  | 'delivery'

/**
 * Checks whether an automated push notification type is enabled in SystemSetting.
 * Evaluates core OMS workflows:
 * - storefront_requests: default TRUE
 * - quotations: default TRUE
 * - orders: default TRUE
 * - order_edits: default TRUE
 * - order_approvals: default TRUE
 * - packing: default FALSE
 * - delivery: default TRUE
 */
export async function isNotificationEnabled(key: NotificationKey): Promise<boolean> {
  try {
    const settingKey = `push_notif_${key}`
    const setting = await prisma.systemSetting.findUnique({
      where: { key: settingKey }
    })

    // Backwards compatibility check for storefront requests
    if (!setting && key === 'storefront_requests') {
      const legacy = await prisma.systemSetting.findUnique({
        where: { key: 'push_notif_order_requests' }
      })
      if (legacy) return legacy.value === 'true'
    }

    if (!setting) {
      // Sensible default for each workflow
      return ['storefront_requests', 'quotations', 'orders', 'order_edits', 'order_approvals', 'delivery'].includes(key)
    }

    return setting.value === 'true'
  } catch (err) {
    console.warn(`[isNotificationEnabled] Failed to read setting for ${key}:`, err)
    return true
  }
}
