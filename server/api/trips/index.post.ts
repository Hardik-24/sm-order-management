import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['ADMIN', 'DELIVERY', 'SALES'])
  const body = await readBody(event)

  const { driverId, driverName, driverPhone, vehicleNumber, notes, stops } = body

  if (!driverId || !driverName) {
    throw createError({ statusCode: 400, message: 'Please select a driver for this trip' })
  }

  if (!Array.isArray(stops) || stops.length === 0) {
    throw createError({ statusCode: 400, message: 'Please add at least one order to the trip manifest' })
  }

  // 1. Validate all stops have coordinates
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]
    if (!s.orderId) {
      throw createError({ statusCode: 400, message: `Stop #${i + 1} is missing an order ID` })
    }
    const lat = Number(s.latitude)
    const lng = Number(s.longitude)
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      throw createError({
        statusCode: 400,
        message: `Stop #${i + 1} (${s.customerName || 'Order'}) is missing a GPS delivery pin. Please set a location pin before dispatching.`
      })
    }
  }

  // 2. Generate Trip Number (e.g. TR-2026-0042)
  const currentYear = new Date().getFullYear()
  const tripCount = await prisma.trip.count()
  const tripNumber = `TR-${currentYear}-${String(tripCount + 1).padStart(4, '0')}`

  // 3. Create Trip and Stops in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const newTrip = await tx.trip.create({
      data: {
        tripNumber,
        driverId,
        driverName,
        driverPhone: driverPhone || null,
        vehicleNumber: vehicleNumber || null,
        notes: notes || null,
        status: 'PLANNED',
        stops: {
          create: stops.map((s: any, idx: number) => ({
            orderId: s.orderId,
            stopSequence: s.stopSequence !== undefined ? Number(s.stopSequence) : idx + 1,
            customerAddressId: s.customerAddressId || null,
            customerName: s.customerName || 'Customer',
            customerPhone: s.customerPhone || null,
            addressLine: s.addressLine || '',
            city: s.city || null,
            landmark: s.landmark || null,
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
            status: 'PENDING'
          }))
        }
      },
      include: {
        stops: {
          orderBy: { stopSequence: 'asc' },
          include: {
            order: true
          }
        }
      }
    })

    // 4. Assign each order to driver in PLANNED trip (Driver will start the trip)
    for (const s of stops) {
      const existingOrder = await tx.order.findUnique({
        where: { id: s.orderId },
        include: { billingStatus: true, packingStatus: true }
      })

      const bStatus = existingOrder?.billingStatus?.status || 'PENDING'
      const pStatus = existingOrder?.packingStatus?.status || 'PENDING'
      const newOverallStatus = (bStatus === 'GENERATED' && pStatus === 'PACKED') ? 'READY' : (existingOrder?.overallStatus || 'PROCESSING')

      await tx.order.update({
        where: { id: s.orderId },
        data: {
          overallStatus: newOverallStatus,
          deliveryAddress: s.addressLine || undefined,
          deliveryAddressId: s.customerAddressId || undefined,
          deliveryStatus: {
            upsert: {
              create: {
                status: 'ASSIGNED',
                driverName
              },
              update: {
                status: 'ASSIGNED',
                driverName
              }
            }
          },
          timeline: {
            create: {
              action: 'Trip Assigned',
              description: `Assigned to Trip ${tripNumber} (Stop #${s.stopSequence || 1}) with driver ${driverName} (${vehicleNumber || 'Standard Fleet'}). Waiting for driver departure.`,
              performedById: user.id
            }
          }
        }
      })
    }

    return newTrip
  })

  return {
    success: true,
    trip: result
  }
})
