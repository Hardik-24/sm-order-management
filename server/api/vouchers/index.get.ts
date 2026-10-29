import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { buildMultiTokenPrismaOr } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)

  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const series = typeof query.series === 'string' ? query.series.trim().toUpperCase() : 'ALL'
  const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom.trim() : ''
  const dateTo = typeof query.dateTo === 'string' ? query.dateTo.trim() : ''
  const customerCode = typeof query.customerCode === 'string' ? query.customerCode.trim() : ''

  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25))
  const skip = (page - 1) * limit

  const where: any = { voucherType: 9 }

  if (series && series !== 'ALL') {
    where.series = series
  }

  if (customerCode) {
    where.customerCode = customerCode
  }

  if (search) {
    const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
      { voucherNo: { contains: token, mode: 'insensitive' } },
      { customerName: { contains: token, mode: 'insensitive' } },
      { customerCode: { contains: token, mode: 'insensitive' } },
    ])
    if (multiTokenFilter) {
      where.AND = multiTokenFilter.AND
    }
  }

  if (dateFrom || dateTo) {
    where.voucherDate = {}
    if (dateFrom) {
      where.voucherDate.gte = new Date(dateFrom)
    }
    if (dateTo) {
      where.voucherDate.lte = new Date(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`)
    }
  }

  // Determine sort field and direction
  const allowedSorts = ['voucherDate', 'totalAmount', 'voucherNo', 'customerName']
  const sortBy = typeof query.sortBy === 'string' && allowedSorts.includes(query.sortBy)
    ? query.sortBy
    : 'voucherDate'
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

  try {
    const isUnfilteredFirstPage = page === 1 && !search && series === 'ALL' && !dateFrom && !dateTo && !customerCode
    const shouldComputeStats = query.includeStats === 'true' || isUnfilteredFirstPage

    const tasks: Promise<any>[] = [
      prisma.busyVoucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { [sortBy]: sortOrder },
          { id: 'desc' }
        ]
      }),
      prisma.busyVoucher.count({ where }),
      prisma.busyVoucher.aggregate({
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
      prisma.systemSetting.findUnique({
        where: { key: 'last_synced' }
      })
    ]

    const results = await Promise.all(tasks)
    const vouchers = results[0]
    const total = results[1]
    const summary = results[2]
    const lastSyncedSetting = results[3]

    let stats = null
    if (shouldComputeStats) {
      stats = {
        totalCount: total,
        totalAmount: Number(summary._sum.totalAmount || 0),
        totalTaxable: Number(summary._sum.taxableAmount || 0),
        totalTax: Number(summary._sum.taxAmount || 0),
        totalCgst: Number(summary._sum.cgstAmount || 0),
        totalSgst: Number(summary._sum.sgstAmount || 0),
        totalIgst: Number(summary._sum.igstAmount || 0)
      }
    }

    const normalizedVouchers = vouchers.map((v: any) => {
      let items = v.items
      if (!Array.isArray(items)) {
        items = items && typeof items === 'object' ? [items] : []
      }
      items = items.filter((it: any) => it && typeof it === 'object' && Object.keys(it).length > 0 && it.name)
      return {
        ...v,
        items,
        itemCount: items.length
      }
    })

    return {
      success: true,
      vouchers: normalizedVouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        totalAmount: Number(summary._sum.totalAmount || 0),
        taxableAmount: Number(summary._sum.taxableAmount || 0),
        taxAmount: Number(summary._sum.taxAmount || 0),
        cgstAmount: Number(summary._sum.cgstAmount || 0),
        sgstAmount: Number(summary._sum.sgstAmount || 0),
        igstAmount: Number(summary._sum.igstAmount || 0),
        totalCount: total
      },
      stats,
      lastSynced: lastSyncedSetting?.value || null
    }
  } catch (err: any) {
    console.error('Error fetching vouchers:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to fetch vouchers'
    })
  }
})
