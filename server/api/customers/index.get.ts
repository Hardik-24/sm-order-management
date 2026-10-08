import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { loadCustomerPins, syncPinsFromDatabase } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const search = query.search as string
  
  const where: any = {}
  if (query.includeInactive !== 'true') {
    where.isActive = true
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { alias: { contains: search, mode: 'insensitive' } },
      { customerCode: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { gstNumber: { contains: search, mode: 'insensitive' } }
    ]
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      customerManager: {
        select: { id: true, name: true, email: true, role: true }
      },
      addresses: {
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  })

  // Sync memory cache from Supabase for legacy customer pins
  await syncPinsFromDatabase()
  const pins = loadCustomerPins()

  return customers.map(c => {
    const idKey = (c.id || '').toLowerCase().trim()
    const nameKey = (c.name || '').toLowerCase().trim()
    const compKey = (c.company || '').toLowerCase().trim()

    const savedPin = (idKey ? pins[idKey] : null) || (nameKey ? pins[nameKey] : null) || (compKey ? pins[compKey] : null)

    const lat = c.latitude ?? savedPin?.lat ?? null
    const lng = c.longitude ?? savedPin?.lng ?? null
    const landmark = c.landmark ?? savedPin?.landmark ?? savedPin?.areaName ?? null

    const mappedAddresses = (c.addresses || []).map((a: any) => {
      const aKey = (a.id || '').toLowerCase().trim()
      const aSavedPin = aKey ? pins[aKey] : null
      const aLat = a.latitude ?? aSavedPin?.lat ?? (a.isDefault ? lat : null)
      const aLng = a.longitude ?? aSavedPin?.lng ?? (a.isDefault ? lng : null)
      const aLandmark = a.landmark ?? aSavedPin?.landmark ?? (a.isDefault ? landmark : null)

      return {
        ...a,
        latitude: aLat,
        longitude: aLng,
        landmark: aLandmark,
      }
    })

    return {
      ...c,
      latitude: lat,
      longitude: lng,
      landmark: landmark,
      addresses: mappedAddresses,
    }
  })
})
