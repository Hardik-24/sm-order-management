// Server-side auth utilities
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { SessionUser } from '~/types'
import type { H3Event } from 'h3'

const SECRET = process.env.NUXT_AUTH_SECRET || 'dev-secret-change-in-production'

/** Hash a password with bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/** Verify password against hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Create a JWT token with user data */
export function createToken(user: SessionUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role,
      avatar: user.avatar,
      allowedPages: user.allowedPages,
      actionPermissions: user.actionPermissions
    },
    SECRET,
    { expiresIn: '7d' }
  )
}

// In-memory revocation tracker for force logging out all devices
const revokedSessions: Record<string, number> = {}

export function revokeUserSessions(email: string) {
  revokedSessions[email.toLowerCase()] = Math.floor(Date.now() / 1000)
}

/** Verify and decode a JWT token */
export function verifyToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, SECRET) as any
    if (decoded && decoded.email) {
      const revokedAt = revokedSessions[decoded.email.toLowerCase()]
      if (revokedAt && decoded.iat && decoded.iat <= revokedAt) {
        return null // Session revoked!
      }
    }
    return decoded as SessionUser
  } catch {
    return null
  }
}

/** Get the current user from the request cookie or Authorization header */
export function getUserFromEvent(event: H3Event): SessionUser | null {
  // 1. Check for cookie (Web App)
  let token = getCookie(event, 'auth_token')
  
  // 2. Check for Bearer token (Mobile App)
  if (!token) {
    const authHeader = getHeader(event, 'Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }
  }

  if (!token) return null
  return verifyToken(token)
}

/** Require authentication - throws 401 if not authenticated */
export function requireAuth(event: H3Event): SessionUser {
  const user = getUserFromEvent(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return user
}

/** Require specific roles - throws 403 if not authorized */
export function requireRole(event: H3Event, allowedRoles: string[]): SessionUser {
  const user = requireAuth(event)
  if (!allowedRoles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: insufficient permissions' })
  }
  return user
}

/** Require specific action permission (e.g. canEditOrders, canEditOrderStatus, canCancelOrders, canEditCustomers, canEditProducts, canDeleteQuotations) */
export async function requireActionPermission(
  event: H3Event,
  permission: 'canEditOrders' | 'canEditOrderStatus' | 'canCancelOrders' | 'canEditCustomers' | 'canEditProducts' | 'canDeleteQuotations'
): Promise<SessionUser> {
  const sessionUser = requireAuth(event)
  if (sessionUser.role === 'ADMIN') {
    return sessionUser
  }

  const { prisma } = await import('~~/server/utils/prisma')
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, role: true, isActive: true, actionPermissions: true }
  })

  if (!dbUser || !dbUser.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User inactive or not found' })
  }

  if (dbUser.role === 'ADMIN') {
    return sessionUser
  }

  const perms = (dbUser.actionPermissions && typeof dbUser.actionPermissions === 'object')
    ? (dbUser.actionPermissions as Record<string, boolean>)
    : {}

  let hasPerm = false
  if (perms[permission] !== undefined) {
    hasPerm = Boolean(perms[permission])
  } else {
    // Default role capabilities
    if (permission === 'canEditOrders' && dbUser.role === 'SALES') hasPerm = true
    if (permission === 'canEditCustomers' && dbUser.role === 'SALES') hasPerm = true
  }

  if (!hasPerm) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: You do not have permission to perform this action (${permission}).`
    })
  }

  return sessionUser
}

