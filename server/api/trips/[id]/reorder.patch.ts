import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN', 'DELIVERY', 'SALES'])
  const tripId = event.context.params?.id
  if (!tripId) {
    throw createError({ statusCode: 400, message: 'Missing trip ID' })
  }

  const body = await readBody(event)
  const { stopOrder } = body

  if (!Array.isArray(stopOrder) || stopOrder.length === 0) {
    throw createError({ statusCode: 400, message: 'Invalid stopOrder array' })
  }

  // Verify trip exists
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { stops: true }
  })

  if (!trip) {
    throw createError({ statusCode: 404, message: 'Trip not found' })
  }

  // Update stop sequences in a transaction
  await prisma.$transaction(
    stopOrder.map((item: { stopId: string; stopSequence: number }) =>
      prisma.tripStop.update({
        where: { id: item.stopId },
        data: { stopSequence: Number(item.stopSequence) }
      })
    )
  )

  const updatedTrip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
        orderBy: { stopSequence: 'asc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              deliveryStatus: true,
              customer: true
            }
          }
        }
      }
    }
  })

  return {
    success: true,
    trip: updatedTrip
  }
})
