import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const customerId = event.context.params?.id
  if (!customerId) {
    throw createError({ statusCode: 400, message: 'Missing customer ID' })
  }

  const query = getQuery(event)
  const limit = Math.min(parseInt(query.limit as string) || 50, 200)

  const historicalPrices = await prisma.historicalPrice.findMany({
    where: { customerId },
    take: limit,
    orderBy: { voucherDate: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          unit: true,
          category: { select: { id: true, name: true } }
        }
      }
    }
  })

  return {
    success: true,
    count: historicalPrices.length,
    historicalPrices
  }
})
