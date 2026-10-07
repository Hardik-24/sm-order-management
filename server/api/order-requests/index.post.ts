import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body) {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const {
    customerName,
    companyName,
    phone,
    email,
    deliveryAddress,
    city,
    pincode,
    notes,
    items
  } = body

  if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
    throw createError({ statusCode: 400, message: 'Customer name is required' })
  }

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    throw createError({ statusCode: 400, message: 'Contact phone number is required' })
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: 'At least one item must be requested' })
  }

  // Extract all SKUs to bulk query products
  const skus = items
    .map((it: any) => it.sku?.trim())
    .filter(Boolean)

  const foundProducts = await prisma.product.findMany({
    where: {
      sku: { in: skus }
    }
  })

  const productMap = new Map(foundProducts.map(p => [p.sku.toLowerCase(), p]))

  let totalEstimated = 0
  const requestItemsData = []

  for (const item of items) {
    const rawSku = (item.sku || '').trim()
    if (!rawSku) {
      throw createError({
        statusCode: 400,
        message: 'Each item must include a valid product "sku".'
      })
    }

    const rawPrice = item.price !== undefined ? item.price : item.unitPrice
    if (rawPrice === undefined || rawPrice === null || typeof rawPrice !== 'number' || isNaN(rawPrice) || rawPrice < 0) {
      throw createError({
        statusCode: 400,
        message: `Missing or invalid price for item "${rawSku}". Each item must include a numeric 'price' (e.g. price: 2450.00).`
      })
    }

    const quantity = parseInt(item.quantity, 10)
    if (isNaN(quantity) || quantity <= 0) {
      throw createError({
        statusCode: 400,
        message: `Invalid quantity for item "${rawSku}". Quantity must be at least 1.`
      })
    }

    const product = productMap.get(rawSku.toLowerCase())
    const estimatedPrice = rawPrice
    const productName = product ? product.name : (item.name || rawSku || 'Custom Product')
    const unit = product ? product.unit : (item.unit || 'PIECE')

    totalEstimated += estimatedPrice * quantity

    requestItemsData.push({
      productId: product ? product.id : null,
      sku: product ? product.sku : rawSku,
      productName,
      quantity,
      unit,
      estimatedPrice,
    })
  }

  // Auto-generate sequential requestNumber (REQ-YYYY-NNNN)
  const year = new Date().getFullYear()
  let requestNumber = ''
  let attempts = 0

  while (!requestNumber && attempts < 5) {
    attempts++
    const latestRequest = await prisma.orderRequest.findFirst({
      where: { requestNumber: { startsWith: `REQ-${year}-` } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true }
    })

    let nextSeq = 1
    if (latestRequest?.requestNumber) {
      const parts = latestRequest.requestNumber.split('-')
      if (parts.length === 3) {
        nextSeq = parseInt(parts[2], 10) + 1
      }
    }

    const candidate = `REQ-${year}-${String(nextSeq).padStart(4, '0')}`
    const existing = await prisma.orderRequest.findUnique({
      where: { requestNumber: candidate },
      select: { id: true }
    })

    if (!existing) {
      requestNumber = candidate
    }
  }

  if (!requestNumber) {
    requestNumber = `REQ-${year}-${Date.now().toString().slice(-4)}`
  }

  const couponCode = body.couponCode ? String(body.couponCode).trim() : null
  const discountAmount = Math.max(0, parseFloat(body.discountAmount) || 0)

  if (discountAmount > 0) {
    totalEstimated = Math.max(0, totalEstimated - discountAmount)
  }

  let finalNotes = notes ? notes.trim() : null
  if (couponCode || discountAmount > 0) {
    const couponTag = `[Coupon Applied: ${couponCode || 'PROMO'} (-₹${discountAmount})]`
    finalNotes = finalNotes ? `${couponTag} ${finalNotes}` : couponTag
  }

  const orderRequest = await prisma.orderRequest.create({
    data: {
      requestNumber,
      customerName: customerName.trim(),
      companyName: companyName ? companyName.trim() : null,
      phone: phone.trim(),
      email: email ? email.trim() : null,
      deliveryAddress: deliveryAddress ? deliveryAddress.trim() : null,
      city: city ? city.trim() : null,
      pincode: pincode ? pincode.trim() : null,
      notes: finalNotes,
      status: 'PENDING',
      totalEstimated,
      items: {
        create: requestItemsData
      }
    },
    include: {
      items: true
    }
  })

  return {
    success: true,
    requestNumber: orderRequest.requestNumber,
    id: orderRequest.id,
    totalEstimated: orderRequest.totalEstimated,
    itemCount: orderRequest.items.length
  }
})
