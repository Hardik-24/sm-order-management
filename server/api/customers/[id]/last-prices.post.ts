import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const customerId = event.context.params?.id
  if (!customerId) {
    throw createError({ statusCode: 400, message: 'Missing customer ID' })
  }

  const body = await readBody(event) || {}
  const { productIds } = body

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return { success: true, prices: {} }
  }

  const historicalPrices = await prisma.historicalPrice.findMany({
    where: {
      customerId,
      productId: { in: productIds }
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true, price: true, unit: true, taxRate: true }
      }
    }
  })

  const now = new Date()
  const pricesMap: Record<string, any> = {}

  for (const hp of historicalPrices) {
    const vDate = new Date(hp.voucherDate)
    const diffTime = Math.abs(now.getTime() - vDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    pricesMap[hp.productId] = {
      productId: hp.productId,
      productName: hp.product?.name,
      productSku: hp.product?.sku,
      catalogPrice: Number(hp.product?.price || 0),
      unitPrice: Number(hp.unitPrice),
      basePrice: hp.basePrice !== null ? Number(hp.basePrice) : Number(hp.unitPrice),
      taxRate: hp.taxRate !== null ? Number(hp.taxRate) : 18,
      isTaxInclusive: Boolean(hp.isTaxInclusive),
      voucherNo: hp.voucherNo,
      voucherDate: hp.voucherDate,
      daysAgo: diffDays,
      quantity: hp.quantity,
      unit: hp.unit || hp.product?.unit || 'PIECE',
      source: hp.source
    }
  }

  return {
    success: true,
    customerId,
    prices: pricesMap
  }
})
