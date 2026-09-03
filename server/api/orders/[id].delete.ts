import { requireRole, getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  await requireRole(event, ['ADMIN', 'SALES'])
  
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID' })
  
  const order = await prisma.order.findUnique({
    where: { id }
  })

  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  // Prisma will cascade delete items, timeline, statuses if configured, 
  // but to be safe, let's delete explicitly if we need to.
  // Actually, wait, let's check prisma schema if cascade is enabled.
  
  await prisma.order.delete({ where: { id } })

  return { success: true }
})
