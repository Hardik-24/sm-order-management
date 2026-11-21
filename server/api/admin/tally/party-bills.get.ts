import { defineEventHandler, getQuery, createError } from 'h3'
import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

function cleanPartyName(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/,(mys|bng|bglr|blr|hbl|mng|del|mum|chn|andhra pradesh|karnataka).*$/i, '')
    .replace(/\s*\((new|old)\)\s*/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP_WORDS = new Set([
  'plywood', 'plywoods', 'ply', 'hardware', 'hardwares', 'timber', 'timbers',
  'interiors', 'interior', 'associates', 'associate', 'enterprises', 'enterprise',
  'traders', 'trader', 'trading', 'industries', 'industry', 'pvt', 'ltd', 'private',
  'limited', 'and', 'co', 'the', 'glass', 'studio', 'creations', 'corporation',
  'marketing', 'solutions', 'doors', 'steels', 'steel'
])

function stem(w: string): string {
  return w.replace(/(s|es)$/g, '')
}

function getDistinctiveWords(s: string): string[] {
  const clean = cleanPartyName(s)
  return clean.split(' ').map(stem).filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function isCustomerMatch(tallyParty: string, busyCustomer: string): boolean {
  const tClean = cleanPartyName(tallyParty)
  const bClean = cleanPartyName(busyCustomer)
  if (tClean === bClean) return true

  const tWords = getDistinctiveWords(tClean)
  const bWords = getDistinctiveWords(bClean)

  if (tWords.length === 0 || bWords.length === 0) {
    return tClean.replace(/\s+/g, '') === bClean.replace(/\s+/g, '')
  }

  let common = 0
  const bSet = new Set(bWords)
  for (const w of tWords) {
    if (bSet.has(w)) {
      common++
    } else {
      for (const bw of bWords) {
        if (w.length >= 4 && bw.length >= 4 && (w.startsWith(bw) || bw.startsWith(w))) {
          common++
          break
        }
      }
    }
  }

  return common >= 1 && (common / Math.max(tWords.length, bWords.length)) >= 0.5
}

function parseTallyDate(dStr: string): Date | null {
  if (!dStr) return null
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  }
  const parts = dStr.trim().split('-')
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const mon = months[parts[1].toLowerCase()]
    let yr = parseInt(parts[2], 10)
    if (yr < 100) yr += 2000
    if (!isNaN(day) && mon !== undefined && !isNaN(yr)) {
      return new Date(yr, mon, day)
    }
  }
  return null
}

