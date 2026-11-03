import { prisma } from './prisma'

export type NotificationKey = 'quotations' | 'orders' | 'order_requests' | 'delivery'

/**
 * Checks whether an automated push notification type is enabled in SystemSetting.
 * Default values: all default to TRUE.
 */
export async function isNotificationEnabled(key: NotificationKey): Promise<boolean> {
  try {
    const settingKey = `push_notif_${key}`
    const setting = await prisma.systemSetting.findUnique({
      where: { key: settingKey }
    })

    if (!setting) {
      return true
    }

    return setting.value === 'true'
  } catch (err) {
    console.warn(`[isNotificationEnabled] Failed to read setting for ${key}:`, err)
    return true
  }
}
