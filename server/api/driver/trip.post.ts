import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { startTrip, recordTripPing, completeTrip, getTrip } from '~~/server/utils/driverTrips'
import { resolveDestinationPin } from '~~/server/utils/customerPins'

function calculateOverallStatus(billing: string, packing: string, delivery: string) {
  if (delivery === 'DELIVERED') return 'DELIVERED'
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED'
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY'
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING'
  return 'CONFIRMED'
}

const pingRateLimits = new Map<string, number>()

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['ADMIN', 'DELIVERY'])
  const body = await readBody(event)

  const { action, orderId, tripId, stopId, coords } = body

  // ───────────────────────────────────────────────────────────────────────────
  // ACTION: DELIVER_STOP (Deliver an individual stop in a multi-stop trip manifest)
  // ───────────────────────────────────────────────────────────────────────────
  if (action === 'deliver_stop') {
    if (!stopId && !orderId) {
      throw createError({ statusCode: 400, message: 'Missing stopId or orderId to deliver stop' })
    }

    const stop = await prisma.tripStop.findFirst({
      where: stopId ? { id: stopId } : { orderId, tripId },
      include: {
        trip: {
          include: { stops: true }
        },
        order: {
          include: { customer: true, deliveryStatus: true, billingStatus: true, packingStatus: true }
        }
      }
    })

    if (!stop) {
      throw createError({ statusCode: 404, message: 'Trip stop not found' })
    }

    // 1. Mark Stop as DELIVERED
    await prisma.tripStop.update({
      where: { id: stop.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        proofUrl: body.proofUrl || null,
        notes: body.notes || null
      }
    })

    // 2. Mark the corresponding Order as DELIVERED
    await prisma.order.update({
      where: { id: stop.orderId },
      data: {
        overallStatus: 'DELIVERED',
        deliveryStatus: {
          update: {
            status: 'DELIVERED',
            deliveredAt: new Date()
          }
        },
        timeline: {
          create: {
            action: 'Stop Delivered',
            description: `Driver ${user.name} delivered Stop #${stop.stopSequence} (${stop.customerName}) at ${stop.addressLine}.`,
            performedById: user.id
          }
        }
      }
    })

    // 3. Complete standalone trip route record if it exists
    try {
      await completeTrip(stop.orderId, coords, {
        orderNumber: stop.order.orderNumber,
        customerName: stop.customerName,
        deliveryAddress: stop.addressLine,
        driverId: user.id,
        driverName: user.name
      })
    } catch (ignored) {}

    // 4. Check if all stops in this Trip are now DELIVERED
    const remainingStops = await prisma.tripStop.count({
      where: {
        tripId: stop.tripId,
        status: { not: 'DELIVERED' }
      }
    })

    let isTripCompleted = false
    if (remainingStops === 0) {
      isTripCompleted = true
      await prisma.trip.update({
        where: { id: stop.tripId },
        data: {
          status: 'COMPLETED',
          endTime: new Date()
        }
      })
    }

    const updatedTrip = await prisma.trip.findUnique({
      where: { id: stop.tripId },
      include: {
        stops: { orderBy: { stopSequence: 'asc' } }
      }
    })

    return {
      success: true,
      stopId: stop.id,
      orderId: stop.orderId,
      isTripCompleted,
      trip: updatedTrip
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ensure orderId exists for standard single-order / start / ping / complete
  // ───────────────────────────────────────────────────────────────────────────
  let targetOrderId = orderId
  if (!targetOrderId && tripId) {
    const firstStop = await prisma.tripStop.findFirst({
      where: { tripId },
      orderBy: { stopSequence: 'asc' }
    })
    if (firstStop) {
      targetOrderId = firstStop.orderId
    }
  }

  if (!targetOrderId) {
    throw createError({ statusCode: 400, message: 'Missing orderId or tripId' })
  }

  const order = await prisma.order.findUnique({
    where: { id: targetOrderId },
    include: { customer: true, deliveryStatus: true, billingStatus: true, packingStatus: true }
  })

  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACTION: START
  // ───────────────────────────────────────────────────────────────────────────
  if (action === 'start') {
    if (!coords?.lat || !coords?.lng) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot start trip: GPS location not available. Please allow location access and try again.'
      })
    }

    // If tripId provided, update Trip status to IN_TRANSIT
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'IN_TRANSIT',
          startTime: new Date(),
          startLat: Number(coords.lat),
          startLng: Number(coords.lng),
          currentLat: Number(coords.lat),
          currentLng: Number(coords.lng)
        }
      }).catch(() => {})

      // Update all stops and their orders in this trip to DISPATCHED
      try {
        const tripStops = await prisma.tripStop.findMany({
          where: { tripId },
          include: { order: { include: { billingStatus: true, packingStatus: true } } }
        })

        for (const ts of tripStops) {
          if (ts.status === 'PENDING') {
            await prisma.tripStop.update({
              where: { id: ts.id },
              data: { status: 'IN_TRANSIT' }
            }).catch(() => {})
          }
          await prisma.order.update({
            where: { id: ts.orderId },
            data: {
              overallStatus: 'DISPATCHED',
              deliveryStatus: {
                upsert: {
                  create: {
                    status: 'DISPATCHED',
                    driverName: user.name,
                    dispatchDate: new Date()
                  },
                  update: {
                    status: 'DISPATCHED',
                    driverName: user.name,
                    dispatchDate: new Date()
                  }
                }
              },
              timeline: {
                create: {
                  action: 'Trip Started',
                  description: `Driver ${user.name} started live delivery trip. Tracking active.`,
                  performedById: user.id
                }
              }
            }
          }).catch(() => {})
        }
      } catch (err) {
        console.warn('Failed to dispatch all trip stop orders on trip start:', err)
      }
    }

    // Resolve customer destination pin
    let destCoords: { lat: number; lng: number } | undefined
    const destPin = resolveDestinationPin(
      order.customerId,
      order.customer.name,
      order.deliveryAddress,
      order.customer.city,
      order.customer
    )
    if (destPin) {
      destCoords = { lat: destPin.lat, lng: destPin.lng }
    } else if (order.customer?.latitude && order.customer?.longitude) {
      destCoords = { lat: order.customer.latitude, lng: order.customer.longitude }
    } else if (body.destinationCoords?.lat && body.destinationCoords?.lng) {
      destCoords = body.destinationCoords
    }

    // Start trip in Supabase / driverTrips
    const trip = await startTrip({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      deliveryAddress: order.deliveryAddress,
      driverId: user.id,
      driverName: user.name,
      initialCoords: coords,
      destinationCoords: destCoords,
      ratePerKm: body.ratePerKm || 15
    })

    // Update DB delivery status to DISPATCHED
    await prisma.order.update({
      where: { id: order.id },
      data: {
        overallStatus: calculateOverallStatus(
          order.billingStatus?.status || 'PENDING',
          order.packingStatus?.status || 'PENDING',
          'DISPATCHED'
        ),
        deliveryStatus: {
          update: {
            status: 'DISPATCHED',
            driverName: user.name,
            dispatchDate: new Date()
          }
        },
        timeline: {
          create: {
            action: 'Trip Started',
            description: `Driver ${user.name} started live delivery trip from GPS [${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}]. Tracking active.`,
            performedById: user.id
          }
        }
      }
    })

    return { success: true, trip }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACTION: PING
  // ───────────────────────────────────────────────────────────────────────────
  if (action === 'ping') {
    const now = Date.now()
    const lastPing = pingRateLimits.get(order.id) || 0
    if (now - lastPing < 4000) {
      return {
        success: false,
        error: 'Too many requests. Please wait before pinging again.',
        orderStatus: order.deliveryStatus?.status || 'DISPATCHED',
        holdReason: order.deliveryStatus?.holdReason || null
      }
    }
    pingRateLimits.set(order.id, now)

    const coordsOrPoints = body.points || coords
    if (!coordsOrPoints) {
      throw createError({ statusCode: 400, message: 'Invalid coordinates or points array' })
    }

    const trip = await recordTripPing(order.id, coordsOrPoints)

    // Also update Trip record if tripId is passed
    if (tripId && coords?.lat && coords?.lng) {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          currentLat: Number(coords.lat),
          currentLng: Number(coords.lng),
          totalDistanceKm: trip.totalDistanceKm || undefined,
          calculatedPayout: trip.calculatedPayout || undefined
        }
      }).catch(() => {})
    }

    return {
      success: true,
      trip,
      orderStatus: order.deliveryStatus?.status || 'DISPATCHED',
      holdReason: order.deliveryStatus?.holdReason || null
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACTION: COMPLETE
  // ───────────────────────────────────────────────────────────────────────────
  if (action === 'complete') {
    if (body.points && Array.isArray(body.points) && body.points.length > 0) {
      await recordTripPing(order.id, body.points)
    }

    const trip = await completeTrip(order.id, coords, {
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      deliveryAddress: order.deliveryAddress,
      driverId: user.id,
      driverName: user.name
    })

    // If tripId is present, mark the entire Trip as COMPLETED and all its stops as DELIVERED
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          totalDistanceKm: trip?.totalDistanceKm || undefined,
          calculatedPayout: trip?.calculatedPayout || undefined
        }
      }).catch(() => {})

      await prisma.tripStop.updateMany({
        where: { tripId, status: { not: 'DELIVERED' } },
        data: { status: 'DELIVERED', deliveredAt: new Date() }
      }).catch(() => {})
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        overallStatus: 'DELIVERED',
        deliveryStatus: {
          update: {
            status: 'DELIVERED',
            deliveredAt: new Date()
          }
        },
        timeline: {
          create: {
            action: 'Trip Completed',
            description: `Driver ${user.name} completed delivery. Distance: ${trip?.totalDistanceKm || 0} km. Payout: ₹${trip?.calculatedPayout || 0}.`,
            performedById: user.id
          }
        }
      }
    })

    return { success: true, trip }
  }

  // Action get: return current trip state
  const trip = await getTrip(order.id)
  return { success: true, trip }
})
