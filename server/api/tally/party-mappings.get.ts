import { defineEventHandler } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' }
  })

  if (!setting?.value) {
    return {}
  }

  try {
    return JSON.parse(setting.value) as Record<string, string>
  } catch {
    return {}
  }
})