export default defineEventHandler(async (event) => {
  // Strictly Admin-Only
  requireRole(event, ['ADMIN'])

  const query = getQuery(event)
  const partyName = query.party as string
  const requestedType = (query.type as string)?.toLowerCase()

  if (!partyName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Party name query parameter is required.'
    })
  }

  try {
    const isCreditorQuery = requestedType === 'creditors' || requestedType === 'payables' || requestedType === 'purchases'
    const settingKey = isCreditorQuery ? 'tally_payables_data' : 'tally_receivables_data'

    let record = await prisma.systemSetting.findUnique({
      where: { key: settingKey }
    })

    let isCreditor = isCreditorQuery
    let tallyData = record?.value ? (typeof record.value === 'string' ? JSON.parse(record.value) : record.value) : null
    let party = (tallyData?.parties || []).find(
      (p: any) => p.party.toLowerCase() === partyName.toLowerCase()
    )

    // Fallback: If not found in primary setting, check the other setting
    if (!party) {
      const fallbackKey = isCreditorQuery ? 'tally_receivables_data' : 'tally_payables_data'
      const fallbackRecord = await prisma.systemSetting.findUnique({
        where: { key: fallbackKey }
      })
      if (fallbackRecord?.value) {
        const fallbackData = typeof fallbackRecord.value === 'string' ? JSON.parse(fallbackRecord.value) : fallbackRecord.value
        const found = (fallbackData?.parties || []).find(
          (p: any) => p.party.toLowerCase() === partyName.toLowerCase()
        )
        if (found) {
          party = found
          tallyData = fallbackData
          isCreditor = !isCreditorQuery
        }
      }
    }

    if (!party) {
      throw createError({
        statusCode: 404,
        statusMessage: `Party "${partyName}" not found in Tally records.`
      })
    }

    const pClean = cleanPartyName(party.party)

    // Fetch vouchers based on entity type (BusyPurchase for creditors, BusyVoucher for debtors)
    let partyVouchers: any[] = []
    if (isCreditor) {
      const allPurchases = await prisma.busyPurchase.findMany({
        select: {
          voucherNo: true,
          voucherDate: true,
          supplierName: true,
          totalAmount: true,
          itemCount: true
        },
        orderBy: { voucherDate: 'desc' }
      })
      partyVouchers = allPurchases
        .filter(v => isCustomerMatch(party.party, v.supplierName))
        .map(v => ({ ...v, customerName: v.supplierName }))
    } else {
      const allSales = await prisma.busyVoucher.findMany({
        select: {
          voucherNo: true,
          voucherDate: true,
          customerName: true,
          totalAmount: true,
          itemCount: true
        },
        orderBy: { voucherDate: 'desc' }
      })
      partyVouchers = allSales.filter(v => isCustomerMatch(party.party, v.customerName))
    }

    // Index pending bills by normalized reference number
    const pendingMap = new Map<string, any>()
    for (const b of (party.bills || [])) {
      const normRef = (b.ref || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      pendingMap.set(normRef, b)
    }

    const pendingBills: any[] = []
    const clearedBills: any[] = []
    const matchedPendingRefs = new Set<string>()

    for (const v of partyVouchers) {
      const normVNo = (v.voucherNo || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const pendingMatch = pendingMap.get(normVNo)

      const originalAmt = Math.round(Number(v.totalAmount))
      const dStr = v.voucherDate instanceof Date ? v.voucherDate.toISOString().slice(0, 10) : String(v.voucherDate)

      let isSameVoucher = false
      if (pendingMatch) {
        const tDate = parseTallyDate(pendingMatch.date)
        const vDate = new Date(v.voucherDate)
        if (tDate) {
          const daysDiff = Math.abs((vDate.getTime() - tDate.getTime()) / (1000 * 3600 * 24))
          // Vouchers must be within 45 days to be considered the same invoice (prevents cross-year number collisions)
          if (daysDiff <= 45) {
            isSameVoucher = true
          }
        } else {
          isSameVoucher = Math.round(Number(pendingMatch.amount)) <= originalAmt
        }
      }

      if (isSameVoucher && pendingMatch) {
        matchedPendingRefs.add(normVNo)
        const pendingAmt = Math.round(Number(pendingMatch.amount))
        const paidAmt = Math.max(0, originalAmt - pendingAmt)
        const isPartial = paidAmt > 5 && pendingAmt < (originalAmt - 5)

        pendingBills.push({
          ref: v.voucherNo,
          date: pendingMatch.date || dStr,
          dueDate: pendingMatch.dueDate || dStr,
          amount: pendingAmt,
          originalAmount: originalAmt,
          paidAmount: paidAmt,
          overdueDays: pendingMatch.overdueDays || 0,
          status: isPartial ? 'PARTIAL' : 'PENDING',
          itemCount: v.itemCount || 0
        })
      } else {
        clearedBills.push({
          ref: v.voucherNo,
          date: dStr,
          dueDate: dStr,
          amount: originalAmt,
          paidAmount: originalAmt,
          status: 'CLEARED',
          overdueDays: 0,
          itemCount: v.itemCount || 0
        })
      }
    }

    // Include any pending bills from Tally not matched in busy_vouchers (e.g. historical opening balance bills)
    for (const [normRef, b] of pendingMap.entries()) {
      if (!matchedPendingRefs.has(normRef)) {
        pendingBills.push({
          ref: b.ref,
          date: b.date,
          dueDate: b.dueDate,
          amount: Math.round(Number(b.amount)),
          originalAmount: Math.round(Number(b.amount)),
          paidAmount: 0,
          overdueDays: b.overdueDays || 0,
          status: 'PENDING',
          itemCount: 0
        })
      }
    }

    // Sort pending bills by overdue days descending (most overdue first)
    pendingBills.sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))

    const fullyPendingBills = pendingBills.filter(b => b.status === 'PENDING')
    const partialBills = pendingBills.filter(b => b.status === 'PARTIAL')

    // Sort cleared bills by date descending (newest first)
    clearedBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Combined All Bills list
    const allBills = [
      ...pendingBills.map(b => ({ ...b, isPending: true })),
      ...clearedBills.map(b => ({ ...b, isPending: false }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Calculate Days Sales Outstanding (average payment completion days) & overdue metrics
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const fyStart = new Date(fyStartYear, 3, 1)
    const daysElapsed = Math.max(1, Math.round((now.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24)))
    const avgPaymentDays = party.totalBilled > 0 ? Math.round((party.netPending / party.totalBilled) * daysElapsed) : 0
    const avgOverdueDays = pendingBills.length > 0
      ? Math.round(pendingBills.reduce((acc, b) => acc + (b.overdueDays || 0), 0) / pendingBills.length)
      : 0

    return {
      success: true,
      data: {
        party: party.party,
        parent: party.parent,
        summary: {
          totalBilled: party.totalBilled,
          totalPaid: party.totalPaid,
          netPending: party.netPending,
          openingBalance: party.openingBalance,
          collectionRate: party.collectionRate,
          avgPaymentDays,
          avgOverdueDays,
          pendingCount: fullyPendingBills.length,
          partialCount: partialBills.length,
          clearedCount: clearedBills.length,
          totalCount: allBills.length
        },
        pendingBills: fullyPendingBills,
        partialBills,
        clearedBills,
        allBills
      }
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch party bills breakdown'
    })
  }
})
