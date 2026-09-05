import fs from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '~~/server/utils/prisma'

export interface DestinationPin {
  lat: number
  lng: number
  landmark?: string
  areaName?: string
  updatedAt?: number
}

// In-memory fallback cache (survives read-only environments like /var/task)
const memoryPinsStore: Record<string, DestinationPin> = {}

let cachedStoragePath: string | null = null;

function getSafeStoragePath(): string {
  if (cachedStoragePath) return cachedStoragePath;
  // 1. Try local server/data directory
  const localDir = path.resolve(process.cwd(), 'server/data')
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true })
    }
    const testFile = path.join(localDir, '.write_test')
    fs.writeFileSync(testFile, '1', 'utf-8')
    fs.unlinkSync(testFile)
    cachedStoragePath = path.join(localDir, 'customer_pins.json')
    return cachedStoragePath;
  } catch {
    // 2. Fallback to OS temp directory (always writable in AWS Lambda / Vercel)
    cachedStoragePath = path.join(os.tmpdir(), 'customer_pins.json')
    return cachedStoragePath;
  }
}

let schemaEnsured = false
async function ensureCustomerPinColumns() {
  if (schemaEnsured) return
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customers" 
      ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "landmark" TEXT;
    `)
    schemaEnsured = true
  } catch (e) {
    console.warn('Could not alter customers table in Supabase:', e)
  }
}

export async function syncPinsFromDatabase() {
  try {
    await ensureCustomerPinColumns()
    const records = await prisma.customer.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null }
      },
      select: {
        id: true,
        name: true,
        company: true,
        latitude: true,
        longitude: true,
        landmark: true,
      }
    })

    for (const c of records) {
      if (c.latitude && c.longitude) {
        const pin: DestinationPin = {
          lat: c.latitude,
          lng: c.longitude,
          landmark: c.landmark || undefined,
        }
        if (c.id) memoryPinsStore[c.id.toLowerCase().trim()] = pin
        if (c.name) memoryPinsStore[c.name.toLowerCase().trim()] = pin
        if (c.company) memoryPinsStore[c.company.toLowerCase().trim()] = pin
      }
    }
  } catch (e) {
    console.warn('Could not sync pins from Supabase customer table:', e)
  }
}

export function loadCustomerPins(): Record<string, DestinationPin> {
  const file = getSafeStoragePath()
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(data)
      return { ...parsed, ...memoryPinsStore }
    }
  } catch (e) {
    console.warn('Could not read customer pins file, using memory cache:', e)
  }
  return { ...memoryPinsStore }
}

export async function saveCustomerPin(customerIdOrKeys: string | string[], pin: DestinationPin) {
  const keys = Array.isArray(customerIdOrKeys) ? customerIdOrKeys : [customerIdOrKeys]

  const updatedPin: DestinationPin = {
    ...pin,
    updatedAt: Date.now(),
  }

  // 1. Always update memory store
  for (const rawKey of keys) {
    if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
      memoryPinsStore[rawKey.toLowerCase().trim()] = updatedPin
    }
  }

  // 2. Persist directly to Supabase Postgres database
  try {
    await ensureCustomerPinColumns()
    for (const key of keys) {
      if (!key || typeof key !== 'string') continue
      await prisma.$executeRawUnsafe(
        `UPDATE "customers" 
         SET "latitude" = $1, "longitude" = $2, "landmark" = $3, "updatedAt" = NOW()
         WHERE "id" = $4 OR LOWER("name") = LOWER($4) OR LOWER("company") = LOWER($4)`,
        pin.lat,
        pin.lng,
        pin.landmark || null,
        key.trim()
      )
    }
  } catch (dbErr) {
    console.warn('Supabase DB pin update:', dbErr)
  }

  // 3. Fallback sync to local/temp file
  try {
    const file = getSafeStoragePath()
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const diskData = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8') || '{}') : {}
    const merged = { ...diskData, ...memoryPinsStore }
    fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf-8')
  } catch (e) {
    console.warn('Could not persist pin to disk, saved in memory & Supabase:', e)
  }

  return updatedPin
}

export async function deleteCustomerPin(customerIdOrKeys: string | string[]) {
  const keys = Array.isArray(customerIdOrKeys) ? customerIdOrKeys : [customerIdOrKeys]

  // 1. Delete from memory store
  for (const rawKey of keys) {
    if (rawKey && typeof rawKey === 'string') {
      delete memoryPinsStore[rawKey.toLowerCase().trim()]
    }
  }

  // 2. Clear in Supabase Postgres database
  try {
    await ensureCustomerPinColumns()
    for (const key of keys) {
      if (!key || typeof key !== 'string') continue
      await prisma.$executeRawUnsafe(
        `UPDATE "customers" 
         SET "latitude" = NULL, "longitude" = NULL, "landmark" = NULL, "updatedAt" = NOW()
         WHERE "id" = $1 OR LOWER("name") = LOWER($1) OR LOWER("company") = LOWER($1)`,
        key.trim()
      )
    }
  } catch (dbErr) {
    console.warn('Supabase DB pin delete error:', dbErr)
  }

  // 3. Sync to disk file
  try {
    const file = getSafeStoragePath()
    if (fs.existsSync(file)) {
      const diskData = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}')
      for (const rawKey of keys) {
        if (rawKey && typeof rawKey === 'string') {
          delete diskData[rawKey.toLowerCase().trim()]
        }
      }
      fs.writeFileSync(file, JSON.stringify(diskData, null, 2), 'utf-8')
    }
  } catch (e) {}

  return true
}

/**
 * Resolve destination pin for an order or customer
 * Returns exact custom pin if set, or area preset if matched, or null if completely unknown
 */
export function resolveDestinationPin(
  customerId?: string,
  customerName?: string,
  deliveryAddress?: string,
  city?: string,
  customerObj?: any,
  preloadedPins?: Record<string, DestinationPin>
): DestinationPin | null {
  // 1. Check if customer object already has latitude/longitude from Supabase DB
  if (customerObj && customerObj.latitude && customerObj.longitude) {
    return {
      lat: Number(customerObj.latitude),
      lng: Number(customerObj.longitude),
      landmark: customerObj.landmark || undefined,
      areaName: customerObj.company || customerObj.name || undefined,
    }
  }

  const pins = preloadedPins || loadCustomerPins()

  // 2. Check exact customerId or customerName match
  if (customerId && pins[customerId.toLowerCase().trim()]) {
    return pins[customerId.toLowerCase().trim()]
  }
  if (customerName && pins[customerName.toLowerCase().trim()]) {
    return pins[customerName.toLowerCase().trim()]
  }

  // 3. Check delivery address key match
  const fullText = `${deliveryAddress || ''} ${city || ''}`.toLowerCase()
  for (const [key, pin] of Object.entries(pins)) {
    if (fullText.includes(key)) {
      return pin
    }
  }

  return null
}
