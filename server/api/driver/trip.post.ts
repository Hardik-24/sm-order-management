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

  const { action, orderId, coords } = body
  if (!orderId) {
    throw createError({ statusCode: 400, message: 'Missing orderId' })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, deliveryStatus: true, billingStatus: true, packingStatus: true }
  })

  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }

  if (action === 'start') {
    // ── Pin Gate: Require valid driver GPS coords ──────────────────────────────
    if (!coords?.lat || !coords?.lng) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot start trip: GPS location not available. Please allow location access and try again.'
      })
    }

    // ── Resolve customer destination pin ──────────────────────────────────────
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
    // No silent fallback — destCoords may be undefined. The route will just have no destination pin shown.

    // ── Start trip in Supabase ────────────────────────────────────────────────
    const trip = await startTrip({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      deliveryAddress: order.deliveryAddress,
      driverId: user.id,
      driverName: user.name,
      initialCoords: coords,
      destinationCoords: destCoords,
      ratePerKm: body.ratePerKm || 15,
    })

    // ── Update DB delivery status to DISPATCHED ───────────────────────────────
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
            dispatchDate: new Date(),
          }
        },
        timeline: {
          create: {
            action: 'Trip Started',
            description: `Driver ${user.name} started live delivery trip from GPS [${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}]. Tracking active.`,
            performedById: user.id,
          }
        }
      }
    })

    return { success: true, trip }
  }

  if (action === 'ping') {
    const now = Date.now()
    const lastPing = pingRateLimits.get(order.id) || 0
    if (now - lastPing < 4000) {
      // Return 429 to tell client to slow down, but send a valid shape back
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
    return {
      success: true,
      trip,
      orderStatus: order.deliveryStatus?.status || 'DISPATCHED',
      holdReason: order.deliveryStatus?.holdReason || null
    }
  }

  if (action === 'complete') {
    if (body.points && Array.isArray(body.points) && body.points.length > 0) {
      await recordTripPing(order.id, body.points)
    }

    // Freeze trip & route snapshot in Supabase
    const trip = await completeTrip(order.id, coords, {
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      deliveryAddress: order.deliveryAddress,
      driverId: user.id,
      driverName: user.name,
    })

    // Mark order as DELIVERED in DB
    await prisma.order.update({
      where: { id: order.id },
      data: {
        overallStatus: 'DELIVERED',
        deliveryStatus: {
          update: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
          }
        },
        timeline: {
          create: {
            action: 'Trip Completed',
            description: `Driver ${user.name} completed delivery. Distance: ${trip?.totalDistanceKm || 0} km. Payout: ₹${trip?.calculatedPayout || 0}.`,
            performedById: user.id,
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
