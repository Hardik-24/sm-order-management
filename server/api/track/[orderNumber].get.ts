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
  let trip = (isDispatched || isDelivered) ? await getTrip(order.id) : null

  // Check if order belongs to a multi-stop Trip manifest
  const stopInfo = await prisma.tripStop.findFirst({
    where: { orderId: order.id },
    include: {
      trip: {
        include: {
          stops: {
            orderBy: { stopSequence: 'asc' }
          }
        }
      }
    }
  })

  // If order trip route isn't set standalone, use manifest Trip coordinates
  if (!trip && stopInfo?.trip && (isDispatched || isDelivered)) {
    const parentTrip = stopInfo.trip
    const breadcrumbs: any[] = Array.isArray(parentTrip.breadcrumbs) ? parentTrip.breadcrumbs : []
    const lastBreadcrumb = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null
    const currentLoc = (parentTrip.currentLat && parentTrip.currentLng)
      ? { lat: parentTrip.currentLat, lng: parentTrip.currentLng, timestamp: Date.now() }
      : lastBreadcrumb

    trip = {
      id: parentTrip.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      deliveryAddress: order.deliveryAddress,
      driverId: parentTrip.driverId,
      driverName: parentTrip.driverName,
      status: parentTrip.status === 'COMPLETED' ? 'COMPLETED' : 'IN_TRANSIT',
      startTime: parentTrip.startTime ? new Date(parentTrip.startTime).getTime() : Date.now(),
      endTime: parentTrip.endTime ? new Date(parentTrip.endTime).getTime() : undefined,
      durationMinutes: parentTrip.durationMinutes ?? undefined,
      totalDistanceKm: parentTrip.totalDistanceKm,
      ratePerKm: parentTrip.ratePerKm,
      calculatedPayout: parentTrip.calculatedPayout,
      startLocation: { lat: parentTrip.startLat || 12.3051, lng: parentTrip.startLng || 76.6551 },
      currentLocation: currentLoc,
      destinationCoords: { lat: stopInfo.latitude, lng: stopInfo.longitude },
      route: breadcrumbs
    }
  }

  // If trip exists but destination wasn't set at start time, patch it with the current pin
  if (trip && destCoords && (!trip.destinationCoords?.lat || !trip.destinationCoords?.lng)) {
    trip.destinationCoords = destCoords
  }

  const stopsAhead = stopInfo
    ? stopInfo.trip.stops.filter(s => s.stopSequence < stopInfo.stopSequence && s.status !== 'DELIVERED').length
    : 0

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
    driverName: order.deliveryStatus?.driverName || trip?.driverName || stopInfo?.trip?.driverName || (order.deliveryStatus?.status === 'ASSIGNED' ? 'Assigned Driver' : null),
    driverPhone: stopInfo?.trip?.driverPhone || '+91 98765 43210',
    dispatchDate: order.deliveryStatus?.dispatchDate,
    eta: order.deliveryStatus?.eta,
    deliveredAt: order.deliveryStatus?.deliveredAt,
    multiStop: stopInfo ? {
      tripNumber: stopInfo.trip.tripNumber,
      stopSequence: stopInfo.stopSequence,
      totalStops: stopInfo.trip.stops.length,
      stopsAhead,
      isNextStop: stopsAhead === 0
    } : null,
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
