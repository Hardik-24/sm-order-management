import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const body = await readBody(event)
  const { quotationAnonymousMode } = body

  if (quotationAnonymousMode !== undefined) {
    const strVal = quotationAnonymousMode ? 'true' : 'false'
    await prisma.systemSetting.upsert({
      where: { key: 'quotation_anonymous_mode' },
      update: { value: strVal },
      create: { key: 'quotation_anonymous_mode', value: strVal }
    })
  }

  return {
    success: true,
    quotationAnonymousMode: Boolean(quotationAnonymousMode)
  }
})
