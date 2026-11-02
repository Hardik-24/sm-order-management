import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  // Clear all devices waiting for approval (not approved and not permanently blocked)
  const result = await prisma.trustedDevice.deleteMany({
    where: {
      isApproved: false,
      isBlocked: false
    }
  })

  return {
    success: true,
    count: result.count,
    message: result.count > 0 
      ? `Successfully cleared ${result.count} pending device ${result.count === 1 ? 'request' : 'requests'}.`
      : 'No pending device requests to clear.'
  }
})
