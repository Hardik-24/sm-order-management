import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Quotation ID required' })
  }

  const body = await readBody(event)
  let p = getPrisma()

  const data: Record<string, any> = {}
  if (body.signature !== undefined) {
    data.signature = body.signature ? String(body.signature) : null
  }

  try {
    const updated = await p.quotation.update({
      where: { id },
      data
    })
    return { success: true, quotation: updated }
  } catch (err: any) {
    p = resetPrisma()
    const updated = await p.quotation.update({
      where: { id },
      data
    })
    return { success: true, quotation: updated }
  }
})
