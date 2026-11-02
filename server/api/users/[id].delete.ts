// DELETE /api/users/[id] - Admin Delete User Account
import { requireRole } from '~~/server/utils/auth'
import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const currentUser = requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing user ID' })
  }

  // Safety Lockout Prevention: Admin cannot delete themselves
  if (currentUser.id === id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot delete your own Administrator account to avoid system lockout.'
    })
  }

  // Find target user
  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: {
      salesOrders: { select: { id: true }, take: 1 },
      quotations: { select: { id: true }, take: 1 }
    }
  })

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Check for linked business records to protect accounting audit trail
  const hasOrders = targetUser.salesOrders?.length > 0
  const hasQuotes = targetUser.quotations?.length > 0

  if (hasOrders || hasQuotes) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot delete ${targetUser.name} because they have existing orders or quotations linked to their name. Please deactivate the account instead to maintain accounting audit integrity.`
    })
  }

  // Delete all trusted devices for this user
  await prisma.trustedDevice.deleteMany({
    where: { userId: id }
  })

  // Delete user account
  await prisma.user.delete({
    where: { id }
  })

  return {
    success: true,
    message: `User account "${targetUser.name}" and all associated device permissions have been permanently deleted.`
  }
})
