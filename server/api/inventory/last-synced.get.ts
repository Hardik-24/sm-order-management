import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async () => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'last_synced' } })
  return { lastSynced: setting?.value || null }
})
