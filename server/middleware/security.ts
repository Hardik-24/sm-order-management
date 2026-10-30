import { defineEventHandler, getMethod, getHeader, setResponseHeaders } from 'h3'
import { isAllowedOrigin } from '~~/server/utils/security'

export default defineEventHandler((event) => {
  const method = getMethod(event)
  const isProd = process.env.NODE_ENV === 'production'
  const origin = getHeader(event, 'origin')
  const path = event.path || ''

  // 1. Production-Grade HTTP Security Headers (Zero performance overhead)
  const securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
    'X-DNS-Prefetch-Control': 'on',
    'X-Permitted-Cross-Domain-Policies': 'none'
  }

  if (isProd) {
    securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
  }

  // 2. Dynamic CORS handling (Supports Web, Capacitor / Mobile App, and Local Dev)
  if (origin && isAllowedOrigin(event)) {
    securityHeaders['Access-Control-Allow-Origin'] = origin
    securityHeaders['Access-Control-Allow-Credentials'] = 'true'
    securityHeaders['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
    securityHeaders['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    securityHeaders['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
    securityHeaders['Vary'] = 'Origin'
  } else if (!origin) {
    // Standard direct or same-origin request
    securityHeaders['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  }

  setResponseHeaders(event, securityHeaders)

  // 3. Fast-path Preflight OPTIONS response
  if (method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.statusMessage = 'No Content'
    return ''
  }

  // 4. CSRF Defense for mutating API requests (POST, PUT, PATCH, DELETE)
  // Blocks requests originating from malicious third-party websites while transparently allowing mobile apps and same-origin web traffic
  if (path.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (origin && !isAllowedOrigin(event)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Cross-origin request rejected'
      })
    }
  }
})
