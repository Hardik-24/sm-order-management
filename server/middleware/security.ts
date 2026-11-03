import { defineEventHandler, getMethod, getHeader, setResponseHeaders } from 'h3'
import { isAllowedOrigin } from '~~/server/utils/security'

export default defineEventHandler((event) => {
  const method = getMethod(event)
  const isProd = process.env.NODE_ENV === 'production'
  const origin = getHeader(event, 'origin')
  const path = event.path || ''

  // 1. Production-Grade HTTP Security Headers (Zero performance overhead)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-scripts.com https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google.com https://1.1.1.1 https://*.vercel-insights.com https://va.vercel-scripts.com",
    "frame-src 'self' about: blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ]

  if (isProd) {
    cspDirectives.push('upgrade-insecure-requests')
  }

  const securityHeaders: Record<string, string> = {
    'Content-Security-Policy': cspDirectives.join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), payment=(), usb=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
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
    const reqHeaders = getHeader(event, 'access-control-request-headers')
    securityHeaders['Access-Control-Allow-Headers'] = reqHeaders 
      ? `${reqHeaders}, Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-id, x-device-name, x-device-type, x-automated-test`
      : 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-id, x-device-name, x-device-type, x-automated-test'
    securityHeaders['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
    securityHeaders['Vary'] = 'Origin, Access-Control-Request-Headers'
  } else if (!origin) {
    // Standard direct or same-origin request
    securityHeaders['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  }

  setResponseHeaders(event, securityHeaders)

  // Strip technology leakage headers
  if (event.node?.res?.removeHeader) {
    event.node.res.removeHeader('x-powered-by')
    event.node.res.removeHeader('X-Powered-By')
  }

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
