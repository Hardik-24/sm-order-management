import { defineEventHandler } from 'h3'
import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Strictly Admin-Only
  requireRole(event, ['ADMIN'])

  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: 'tally_receivables_data' }
    })

    if (!record || !record.value) {
      return {
        success: true,
        data: null,
        message: 'No Tally receivables data synced yet.'
      }
    }

    const parsed = JSON.parse(record.value)
    return {
      success: true,
      data: parsed
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch Tally receivables'
    }
  }
})
