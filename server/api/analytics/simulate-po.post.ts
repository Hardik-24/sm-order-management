import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { simulatePurchaseOrder } from '~~/server/utils/intelligenceEngine'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)

  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload: "items" array is required.'
    })
  }

  try {
    const result = await simulatePurchaseOrder(body.items)
    return result
  } catch (error: any) {
    console.error('Failed to simulate draft purchase order:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `PO Simulator Error: ${error?.message || error}`
    })
  }
})
