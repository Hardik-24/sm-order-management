import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'SALES'])
  const id = event.context.params?.id

  if (!id) {
    throw createError({ statusCode: 400, message: 'Request ID is required' })
  }

  const body = await readBody(event)
  const { status, declinedReason } = body

  if (!status || !['PENDING', 'CONFIRMED', 'DECLINED'].includes(status)) {
    throw createError({ statusCode: 400, message: 'Valid status is required (PENDING, CONFIRMED, DECLINED)' })
  }

  const updated = await prisma.orderRequest.update({
    where: { id },
    data: {
      status,
      declinedReason: declinedReason ? declinedReason.trim() : null
    }
  })

  return {
    success: true,
    request: updated
  }
})
