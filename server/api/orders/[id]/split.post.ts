import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

function calculateOverallStatus(billing: string, packing: string, delivery: string) {
  if (delivery === 'DELIVERED') return 'DELIVERED'
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED'
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY'
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING'
  return 'CONFIRMED'
}

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
  await requireRole(event, ['ADMIN', 'BILLING'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event)
  const { 
    newOrderNumber: requestedOrderNumber, 
    notes: splitNotes, 
    deliveryAddress: customDeliveryAddress,
    deliveryAddressId: customDeliveryAddressId,
    items: splitItems 
  } = body

  if (!splitItems || !Array.isArray(splitItems) || splitItems.length === 0) {
    throw createError({ statusCode: 400, message: 'Please specify items to split' })
  }

  // 1. Fetch parent order with relations
  const parentOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { addresses: true } },
      items: true,
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      paymentStatus: true
    }
  })

  if (!parentOrder) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }

  if (parentOrder.overallStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Cannot split a cancelled order' })
  }

  if (parentOrder.deliveryStatus?.status === 'DISPATCHED' || parentOrder.deliveryStatus?.status === 'DELIVERED') {
    throw createError({ statusCode: 400, message: 'Cannot split an order that is already dispatched or delivered' })
  }

  if (parentOrder.billingStatus?.status === 'GENERATED') {
    throw createError({ statusCode: 400, message: 'Cannot split an order whose bill has already been generated. Revert or reset billing first.' })
  }

  // 2. Validate split quantities
  const itemMap = new Map<string, typeof parentOrder.items[0]>()
  for (const itm of parentOrder.items) {
    itemMap.set(itm.id, itm)
  }

  let totalItemsKept = 0
  let totalItemsMoved = 0
  const validatedMoves: Array<{
    originalItem: typeof parentOrder.items[0]
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
        message: `Sum of kept (${keepQty}) and moved (${moveQty}) must equal original quantity (${currentQty}) for ${originalItem.productName}` 
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

  // Also account for any items in parentOrder not mentioned in splitItems (they stay 100% in parent)
  const handledItemIds = new Set(splitItems.map(s => s.orderItemId))
  for (const itm of parentOrder.items) {
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
    throw createError({ statusCode: 400, message: 'At least one item quantity must remain in the original order' })
  }

  if (totalItemsMoved <= 0) {
    throw createError({ statusCode: 400, message: 'At least one item quantity must be moved to the new split order' })
  }

  // 3. Determine new order number
  const baseOrderNumber = parentOrder.orderNumber.replace(/-[A-Z]$/, '')
  let newOrderNumber = requestedOrderNumber?.trim()

  if (!newOrderNumber) {
    // Check existing suffixes for base order number
    const existingRelated = await prisma.order.findMany({
      where: { orderNumber: { startsWith: baseOrderNumber } },
      select: { orderNumber: true }
    })
    const existingNumbers = new Set(existingRelated.map(o => o.orderNumber.toUpperCase()))

    const alphabet = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let i = 0; i < alphabet.length; i++) {
      const candidate = `${baseOrderNumber}-${alphabet[i]}`
      if (!existingNumbers.has(candidate)) {
        newOrderNumber = candidate
        break
      }
    }

    if (!newOrderNumber) {
      newOrderNumber = `${baseOrderNumber}-SPLIT-${Date.now().toString().slice(-4)}`
    }
  } else {
    // Verify uniqueness of requested number
    const exists = await prisma.order.findUnique({ where: { orderNumber: newOrderNumber } })
    if (exists) {
      throw createError({ statusCode: 400, message: `Order number ${newOrderNumber} already exists. Please choose a different number.` })
    }
  }

  // 4. Execute atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // ── Prepare New Order Items Data ──
    let newOrderTotal = 0
    const newOrderItemsData = []

    for (const move of validatedMoves) {
      if (move.moveQuantity > 0) {
        const itm = move.originalItem
        const unitPrice = Number(itm.unitPrice)
        const disc = Number(itm.discount || 0)
        const taxRate = Number(itm.taxRate || 0)
        const isTaxInc = Boolean(itm.isTaxInclusive)

        const fin = computeItemTotal(move.moveQuantity, unitPrice, disc, taxRate, isTaxInc)
        newOrderTotal += fin.totalPrice

        newOrderItemsData.push({
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
          itemNotes: itm.itemNotes ? `${itm.itemNotes} (Split from ${parentOrder.orderNumber})` : null,
          isPacked: false
        })
      }
    }

    // ── Create New Split Order (Order B) ──
    const finalDeliveryAddress = customDeliveryAddress?.trim() || parentOrder.deliveryAddress
    const finalDeliveryAddressId = customDeliveryAddressId || parentOrder.deliveryAddressId

    const newOrder = await tx.order.create({
      data: {
        orderNumber: newOrderNumber,
        customerId: parentOrder.customerId,
        salesPersonId: parentOrder.salesPersonId,
        orderDate: new Date(),
        deliveryAddress: finalDeliveryAddress,
        deliveryAddressId: finalDeliveryAddressId,
        vehicleMode: parentOrder.vehicleMode,
        isUrgent: parentOrder.isUrgent,
        isApproved: parentOrder.isApproved,
        approvedById: parentOrder.approvedById,
        approvedAt: parentOrder.approvedAt,
        paymentTerms: parentOrder.paymentTerms,
        notes: splitNotes?.trim() 
          ? `${splitNotes.trim()}\n[Split from ${parentOrder.orderNumber}]` 
          : `[Split from ${parentOrder.orderNumber}]`,
        totalAmount: newOrderTotal,
        overallStatus: 'CONFIRMED',
        items: {
          create: newOrderItemsData
        },
        billingStatus: {
          create: {
            status: 'PENDING'
          }
        },
        packingStatus: {
          create: {
            status: 'PENDING'
          }
        },
        deliveryStatus: {
          create: {
            status: 'WAITING'
          }
        },
        paymentStatus: {
          create: {
            status: 'UNPAID',
            amountPaid: 0,
            balanceDue: newOrderTotal
          }
        },
        timeline: {
          create: {
            action: 'Order Split Created',
            description: `Order created via split from ${parentOrder.orderNumber} with ${newOrderItemsData.length} item line(s).`,
            performedById: user.id
          }
        }
      },
      include: {
        items: true,
        billingStatus: true,
        packingStatus: true,
        deliveryStatus: true,
        paymentStatus: true,
        customer: true
      }
    })

    // ── Update Parent Order Items & Total (Order A) ──
    let parentRemainingTotal = 0

    for (const move of validatedMoves) {
      const itm = move.originalItem
      if (move.keepQuantity === 0) {
        // Line item completely moved to new order — remove from parent
        await tx.orderItem.delete({
          where: { id: itm.id }
        })
      } else {
        // Line item partially or fully retained in parent
        const unitPrice = Number(itm.unitPrice)
        const disc = Number(itm.discount || 0)
        const taxRate = Number(itm.taxRate || 0)
        const isTaxInc = Boolean(itm.isTaxInclusive)

        const fin = computeItemTotal(move.keepQuantity, unitPrice, disc, taxRate, isTaxInc)
        parentRemainingTotal += fin.totalPrice

        // Adjust packedQuantity if it exceeds new kept quantity
        const adjustedPacked = Math.min(Number(itm.packedQuantity || 0), move.keepQuantity)

        await tx.orderItem.update({
          where: { id: itm.id },
          data: {
            quantity: move.keepQuantity,
            approvedQuantity: move.keepQuantity,
            packedQuantity: adjustedPacked,
            billedQuantity: null,
            taxAmount: fin.taxAmt,
            totalPrice: fin.totalPrice,
            isPacked: adjustedPacked >= move.keepQuantity
          }
        })
      }
    }

    // ── Update Parent Order Overall Totals & Payment ──
    const existingPaid = Number(parentOrder.paymentStatus?.amountPaid || 0)
    const newParentBalanceDue = Math.max(0, parentRemainingTotal - existingPaid)
    const newPaymentState = existingPaid >= parentRemainingTotal && parentRemainingTotal > 0
      ? 'PAID'
      : existingPaid > 0
        ? 'PARTIAL'
        : 'UNPAID'

    const updatedParent = await tx.order.update({
      where: { id: parentOrder.id },
      data: {
        totalAmount: parentRemainingTotal,
        paymentStatus: {
          update: {
            balanceDue: newParentBalanceDue,
            status: newPaymentState
          }
        },
        timeline: {
          create: {
            action: 'Order Split',
            description: `Order split: items moved to ${newOrderNumber} by ${user.name}. New total: ₹${parentRemainingTotal.toLocaleString('en-IN')}`,
            performedById: user.id
          }
        }
      },
      include: {
        items: true,
        billingStatus: true,
        packingStatus: true,
        deliveryStatus: true,
        paymentStatus: true,
        customer: true
      }
    })

    return {
      parentOrder: updatedParent,
      newOrder
    }
  })

  return {
    success: true,
    message: `Order successfully split into ${parentOrder.orderNumber} and ${result.newOrder.orderNumber}`,
    parentOrder: result.parentOrder,
    newOrder: result.newOrder
  }
})
