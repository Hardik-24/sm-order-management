import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { resolveDestinationPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = event.context.params?.id

  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { addresses: true } },
      salesPerson: true,
      items: { include: { product: true } },
      billingStatus: { include: { generatedBy: true } },
      packingStatus: { include: { assignedTo: true } },
      deliveryStatus: true,
      paymentStatus: true,
      paymentRecords: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      },
      timeline: { include: { performedBy: true }, orderBy: { timestamp: 'desc' } },
      tripStops: {
        include: {
          trip: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  const pin = resolveDestinationPin(
    order.customerId,
    order.customer?.name,
    order.deliveryAddress,
    order.customer?.city,
    order.customer
  )

  const activeTripStop = order.tripStops?.[0]
  const assignedTrip = activeTripStop?.trip ? {
    id: activeTripStop.trip.id,
    tripNumber: activeTripStop.trip.tripNumber,
    driverId: activeTripStop.trip.driverId,
    driverName: activeTripStop.trip.driverName,
    driverPhone: activeTripStop.trip.driverPhone,
    vehicleNumber: activeTripStop.trip.vehicleNumber,
    status: activeTripStop.trip.status,
    notes: activeTripStop.trip.notes,
    stopSequence: activeTripStop.stopSequence,
    stopStatus: activeTripStop.status,
    addressLine: activeTripStop.addressLine,
    city: activeTripStop.city,
    landmark: activeTripStop.landmark
  } : null

  const total = Number(order.totalAmount || 0)
  const ps = order.paymentStatus || {
    status: 'UNPAID',
    amountPaid: 0,
    balanceDue: total,
    paymentMethod: null,
    referenceNo: null,
    dueDate: null,
    paidAt: null
  }

  return {
    ...order,
    paymentStatus: ps,
    destinationCoords: pin ? { lat: pin.lat, lng: pin.lng, areaName: pin.areaName, landmark: pin.landmark } : null,
    hasDestinationPin: !!pin,
    assignedTrip
  }
})
