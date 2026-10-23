import { requireActionPermission, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { syncOrderTripState } from '~~/server/utils/tripSync'
import type { OrderStatus, BillingState, PackingState, DeliveryState } from '@prisma/client'

function calculateOverallStatus(billing: string, packing: string, delivery: string): OrderStatus {
  if (delivery === 'DELIVERED') return 'DELIVERED'
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED'
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY'
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING'
  return 'CONFIRMED'
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireActionPermission(event, 'canEditOrderStatus')

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event) || {}
  const {
    isApproved,
    billingStatus,
    invoiceNumber,
    billingHoldReason,
    packingStatus,
    packingHoldReason,
    deliveryStatus,
    deliveryHoldReason,
    driverName,
    overallStatus: explicitOverallStatus,
    autoCalculateOverall = true,
    notes
  } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      paymentStatus: true,
      items: true
    }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  // Build changes list for audit trail
  const changes: string[] = []

  // 1. Approval
  let targetIsApproved = order.isApproved
  let approvedById = order.approvedById
  let approvedAt = order.approvedAt
  if (typeof isApproved === 'boolean' && isApproved !== order.isApproved) {
    targetIsApproved = isApproved
    approvedById = isApproved ? (order.approvedById || user.id) : null
    approvedAt = isApproved ? (order.approvedAt || new Date()) : null
    changes.push(`Approval: ${order.isApproved ? 'Approved' : 'Pending'} → ${isApproved ? 'Approved' : 'Pending'}`)
  }

  // 2. Billing
  const targetBilling = (billingStatus as BillingState) || order.billingStatus?.status || 'PENDING'
  const billingUpdate: any = {}
  if (billingStatus && billingStatus !== order.billingStatus?.status) {
    changes.push(`Billing: ${order.billingStatus?.status || 'PENDING'} → ${billingStatus}`)
    billingUpdate.status = billingStatus
    if (billingStatus === 'GENERATED') {
      billingUpdate.generatedById = order.billingStatus?.generatedById || user.id
      billingUpdate.generatedAt = order.billingStatus?.generatedAt || new Date()
      if (invoiceNumber) billingUpdate.invoiceNumber = invoiceNumber
      billingUpdate.holdReason = null
    } else if (billingStatus === 'PENDING') {
      billingUpdate.invoiceNumber = null
      billingUpdate.generatedById = null
      billingUpdate.generatedAt = null
      billingUpdate.holdReason = null
    } else if (billingStatus === 'ON_HOLD') {
      billingUpdate.holdReason = billingHoldReason || 'Administrative hold'
    } else if (billingStatus === 'ERROR') {
      billingUpdate.holdReason = billingHoldReason || 'Billing calculation error flagged'
    } else {
      billingUpdate.holdReason = null
    }
  } else if (invoiceNumber && invoiceNumber !== order.billingStatus?.invoiceNumber) {
    billingUpdate.invoiceNumber = invoiceNumber
  }

  // 3. Packing
  const targetPacking = (packingStatus as PackingState) || order.packingStatus?.status || 'PENDING'
  const packingUpdate: any = {}
  let shouldMarkItemsPacked = false
  let shouldResetItemsPacked = false
  if (packingStatus && packingStatus !== order.packingStatus?.status) {
    changes.push(`Packing: ${order.packingStatus?.status || 'PENDING'} → ${packingStatus}`)
    packingUpdate.status = packingStatus
    if (packingStatus === 'PACKED') {
      packingUpdate.packedAt = order.packingStatus?.packedAt || new Date()
      packingUpdate.holdReason = null
      shouldMarkItemsPacked = true
    } else if (packingStatus === 'PENDING') {
      packingUpdate.packedAt = null
      packingUpdate.assignedToId = null
      packingUpdate.holdReason = null
      shouldResetItemsPacked = true
    } else if (packingStatus === 'IN_PROGRESS') {
      packingUpdate.packedAt = null
      packingUpdate.holdReason = null
    } else if (packingStatus === 'ON_HOLD') {
      packingUpdate.holdReason = packingHoldReason || 'Administrative hold'
    } else {
      packingUpdate.holdReason = null
    }
  }

  // 4. Delivery
  const targetDelivery = (deliveryStatus as DeliveryState) || order.deliveryStatus?.status || 'WAITING'
  const deliveryUpdate: any = {}
  if (deliveryStatus && deliveryStatus !== order.deliveryStatus?.status) {
    changes.push(`Delivery: ${order.deliveryStatus?.status || 'WAITING'} → ${deliveryStatus}`)
    deliveryUpdate.status = deliveryStatus
    if (deliveryStatus === 'WAITING') {
      deliveryUpdate.driverName = null
      deliveryUpdate.dispatchDate = null
      deliveryUpdate.eta = null
      deliveryUpdate.deliveredAt = null
      deliveryUpdate.holdReason = null
    } else if (deliveryStatus === 'ASSIGNED') {
      if (driverName !== undefined) deliveryUpdate.driverName = driverName || null
      deliveryUpdate.deliveredAt = null
      deliveryUpdate.holdReason = null
    } else if (deliveryStatus === 'DISPATCHED') {
      deliveryUpdate.dispatchDate = order.deliveryStatus?.dispatchDate || new Date()
      if (driverName !== undefined) deliveryUpdate.driverName = driverName || null
      deliveryUpdate.deliveredAt = null
      deliveryUpdate.holdReason = null
    } else if (deliveryStatus === 'DELIVERED') {
      deliveryUpdate.deliveredAt = order.deliveryStatus?.deliveredAt || new Date()
      if (driverName !== undefined) deliveryUpdate.driverName = driverName || null
      deliveryUpdate.holdReason = null
    } else if (deliveryStatus === 'ON_HOLD') {
      deliveryUpdate.holdReason = deliveryHoldReason || 'Administrative hold'
    } else {
      deliveryUpdate.holdReason = null
    }
  } else if (driverName && driverName !== order.deliveryStatus?.driverName) {
    deliveryUpdate.driverName = driverName
  }

  // 5. Overall Status
  let targetOverall: OrderStatus = order.overallStatus
  if (explicitOverallStatus && (!autoCalculateOverall || explicitOverallStatus === 'CANCELLED')) {
    if (explicitOverallStatus !== order.overallStatus) {
      changes.push(`Overall: ${order.overallStatus} → ${explicitOverallStatus}`)
      targetOverall = explicitOverallStatus as OrderStatus
    }
  } else if (autoCalculateOverall) {
    if (order.overallStatus !== 'CANCELLED') {
      const calculated = calculateOverallStatus(targetBilling, targetPacking, targetDelivery)
      if (calculated !== order.overallStatus) {
        changes.push(`Overall (auto): ${order.overallStatus} → ${calculated}`)
        targetOverall = calculated
      }
    }
  }

  if (changes.length === 0 && !notes) {
    return { success: true, message: 'No status changes detected', order }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Order root updates
    await tx.order.update({
      where: { id },
      data: {
        isApproved: targetIsApproved,
        approvedById,
        approvedAt,
        overallStatus: targetOverall
      }
    })

    // 2. Billing updates
    if (Object.keys(billingUpdate).length > 0) {
      await tx.billingStatus.upsert({
        where: { orderId: id },
        create: { orderId: id, ...billingUpdate },
        update: billingUpdate
      })
    }

    // 3. Packing updates
    if (Object.keys(packingUpdate).length > 0) {
      await tx.packingStatus.upsert({
        where: { orderId: id },
        create: { orderId: id, ...packingUpdate },
        update: packingUpdate
      })
    }

    // If marked PACKED, sync item packed quantities if they were pending
    if (shouldMarkItemsPacked && order.items.length > 0) {
      for (const itm of order.items) {
        const fullQty = itm.approvedQuantity ?? itm.quantity
        await tx.orderItem.update({
          where: { id: itm.id },
          data: {
            packedQuantity: fullQty,
            isPacked: true
          }
        })
      }
    } else if (shouldResetItemsPacked && order.items.length > 0) {
      for (const itm of order.items) {
        await tx.orderItem.update({
          where: { id: itm.id },
          data: {
            packedQuantity: 0,
            isPacked: false
          }
        })
      }
    }

    // 4. Delivery updates
    if (Object.keys(deliveryUpdate).length > 0) {
      await tx.deliveryStatus.upsert({
        where: { orderId: id },
        create: { orderId: id, ...deliveryUpdate },
        update: deliveryUpdate
      })
    }

    // 4b. Synchronize Trip & TripStop manifest
    if (deliveryStatus) {
      await syncOrderTripState(tx, id, deliveryStatus, {
        driverName: deliveryUpdate.driverName,
        notes: deliveryHoldReason || notes,
        userId: user.id
      })
    } else if (explicitOverallStatus === 'CANCELLED') {
      await syncOrderTripState(tx, id, 'CANCELLED', {
        notes: notes || 'Cancelled by admin',
        userId: user.id
      })
    }

    // 5. Timeline entry
    const reasonText = notes?.trim() ? ` | Reason: ${notes.trim()}` : ''
    const changeSummary = changes.length > 0 ? changes.join(', ') : 'No status values modified'
    await tx.orderTimeline.create({
      data: {
        orderId: id,
        action: 'Admin Status Override',
        description: `Admin status update: ${changeSummary}${reasonText}`,
        performedById: user.id
      }
    })

    // Refetch full order with relations
    return await tx.order.findUnique({
      where: { id },
      include: {
        customer: true,
        salesPerson: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        items: { include: { product: true } },
        billingStatus: { include: { generatedBy: { select: { id: true, name: true } } } },
        packingStatus: { include: { assignedTo: { select: { id: true, name: true } } } },
        deliveryStatus: true,
        paymentStatus: true,
        timeline: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { timestamp: 'desc' }
        }
      }
    })
  }, {
    maxWait: 10000,
    timeout: 25000
  })

  return {
    success: true,
    changes,
    order: result
  }
})
