import { defineEventHandler, readBody, createError } from 'h3'
import { requireRole } from '~~/server/utils/auth'
import { saveConfiguredQuotationTabs } from '~~/server/utils/sheetCatalog'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])

  const body = await readBody(event)
  if (!body || !Array.isArray(body.tabs)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload: "tabs" array is required.'
    })
  }

  const updatedTabs = await saveConfiguredQuotationTabs(body.tabs)

  return {
    success: true,
    configuredTabs: updatedTabs
  }
})
