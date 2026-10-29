import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Voucher ID or Number is required'
    })
  }

  try {
    const voucher = await prisma.busyVoucher.findFirst({
      where: {
        OR: [
          { id },
          { voucherNo: id },
          { voucherNo: { equals: id, mode: 'insensitive' } }
        ]
      }
    })

    if (!voucher) {
      throw createError({
        statusCode: 404,
        statusMessage: `Voucher '${id}' not found`
      })
    }

    let items = (voucher as any).items
    if (!Array.isArray(items)) {
      items = items && typeof items === 'object' ? [items] : []
    }
    // Filter out blank / empty objects like [{}]
    items = items.filter((it: any) => it && typeof it === 'object' && Object.keys(it).length > 0 && it.name)

    // Self-healing fallback: If voucher items are missing, reconstruct from HistoricalPrice
    if (items.length === 0 && voucher.voucherNo) {
      try {
        const histRecords = await prisma.historicalPrice.findMany({
          where: { voucherNo: voucher.voucherNo },
          include: { product: true }
        })

        if (histRecords.length > 0) {
          items = histRecords.map(hp => {
            const qty = Number(hp.quantity) || 1
            const rate = Number(hp.unitPrice) || 0
            const amount = Number(voucher.totalAmount) || (qty * rate)
            const taxable = Number(voucher.taxableAmount) || Math.round((amount / 1.18) * 100) / 100
            const taxAmt = Number(voucher.taxAmount) || Math.round((amount - taxable) * 100) / 100
            const cgstAmt = Number(voucher.cgstAmount) || Math.round((taxAmt / 2) * 100) / 100
            const sgstAmt = Number(voucher.sgstAmount) || Math.round((taxAmt / 2) * 100) / 100

            return {
              name: hp.product?.name || 'Item',
              sku: hp.product?.sku || '',
              hsn: hp.product?.hsnCode || '',
              qty,
              rate,
              amount,
              isTaxInclusive: hp.isTaxInclusive !== false,
              taxableAmount: taxable,
              taxRate: Number(hp.taxRate) || 18,
              taxAmount: taxAmt,
              cgstRate: 9,
              cgstAmount: cgstAmt,
              sgstRate: 9,
              sgstAmount: sgstAmt,
              igstRate: 0,
              igstAmount: 0
            }
          })

          // Asynchronously heal the record in DB so subsequent requests are fast
          prisma.busyVoucher.update({
            where: { id: voucher.id },
            data: { itemCount: items.length, items }
          }).catch(() => {})
        }
      } catch {
        // Fallback silently if lookup fails
      }
    }

    const normalizedVoucher = {
      ...voucher,
      items,
      itemCount: items.length
    }

    return {
      success: true,
      voucher: normalizedVoucher
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('Error fetching voucher detail:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to fetch voucher detail'
    })
  }
})
