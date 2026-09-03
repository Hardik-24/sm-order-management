import { requireRole } from '~~/server/utils/auth'
import { hashPassword } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user ID' })

  const body = await readBody(event)

  const data: Record<string, any> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.role !== undefined) data.role = body.role
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.email !== undefined) data.email = body.email.toLowerCase()

  // Hash password with bcrypt if provided
  if (body.password) {
    data.password = await hashPassword(body.password)
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return user
})
