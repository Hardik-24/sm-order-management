// POST /api/auth/logout - Clear auth cookie
export default defineEventHandler(async (event) => {
  const isProd = process.env.NODE_ENV === 'production'
  deleteCookie(event, 'auth_token', {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax'
  })
  return { success: true }
})
