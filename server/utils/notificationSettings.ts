import { prisma } from './prisma'

export type NotificationKey = 'quotations' | 'orders' | 'order_requests' | 'delivery' | 'vouchers' | 'low_stock'

/**
 * Checks whether an automated push notification type is enabled in SystemSetting.
 * Default values:
 * - quotations: true
 * - orders: true
 * - order_requests: true
 * - delivery: true
 * - vouchers: false
 * - low_stock: false
 */
export async function isNotificationEnabled(key: NotificationKey): Promise<boolean> {
  try {
    const settingKey = `push_notif_${key}`
    const setting = await prisma.systemSetting.findUnique({
      where: { key: settingKey }
    })

    if (!setting) {
      // Sensible defaults
      return ['quotations', 'orders', 'order_requests', 'delivery'].includes(key)
    }

    return setting.value === 'true'
  } catch (err) {
    console.warn(`[isNotificationEnabled] Failed to read setting for ${key}:`, err)
    return true // Safe fallback so vital notifications are not lost
  }
}
