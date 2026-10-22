import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing option ID' })

  const body = await readBody(event)

  const existing = await prisma.masterOption.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Option not found' })
  }

  // If marked as default, clear default from others in group
  if (body.isDefault) {
    await prisma.masterOption.updateMany({
      where: { group: existing.group, id: { not: id } },
      data: { isDefault: false }
    })
  }

  const data: Record<string, any> = {}
  if (body.label !== undefined) data.label = body.label.trim()
  if (body.value !== undefined) data.value = body.value.trim()
  if (body.description !== undefined) data.description = body.description ? body.description.trim() : null
  if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault)
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0

  const updated = await prisma.masterOption.update({
    where: { id },
    data
  })

  return updated
})
