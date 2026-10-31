import { defineEventHandler, readBody, createError } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ADMIN', 'SALES'])
  const id = event.context.params?.id

  if (!id) {
    throw createError({ statusCode: 400, message: 'Quotation ID is required' })
  }

  const body = (await readBody(event)) || {}

  let p = getPrisma()

  const executeConversion = async (prismaClient: typeof p) => {
    // 1. Fetch quotation
    const quotation = await prismaClient.quotation.findUnique({
      where: { id }
    })

    if (!quotation) {
      throw createError({ statusCode: 404, message: 'Quotation not found' })
    }

    if (quotation.status === 'CONVERTED') {
      throw createError({
        statusCode: 400,
        message: `This quotation has already been converted to Sales Order ${quotation.convertedOrderNumber || ''}`
      })
    }

    // 2. Permission check: Only admin or the creator can convert
    const isCreator = quotation.createdById === user.id ||
      (quotation.createdByName && user.name && quotation.createdByName.toLowerCase() === user.name.toLowerCase())

    if (user.role !== 'ADMIN' && !isCreator) {
      throw createError({
        statusCode: 403,
        message: 'Only the quotation creator or an administrator can convert this quotation to a sales order.'
      })
    }

    // 3. Resolve or Create Customer
    let customerId = body.customerId

    if (!customerId) {
      let existingCustomer = null

      if (quotation.customerPhone) {
        existingCustomer = await prismaClient.customer.findFirst({
          where: { phone: quotation.customerPhone }
        })
      }

      if (!existingCustomer && quotation.customerName) {
        existingCustomer = await prismaClient.customer.findFirst({
          where: {
            OR: [
              { company: { equals: quotation.customerName, mode: 'insensitive' } },
              { name: { equals: quotation.customerName, mode: 'insensitive' } }
            ]
          }
        })
      }

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const newCustomer = await prismaClient.customer.create({
          data: {
            name: quotation.customerName,
            company: quotation.customerName,
            phone: quotation.customerPhone || 'N/A',
            email: body.email || null,
            address: body.deliveryAddress || quotation.customerPlace || 'Address to be verified',
            city: quotation.customerPlace || 'Mysuru',
            state: 'Karnataka',
            pincode: body.pincode || '570001',
            paymentTerms: body.paymentTerms || 'Net 30'
          }
        })
        customerId = newCustomer.id
      }
    }

    // 4. Resolve Order Items
    // Accept items passed from the modal or fallback to quotation.items
    const rawItems: any[] = body.items && Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : (Array.isArray(quotation.items) ? (quotation.items as any[]) : [])

    if (rawItems.length === 0) {
      throw createError({ statusCode: 400, message: 'At least one item is required to create a sales order' })
    }

    let defaultCategory: any = null
    const getDefaultCategory = async () => {
      if (!defaultCategory) {
        defaultCategory = await prismaClient.category.findFirst()
        if (!defaultCategory) {
          defaultCategory = await prismaClient.category.create({
            data: { name: 'Hardware', code: 'HW' }
          })
        }
      }
      return defaultCategory
    }

    let totalAmount = 0
    const orderItemsData: any[] = []

    for (const it of rawItems) {
      let product: any = null

      if (it.productId) {
        product = await prismaClient.product.findUnique({ where: { id: it.productId } })
      }

      const sku = String(it.articleNumber || it.sku || '').trim()
      const name = String(it.description || it.productName || it.name || sku || 'Quotation Product').trim()

      if (!product && sku) {
        product = await prismaClient.product.findFirst({
          where: { sku: { equals: sku, mode: 'insensitive' } }
        })
      }

      if (!product && name) {
        product = await prismaClient.product.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } }
        })
      }

      // If product still does not exist in DB catalog, create it
      if (!product) {
        const cat = await getDefaultCategory()
        const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0
          ? it.unitPrice
          : (typeof it.rate === 'number' && it.rate >= 0 ? it.rate : Number(it.mrp || 0))

        const finalSku = sku || `SKU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`
        product = await prismaClient.product.create({
          data: {
            name,
            sku: finalSku,
            categoryId: cat.id,
            unit: it.uom || 'PIECE',
            price: unitPrice,
            stock: 0,
            taxRate: 18
          }
        })
      }

      const qty = Math.max(1, parseInt(String(it.quantity), 10) || 1)
      const unitPrice = typeof it.unitPrice === 'number' && it.unitPrice >= 0
        ? it.unitPrice
        : (typeof it.rate === 'number' && it.rate >= 0 ? it.rate : Number(product.price || 0))

      const taxRate = it.taxRate !== undefined && it.taxRate !== null && !isNaN(Number(it.taxRate))
        ? Number(it.taxRate)
        : (product.taxRate !== null && product.taxRate !== undefined ? Number(product.taxRate) : 18)

      const isTaxInclusive = body.taxMode === 'INCLUSIVE' || quotation.taxMode === 'INCLUSIVE' || Boolean(it.isTaxInclusive)

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
        approvedQuantity: qty,
        packedQuantity: 0,
        unitPrice,
        taxRate,
        taxAmount,
        totalPrice: lineTotal,
        isTaxInclusive,
        itemNotes: it.itemNotes ? String(it.itemNotes) : null
      })
    }

    totalAmount = Number(totalAmount.toFixed(2))

    // 5. Generate sequential Order Number (SO-YYYY-XXXX)
    const year = new Date().getFullYear()
    let order: any = null
    let attempts = 0

    const priorOrdersCount = await prismaClient.order.count({
      where: { customerId }
    })

    const existingOrdersThisYear = await prismaClient.order.findMany({
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

    const resolvedDeliveryAddress = body.deliveryAddress?.trim() ||
      quotation.customerPlace ||
      'Mysuru, Karnataka'

    while (!order && attempts < 10) {
      attempts++
      const candidateSeq = maxSeq + attempts
      const orderNumber = `SO-${year}-${String(candidateSeq).padStart(4, '0')}`

      try {
        order = await prismaClient.order.create({
          data: {
            orderNumber,
            customerId,
            salesPersonId: quotation.createdById || user.id,
            deliveryAddress: resolvedDeliveryAddress,
            deliveryAddressId: body.deliveryAddressId || null,
            vehicleMode: (body.vehicleMode === 'PARTY_VEHICLE' || body.vehicleMode === 'THIRD_PARTY')
              ? body.vehicleMode
              : 'OUR_FLEET',
            isUrgent: Boolean(body.isUrgent),
            isApproved: false,
            paymentTerms: body.paymentTerms || 'Net 30',
            notes: body.notes || quotation.quoteNotes || null,
            totalAmount,
            overallStatus: 'CONFIRMED',
            items: { create: orderItemsData },
            billingStatus: { create: { status: 'PENDING' } },
            packingStatus: { create: { status: 'PENDING' } },
            deliveryStatus: { create: { status: 'WAITING' } },
            timeline: {
              create: {
                action: 'Order Created from Quotation',
                description: `Order ${orderNumber} converted from Quotation ${quotation.quoteNumber} by ${user.name}`,
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
          continue
        }
        throw err
      }
    }

    if (!order) {
      throw createError({ statusCode: 500, message: 'Could not generate unique order number. Please try again.' })
    }

    // 6. Update Quotation status to CONVERTED
    await prismaClient.quotation.update({
      where: { id: quotation.id },
      data: {
        status: 'CONVERTED',
        convertedOrderId: order.id,
        convertedOrderNumber: order.orderNumber,
        convertedAt: new Date()
      }
    })

    // 7. Update customer's default payment terms if this is their first order
    if (priorOrdersCount === 0 && body.paymentTerms && String(body.paymentTerms).trim()) {
      try {
        await prismaClient.customer.update({
          where: { id: customerId },
          data: { paymentTerms: String(body.paymentTerms).trim() }
        })
      } catch (custErr) {
        console.warn('[ConvertQuotation] Failed to update customer payment terms on first order:', custErr)
      }
    }

    return {
      success: true,
      order,
      orderNumber: order.orderNumber,
      quoteNumber: quotation.quoteNumber
    }
  }

  try {
    return await executeConversion(p)
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.warn('Convert quotation failed, resetting prisma connection...', err?.message)
    p = resetPrisma()
    return await executeConversion(p)
  }
})
