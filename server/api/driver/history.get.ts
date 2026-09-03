import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { getDriverTrips } from '~~/server/utils/driverTrips'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, ['ADMIN', 'DELIVERY'])

  // Get all completed trips for this driver from Supabase
  const trips = await getDriverTrips(user.id)

  const totalKm = Math.round(trips.reduce((sum, t) => sum + (t.totalDistanceKm || 0), 0) * 10) / 10
  const totalPayout = trips.reduce((sum, t) => sum + (t.calculatedPayout || 0), 0)

  return {
    trips,
    summary: {
      totalTrips: trips.length,
      completedCount: trips.length,
      totalKm,
      totalPayout,
    }
  }
})
