import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { resolveDestinationPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = event.context.params?.id

  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      salesPerson: true,
      items: { include: { product: true } },
      billingStatus: { include: { generatedBy: true } },
      packingStatus: { include: { assignedTo: true } },
      deliveryStatus: true,
      timeline: { include: { performedBy: true }, orderBy: { timestamp: 'desc' } }
    }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  const pin = resolveDestinationPin(
    order.customerId,
    order.customer?.name,
    order.deliveryAddress,
    order.customer?.city,
    order.customer
  )

  return {
    ...order,
    destinationCoords: pin ? { lat: pin.lat, lng: pin.lng, areaName: pin.areaName, landmark: pin.landmark } : null,
    hasDestinationPin: !!pin,
  }
})
