import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { isNotificationEnabled } from '~~/server/utils/notificationSettings'
import { generateSequentialOrderNumber } from '~~/server/utils/seriesNumber'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

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
    items,
    isCustomCustomer,
    customCustomer
  } = body

  let resolvedDeliveryAddress = deliveryAddress
  if (deliveryAddressId && (!resolvedDeliveryAddress || resolvedDeliveryAddress.trim() === '')) {
    const addr = await prisma.customerAddress.findUnique({ where: { id: deliveryAddressId } })
    if (addr) {
      resolvedDeliveryAddress = [addr.addressLine, addr.city, addr.pincode].filter(Boolean).join(', ')
    }
  }

  // 1. Resolve or Create Customer (Supports custom customer not in Busy)
  let resolvedCustomerId = customerId

  if (isCustomCustomer || (!resolvedCustomerId && customCustomer?.name)) {
    const custName = String(customCustomer?.name || '').trim()
    if (!custName) {
      throw createError({ statusCode: 400, message: 'Custom customer name is required' })
    }

    let existingCustomer = null
    const phone = customCustomer?.phone ? String(customCustomer.phone).trim() : null
    if (phone && phone !== 'N/A') {
      existingCustomer = await prisma.customer.findFirst({
        where: { phone }
      })
    }

    if (!existingCustomer) {
      existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { company: { equals: custName, mode: 'insensitive' } },
            { name: { equals: custName, mode: 'insensitive' } }
          ]
        }
      })
    }

    if (existingCustomer) {
      resolvedCustomerId = existingCustomer.id
    } else {
      const city = customCustomer?.city ? String(customCustomer.city).trim() : 'Mysuru'
      const newCustomer = await prisma.customer.create({
        data: {
          name: custName,
          company: custName,
          phone: phone || 'N/A',
          address: resolvedDeliveryAddress || city || 'Address to be verified',
          city: city,
          state: 'Karnataka',
          paymentTerms: paymentTerms || '30 Days',
          isBusySynced: false
        }
      })
      resolvedCustomerId = newCustomer.id
    }
  }

  if (!resolvedCustomerId) {
    throw createError({ statusCode: 400, message: 'Customer is required' })
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: 'Order must contain at least one item' })
  }

  let defaultCategory: any = null
  const getDefaultCategory = async () => {
    if (!defaultCategory) {
      defaultCategory = await prisma.category.findFirst()
      if (!defaultCategory) {
        defaultCategory = await prisma.category.create({
          data: { name: 'Hardware', code: 'HW' }
        })
      }
    }
    return defaultCategory
  }

  let totalAmount = 0
  const orderItemsData = []

  for (const item of items) {
    let product: any = null
    let isItemBusySynced = true

    if (item.productId) {
      product = await prisma.product.findUnique({ where: { id: item.productId } })
    }

    // Custom product not yet in Busy
    if (item.isCustom || !product) {
      const customName = String(item.customProductName || item.name || '').trim()
      if (!customName) {
        throw createError({ statusCode: 400, message: 'Item name is required for all items' })
      }

      const cat = await getDefaultCategory()
      const finalSku = item.customSku && String(item.customSku).trim()
        ? String(item.customSku).trim()
        : `SKU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`

      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(Number(item.unitPrice))
        ? Number(item.unitPrice)
        : 0

      const itemTaxRate = item.taxRate !== undefined && item.taxRate !== null && !isNaN(Number(item.taxRate))
        ? Number(item.taxRate)
        : 18

      product = await prisma.product.create({
        data: {
          name: customName,
          sku: finalSku,
          categoryId: cat.id,
          unit: item.unit || 'PIECE',
          price: unitPrice,
          stock: 0,
          taxRate: itemTaxRate,
          isBusySynced: false
        }
      })
      isItemBusySynced = false
    } else if (product.isBusySynced === false) {
      isItemBusySynced = false
    }
    
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
      isBusySynced: isItemBusySynced
    })
  }

  totalAmount = Number(totalAmount.toFixed(2))

  const year = new Date().getFullYear()
  let order = null
  let attempts = 0

  // 0. Check if this is the customer's very first order
  const priorOrdersCount = await prisma.order.count({
    where: { customerId: resolvedCustomerId }
  })

  // 1. Generate sequential order number (SO-YYMM-0001)
  while (!order && attempts < 10) {
    attempts++
    const { orderNumber } = await generateSequentialOrderNumber(prisma, new Date(), attempts)

    try {
      order = await prisma.order.create({
        data: {
          orderNumber,
          customerId: resolvedCustomerId,
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
        where: { id: resolvedCustomerId },
        data: { paymentTerms: String(paymentTerms).trim() }
      })
    } catch (custErr) {
      console.warn('[CreateOrder] Failed to update customer master payment terms on first order:', custErr)
    }
  }

  // Non-blocking Push Notification dispatch with await for Serverless container safety
  if (await isNotificationEnabled('orders')) {
    try {
      await sendPushNotification({
        title: `New Order: ${order.orderNumber}`,
        body: `${order.customer?.name || 'Customer'} • ₹${order.totalAmount.toLocaleString('en-IN')}`,
        userIds: [order.salesPersonId].filter(Boolean),
        data: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          type: 'ORDER_CREATED'
        }
      })
    } catch (pushErr) {
      console.warn('[FCM] Order push failed:', pushErr)
    }
  }

  // Multi-device WebSocket broadcast (<100ms)
  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
    type: 'ORDER_CHANGE',
    action: 'ORDER_CREATED',
    orderId: order.id,
    order
  })

  return order
})
