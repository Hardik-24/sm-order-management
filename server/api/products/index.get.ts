import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const categoryId = query.categoryId as string
  const search = query.search as string
  
  const where: any = {}
  if (categoryId) where.categoryId = categoryId
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } }
    ]
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' }
  })

  return products
})
