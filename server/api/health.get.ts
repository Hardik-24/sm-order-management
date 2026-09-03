import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok' }
  } catch (err) {
    return { status: 'error' }
  }
})
