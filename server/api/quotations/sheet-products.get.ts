import { defineEventHandler, getQuery } from 'h3'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { createGoogleAuth, getGoogleSheetId } from '~~/server/utils/googleAuth'
import fallbackProducts from '~~/server/data/sheet-products-fallback.json'

export interface SheetProductItem {
  articleNumber: string
  description: string
  brand: string
  mrp: number
  uom: string
  moq: number
  gstRate: number
  defaultDiscount: number
  stock: string
  flag: string
}

// In-memory server cache
let cachedProducts: SheetProductItem[] | null = null
let lastSyncedAt: number = 0
let lastSyncSource: string = 'none'
let isFetching = false
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const force = query.force === 'true' || query.force === '1'

  const now = Date.now()
  if (!force && cachedProducts && (now - lastSyncedAt < CACHE_TTL_MS)) {
    return {
      success: true,
      fromCache: true,
      isFallback: lastSyncSource === 'fallback',
      lastSyncedAt: new Date(lastSyncedAt).toISOString(),
      count: cachedProducts.length,
      products: cachedProducts
    }
  }

  // Prevent duplicate simultaneous fetches
  if (isFetching && cachedProducts) {
    return {
      success: true,
      fromCache: true,
      isFallback: lastSyncSource === 'fallback',
      lastSyncedAt: new Date(lastSyncedAt).toISOString(),
      count: cachedProducts.length,
      products: cachedProducts
    }
  }

  isFetching = true
  try {
    const authWrapper = createGoogleAuth()

    if (!authWrapper) {
      console.warn('[Google Sheets] No credentials found in environment or local file.')
      if (fallbackProducts && fallbackProducts.length > 0) {
        cachedProducts = fallbackProducts as SheetProductItem[]
        lastSyncedAt = Date.now()
        lastSyncSource = 'fallback'
        return {
          success: true,
          fromCache: true,
          isFallback: true,
          fallbackNotice: 'Using bundled catalog fallback. Set GOOGLE_SERVICE_ACCOUNT_KEY in Vercel to sync live from Google Sheet.',
          lastSyncedAt: new Date(lastSyncedAt).toISOString(),
          count: cachedProducts.length,
          products: cachedProducts
        }
      }
      throw new Error('Google Service Account credentials missing. Please set GOOGLE_SERVICE_ACCOUNT_KEY in Vercel project environment variables.')
    }

    const sheetId = getGoogleSheetId()
    const doc = new GoogleSpreadsheet(sheetId, authWrapper.auth)

    await doc.loadInfo()
    const sheet = doc.sheetsByIndex[0]
    if (!sheet) {
      throw new Error(`No sheets found in Google Spreadsheet ID: ${sheetId}`)
    }

    await sheet.loadHeaderRow()
    const rows = await sheet.getRows()

    const parsed: SheetProductItem[] = []

    for (const r of rows) {
      // Helper to search across possible header names
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          const v = r.get(k)
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim()
          }
        }
        return ''
      }

      const art = getVal('Article Number', 'Article No', 'Article No.', 'Article')
      if (!art || art === '.' || art === '-') continue

      const desc = getVal('Description', 'Product Description', 'Desc')
      const brand = getVal('BRAND', 'Brand') || 'HFL'
      const uom = getVal('UoM', 'UOM', 'Unit') || 'PC'
      
      // Clean MRP string (handles commas, spaces, currency symbols like ₹)
      const rawMrp = getVal('MRP', 'Mrp', 'Price').replace(/[^0-9.]/g, '')
      const mrp = parseFloat(rawMrp) || 0

      const moq = parseInt(getVal('MOQ', 'Moq', 'MOQ ') || '1', 10) || 1
      const gstRate = parseFloat(getVal('GST', 'Gst', 'Tax') || '18') || 18
      const defaultDiscount = parseFloat(getVal('DISCOUNT', 'Discount', 'Disc') || '0') || 0
      
      // Stock from QNTY or Stock col, with fallback to Flag (e.g. STOCK / TILL STOCK LAST)
      const stock = getVal('QNTY', 'Stock', 'STOCK', 'Qty', 'Quantity', 'Stock Qty') || getVal('Flag', 'FLAG') || ''
      const flag = getVal('Flag', 'FLAG') || ''

      parsed.push({
        articleNumber: art,
        description: desc,
        brand,
        mrp,
        uom,
        moq,
        gstRate,
        defaultDiscount,
        stock,
        flag
      })
    }

    cachedProducts = parsed
    lastSyncedAt = Date.now()
    lastSyncSource = authWrapper.credentials.source

    return {
      success: true,
      fromCache: false,
      isFallback: false,
      syncSource: lastSyncSource,
      lastSyncedAt: new Date(lastSyncedAt).toISOString(),
      count: parsed.length,
      products: parsed
    }
  } catch (err: any) {
    console.error('Failed to fetch products from Google Sheet:', err)

    if (cachedProducts && cachedProducts.length > 0) {
      return {
        success: true,
        fromCache: true,
        isFallback: lastSyncSource === 'fallback',
        fallbackNotice: `Using cached data due to fetch error: ${err.message}`,
        lastSyncedAt: new Date(lastSyncedAt).toISOString(),
        count: cachedProducts.length,
        products: cachedProducts
      }
    }

    if (fallbackProducts && fallbackProducts.length > 0) {
      cachedProducts = fallbackProducts as SheetProductItem[]
      lastSyncedAt = Date.now()
      lastSyncSource = 'fallback'
      return {
        success: true,
        fromCache: true,
        isFallback: true,
        fallbackNotice: `Using bundled catalog fallback due to fetch error: ${err.message}`,
        lastSyncedAt: new Date(lastSyncedAt).toISOString(),
        count: cachedProducts.length,
        products: cachedProducts
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load Google Sheet catalog: ${err.message}`
    })
  } finally {
    isFetching = false
  }
})
