import { defineEventHandler, getQuery } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'
import { buildMultiTokenPrismaOr } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const query = getQuery(event)
  const search = String(query.search || '').trim()

  let p = getPrisma()

  const runQuery = async (prismaClient: typeof p) => {
    const whereClause: any = {}
    if (search) {
      const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
        { quoteNumber: { contains: token, mode: 'insensitive' } },
        { customerName: { contains: token, mode: 'insensitive' } },
        { customerPlace: { contains: token, mode: 'insensitive' } },
        { createdByName: { contains: token, mode: 'insensitive' } }
      ])
      if (multiTokenFilter) {
        whereClause.AND = multiTokenFilter.AND
      }
    }

    const [quotations, totalCount] = await Promise.all([
      prismaClient.quotation.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prismaClient.quotation.count({ where: whereClause })
    ])

    return { quotations, totalCount }
  }

  try {
    const result = await runQuery(p)
    return {
      success: true,
      quotations: result.quotations,
      total: result.totalCount
    }
  } catch (err: any) {
    console.warn('Quotations get failed, resetting connection...', err?.message)
    p = resetPrisma()
    const result = await runQuery(p)
    return {
      success: true,
      quotations: result.quotations,
      total: result.totalCount
    }
  }
})
