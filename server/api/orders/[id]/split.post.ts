import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

function computeItemTotal(qty: number, unitPrice: number, discountPct: number, taxRatePct: number, isTaxInclusive: boolean) {
  const subtotal = qty * unitPrice
  const discountAmt = subtotal * (discountPct / 100)
  const taxable = subtotal - discountAmt
  const taxAmt = isTaxInclusive ? 0 : taxable * (taxRatePct / 100)
  const total = taxable + taxAmt
  return {
    subtotal,
    discountAmt,
    taxAmt,
    totalPrice: total
  }
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  // Only Admin, Supervisor, or Sales/Approval users can split orders into batches (Billing can no longer split)
  await requireRole(event, ['ADMIN', 'SUPERVISOR', 'SALES'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const { 
    notes: splitNotes, 
    deliveryAddress: customDeliveryAddress,
    deliveryAddressId: customDeliveryAddressId,
    vehicleMode: requestedVehicleMode,
    holdBatch2 = false,
    items: splitItems 
  } = body

  if (!splitItems || !Array.isArray(splitItems) || splitItems.length === 0) {
    throw createError({ statusCode: 400, message: 'Please specify items to split into batches' })
  }

  // 1. Fetch targeted order with relations
  const targetOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { addresses: true } },
      items: true,
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      batches: {
        include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
      }
    }
  })

  if (!targetOrder) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }

  if (targetOrder.overallStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Cannot split a cancelled order' })
  }

  if (targetOrder.deliveryStatus?.status === 'DISPATCHED' || targetOrder.deliveryStatus?.status === 'DELIVERED') {
    throw createError({ statusCode: 400, message: 'Cannot split an order that is already dispatched or delivered' })
  }

  if (targetOrder.billingStatus?.status === 'GENERATED') {
    throw createError({ statusCode: 400, message: 'Cannot split an order/batch whose bill has already been generated. Revert or reset billing first.' })
  }

  // 2. Validate split quantities
  const itemMap = new Map<string, typeof targetOrder.items[0]>()
  for (const itm of targetOrder.items) {
    itemMap.set(itm.id, itm)
  }

  let totalItemsKept = 0
  let totalItemsMoved = 0
  const validatedMoves: Array<{
    originalItem: typeof targetOrder.items[0]
    keepQuantity: number
    moveQuantity: number
  }> = []

  for (const splitEntry of splitItems) {
    const originalItem = itemMap.get(splitEntry.orderItemId)
    if (!originalItem) {
      throw createError({ statusCode: 400, message: `Item ID ${splitEntry.orderItemId} does not belong to this order` })
    }

    const currentQty = originalItem.approvedQuantity ?? originalItem.quantity
    const keepQty = Number(splitEntry.keepQuantity)
    const moveQty = Number(splitEntry.moveQuantity)

    if (isNaN(keepQty) || keepQty < 0 || isNaN(moveQty) || moveQty < 0) {
      throw createError({ statusCode: 400, message: `Invalid quantities for item ${originalItem.productName}` })
    }

    if (keepQty + moveQty !== currentQty) {
      throw createError({ 
        statusCode: 400, 
        message: `Sum of kept (${keepQty}) and moved (${moveQty}) must equal current quantity (${currentQty}) for ${originalItem.productName}` 
      })
    }

    totalItemsKept += keepQty
    totalItemsMoved += moveQty

    validatedMoves.push({
      originalItem,
      keepQuantity: keepQty,
      moveQuantity: moveQty
    })
  }

  // Also account for any items in targetOrder not explicitly mentioned in splitItems (they stay 100% in kept batch)
  const handledItemIds = new Set(splitItems.map(s => s.orderItemId))
  for (const itm of targetOrder.items) {
    if (!handledItemIds.has(itm.id)) {
      const q = itm.approvedQuantity ?? itm.quantity
      totalItemsKept += q
      validatedMoves.push({
        originalItem: itm,
        keepQuantity: q,
        moveQuantity: 0
      })
    }
  }

  if (totalItemsKept <= 0) {
    throw createError({ statusCode: 400, message: 'At least one item quantity must remain in the first batch' })
  }

  if (totalItemsMoved <= 0) {
    throw createError({ statusCode: 400, message: 'At least one item quantity must be allocated to the second batch' })
  }

  const finalDeliveryAddress = customDeliveryAddress?.trim() || targetOrder.deliveryAddress
  const finalDeliveryAddressId = customDeliveryAddressId || targetOrder.deliveryAddressId
  const finalVehicleMode = (requestedVehicleMode === 'PARTY_VEHICLE' || requestedVehicleMode === 'THIRD_PARTY')
    ? requestedVehicleMode 
    : (requestedVehicleMode === 'OUR_FLEET' ? 'OUR_FLEET' : targetOrder.vehicleMode)

  // 3. Determine whether this is an Initial Split (Master Order -> Batch 1 + Batch 2)
  // or a Recursive Split of an existing child batch (e.g. Batch 2 -> Batch 2 + Batch 3)
  const isInitialSplit = !targetOrder.parentOrderId && targetOrder.batches.length === 0

  const result = await prisma.$transaction(async (tx) => {
    if (isInitialSplit) {
      // ════════════════════════════════════════════════════════════════════════
      // CASE A: INITIAL SPLIT (Master Order -> Batch 1 + Batch 2)
      // ════════════════════════════════════════════════════════════════════════
      const masterOrder = targetOrder
      const baseOrderNum = masterOrder.orderNumber

      // Prepare Batch 1 Items Data
      let batch1Total = 0
      const batch1ItemsData = []
      for (const move of validatedMoves) {
        if (move.keepQuantity > 0) {
          const itm = move.originalItem
          const unitPrice = Number(itm.unitPrice)
          const disc = Number(itm.discount || 0)
          const taxRate = Number(itm.taxRate || 0)
          const isTaxInc = Boolean(itm.isTaxInclusive)
          const fin = computeItemTotal(move.keepQuantity, unitPrice, disc, taxRate, isTaxInc)
          batch1Total += fin.totalPrice

          batch1ItemsData.push({
            productId: itm.productId,
            sku: itm.sku,
            productName: itm.productName,
            quantity: move.keepQuantity,
            approvedQuantity: move.keepQuantity,
            packedQuantity: 0,
            billedQuantity: null,
            unitPrice: itm.unitPrice,
            discount: itm.discount,
            taxRate: itm.taxRate,
            taxAmount: fin.taxAmt,
            totalPrice: fin.totalPrice,
            isTaxInclusive: itm.isTaxInclusive,
            applyLastPrice: itm.applyLastPrice,
            itemNotes: itm.itemNotes ? `${itm.itemNotes} [Batch 1]` : null,
            isPacked: false,
            isBusySynced: itm.isBusySynced ?? true
          })
        }
      }

      // Prepare Batch 2 Items Data
      let batch2Total = 0
      const batch2ItemsData = []
      for (const move of validatedMoves) {
        if (move.moveQuantity > 0) {
          const itm = move.originalItem
          const unitPrice = Number(itm.unitPrice)
          const disc = Number(itm.discount || 0)
          const taxRate = Number(itm.taxRate || 0)
          const isTaxInc = Boolean(itm.isTaxInclusive)
          const fin = computeItemTotal(move.moveQuantity, unitPrice, disc, taxRate, isTaxInc)
          batch2Total += fin.totalPrice

          batch2ItemsData.push({
            productId: itm.productId,
            sku: itm.sku,
            productName: itm.productName,
            quantity: move.moveQuantity,
            approvedQuantity: move.moveQuantity,
            packedQuantity: 0,
            billedQuantity: null,
            unitPrice: itm.unitPrice,
            discount: itm.discount,
            taxRate: itm.taxRate,
            taxAmount: fin.taxAmt,
            totalPrice: fin.totalPrice,
            isTaxInclusive: itm.isTaxInclusive,
            applyLastPrice: itm.applyLastPrice,
            itemNotes: itm.itemNotes ? `${itm.itemNotes} [Batch 2]` : null,
            isPacked: false,
            isBusySynced: itm.isBusySynced ?? true
          })
        }
      }

      // 1. Create Child Batch 1
      const batch1 = await tx.order.create({
        data: {
          orderNumber: `${baseOrderNum}-B1`,
          parentOrderId: masterOrder.id,
          batchNumber: 1,
          batchCount: 2,
          isBatchOnHold: false,
          customerId: masterOrder.customerId,
          salesPersonId: masterOrder.salesPersonId,
          orderDate: masterOrder.orderDate,
          deliveryAddress: masterOrder.deliveryAddress,
          deliveryAddressId: masterOrder.deliveryAddressId,
          vehicleMode: masterOrder.vehicleMode,
          isUrgent: masterOrder.isUrgent,
          isApproved: true,
          approvedById: user.id,
          approvedAt: new Date(),
          paymentTerms: masterOrder.paymentTerms,
          notes: splitNotes?.trim() ? `${splitNotes.trim()}\n[Batch 1 of ${baseOrderNum}]` : `[Batch 1 of ${baseOrderNum}]`,
          totalAmount: batch1Total,
          overallStatus: 'CONFIRMED',
          items: { create: batch1ItemsData },
          billingStatus: { create: { status: 'PENDING' } },
          packingStatus: { create: { status: 'PENDING' } },
          deliveryStatus: { create: { status: 'WAITING' } },
          timeline: {
            create: {
              action: 'Batch 1 Created',
              description: `Batch 1 created via split with ${batch1ItemsData.length} item line(s).`,
              performedById: user.id
            }
          }
        },
        include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
      })

      // 2. Create Child Batch 2
      const batch2 = await tx.order.create({
        data: {
          orderNumber: `${baseOrderNum}-B2`,
          parentOrderId: masterOrder.id,
          batchNumber: 2,
          batchCount: 2,
          isBatchOnHold: Boolean(holdBatch2),
          batchNotes: holdBatch2 ? 'Stock pending / On hold' : null,
          customerId: masterOrder.customerId,
          salesPersonId: masterOrder.salesPersonId,
          orderDate: new Date(),
          deliveryAddress: finalDeliveryAddress,
          deliveryAddressId: finalDeliveryAddressId,
          vehicleMode: finalVehicleMode,
          isUrgent: masterOrder.isUrgent,
          isApproved: true,
          approvedById: user.id,
          approvedAt: new Date(),
          paymentTerms: masterOrder.paymentTerms,
          notes: splitNotes?.trim() ? `${splitNotes.trim()}\n[Batch 2 of ${baseOrderNum}]` : `[Batch 2 of ${baseOrderNum}]`,
          totalAmount: batch2Total,
          overallStatus: 'CONFIRMED',
          items: { create: batch2ItemsData },
          billingStatus: { create: { status: 'PENDING' } },
          packingStatus: { create: { status: 'PENDING' } },
          deliveryStatus: { create: { status: 'WAITING' } },
          timeline: {
            create: {
              action: 'Batch 2 Created',
              description: `Batch 2 created with ${batch2ItemsData.length} item line(s)${holdBatch2 ? ' (Placed On Hold until stock arrives)' : ''}.`,
              performedById: user.id
            }
          }
        },
        include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
      })

      // 3. Update Master Order
      const updatedMaster = await tx.order.update({
        where: { id: masterOrder.id },
        data: {
          isApproved: true,
          approvedById: user.id,
          approvedAt: new Date(),
          batchCount: 2,
          overallStatus: 'PROCESSING',
          timeline: {
            create: {
              action: 'Order Approved & Split into Batches',
              description: `Order approved & split into 2 batches by ${user.name}${holdBatch2 ? ' (Batch 2 on hold)' : ''}.`,
              performedById: user.id
            }
          }
        },
        include: {
          items: true,
          billingStatus: true,
          packingStatus: true,
          deliveryStatus: true,
          customer: true,
          batches: {
            include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
          }
        }
      })

      return {
        masterOrder: updatedMaster,
        batch1,
        batch2
      }
    } else {
      // ════════════════════════════════════════════════════════════════════════
      // CASE B: RECURSIVE SPLIT OF AN EXISTING CHILD BATCH (e.g. Batch 2 -> Batch 2 + Batch 3)
      // ════════════════════════════════════════════════════════════════════════
      const masterOrderId = targetOrder.parentOrderId || targetOrder.id
      const masterOrder = await tx.order.findUnique({
        where: { id: masterOrderId },
        include: { batches: true }
      })
      if (!masterOrder) {
        throw createError({ statusCode: 404, message: 'Master order not found' })
      }

      const existingBatches = await tx.order.findMany({
        where: { parentOrderId: masterOrderId },
        select: { batchNumber: true, id: true }
      })

      const highestBatchNum = existingBatches.reduce((max, b) => Math.max(max, Number(b.batchNumber || 0)), 0)
      const nextBatchNumber = highestBatchNum + 1

      // 1. Prepare moved items for New Batch (Batch N)
      let newBatchTotal = 0
      const newBatchItemsData = []
      for (const move of validatedMoves) {
        if (move.moveQuantity > 0) {
          const itm = move.originalItem
          const unitPrice = Number(itm.unitPrice)
          const disc = Number(itm.discount || 0)
          const taxRate = Number(itm.taxRate || 0)
          const isTaxInc = Boolean(itm.isTaxInclusive)
          const fin = computeItemTotal(move.moveQuantity, unitPrice, disc, taxRate, isTaxInc)
          newBatchTotal += fin.totalPrice

          newBatchItemsData.push({
            productId: itm.productId,
            sku: itm.sku,
            productName: itm.productName,
            quantity: move.moveQuantity,
            approvedQuantity: move.moveQuantity,
            packedQuantity: 0,
            billedQuantity: null,
            unitPrice: itm.unitPrice,
            discount: itm.discount,
            taxRate: itm.taxRate,
            taxAmount: fin.taxAmt,
            totalPrice: fin.totalPrice,
            isTaxInclusive: itm.isTaxInclusive,
            applyLastPrice: itm.applyLastPrice,
            itemNotes: itm.itemNotes ? `${itm.itemNotes} [Batch ${nextBatchNumber}]` : null,
            isPacked: false,
            isBusySynced: itm.isBusySynced ?? true
          })
        }
      }

      // 2. Create the New Child Batch (Batch N)
      const newBatch = await tx.order.create({
        data: {
          orderNumber: `${masterOrder.orderNumber}-B${nextBatchNumber}`,
          parentOrderId: masterOrder.id,
          batchNumber: nextBatchNumber,
          batchCount: nextBatchNumber,
          isBatchOnHold: Boolean(holdBatch2),
          batchNotes: holdBatch2 ? 'Stock pending / On hold' : null,
          customerId: masterOrder.customerId,
          salesPersonId: masterOrder.salesPersonId,
          orderDate: new Date(),
          deliveryAddress: finalDeliveryAddress,
          deliveryAddressId: finalDeliveryAddressId,
          vehicleMode: finalVehicleMode,
          isUrgent: masterOrder.isUrgent,
          isApproved: true,
          approvedById: user.id,
          approvedAt: new Date(),
          paymentTerms: masterOrder.paymentTerms,
          notes: splitNotes?.trim() ? `${splitNotes.trim()}\n[Batch ${nextBatchNumber} split from Batch ${targetOrder.batchNumber}]` : `[Batch ${nextBatchNumber} split from Batch ${targetOrder.batchNumber}]`,
          totalAmount: newBatchTotal,
          overallStatus: 'CONFIRMED',
          items: { create: newBatchItemsData },
          billingStatus: { create: { status: 'PENDING' } },
          packingStatus: { create: { status: 'PENDING' } },
          deliveryStatus: { create: { status: 'WAITING' } },
          timeline: {
            create: {
              action: `Batch ${nextBatchNumber} Created`,
              description: `Batch ${nextBatchNumber} split from Batch ${targetOrder.batchNumber} with ${newBatchItemsData.length} item line(s).`,
              performedById: user.id
            }
          }
        },
        include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
      })

      // 3. Update Existing Batch (delete completely moved items, reduce partially moved items)
      let currentBatchRemainingTotal = 0
      const itemsToDelete = validatedMoves.filter(m => m.keepQuantity === 0).map(m => m.originalItem.id)
      if (itemsToDelete.length > 0) {
        await tx.orderItem.deleteMany({
          where: { id: { in: itemsToDelete } }
        })
      }

      for (const move of validatedMoves) {
        if (move.keepQuantity > 0) {
          const itm = move.originalItem
          const unitPrice = Number(itm.unitPrice)
          const disc = Number(itm.discount || 0)
          const taxRate = Number(itm.taxRate || 0)
          const isTaxInc = Boolean(itm.isTaxInclusive)
          const fin = computeItemTotal(move.keepQuantity, unitPrice, disc, taxRate, isTaxInc)
          currentBatchRemainingTotal += fin.totalPrice

          await tx.orderItem.update({
            where: { id: itm.id },
            data: {
              quantity: move.keepQuantity,
              approvedQuantity: move.keepQuantity,
              packedQuantity: Math.min(Number(itm.packedQuantity || 0), move.keepQuantity),
              taxAmount: fin.taxAmt,
              totalPrice: fin.totalPrice
            }
          })
        }
      }

      const updatedCurrentBatch = await tx.order.update({
        where: { id: targetOrder.id },
        data: {
          totalAmount: currentBatchRemainingTotal,
          batchCount: nextBatchNumber,
          timeline: {
            create: {
              action: `Batch ${targetOrder.batchNumber} Split`,
              description: `Items moved to Batch ${nextBatchNumber} by ${user.name}. New total: ₹${currentBatchRemainingTotal.toLocaleString('en-IN')}`,
              performedById: user.id
            }
          }
        },
        include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
      })

      // 4. Update Master Order & All Sister Batches batchCount
      await tx.order.updateMany({
        where: {
          OR: [
            { id: masterOrder.id },
            { parentOrderId: masterOrder.id }
          ]
        },
        data: { batchCount: nextBatchNumber }
      })

      const updatedMaster = await tx.order.findUnique({
        where: { id: masterOrder.id },
        include: {
          items: true,
          billingStatus: true,
          packingStatus: true,
          deliveryStatus: true,
          customer: true,
          batches: {
            include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
          }
        }
      })

      return {
        masterOrder: updatedMaster,
        batch1: updatedCurrentBatch,
        batch2: newBatch
      }
    }
  }, {
    maxWait: 10000,
    timeout: 30000
  })

  // Broadcast Realtime WebSocket updates to all active devices
  await Promise.allSettled([
    broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'ORDER_SPLIT',
      orderId: result.masterOrder?.id,
      order: result.masterOrder
    }),
    broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'ORDER_CREATED',
      orderId: result.batch1?.id,
      order: result.batch1
    }),
    broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'ORDER_CREATED',
      orderId: result.batch2?.id,
      order: result.batch2
    })
  ])

  return {
    success: true,
    message: isInitialSplit
      ? `Order ${targetOrder.orderNumber} successfully approved and split into Batch 1 and Batch 2.`
      : `Batch ${targetOrder.batchNumber} successfully split into Batch ${targetOrder.batchNumber} and Batch ${result.batch2?.batchNumber}.`,
    masterOrder: result.masterOrder,
    batch1: result.batch1,
    batch2: result.batch2
  }
})
