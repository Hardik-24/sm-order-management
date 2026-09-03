import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== 'Bearer super-secret-key-123') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)

  await prisma.systemSetting.upsert({
    where: { key: 'sync_progress' },
    update: { value: JSON.stringify(body) },
    create: { key: 'sync_progress', value: JSON.stringify(body) }
  })

  return { success: true }
})
