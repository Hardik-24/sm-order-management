import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing customer ID' })
  
  const body = await readBody(event)
  
  delete body.id
  delete body.createdAt
  delete body.updatedAt
  
  const customer = await prisma.customer.update({
    where: { id },
    data: body
  })

  return customer
})
