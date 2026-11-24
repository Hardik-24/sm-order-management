import { defineEventHandler } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { getTallyConnectionStatus } from '~~/server/utils/tallyClient'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')
  return await getTallyConnectionStatus()
})
