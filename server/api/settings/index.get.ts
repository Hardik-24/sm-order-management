import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  try {
    const settings = await prisma.systemSetting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) {
      map[s.key] = s.value
    }

    // Support both new key push_notif_storefront_requests and legacy push_notif_order_requests
    const storefrontSetting = map['push_notif_storefront_requests'] ?? map['push_notif_order_requests']

    return {
      quotationAnonymousMode: map['quotation_anonymous_mode'] === 'true',
      notifications: {
        storefrontRequests: storefrontSetting !== 'false', // Default true
        quotations: map['push_notif_quotations'] !== 'false', // Default true
        orders: map['push_notif_orders'] !== 'false', // Default true
        orderApprovals: map['push_notif_order_approvals'] !== 'false', // Default true
        packing: map['push_notif_packing'] === 'true', // Default false
        delivery: map['push_notif_delivery'] !== 'false' // Default true
      }
    }
  } catch (error: any) {
    console.error('[Settings GET] Error fetching system settings:', error)
    return {
      quotationAnonymousMode: false,
      notifications: {
        storefrontRequests: true,
        quotations: true,
        orders: true,
        orderApprovals: true,
        packing: false,
        delivery: true
      }
    }
  }
})
