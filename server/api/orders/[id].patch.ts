import { requireActionPermission, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { isNotificationEnabled } from '~~/server/utils/notificationSettings'
import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireActionPermission(event, 'canEditOrders')
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { billingStatus: true }
  })
  if (!existingOrder) throw createError({ statusCode: 404, message: 'Order not found' })

  if (existingOrder.billingStatus?.status === 'GENERATED' || existingOrder.billingStatus?.invoiceNumber) {
    throw createError({
      statusCode: 400,
      message: 'This order cannot be edited because its bill/invoice has already been generated.'
    })
  }

  if (existingOrder.overallStatus === 'CANCELLED') {
    throw createError({
      statusCode: 400,
      message: 'Cannot edit an order that has already been cancelled.'
    })
  }

  // Check if order was converted from a quotation
  const convertedQuotation = await prisma.quotation.findFirst({
    where: { convertedOrderId: id },
    select: { id: true, quoteNumber: true }
  })

  if (convertedQuotation) {
    if (user.role !== 'ADMIN') {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, actionPermissions: true }
      })
      const perms = (dbUser?.actionPermissions && typeof dbUser.actionPermissions === 'object')
        ? (dbUser.actionPermissions as Record<string, boolean>)
        : {}
      if (!perms.canEditConvertedQuotationOrders) {
        throw createError({
          statusCode: 403,
          message: `This order was converted from Quotation ${convertedQuotation.quoteNumber} and cannot be edited. Only administrators or users with permission to edit quotation orders can modify it.`
        })
      }
    }
  }
  
  const body = await readBody(event)
  const { orderNumber, customerId, deliveryAddress, deliveryAddressId, paymentTerms, notes, isUrgent, vehicleMode, items } = body
  
  // If editing a child fulfillment batch, validate that quantities do not exceed available master order pool
  if (existingOrder.parentOrderId && items && Array.isArray(items)) {
    const masterOrder = await prisma.order.findUnique({
      where: { id: existingOrder.parentOrderId },
      include: {
        items: true,
        batches: {
          where: { id: { not: existingOrder.id }, overallStatus: { not: 'CANCELLED' } },
          include: { items: true }
        }
      }
    })

    if (masterOrder) {
      for (const item of items) {
        const masterItem = masterOrder.items.find(mi => mi.productId === item.productId)
        if (masterItem) {
          const masterQty = Number(masterItem.approvedQuantity ?? masterItem.quantity ?? 0)
          let sisterBatchesQty = 0
          for (const b of masterOrder.batches) {
            for (const bi of b.items) {
              if (bi.productId === item.productId) {
                sisterBatchesQty += Number(bi.quantity || 0)
              }
            }
          }
          const availableMax = Math.max(0, masterQty - sisterBatchesQty)
          const newQty = Number(item.quantity) || 0
          if (newQty > availableMax) {
            throw createError({
              statusCode: 400,
              message: `Quantity for ${masterItem.productName} (${newQty}) exceeds maximum available quantity in master order pool (${availableMax}).`
            })
          }
        }
      }
    }
  }

  let totalAmount = 0
  const itemsToCreate = []
  const itemsToUpdate = []

  // Look up products to get prices
  if (items && Array.isArray(items)) {
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) throw createError({ statusCode: 404, message: `Product ${item.productId} not found` })
      
      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(Number(item.unitPrice))
        ? Number(item.unitPrice)
        : Number(product.price)
      const qty = Number(item.quantity) || 1

      const taxRate = item.taxRate !== undefined && item.taxRate !== null && !isNaN(Number(item.taxRate))
        ? Number(item.taxRate)
        : (product.taxRate !== null && product.taxRate !== undefined ? Number(product.taxRate) : 18)

      const isTaxInclusive = Boolean(item.isTaxInclusive)

      let taxableAmount = 0
      let taxAmount = 0
      let lineTotal = 0

      if (isTaxInclusive) {
        lineTotal = Number((qty * unitPrice).toFixed(2))
        taxableAmount = taxRate > 0 ? Number((lineTotal / (1 + (taxRate / 100))).toFixed(2)) : lineTotal
        taxAmount = Number((lineTotal - taxableAmount).toFixed(2))
      } else {
        taxableAmount = Number((qty * unitPrice).toFixed(2))
        taxAmount = Number((taxableAmount * (taxRate / 100)).toFixed(2))
        lineTotal = Number((taxableAmount + taxAmount).toFixed(2))
      }

      totalAmount += lineTotal

      if (item.id) {
        itemsToUpdate.push({
          where: { id: item.id },
          data: {
            productId: product.id,
            sku: product.sku,
            productName: product.name,
            quantity: qty,
            ...(Boolean(existingOrder.parentOrderId || existingOrder.isApproved) && { approvedQuantity: qty }),
            unitPrice: unitPrice,
            taxRate: taxRate,
            taxAmount: taxAmount,
            totalPrice: lineTotal,
            isTaxInclusive: isTaxInclusive,
            applyLastPrice: Boolean(item.applyLastPrice),
            itemNotes: item.itemNotes ? String(item.itemNotes) : null
          }
        })
      } else {
        itemsToCreate.push({
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          quantity: qty,
          unitPrice: unitPrice,
          taxRate: taxRate,
          taxAmount: taxAmount,
          totalPrice: lineTotal,
          packedQuantity: 0,
          approvedQuantity: qty,
          isTaxInclusive: isTaxInclusive,
          applyLastPrice: Boolean(item.applyLastPrice),
          itemNotes: item.itemNotes ? String(item.itemNotes) : null
        })
      }
    }
    totalAmount = Number(totalAmount.toFixed(2))
  }

  // Get items to delete
  const existingItems = await prisma.orderItem.findMany({ where: { orderId: id } })
  const incomingIds = (items || []).filter(i => i.id).map(i => i.id)
  const itemsToDelete = existingItems.filter(ei => !incomingIds.includes(ei.id)).map(ei => ei.id)

  const updateData: any = {
    notes,
    deliveryAddress,
    ...(deliveryAddressId && { deliveryAddressId }),
    ...(orderNumber && { orderNumber }),
    ...(customerId && { customerId }),
    ...(paymentTerms && { paymentTerms }),
    ...(isUrgent !== undefined && { isUrgent: Boolean(isUrgent) }),
    ...(vehicleMode && { vehicleMode: (vehicleMode === 'PARTY_VEHICLE' || vehicleMode === 'THIRD_PARTY') ? vehicleMode : 'OUR_FLEET' })
  }

  if (items && Array.isArray(items)) {
    updateData.totalAmount = totalAmount
    updateData.items = {
      ...(itemsToDelete.length > 0 && { deleteMany: { id: { in: itemsToDelete } } }),
      ...(itemsToUpdate.length > 0 && { update: itemsToUpdate }),
      ...(itemsToCreate.length > 0 && { create: itemsToCreate })
    }
  }

  updateData.timeline = {
    create: {
      action: existingOrder.parentOrderId ? 'Batch Edited' : 'Order Edited',
      description: existingOrder.parentOrderId
        ? `Batch ${existingOrder.batchNumber || ''} details were modified.`
        : 'Order details were modified.',
      performedById: user.id
    }
  }

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, company: true, city: true, latitude: true, longitude: true, landmark: true } },
      salesPerson: { select: { name: true } },
      billingStatus: { select: { status: true, invoiceNumber: true } },
      packingStatus: { select: { status: true, assignedToId: true } },
      deliveryStatus: { select: { status: true, driverName: true } },
      items: { include: { product: true } }
    }
  })

  // If editing a child batch, ensure any new products added are also reflected in the master order
  if (existingOrder.parentOrderId && items && Array.isArray(items)) {
    try {
      const masterOrder = await prisma.order.findUnique({
        where: { id: existingOrder.parentOrderId },
        include: { items: true }
      })

      if (masterOrder) {
        let masterOrderUpdated = false
        for (const item of items) {
          const existingMasterItem = masterOrder.items.find(mi => mi.productId === item.productId)
          if (!existingMasterItem) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } })
            if (product) {
              const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.price)
              const qty = Number(item.quantity) || 1
              const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : 18
              const isTaxInclusive = Boolean(item.isTaxInclusive)
              let taxableAmount = 0
              let taxAmount = 0
              let lineTotal = 0

              if (isTaxInclusive) {
                lineTotal = Number((qty * unitPrice).toFixed(2))
                taxableAmount = taxRate > 0 ? Number((lineTotal / (1 + (taxRate / 100))).toFixed(2)) : lineTotal
                taxAmount = Number((lineTotal - taxableAmount).toFixed(2))
              } else {
                taxableAmount = Number((qty * unitPrice).toFixed(2))
                taxAmount = Number((taxableAmount * (taxRate / 100)).toFixed(2))
                lineTotal = Number((taxableAmount + taxAmount).toFixed(2))
              }

              await prisma.orderItem.create({
                data: {
                  orderId: masterOrder.id,
                  productId: product.id,
                  sku: product.sku,
                  productName: product.name,
                  quantity: qty,
                  approvedQuantity: qty,
                  packedQuantity: 0,
                  unitPrice,
                  taxRate,
                  taxAmount,
                  totalPrice: lineTotal,
                  isTaxInclusive,
                  applyLastPrice: Boolean(item.applyLastPrice),
                  itemNotes: item.itemNotes ? String(item.itemNotes) : null
                }
              })
              masterOrderUpdated = true
            }
          }
        }

        if (masterOrderUpdated) {
          const allMasterItems = await prisma.orderItem.findMany({ where: { orderId: masterOrder.id } })
          const newMasterTotal = allMasterItems.reduce((sum, itm) => sum + Number(itm.totalPrice || 0), 0)
          await prisma.order.update({
            where: { id: masterOrder.id },
            data: {
              totalAmount: Number(newMasterTotal.toFixed(2)),
              timeline: {
                create: {
                  action: 'Master Order Updated',
                  description: `New item(s) added via Batch ${existingOrder.batchNumber || ''}`,
                  performedById: user.id
                }
              }
            }
          })
        }
      }
    } catch (syncErr) {
      console.error('[Batch Sync] Failed to sync new items to master order:', syncErr)
    }
  }

  // Non-blocking Push Notification dispatch when order is edited
  if (await isNotificationEnabled('order_edits')) {
    try {
      let editorName = user?.name || 'Team member'
      if (user?.id) {
        const liveUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true }
        })
        if (liveUser?.name) editorName = liveUser.name
      }
      const customerName = order.customer?.name || order.customer?.company || 'Customer'
      const totalFormatted = order.totalAmount ? `₹${order.totalAmount.toLocaleString('en-IN')}` : ''
      const relatedUserIds = [order.salesPersonId, (order.packingStatus as any)?.assignedToId].filter(Boolean) as string[]
      await sendPushNotification({
        title: `Order Updated: ${order.orderNumber}`,
        body: `${customerName}${totalFormatted ? ' • ' + totalFormatted : ''} • Modified by ${editorName}`,
        userIds: relatedUserIds,
        data: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          type: 'ORDER_EDITED'
        }
      })
    } catch (pushErr) {
      console.warn('[FCM] Order edit push failed:', pushErr)
    }
  }

  await broadcastRealtimeEvent('sm_orders_realtime', 'ORDER_CHANGE', {
    type: 'ORDER_CHANGE',
    action: 'ORDER_EDITED',
    orderId: order.id,
    order
  })

  return order
})
