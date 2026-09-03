import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { loadCustomerPins, syncPinsFromDatabase } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const search = query.search as string
  
  const where: any = { isActive: true }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } }
    ]
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: 'asc' }
  })

  // Sync memory cache from Supabase
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

    return {
      ...c,
      latitude: lat,
      longitude: lng,
      landmark: landmark,
    }
  })
})
