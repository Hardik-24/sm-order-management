import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)

  const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom.trim() : ''
  const dateTo = typeof query.dateTo === 'string' ? query.dateTo.trim() : ''

  const where: any = {}
  if (dateFrom || dateTo) {
    where.voucherDate = {}
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`)
    if (dateTo) where.voucherDate.lte = new Date(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`)
  }

  try {
    const [totalPurchases, aggregates, allPurchases] = await Promise.all([
      prisma.busyPurchase.count({ where }),
      prisma.busyPurchase.aggregate({
        where,
        _sum: {
          totalAmount: true,
          taxableAmount: true,
          taxAmount: true
        },
        _avg: {
          totalAmount: true
        }
      }),
      prisma.busyPurchase.findMany({
        where,
        select: {
          supplierName: true,
          totalAmount: true,
          voucherDate: true
        }
      })
    ])

    // Top suppliers
    const supplierMap = new Map<string, { count: number; totalAmount: number }>()
    const monthlyMap = new Map<string, { count: number; totalAmount: number }>()

    for (const p of allPurchases) {
      const sName = p.supplierName || 'Unknown'
      const amt = Number(p.totalAmount) || 0

      // Supplier grouping
      const existing = supplierMap.get(sName) || { count: 0, totalAmount: 0 }
      existing.count += 1
      existing.totalAmount += amt
      supplierMap.set(sName, existing)

      // Monthly grouping (YYYY-MM)
      const d = new Date(p.voucherDate)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mExisting = monthlyMap.get(monthKey) || { count: 0, totalAmount: 0 }
      mExisting.count += 1
      mExisting.totalAmount += amt
      monthlyMap.set(monthKey, mExisting)
    }

    const topSuppliers = Array.from(supplierMap.entries())
      .map(([name, data]) => ({
        supplierName: name,
        invoiceCount: data.count,
        totalAmount: Math.round(data.totalAmount * 100) / 100
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)

    const monthlyTrends = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        invoiceCount: data.count,
        totalAmount: Math.round(data.totalAmount * 100) / 100
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return {
      totalCount: totalPurchases,
      totalAmount: Math.round(Number(aggregates._sum.totalAmount || 0) * 100) / 100,
      totalTaxable: Math.round(Number(aggregates._sum.taxableAmount || 0) * 100) / 100,
      totalTax: Math.round(Number(aggregates._sum.taxAmount || 0) * 100) / 100,
      averageInvoiceValue: Math.round(Number(aggregates._avg.totalAmount || 0) * 100) / 100,
      topSuppliers,
      monthlyTrends
    }
  } catch (err: any) {
    console.error('Failed to compute purchase statistics:', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to compute purchase analytics'
    })
  }
})
