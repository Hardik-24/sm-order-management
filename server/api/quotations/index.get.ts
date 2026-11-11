import { defineEventHandler, getQuery } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'
import { buildMultiTokenPrismaOr } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const search = String(query.search || '').trim()
  const scope = String(query.scope || '').trim()
  const canViewAllCompany = user.role === 'ADMIN' || (user.actionPermissions?.canViewAllCompanyOrders ?? true)

  let p = getPrisma()

  const runQuery = async (prismaClient: typeof p) => {
    const andConditions: any[] = []

    if (search) {
      const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
        { quoteNumber: { contains: token, mode: 'insensitive' } },
        { customerName: { contains: token, mode: 'insensitive' } },
        { customerPlace: { contains: token, mode: 'insensitive' } },
        { createdByName: { contains: token, mode: 'insensitive' } },
        { requestedByName: { contains: token, mode: 'insensitive' } }
      ])
      if (multiTokenFilter?.AND) {
        andConditions.push(...multiTokenFilter.AND)
      }
    }

    const salesPersonId = String(query.salesPersonId || query.createdById || '').trim()
    const startDate = String(query.startDate || '').trim()
    const endDate = String(query.endDate || '').trim()

    if (canViewAllCompany) {
      if (salesPersonId && salesPersonId !== 'all' && salesPersonId !== 'mine') {
        andConditions.push({
          OR: [
            { requestedById: salesPersonId },
            { createdById: salesPersonId }
          ]
        })
      } else if (salesPersonId === 'mine' || scope === 'mine') {
        const userCondition: any[] = [
          { createdById: user.id },
          { requestedById: user.id }
        ]
        if (user.name) {
          userCondition.push({ createdByName: { equals: user.name, mode: 'insensitive' } })
          userCondition.push({ requestedByName: { equals: user.name, mode: 'insensitive' } })
        }
        andConditions.push({ OR: userCondition })
      }
    } else {
      const userCondition: any[] = [
        { createdById: user.id },
        { requestedById: user.id }
      ]
      if (user.name) {
        userCondition.push({ createdByName: { equals: user.name, mode: 'insensitive' } })
        userCondition.push({ requestedByName: { equals: user.name, mode: 'insensitive' } })
      }
      andConditions.push({ OR: userCondition })
    }

    if (startDate || endDate) {
      const dateCondition: any = {}
      if (startDate) {
        const d = new Date(`${startDate}T00:00:00`)
        if (!isNaN(d.getTime())) dateCondition.gte = d
      }
      if (endDate) {
        const d = new Date(`${endDate}T23:59:59.999`)
        if (!isNaN(d.getTime())) dateCondition.lte = d
      }
      if (dateCondition.gte || dateCondition.lte) {
        andConditions.push({ createdAt: dateCondition })
      }
    }

    const whereClause: any = andConditions.length > 0 ? { AND: andConditions } : {}

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
