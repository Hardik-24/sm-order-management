import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { buildMultiTokenPrismaOr } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)

  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const series = typeof query.series === 'string' ? query.series.trim() : 'ALL'
  const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom.trim() : ''
  const dateTo = typeof query.dateTo === 'string' ? query.dateTo.trim() : ''
  const supplierCode = typeof query.supplierCode === 'string' ? query.supplierCode.trim() : ''

  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25))
  const skip = (page - 1) * limit

  const where: any = {}

  if (series && series !== 'ALL') {
    where.series = series
  }

  if (supplierCode) {
    where.supplierCode = supplierCode
  }

  if (search) {
    const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
      { voucherNo: { contains: token, mode: 'insensitive' } },
      { supplierName: { contains: token, mode: 'insensitive' } },
      { supplierCode: { contains: token, mode: 'insensitive' } },
    ])
    if (multiTokenFilter) {
      where.AND = multiTokenFilter.AND
    }
  }

  if (dateFrom || dateTo) {
    where.voucherDate = {}
    if (dateFrom) {
      where.voucherDate.gte = new Date(dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`)
    }
    if (dateTo) {
      where.voucherDate.lte = new Date(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`)
    }
  }

  const allowedSorts = ['voucherDate', 'totalAmount', 'voucherNo', 'supplierName']
  const sortBy = typeof query.sortBy === 'string' && allowedSorts.includes(query.sortBy)
    ? query.sortBy
    : 'voucherDate'
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

  try {
    const [purchases, total, summary, seriesList] = await Promise.all([
      prisma.busyPurchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { [sortBy]: sortOrder },
          { id: 'desc' }
        ]
      }),
      prisma.busyPurchase.count({ where }),
      prisma.busyPurchase.aggregate({
        where,
        _sum: {
          totalAmount: true,
          taxableAmount: true,
          taxAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true
        }
      }),
      prisma.busyPurchase.findMany({
        select: { series: true },
        distinct: ['series']
      })
    ])

    const stats = {
      totalCount: total,
      totalAmount: Number(summary._sum.totalAmount || 0),
      totalTaxable: Number(summary._sum.taxableAmount || 0),
      totalTax: Number(summary._sum.taxAmount || 0),
      totalCgst: Number(summary._sum.cgstAmount || 0),
      totalSgst: Number(summary._sum.sgstAmount || 0),
      totalIgst: Number(summary._sum.igstAmount || 0)
    }

    const formattedPurchases = purchases.map((p) => {
      let itemsArr = (p as any).items
      if (!Array.isArray(itemsArr)) {
        itemsArr = itemsArr && typeof itemsArr === 'object' ? [itemsArr] : []
      }
      itemsArr = itemsArr.filter((it: any) => it && typeof it === 'object' && Object.keys(it).length > 0 && it.name)

      return {
        id: p.id,
        voucherNo: p.voucherNo,
        voucherType: p.voucherType,
        series: p.series,
        voucherDate: p.voucherDate,
        supplierCode: p.supplierCode,
        supplierName: p.supplierName,
        totalAmount: Number(p.totalAmount),
        taxableAmount: Number(p.taxableAmount),
        taxAmount: Number(p.taxAmount),
        cgstAmount: Number(p.cgstAmount),
        sgstAmount: Number(p.sgstAmount),
        igstAmount: Number(p.igstAmount),
        itemCount: itemsArr.length || p.itemCount,
        items: itemsArr,
        createdAt: p.createdAt
      }
    })

    return {
      purchases: formattedPurchases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
      seriesList: seriesList.map(s => s.series).filter(Boolean)
    }
  } catch (err: any) {
    console.error('Failed to query busy purchases:', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch purchase records'
    })
  }
})
