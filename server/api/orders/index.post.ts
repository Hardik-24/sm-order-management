import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])
  
  const body = await readBody(event)
  const { customerId, deliveryAddress, paymentTerms, notes, items } = body

  // Auto-generate orderNumber
  const count = await prisma.order.count()
  const year = new Date().getFullYear()
  const orderNumber = `SO-${year}-${String(count + 1).padStart(4, '0')}`

  let totalAmount = 0
  const orderItemsData = []

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) throw createError({ statusCode: 404, message: `Product ${item.productId} not found` })
    
    const unitPrice = Number(product.price)
    const amount = unitPrice * item.quantity
    totalAmount += amount

    orderItemsData.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      packedQuantity: 0
    })
  }

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId,
      salesPersonId: user.id,
      deliveryAddress,
      paymentTerms,
      notes,
      totalAmount,
      overallStatus: 'CONFIRMED',
      items: { create: orderItemsData },
      billingStatus: { create: { status: 'PENDING' } },
      packingStatus: { create: { status: 'PENDING' } },
      deliveryStatus: { create: { status: 'WAITING' } },
      timeline: {
        create: {
          action: 'Order Created',
          description: `Order ${orderNumber} created by ${user.name}`,
          performedById: user.id
        }
      }
    },
    include: {
      customer: true,
      items: { include: { product: true } },
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      timeline: true
    }
  })

  return order
})
