import { prisma } from '~~/server/utils/prisma'
import type { Prisma } from '@prisma/client'

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma

/**
 * Synchronize an order's associated trip manifest (Trip & TripStop)
 * whenever the order's delivery status or overall status changes.
 */
export async function syncOrderTripState(
  tx: PrismaClientOrTx,
  orderId: string,
  newDeliveryStatus: 'WAITING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'ON_HOLD' | 'CANCELLED',
  options?: {
    driverName?: string
    notes?: string
    userId?: string
  }
) {
  // 1. Clean up legacy TripRoute records if reverting to WAITING or CANCELLED
  if (newDeliveryStatus === 'WAITING' || newDeliveryStatus === 'CANCELLED') {
    try {
      await tx.tripRoute.deleteMany({ where: { orderId } })
    } catch {
      // Legacy table may not exist or not have records; safely ignore
    }
  }

  // 2. Find any active TripStop records linking this order to a Trip
  const existingStops = await tx.tripStop.findMany({
    where: { orderId },
    include: {
      trip: {
        include: {
          stops: {
            orderBy: { stopSequence: 'asc' }
          }
        }
      }
    }
  })

  if (existingStops.length === 0) {
    return
  }

  // ── CASE A: Order reset to WAITING or CANCELLED: REMOVE from Trip ──
  if (newDeliveryStatus === 'WAITING' || newDeliveryStatus === 'CANCELLED') {
    const tripIds = Array.from(new Set(existingStops.map(s => s.tripId).filter(Boolean)))

    // Delete all stops for this order in one atomic step
    await tx.tripStop.deleteMany({
      where: { orderId }
    })

    // Inspect affected trips and re-sequence or clean up empty ones
    for (const tripId of tripIds) {
      const remainingStops = await tx.tripStop.findMany({
        where: { tripId },
        orderBy: { stopSequence: 'asc' }
      })

      if (remainingStops.length === 0) {
        // If no stops remain on the trip, remove the empty trip
        await tx.trip.deleteMany({
          where: { id: tripId }
        })
      } else {
        // Re-sequence remaining stops: 1, 2, 3...
        for (let i = 0; i < remainingStops.length; i++) {
          const expectedSeq = i + 1
          if (remainingStops[i].stopSequence !== expectedSeq) {
            await tx.tripStop.update({
              where: { id: remainingStops[i].id },
              data: { stopSequence: expectedSeq }
            })
          }
        }

        // Check if all remaining stops are already DELIVERED
        const remainingPending = remainingStops.filter(s => s.status !== 'DELIVERED').length
        if (remainingPending === 0) {
          const trip = await tx.trip.findUnique({ where: { id: tripId } })
          if (trip && trip.status === 'IN_TRANSIT') {
            await tx.trip.update({
              where: { id: tripId },
              data: {
                status: 'COMPLETED',
                endTime: new Date()
              }
            })
          }
        }
      }
    }
    return
  }

  // ── CASE B: Order marked DELIVERED (e.g. manual admin handover or customer pickup) ──
  if (newDeliveryStatus === 'DELIVERED') {
    await tx.tripStop.updateMany({
      where: { orderId, status: { not: 'DELIVERED' } },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        notes: options?.notes ? `Admin handover: ${options.notes}` : 'Marked delivered via manual admin/dispatch handover'
      }
    })

    // Check if any associated trips now have all stops delivered
    for (const stop of existingStops) {
      const trip = stop.trip
      if (!trip) continue

      const pendingCount = await tx.tripStop.count({
        where: { tripId: trip.id, status: { not: 'DELIVERED' } }
      })

      if (pendingCount === 0 && (trip.status === 'IN_TRANSIT' || trip.status === 'PLANNED')) {
        await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: 'COMPLETED',
            endTime: new Date()
          }
        })
      }
    }
    return
  }

  // ── CASE C: Order marked ASSIGNED (e.g. reverted from DELIVERED or DISPATCHED) ──
  if (newDeliveryStatus === 'ASSIGNED') {
    await tx.tripStop.updateMany({
      where: { orderId },
      data: {
        status: 'PENDING',
        deliveredAt: null,
        notes: options?.notes || null
      }
    })

    for (const stop of existingStops) {
      const trip = stop.trip
      if (!trip) continue

      const allTripStops = await tx.tripStop.findMany({
        where: { tripId: trip.id }
      })

      const hasDeliveredOrInTransit = allTripStops.some(s => s.status === 'DELIVERED' || s.status === 'IN_TRANSIT')

      // If trip was completed, reopen it appropriately
      if (trip.status === 'COMPLETED') {
        await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: hasDeliveredOrInTransit ? 'IN_TRANSIT' : 'PLANNED',
            endTime: null
          }
        })
      }
    }
    return
  }

  // ── CASE D: Order marked DISPATCHED manually (or reverted from DELIVERED) ──
  if (newDeliveryStatus === 'DISPATCHED') {
    await tx.tripStop.updateMany({
      where: { orderId },
      data: {
        status: 'IN_TRANSIT',
        deliveredAt: null,
        notes: options?.notes || null
      }
    })

    for (const stop of existingStops) {
      const trip = stop.trip
      if (!trip) continue

      if (trip.status === 'PLANNED' || trip.status === 'COMPLETED') {
        await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: 'IN_TRANSIT',
            startTime: trip.startTime || new Date(),
            endTime: null
          }
        })
      }
    }
    return
  }

  // ── CASE E: Order put ON_HOLD ──
  if (newDeliveryStatus === 'ON_HOLD') {
    await tx.tripStop.updateMany({
      where: { orderId, status: { in: ['PENDING', 'IN_TRANSIT'] } },
      data: {
        notes: options?.notes ? `[ON HOLD] ${options.notes}` : '[ON HOLD] Delivery held by admin'
      }
    })
  }
}
