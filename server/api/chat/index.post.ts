import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  const text = (body.content || '').trim()
  if (!text && !body.attachment) {
    throw createError({ statusCode: 400, message: 'Message content or attachment is required' })
  }

  let contentToSave = text
  if (body.attachment || (body.replyTo && typeof body.replyTo === 'object')) {
    contentToSave = JSON.stringify({
      text,
      replyTo: body.replyTo && typeof body.replyTo === 'object' ? {
        id: body.replyTo.id,
        senderName: body.replyTo.senderName,
        text: (body.replyTo.text || '').slice(0, 150)
      } : null,
      attachment: body.attachment && typeof body.attachment === 'object' ? {
        url: body.attachment.url,
        name: body.attachment.name,
        size: body.attachment.size,
        type: body.attachment.type,
        mimeType: body.attachment.mimeType,
        blurPreview: body.attachment.blurPreview || null
      } : null
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
  let attachment = null
  if (message.content.startsWith('{') && message.content.endsWith('}')) {
    try {
      const parsed = JSON.parse(message.content)
      if (parsed && (parsed.text !== undefined || parsed.attachment !== undefined)) {
        parsedContent = parsed.text || ''
        replyTo = parsed.replyTo || null
        attachment = parsed.attachment || null
      }
    } catch (e) {}
  }

  return {
    ...message,
    parsedContent,
    replyTo,
    attachment
  }
})
