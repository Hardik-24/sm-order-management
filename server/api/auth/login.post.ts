// POST /api/auth/login - Authenticate user with email/password
import prisma from '~~/server/utils/prisma'
import { verifyPassword, createToken } from '~~/server/utils/auth'
import { enforceRateLimit } from '~~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  // 1. Rate Limiting: Max 12 login attempts per 10 minutes per IP
  enforceRateLimit(event, {
    max: 12,
    windowSeconds: 600,
    namespace: 'auth_login',
    message: 'Too many login attempts. Please wait 10 minutes before trying again.'
  })

  const body = await readBody(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, data: { message: 'Invalid email or password' } })
  }

  // Verify password with bcrypt
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw createError({ statusCode: 401, data: { message: 'Invalid email or password' } })
  }

  // Create JWT token
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    allowedPages: (user.allowedPages as any) || [],
    actionPermissions: (user.actionPermissions as any) || null,
  }
  const token = createToken(sessionUser)

  // Set HTTP-only secure cookie
  const isProd = process.env.NODE_ENV === 'production'
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return { user: sessionUser, token }
})
