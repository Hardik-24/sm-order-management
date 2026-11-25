import { defineEventHandler, readBody } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const body = await readBody(event).catch(() => ({}))
  const resetMappings = Boolean(body?.resetMappings)

  // 1. Reset manual posted vouchers record
  await prisma.systemSetting.upsert({
    where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' },
    update: { value: JSON.stringify({}) },
    create: { key: 'BUSY_TALLY_POSTED_VOUCHERS', value: JSON.stringify({}) }
  })

  // 2. Optionally reset party mappings if requested
  if (resetMappings) {
    await prisma.systemSetting.upsert({
      where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' },
      update: { value: JSON.stringify({}) },
      create: { key: 'BUSY_TALLY_PARTY_MAPPINGS', value: JSON.stringify({}) }
    })
  }

  return {
    success: true,
    resetMappings,
    message: resetMappings
      ? 'All test postings and party mappings have been completely reset.'
      : 'All test postings have been cleared. Voucher status now reflects live Tally books.'
  }
})
