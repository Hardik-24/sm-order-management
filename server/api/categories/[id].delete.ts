import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing category ID' })

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true }
      }
    }
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  // If products are attached to this category, protect integrity:
  if (category._count.products > 0) {
    // Instead of failing or leaving orphaned foreign keys, deactivate it
    await prisma.category.update({
      where: { id },
      data: { isActive: false }
    })
    return { 
      success: true, 
      action: 'DEACTIVATED',
      message: `Category "${category.name}" has ${category._count.products} products attached. It has been deactivated instead of deleted to protect historical records.` 
    }
  }

  // If 0 products, safe to permanently delete
  await prisma.category.delete({
    where: { id }
  })

  return { success: true, action: 'DELETED', message: `Category "${category.name}" deleted successfully` }
})
