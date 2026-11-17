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
      parentOrder: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          overallStatus: true,
          batchCount: true,
          isApproved: true
        }
      },
      batches: {
        orderBy: { batchNumber: 'asc' },
        include: {
          billingStatus: { include: { generatedBy: true } },
          packingStatus: { include: { assignedTo: true } },
          deliveryStatus: true,
          items: { include: { product: true } }
        }
      },
      items: { include: { product: true } },
      billingStatus: { include: { generatedBy: true } },
      packingStatus: { include: { assignedTo: true } },
      deliveryStatus: true,
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

  // If this order is a child batch, also load all its sister batches for easy switching in UI
  let sisterBatches: any[] = []
  if (order.parentOrderId) {
    sisterBatches = await prisma.order.findMany({
      where: { parentOrderId: order.parentOrderId },
      orderBy: { batchNumber: 'asc' },
      include: {
        billingStatus: { select: { status: true, invoiceNumber: true, invoiceDate: true, invoicePdfUrl: true } },
        packingStatus: { select: { status: true } },
        deliveryStatus: { select: { status: true, driverName: true } },
        items: { include: { product: true } }
      }
    })
  }

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
    stopId: activeTripStop.id,
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

  const hasUnsyncedBusyItems = order.items?.some((i: any) => i.isBusySynced === false || i.product?.isBusySynced === false) || false

  const convertedQuotation = await prisma.quotation.findFirst({
    where: { convertedOrderId: id },
    select: { id: true, quoteNumber: true }
  })

  return {
    ...order,
    hasUnsyncedBusyItems,
    isConvertedFromQuotation: Boolean(convertedQuotation),
    convertedQuotationNumber: convertedQuotation?.quoteNumber || null,
    destinationCoords: pin ? { lat: pin.lat, lng: pin.lng, areaName: pin.areaName, landmark: pin.landmark } : null,
    hasDestinationPin: !!pin,
    assignedTrip,
    sisterBatches
  }
})
