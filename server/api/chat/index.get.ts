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

  return messages.map(m => {
    let parsedContent = m.content
    let replyTo = null
    if (m.content.startsWith('{') && m.content.endsWith('}')) {
      try {
        const parsed = JSON.parse(m.content)
        if (parsed && parsed.text !== undefined) {
          parsedContent = parsed.text
          replyTo = parsed.replyTo || null
        }
      } catch (e) {}
    }
    return {
      ...m,
      parsedContent,
      replyTo
    }
  })
})
