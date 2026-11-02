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

    return {
      quotationAnonymousMode: map['quotation_anonymous_mode'] === 'true'
    }
  } catch (error: any) {
    console.error('[Settings GET] Error fetching system settings:', error)
    return {
      quotationAnonymousMode: false
    }
  }
})
