// Prisma Client Singleton for Nuxt server routes
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

export function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    if (!prisma) prisma = new PrismaClient()
    return prisma
  }
  if (!global.__prisma) {
    global.__prisma = new PrismaClient()
  }
  return global.__prisma
}

export function resetPrisma(): PrismaClient {
  if (global.__prisma) {
    try { global.__prisma.$disconnect() } catch {}
  }
  global.__prisma = new PrismaClient()
  prisma = global.__prisma
  return global.__prisma
}

prisma = getPrisma()

export { prisma }
export default prisma
