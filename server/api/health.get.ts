import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  // Ultra-fast edge probe to verify Vercel server availability without DB query
  if (query.quick === '1' || query.quick === 'true') {
    return { status: 'ok', quick: true, timestamp: Date.now() }
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'connected', timestamp: Date.now() }
  } catch (err: any) {
    event.node.res.statusCode = 503
    return { status: 'error', db: 'unreachable', message: err?.message || 'Database error' }
  }
})
