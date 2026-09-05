import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const messages = await prisma.chatMessage.findMany({
    take: 200,
    orderBy: {
      createdAt: 'asc'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true
        }
      }
    }
  })

  return messages
})
