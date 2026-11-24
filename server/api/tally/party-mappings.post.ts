import { defineEventHandler, readBody, createError } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const body = await readBody(event)
  if (!body || !body.busyPartyName || !body.tallyLedgerName) {
    throw createError({ statusCode: 400, statusMessage: 'busyPartyName and tallyLedgerName are required' })
  }

  const busyKey = body.busyPartyName.trim()
  const tallyVal = body.tallyLedgerName.trim()

  const existing = await prisma.systemSetting.findUnique({
    where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' }
  })

  let map: Record<string, string> = {}
  if (existing?.value) {
    try {
      map = JSON.parse(existing.value)
    } catch {}
  }

  map[busyKey] = tallyVal

  await prisma.systemSetting.upsert({
    where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' },
    update: { value: JSON.stringify(map) },
    create: { key: 'BUSY_TALLY_PARTY_MAPPINGS', value: JSON.stringify(map) }
  })

  return { success: true, busyPartyName: busyKey, tallyLedgerName: tallyVal }
})
