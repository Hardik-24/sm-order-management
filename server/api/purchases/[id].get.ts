import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Purchase ID or Voucher Number is required'
    })
  }

  try {
    const purchase = await prisma.busyPurchase.findFirst({
      where: {
        OR: [
          { id },
          { voucherNo: id },
          { voucherNo: { equals: id, mode: 'insensitive' } }
        ]
      }
    })

    if (!purchase) {
      throw createError({
        statusCode: 404,
        statusMessage: `Purchase invoice '${id}' not found`
      })
    }

    let items = (purchase as any).items
    if (!Array.isArray(items)) {
      items = items && typeof items === 'object' ? [items] : []
    }
    items = items.filter((it: any) => it && typeof it === 'object' && Object.keys(it).length > 0 && it.name)

    return {
      id: purchase.id,
      voucherNo: purchase.voucherNo,
      voucherType: purchase.voucherType,
      series: purchase.series,
      voucherDate: purchase.voucherDate,
      supplierCode: purchase.supplierCode,
      supplierName: purchase.supplierName,
      totalAmount: Number(purchase.totalAmount),
      taxableAmount: Number(purchase.taxableAmount),
      taxAmount: Number(purchase.taxAmount),
      cgstAmount: Number(purchase.cgstAmount),
      sgstAmount: Number(purchase.sgstAmount),
      igstAmount: Number(purchase.igstAmount),
      itemCount: items.length || purchase.itemCount,
      items,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error(`Error loading purchase invoice '${id}':`, err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve purchase details'
    })
  }
})
