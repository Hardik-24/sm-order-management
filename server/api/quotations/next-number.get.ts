import { defineEventHandler } from 'h3'
import { getPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'
import { generateSequentialQuoteNumber } from '~~/server/utils/seriesNumber'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const p = getPrisma()
  const { quoteNumber } = await generateSequentialQuoteNumber(p)
  return { success: true, nextNumber: quoteNumber }
})
