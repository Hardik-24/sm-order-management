import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])
  
  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const { 
    customerId, 
    deliveryAddress, 
    deliveryAddressId,
    paymentTerms = 'IMMEDIATE', 
    notes, 
    isUrgent = false,
    vehicleMode = 'OUR_FLEET',
    items 
  } = body

  if (!customerId) {
    throw createError({ statusCode: 400, message: 'Customer ID is required' })
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: 'Order must contain at least one item' })
  }

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

    const taxRate = item.taxRate !== undefined && item.taxRate !== null && !isNaN(Number(item.taxRate))
      ? Number(item.taxRate)
      : (product.taxRate !== null && product.taxRate !== undefined ? Number(product.taxRate) : 18)

    const isTaxInclusive = Boolean(item.isTaxInclusive)

    let taxableAmount = 0
    let taxAmount = 0
    let lineTotal = 0

    if (isTaxInclusive) {
      lineTotal = Number((qty * unitPrice).toFixed(2))
      taxableAmount = taxRate > 0 ? Number((lineTotal / (1 + (taxRate / 100))).toFixed(2)) : lineTotal
      taxAmount = Number((lineTotal - taxableAmount).toFixed(2))
    } else {
      taxableAmount = Number((qty * unitPrice).toFixed(2))
      taxAmount = Number((taxableAmount * (taxRate / 100)).toFixed(2))
      lineTotal = Number((taxableAmount + taxAmount).toFixed(2))
    }

    totalAmount += lineTotal

    orderItemsData.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
      unitPrice: unitPrice,
      taxRate: taxRate,
      taxAmount: taxAmount,
      totalPrice: lineTotal,
      packedQuantity: 0,
      approvedQuantity: qty,
      isTaxInclusive: isTaxInclusive,
      applyLastPrice: Boolean(item.applyLastPrice),
      itemNotes: item.itemNotes ? String(item.itemNotes) : null,
      isBusySynced: product.isBusySynced ?? true
    })
  }

  totalAmount = Number(totalAmount.toFixed(2))

  const year = new Date().getFullYear()
  let order = null
  let attempts = 0

  // 0. Check if this is the customer's very first order
  const priorOrdersCount = await prisma.order.count({
    where: { customerId }
  })

  // 1. Find all existing orders for this year to determine true maximum sequence number
  const existingOrdersThisYear = await prisma.order.findMany({
    where: { orderNumber: { startsWith: `SO-${year}-` } },
    select: { orderNumber: true }
  })

  let maxSeq = 0
  for (const o of existingOrdersThisYear) {
    // Regex matches SO-YYYY-XXXX (where XXXX is any number of digits), ignoring any split suffix like -B or -C
    const match = o.orderNumber.match(/^SO-\d{4}-(\d+)/)
    if (match) {
      const seq = parseInt(match[1], 10)
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq
      }
    }
  }

  while (!order && attempts < 10) {
    attempts++
    const candidateSeq = maxSeq + attempts
    const orderNumber = `SO-${year}-${String(candidateSeq).padStart(4, '0')}`

    try {
      order = await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          salesPersonId: user.id,
          deliveryAddress: resolvedDeliveryAddress,
          deliveryAddressId: deliveryAddressId || null,
          vehicleMode: (vehicleMode === 'PARTY_VEHICLE' || vehicleMode === 'THIRD_PARTY') ? vehicleMode : 'OUR_FLEET',
          isUrgent: Boolean(isUrgent),
          isApproved: false,
          paymentTerms: paymentTerms || 'IMMEDIATE',
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
              description: `Order ${orderNumber} created by ${user.name} (${vehicleMode === 'PARTY_VEHICLE' ? 'Party Vehicle Pickup' : (vehicleMode === 'THIRD_PARTY' ? 'Third Party Transport (Porter/Rapido)' : 'Our Fleet Delivery')})`,
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
    } catch (err: any) {
      if (err.code === 'P2002' && attempts < 10) {
        // Unique constraint collision on orderNumber, retry with next increment
        continue
      }
      throw err
    }
  }

  // If this was the customer's very first order, establish their master default payment terms
  if (priorOrdersCount === 0 && paymentTerms && String(paymentTerms).trim()) {
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { paymentTerms: String(paymentTerms).trim() }
      })
    } catch (custErr) {
      console.warn('[CreateOrder] Failed to update customer master payment terms on first order:', custErr)
    }
  }

  return order
})
