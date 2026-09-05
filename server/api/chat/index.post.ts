import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  if (!body.content || !body.content.trim()) {
    throw createError({ statusCode: 400, message: 'Message content is required' })
  }

  const message = await prisma.chatMessage.create({
    data: {
      content: body.content.trim(),
      userId: user.id
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

  return message
})
