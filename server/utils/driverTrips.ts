import { prisma } from '~~/server/utils/prisma'

export interface TripBreadcrumb {
  lat: number
  lng: number
  timestamp: number
  speed?: number
  heading?: number
}

export interface DriverTrip {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  deliveryAddress: string
  driverId: string
  driverName: string
  driverPhone?: string
  status: 'IN_TRANSIT' | 'COMPLETED'
  startTime: number
  endTime?: number
  durationMinutes?: number
  totalDistanceKm: number
  ratePerKm: number
  calculatedPayout: number
  startLocation: { lat: number; lng: number }   // Permanent — driver's GPS at trip start
  currentLocation?: TripBreadcrumb
  destinationCoords?: { lat: number; lng: number }
  route: TripBreadcrumb[]
}

const RATE_PER_KM = 15

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 100) / 100
}

function dbRowToDriverTrip(row: any, orderNumber: string, customerName: string, deliveryAddress: string): DriverTrip {
  const breadcrumbs: TripBreadcrumb[] = Array.isArray(row.breadcrumbs) ? row.breadcrumbs : []
  const last = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : undefined
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber,
    customerName,
    deliveryAddress,
    driverId: row.driverId,
    driverName: row.driverName,
    status: row.status as 'IN_TRANSIT' | 'COMPLETED',
    startTime: new Date(row.startTime).getTime(),
    endTime: row.endTime ? new Date(row.endTime).getTime() : undefined,
    durationMinutes: row.durationMinutes ?? undefined,
    totalDistanceKm: row.totalDistanceKm,
    ratePerKm: row.ratePerKm,
    calculatedPayout: row.calculatedPayout,
    startLocation: { lat: row.startLat, lng: row.startLng },
    currentLocation: last ?? { lat: row.startLat, lng: row.startLng, timestamp: new Date(row.startTime).getTime() },
    destinationCoords: row.destLat && row.destLng ? { lat: row.destLat, lng: row.destLng } : undefined,
    route: breadcrumbs,
  }
}

/**
 * Start a new delivery trip — stores permanently in Supabase trip_routes table
 */
export async function startTrip(params: {
  orderId: string
  orderNumber: string
  customerName: string
  deliveryAddress: string
  driverId: string
  driverName: string
  driverPhone?: string
  initialCoords: { lat: number; lng: number }   // Required — driver's real GPS
  destinationCoords?: { lat: number; lng: number }
  ratePerKm?: number
}): Promise<DriverTrip> {
  const now = new Date()
  const initialBreadcrumb: TripBreadcrumb = {
    lat: params.initialCoords.lat,
    lng: params.initialCoords.lng,
    timestamp: now.getTime(),
  }

  const row = await prisma.tripRoute.upsert({
    where: { orderId: params.orderId },
    create: {
      orderId: params.orderId,
      driverId: params.driverId,
      driverName: params.driverName,
      startLat: params.initialCoords.lat,
      startLng: params.initialCoords.lng,
      destLat: params.destinationCoords?.lat ?? null,
      destLng: params.destinationCoords?.lng ?? null,
      startTime: now,
      status: 'IN_TRANSIT',
      breadcrumbs: [initialBreadcrumb],
      ratePerKm: params.ratePerKm ?? RATE_PER_KM,
    },
    update: {
      // If re-starting (shouldn't happen), overwrite
      driverId: params.driverId,
      driverName: params.driverName,
      startLat: params.initialCoords.lat,
      startLng: params.initialCoords.lng,
      destLat: params.destinationCoords?.lat ?? null,
      destLng: params.destinationCoords?.lng ?? null,
      startTime: now,
      endTime: null,
      status: 'IN_TRANSIT',
      breadcrumbs: [initialBreadcrumb],
      totalDistanceKm: 0,
      calculatedPayout: 0,
      durationMinutes: null,
      ratePerKm: params.ratePerKm ?? RATE_PER_KM,
    },
  })

  return dbRowToDriverTrip(row, params.orderNumber, params.customerName, params.deliveryAddress)
}

/**
 * Record GPS pings from driver's phone — appends breadcrumbs in DB
 */
