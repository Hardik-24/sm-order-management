import { prisma } from '~~/server/utils/prisma'
import { getTrip } from '~~/server/utils/driverTrips'
import { resolveDestinationPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  const orderNumber = event.context.params?.orderNumber
  if (!orderNumber) {
    throw createError({ statusCode: 400, message: 'Missing order number' })
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { equals: orderNumber, mode: 'insensitive' } },
        { id: orderNumber }
      ]
    },
    include: {
      customer: true,
      deliveryStatus: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })

  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }

  const pin = resolveDestinationPin(
    order.customerId,
    order.customer.name,
    order.deliveryAddress,
    order.customer.city,
    order.customer
  )
  const destCoords = pin
    ? { lat: pin.lat, lng: pin.lng }
    : (order.customer.latitude && order.customer.longitude
        ? { lat: order.customer.latitude, lng: order.customer.longitude }
        : null)

  const isDispatched = order.deliveryStatus?.status === 'DISPATCHED'
  const isDelivered = order.deliveryStatus?.status === 'DELIVERED'

  // Read real trip from Supabase only if actively dispatched or completed
  const trip = (isDispatched || isDelivered) ? await getTrip(order.id) : null

  // If trip exists but destination wasn't set at start time, patch it with the current pin
  if (trip && destCoords && (!trip.destinationCoords?.lat || !trip.destinationCoords?.lng)) {
    trip.destinationCoords = destCoords
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    customerCompany: order.customer.company,
    deliveryAddress: order.deliveryAddress,
    orderDate: order.orderDate,
    overallStatus: order.overallStatus,
    deliveryStatus: order.deliveryStatus?.status || 'WAITING',
    holdReason: order.deliveryStatus?.holdReason || null,
    driverName: order.deliveryStatus?.driverName || trip?.driverName || (order.deliveryStatus?.status === 'ASSIGNED' ? 'Assigned Driver' : null),
    driverPhone: '+91 98765 43210',
    dispatchDate: order.deliveryStatus?.dispatchDate,
    eta: order.deliveryStatus?.eta,
    deliveredAt: order.deliveryStatus?.deliveredAt,
    items: order.items.map((i) => ({
      id: i.id,
      sku: i.sku,
      productName: i.productName,
      quantity: i.quantity,
      unit: i.product?.unit || 'SHEET',
    })),
    trip: trip ? {
      status: trip.status,
      startTime: trip.startTime,
      endTime: trip.endTime,
      durationMinutes: trip.durationMinutes,
      totalDistanceKm: trip.totalDistanceKm,
      calculatedPayout: trip.calculatedPayout,
      startLocation: trip.startLocation,
      currentLocation: trip.currentLocation,
      destinationCoords: trip.destinationCoords,
      route: trip.route,
    } : null
  }
})
