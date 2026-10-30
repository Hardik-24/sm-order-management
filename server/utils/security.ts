import crypto from 'crypto'
import type { H3Event } from 'h3'

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Validates request Origin/Referer for mutating requests (CSRF Defense)
 * Only blocks requests if an Origin header is explicitly sent from an unauthorized third-party origin.
 * Mobile apps and same-origin browser requests pass seamlessly.
 */
export function isAllowedOrigin(event: H3Event): boolean {
  const origin = getHeader(event, 'origin')
  if (!origin) {
    // Non-browser clients, mobile apps, or same-origin GET/POST without Origin header
    return true
  }

  const host = getHeader(event, 'host')
  const protocol = getHeader(event, 'x-forwarded-proto') || 'https'
  const appUrl = process.env.NUXT_PUBLIC_APP_URL || ''

  try {
    const originUrl = new URL(origin)
    // 1. Same host match
    if (host && originUrl.host.toLowerCase() === host.toLowerCase()) {
      return true
    }

    // 2. Localhost / Dev match
    if (
      originUrl.hostname === 'localhost' ||
      originUrl.hostname === '127.0.0.1' ||
      originUrl.protocol === 'capacitor:' ||
      originUrl.protocol === 'ionic:'
    ) {
      return true
    }

    // 3. Configured app URL match
    if (appUrl) {
      const parsedAppUrl = new URL(appUrl)
      if (originUrl.host.toLowerCase() === parsedAppUrl.host.toLowerCase()) {
        return true
      }
    }

    // 4. Vercel deployment preview / production domains
    if (originUrl.hostname.endsWith('.vercel.app')) {
      return true
    }
  } catch {
    return false
  }

  return false
}
