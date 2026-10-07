import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  if (!body.content || !body.content.trim()) {
    throw createError({ statusCode: 400, message: 'Message content is required' })
  }

  let contentToSave = body.content.trim()
  if (body.replyTo && typeof body.replyTo === 'object') {
    contentToSave = JSON.stringify({
      text: body.content.trim(),
      replyTo: {
        id: body.replyTo.id,
        senderName: body.replyTo.senderName,
        text: (body.replyTo.text || '').slice(0, 150)
      }
    })
  }

  const message = await prisma.chatMessage.create({
    data: {
      content: contentToSave,
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

  let parsedContent = message.content
  let replyTo = null
  if (message.content.startsWith('{') && message.content.endsWith('}')) {
    try {
      const parsed = JSON.parse(message.content)
      if (parsed && parsed.text !== undefined) {
        parsedContent = parsed.text
        replyTo = parsed.replyTo || null
      }
    } catch (e) {}
  }

  return {
    ...message,
    parsedContent,
    replyTo
  }
})
