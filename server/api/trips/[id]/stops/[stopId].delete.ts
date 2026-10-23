import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { deleteTrip } from '~~/server/utils/driverTrips'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'DELIVERY', 'SALES'])

  const tripId = event.context.params?.id
  const stopId = event.context.params?.stopId

  if (!tripId || !stopId) {
    throw createError({ statusCode: 400, message: 'Missing trip ID or stop ID' })
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
        orderBy: { stopSequence: 'asc' },
        include: {
          order: {
            include: {
              billingStatus: true,
              packingStatus: true,
              deliveryStatus: true
            }
          }
        }
      }
    }
  })

  if (!trip) {
    throw createError({ statusCode: 404, message: 'Trip not found' })
  }

  const targetStop = trip.stops.find(s => s.id === stopId)
  if (!targetStop) {
    throw createError({ statusCode: 404, message: 'Stop not found in this trip' })
  }

  let tripDeleted = false

  await prisma.$transaction(async (tx) => {
    // 1. Revert order status if not delivered
    if (targetStop.order && targetStop.order.deliveryStatus?.status !== 'DELIVERED') {
      const bStatus = targetStop.order.billingStatus?.status || 'PENDING'
      const pStatus = targetStop.order.packingStatus?.status || 'PENDING'
      const revertedOverallStatus = (bStatus === 'GENERATED' && pStatus === 'PACKED')
        ? 'READY'
        : (targetStop.order.overallStatus === 'DISPATCHED' ? 'PROCESSING' : targetStop.order.overallStatus)

      await tx.order.update({
        where: { id: targetStop.orderId },
        data: {
          overallStatus: revertedOverallStatus,
          deliveryStatus: {
            update: {
              status: 'WAITING',
              driverName: null,
              dispatchDate: null,
              eta: null
            }
          },
          timeline: {
            create: {
              action: 'Removed from Trip',
              description: `Removed from Trip ${trip.tripNumber} by ${user?.name || 'Staff'}. Order returned to Waiting for Delivery.`,
              performedById: user?.id || targetStop.order.salesPersonId
            }
          }
        }
      })

      try {
        await deleteTrip(targetStop.orderId)
      } catch (e) {}
    }

    // 2. Delete the trip stop
    await tx.tripStop.delete({
      where: { id: stopId }
    })

    // 3. Check remaining stops
    const remainingStops = trip.stops.filter(s => s.id !== stopId)
    if (remainingStops.length === 0) {
      // If no stops left, delete the empty trip
      await tx.trip.delete({
        where: { id: tripId }
      })
      tripDeleted = true
    } else {
      // Re-sequence remaining stops
      for (let i = 0; i < remainingStops.length; i++) {
        const s = remainingStops[i]
        const newSeq = i + 1
        if (s.stopSequence !== newSeq) {
          await tx.tripStop.update({
            where: { id: s.id },
            data: { stopSequence: newSeq }
          })
        }
      }
      await tx.trip.update({
        where: { id: tripId },
        data: { updatedAt: new Date() }
      })
    }
  })

  return {
    success: true,
    tripDeleted,
    message: tripDeleted
      ? `Order removed and empty Trip ${trip.tripNumber} deleted.`
      : `Order removed from Trip ${trip.tripNumber}.`
  }
})
