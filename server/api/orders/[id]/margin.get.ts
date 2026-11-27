import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  // 1. Strictly enforce ADMIN role: non-admins cannot access purchase pricing or margins
  requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id') || event.context.params?.id

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Order ID is required'
    })
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                costPrice: true,
                price: true,
                unit: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      throw createError({
        statusCode: 404,
        statusMessage: `Order '${id}' not found`
      })
    }

    const items = order.items || []

    // 2. Collect item names and skus for latest purchase cost lookup in busy_purchases
    const names: string[] = []
    const skus: string[] = []
    for (const it of items) {
      if (it.productName) names.push(it.productName.trim())
      if (it.product?.name) names.push(it.product.name.trim())
      if (it.sku) skus.push(it.sku.trim())
      if (it.product?.sku) skus.push(it.product.sku.trim())
    }
    const uniqueNames = Array.from(new Set(names.filter(Boolean)))

    // 3. Query busy_purchases for latest pre-tax purchase rate
    const purMap = new Map<string, { rate: number; voucherNo: string }>()
    if (uniqueNames.length > 0) {
      try {
        const rawPurchases = await prisma.$queryRaw<any[]>`
          SELECT DISTINCT ON (LOWER(TRIM(item->>'name')))
            LOWER(TRIM(item->>'name')) as item_name,
            COALESCE((item->>'rate')::numeric, 0) as "rate",
            COALESCE((item->>'taxableAmount')::numeric, 0) as "taxableAmount",
            COALESCE((item->>'qty')::numeric, 0) as "qty",
            COALESCE((item->>'taxRate')::numeric, 0) as "taxRate",
            COALESCE((item->>'isTaxInclusive')::boolean, false) as "isTaxInclusive",
            p."voucherNo",
            p."voucherDate"
          FROM busy_purchases p,
               jsonb_array_elements(p.items) AS item
          WHERE LOWER(TRIM(item->>'name')) IN (${Prisma.join(uniqueNames.map(n => n.toLowerCase()))})
          ORDER BY LOWER(TRIM(item->>'name')), p."voucherDate" DESC;
        `
        for (const r of rawPurchases) {
          const q = Number(r.qty) || 0
          const origRate = Number(r.rate) || 0
          const taxable = Number(r.taxableAmount) || 0
          const amt = Number(r.amount) || 0
          const tRate = Number(r.taxRate) || 0
          const isInc = Boolean(r.isTaxInclusive)

          // Pre-tax rate extraction
          let pretaxRate = origRate
          if (taxable > 0 && q > 0 && isInc && taxable < amt) {
            pretaxRate = Number((taxable / q).toFixed(2))
          } else if (isInc && tRate > 0 && taxable < amt) {
            pretaxRate = Number((origRate / (1 + (tRate / 100))).toFixed(2))
          }

          if (pretaxRate > 0) {
            purMap.set(r.item_name, {
              rate: pretaxRate,
              voucherNo: r.voucherNo
            })
          }
        }
      } catch (purErr) {
        console.error('Error matching purchase history for order items:', purErr)
      }
    }

    const isSheetOrPanel = (name: string) => {
      const n = (name || '').toLowerCase()
      return n.includes('ply') || n.includes('relw') || n.includes('mdf') || n.includes('mdp') ||
             n.includes('laminate') || n.includes('pvc') || n.includes('door') || n.includes('acrylic') ||
             n.includes('charcoal') || n.includes('louver') || n.includes('wig') || n.includes('board') ||
             n.includes('veneer') || n.includes('sheet')
    }

    const isSmallHardware = (name: string) => {
      const n = (name || '').toLowerCase()
      return n.includes('screw') || n.includes('nail') || n.includes('fastener') || n.includes('washer') || n.includes('rivet')
    }

    let totalNetSalePretax = 0
    let totalPurchaseCost = 0
    let totalGovtGst = 0
    let totalAmount = 0
    let totalGrossProfit = 0
    let resolvedCount = 0

    const enrichedItems = items.map((item) => {
      const qty = item.approvedQuantity != null ? Number(item.approvedQuantity) : Number(item.quantity)
      const unitPrice = Number(item.unitPrice) || 0
      const taxRate = Number(item.taxRate) || 0
      const isTaxInclusive = Boolean(item.isTaxInclusive)

      let pretaxSellingRate = unitPrice
      let lineNetSalePretax = 0
      let lineGovtGst = 0
      let lineTotal = 0

      if (isTaxInclusive && taxRate > 0) {
        lineTotal = Math.round(qty * unitPrice * 100) / 100
        pretaxSellingRate = Number((unitPrice / (1 + (taxRate / 100))).toFixed(2))
        lineNetSalePretax = Math.round((lineTotal / (1 + (taxRate / 100))) * 100) / 100
        lineGovtGst = Math.round((lineTotal - lineNetSalePretax) * 100) / 100
      } else {
        pretaxSellingRate = unitPrice
        lineNetSalePretax = Math.round(qty * unitPrice * 100) / 100
        lineGovtGst = Math.round(lineNetSalePretax * (taxRate / 100) * 100) / 100
        lineTotal = Math.round((lineNetSalePretax + lineGovtGst) * 100) / 100
      }

      // Resolve Cost Price
      const normName = (item.productName || item.product?.name || '').toLowerCase().trim()
      const normSku = (item.sku || item.product?.sku || '').toLowerCase().trim()

      const purMatch = purMap.get(normName) || (normSku ? purMap.get(normSku) : undefined)
      const prodCost = item.product?.costPrice ? Number(item.product.costPrice) : null

      let purchaseRate: number | null = null
      let costSource: string | null = null

      if (purMatch && purMatch.rate > 0) {
        purchaseRate = purMatch.rate
        costSource = `Purchase #${purMatch.voucherNo}`
      } else if (prodCost && prodCost > 0) {
        purchaseRate = prodCost
        costSource = 'Item Master'
      }

      // Safeguard against unit ratio mismatch (e.g. bulk box cost vs single item selling)
      if (purchaseRate !== null && purchaseRate > 0 && pretaxSellingRate > 0 && (purchaseRate / pretaxSellingRate) > 3) {
        if (isSheetOrPanel(item.productName) || (item.product && Number(item.product.price) > 100)) {
          // Keep true cost for sheet goods or high-value items
        } else if (isSmallHardware(item.productName)) {
          if (purchaseRate / pretaxSellingRate > 500) {
            purchaseRate = Math.round((purchaseRate / 1000) * 100) / 100
          } else if (purchaseRate / pretaxSellingRate > 50) {
            purchaseRate = Math.round((purchaseRate / 100) * 100) / 100
          } else {
            purchaseRate = null
          }
        } else if (purchaseRate / pretaxSellingRate > 50) {
          purchaseRate = null
        }
      }

      let linePurchaseCost: number | null = null
      let lineProfit: number | null = null
      let lineMarginPercent: number | null = null

      if (purchaseRate !== null && purchaseRate > 0) {
        linePurchaseCost = Math.round(qty * purchaseRate * 100) / 100
        lineProfit = Math.round((lineNetSalePretax - linePurchaseCost) * 100) / 100
        lineMarginPercent = lineNetSalePretax > 0 ? Math.round(((lineProfit / lineNetSalePretax) * 100) * 100) / 100 : 0

        totalPurchaseCost += linePurchaseCost
        totalGrossProfit += lineProfit
        resolvedCount++
      }

      totalNetSalePretax += lineNetSalePretax
      totalGovtGst += lineGovtGst
      totalAmount += lineTotal

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName || item.product?.name || 'Item',
        sku: item.sku || item.product?.sku || '',
        unit: item.product?.unit || 'PCS',
        qty,
        unitPrice,
        pretaxSellingRate,
        isTaxInclusive,
        taxRate,
        netSalePretax: lineNetSalePretax,
        govtGst: lineGovtGst,
        totalAmount: lineTotal,
        purchaseRate,
        purchaseCost: linePurchaseCost,
        costSource,
        grossProfit: lineProfit,
        marginPercent: lineMarginPercent
      }
    })

    const grossProfit = Math.round(totalGrossProfit * 100) / 100
    const rawMargin = totalNetSalePretax > 0 ? Math.round(((grossProfit / totalNetSalePretax) * 100) * 100) / 100 : 0
    const marginPercent = Math.min(999.99, Math.max(-999.99, rawMargin))

    const summary = {
      grossProfit,
      marginPercent,
      netSalePretax: Math.round(totalNetSalePretax * 100) / 100,
      purchaseCost: Math.round(totalPurchaseCost * 100) / 100,
      govtGst: Math.round(totalGovtGst * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      resolvedCount,
      totalCount: items.length,
      hasCostData: resolvedCount > 0
    }

    return {
      success: true,
      summary,
      items: enrichedItems
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('Error calculating order margin:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to calculate order margin'
    })
  }
})
