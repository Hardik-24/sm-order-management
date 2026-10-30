import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readBody(event)
  
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: 'Category name is required' })
  }

  const category = await prisma.category.create({
    data: {
      name,
      description: typeof body?.description === 'string' ? body.description.trim() : null
    }
  })

  return category
})
