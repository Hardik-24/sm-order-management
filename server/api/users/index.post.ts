import { requireRole } from '~~/server/utils/auth'
import { hashPassword } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])
  const body = await readBody(event)

  if (!body.email || !body.password || !body.name || !body.role) {
    throw createError({ statusCode: 400, statusMessage: 'Name, email, password, and role are required' })
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A user with this email already exists' })
  }

  // Hash password with bcrypt
  const hashedPassword = await hashPassword(body.password)

  const user = await prisma.user.create({
    data: {
      email: body.email.toLowerCase(),
      password: hashedPassword,
      name: body.name,
      role: body.role,
      isActive: body.isActive ?? true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  return user
})
