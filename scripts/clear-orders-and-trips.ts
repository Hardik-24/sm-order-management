import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Cleaning up all trips and orders ---')

  // 1. Disconnect any converted order requests
  const orderReqs = await prisma.orderRequest.updateMany({
    data: {
      convertedOrderId: null,
      status: 'PENDING'
    }
  })
  console.log(`Reset ${orderReqs.count} order requests (unlinked converted orders).`)

  // 2. Delete all Trip Stops
  const tripStops = await prisma.tripStop.deleteMany({})
  console.log(`Deleted ${tripStops.count} trip stops.`)

  // 3. Delete all Trips
  const trips = await prisma.trip.deleteMany({})
  console.log(`Deleted ${trips.count} trips.`)

  // 4. Delete all Trip Routes (live GPS routes)
  const routes = await prisma.tripRoute.deleteMany({})
  console.log(`Deleted ${routes.count} trip routes.`)

  // 5. Delete all Payment Records
  const paymentRecords = await prisma.paymentRecord.deleteMany({})
  console.log(`Deleted ${paymentRecords.count} payment records.`)

  // 6. Delete all Order Timelines
  const timelines = await prisma.orderTimeline.deleteMany({})
  console.log(`Deleted ${timelines.count} order timeline entries.`)

  // 7. Delete all Order Items
  const items = await prisma.orderItem.deleteMany({})
  console.log(`Deleted ${items.count} order items.`)

  // 8. Delete Billing, Packing, Delivery, Payment Statuses
  const billing = await prisma.billingStatus.deleteMany({})
  const packing = await prisma.packingStatus.deleteMany({})
  const delivery = await prisma.deliveryStatus.deleteMany({})
  const payment = await prisma.paymentStatus.deleteMany({})
  console.log(`Deleted ${billing.count} billing, ${packing.count} packing, ${delivery.count} delivery, and ${payment.count} payment statuses.`)

  // 9. Delete all Orders
  const orders = await prisma.order.deleteMany({})
  console.log(`Deleted ${orders.count} orders.`)

  console.log('--- All orders and trips have been successfully deleted! Database is clean for fresh testing. ---')
}

main()
  .catch((e) => {
    console.error('Error clearing orders and trips:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
