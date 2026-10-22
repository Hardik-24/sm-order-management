import { defineEventHandler, getQuery } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Optional auth check or user session
  try {
    const user = requireAuth(event)
  } catch (e) {
    // allow reading if logged in or standard dashboard
  }

  const query = getQuery(event)
  const search = String(query.search || '').trim()

  let p = getPrisma()

  const runQuery = async (prismaClient: typeof p) => {
    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPlace: { contains: search, mode: 'insensitive' } },
        { createdByName: { contains: search, mode: 'insensitive' } }
      ]
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
