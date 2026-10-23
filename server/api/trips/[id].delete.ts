import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { deleteTrip } from '~~/server/utils/driverTrips'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'DELIVERY', 'SALES'])

  const tripId = event.context.params?.id
  if (!tripId) {
    throw createError({ statusCode: 400, message: 'Missing trip ID' })
  }

  // Find trip with all stops and orders
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
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

  // Transaction to update orders and delete trip
  await prisma.$transaction(async (tx) => {
    for (const stop of trip.stops) {
      if (stop.order) {
        // If the order has not been delivered, return it to WAITING
        const currentDeliveryStatus = stop.order.deliveryStatus?.status
        if (currentDeliveryStatus !== 'DELIVERED') {
          const bStatus = stop.order.billingStatus?.status || 'PENDING'
          const pStatus = stop.order.packingStatus?.status || 'PENDING'
          const revertedOverallStatus = (bStatus === 'GENERATED' && pStatus === 'PACKED')
            ? 'READY'
            : (stop.order.overallStatus === 'DISPATCHED' ? 'PROCESSING' : stop.order.overallStatus)

          await tx.order.update({
            where: { id: stop.orderId },
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
                  action: 'Trip Deleted',
                  description: `Trip ${trip.tripNumber} was deleted by ${user?.name || 'Staff'}. Order returned to Waiting for Delivery.`,
                  performedById: user?.id || stop.order.salesPersonId
                }
              }
            }
          })

          // Clear any trip route record
          try {
            await deleteTrip(stop.orderId)
          } catch (e) {
            // Ignore if no route
          }
        }
      }
    }

    // Delete the trip record (stops cascade delete via onDelete: Cascade)
    await tx.trip.delete({
      where: { id: tripId }
    })
  })

  return {
    success: true,
    message: `Trip ${trip.tripNumber} deleted successfully. All orders returned to Waiting for Delivery.`
  }
})
