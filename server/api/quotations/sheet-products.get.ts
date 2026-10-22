import { defineEventHandler, getQuery } from 'h3'
import { JWT } from 'google-auth-library'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import fs from 'fs'
import path from 'path'

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
      lastSyncedAt: new Date(lastSyncedAt).toISOString(),
      count: cachedProducts.length,
      products: cachedProducts
    }
  }

  isFetching = true
  try {
    const credsPath = path.resolve(process.cwd(), 'google-service-account.json')
    if (!fs.existsSync(credsPath)) {
      throw new Error('google-service-account.json credentials file not found in project root')
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
    const auth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    })

    const sheetId = process.env.GOOGLE_SHEET_ID || '124p_ZVSTqLTkIs9o04-7BsJjDH6SLFFabArHW9UQ7FI'
    const doc = new GoogleSpreadsheet(sheetId, auth)

    await doc.loadInfo()
    const sheet = doc.sheetsByIndex[0]
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

    return {
      success: true,
      fromCache: false,
      lastSyncedAt: new Date(lastSyncedAt).toISOString(),
      count: parsed.length,
      products: parsed
    }
  } catch (err: any) {
    console.error('Failed to fetch products from Google Sheet:', err)
    if (cachedProducts) {
      return {
        success: true,
        fromCache: true,
        fallbackNotice: 'Used fallback cached data due to fetch error',
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
