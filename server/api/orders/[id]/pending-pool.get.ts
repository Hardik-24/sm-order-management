import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      customer: { include: { addresses: true } },
      batches: {
        where: { overallStatus: { not: 'CANCELLED' } },
        orderBy: { batchNumber: 'asc' },
        include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
      }
    }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  // Resolve master order if child batch ID was passed
  const masterOrder = order.parentOrderId
    ? await prisma.order.findUnique({
        where: { id: order.parentOrderId },
        include: {
          items: true,
          customer: { include: { addresses: true } },
          batches: {
            where: { overallStatus: { not: 'CANCELLED' } },
            orderBy: { batchNumber: 'asc' },
            include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
          }
        }
      })
    : order

  if (!masterOrder) throw createError({ statusCode: 404, message: 'Master order not found' })

  // Map already batched quantities per product across all active child batches
  const alreadyBatchedMap = new Map<string, number>()
  for (const b of masterOrder.batches) {
    for (const bItm of b.items) {
      const cur = alreadyBatchedMap.get(bItm.productId) || 0
      alreadyBatchedMap.set(bItm.productId, cur + Number(bItm.quantity || 0))
    }
  }

  let totalOrderedUnits = 0
  let totalBatchedUnits = 0
  let totalPendingUnits = 0

  const items = masterOrder.items.map(itm => {
    const orderedQty = Number(itm.approvedQuantity ?? itm.quantity ?? 0)
    const batchedQty = alreadyBatchedMap.get(itm.productId) || 0
    const pendingQty = Math.max(0, orderedQty - batchedQty)

    totalOrderedUnits += orderedQty
    totalBatchedUnits += batchedQty
    totalPendingUnits += pendingQty

    return {
      orderItemId: itm.id,
      productId: itm.productId,
      productName: itm.productName,
      sku: itm.sku,
      unitPrice: Number(itm.unitPrice || 0),
      discount: Number(itm.discount || 0),
      taxRate: Number(itm.taxRate || 0),
      isTaxInclusive: Boolean(itm.isTaxInclusive),
      orderedQty,
      batchedQty,
      pendingQty
    }
  })

  const existingNumbers = masterOrder.batches.map(b => b.batchNumber || 0).filter(n => n > 0)
  const nextBatchNumber = (existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0) + 1

  const isCancelled = masterOrder.overallStatus === 'CANCELLED'
  const isDelivered = masterOrder.deliveryStatus?.status === 'DELIVERED'
  const canCreateBatch = !isCancelled && !isDelivered && totalPendingUnits > 0

  return {
    masterOrderId: masterOrder.id,
    orderNumber: masterOrder.orderNumber,
    customer: masterOrder.customer,
    deliveryAddress: masterOrder.deliveryAddress,
    deliveryAddressId: masterOrder.deliveryAddressId,
    vehicleMode: masterOrder.vehicleMode,
    totalOrderedUnits,
    totalBatchedUnits,
    totalPendingUnits,
    nextBatchNumber,
    canCreateBatch,
    items,
    batches: masterOrder.batches.map(b => ({
      id: b.id,
      orderNumber: b.orderNumber,
      batchNumber: b.batchNumber,
      batchCount: b.batchCount,
      isBatchOnHold: b.isBatchOnHold,
      batchNotes: b.batchNotes,
      totalAmount: b.totalAmount,
      itemCount: b.items.length,
      unitCount: b.items.reduce((sum, bi) => sum + (Number(bi.quantity) || 0), 0),
      packingStatus: b.packingStatus?.status || 'PENDING',
      billingStatus: b.billingStatus?.status || 'PENDING',
      invoiceNumber: b.billingStatus?.invoiceNumber || null,
      deliveryStatus: b.deliveryStatus?.status || 'WAITING',
      createdAt: b.createdAt
    }))
  }
})
