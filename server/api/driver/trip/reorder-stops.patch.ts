import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['ADMIN', 'DELIVERY'])
  const body = await readBody(event)

  const { tripId, stopOrder } = body
  if (!tripId || !Array.isArray(stopOrder) || stopOrder.length === 0) {
    throw createError({ statusCode: 400, message: 'Missing tripId or stopOrder' })
  }

  // Ensure trip belongs to driver if role is DELIVERY
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { stops: true }
  })

  if (!trip) {
    throw createError({ statusCode: 404, message: 'Trip not found' })
  }

  if (user.role === 'DELIVERY') {
    const isIdMatch = Boolean(trip.driverId && trip.driverId === user.id)
    const isNameMatch = Boolean(trip.driverName && trip.driverName.trim().toLowerCase() === user.name.trim().toLowerCase())
    if (!isIdMatch && !isNameMatch) {
      throw createError({ statusCode: 403, message: 'You are not assigned to this trip' })
    }
  }

  // Update stop sequences in a transaction
  await prisma.$transaction([
    ...stopOrder.map((item: { stopId: string; stopSequence: number }) =>
      prisma.tripStop.update({
        where: { id: item.stopId },
        data: { stopSequence: Number(item.stopSequence) }
      })
    ),
    prisma.trip.update({
      where: { id: tripId },
      data: { updatedAt: new Date() }
    })
  ])

  const updatedStops = await prisma.tripStop.findMany({
    where: { tripId },
    orderBy: { stopSequence: 'asc' }
  })

  return {
    success: true,
    stops: updatedStops
  }
})
