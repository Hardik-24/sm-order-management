import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readBody(event)
  
  const product = await prisma.product.create({
    data: {
      sku: body.sku,
      name: body.name,
      categoryId: body.categoryId,
      unit: body.unit || 'PIECE',
      price: body.price !== undefined ? Number(body.price) : 0,
      stock: body.stock !== undefined ? Number(body.stock) : (body.stockQuantity !== undefined ? Number(body.stockQuantity) : 0),
      hsnCode: body.hsnCode || null,
      taxRate: body.taxRate !== undefined ? Number(body.taxRate) : null,
      isActive: body.isActive ?? true
    }
  })

  return product
})
