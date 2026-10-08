import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])
  
  const body = await readBody(event)
  const { 
    customerId, 
    deliveryAddress, 
    deliveryAddressId,
    paymentTerms, 
    notes, 
    isUrgent = false,
    items 
  } = body

  let resolvedDeliveryAddress = deliveryAddress
  if (deliveryAddressId && (!resolvedDeliveryAddress || resolvedDeliveryAddress.trim() === '')) {
    const addr = await prisma.customerAddress.findUnique({ where: { id: deliveryAddressId } })
    if (addr) {
      resolvedDeliveryAddress = [addr.addressLine, addr.city, addr.pincode].filter(Boolean).join(', ')
    }
  }

  let totalAmount = 0
  const orderItemsData = []

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) throw createError({ statusCode: 404, message: `Product ${item.productId} not found` })
    
    const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(Number(item.unitPrice))
      ? Number(item.unitPrice)
      : Number(product.price)
    const qty = Number(item.quantity) || 1
    const amount = unitPrice * qty
    totalAmount += amount

    orderItemsData.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
      unitPrice: unitPrice,
      packedQuantity: 0,
      approvedQuantity: qty,
      isTaxInclusive: Boolean(item.isTaxInclusive),
      applyLastPrice: Boolean(item.applyLastPrice),
      itemNotes: item.itemNotes ? String(item.itemNotes) : null
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
          deliveryAddress: resolvedDeliveryAddress,
          deliveryAddressId: deliveryAddressId || null,
          isUrgent: Boolean(isUrgent),
          isApproved: false,
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
