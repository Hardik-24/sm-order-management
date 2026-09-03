import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'SALES'])
  
  const initialProgress = JSON.stringify({
    step: 1,
    totalSteps: 5,
    message: "Connecting to Busy on Office PC...",
    progress: 10
  })

  await prisma.systemSetting.upsert({
    where: { key: 'sync_requested' },
    update: { value: 'true' },
    create: { key: 'sync_requested', value: 'true' }
  })

  await prisma.systemSetting.upsert({
    where: { key: 'sync_progress' },
    update: { value: initialProgress },
    create: { key: 'sync_progress', value: initialProgress }
  })
  
  return { success: true }
})
