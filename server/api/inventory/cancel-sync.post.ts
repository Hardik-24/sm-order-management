import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'SALES'])
  
  await prisma.systemSetting.upsert({
    where: { key: 'sync_requested' },
    update: { value: 'false' },
    create: { key: 'sync_requested', value: 'false' }
  })
  
  return { success: true }
})
