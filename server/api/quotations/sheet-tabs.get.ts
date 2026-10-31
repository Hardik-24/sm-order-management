import { defineEventHandler } from 'h3'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { createGoogleAuth, getGoogleSheetId } from '~~/server/utils/googleAuth'
import { requireAuth } from '~~/server/utils/auth'
import { getConfiguredQuotationTabs } from '~~/server/utils/sheetCatalog'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const authWrapper = createGoogleAuth()
  if (!authWrapper) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google Service Account credentials not configured.'
    })
  }

  const sheetId = getGoogleSheetId()
  const doc = new GoogleSpreadsheet(sheetId, authWrapper.auth)
  await doc.loadInfo()

  const allTabs: Array<{
    sheetId: number
    title: string
    rowCount: number
    columnCount: number
    index: number
  }> = []

  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i]
    allTabs.push({
      sheetId: s.sheetId,
      title: s.title,
      rowCount: s.rowCount,
      columnCount: s.columnCount,
      index: i
    })
  }

  const configuredTabs = await getConfiguredQuotationTabs()

  return {
    success: true,
    sheetTitle: doc.title,
    sheetId,
    allTabs,
    configuredTabs
  }
})
