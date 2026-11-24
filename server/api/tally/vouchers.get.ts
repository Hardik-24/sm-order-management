import { defineEventHandler, getQuery } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import fs from 'fs'
import path from 'path'

export interface FormattedTallyEntry {
  ledgerName: string
  amount: number
  isDeemedPositive: boolean
  type: 'DEBTOR' | 'SALES' | 'TAX' | 'ROUNDOFF'
}

export interface PreparedVoucherItem {
  id: string
  voucherNo: string
  voucherDate: string
  displayDate: string
  series: string
  customerName: string
  totalAmount: number
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  roundOffAmount: number
  itemCount: number
  items: any[]
  isPosted: boolean
  postedAt?: string
  isMapped: boolean
  mappedTallyParty?: string
  suggestedTallyParty?: string
  defaultTallyEntries: FormattedTallyEntry[]
}

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')
  const query = getQuery(event)
  const search = ((query.search as string) || '').trim().toLowerCase()
  const series = ((query.series as string) || '').trim()
  const status = ((query.status as string) || 'all').trim().toLowerCase() // all | unposted | posted
  const limit = parseInt((query.limit as string) || '150', 10)

  // 1. Fetch party mappings & posted vouchers settings
  const [mapSetting, postedSetting, receivablesSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' } }),
    prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' } }),
    prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
  ])

  const partyMappings: Record<string, string> = mapSetting?.value ? JSON.parse(mapSetting.value) : {}
  const postedVouchers: Record<string, { postedAt: string; tallyVchNo?: string }> = postedSetting?.value ? JSON.parse(postedSetting.value) : {}

  // List of all known Tally Debtors for fuzzy suggestion
  const allTallyDebtors: string[] = []
  if (receivablesSetting?.value) {
    try {
      const rec = JSON.parse(receivablesSetting.value)
      if (Array.isArray(rec.parties)) {
        for (const p of rec.parties) {
          if (p.party) allTallyDebtors.push(p.party.trim())
        }
      }
    } catch {}
  }

  // Helper for fuzzy match
  function findBestMatch(busyName: string): string | undefined {
    const clean = busyName.toLowerCase().replace(/[^a-z0-9]/g, '')
    // Exact match (case insensitive)
    const exact = allTallyDebtors.find(t => t.toLowerCase() === busyName.toLowerCase())
    if (exact) return exact

    // Substring or token match
    const tokens = busyName.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    let bestCandidate: string | undefined
    let maxMatches = 0

    for (const td of allTallyDebtors) {
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

  // 2. Fetch Busy Vouchers from Database
  let rawVouchers: any[] = []
  try {
    rawVouchers = await prisma.busyVoucher.findMany({
      orderBy: { voucherDate: 'desc' },
      take: 500,
    })
  } catch (_) {}

  // Fallback to busy_sync_payload.json if DB has 0 vouchers
  if (!rawVouchers || rawVouchers.length === 0) {
    try {
      const payloadPath = path.resolve(process.cwd(), 'busy_sync_payload.json')
      if (fs.existsSync(payloadPath)) {
        let text = fs.readFileSync(payloadPath, 'utf8')
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed.vouchers)) {
          rawVouchers = parsed.vouchers.slice(0, 500)
        }
      }
    } catch (_) {}
  }

  // 3. Transform and annotate each voucher
  const result: PreparedVoucherItem[] = []

  for (const v of rawVouchers) {
    const vchNo = (v.voucherNo || '').trim()
    const customer = (v.customerName || '').trim()
    const vDateStr = v.voucherDate ? new Date(v.voucherDate).toISOString() : new Date().toISOString()
    const d = new Date(vDateStr)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const tallyDate = `${yyyy}${mm}${dd}`
    const displayDate = `${dd}-${mm}-${yyyy}`

    const isPosted = Boolean(postedVouchers[vchNo])
    const postedInfo = postedVouchers[vchNo]

    // Series filtering
    const vSeries = (v.series || (v.voucherType === 2 ? 'RETAIL' : 'SMG')).toUpperCase()
    if (series && vSeries !== series.toUpperCase()) continue

    // Search filtering
    if (search) {
      const matchesSearch = vchNo.toLowerCase().includes(search) || customer.toLowerCase().includes(search)
      if (!matchesSearch) continue
    }

    // Status filtering
    if (status === 'unposted' && isPosted) continue
    if (status === 'posted' && !isPosted) continue

    const mappedTallyParty = partyMappings[customer]
    const suggestedTallyParty = mappedTallyParty || findBestMatch(customer) || customer

    const totalAmt = Number(v.totalAmount) || 0
    const taxableAmt = Number(v.taxableAmount) || 0
    const cgstAmt = Number(v.cgstAmount) || 0
    const sgstAmt = Number(v.sgstAmount) || 0
    const igstAmt = Number(v.igstAmount) || 0

    // Compute rounding off
    const computedSum = taxableAmt + cgstAmt + sgstAmt + igstAmt
    const roundOff = Math.round((totalAmt - computedSum) * 100) / 100

    // Construct default Tally entries
    const defaultEntries: FormattedTallyEntry[] = []

    // 1. Debtor (Party) Debit
    defaultEntries.push({
      ledgerName: mappedTallyParty || suggestedTallyParty,
      amount: -Math.abs(totalAmt),
      isDeemedPositive: true,
      type: 'DEBTOR'
    })

    // 2. Sales Accounts & Taxes (Detect tax rate slabs)
    const items = typeof v.items === 'string' ? JSON.parse(v.items) : (Array.isArray(v.items) ? v.items : [])

    // Group items by tax rate if available
    const rateGroups = new Map<number, { taxable: number; tax: number; cgst: number; sgst: number; igst: number }>()

    if (items.length > 0) {
      for (const item of items) {
        const rate = Number(item.taxRate) || (igstAmt > 0 ? 18 : (cgstAmt > 0 ? 18 : 18))
        const existing = rateGroups.get(rate) || { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 }
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
      // Fallback if no item-level breakdown
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

    // 3. Rounding Off if non-zero
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
      voucherDate: tallyDate,
      displayDate,
      series: vSeries,
      customerName: customer,
      totalAmount: totalAmt,
      taxableAmount: taxableAmt,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      igstAmount: igstAmt,
      roundOffAmount: roundOff,
      itemCount: items.length || v.itemCount || 1,
      items,
      isPosted,
      postedAt: postedInfo?.postedAt,
      isMapped: Boolean(mappedTallyParty),
      mappedTallyParty,
      suggestedTallyParty,
      defaultTallyEntries: defaultEntries
    })

    if (result.length >= limit) break
  }

  return {
    total: result.length,
    vouchers: result
  }
})
