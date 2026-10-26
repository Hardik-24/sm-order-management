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

    return {
      success: true,
      voucher
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
