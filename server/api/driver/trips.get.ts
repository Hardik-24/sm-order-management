import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['ADMIN', 'DELIVERY'])

  const whereClause: any = {
    status: { in: ['PLANNED', 'IN_TRANSIT'] }
  }

  // If driver, filter by driverId or driverName
  if (user.role === 'DELIVERY') {
    whereClause.OR = [
      { driverId: user.id },
      { driverName: user.name }
    ]
  }

  const trips = await prisma.trip.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      stops: {
        orderBy: { stopSequence: 'asc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              overallStatus: true,
              deliveryStatus: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  company: true,
                  phone: true,
                  city: true
                }
              },
              items: {
                select: {
                  id: true,
                  sku: true,
                  productName: true,
                  quantity: true,
                  unitPrice: true,
                  unit: true
                }
              }
            }
          }
        }
      }
    }
  })

  // Format stops for clean mobile consumption
  const formattedTrips = trips.map((trip) => {
    const stops = trip.stops.map((stop) => {
      const order = stop.order
      return {
        id: stop.id,
        stopSequence: stop.stopSequence,
        status: stop.status,
        deliveredAt: stop.deliveredAt,
        proofUrl: stop.proofUrl,
        notes: stop.notes,
        orderId: stop.orderId,
        orderNumber: order?.orderNumber || '',
        customerName: stop.customerName,
        customerCompany: order?.customer?.company || '',
        customerPhone: stop.customerPhone || order?.customer?.phone || '',
        addressLine: stop.addressLine,
        city: stop.city || order?.customer?.city || '',
        landmark: stop.landmark,
        coords: {
          lat: stop.latitude,
          lng: stop.longitude
        },
        itemsCount: order?.items?.length || 0,
        items: order?.items || [],
        totalAmount: Number(order?.totalAmount || 0),
        holdReason: order?.deliveryStatus?.holdReason || null
      }
    })

    const completedStops = stops.filter((s) => s.status === 'DELIVERED').length
    const nextStop = stops.find((s) => s.status === 'PENDING' || s.status === 'IN_TRANSIT') || null

    return {
      id: trip.id,
      tripNumber: trip.tripNumber,
      driverId: trip.driverId,
      driverName: trip.driverName,
      driverPhone: trip.driverPhone,
      vehicleNumber: trip.vehicleNumber || 'Standard Delivery',
      status: trip.status,
      startTime: trip.startTime ? new Date(trip.startTime).getTime() : null,
      totalDistanceKm: trip.totalDistanceKm,
      calculatedPayout: trip.calculatedPayout,
      totalStops: stops.length,
      completedStops,
      nextStop,
      stops
    }
  })

  return {
    success: true,
    trips: formattedTrips
  }
})
