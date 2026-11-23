import { defineEventHandler, createError, getQuery } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { computePartyLedger } from '~~/server/utils/ledger'

export default defineEventHandler(async (event) => {
  // 1. RBAC: Strict financial permission check
  await requireActionPermission(event, 'canDownloadPartyLedger')

  const query = getQuery(event)
  const partyParam = (query.party as string || '').trim()

  if (!partyParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required "party" query parameter.'
    })
  }

  return await computePartyLedger(partyParam, query.from as string, query.to as string)
})
