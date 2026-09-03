import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getTrip } from '~~/server/utils/driverTrips'
import { resolveDestinationPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['ADMIN', 'DELIVERY'])

  // Filter conditions based on role
  const whereClause: any = {
    deliveryStatus: {
      status: {
        in: ['WAITING', 'ASSIGNED', 'DISPATCHED', 'ON_HOLD']
      }
    }
  }

  // If logged in as a specific DELIVERY driver, strictly show ONLY orders assigned to them
  if (user.role === 'DELIVERY') {
    whereClause.deliveryStatus.driverName = user.name
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      customer: true,
      items: {
        include: {
          product: true
        }
      },
      deliveryStatus: true,
      billingStatus: true,
      packingStatus: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Format orders for mobile driver portal — fetch trip from Supabase for each dispatched order
  const results = await Promise.all(orders.map(async (order) => {
    const trip = order.deliveryStatus?.status === 'DISPATCHED' ? await getTrip(order.id) : null
    const destPin = resolveDestinationPin(
      order.customerId,
      order.customer.name,
      order.deliveryAddress,
      order.customer.city,
      order.customer
    )

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customer: {
        name: order.customer.name,
        company: order.customer.company,
        phone: order.customer.phone,
        city: order.customer.city,
      },
      deliveryAddress: order.deliveryAddress,
      totalAmount: Number(order.totalAmount),
      deliveryStatus: order.deliveryStatus?.status || 'WAITING',
      holdReason: order.deliveryStatus?.holdReason || null,
      driverName: order.deliveryStatus?.driverName || user.name,
      dispatchDate: order.deliveryStatus?.dispatchDate,
      eta: order.deliveryStatus?.eta,
      // destPin is the customer's saved pin — shown always so driver can see it pre-trip
      destinationCoords: destPin
        ? { lat: destPin.lat, lng: destPin.lng, areaName: destPin.areaName, landmark: destPin.landmark }
        : (order.customer.latitude && order.customer.longitude
            ? { lat: order.customer.latitude, lng: order.customer.longitude }
            : null),
      hasPinSet: !!(destPin || (order.customer.latitude && order.customer.longitude)),
      items: order.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        productName: i.productName,
        quantity: i.quantity,
        packedQuantity: i.packedQuantity,
        unit: i.product?.unit || 'SHEET',
      })),
      trip: trip || null,
    }
  }))

  return results
})
