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
  // 1. Clean up legacy TripRoute table if reverting to WAITING or CANCELLED
  if (newDeliveryStatus === 'WAITING' || newDeliveryStatus === 'CANCELLED') {
    try {
      await tx.tripRoute.deleteMany({ where: { orderId } })
    } catch {}
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

  // 3. Handle TripStop synchronization for each associated trip
  for (const stop of existingStops) {
    const trip = stop.trip
    if (!trip) continue

    // ── CASE A: Order reset to WAITING or CANCELLED: REMOVE from Trip ──
    if (newDeliveryStatus === 'WAITING' || newDeliveryStatus === 'CANCELLED') {
      // Delete this stop from the trip manifest
      await tx.tripStop.delete({
        where: { id: stop.id }
      })

      // Fetch remaining stops on this trip
      const remainingStops = await tx.tripStop.findMany({
        where: { tripId: trip.id },
        orderBy: { stopSequence: 'asc' }
      })

      if (remainingStops.length === 0) {
        // If no stops remain on the trip, delete the empty trip
        await tx.trip.delete({
          where: { id: trip.id }
        })
      } else {
        // Re-sequence the remaining stops: 1, 2, 3...
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
        if (remainingPending === 0 && trip.status === 'IN_TRANSIT') {
          await tx.trip.update({
            where: { id: trip.id },
            data: {
              status: 'COMPLETED',
              endTime: new Date()
            }
          })
        }
      }
    }

    // ── CASE B: Order marked DELIVERED (e.g. manual admin/customer pickup) ──
    else if (newDeliveryStatus === 'DELIVERED') {
      if (stop.status !== 'DELIVERED') {
        await tx.tripStop.update({
          where: { id: stop.id },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            notes: options?.notes ? `Admin handover: ${options.notes}` : 'Marked delivered via manual admin/dispatch handover'
          }
        })

        // Check if all stops on this trip are now delivered
        const allStops = await tx.tripStop.findMany({
          where: { tripId: trip.id }
        })
        const hasUndelivered = allStops.some(s => s.id !== stop.id && s.status !== 'DELIVERED')
        if (!hasUndelivered && (trip.status === 'IN_TRANSIT' || trip.status === 'PLANNED')) {
          await tx.trip.update({
            where: { id: trip.id },
            data: {
              status: 'COMPLETED',
              endTime: new Date()
            }
          })
        }
      }
    }

    // ── CASE C: Order put ON_HOLD ──
    else if (newDeliveryStatus === 'ON_HOLD') {
      if (stop.status === 'PENDING' || stop.status === 'IN_TRANSIT') {
        await tx.tripStop.update({
          where: { id: stop.id },
          data: {
            notes: options?.notes ? `[ON HOLD] ${options.notes}` : '[ON HOLD] Delivery held by admin'
          }
        })
      }
    }
  }
}
