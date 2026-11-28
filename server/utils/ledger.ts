import { createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'

export interface LedgerTransaction {
  date: string
  particulars: string
  vchType: string
  vchNo: string
  debit: number | null
  credit: number | null
}

export interface LedgerReportData {
  company: {
    name: string
    tradeName: string
    address: string
    phone: string
    email: string
    gstin: string
  }
  party: {
    name: string
    parentGroup: string
    role: 'debtor' | 'creditor'
    addressLines: string[]
    phone: string
    gstin: string
  }
  period: {
    from: string
    to: string
    display: string
    fromIso: string
    toIso: string
  }
  transactions: LedgerTransaction[]
  totals: {
    openingBalance: number
    openingBalanceType?: 'Dr' | 'Cr'
    totalDebit: number
    totalCredit: number
    closingBalance: number
    closingBalanceType: 'Dr' | 'Cr'
    balancedTotal: number
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}

export function parseDateInput(str: string | undefined | null): Date | null {
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

export function formatToTallyDate(date: Date): string {
  const d = date.getDate()
  const m = MONTH_NAMES[date.getMonth()]
  const y = String(date.getFullYear()).slice(-2)
  return `${d}-${m}-${y}`
}

export async function computePartyLedger(
  partyParam: string,
  rawFrom?: string,
  rawTo?: string
): Promise<LedgerReportData> {
  if (!partyParam || !partyParam.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required "party" parameter.'
    })
  }

  const normTarget = partyParam.trim().toLowerCase()

  // 1. Retrieve Tally Snapshots
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
    console.error('Error reading Tally settings in computePartyLedger:', err)
  }

  // 2. Exact or Partial Party Match
  let tallyParty: any = null
  let role: 'debtor' | 'creditor' = 'debtor'

  if (Array.isArray(debtorData?.parties)) {
    tallyParty = debtorData.parties.find((p: any) => p.party && p.party.trim().toLowerCase() === normTarget)
  }

  if (!tallyParty && Array.isArray(creditorData?.parties)) {
    tallyParty = creditorData.parties.find((p: any) => p.party && p.party.trim().toLowerCase() === normTarget)
    if (tallyParty) role = 'creditor'
  }

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

  // 3. Address & Phone Enrichment
  let addressLines: string[] = []
  if (Array.isArray(tallyParty.addressLines) && tallyParty.addressLines.length > 0) {
    addressLines = tallyParty.addressLines.filter(Boolean)
  }

  let phone = tallyParty.phone || ''
  let gstin = tallyParty.gstin || ''

  if (addressLines.length === 0 || !phone) {
    let dbCustomer: any = null
    try {
      const partyBase = partyParam.split(',')[0].trim()
      dbCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { company: { contains: partyBase } },
            { name: { contains: partyBase } },
            { alias: { contains: partyBase } }
          ]
        },
        include: {
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
          }
        }
      })

      if (!dbCustomer) {
        const tokens = partyBase.split(/\s+/).filter(w => w.length > 3)
        for (const token of tokens) {
          dbCustomer = await prisma.customer.findFirst({
            where: {
              OR: [
                { company: { contains: token } },
                { name: { contains: token } }
              ]
            },
            include: {
              addresses: {
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
              }
            }
          })
          if (dbCustomer) break
        }
      }

      if (dbCustomer) {
        if (addressLines.length === 0) {
          const defaultAddress = dbCustomer.addresses?.[0]
          const addrLine1 = defaultAddress?.addressLine || dbCustomer.address
          const city = defaultAddress?.city || dbCustomer.city
          const state = defaultAddress?.state || dbCustomer.state
          const pincode = defaultAddress?.pincode || dbCustomer.pincode
          const statePin = [state, pincode].filter(Boolean).join(' - ')
          const addrLine2 = [city, statePin].filter(Boolean).join(', ')

          const fullLines = [addrLine1, addrLine2].filter((l): l is string => Boolean(l && String(l).trim()))
          if (fullLines.length > 0) addressLines = fullLines
        }
        if (!phone && dbCustomer.phone) {
          phone = `+91 ${dbCustomer.phone}`
        }
        if (!gstin && dbCustomer.gstNumber) {
          gstin = dbCustomer.gstNumber
        }
      }
    } catch (_) {}
  }

  const companyInfo = {
    name: 'SRI LAKSHMI PLYWOODS',
    tradeName: 'Trade Name : Silicon Marketing',
    address: '34F/F2, AKKAMAHDEVI ROAD,\n2ND STAGE INDUSTRIAL SUBURB,\nVISVESHWARAYA NAGAR, MYSORE SOUTH,\nMYSORE',
    phone: '+91 99000 00000 / +91 87928 84331',
    email: 'accounts@siliconmarketing.in',
    gstin: '29ABCDE1234F1Z5'
  }

  const partyInfo = {
    name: tallyParty.party,
    parentGroup: tallyParty.parent || (role === 'debtor' ? 'Sundry Debtors' : 'Sundry Creditors'),
    role,
    addressLines: addressLines.length > 0 ? addressLines : [],
    phone: phone || '',
    gstin: gstin || ''
  }

  // 4. Date Computations & Filtering
  const fromDateObj = parseDateInput(rawFrom) || new Date(2026, 3, 1)
  const toDateObj = parseDateInput(rawTo) || new Date(2026, 10, 30)
  toDateObj.setHours(23, 59, 59, 999)

  const formattedFrom = formatToTallyDate(fromDateObj)
  const formattedTo = formatToTallyDate(toDateObj)

  const rawTransactions: any[] = Array.isArray(tallyParty.transactions) ? tallyParty.transactions : []

  // Determine initial opening balance direction ('Dr' vs 'Cr')
  // In Tally: Dr = Debit (asset/receivable), Cr = Credit (liability/payable)
  const baseOpeningBalance = Math.abs(Number(tallyParty.openingBalance) || 0)
  const initialOpeningType: 'Dr' | 'Cr' = tallyParty.openingType
    ? tallyParty.openingType
    : (role === 'creditor' || (tallyParty.parent && /creditor/i.test(tallyParty.parent)) ? 'Cr' : 'Dr')

  // Using signed convention: Debit is positive (+), Credit is negative (-)
  let signedOpening = (initialOpeningType === 'Cr' ? -1 : 1) * baseOpeningBalance

  const inRangeTx: LedgerTransaction[] = []

  for (const tx of rawTransactions) {
    const txDate = parseDateInput(tx.date)
    const debitVal = tx.debit !== null && tx.debit !== undefined ? Number(tx.debit) : null
    const creditVal = tx.credit !== null && tx.credit !== undefined ? Number(tx.credit) : null

    if (txDate) {
      if (txDate.getTime() < fromDateObj.getTime()) {
        // Transactions prior to start date adjust the opening balance
        // Debit increases debit balance (+), Credit increases credit balance (-)
        signedOpening += (debitVal || 0) - (creditVal || 0)
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

  // Calculate effective opening balance and type after pre-period adjustments
  const effectiveOpening = Math.round(Math.abs(signedOpening) * 100) / 100
  const effectiveOpeningType: 'Dr' | 'Cr' =
    signedOpening > 0 ? 'Dr' : (signedOpening < 0 ? 'Cr' : initialOpeningType)

  const transactions: LedgerTransaction[] = []
  let totalDebit = 0
  let totalCredit = 0

  if (effectiveOpeningType === 'Cr') {
    transactions.push({
      date: formattedFrom,
      particulars: 'By Opening Balance',
      vchType: '',
      vchNo: '',
      debit: null,
      credit: effectiveOpening
    })
    totalCredit += effectiveOpening
  } else {
    transactions.push({
      date: formattedFrom,
      particulars: 'To Opening Balance',
      vchType: '',
      vchNo: '',
      debit: effectiveOpening,
      credit: null
    })
    totalDebit += effectiveOpening
  }

  for (const t of inRangeTx) {
    transactions.push(t)
    if (t.debit) totalDebit += t.debit
    if (t.credit) totalCredit += t.credit
  }

  totalDebit = Math.round(totalDebit * 100) / 100
  totalCredit = Math.round(totalCredit * 100) / 100

  const closingBalance = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100
  const closingBalanceType: 'Dr' | 'Cr' = totalDebit >= totalCredit ? 'Dr' : 'Cr'
  const balancedTotal = Math.round(Math.max(totalDebit, totalCredit) * 100) / 100

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
      openingBalanceType: effectiveOpeningType,
      totalDebit,
      totalCredit,
      closingBalance,
      closingBalanceType,
      balancedTotal
    }
  }
}
