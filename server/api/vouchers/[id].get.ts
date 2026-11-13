import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Voucher ID or Number is required'
    })
  }

  try {
    const voucher = await prisma.busyVoucher.findFirst({
      where: {
        OR: [
          { id },
          { voucherNo: id },
          { voucherNo: { equals: id, mode: 'insensitive' } }
        ]
      }
    })

    if (!voucher) {
      throw createError({
        statusCode: 404,
        statusMessage: `Voucher '${id}' not found`
      })
    }

    let items = (voucher as any).items
    if (!Array.isArray(items)) {
      items = items && typeof items === 'object' ? [items] : []
    }
    // Filter out blank / empty objects like [{}]
    items = items.filter((it: any) => it && typeof it === 'object' && Object.keys(it).length > 0 && it.name)

    // Self-healing fallback: If voucher items are missing, reconstruct from HistoricalPrice
    if (items.length === 0 && voucher.voucherNo) {
      try {
        const histRecords = await prisma.historicalPrice.findMany({
          where: { voucherNo: voucher.voucherNo },
          include: { product: true }
        })

        if (histRecords.length > 0) {
          items = histRecords.map(hp => {
            const qty = Number(hp.quantity) || 1
            const rate = Number(hp.unitPrice) || 0
            const amount = Number(voucher.totalAmount) || (qty * rate)
            const taxable = Number(voucher.taxableAmount) || Math.round((amount / 1.18) * 100) / 100
            const taxAmt = Number(voucher.taxAmount) || Math.round((amount - taxable) * 100) / 100
            const cgstAmt = Number(voucher.cgstAmount) || Math.round((taxAmt / 2) * 100) / 100
            const sgstAmt = Number(voucher.sgstAmount) || Math.round((taxAmt / 2) * 100) / 100

            return {
              name: hp.product?.name || 'Item',
              sku: hp.product?.sku || '',
              hsn: hp.product?.hsnCode || '',
              qty,
              rate,
              amount,
              isTaxInclusive: hp.isTaxInclusive !== false,
              taxableAmount: taxable,
              taxRate: Number(hp.taxRate) || 18,
              taxAmount: taxAmt,
              cgstRate: 9,
              cgstAmount: cgstAmt,
              sgstRate: 9,
              sgstAmount: sgstAmt,
              igstRate: 0,
              igstAmount: 0
            }
          })

          // Asynchronously heal the record in DB so subsequent requests are fast
          prisma.busyVoucher.update({
            where: { id: voucher.id },
            data: { itemCount: items.length, items }
          }).catch(() => {})
        }
      } catch {
        // Fallback silently if lookup fails
      }
    }

    // Profitability & Purchase Intelligence Enrichment
    const names: string[] = items.map((it: any) => it.name).filter(Boolean)
    const skus: string[] = items.map((it: any) => it.sku).filter(Boolean)

    const prodMap = new Map<string, number>()
    if (names.length > 0 || skus.length > 0) {
      try {
        const matchingProds = await prisma.product.findMany({
          where: {
            OR: [
              ...(names.length > 0 ? [{ name: { in: names, mode: 'insensitive' as const } }] : []),
              ...(skus.length > 0 ? [{ sku: { in: skus, mode: 'insensitive' as const } }] : [])
            ]
          },
          select: { name: true, sku: true, costPrice: true }
        })
        for (const p of matchingProds) {
          if (p.costPrice && Number(p.costPrice) > 0) {
            if (p.name) prodMap.set(p.name.toLowerCase().trim(), Number(p.costPrice))
            if (p.sku) prodMap.set(p.sku.toLowerCase().trim(), Number(p.costPrice))
          }
        }
      } catch (prodErr) {
        console.error('Error fetching matching products for cost lookup:', prodErr)
      }
    }

    const purMap = new Map<string, { rate: number; voucherNo: string }>()
    if (names.length > 0) {
      try {
        const rawPurchases = await prisma.$queryRaw<any[]>`
          SELECT DISTINCT ON (LOWER(TRIM(item->>'name')))
            LOWER(TRIM(item->>'name')) as item_name,
            COALESCE((item->>'rate')::numeric, 0) as "purchaseRate",
            p."voucherNo",
            p."voucherDate"
          FROM busy_purchases p,
               jsonb_array_elements(p.items) AS item
          WHERE LOWER(TRIM(item->>'name')) IN (${Prisma.join(names.map(n => n.toLowerCase().trim()))})
          ORDER BY LOWER(TRIM(item->>'name')), p."voucherDate" DESC;
        `
        for (const r of rawPurchases) {
          if (Number(r.purchaseRate) > 0) {
            purMap.set(r.item_name, {
              rate: Number(r.purchaseRate),
              voucherNo: r.voucherNo
            })
          }
        }
      } catch (purErr) {
        console.error('Error matching purchase history for voucher items:', purErr)
      }
    }

    let totalSalesTaxable = 0
    let totalSalesInclusive = 0
    let totalCost = 0
    let totalTax = 0
    let resolvedCount = 0

    const enrichedItems = items.map((item: any) => {
      const normName = (item.name || '').toLowerCase().trim()
      const normSku = (item.sku || '').toLowerCase().trim()

      const purMatch = purMap.get(normName) || (normSku ? purMap.get(normSku) : undefined)
      const prodCost = prodMap.get(normName) || (normSku ? prodMap.get(normSku) : undefined)

      let costPrice: number | null = null
      let costSource: string | null = null

      if (purMatch && purMatch.rate > 0) {
        costPrice = purMatch.rate
        costSource = `Purchase #${purMatch.voucherNo}`
      } else if (prodCost && prodCost > 0) {
        costPrice = prodCost
        costSource = 'Item Master'
      }

      const qty = Number(item.qty) || 0
      const rate = Number(item.rate) || 0
      const itemTotal = Number(item.amount) || (qty * rate)

      // Tax rate determination (defaults to 18% if GST applies on voucher or item)
      const taxRate = Number(item.taxRate) > 0 ? Number(item.taxRate) : (Number(voucher.taxAmount) > 0 ? 18 : 0)

      // In BUSY sales vouchers (e.g. SMG series), item rates and amounts are tax-inclusive
      const isTaxInclusive = item.isTaxInclusive !== false && (Number(voucher.taxAmount) > 0 || item.isTaxInclusive === true)

      // Real Pre-Tax Base Revenue (stripping out customer GST that belongs to the Govt)
      const lineTaxable = isTaxInclusive && taxRate > 0
        ? Math.round((itemTotal / (1 + (taxRate / 100))) * 100) / 100
        : (Number(item.taxableAmount) || itemTotal)
      const lineTax = Math.round((itemTotal - lineTaxable) * 100) / 100

      let lineCost: number | null = null
      let lineProfit: number | null = null
      let lineMargin: number | null = null

      if (costPrice !== null && costPrice > 0) {
        // Guard against unit mismatches (e.g. screws per box vs single piece)
        if (rate > 0 && costPrice / rate > 3) {
          if (costPrice / rate > 500) {
            costPrice = Math.round((costPrice / 1000) * 100) / 100
          } else if (costPrice / rate > 50) {
            costPrice = Math.round((costPrice / 100) * 100) / 100
          } else {
            costPrice = null
          }
        }
      }

      if (costPrice !== null && costPrice > 0) {
        lineCost = Math.round(qty * costPrice * 100) / 100
        // Real in-hand Gross Profit = Base Pre-Tax Revenue - Base Pre-Tax Purchase Cost
        lineProfit = Math.round((lineTaxable - lineCost) * 100) / 100
        lineMargin = lineTaxable > 0 ? Math.round(((lineProfit / lineTaxable) * 100) * 100) / 100 : 0

        totalSalesTaxable += lineTaxable
        totalSalesInclusive += itemTotal
        totalCost += lineCost
        totalTax += lineTax
        resolvedCount++
      }

      return {
        ...item,
        costPrice,
        costSource,
        lineTaxable,
        lineTax,
        lineCost,
        lineProfit,
        lineMargin
      }
    })

    const grossProfit = Math.round((totalSalesTaxable - totalCost) * 100) / 100
    const marginPercent = totalSalesTaxable > 0 ? Math.round(((grossProfit / totalSalesTaxable) * 100) * 100) / 100 : 0

    const profitability = {
      totalSales: Math.round(totalSalesTaxable * 100) / 100, // Pre-tax taxable sales revenue
      totalSalesInclusive: Math.round(totalSalesInclusive * 100) / 100, // Gross sales bill incl. GST
      totalCost: Math.round(totalCost * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grossProfit,
      marginPercent,
      resolvedCount,
      totalCount: items.length,
      hasCostData: resolvedCount > 0
    }

    if (profitability.hasCostData) {
      prisma.busyVoucher.update({
        where: { id: voucher.id },
        data: { grossProfit, marginPercent }
      }).catch(() => {})
    }

    const normalizedVoucher = {
      ...voucher,
      items: enrichedItems,
      itemCount: enrichedItems.length
    }

    return {
      success: true,
      voucher: normalizedVoucher,
      profitability
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('Error fetching voucher detail:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to fetch voucher detail'
    })
  }
})
