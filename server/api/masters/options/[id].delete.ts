import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing option ID' })

  const existing = await prisma.masterOption.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Option not found' })
  }

  await prisma.masterOption.delete({
    where: { id }
  })

  return { success: true, message: `Option "${existing.label}" deleted` }
})
