import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing product ID' })
  
  const body = await readBody(event)
  
  const product = await prisma.product.update({
    where: { id },
    data: {
      sku: body.sku,
      name: body.name,
      categoryId: body.categoryId,
      unit: body.unit,
      price: body.price !== undefined ? Number(body.price) : undefined,
      stock: body.stock !== undefined ? Number(body.stock) : (body.stockQuantity !== undefined ? Number(body.stockQuantity) : undefined),
      hsnCode: body.hsnCode !== undefined ? body.hsnCode : undefined,
      taxRate: body.taxRate !== undefined ? Number(body.taxRate) : undefined,
      isActive: body.isActive !== undefined ? body.isActive : undefined
    }
  })

  return product
})