export async function recordTripPing(
  orderId: string,
  coordsOrPoints:
    | { lat: number; lng: number; speed?: number; heading?: number; timestamp?: number }
    | Array<{ lat: number; lng: number; speed?: number; heading?: number; timestamp?: number }>
): Promise<DriverTrip | null> {
  const row = await prisma.tripRoute.findUnique({
    where: { orderId },
    include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
  })
  if (!row || row.status === 'COMPLETED') return row ? dbRowToDriverTrip(row, row.order.orderNumber, row.order.customer.name, row.order.deliveryAddress) : null

  const points = Array.isArray(coordsOrPoints) ? coordsOrPoints : [coordsOrPoints]
  if (points.length === 0) return dbRowToDriverTrip(row, row.order.orderNumber, row.order.customer.name, row.order.deliveryAddress)

  const existingCrumbs: TripBreadcrumb[] = Array.isArray(row.breadcrumbs) ? row.breadcrumbs : []
  let lastPoint = existingCrumbs.length > 0 ? existingCrumbs[existingCrumbs.length - 1] : { lat: row.startLat, lng: row.startLng }
  let addedKm = 0
  const newCrumbs: TripBreadcrumb[] = []

  for (const pt of points) {
    if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number') continue
    const deltaKm = calculateDistanceKm(lastPoint.lat, lastPoint.lng, pt.lat, pt.lng)
    // Filter GPS jitter < 10m, and outliers > 2km (impossible jump in one ping)
    if (deltaKm >= 0.01 && deltaKm <= 2.0) {
      addedKm += deltaKm
      const crumb: TripBreadcrumb = {
        lat: pt.lat,
        lng: pt.lng,
        timestamp: pt.timestamp || Date.now(),
        speed: pt.speed,
        heading: pt.heading,
      }
      newCrumbs.push(crumb)
      lastPoint = crumb
    }
  }

  const allCrumbs = [...existingCrumbs, ...newCrumbs]
  const newTotalKm = Math.round((row.totalDistanceKm + addedKm) * 100) / 100
  const newPayout = Math.round(newTotalKm * row.ratePerKm)

  const updated = await prisma.tripRoute.update({
    where: { orderId },
    data: {
      breadcrumbs: allCrumbs,
      totalDistanceKm: newTotalKm,
      calculatedPayout: newPayout,
    },
    include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
  })

  return dbRowToDriverTrip(updated, updated.order.orderNumber, updated.order.customer.name, updated.order.deliveryAddress)
}

/**
 * Complete a trip — freeze route, calculate final stats
 */
