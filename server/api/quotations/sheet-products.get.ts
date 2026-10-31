import { defineEventHandler, getQuery, createError } from 'h3'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { createGoogleAuth, getGoogleSheetId, setSheetLastSyncedAt } from '~~/server/utils/googleAuth'
import fallbackProducts from '~~/server/data/sheet-products-fallback.json'
import { requireAuth } from '~~/server/utils/auth'
import {
  type SheetProductItem,
  getConfiguredQuotationTabs,
  getSheetCatalogCache,
  setSheetCatalogCache
} from '~~/server/utils/sheetCatalog'

let isFetching = false
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)
  const force = query.force === 'true' || query.force === '1'

  const cache = getSheetCatalogCache()
  const now = Date.now()

  if (!force && cache.cachedProducts && (now - cache.lastSyncedAt < CACHE_TTL_MS)) {
    return {
      success: true,
      fromCache: true,
      isFallback: cache.lastSyncSource === 'fallback',
      lastSyncedAt: new Date(cache.lastSyncedAt).toISOString(),
      count: cache.cachedProducts.length,
      breakdown: cache.lastBreakdown,
      products: cache.cachedProducts
    }
  }

  // Prevent duplicate simultaneous fetches
  if (isFetching && cache.cachedProducts) {
    return {
      success: true,
      fromCache: true,
      isFallback: cache.lastSyncSource === 'fallback',
      lastSyncedAt: new Date(cache.lastSyncedAt).toISOString(),
      count: cache.cachedProducts.length,
      breakdown: cache.lastBreakdown,
      products: cache.cachedProducts
    }
  }

  isFetching = true
  try {
    const authWrapper = createGoogleAuth()

    if (!authWrapper) {
      console.warn('[Google Sheets] No credentials found in environment or local file.')
      if (fallbackProducts && fallbackProducts.length > 0) {
        setSheetCatalogCache(fallbackProducts as SheetProductItem[], 'fallback')
        setSheetLastSyncedAt(Date.now())
        return {
          success: true,
          fromCache: true,
          isFallback: true,
          fallbackNotice: 'Using bundled catalog fallback. Set GOOGLE_SERVICE_ACCOUNT_KEY in Vercel to sync live from Google Sheet.',
          lastSyncedAt: new Date().toISOString(),
          count: fallbackProducts.length,
          products: fallbackProducts
        }
      }
      throw new Error('Google Service Account credentials missing. Please set GOOGLE_SERVICE_ACCOUNT_KEY in Vercel project environment variables.')
    }

    const sheetId = getGoogleSheetId()
    const doc = new GoogleSpreadsheet(sheetId, authWrapper.auth)
    await doc.loadInfo()

    const configuredTabs = await getConfiguredQuotationTabs()
    const productMap = new Map<string, SheetProductItem>()
    const breakdown: Record<string, number> = {}

    // Reverse configured tabs so oldest runs first and newest overwrites it
    const tabsOldestFirst = [...configuredTabs].reverse()

    for (const tabTitle of tabsOldestFirst) {
      const sheet = doc.sheetsByTitle[tabTitle]
      if (!sheet) {
        console.warn(`[Google Sheets] Tab "${tabTitle}" not found in sheet "${doc.title}", skipping.`)
        continue
      }

      try {
        await sheet.loadHeaderRow()
        const rows = await sheet.getRows()

        for (const r of rows) {
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

          const rawMrp = getVal('MRP', 'Mrp', 'Price').replace(/[^0-9.]/g, '')
          const mrp = parseFloat(rawMrp) || 0

          const moq = parseInt(getVal('MOQ', 'Moq', 'MOQ ') || '1', 10) || 1
          const gstRate = parseFloat(getVal('GST', 'Gst', 'Tax') || '18') || 18
          const defaultDiscount = parseFloat(getVal('DISCOUNT', 'Discount', 'Disc') || '0') || 0

          const stock = getVal('QNTY', 'Stock', 'STOCK', 'Qty', 'Quantity', 'Stock Qty') || getVal('Flag', 'FLAG') || ''
          const flag = getVal('Flag', 'FLAG') || ''

          const key = art.toUpperCase().trim()

          productMap.set(key, {
            articleNumber: art,
            description: desc,
            brand,
            mrp,
            uom,
            moq,
            gstRate,
            defaultDiscount,
            stock,
            flag,
            sourceTab: tabTitle
          })
        }
      } catch (tabErr: any) {
        console.error(`[Google Sheets] Error reading tab "${tabTitle}":`, tabErr.message)
      }
    }

    const mergedProducts = Array.from(productMap.values())

    // Compute winning breakdown by sourceTab
    for (const p of mergedProducts) {
      const tab = p.sourceTab || 'unknown'
      breakdown[tab] = (breakdown[tab] || 0) + 1
    }

    setSheetCatalogCache(mergedProducts, authWrapper.credentials.source, breakdown)
    setSheetLastSyncedAt(Date.now())

    return {
      success: true,
      fromCache: false,
      isFallback: false,
      syncSource: authWrapper.credentials.source,
      lastSyncedAt: new Date().toISOString(),
      count: mergedProducts.length,
      breakdown,
      configuredTabs,
      products: mergedProducts
    }
  } catch (err: any) {
    console.error('Failed to fetch products from Google Sheet:', err)

    if (cache.cachedProducts && cache.cachedProducts.length > 0) {
      return {
        success: true,
        fromCache: true,
        isFallback: cache.lastSyncSource === 'fallback',
        fallbackNotice: `Using cached data due to fetch error: ${err.message}`,
        lastSyncedAt: new Date(cache.lastSyncedAt).toISOString(),
        count: cache.cachedProducts.length,
        breakdown: cache.lastBreakdown,
        products: cache.cachedProducts
      }
    }

    if (fallbackProducts && fallbackProducts.length > 0) {
      setSheetCatalogCache(fallbackProducts as SheetProductItem[], 'fallback')
      return {
        success: true,
        fromCache: true,
        isFallback: true,
        fallbackNotice: `Using bundled catalog fallback due to fetch error: ${err.message}`,
        lastSyncedAt: new Date().toISOString(),
        count: fallbackProducts.length,
        products: fallbackProducts
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
