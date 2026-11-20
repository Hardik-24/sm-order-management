import { defineEventHandler, createError } from 'h3'
import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

function cleanPartyName(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/,(mys|bng|bglr|blr|hbl|mng|del|mum|chn|andhra pradesh|karnataka).*$/i, '')
    .replace(/\s*\((new|old|not in use)\)\s*/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP_WORDS = new Set([
  'plywood', 'plywoods', 'ply', 'hardware', 'hardwares', 'timber', 'timbers',
  'interiors', 'interior', 'associates', 'associate', 'enterprises', 'enterprise',
  'traders', 'trader', 'trading', 'industries', 'industry', 'pvt', 'ltd', 'private',
  'limited', 'and', 'co', 'the', 'glass', 'studio', 'creations', 'corporation',
  'marketing', 'solutions', 'doors', 'steels', 'steel', 'others', 'other', 'sons',
  'son', 'brothers', 'brother', 'group', 'groups', 'decor', 'decors', 'agencies', 'agency'
])

function stem(w: string): string {
  return w.replace(/(s|es)$/g, '')
}

function getDistinctiveWords(s: string): string[] {
  const clean = cleanPartyName(s)
  return clean.split(' ').map(stem).filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function computeMatchScore(tallyParty: string, busyCustomer: string): number {
  const tClean = cleanPartyName(tallyParty)
  const bClean = cleanPartyName(busyCustomer)
  if (tClean === bClean) return 100
  if (tClean.replace(/\s+/g, '') === bClean.replace(/\s+/g, '')) return 95

  const tWords = getDistinctiveWords(tClean)
  const bWords = getDistinctiveWords(bClean)

  if (tWords.length === 0 || bWords.length === 0) {
    return 0
  }

  const tJoined = tWords.join(' ')
  const bJoined = bWords.join(' ')
  if (tJoined === bJoined) return 90

  let common = 0
  const bSet = new Set(bWords)
  for (const w of tWords) {
    if (bSet.has(w)) {
      common++
    } else {
      for (const bw of bWords) {
        if (w.length >= 4 && bw.length >= 4 && (w.startsWith(bw) || bw.startsWith(w))) {
          common += 0.8
          break
        }
      }
    }
  }

  const maxLen = Math.max(tWords.length, bWords.length)
  const score = (common / maxLen) * 80
  return score >= 40 ? score : 0
}

function findBestPartyMatch(busyCustomer: string, tallyParties: any[]): any | null {
  let bestMatch: any = null
  let highestScore = 0

  for (const tp of tallyParties) {
    const score = computeMatchScore(tp.party, busyCustomer)
    if (score > highestScore) {
      highestScore = score
      bestMatch = tp
    }
  }

  return highestScore >= 40 ? bestMatch : null
}

export default defineEventHandler(async (event) => {
  // Strictly Admin-Only
  requireRole(event, ['ADMIN'])

  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: 'tally_receivables_data' }
    })

    if (!record || !record.value) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No Tally financial snapshot found in system settings.'
      })
    }

    const tally = typeof record.value === 'string' ? JSON.parse(record.value) : record.value
    const tallyParties: any[] = tally.parties || []

    // Fetch all Busy sales vouchers
    const busyVouchers = await prisma.busyVoucher.findMany({
      select: {
        voucherNo: true,
        voucherDate: true,
        customerName: true,
        totalAmount: true,
        taxableAmount: true,
        taxAmount: true,
        itemCount: true
      },
      orderBy: { voucherDate: 'asc' }
    })

    const totalBusySales = busyVouchers.reduce((acc, v) => acc + Number(v.totalAmount), 0)
    const totalTallyBilled = Number(tally.summary?.totalBilled || tally.summary?.totalOutstanding || 0)
    const netDiscrepancy = totalBusySales - totalTallyBilled

    // Group Busy vouchers by customerName
    const busyByCustomer = new Map<string, any[]>()
    for (const v of busyVouchers) {
      if (!busyByCustomer.has(v.customerName)) {
        busyByCustomer.set(v.customerName, [])
      }
      busyByCustomer.get(v.customerName)!.push(v)
    }

    // Match Busy customers to Tally debtors
    const partyMatches = new Map<string, any>()
    const unmatchedParties: any[] = []

    for (const [busyName, vouchers] of busyByCustomer.entries()) {
      const match = findBestPartyMatch(busyName, tallyParties)
      const total = vouchers.reduce((acc, v) => acc + Number(v.totalAmount), 0)
      const latestDate = vouchers[vouchers.length - 1].voucherDate

      if (match) {
        partyMatches.set(busyName, match)
      } else {
        unmatchedParties.push({
          customerName: busyName,
          totalSales: Math.round(total),
          voucherCount: vouchers.length,
          latestDate: latestDate instanceof Date ? latestDate.toISOString() : String(latestDate),
          vouchers
        })
      }
    }

    unmatchedParties.sort((a, b) => b.totalSales - a.totalSales)
    const missingPartiesSales = unmatchedParties.reduce((acc, p) => acc + p.totalSales, 0)

    // Identify Unposted Vouchers
    const unpostedVouchers: any[] = []

    // 1. All vouchers for customers that do not exist in Tally's debtors list
    for (const u of unmatchedParties) {
      for (const v of u.vouchers) {
        unpostedVouchers.push({
          voucherNo: v.voucherNo,
          voucherDate: v.voucherDate instanceof Date ? v.voucherDate.toISOString() : String(v.voucherDate),
          customerName: v.customerName,
          amount: Math.round(Number(v.totalAmount)),
          taxableAmount: Math.round(Number(v.taxableAmount)),
          taxAmount: Math.round(Number(v.taxAmount)),
          itemCount: v.itemCount || 0,
          tallyParty: null,
          reason: 'Customer Account Not in Tally Debtors',
          category: 'MISSING_CUSTOMER'
        })
      }
    }

    // 2. Identify unposted vouchers for matched customers where Busy Sales > Tally Billed
    const partyDiscrepancies: any[] = []

    for (const [busyName, tp] of partyMatches.entries()) {
      const vouchers = busyByCustomer.get(busyName)!
      const busyTotal = vouchers.reduce((acc, v) => acc + Number(v.totalAmount), 0)
      const tallyBilled = Number(tp.totalBilled || 0)
      const diff = Math.round(busyTotal - tallyBilled)

      if (Math.abs(diff) > 100) {
        const openRefs = new Set((tp.bills || []).map((b: any) => (b.ref || '').toLowerCase().replace(/[^a-z0-9]/g, '')))
        const unpostedForParty: any[] = []

        if (diff > 100) {
          // Sort newest vouchers first to isolate unposted invoices
          const sortedDesc = [...vouchers].sort((a, b) => new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime())
          let remainingDiff = diff

          for (const v of sortedDesc) {
            const normRef = (v.voucherNo || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            if (openRefs.has(normRef)) continue // Already in Tally open bills

            const amt = Math.round(Number(v.totalAmount))
            if (remainingDiff > 0) {
              unpostedForParty.push(v)
              unpostedVouchers.push({
                voucherNo: v.voucherNo,
                voucherDate: v.voucherDate instanceof Date ? v.voucherDate.toISOString() : String(v.voucherDate),
                customerName: v.customerName,
                amount: amt,
                taxableAmount: Math.round(Number(v.taxableAmount)),
                taxAmount: Math.round(Number(v.taxAmount)),
                itemCount: v.itemCount || 0,
                tallyParty: tp.party,
                reason: `Unposted Invoice (Busy sales exceed Tally ledger by ₹${diff.toLocaleString('en-IN')})`,
                category: 'UNPOSTED_INVOICE'
              })
              remainingDiff -= amt
            }
          }
        }

        partyDiscrepancies.push({
          customerName: busyName,
          tallyParty: tp.party,
          busySales: Math.round(busyTotal),
          tallyBilled: Math.round(tallyBilled),
          difference: diff,
          busyVoucherCount: vouchers.length,
          unpostedVoucherCount: unpostedForParty.length,
          status: diff > 0 ? 'BUSY_HIGHER' : 'TALLY_HIGHER'
        })
      }
    }

    partyDiscrepancies.sort((a, b) => b.difference - a.difference)
    unpostedVouchers.sort((a, b) => new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime())

    // Strip vouchers array from unmatchedParties to keep response lightweight
    const cleanUnmatchedParties = unmatchedParties.map(p => ({
      customerName: p.customerName,
      totalSales: p.totalSales,
      voucherCount: p.voucherCount,
      latestDate: p.latestDate
    }))

    const unpostedTotal = unpostedVouchers.reduce((s, v) => s + v.amount, 0)

    return {
      success: true,
      data: {
        summary: {
          totalBusySales: Math.round(totalBusySales),
          totalTallyBilled: Math.round(totalTallyBilled),
          netDiscrepancy: Math.round(netDiscrepancy),
          busyVoucherCount: busyVouchers.length,
          tallyDebtorCount: tallyParties.length,
          missingPartiesCount: cleanUnmatchedParties.length,
          missingPartiesSales: Math.round(missingPartiesSales),
          partyDiscrepanciesCount: partyDiscrepancies.length,
          unpostedVouchersCount: unpostedVouchers.length,
          unpostedVouchersTotal: Math.round(unpostedTotal),
          syncedAt: tally.syncedAt || record.updatedAt.toISOString(),
          company: tally.company || 'SRI LAKSHMI PLYWOODS 2627'
        },
        unpostedVouchers,
        partyDiscrepancies,
        unmatchedParties: cleanUnmatchedParties
      }
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to generate reconciliation report.'
    })
  }
})
