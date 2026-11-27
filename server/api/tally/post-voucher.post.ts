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
    const defaultNarration = vchType.toLowerCase().includes('sales') ? 'Sales of goods.' : `${vchType} Invoice ${vchNo}`
    const narration = (body.narration && String(body.narration).trim()) ? String(body.narration).trim() : defaultNarration
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

    const [receivablesSetting, payablesSetting, postedSetting, masterLedgersSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_master_ledgers' } }),
    ])

    // Determine active company name from synced financials or standard fallback
    let companyName = 'SRI LAKSHMI PLYWOODS 2627'
    if (receivablesSetting?.value) {
      try {
        const rec = JSON.parse(receivablesSetting.value)
        if (rec.company && rec.company !== 'No Company Open') companyName = rec.company
      } catch {}
    }

    // Check manual/permanent posted registry
    let isManuallyUnmarked = false
    if (postedSetting?.value) {
      try {
        const postedMap = JSON.parse(postedSetting.value)
        const matchingKey = Object.keys(postedMap).find(
          k => k.trim().toUpperCase() === normNo || k.trim().toUpperCase() === vchNo.trim().toUpperCase()
        )
        const entry = matchingKey ? postedMap[matchingKey] : (postedMap[normNo] || postedMap[vchNo])
        if (entry) {
          if (entry.unmarked) {
            isManuallyUnmarked = true
          } else {
            isAlreadyInDbSync = true
            syncedType = 'Posted Register'
          }
        }
      } catch {}
    }

    let isAlreadyInDbSync = false
    let syncedType = ''
    let matchedRef = ''

    const isSalesVch = vchType.toLowerCase().includes('sales')
    const isPurchVch = vchType.toLowerCase().includes('purchase') || vchType.toLowerCase().includes('expense')

    // Only perform ledger/vouchers duplicate lookup if the user hasn't explicitly unmarked it
    if (!isManuallyUnmarked) {
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

          // Also check party transactions and bills
          if (!isAlreadyInDbSync && Array.isArray(rec.parties)) {
            for (const p of rec.parties) {
              if (isAlreadyInDbSync) break
              if (Array.isArray(p.transactions)) {
                const found = p.transactions.find((tx: any) => {
                  const num = (tx.vchNo || '').trim().toUpperCase()
                  return num === normNo || (normRef && num === normRef)
                })
                if (found) {
                  isAlreadyInDbSync = true
                  syncedType = 'Sales'
                  matchedRef = found.vchNo || ''
                  break
                }
              }
              if (Array.isArray(p.bills)) {
                const found = p.bills.find((b: any) => {
                  const ref = (b.ref || '').trim().toUpperCase()
                  return ref === normNo || (normRef && ref === normRef)
                })
                if (found) {
                  isAlreadyInDbSync = true
                  syncedType = 'Sales'
                  matchedRef = found.ref || ''
                  break
                }
              }
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

          // Also check creditor transactions and bills
          if (!isAlreadyInDbSync && Array.isArray(pay.parties)) {
            for (const p of pay.parties) {
              if (isAlreadyInDbSync) break
              if (Array.isArray(p.transactions)) {
                const found = p.transactions.find((tx: any) => {
                  const num = (tx.vchNo || '').trim().toUpperCase()
                  return num === normNo || (normRef && num === normRef)
                })
                if (found) {
                  isAlreadyInDbSync = true
                  syncedType = 'Purchase'
                  matchedRef = found.vchNo || ''
                  break
                }
              }
              if (Array.isArray(p.bills)) {
                const found = p.bills.find((b: any) => {
                  const ref = (b.ref || '').trim().toUpperCase()
                  return ref === normNo || (normRef && ref === normRef)
                })
                if (found) {
                  isAlreadyInDbSync = true
                  syncedType = 'Purchase'
                  matchedRef = found.ref || ''
                  break
                }
              }
            }
          }
        } catch {}
      }
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
    // If the user manually unmarked the voucher, ignore old SUCCESS jobs and only block on active in-flight jobs
    try {
      const existingQueueJob = await prisma.tallyVoucherQueue.findFirst({
        where: {
          voucherNo: { equals: vchNo, mode: 'insensitive' },
          status: { in: isManuallyUnmarked ? ['PENDING', 'PROCESSING'] : ['PENDING', 'PROCESSING', 'SUCCESS'] }
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

    // 3. Extract Party Details directly from Tally's Synced Master Records
    const GST_STATE_MAP: Record<string, string> = {
      '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
      '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
      '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
      '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
      '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
      '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
      '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
      '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
    }

    function findTallyPartyMaster(partyName: string) {
      const clean = (partyName || '').trim().toLowerCase()
      if (!clean) return null
      // Check Debtors
      if (receivablesSetting?.value) {
        try {
          const rec = JSON.parse(receivablesSetting.value)
          if (Array.isArray(rec.parties)) {
            const found = rec.parties.find((p: any) => (p.party || '').trim().toLowerCase() === clean)
            if (found) return found
          }
        } catch {}
      }
      // Check Creditors
      if (payablesSetting?.value) {
        try {
          const pay = JSON.parse(payablesSetting.value)
          if (Array.isArray(pay.parties)) {
            const found = pay.parties.find((p: any) => (p.party || '').trim().toLowerCase() === clean)
            if (found) return found
          }
        } catch {}
      }
      // Check Master Ledgers
      if (masterLedgersSetting?.value) {
        try {
          const mas = JSON.parse(masterLedgersSetting.value)
          if (Array.isArray(mas.allLedgers)) {
            const found = mas.allLedgers.find((l: any) => (l.name || '').trim().toLowerCase() === clean)
            if (found) return found
          }
        } catch {}
      }
      return null
    }

    const tallyParty = findTallyPartyMaster(partyLedger)
    const rawGstin = String(tallyParty?.gstin || '').trim().toUpperCase()
    const gstinPrefix = rawGstin.slice(0, 2)
    const partyState = String(tallyParty?.state || '').trim() || GST_STATE_MAP[gstinPrefix] || 'Karnataka'
    const partyCountry = String(tallyParty?.country || '').trim() || 'India'
    const placeOfSupply = partyState
    const gstRegType = rawGstin.length === 15 ? 'Regular' : (tallyParty?.gstType || 'Unregistered')

    const addressLines: string[] = []
    if (Array.isArray(tallyParty?.addressLines) && tallyParty.addressLines.length > 0) {
      addressLines.push(...tallyParty.addressLines.map((l: string) => String(l || '').trim()).filter(Boolean))
    } else if (tallyParty?.address) {
      const splitLines = String(tallyParty.address).split(/,\s*/).map(s => s.trim()).filter(Boolean)
      addressLines.push(...splitLines)
    }

    const escapedCompany = String(companyName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedParty = String(partyLedger).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedState = partyState.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedCountry = partyCountry.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedPlaceOfSupply = placeOfSupply.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedGstin = rawGstin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedGstRegType = gstRegType.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedNarration = String(narration).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedReference = String(reference).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const referenceXml = escapedReference ? `<REFERENCE>${escapedReference}</REFERENCE><REFERENCEDATE>${vchDate}</REFERENCEDATE>` : ''

    const buyerAddressXml = addressLines.length > 0 ? `
          <BASICBUYERADDRESS.LIST TYPE="String">
            ${addressLines.map(line => `<BASICBUYERADDRESS>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</BASICBUYERADDRESS>`).join('\n            ')}
          </BASICBUYERADDRESS.LIST>
          <ADDRESS.LIST TYPE="String">
            ${addressLines.map(line => `<ADDRESS>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</ADDRESS>`).join('\n            ')}
          </ADDRESS.LIST>` : ''

    const partyDetailsXml = `
          <PARTYNAME>${escapedParty}</PARTYNAME>
          <PARTYLEDGERNAME>${escapedParty}</PARTYLEDGERNAME>
          <BASICBUYERNAME>${escapedParty}</BASICBUYERNAME>
          <BASICBASEPARTYNAME>${escapedParty}</BASICBASEPARTYNAME>
          ${buyerAddressXml}
          <STATENAME>${escapedState}</STATENAME>
          <CONSIGNEESTATENAME>${escapedState}</CONSIGNEESTATENAME>
          <COUNTRYOFRESIDENCE>${escapedCountry}</COUNTRYOFRESIDENCE>
          <PLACEOFSUPPLY>${escapedPlaceOfSupply}</PLACEOFSUPPLY>
          ${escapedGstin ? `<PARTYGSTIN>${escapedGstin}</PARTYGSTIN>` : ''}
          <GSTREGISTRATIONTYPE>${escapedGstRegType}</GSTREGISTRATIONTYPE>`.trim()

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
          ${partyDetailsXml}
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
