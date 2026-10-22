import { getUserFromEvent } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionUser = getUserFromEvent(event)
  if (!sessionUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  // Fetch latest user details from DB to ensure real-time accuracy of permissions and active status
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      allowedPages: true,
      actionPermissions: true,
      isActive: true,
    },
  })

  if (!dbUser || !dbUser.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'User account inactive or not found' })
  }

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      avatar: dbUser.avatar,
      allowedPages: (dbUser.allowedPages as any) || [],
      actionPermissions: (dbUser.actionPermissions as any) || null,
    },
  }
})
