import { defineEventHandler, createError, getQuery, setHeader } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { computePartyLedger } from '~~/server/utils/ledger'
import { generateLedgerVectorPdf } from '~~/server/utils/ledgerPdf'

export default defineEventHandler(async (event) => {
  // RBAC: Strict financial permission check
  await requireActionPermission(event, 'canDownloadPartyLedger')

  const query = getQuery(event)
  const partyParam = (query.party as string || '').trim()

  if (!partyParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required "party" query parameter.'
    })
  }

  const style = ((query.style as string) || 'sm').toLowerCase() === 'classic' ? 'classic' : 'sm'
  const isDownload = query.download === '1' || query.download === 'true'

  const ledgerData = await computePartyLedger(partyParam, query.from as string, query.to as string)
  const pdfBuffer = generateLedgerVectorPdf(ledgerData, style)

  const safeParty = ledgerData.party.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Ledger-${safeParty}-${style}-${ledgerData.period.to}.pdf`

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Length', pdfBuffer.length)
  setHeader(
    event,
    'Content-Disposition',
    isDownload ? `attachment; filename="${fileName}"` : `inline; filename="${fileName}"`
  )
  setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  return pdfBuffer
})
