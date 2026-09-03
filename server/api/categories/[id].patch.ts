import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing category ID' })
  
  const body = await readBody(event)
  
  const category = await prisma.category.update({
    where: { id },
    data: body
  })

  return category
})
