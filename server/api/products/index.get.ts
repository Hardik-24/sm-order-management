import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { buildMultiTokenPrismaOr, rankServerItems } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const categoryId = query.categoryId as string
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  
  const where: any = {}
  if (categoryId) where.categoryId = categoryId
  
  if (search) {
    const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
      { name: { contains: token, mode: 'insensitive' } },
      { sku: { contains: token, mode: 'insensitive' } },
      { category: { name: { contains: token, mode: 'insensitive' } } },
      ...(token.length >= 4 ? [{ hsnCode: { contains: token, mode: 'insensitive' } }] : [{ hsnCode: { startsWith: token, mode: 'insensitive' } }])
    ])
    if (multiTokenFilter) {
      where.AND = multiTokenFilter.AND
    }
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' }
  })

  if (search) {
    return rankServerItems(products, search, {
      primary: p => p.name,
      secondary: p => p.sku,
      meta: p => p.category?.name,
      code: p => p.hsnCode
    })
  }

  return products
})
