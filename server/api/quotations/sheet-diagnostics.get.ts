import { defineEventHandler } from 'h3'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { createGoogleAuth, getGoogleSheetId, getGoogleCredentials } from '~~/server/utils/googleAuth'

export default defineEventHandler(async (event) => {
  const sheetId = getGoogleSheetId()
  const creds = getGoogleCredentials()

  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    configured: !!creds,
    credentialSource: creds ? creds.source : 'None found',
    clientEmail: creds ? creds.email : null,
    sheetId,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    canConnect: false,
    spreadsheetTitle: null,
    rowCount: 0,
    columns: [],
    error: null,
    recommendation: null
  }

  if (!creds) {
    result.error = 'No Google Service Account credentials found.'
    result.recommendation = 'In Vercel Project Settings -> Environment Variables, add GOOGLE_SERVICE_ACCOUNT_KEY with the JSON content of google-service-account.json.'
    return result
  }

  try {
    const authWrapper = createGoogleAuth()
    if (!authWrapper) {
      throw new Error('Could not create Google Auth JWT.')
    }

    const doc = new GoogleSpreadsheet(sheetId, authWrapper.auth)
    await doc.loadInfo()

    result.canConnect = true
    result.spreadsheetTitle = doc.title

    const sheet = doc.sheetsByIndex[0]
    if (sheet) {
      result.sheetTitle = sheet.title
      result.rowCount = sheet.rowCount
      await sheet.loadHeaderRow()
      result.columns = sheet.headerValues || []
    }

    result.status = 'READY'
    result.message = 'Google Sheets connection verified and operational.'
  } catch (err: any) {
    result.canConnect = false
    result.error = err.message || String(err)
    if (String(err.message).includes('403') || String(err.message).includes('permission')) {
      result.recommendation = `The service account ${creds.email} does not have Viewer access to the Google Sheet. Please share the sheet with ${creds.email}.`
    } else if (String(err.message).includes('DECODER') || String(err.message).includes('key')) {
      result.recommendation = 'The private key format in GOOGLE_SERVICE_ACCOUNT_KEY is invalid. Ensure all newlines are preserved.'
    } else {
      result.recommendation = 'Verify the Google Sheet ID and service account credentials.'
    }
  }

  return result
})
