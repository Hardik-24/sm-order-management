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
  balance?: number
}

function normalizeName(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default defineEventHandler(async (event) => {
  // 1. RBAC Check: Ensure user has canDownloadPartyLedger or is ADMIN
  await requireActionPermission(event, 'canDownloadPartyLedger')

  const customerId = event.context.params?.id
  if (!customerId) {
    throw createError({ statusCode: 400, message: 'Missing customer ID' })
  }

  // 2. Fetch Customer from DB
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
      },
      orders: {
        where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
        select: {
          id: true,
          orderNumber: true,
          finalAmount: true,
          paidAmount: true,
          paymentStatus: true,
          createdAt: true,
          invoiceNumber: true,
          invoiceDate: true,
          invoiceStatus: true
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!customer) {
    throw createError({ statusCode: 404, message: 'Customer not found' })
  }

  // 3. Retrieve Tally Receivables and Payables Snapshots
  const [recSetting, paySetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
    prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } })
  ])

  let debtorData: any = null
  let creditorData: any = null
  try {
    if (recSetting?.value) debtorData = JSON.parse(recSetting.value)
  } catch (_) {}
  try {
    if (paySetting?.value) creditorData = JSON.parse(paySetting.value)
  } catch (_) {}

  const custName = customer.company || customer.name
  const custAlias = customer.alias || ''
  const normCustName = normalizeName(custName)
  const normAlias = normalizeName(custAlias)

  // 4. Find matching Tally Party
  const findParty = (parties: any[]) => {
    if (!Array.isArray(parties)) return null
    // Exact or alias match
    let match = parties.find(p => {
      const pName = p.party || ''
      const normPName = normalizeName(pName)
      if (normPName === normCustName) return true
      if (normAlias && normPName === normAlias) return true
      if (customer.tallyLedgerName && pName.toLowerCase() === customer.tallyLedgerName.toLowerCase()) return true
      return false
    })

    // Fuzzy contains match
    if (!match) {
      match = parties.find(p => {
        const normPName = normalizeName(p.party || '')
        return normPName.includes(normCustName) || normCustName.includes(normPName)
      })
    }
    return match
  }

  let tallyParty = debtorData?.parties ? findParty(debtorData.parties) : null
  let isCreditorLedger = false

  // Cross-group fallback: If not in Debtors, check Creditors
  if (!tallyParty && creditorData?.parties) {
    tallyParty = findParty(creditorData.parties)
    if (tallyParty) isCreditorLedger = true
  }

  // 5. Company Info Header (Standard Tally Heading matching official quotation slip)
  const companyInfo = {
    name: 'SRI LAKSHMI PLYWOODS',
    tradeName: 'Trade Name : Silicon Marketing',
    address: '34F/F2, AKKAMAHDEVI ROAD,\n2ND STAGE INDUSTRIAL SUBURB,\nVISVESHWARAYA NAGAR, MYSORE SOUTH,\nMYSORE',
    phone: '+91 99000 00000 / +91 87928 84331',
    email: 'accounts@siliconmarketing.in',
    gstin: '29ABCDE1234F1Z5'
  }

  // 6. Party Header Info
  const defaultAddress = customer.addresses?.[0]
  const fullAddressLines = [
    defaultAddress?.addressLine,
    defaultAddress?.area,
    [defaultAddress?.city, defaultAddress?.state ? `${defaultAddress.state} - ${defaultAddress.pincode || ''}` : defaultAddress?.pincode].filter(Boolean).join(', ')
  ].filter(Boolean)

  const partyInfo = {
    name: tallyParty?.party || customer.company || customer.name,
    customerCode: customer.customerCode,
    alias: customer.alias || '',
    addressLines: fullAddressLines.length > 0 ? fullAddressLines : ['Mysuru, Karnataka'],
    phone: customer.phone ? `+91 ${customer.phone}` : (tallyParty?.phone || ''),
    gstin: customer.gstin || '',
    isDualRole: isCreditorLedger
  }

  // 7. Assemble Ledger Transactions
  const query = getQuery(event)
  const periodFrom = (query.from as string) || '1-Apr-26'
  const periodTo = (query.to as string) || '31-Oct-26'

  const transactions: LedgerTransaction[] = []

  let openingBalance = 0
  let totalDebit = 0
  let totalCredit = 0

  if (tallyParty) {
    openingBalance = Number(tallyParty.openingBalance) || 0
  }

  // Row 0: Opening Balance
  if (openingBalance > 0) {
    transactions.push({
      date: periodFrom,
      particulars: 'To Opening Balance',
      vchType: '',
      vchNo: '',
      debit: openingBalance,
      credit: null
    })
    totalDebit += openingBalance
  } else if (openingBalance < 0) {
    const absOp = Math.abs(openingBalance)
    transactions.push({
      date: periodFrom,
      particulars: 'By Opening Balance',
      vchType: '',
      vchNo: '',
      debit: null,
      credit: absOp
    })
    totalCredit += absOp
  }

  // If detailed transactions exist on party (from synced voucher entries)
  if (tallyParty?.transactions && Array.isArray(tallyParty.transactions) && tallyParty.transactions.length > 0) {
    for (const tx of tallyParty.transactions) {
      const dr = tx.debit ? Number(tx.debit) : null
      const cr = tx.credit ? Number(tx.credit) : null
      if (dr) totalDebit += dr
      if (cr) totalCredit += cr
      transactions.push({
        date: tx.date || '',
        particulars: tx.particulars || '',
        vchType: tx.vchType || '',
        vchNo: tx.vchNo || '',
        debit: dr,
        credit: cr
      })
    }
  } else {
    // Synthesize line items from known bills and payments
    if (tallyParty?.bills && Array.isArray(tallyParty.bills) && tallyParty.bills.length > 0) {
      // Sort bills chronologically
      const sortedBills = [...tallyParty.bills].reverse()
      for (const bill of sortedBills) {
        const amt = Number(bill.amount) || 0
        totalDebit += amt
        transactions.push({
          date: bill.date || periodFrom,
          particulars: 'To Sales GST@18%',
          vchType: 'Sales',
          vchNo: bill.ref || '',
          debit: amt,
          credit: null
        })
      }
    }

    // Include payments / receipts
    const totalPaid = Number(tallyParty?.totalPaid) || 0
    if (totalPaid > 0) {
      totalCredit += totalPaid
      transactions.push({
        date: periodTo,
        particulars: 'By Bank HDFC : CA 50200004935601',
        vchType: 'Receipt',
        vchNo: 'REC-SYN',
        debit: null,
        credit: totalPaid
      })
    }
  }

  // Calculate closing balance
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100
  let closingBalance = 0
  let closingBalanceType: 'Dr' | 'Cr' = 'Dr'

  if (diff > 0) {
    // Debit side is heavier; closing balance placed on Credit side
    closingBalance = diff
    closingBalanceType = 'Dr'
  } else if (diff < 0) {
    // Credit side is heavier; closing balance placed on Debit side
    closingBalance = Math.abs(diff)
    closingBalanceType = 'Cr'
  }

  const balancedTotal = Math.max(totalDebit, totalCredit)

  return {
    success: true,
    company: companyInfo,
    party: partyInfo,
    period: {
      from: periodFrom,
      to: periodTo,
      display: `${periodFrom} to ${periodTo}`
    },
    openingBalance,
    transactions,
    totals: {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      closingBalance,
      closingBalanceType,
      balancedTotal: Math.round(balancedTotal * 100) / 100
    }
  }
})
