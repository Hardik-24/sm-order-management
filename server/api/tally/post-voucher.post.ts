import { defineEventHandler, readBody, createError } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { queryTally, getTallyConnectionStatus } from '~~/server/utils/tallyClient'
import { prisma } from '~~/server/utils/prisma'

export interface PostVoucherPayload {
  voucherId: string
  voucherNo: string
  voucherType?: string
  date: string // YYYYMMDD
  partyLedgerName: string
  reference?: string
  referenceDate?: string
  narration?: string
  ledgerEntries: Array<{
    ledgerName: string
    amount: number
    isDeemedPositive: boolean
  }>
  busyPartyName?: string
  saveMapping?: boolean
}

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const body = (await readBody(event)) as PostVoucherPayload
  if (!body || !body.voucherNo || !body.partyLedgerName || !Array.isArray(body.ledgerEntries) || body.ledgerEntries.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid voucher payload: Voucher No, Party Ledger, and at least 2 ledger entries are required' })
  }

  // 1. Verify Tally connection and get current active company
  const status = await getTallyConnectionStatus()
  if (!status.online) {
    throw createError({ statusCode: 503, statusMessage: `Tally Prime is not reachable on port ${status.port}. Please ensure Tally Prime is open.` })
  }

  const companyName = status.company && status.company !== 'No Company Open' ? status.company : 'SRI LAKSHMI PLYWOODS 2627'

  // 2. Validate Debit / Credit Balance
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of body.ledgerEntries) {
    const amt = Math.abs(Number(entry.amount) || 0)
    if (entry.isDeemedPositive) {
      totalDebit += amt
    } else {
      totalCredit += amt
    }
  }

  const diff = Math.abs(totalDebit - totalCredit)
  if (diff > 0.05) {
    throw createError({
      statusCode: 422,
      statusMessage: `Imbalanced Voucher: Total Debits (₹${totalDebit.toFixed(2)}) do not equal Total Credits (₹${totalCredit.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`
    })
  }

  // 3. Construct Tally XML
  const vchType = body.voucherType || 'Sales'
  const vchDate = (body.date || '').replace(/[^0-9]/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const vchNo = body.voucherNo.trim()
  const partyLedger = body.partyLedgerName.trim()
  const narration = body.narration || `${vchType} Invoice ${vchNo}`
  const reference = (body.reference || '').trim()

  const ledgerXmlParts = body.ledgerEntries.map((e, idx) => {
    const isPositive = Boolean(e.isDeemedPositive)
    const rawAmt = Math.abs(Number(e.amount) || 0)
    // In Tally:
    // Debit amount is represented as negative (e.g. -1180.00) with ISDEEMEDPOSITIVE=Yes
    // Credit amount is represented as positive (e.g. 1000.00) with ISDEEMEDPOSITIVE=No
    const formattedAmount = isPositive ? `-${rawAmt.toFixed(2)}` : rawAmt.toFixed(2)
    const escapedLedger = e.ledgerName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const isParty = idx === 0 || e.ledgerName.trim().toLowerCase() === partyLedger.toLowerCase()

    // Bill-by-Bill Allocation: Ensure invoice is tracked under specific Bill Ref (New Ref) in Tally
    let billAllocationsXml = ''
    if (isParty) {
      const billRefName = (reference || vchNo).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      billAllocationsXml = `
        <BILLALLOCATIONS.LIST>
          <NAME>${billRefName}</NAME>
          <BILLTYPE>New Ref</BILLTYPE>
          <AMOUNT>${formattedAmount}</AMOUNT>
        </BILLALLOCATIONS.LIST>
      `
    }

    return `
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>${escapedLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isPositive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
        ${isParty ? '<ISPARTYLEDGER>Yes</ISPARTYLEDGER>' : ''}
        <AMOUNT>${formattedAmount}</AMOUNT>
        ${billAllocationsXml}
      </LEDGERENTRIES.LIST>
    `
  }).join('')

  const escapedCompany = companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedParty = partyLedger.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedNarration = narration.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedReference = reference.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const referenceXml = escapedReference ? `<REFERENCE>${escapedReference}</REFERENCE><REFERENCEDATE>${vchDate}</REFERENCEDATE>` : ''

  const tallyEnvelope = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${escapedCompany}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${vchDate}</DATE>
          <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${vchNo}</VOUCHERNUMBER>
          ${referenceXml}
          <PARTYLEDGERNAME>${escapedParty}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <VCHENTRYMODE>Accounting Invoice</VCHENTRYMODE>
          <ISINVOICE>Yes</ISINVOICE>
          <NARRATION>${escapedNarration}</NARRATION>
          ${ledgerXmlParts}
        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
  `.trim()

  // 4. Send XML to Tally Prime
  let tallyResponseRaw = ''
  try {
    tallyResponseRaw = await queryTally(tallyEnvelope, 15000)
  } catch (err: any) {
    throw createError({ statusCode: 502, statusMessage: `Failed sending to Tally Prime: ${err.message}` })
  }

  // 5. Parse Tally Response
  const createdMatch = tallyResponseRaw.match(/<CREATED[^>]*>([^<]+)<\/CREATED>/i)
  const alteredMatch = tallyResponseRaw.match(/<ALTERED[^>]*>([^<]+)<\/ALTERED>/i)
  const errorsMatch = tallyResponseRaw.match(/<ERRORS[^>]*>([^<]+)<\/ERRORS>/i)
  const lineErrors = Array.from(tallyResponseRaw.matchAll(/<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/gi)).map(m => m[1].trim())

  const createdCount = createdMatch ? parseInt(createdMatch[1], 10) : 0
  const alteredCount = alteredMatch ? parseInt(alteredMatch[1], 10) : 0
  const errorCount = errorsMatch ? parseInt(errorsMatch[1], 10) : (lineErrors.length > 0 ? lineErrors.length : 0)

  if (errorCount > 0 || (createdCount === 0 && alteredCount === 0)) {
    const errorDetails = lineErrors.join(' | ') || 'Tally rejected the voucher without specific error'
    return {
      success: false,
      voucherNo: vchNo,
      error: errorDetails,
      rawResponse: tallyResponseRaw.slice(0, 500)
    }
  }

  // 6. Record Voucher as Posted in Database
  try {
    const postedSetting = await prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' } })
    let postedMap: Record<string, { postedAt: string; tallyVchNo?: string }> = {}
    if (postedSetting?.value) {
      try { postedMap = JSON.parse(postedSetting.value) } catch {}
    }

    postedMap[vchNo] = {
      postedAt: new Date().toISOString(),
      tallyVchNo: vchNo
    }

    await prisma.systemSetting.upsert({
      where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' },
      update: { value: JSON.stringify(postedMap) },
      create: { key: 'BUSY_TALLY_POSTED_VOUCHERS', value: JSON.stringify(postedMap) }
    })
  } catch (_) {}

  // 7. Save Party Mapping if requested
  if (body.saveMapping && body.busyPartyName && body.partyLedgerName) {
    try {
      const busyKey = body.busyPartyName.trim()
      const tallyVal = body.partyLedgerName.trim()
      const existing = await prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' } })
      let map: Record<string, string> = {}
      if (existing?.value) {
        try { map = JSON.parse(existing.value) } catch {}
      }
      map[busyKey] = tallyVal
      await prisma.systemSetting.upsert({
        where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' },
        update: { value: JSON.stringify(map) },
        create: { key: 'BUSY_TALLY_PARTY_MAPPINGS', value: JSON.stringify(map) }
      })
    } catch (_) {}
  }

  return {
    success: true,
    voucherNo: vchNo,
    company: companyName,
    created: createdCount,
    altered: alteredCount,
    postedAt: new Date().toISOString()
  }
})
