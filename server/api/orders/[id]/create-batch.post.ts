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
  // Admin, Supervisor, or Sales/Approval users can create fulfillment batches
  await requireRole(event, ['ADMIN', 'SUPERVISOR', 'SALES'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const { 
    notes: batchNotes, 
    deliveryAddress: customDeliveryAddress,
    deliveryAddressId: customDeliveryAddressId,
    vehicleMode: requestedVehicleMode,
    isOnHold = false,
    items: requestedItems 
  } = body

  if (!requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw createError({ statusCode: 400, message: 'Please specify items and quantities for this batch' })
  }

  // 1. Fetch targeted order with relations (resolve to master order if child batch ID passed)
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

  const masterOrderId = targetOrder.parentOrderId || targetOrder.id
  const masterOrder = targetOrder.parentOrderId 
    ? await prisma.order.findUnique({
        where: { id: masterOrderId },
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
    : targetOrder

  if (!masterOrder) {
    throw createError({ statusCode: 404, message: 'Master order not found' })
  }

  if (masterOrder.overallStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Cannot create a batch for a cancelled order' })
  }

  if (masterOrder.deliveryStatus?.status === 'DELIVERED') {
    throw createError({ statusCode: 400, message: 'Master order is already completely delivered' })
  }

  // 2. Map master items and compute already-batched quantities across active batches
  const masterItemMap = new Map<string, typeof masterOrder.items[0]>()
  for (const itm of masterOrder.items) {
    masterItemMap.set(itm.id, itm)
  }

  const alreadyBatchedMap = new Map<string, number>()
  for (const batch of masterOrder.batches) {
    if (batch.overallStatus === 'CANCELLED') continue
    for (const bItm of batch.items) {
      const cur = alreadyBatchedMap.get(bItm.productId) || 0
      alreadyBatchedMap.set(bItm.productId, cur + Number(bItm.quantity || 0))
    }
  }

  // 3. Validate requested batch quantities against available pending pool
  let totalBatchUnits = 0
  const validatedBatchItems: Array<{
    masterItem: typeof masterOrder.items[0]
    quantity: number
  }> = []

  for (const entry of requestedItems) {
    const masterItem = masterItemMap.get(entry.orderItemId)
    if (!masterItem) {
      throw createError({ statusCode: 400, message: `Item ID ${entry.orderItemId} does not belong to this master order` })
    }

    const orderedQty = Number(masterItem.approvedQuantity ?? masterItem.quantity ?? 0)
    const alreadyBatched = alreadyBatchedMap.get(masterItem.productId) || 0
    const availablePool = Math.max(0, orderedQty - alreadyBatched)
    const requestedQty = Number(entry.quantity)

    if (isNaN(requestedQty) || requestedQty < 0) {
      throw createError({ statusCode: 400, message: `Invalid quantity for ${masterItem.productName}` })
    }

    if (requestedQty > availablePool) {
      throw createError({ 
        statusCode: 400, 
        message: `Requested quantity (${requestedQty}) for ${masterItem.productName} exceeds remaining available pool (${availablePool})` 
      })
    }

    if (requestedQty > 0) {
      validatedBatchItems.push({
        masterItem,
        quantity: requestedQty
      })
      totalBatchUnits += requestedQty
    }
  }

  if (totalBatchUnits === 0) {
    throw createError({ statusCode: 400, message: 'At least one item must have a quantity greater than 0 to create a batch' })
  }

  // 4. Calculate next batch number
  const existingBatchNumbers = masterOrder.batches
    .map(b => b.batchNumber || 0)
    .filter(n => n > 0)
  const nextBatchNum = (existingBatchNumbers.length > 0 ? Math.max(...existingBatchNumbers) : 0) + 1
  const updatedBatchCount = Math.max(masterOrder.batchCount || 0, nextBatchNum)

  // 5. Build batch order items with recalculated financial totals
  let batchTotalAmount = 0
  const batchItemsCreateData = []

  for (const entry of validatedBatchItems) {
    const itm = entry.masterItem
    const unitPrice = Number(itm.unitPrice)
    const discount = Number(itm.discount || 0)
    const taxRate = Number(itm.taxRate || 0)
    const isTaxInclusive = Boolean(itm.isTaxInclusive)
    const fin = computeItemTotal(entry.quantity, unitPrice, discount, taxRate, isTaxInclusive)
    batchTotalAmount += fin.totalPrice

    batchItemsCreateData.push({
      productId: itm.productId,
      sku: itm.sku,
      productName: itm.productName,
      quantity: entry.quantity,
      approvedQuantity: entry.quantity,
      packedQuantity: 0,
      billedQuantity: null,
      unitPrice: itm.unitPrice,
      discount: itm.discount,
      taxRate: itm.taxRate,
      taxAmount: fin.taxAmt,
      totalPrice: fin.totalPrice,
      isTaxInclusive: itm.isTaxInclusive,
      applyLastPrice: itm.applyLastPrice,
      itemNotes: itm.itemNotes ? `${itm.itemNotes} [Batch ${nextBatchNum}]` : null,
      isPacked: false,
      isBusySynced: itm.isBusySynced ?? true
    })
  }

  // 6. Delivery parameters
  const finalDeliveryAddress = customDeliveryAddress?.trim() || masterOrder.deliveryAddress
  const finalDeliveryAddressId = customDeliveryAddressId || masterOrder.deliveryAddressId
  const finalVehicleMode = requestedVehicleMode || masterOrder.vehicleMode

  // Strip existing suffix if masterOrder had any
  const baseOrderNum = masterOrder.orderNumber.replace(/-B\d+$/, '').replace(/-[A-Z]$/, '')
  const newBatchOrderNum = `${baseOrderNum}-B${nextBatchNum}`

  // 7. Execute Prisma Transaction
  const result = await prisma.$transaction(async (tx) => {
    // A. Create the new child batch order
    const createdBatch = await tx.order.create({
      data: {
        orderNumber: newBatchOrderNum,
        parentOrderId: masterOrder.id,
        batchNumber: nextBatchNum,
        batchCount: updatedBatchCount,
        isBatchOnHold: Boolean(isOnHold),
        batchNotes: isOnHold ? (batchNotes?.trim() || 'Stock pending / On hold') : null,
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
        notes: batchNotes?.trim() ? `${batchNotes.trim()}\n[Batch ${nextBatchNum} of ${baseOrderNum}]` : `[Batch ${nextBatchNum} of ${baseOrderNum}]`,
        totalAmount: batchTotalAmount,
        overallStatus: 'CONFIRMED',
        items: { create: batchItemsCreateData },
        billingStatus: { create: { status: 'PENDING' } },
        packingStatus: { create: { status: 'PENDING' } },
        deliveryStatus: { create: { status: 'WAITING' } },
        timeline: {
          create: {
            action: `Batch ${nextBatchNum} Created`,
            description: `Fulfillment Batch ${nextBatchNum} created with ${batchItemsCreateData.length} item line(s) (${totalBatchUnits} units)${isOnHold ? ' (Placed On Hold)' : ''} by ${user.name}.`,
            performedById: user.id
          }
        }
      },
      include: {
        items: true,
        billingStatus: true,
        packingStatus: true,
        deliveryStatus: true,
        customer: true
      }
    })

    // B. Update master order's batchCount and ensure it is marked approved & processing
    const updatedMaster = await tx.order.update({
      where: { id: masterOrder.id },
      data: {
        batchCount: updatedBatchCount,
        isApproved: true,
        approvedById: masterOrder.isApproved ? masterOrder.approvedById : user.id,
        approvedAt: masterOrder.isApproved ? masterOrder.approvedAt : new Date(),
        overallStatus: 'PROCESSING',
        timeline: {
          create: {
            action: `Batch ${nextBatchNum} Created from Pool`,
            description: `Batch ${nextBatchNum} (${totalBatchUnits} units) created from pending pool by ${user.name}${isOnHold ? ' (Batch on hold)' : ''}.`,
            performedById: user.id
          }
        }
      },
      include: {
        items: true,
        batches: {
          orderBy: { batchNumber: 'asc' },
          include: { items: true, billingStatus: true, packingStatus: true, deliveryStatus: true }
        }
      }
    })

    // C. Synchronize batchCount on all sister batches
    await tx.order.updateMany({
      where: { parentOrderId: masterOrder.id },
      data: { batchCount: updatedBatchCount }
    })

    return {
      batch: createdBatch,
      masterOrder: updatedMaster
    }
  })

  // 8. Broadcast realtime WebSocket events
  await Promise.all([
    broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'BATCH_CREATED',
      orderId: result.masterOrder.id,
      order: result.masterOrder
    }),
    broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
      type: 'ORDER_CHANGE',
      action: 'BATCH_CREATED',
      orderId: result.batch.id,
      order: result.batch
    })
  ])

  return {
    success: true,
    message: `Fulfillment Batch ${nextBatchNum} created successfully!`,
    batch: result.batch,
    masterOrder: result.masterOrder
  }
})
