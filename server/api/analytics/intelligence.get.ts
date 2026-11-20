import { defineEventHandler, getQuery, createError } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { calculateIntelligence } from '~~/server/utils/intelligenceEngine'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const isRefresh = query.refresh === 'true' || query.refresh === '1'

  try {
    const data = await calculateIntelligence(isRefresh)
    return data
  } catch (error: any) {
    console.error('Failed to calculate distribution intelligence:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Intelligence Engine Error: ${error?.message || error}`
    })
  }
})
