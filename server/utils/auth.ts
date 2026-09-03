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
    { id: user.id, name: user.name, email: user.email, role: user.role },
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

/** Get the current user from the request cookie */
export function getUserFromEvent(event: H3Event): SessionUser | null {
  const token = getCookie(event, 'auth_token')
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
