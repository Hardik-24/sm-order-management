import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { syncOrderHistoricalPrices } from '~~/server/utils/historicalPrice'

function calculateOverallStatus(billing: string, packing: string, delivery: string) {
  if (delivery === 'DELIVERED') return 'DELIVERED';
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED';
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY';
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING';
  return 'CONFIRMED';
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'BILLING'])
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const body = await readBody(event)
  const { status, invoiceNumber, invoiceDate, invoicePdfUrl, holdReason, items } = body

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      billingStatus: true,
      packingStatus: true,
      deliveryStatus: true,
      items: {
        include: { product: true }
      }
    }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  // Enforcement Gate for Final Invoice Generation
  if (status === 'GENERATED' || invoiceNumber) {
    if (order.customer?.isBusySynced === false) {
      throw createError({
        statusCode: 400,
        message: `Cannot generate invoice: Customer "${order.customer.name}" is a provisional lead. Please link this order to a verified Busy customer ledger first.`
      })
    }

    const unsyncedItem = order.items?.find((i: any) => i.isBusySynced === false || i.product?.isBusySynced === false)
    if (unsyncedItem) {
      throw createError({
        statusCode: 400,
        message: `Cannot generate invoice: Product "${unsyncedItem.sku || unsyncedItem.productName}" is not yet created in Busy. Please enter it in Busy and sync before generating the invoice.`
      })
    }
  }

  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.id) {
        const updateData: any = {}
        if (item.billedQuantity !== undefined) updateData.billedQuantity = Number(item.billedQuantity)
        if (item.unitPrice !== undefined) updateData.unitPrice = Number(item.unitPrice)
        if (item.discount !== undefined) updateData.discount = Number(item.discount)
        if (item.taxRate !== undefined) updateData.taxRate = Number(item.taxRate)
        if (item.taxAmount !== undefined) updateData.taxAmount = Number(item.taxAmount)
        if (item.totalPrice !== undefined) updateData.totalPrice = Number(item.totalPrice)
        await prisma.orderItem.update({
          where: { id: item.id },
          data: updateData
        })
      }
    }
  }

  const billingData: any = { status, invoiceNumber }
  if (invoiceDate) billingData.invoiceDate = new Date(invoiceDate)
  if (invoicePdfUrl) billingData.invoicePdfUrl = invoicePdfUrl
  if (status === 'GENERATED') {
    billingData.generatedById = user.id
    billingData.generatedAt = new Date()
  }
  
  let desc = `Billing status updated to ${status}.`
  if (status === 'ON_HOLD') {
    billingData.holdReason = holdReason
    if (holdReason) desc += ` Reason: ${holdReason}`
  } else {
    billingData.holdReason = null
  }

  const overallStatus = order.overallStatus === 'CANCELLED'
    ? 'CANCELLED'
    : calculateOverallStatus(status, order.packingStatus?.status || 'PENDING', order.deliveryStatus?.status || 'WAITING')

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      overallStatus,
      billingStatus: { update: billingData },
      timeline: {
        create: {
          action: 'Billing Status Updated',
          description: desc,
          performedById: user.id
        }
      }
    },
    include: { billingStatus: true }
  })

  if (status === 'GENERATED') {
    await syncOrderHistoricalPrices(prisma, id, invoiceNumber)
  }

  return updatedOrder
})
