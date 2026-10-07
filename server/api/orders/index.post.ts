import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])
  
  const body = await readBody(event)
  const { customerId, deliveryAddress, paymentTerms, notes, items } = body

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

  const year = new Date().getFullYear()
  let order = null
  let attempts = 0

  while (!order && attempts < 5) {
    attempts++

    const latestOrder = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: `SO-${year}-` } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true }
    })

    let nextSeq = 1
    if (latestOrder) {
      const parts = latestOrder.orderNumber.split('-')
      if (parts.length === 3) {
        nextSeq = parseInt(parts[2], 10) + 1
      }
    }

    const orderNumber = `SO-${year}-${String(nextSeq).padStart(4, '0')}`

    try {
      order = await prisma.order.create({
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
          paymentStatus: { create: { status: 'UNPAID', amountPaid: 0, balanceDue: totalAmount } },
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
          paymentStatus: true,
          timeline: true
        }
      })
    } catch (err: any) {
      if (err.code === 'P2002' && attempts < 5) {
        // Unique constraint failed on orderNumber, retry
        continue
      }
      throw err
    }
  }

  return order
})
