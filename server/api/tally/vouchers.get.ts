import { defineEventHandler, getQuery } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import fs from 'fs'
import path from 'path'

export interface FormattedTallyEntry {
  ledgerName: string
  amount: number
  isDeemedPositive: boolean
  type: 'DEBTOR' | 'CREDITOR' | 'SALES' | 'PURCHASE' | 'TAX' | 'ROUNDOFF'
}

export interface PreparedVoucherItem {
  id: string
  voucherNo: string
  voucherType: 'Sales' | 'Purchase'
  voucherDate: string // YYYYMMDD
  displayDate: string // DD-MM-YYYY
  series: string
  customerName: string // Customer for sales, Supplier for purchase
  reference?: string // Supplier invoice no for purchase, or reference
  totalAmount: number
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  roundOffAmount: number
  itemCount: number
  items: any[]
  isPosted: boolean
  isVerifiedInTally: boolean
  isJustPosted: boolean
  postStatus: 'verified' | 'just_posted' | 'unposted'
  postedAt?: string
  isMapped: boolean
  mappedTallyParty?: string
  suggestedTallyParty?: string
  defaultTallyEntries: FormattedTallyEntry[]
  narration: string
}

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')
  const query = getQuery(event)
  const search = ((query.search as string) || '').trim().toLowerCase()
  const filterType = ((query.type as string) || (query.series as string) || 'sales').trim().toLowerCase() // 'sales' | 'purchase' | 'all'
  const status = ((query.status as string) || 'all').trim().toLowerCase() // all | unposted | posted
  const limit = parseInt((query.limit as string) || '200', 10)

  // 1. Fetch party mappings, manual posted settings, and Tally sync data
  const [mapSetting, postedSetting, receivablesSetting, payablesSetting, masterLedgersSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' } }),
    prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' } }),
    prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
    prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } }),
    prisma.systemSetting.findUnique({ where: { key: 'tally_master_ledgers' } }),
  ])

  const partyMappings: Record<string, string> = mapSetting?.value ? JSON.parse(mapSetting.value) : {}
  const postedVouchers: Record<string, { postedAt: string; tallyVchNo?: string }> = postedSetting?.value ? JSON.parse(postedSetting.value) : {}

  // Parse Tally synced sales vouchers
  const tallySalesSet = new Set<string>()
  const allTallyDebtors: string[] = []
  if (receivablesSetting?.value) {
    try {
      const rec = JSON.parse(receivablesSetting.value)
      if (Array.isArray(rec.vouchers)) {
        for (const tv of rec.vouchers) {
          if (tv.voucherNo) tallySalesSet.add(tv.voucherNo.trim().toUpperCase())
          if (tv.ref) tallySalesSet.add(tv.ref.trim().toUpperCase())
        }
      }
      if (Array.isArray(rec.parties)) {
        for (const p of rec.parties) {
          if (p.party) allTallyDebtors.push(p.party.trim())
        }
      }
    } catch {}
  }

  // Parse Tally synced purchase vouchers
  const tallyPurchSet = new Set<string>()
  const allTallyCreditors: string[] = []
  if (payablesSetting?.value) {
    try {
      const pay = JSON.parse(payablesSetting.value)
      if (Array.isArray(pay.vouchers)) {
        for (const pv of pay.vouchers) {
          if (pv.voucherNo) tallyPurchSet.add(pv.voucherNo.trim().toUpperCase())
          if (pv.ref) tallyPurchSet.add(pv.ref.trim().toUpperCase())
        }
      }
      if (Array.isArray(pay.parties)) {
        for (const p of pay.parties) {
          if (p.party) allTallyCreditors.push(p.party.trim())
        }
      }
    } catch {}
  }

  // Also include all master debtors & creditors if available
  if (masterLedgersSetting?.value) {
    try {
      const master = JSON.parse(masterLedgersSetting.value)
      if (Array.isArray(master.debtors)) {
        for (const d of master.debtors) {
          const trimmed = d.trim()
          if (!allTallyDebtors.includes(trimmed)) allTallyDebtors.push(trimmed)
        }
      }
      if (Array.isArray(master.creditors)) {
        for (const c of master.creditors) {
          const trimmed = c.trim()
          if (!allTallyCreditors.includes(trimmed)) allTallyCreditors.push(trimmed)
        }
      }
    } catch {}
  }

  // Helper for fuzzy match
  function findBestMatch(busyName: string, candidates: string[]): string | undefined {
    const clean = busyName.toLowerCase().replace(/[^a-z0-9]/g, '')
    // Exact match (case insensitive)
    const exact = candidates.find(t => t.toLowerCase() === busyName.toLowerCase())
    if (exact) return exact

    // Substring or token match
    const tokens = busyName.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    let bestCandidate: string | undefined
    let maxMatches = 0

    for (const td of candidates) {
      const tdLower = td.toLowerCase()
      let count = 0
      for (const token of tokens) {
        if (tdLower.includes(token)) count++
      }
      if (count > maxMatches) {
        maxMatches = count
        bestCandidate = td
      }
    }

    return maxMatches >= 1 ? bestCandidate : undefined
  }

  const result: PreparedVoucherItem[] = []

  // 2. Fetch Sales Vouchers if requested
  const shouldFetchSales = filterType === 'sales' || filterType === 'all' || filterType === 'smg' || filterType === 'retail'
  let rawSales: any[] = []
  if (shouldFetchSales) {
    try {
      rawSales = await prisma.busyVoucher.findMany({
        orderBy: { voucherDate: 'desc' },
        take: 500,
      })
    } catch (_) {}

    // Fallback if DB has 0 sales vouchers
    if (!rawSales || rawSales.length === 0) {
      try {
        const payloadPath = path.resolve(process.cwd(), 'busy_sync_payload.json')
        if (fs.existsSync(payloadPath)) {
          let text = fs.readFileSync(payloadPath, 'utf8')
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed.vouchers)) {
            rawSales = parsed.vouchers.slice(0, 500)
          }
        }
      } catch (_) {}
    }

    for (const v of rawSales) {
      const vchNo = (v.voucherNo || '').trim()
      const normNo = vchNo.toUpperCase()
      const customer = (v.customerName || '').trim()
      const vDateStr = v.voucherDate ? new Date(v.voucherDate).toISOString() : new Date().toISOString()
      const d = new Date(vDateStr)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const tallyDate = `${yyyy}${mm}${dd}`
      const displayDate = `${dd}-${mm}-${yyyy}`

      // Two-Tier Synchronized Check: Live Tally Register vs Just Posted from OMS
      const isVerifiedInTally = tallySalesSet.has(normNo)
      const isJustPosted = Boolean(postedVouchers[vchNo])
      const isPosted = isVerifiedInTally || isJustPosted
      const postStatus: 'verified' | 'just_posted' | 'unposted' = isVerifiedInTally
        ? 'verified'
        : (isJustPosted ? 'just_posted' : 'unposted')
      const postedInfo = postedVouchers[vchNo]

      const vSeries = (v.series || (v.voucherType === 2 ? 'RETAIL' : 'SMG')).toUpperCase()

      // Search filtering
      if (search) {
        const matchesSearch = vchNo.toLowerCase().includes(search) || customer.toLowerCase().includes(search)
        if (!matchesSearch) continue
      }

      // Status filtering
      if (status === 'unposted' && isPosted) continue
      if (status === 'posted' && !isPosted) continue

      const mappedTallyParty = partyMappings[customer]
      const suggestedTallyParty = mappedTallyParty || findBestMatch(customer, allTallyDebtors) || customer

      const totalAmt = Number(v.totalAmount) || 0
      const taxableAmt = Number(v.taxableAmount) || 0
      const cgstAmt = Number(v.cgstAmount) || 0
      const sgstAmt = Number(v.sgstAmount) || 0
      const igstAmt = Number(v.igstAmount) || 0

      const computedSum = taxableAmt + cgstAmt + sgstAmt + igstAmt
      const roundOff = Math.round((totalAmt - computedSum) * 100) / 100

      const items = typeof v.items === 'string' ? JSON.parse(v.items) : (Array.isArray(v.items) ? v.items : [])

      // Construct default entries for Sales
      const defaultEntries: FormattedTallyEntry[] = []

      // 1. Debtor Debit
      defaultEntries.push({
        ledgerName: mappedTallyParty || suggestedTallyParty,
        amount: -Math.abs(totalAmt),
        isDeemedPositive: true,
        type: 'DEBTOR'
      })

      // 2. Group items by tax rate or default to 18%
      const rateGroups = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>()
      if (items.length > 0) {
        for (const item of items) {
          const rate = Number(item.taxRate) || (igstAmt > 0 ? 18 : (cgstAmt > 0 ? 18 : 18))
          const existing = rateGroups.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
          existing.taxable += Number(item.taxableAmount || item.amount || 0)
          existing.cgst += Number(item.cgstAmount || 0)
          existing.sgst += Number(item.sgstAmount || 0)
          existing.igst += Number(item.igstAmount || 0)
          rateGroups.set(rate, existing)
        }
      }

      if (rateGroups.size > 0) {
        for (const [rate, g] of rateGroups.entries()) {
          const isInterstate = igstAmt > 0 || g.igst > 0
          const salesLedger = isInterstate ? `Sales IGST@${rate}%` : `Sales GST@${rate}%`
          defaultEntries.push({
            ledgerName: salesLedger,
            amount: Math.round(g.taxable * 100) / 100,
            isDeemedPositive: false,
            type: 'SALES'
          })

          if (isInterstate) {
            defaultEntries.push({
              ledgerName: `Output IGST@${rate}%`,
              amount: Math.round((g.igst || (g.taxable * rate / 100)) * 100) / 100,
              isDeemedPositive: false,
              type: 'TAX'
            })
          } else {
            const halfRate = rate / 2
            const cgstVal = g.cgst > 0 ? g.cgst : (g.taxable * halfRate / 100)
            const sgstVal = g.sgst > 0 ? g.sgst : (g.taxable * halfRate / 100)
            defaultEntries.push({
              ledgerName: `Output CGST@${halfRate}%`,
              amount: Math.round(cgstVal * 100) / 100,
              isDeemedPositive: false,
              type: 'TAX'
            })
            defaultEntries.push({
              ledgerName: `Output SGST@${halfRate}%`,
              amount: Math.round(sgstVal * 100) / 100,
              isDeemedPositive: false,
              type: 'TAX'
            })
          }
        }
      } else {
        const isInterstate = igstAmt > 0
        const salesLedger = isInterstate ? 'Sales IGST@18%' : 'Sales GST@18%'
        defaultEntries.push({
          ledgerName: salesLedger,
          amount: Math.round(taxableAmt * 100) / 100,
          isDeemedPositive: false,
          type: 'SALES'
        })
        if (isInterstate) {
          defaultEntries.push({
            ledgerName: 'Output IGST@18%',
            amount: Math.round(igstAmt * 100) / 100,
            isDeemedPositive: false,
            type: 'TAX'
          })
        } else {
          defaultEntries.push({
            ledgerName: 'Output CGST@9%',
            amount: Math.round(cgstAmt * 100) / 100,
            isDeemedPositive: false,
            type: 'TAX'
          })
          defaultEntries.push({
            ledgerName: 'Output SGST@9%',
            amount: Math.round(sgstAmt * 100) / 100,
            isDeemedPositive: false,
            type: 'TAX'
          })
        }
      }

      // Round Off
      if (Math.abs(roundOff) > 0.001) {
        defaultEntries.push({
          ledgerName: 'Sales Rounding Off',
          amount: Math.round(roundOff * 100) / 100,
          isDeemedPositive: roundOff < 0,
          type: 'ROUNDOFF'
        })
      }

      result.push({
        id: v.id || vchNo,
        voucherNo: vchNo,
        voucherType: 'Sales',
        voucherDate: tallyDate,
        displayDate,
        series: vSeries,
        customerName: customer,
        reference: vchNo,
        totalAmount: totalAmt,
        taxableAmount: taxableAmt,
        cgstAmount: cgstAmt,
        sgstAmount: sgstAmt,
        igstAmount: igstAmt,
        roundOffAmount: roundOff,
        itemCount: items.length || v.itemCount || 1,
        items,
        isPosted,
        isVerifiedInTally,
        isJustPosted,
        postStatus,
        postedAt: postedInfo?.postedAt,
        isMapped: Boolean(mappedTallyParty),
        mappedTallyParty,
        suggestedTallyParty,
        defaultTallyEntries: defaultEntries,
        narration: `Sales to ${customer} against BUSY Inv #${vchNo}`
      })

      if (result.length >= limit) break
    }
  }

  // 3. Fetch Purchase Vouchers if requested
  const shouldFetchPurchase = filterType === 'purchase' || filterType === 'all'
  if (shouldFetchPurchase && result.length < limit) {
    let rawPurchases: any[] = []
    try {
      rawPurchases = await prisma.busyPurchase.findMany({
        orderBy: { voucherDate: 'desc' },
        take: 500,
      })
    } catch (_) {}

    // Fallback if DB has 0 purchases
    if (!rawPurchases || rawPurchases.length === 0) {
      try {
        const payloadPath = path.resolve(process.cwd(), 'busy_sync_payload.json')
        if (fs.existsSync(payloadPath)) {
          let text = fs.readFileSync(payloadPath, 'utf8')
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed.purchases)) {
            rawPurchases = parsed.purchases.slice(0, 500)
          }
        }
      } catch (_) {}
    }

    for (const p of rawPurchases) {
      const vchNo = (p.voucherNo || '').trim()
      const normNo = vchNo.toUpperCase()
      const supplier = (p.supplierName || '').trim()
      const vDateStr = p.voucherDate ? new Date(p.voucherDate).toISOString() : new Date().toISOString()
      const d = new Date(vDateStr)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const tallyDate = `${yyyy}${mm}${dd}`
      const displayDate = `${dd}-${mm}-${yyyy}`

      // Two-Tier Synchronized Check: Live Tally Register vs Just Posted from OMS
      const isVerifiedInTally = tallyPurchSet.has(normNo)
      const isJustPosted = Boolean(postedVouchers[vchNo])
      const isPosted = isVerifiedInTally || isJustPosted
      const postStatus: 'verified' | 'just_posted' | 'unposted' = isVerifiedInTally
        ? 'verified'
        : (isJustPosted ? 'just_posted' : 'unposted')
      const postedInfo = postedVouchers[vchNo]

      // Search filtering
      if (search) {
        const matchesSearch = vchNo.toLowerCase().includes(search) || supplier.toLowerCase().includes(search)
        if (!matchesSearch) continue
      }

      // Status filtering
      if (status === 'unposted' && isPosted) continue
      if (status === 'posted' && !isPosted) continue

      const mappedTallyParty = partyMappings[supplier]
      const suggestedTallyParty = mappedTallyParty || findBestMatch(supplier, allTallyCreditors) || supplier

      const totalAmt = Number(p.totalAmount) || 0
      const taxableAmt = Number(p.taxableAmount) || 0
      const cgstAmt = Number(p.cgstAmount) || 0
      const sgstAmt = Number(p.sgstAmount) || 0
      const igstAmt = Number(p.igstAmount) || 0

      const computedSum = taxableAmt + cgstAmt + sgstAmt + igstAmt
      const roundOff = Math.round((totalAmt - computedSum) * 100) / 100

      const items = typeof p.items === 'string' ? JSON.parse(p.items) : (Array.isArray(p.items) ? p.items : [])

      // Construct default entries for Purchase:
      // In Tally Purchase: Creditor is Credited (isDeemedPositive: false, positive amount)
      // Purchase Account & Input Tax are Debited (isDeemedPositive: true, negative amount)
      const defaultEntries: FormattedTallyEntry[] = []

      // 1. Creditor Credit
      defaultEntries.push({
        ledgerName: mappedTallyParty || suggestedTallyParty,
        amount: Math.abs(totalAmt),
        isDeemedPositive: false,
        type: 'CREDITOR'
      })

      // 2. Purchase Account Debit
      const isInterstate = igstAmt > 0
      const purchaseLedger = isInterstate ? 'Purchase IGST@18%' : 'Purchase GST@18%'
      defaultEntries.push({
        ledgerName: purchaseLedger,
        amount: -Math.abs(taxableAmt),
        isDeemedPositive: true,
        type: 'PURCHASE'
      })

      // 3. Input Taxes Debit
      if (isInterstate) {
        defaultEntries.push({
          ledgerName: 'Input IGST @18%',
          amount: -Math.abs(igstAmt),
          isDeemedPositive: true,
          type: 'TAX'
        })
      } else {
        defaultEntries.push({
          ledgerName: 'Input CGST@9%',
          amount: -Math.abs(cgstAmt),
          isDeemedPositive: true,
          type: 'TAX'
        })
        defaultEntries.push({
          ledgerName: 'Input SGST@9%',
          amount: -Math.abs(sgstAmt),
          isDeemedPositive: true,
          type: 'TAX'
        })
      }

      // Round Off
      if (Math.abs(roundOff) > 0.001) {
        defaultEntries.push({
          ledgerName: 'Purchase Rounding Off',
          amount: roundOff,
          isDeemedPositive: roundOff > 0,
          type: 'ROUNDOFF'
        })
      }

      result.push({
        id: p.id || vchNo,
        voucherNo: vchNo,
        voucherType: 'Purchase',
        voucherDate: tallyDate,
        displayDate,
        series: p.series || 'Main',
        customerName: supplier,
        reference: vchNo,
        totalAmount: totalAmt,
        taxableAmount: taxableAmt,
        cgstAmount: cgstAmt,
        sgstAmount: sgstAmt,
        igstAmount: igstAmt,
        roundOffAmount: roundOff,
        itemCount: items.length || p.itemCount || 1,
        items,
        isPosted,
        isVerifiedInTally,
        isJustPosted,
        postStatus,
        postedAt: postedInfo?.postedAt,
        isMapped: Boolean(mappedTallyParty),
        mappedTallyParty,
        suggestedTallyParty,
        defaultTallyEntries: defaultEntries,
        narration: `Purchase from ${supplier} against BUSY Inv #${vchNo}`
      })

      if (result.length >= limit) break
    }
  }

  return {
    total: result.length,
    vouchers: result
  }
})
