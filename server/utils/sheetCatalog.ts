import { prisma } from './prisma'

export const DEFAULT_QUOTATION_TABS = ['2026JULY', '2026APRIL', '2026FEB', '2025NOV']
const SETTINGS_KEY = 'google_sheets_quotation_tabs'

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
  sourceTab?: string
}

let cachedProducts: SheetProductItem[] | null = null
let lastSyncedAt: number = 0
let lastSyncSource: string = 'none'
let lastBreakdown: Record<string, number> = {}

export async function getConfiguredQuotationTabs(): Promise<string[]> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY }
    })
    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(t => typeof t === 'string' && t.trim() !== '')
      }
    }
  } catch (err: any) {
    console.warn('[SheetCatalog] Could not load configured tabs from DB:', err?.message)
  }
  return [...DEFAULT_QUOTATION_TABS]
}

export async function saveConfiguredQuotationTabs(tabs: string[]): Promise<string[]> {
  const cleanTabs = tabs.filter(t => typeof t === 'string' && t.trim() !== '')
  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(cleanTabs) },
    update: { value: JSON.stringify(cleanTabs) }
  })
  clearSheetCatalogCache()
  return cleanTabs
}

export function getSheetCatalogCache() {
  return {
    cachedProducts,
    lastSyncedAt,
    lastSyncSource,
    lastBreakdown
  }
}

export function setSheetCatalogCache(
  products: SheetProductItem[],
  syncSource: string,
  breakdown: Record<string, number> = {}
) {
  cachedProducts = products
  lastSyncedAt = Date.now()
  lastSyncSource = syncSource
  lastBreakdown = breakdown
}

export function clearSheetCatalogCache() {
  cachedProducts = null
  lastSyncedAt = 0
  lastSyncSource = 'none'
  lastBreakdown = {}
}
