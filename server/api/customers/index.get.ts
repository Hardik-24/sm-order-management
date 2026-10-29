import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { loadCustomerPins, syncPinsFromDatabase } from '~~/server/utils/customerPins'
import { buildMultiTokenPrismaOr, rankServerItems } from '~~/server/utils/search'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  
  const where: any = {}
  if (query.includeInactive !== 'true') {
    where.isActive = true
  }
  if (search) {
    const multiTokenFilter = buildMultiTokenPrismaOr(search, (token) => [
      { name: { contains: token, mode: 'insensitive' } },
      { company: { contains: token, mode: 'insensitive' } },
      { alias: { contains: token, mode: 'insensitive' } },
      { customerCode: { contains: token, mode: 'insensitive' } },
      { email: { contains: token, mode: 'insensitive' } },
      { phone: { contains: token, mode: 'insensitive' } },
      { gstNumber: { contains: token, mode: 'insensitive' } }
    ])
    if (multiTokenFilter) {
      where.AND = multiTokenFilter.AND
    }
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      customerManager: {
        select: { id: true, name: true, email: true, role: true }
      },
      addresses: {
        orderBy: { createdAt: 'asc' }
      },
      _count: {
        select: { orders: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  // Sync memory cache from Supabase for legacy customer pins
  await syncPinsFromDatabase()
  const pins = loadCustomerPins()

  const mapped = customers.map(c => {
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
      orderCount: (c as any)._count?.orders ?? 0,
    }
  })

  if (search) {
    return rankServerItems(mapped, search, {
      primary: c => c.company || c.name,
      secondary: c => c.customerCode || c.alias,
      meta: c => c.city || c.email,
      code: c => c.phone || c.gstNumber
    })
  }

  return mapped
})
