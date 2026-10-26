import { defineEventHandler } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'last_synced' }
  })

  return {
    success: true,
    lastSynced: setting?.value || null
  }
})
