import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'BILLING', 'SALES'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const { orderItemId, productId } = body
  if (!orderItemId) throw createError({ statusCode: 400, message: 'orderItemId is required' })
  if (!productId) throw createError({ statusCode: 400, message: 'productId is required' })

  const [order, targetProduct] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        billingStatus: true,
        items: true
      }
    }),
    prisma.product.findUnique({
      where: { id: productId }
    })
  ])

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
  if (!targetProduct) throw createError({ statusCode: 404, message: 'Target product not found' })

  if (order.billingStatus?.status === 'GENERATED') {
    throw createError({ statusCode: 400, message: 'Cannot modify items after bill/invoice has already been generated' })
  }

  const existingItem = order.items.find(i => i.id === orderItemId)
  if (!existingItem) {
    throw createError({ statusCode: 404, message: 'Item not found on this order' })
  }

  const oldItemName = existingItem.productName || existingItem.sku

  const updatedOrder = await prisma.$transaction(async (tx) => {
    // 1. Update the order item to reference the new verified product
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        productId: targetProduct.id,
        sku: targetProduct.sku,
        productName: targetProduct.name,
        isBusySynced: targetProduct.isBusySynced ?? true,
        unitPrice: existingItem.unitPrice && Number(existingItem.unitPrice) > 0 
          ? existingItem.unitPrice 
          : (targetProduct.price ? targetProduct.price : existingItem.unitPrice)
      }
    })

    // 2. Add an audit log to the order timeline
    await tx.orderTimeline.create({
      data: {
        orderId: id,
        status: order.overallStatus,
        notes: `Item "${oldItemName}" linked to Busy product "${targetProduct.name}" (${targetProduct.sku}) by ${user.name || 'Billing Staff'}`,
        performedById: user.id
      }
    })

    // 3. Return full order with all relations
    return await tx.order.findUnique({
      where: { id },
      include: {
        customer: true,
        billingStatus: true,
        packingStatus: true,
        deliveryStatus: true,
        items: {
          include: {
            product: true
          }
        },
        timeline: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  })

  return {
    success: true,
    order: updatedOrder
  }
})