export async function completeTrip(
  orderId: string,
  finalCoords?: { lat: number; lng: number },
  fallbackInfo?: {
    orderNumber?: string
    customerName?: string
    deliveryAddress?: string
    driverId?: string
    driverName?: string
  }
): Promise<DriverTrip> {
  let row = await prisma.tripRoute.findUnique({
    where: { orderId },
    include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
  })

  const now = new Date()

  if (!row) {
    // Trip was never started — create a minimal completed record with just the endpoint
    const created = await prisma.tripRoute.create({
      data: {
        orderId,
        driverId: fallbackInfo?.driverId || '',
        driverName: fallbackInfo?.driverName || '',
        startLat: finalCoords?.lat ?? 0,
        startLng: finalCoords?.lng ?? 0,
        destLat: finalCoords?.lat ?? null,
        destLng: finalCoords?.lng ?? null,
        startTime: now,
        endTime: now,
        status: 'COMPLETED',
        breadcrumbs: finalCoords ? [{ lat: finalCoords.lat, lng: finalCoords.lng, timestamp: now.getTime() }] : [],
        durationMinutes: 0,
        totalDistanceKm: 0,
        calculatedPayout: 0,
      },
      include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
    })
    return dbRowToDriverTrip(created, fallbackInfo?.orderNumber || created.order.orderNumber, fallbackInfo?.customerName || created.order.customer.name, fallbackInfo?.deliveryAddress || created.order.deliveryAddress)
  }

  // Append final GPS point if provided
  const existingCrumbs: TripBreadcrumb[] = Array.isArray(row.breadcrumbs) ? (row.breadcrumbs as TripBreadcrumb[]) : []
  let totalKm = row.totalDistanceKm
  let finalCrumbs = [...existingCrumbs]

  if (finalCoords) {
    const lastPoint = finalCrumbs.length > 0 ? finalCrumbs[finalCrumbs.length - 1] : { lat: row.startLat, lng: row.startLng, timestamp: now.getTime() }
    const deltaKm = calculateDistanceKm(lastPoint.lat, lastPoint.lng, finalCoords.lat, finalCoords.lng)
    if (deltaKm >= 0.01 && deltaKm <= 2.0) {
      totalKm = Math.round((totalKm + deltaKm) * 100) / 100
      finalCrumbs.push({ lat: finalCoords.lat, lng: finalCoords.lng, timestamp: now.getTime() })
    }
  }

  // --- GOOGLE MAPS SNAP TO ROADS ---
  const config = useRuntimeConfig()
  const googleMapsKey = config.public.googleMapsApiKey

  if (googleMapsKey && finalCrumbs.length > 0) {
    try {
      // API limits to 100 points per request
      const chunkSize = 100
      let snappedCrumbs: TripBreadcrumb[] = []
      
      // We always include the start point to ensure the route connects properly
      const allPointsToSnap = [{ lat: row.startLat, lng: row.startLng, timestamp: new Date(row.startTime).getTime() }, ...finalCrumbs]
      
      for (let i = 0; i < allPointsToSnap.length; i += chunkSize) {
        const chunk = allPointsToSnap.slice(i, i + chunkSize)
        const pathParam = chunk.map(p => `${p.lat},${p.lng}`).join('|')
        
        // interpolate=true ensures that missing road curves between two points are filled in perfectly
        const url = `https://roads.googleapis.com/v1/snapToRoads?path=${pathParam}&interpolate=true&key=${googleMapsKey}`
        const response = await $fetch<any>(url)
        
        if (response.snappedPoints && response.snappedPoints.length > 0) {
          const chunkCrumbs = response.snappedPoints.map((sp: any) => ({
            lat: sp.location.latitude,
            lng: sp.location.longitude,
            // For interpolated points, we just use the final timestamp as a placeholder
            // since they are just geometric path fillers
            timestamp: (sp.originalIndex !== undefined && chunk[sp.originalIndex]) ? chunk[sp.originalIndex].timestamp : now.getTime()
          }))
          snappedCrumbs = [...snappedCrumbs, ...chunkCrumbs]
        }
      }
      
      if (snappedCrumbs.length > 0) {
        // Remove the hardcoded start point we injected at the beginning to avoid duplication if it wasn't originally there
        if (existingCrumbs.length === 0) {
           snappedCrumbs.shift() 
        }
        
        finalCrumbs = snappedCrumbs
        
        // Recalculate true distance exactly along the road geometry!
        let newTotalKm = 0
        for (let i = 1; i < finalCrumbs.length; i++) {
          newTotalKm += calculateDistanceKm(finalCrumbs[i-1].lat, finalCrumbs[i-1].lng, finalCrumbs[i].lat, finalCrumbs[i].lng)
        }
        totalKm = Math.round(newTotalKm * 100) / 100
      }
    } catch (e) {
      console.warn('Google Maps Snap to Roads failed, falling back to raw route:', e)
    }
  }
  // ---------------------------------

  const durationMinutes = Math.max(0, Math.round((now.getTime() - new Date(row.startTime).getTime()) / 60000))
  const calculatedPayout = Math.round(totalKm * row.ratePerKm)

  const updated = await prisma.tripRoute.update({
    where: { orderId },
    data: {
      status: 'COMPLETED',
      endTime: now,
      durationMinutes,
      totalDistanceKm: totalKm,
      calculatedPayout,
      breadcrumbs: finalCrumbs,
    },
    include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
  })

  return dbRowToDriverTrip(updated, updated.order.orderNumber, updated.order.customer.name, updated.order.deliveryAddress)
}

/**
 * Get trip by orderId from Supabase
 */
export async function getTrip(orderId: string): Promise<DriverTrip | null> {
  try {
    const row = await prisma.tripRoute.findUnique({
      where: { orderId },
      include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
    })
    if (!row) return null
    return dbRowToDriverTrip(row, row.order.orderNumber, row.order.customer.name, row.order.deliveryAddress)
  } catch {
    return null
  }
}

/**
 * Get all completed trips for a driver
 */
export async function getDriverTrips(driverId: string): Promise<DriverTrip[]> {
  const rows = await prisma.tripRoute.findMany({
    where: { driverId, status: 'COMPLETED' },
    include: { order: { select: { orderNumber: true, deliveryAddress: true, customer: { select: { name: true } } } } },
    orderBy: { startTime: 'desc' },
  })
  return rows.map((r) => dbRowToDriverTrip(r, r.order.orderNumber, r.order.customer.name, r.order.deliveryAddress))
}

/**
 * Delete a trip record (when order is moved back to WAITING/ASSIGNED)
 */
export async function deleteTrip(orderId: string): Promise<void> {
  try {
    await prisma.tripRoute.delete({ where: { orderId } })
  } catch {
    // Row may not exist — that's fine
  }
}
