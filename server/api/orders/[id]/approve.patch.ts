import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])

  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const body = await readBody(event) || {}
  const { items, approvalNotes } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  if (order.overallStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, message: 'Cannot approve a cancelled order' })
  }

  // Update item-level approved quantities and unit prices if provided
  let newTotal = 0
  if (Array.isArray(items) && items.length > 0) {
    for (const itm of items) {
      const existing = order.items.find(i => i.id === itm.id)
      if (existing) {
        const approvedQty = itm.approvedQuantity !== undefined ? Number(itm.approvedQuantity) : (existing.approvedQuantity ?? existing.quantity)
        const unitPrice = itm.unitPrice !== undefined ? Number(itm.unitPrice) : Number(existing.unitPrice)
        newTotal += (approvedQty * unitPrice)

        await prisma.orderItem.update({
          where: { id: itm.id },
          data: {
            approvedQuantity: approvedQty,
            unitPrice: unitPrice
          }
        })
      }
    }
  } else {
    // If items were not passed, default approvedQuantity to ordered quantity for each item
    for (const item of order.items) {
      const approvedQty = item.approvedQuantity ?? item.quantity
      newTotal += (approvedQty * Number(item.unitPrice))
      if (item.approvedQuantity === null) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { approvedQuantity: approvedQty }
        })
      }
    }
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      isApproved: true,
      approvedById: user.id,
      approvedAt: new Date(),
      totalAmount: newTotal > 0 ? newTotal : order.totalAmount,
      timeline: {
        create: {
          action: 'Order Approved',
          description: `Order approved by ${user.name}${approvalNotes ? ` (${approvalNotes})` : ''}`,
          performedById: user.id
        }
      }
    },
    include: {
      customer: true,
      items: { include: { product: true } },
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      timeline: { include: { performedBy: true }, orderBy: { timestamp: 'desc' } }
    }
  })

  return updatedOrder
})
