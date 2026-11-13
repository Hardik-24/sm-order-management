import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  
  const categories = await prisma.category.findMany({
    include: {
      parent: true,
      children: true
    },
    orderBy: { name: 'asc' }
  })

  return categories
})
