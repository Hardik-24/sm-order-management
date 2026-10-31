import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ADMIN', 'SALES'])
  const id = event.context.params?.id

  if (!id) {
    throw createError({ statusCode: 400, message: 'Request ID is required' })
  }

  const orderRequest = await prisma.orderRequest.findUnique({
    where: { id },
    include: { items: { include: { product: true } } }
  })

  if (!orderRequest) {
    throw createError({ statusCode: 404, message: 'Order request not found' })
  }

  if (orderRequest.status === 'CONFIRMED') {
    throw createError({ statusCode: 400, message: 'This request has already been converted to an order' })
  }

  const body = (await readBody(event)) || {}

  // 1. Resolve or Create Customer
  let customerId = body.customerId

  if (!customerId) {
    // Check if phone or company already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: orderRequest.phone },
          orderRequest.companyName ? { company: { equals: orderRequest.companyName, mode: 'insensitive' } } : {}
        ]
      }
    })

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      // Create new customer record
      const newCustomer = await prisma.customer.create({
        data: {
          name: orderRequest.customerName,
          company: orderRequest.companyName || orderRequest.customerName,
          phone: orderRequest.phone,
          email: orderRequest.email,
          address: orderRequest.deliveryAddress || 'Address to be verified',
          city: orderRequest.city || 'Ahmedabad',
          pincode: orderRequest.pincode,
          paymentTerms: body.paymentTerms || '30 Days',
          isBusySynced: false
        }
      })
      customerId = newCustomer.id
    }
  }

  // 2. Prepare Order Items
  // Use custom items if provided in conversion body, otherwise use request items
  const itemsToConvert = body.items && Array.isArray(body.items) && body.items.length > 0
    ? body.items
    : orderRequest.items

  let totalAmount = 0
  const orderItemsData = []

  for (const it of itemsToConvert) {
    let product = null
    if (it.productId) {
      product = await prisma.product.findUnique({ where: { id: it.productId } })
    } else if (it.sku) {
      product = await prisma.product.findUnique({ where: { sku: it.sku } })
    }

    if (!product) {
      // Try to find by name if not found
      product = await prisma.product.findFirst({
        where: { name: { contains: it.productName || it.name, mode: 'insensitive' } }
      })
    }

    if (!product) {
      throw createError({
        statusCode: 400,
        message: `Product "${it.productName || it.sku}" could not be found in inventory. Please map it to an active catalog product.`
      })
    }

    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1)
    const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0 
      ? it.unitPrice 
      : Number(product.price)

    const amount = unitPrice * quantity
    totalAmount += amount

    orderItemsData.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity,
      unitPrice,
      packedQuantity: 0
    })
  }

  // If a storefront coupon or custom total was set, honor it
  if (typeof body.totalAmount === 'number' && body.totalAmount >= 0) {
    totalAmount = body.totalAmount
  } else if (Number(orderRequest.totalEstimated) > 0 && Number(orderRequest.totalEstimated) < totalAmount) {
    totalAmount = Number(orderRequest.totalEstimated)
  }

  // 3. Auto-generate sequential orderNumber (SO-YYYY-NNNN)
  const year = new Date().getFullYear()
  let orderNumber = ''
  let attempts = 0

  const existingOrdersThisYear = await prisma.order.findMany({
    where: { orderNumber: { startsWith: `SO-${year}-` } },
    select: { orderNumber: true }
  })

  let maxSeq = 0
  for (const o of existingOrdersThisYear) {
    const match = o.orderNumber.match(/^SO-\d{4}-(\d+)/)
    if (match) {
      const seq = parseInt(match[1], 10)
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq
      }
    }
  }

  while (!orderNumber && attempts < 10) {
    attempts++
    const candidate = `SO-${year}-${String(maxSeq + attempts).padStart(4, '0')}`
    const existing = await prisma.order.findUnique({
      where: { orderNumber: candidate },
      select: { id: true }
    })

    if (!existing) {
      orderNumber = candidate
    }
  }

  if (!orderNumber) {
    orderNumber = `SO-${year}-${Date.now().toString().slice(-4)}`
  }

  const deliveryAddress = body.deliveryAddress || orderRequest.deliveryAddress || 'Address on file'
  const paymentTerms = body.paymentTerms || '30 Days'
  const notes = body.notes || orderRequest.notes

  // Check if this is the customer's very first order
  const priorOrdersCount = await prisma.order.count({
    where: { customerId }
  })

  // 4. Create Order in Database
  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId,
      salesPersonId: body.salesPersonId || user.id,
      deliveryAddress,
      paymentTerms,
      notes,
      totalAmount,
      overallStatus: 'CONFIRMED',
      items: {
        create: orderItemsData
      },
      billingStatus: {
        create: { status: 'PENDING' }
      },
      packingStatus: {
        create: { status: 'PENDING' }
      },
      deliveryStatus: {
        create: { status: 'WAITING' }
      },
      timeline: {
        create: {
          action: 'Order Created from Storefront Request',
          description: `Order ${orderNumber} created from Storefront Request ${orderRequest.requestNumber} by ${user.name}`,
          performedById: user.id
        }
      }
    },
    include: {
      customer: true,
      items: { include: { product: true } },
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true
    }
  })

  // 5. Update OrderRequest Status
  await prisma.orderRequest.update({
    where: { id: orderRequest.id },
    data: {
      status: 'CONFIRMED',
      convertedOrderId: order.id,
      confirmedById: user.id
    }
  })

  // 6. If this was customer's very first order, establish master payment terms
  if (priorOrdersCount === 0 && paymentTerms && String(paymentTerms).trim()) {
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { paymentTerms: String(paymentTerms).trim() }
      })
    } catch (custErr) {
      console.warn('[ConvertOrderRequest] Failed to update customer master payment terms on first order:', custErr)
    }
  }

  return {
    success: true,
    order,
    requestNumber: orderRequest.requestNumber
  }
})
