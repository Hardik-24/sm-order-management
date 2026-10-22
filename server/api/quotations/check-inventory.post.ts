import { defineEventHandler, readBody } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'

export interface InventoryCheckRequest {
  items: Array<{
    articleNumber: string
    quantity: number
  }>
}

export interface InventoryItemStatus {
  articleNumber: string
  existsInDb: boolean
  stock: number
  inStock: boolean // true if exists and stock >= quantity and stock > 0
  status: 'IN_STOCK' | 'AGAINST_ORDER'
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<InventoryCheckRequest>(event)
    const items = body?.items || []

    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, results: {} }
    }

    const requestedSkus = items
      .map(it => String(it.articleNumber || '').trim())
      .filter(art => art && art !== '.' && art !== '-')

    if (requestedSkus.length === 0) {
      return { success: true, results: {} }
    }

    let p = getPrisma()
    let dbProducts: Array<{ sku: string, stock: number, isActive: boolean }> = []

    try {
      dbProducts = await p.product.findMany({
        where: {
          sku: { in: requestedSkus, mode: 'insensitive' }
        },
        select: {
          sku: true,
          stock: true,
          isActive: true
        }
      })
    } catch (dbErr: any) {
      console.warn('Initial DB check failed, resetting prisma connection pool...', dbErr?.message)
      p = resetPrisma()
      dbProducts = await p.product.findMany({
        where: {
          sku: { in: requestedSkus, mode: 'insensitive' }
        },
        select: {
          sku: true,
          stock: true,
          isActive: true
        }
      })
    }

    // Map by lowercased SKU and clean alphanumeric SKU
    const productMap = new Map<string, { stock: number, isActive: boolean }>()
    for (const prod of dbProducts) {
      const lower = prod.sku.trim().toLowerCase()
      const clean = lower.replace(/[^a-z0-9]/g, '')
      const entry = {
        stock: Number(prod.stock || 0),
        isActive: prod.isActive
      }
      productMap.set(lower, entry)
      if (clean) productMap.set(clean, entry)
    }

    // Build results for each requested item
    const results: Record<string, InventoryItemStatus> = {}

    for (const item of items) {
      const art = String(item.articleNumber || '').trim()
      const reqQty = Number(item.quantity || 1)
      const lowerKey = art.toLowerCase()
      const cleanKey = lowerKey.replace(/[^a-z0-9]/g, '')

      const found = productMap.get(lowerKey) || (cleanKey ? productMap.get(cleanKey) : undefined)
      if (found) {
        const inStock = found.stock >= reqQty && found.stock > 0
        results[art] = {
          articleNumber: art,
          existsInDb: true,
          stock: found.stock,
          inStock,
          status: inStock ? 'IN_STOCK' : 'AGAINST_ORDER'
        }
      } else {
        // Not found in Supabase DB -> against order
        results[art] = {
          articleNumber: art,
          existsInDb: false,
          stock: 0,
          inStock: false,
          status: 'AGAINST_ORDER'
        }
      }
    }

    return {
      success: true,
      results
    }
  } catch (err: any) {
    console.error('Error checking inventory for quotations:', err)
    return {
      success: false,
      error: err.message || 'Failed to check inventory',
      results: {}
    }
  }
})
