import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Message ID is required' })
  }

  // Find the message
  const message = await prisma.chatMessage.findUnique({
    where: { id }
  })

  if (!message) {
    throw createError({ statusCode: 404, message: 'Message not found' })
  }

  // Only allow the original sender or an ADMIN to delete it
  if (message.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Not authorized to delete this message' })
  }

  await prisma.chatMessage.delete({
    where: { id }
  })

  return { success: true }
})
