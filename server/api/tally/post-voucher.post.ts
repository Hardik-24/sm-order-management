import { defineEventHandler, readBody, createError } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { enqueueTallyVoucher } from '~~/server/utils/tallyQueue'
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
  try {
    await requireActionPermission(event, 'canPostBusyToTally')

    const body = (await readBody(event)) as PostVoucherPayload
    if (!body || !body.voucherNo || !body.partyLedgerName || !Array.isArray(body.ledgerEntries) || body.ledgerEntries.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid voucher payload: Voucher No, Party Ledger, and at least 2 ledger entries are required' })
    }

    // 1. Validate Debit / Credit Balance
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

    const vchType = body.voucherType || 'Sales'
    const vchDate = (body.date || '').replace(/[^0-9]/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const vchNo = String(body.voucherNo || '').trim()
    const partyLedger = String(body.partyLedgerName || '').trim()
    const partyLedgerName = partyLedger
    const narration = body.narration || `${vchType} Invoice ${vchNo}`
    const reference = String(body.reference || '').trim()

    // 2. DUPLICATE CHECK & DOUBLE-POSTING PREVENTION
    const normNo = vchNo.toUpperCase()
    const normRef = (reference || '').toUpperCase()

    // Smart party normalization for robust matching
    function cleanParty(name: string): string {
      return (name || '')
        .toLowerCase()
        .replace(/\b(cr|dr|pvt|ltd|private|limited|llp|inc|co|company|enterprises|agency|agencies)\b/gi, '')
        .replace(/[^a-z0-9]/g, '')
    }

    function isSmartPartyMatch(p1: string, p2: string): boolean {
      if (!p1 || !p2) return false
      const c1 = cleanParty(p1)
      const c2 = cleanParty(p2)
      if (!c1 || !c2) return false
      if (c1 === c2) return true
      if (c1.length >= 4 && c2.length >= 4 && (c1.includes(c2) || c2.includes(c1))) return true
      return false
    }

    const [receivablesSetting, payablesSetting, postedSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' } }),
    ])

    // Determine active company name from synced financials or standard fallback
    let companyName = 'SRI LAKSHMI PLYWOODS 2627'
    if (receivablesSetting?.value) {
      try {
        const rec = JSON.parse(receivablesSetting.value)
        if (rec.company && rec.company !== 'No Company Open') companyName = rec.company
      } catch {}
    }

    let isAlreadyInDbSync = false
    let syncedType = ''
    let matchedRef = ''

    const isSalesVch = vchType.toLowerCase().includes('sales')
    const isPurchVch = vchType.toLowerCase().includes('purchase') || vchType.toLowerCase().includes('expense')

    if (isSalesVch && receivablesSetting?.value) {
      try {
        const rec = JSON.parse(receivablesSetting.value)
        if (Array.isArray(rec.vouchers)) {
          const found = rec.vouchers.find((v: any) => {
            const numMatch = (v.voucherNo && v.voucherNo.trim().toUpperCase() === normNo) ||
                             (v.ref && v.ref.trim().toUpperCase() === normNo) ||
                             (normRef && v.voucherNo && v.voucherNo.trim().toUpperCase() === normRef) ||
                             (normRef && v.ref && v.ref.trim().toUpperCase() === normRef)
            if (numMatch) return true

            // Smart 3-way check: Same date + Amount within ₹1 + Party matches
            const vDateClean = (v.date || '').replace(/[^0-9]/g, '')
            if (vDateClean === vchDate) {
              const amtDiff = Math.abs((Number(v.amount) || 0) - totalDebit)
              if (amtDiff < 1.0 && (isSmartPartyMatch(v.party, partyLedger) || isSmartPartyMatch(v.party, body.busyPartyName || ''))) {
                return true
              }
            }
            return false
          })
          if (found) {
            isAlreadyInDbSync = true
            syncedType = 'Sales'
            matchedRef = found.ref || found.voucherNo || ''
          }
        }
      } catch {}
    } else if (isPurchVch && payablesSetting?.value) {
      try {
        const pay = JSON.parse(payablesSetting.value)
        if (Array.isArray(pay.vouchers)) {
          const found = pay.vouchers.find((v: any) => {
            const numMatch = (v.voucherNo && v.voucherNo.trim().toUpperCase() === normNo) ||
                             (v.ref && v.ref.trim().toUpperCase() === normNo) ||
                             (normRef && v.voucherNo && v.voucherNo.trim().toUpperCase() === normRef) ||
                             (normRef && v.ref && v.ref.trim().toUpperCase() === normRef)
            if (numMatch) return true

            // Smart 3-way check: Same date + Amount within ₹1 + Party matches
            const vDateClean = (v.date || '').replace(/[^0-9]/g, '')
            if (vDateClean === vchDate) {
              const amtDiff = Math.abs((Number(v.amount) || 0) - totalDebit)
              if (amtDiff < 1.0 && (isSmartPartyMatch(v.party, partyLedger) || isSmartPartyMatch(v.party, body.busyPartyName || ''))) {
                return true
              }
            }
            return false
          })
          if (found) {
            isAlreadyInDbSync = true
            syncedType = 'Purchase'
            matchedRef = found.ref || found.voucherNo || ''
          }
        }
      } catch {}
    }

    // Check manual/permanent posted registry
    if (postedSetting?.value) {
      try {
        const postedMap = JSON.parse(postedSetting.value)
        if (postedMap[normNo] || postedMap[vchNo]) {
          isAlreadyInDbSync = true
          syncedType = 'Posted Register'
        }
      } catch {}
    }

    if (isAlreadyInDbSync) {
      const refSuffix = matchedRef ? ` (Ref / Number: ${matchedRef})` : ''
      return {
        success: false,
        alreadyExists: true,
        voucherNo: vchNo,
        error: `Duplicate Blocked: This voucher is already present in Tally Prime (${syncedType})${refSuffix}. Double posting is strictly prohibited.`
      }
    }

    // Check queue for duplicate pending/in-flight jobs via native Prisma model
    try {
      const existingQueueJob = await prisma.tallyVoucherQueue.findFirst({
        where: {
          voucherNo: { equals: vchNo, mode: 'insensitive' },
          status: { in: ['PENDING', 'PROCESSING', 'SUCCESS'] }
        },
        orderBy: { createdAt: 'desc' }
      })
      if (existingQueueJob) {
        if (existingQueueJob.status === 'SUCCESS') {
          return {
            success: false,
            alreadyExists: true,
            voucherNo: vchNo,
            error: `Duplicate Blocked: Voucher #${vchNo} has already been posted to Tally Prime. Double posting is strictly prohibited.`
          }
        } else {
          return {
            success: false,
            alreadyExists: true,
            voucherNo: vchNo,
            error: `Voucher #${vchNo} is already in the queue (status: ${existingQueueJob.status}) and currently being transmitted by the Sync Agent.`
          }
        }
      }
    } catch (_) {}

    // 3. Construct Tally XML
    const ledgerXmlParts = body.ledgerEntries.map((e, idx) => {
      const isPositive = Boolean(e.isDeemedPositive)
      const rawAmt = Math.abs(Number(e.amount) || 0)
      // In Tally:
      // Debit amount is represented as negative (e.g. -1180.00) with ISDEEMEDPOSITIVE=Yes
      // Credit amount is represented as positive (e.g. 1000.00) with ISDEEMEDPOSITIVE=No
      const formattedAmount = isPositive ? `-${rawAmt.toFixed(2)}` : rawAmt.toFixed(2)
      const escapedLedger = String(e.ledgerName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const isParty = idx === 0 || String(e.ledgerName || '').trim().toLowerCase() === partyLedger.toLowerCase()

      // Bill-by-Bill Allocation: Ensure invoice is tracked under specific Bill Ref (New Ref) in Tally
      let billAllocationsXml = ''
      if (isParty) {
        const billRefName = String(reference || vchNo).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

    const escapedCompany = String(companyName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedParty = String(partyLedger).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedNarration = String(narration).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedReference = String(reference).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

    // 4. Save Party Mapping if requested
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

    // 5. Enqueue Voucher Job for Sync Agent on Main PC via native Prisma
    const jobId = await enqueueTallyVoucher({
      voucherNo: vchNo,
      voucherType: vchType,
      payload: {
        xml: tallyEnvelope,
        companyName,
        voucherNo: vchNo,
        voucherType: vchType,
        busyPartyName: body.busyPartyName,
        partyLedgerName,
        date: vchDate,
        amount: totalDebit,
        saveMapping: body.saveMapping
      }
    })

    return {
      success: true,
      queued: true,
      jobId,
      voucherNo: vchNo,
      voucherType: vchType,
      company: companyName
    }
  } catch (err: any) {
    console.error('[POST /api/tally/post-voucher Error]:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Internal Server Error'
    })
  }
})
