import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/prisma'

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma

/**
 * Record or update historical prices for all items in an order when invoice is generated.
 */
export async function syncOrderHistoricalPrices(
  tx: PrismaClientOrTx,
  orderId: string,
  invoiceNumber?: string | null
) {
  try {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    })

    if (!order || !order.customerId || order.items.length === 0) return

    for (const item of order.items) {
      if (!item.productId) continue

      const uPrice = Number(item.unitPrice || 0)
      if (uPrice <= 0) continue

      const tRate = Number(item.taxRate || 0)
      const isInc = Boolean(item.isTaxInclusive)
      const basePrice = isInc && tRate > 0
        ? Number((uPrice / (1 + tRate / 100)).toFixed(2))
        : uPrice

      const qty = item.billedQuantity ?? item.approvedQuantity ?? item.quantity ?? 1
      const vchNo = invoiceNumber || order.orderNumber

      await tx.historicalPrice.upsert({
        where: {
          customerId_productId: {
            customerId: order.customerId,
            productId: item.productId
          }
        },
        create: {
          customerId: order.customerId,
          productId: item.productId,
          unitPrice: uPrice,
          basePrice,
          taxRate: tRate,
          isTaxInclusive: isInc,
          voucherNo: vchNo,
          voucherDate: new Date(),
          quantity: qty,
          source: 'OMS'
        },
        update: {
          unitPrice: uPrice,
          basePrice,
          taxRate: tRate,
          isTaxInclusive: isInc,
          voucherNo: vchNo,
          voucherDate: new Date(),
          quantity: qty,
          source: 'OMS'
        }
      })
    }
  } catch (err) {
    console.error('Failed to sync historical prices for order:', orderId, err)
    // Non-fatal, do not fail parent transaction
  }
}
