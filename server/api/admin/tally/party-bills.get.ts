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

  if (!partyName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Party name query parameter is required.'
    })
  }

  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: 'tally_receivables_data' }
    })

    if (!record || !record.value) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No Tally receivables snapshot found.'
      })
    }

    const tallyData = typeof record.value === 'string' ? JSON.parse(record.value) : record.value
    const party = (tallyData.parties || []).find(
      (p: any) => p.party.toLowerCase() === partyName.toLowerCase()
    )

    if (!party) {
      throw createError({
        statusCode: 404,
        statusMessage: `Party "${partyName}" not found in Tally debtors.`
      })
    }

    const pClean = cleanPartyName(party.party)
    const pWords = pClean.split(' ').filter(w => w.length > 2)

    // Fetch all sales vouchers from busy_vouchers
    const allVouchers = await prisma.busyVoucher.findMany({
      select: {
        voucherNo: true,
        voucherDate: true,
        customerName: true,
        totalAmount: true,
        itemCount: true
      },
      orderBy: { voucherDate: 'desc' }
    })

    // Filter vouchers belonging to this party
    const partyVouchers = allVouchers.filter(v => {
      const vClean = cleanPartyName(v.customerName)
      if (vClean === pClean || vClean.includes(pClean) || pClean.includes(vClean)) return true
      const vWords = vClean.split(' ').filter(w => w.length > 2)
      if (pWords.length > 0 && vWords.length > 0) {
        let common = 0
        const vSet = new Set(vWords)
        for (const w of pWords) {
          if (vSet.has(w)) common++
        }
        return (common / Math.max(pWords.length, vWords.length)) >= 0.5
      }
      return false
    })

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
