import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing category ID' })
  
  const body = await readBody(event)
  const data: Record<string, any> = {}

  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) throw createError({ statusCode: 400, message: 'Category name cannot be empty' })
    data.name = name
  }

  if (body?.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null
  }

  if (body?.isActive !== undefined) {
    data.isActive = Boolean(body.isActive)
  }
  
  const category = await prisma.category.update({
    where: { id },
    data
  })

  return category
})
