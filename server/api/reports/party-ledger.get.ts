import { defineEventHandler, createError, getQuery } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export interface LedgerTransaction {
  date: string
  particulars: string
  vchType: string
  vchNo: string
  debit: number | null
  credit: number | null
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}

function parseDateInput(str: string | undefined | null): Date | null {
  if (!str) return null
  const trimmed = str.trim()

  // Match ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0, 0)
  }

  // Match Tally format: 1-Apr-26, 01-Apr-2026
  const parts = trimmed.split(/[-/ ]/)
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const monStr = parts[1].toLowerCase().slice(0, 3)
    let year = parseInt(parts[2], 10)
    if (year < 100) year += 2000
    const mon = MONTH_MAP[monStr]
    if (mon !== undefined && !isNaN(day) && !isNaN(year)) {
      return new Date(year, mon, day, 0, 0, 0, 0)
    }
  }

  const d = new Date(trimmed)
  return isNaN(d.getTime()) ? null : d
}

function formatToTallyDate(date: Date): string {
  const d = date.getDate()
  const m = MONTH_NAMES[date.getMonth()]
  const y = String(date.getFullYear()).slice(-2)
  return `${d}-${m}-${y}`
}

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

  // 2. Retrieve Tally Receivables and Payables Snapshots
  let debtorData: any = null
  let creditorData: any = null

  try {
    const [recSetting, paySetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } })
    ])
    if (recSetting?.value) debtorData = JSON.parse(recSetting.value)
    if (paySetting?.value) creditorData = JSON.parse(paySetting.value)
  } catch (err: any) {
    console.error('Error reading Tally settings in party-ledger:', err)
  }

  const normTarget = partyParam.toLowerCase()

  // 3. Exact Tally Party Lookup
  let tallyParty: any = null
  let role: 'debtor' | 'creditor' = 'debtor'

  if (Array.isArray(debtorData?.parties)) {
    tallyParty = debtorData.parties.find((p: any) => p.party && p.party.trim().toLowerCase() === normTarget)
  }

  if (!tallyParty && Array.isArray(creditorData?.parties)) {
    tallyParty = creditorData.parties.find((p: any) => p.party && p.party.trim().toLowerCase() === normTarget)
    if (tallyParty) role = 'creditor'
  }

  // Fallback: Partial match if not exact
  if (!tallyParty) {
    if (Array.isArray(debtorData?.parties)) {
      tallyParty = debtorData.parties.find((p: any) => p.party && (p.party.toLowerCase().includes(normTarget) || normTarget.includes(p.party.toLowerCase())))
    }
    if (!tallyParty && Array.isArray(creditorData?.parties)) {
      tallyParty = creditorData.parties.find((p: any) => p.party && (p.party.toLowerCase().includes(normTarget) || normTarget.includes(p.party.toLowerCase())))
      if (tallyParty) role = 'creditor'
    }
  }

  if (!tallyParty) {
    throw createError({
      statusCode: 404,
      statusMessage: `Party "${partyParam}" was not found in Tally records.`
    })
  }

  // 4. Enrich address / contact info from Customer DB if matched
  let dbCustomer: any = null
  try {
    // Try matching customer by company name or alias
    dbCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { company: { contains: partyParam.split(',')[0].trim() } },
          { name: { contains: partyParam.split(',')[0].trim() } },
          { alias: { contains: partyParam.split(',')[0].trim() } }
        ]
      },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
        }
      }
    })
  } catch (_) {}

  // 5. Official Company Header (Sri Lakshmi Plywoods / Silicon Marketing)
  const companyInfo = {
    name: 'SRI LAKSHMI PLYWOODS',
    tradeName: 'Trade Name : Silicon Marketing',
    address: '34F/F2, AKKAMAHDEVI ROAD,\n2ND STAGE INDUSTRIAL SUBURB,\nVISVESHWARAYA NAGAR, MYSORE SOUTH,\nMYSORE',
    phone: '+91 99000 00000 / +91 87928 84331',
    email: 'accounts@siliconmarketing.in',
    gstin: '29ABCDE1234F1Z5'
  }

  // 6. Party Header Info
  const defaultAddress = dbCustomer?.addresses?.[0]
  const fullAddressLines = [
    defaultAddress?.addressLine || dbCustomer?.address,
    [
      defaultAddress?.city || dbCustomer?.city,
      (defaultAddress?.state || dbCustomer?.state)
        ? `${defaultAddress?.state || dbCustomer?.state} - ${defaultAddress?.pincode || dbCustomer?.pincode || ''}`
        : (defaultAddress?.pincode || dbCustomer?.pincode)
    ].filter(Boolean).join(', ')
  ].filter(Boolean)

  const partyInfo = {
    name: tallyParty.party,
    parentGroup: tallyParty.parent || (role === 'debtor' ? 'Sundry Debtors' : 'Sundry Creditors'),
    role,
    addressLines: fullAddressLines.length > 0 ? fullAddressLines : ['Mysuru, Karnataka'],
    phone: dbCustomer?.phone ? `+91 ${dbCustomer.phone}` : (tallyParty.phone || ''),
    gstin: dbCustomer?.gstNumber || ''
  }

  // 7. Date Period Filtering & Range Computation
  const rawFrom = query.from as string
  const rawTo = query.to as string

  const fromDateObj = parseDateInput(rawFrom) || new Date(2026, 3, 1) // Default: 1-Apr-2026
  const toDateObj = parseDateInput(rawTo) || new Date(2026, 10, 30) // Default: 30-Nov-2026
  // Set to end of day for inclusive comparison
  toDateObj.setHours(23, 59, 59, 999)

  const formattedFrom = formatToTallyDate(fromDateObj)
  const formattedTo = formatToTallyDate(toDateObj)

  const rawTransactions: any[] = Array.isArray(tallyParty.transactions) ? tallyParty.transactions : []

  let openingAdjustment = 0
  const inRangeTx: LedgerTransaction[] = []

  for (const tx of rawTransactions) {
    const txDate = parseDateInput(tx.date)
    const debitVal = tx.debit !== null && tx.debit !== undefined ? Number(tx.debit) : null
    const creditVal = tx.credit !== null && tx.credit !== undefined ? Number(tx.credit) : null

    if (txDate) {
      if (txDate.getTime() < fromDateObj.getTime()) {
        // Prior to fromDate -> folds into Opening Balance
        openingAdjustment += (debitVal || 0) - (creditVal || 0)
      } else if (txDate.getTime() <= toDateObj.getTime()) {
        inRangeTx.push({
          date: tx.date || formatToTallyDate(txDate),
          particulars: tx.particulars || '',
          vchType: tx.vchType || '',
          vchNo: tx.vchNo || '',
          debit: debitVal,
          credit: creditVal
        })
      }
    } else {
      // If no valid date, include in range
      inRangeTx.push({
        date: tx.date || formattedFrom,
        particulars: tx.particulars || '',
        vchType: tx.vchType || '',
        vchNo: tx.vchNo || '',
        debit: debitVal,
        credit: creditVal
      })
    }
  }

  // Effective Opening Balance as of fromDate
  const baseOpeningBalance = Number(tallyParty.openingBalance) || 0
  const effectiveOpening = baseOpeningBalance + openingAdjustment

  const transactions: LedgerTransaction[] = []
  let totalDebit = 0
  let totalCredit = 0

  // Line 0: Opening Balance
  if (effectiveOpening > 0) {
    transactions.push({
      date: formattedFrom,
      particulars: 'To Opening Balance',
      vchType: '',
      vchNo: '',
      debit: effectiveOpening,
      credit: null
    })
    totalDebit += effectiveOpening
  } else if (effectiveOpening < 0) {
    const absOpening = Math.abs(effectiveOpening)
    transactions.push({
      date: formattedFrom,
      particulars: 'By Opening Balance',
      vchType: '',
      vchNo: '',
      debit: null,
      credit: absOpening
    })
    totalCredit += absOpening
  } else {
    // Zero Opening Balance line (Standard Tally presentation)
    transactions.push({
      date: formattedFrom,
      particulars: 'To Opening Balance',
      vchType: '',
      vchNo: '',
      debit: 0,
      credit: null
    })
  }

  // Append in-range transactions
  for (const t of inRangeTx) {
    transactions.push(t)
    if (t.debit) totalDebit += t.debit
    if (t.credit) totalCredit += t.credit
  }

  // Net Closing Balance Calculation
  const closingBalance = Math.abs(totalDebit - totalCredit)
  const closingBalanceType = totalDebit >= totalCredit ? 'Dr' : 'Cr'
  const balancedTotal = Math.max(totalDebit, totalCredit)

  return {
    company: companyInfo,
    party: partyInfo,
    period: {
      from: formattedFrom,
      to: formattedTo,
      display: `${formattedFrom} to ${formattedTo}`,
      fromIso: fromDateObj.toISOString().slice(0, 10),
      toIso: toDateObj.toISOString().slice(0, 10)
    },
    transactions,
    totals: {
      openingBalance: effectiveOpening,
      totalDebit,
      totalCredit,
      closingBalance,
      closingBalanceType,
      balancedTotal
    }
  }
})
