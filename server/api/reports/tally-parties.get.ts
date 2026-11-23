import { defineEventHandler, createError } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export interface TallyPartyItem {
  party: string
  parent: string
  role: 'debtor' | 'creditor' | 'dual'
  netPending: number
  totalBilled: number
  totalPaid: number
  advance: number
  billsCount: number
  transactionsCount: number
  openingBalance: number
}

export default defineEventHandler(async (event) => {
  // 1. RBAC: Sensitive financial reports gate
  await requireActionPermission(event, 'canDownloadPartyLedger')

  try {
    const [recSetting, paySetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } })
    ])

    const debtorData = recSetting?.value ? JSON.parse(recSetting.value) : null
    const creditorData = paySetting?.value ? JSON.parse(paySetting.value) : null

    const partyMap = new Map<string, TallyPartyItem>()

    // Ingest Debtors
    if (Array.isArray(debtorData?.parties)) {
      for (const p of debtorData.parties) {
        if (!p.party) continue
        const partyKey = p.party.trim()
        partyMap.set(partyKey, {
          party: partyKey,
          parent: p.parent || 'Sundry Debtors',
          role: 'debtor',
          netPending: Number(p.netPending) || 0,
          totalBilled: Number(p.totalBilled) || 0,
          totalPaid: Number(p.totalPaid) || 0,
          advance: Number(p.advance) || 0,
          billsCount: Number(p.billsCount) || (Array.isArray(p.bills) ? p.bills.length : 0),
          transactionsCount: Array.isArray(p.transactions) ? p.transactions.length : 0,
          openingBalance: Number(p.openingBalance) || 0
        })
      }
    }

    // Ingest Creditors (merge if already present as debtor -> dual)
    if (Array.isArray(creditorData?.parties)) {
      for (const p of creditorData.parties) {
        if (!p.party) continue
        const partyKey = p.party.trim()
        const existing = partyMap.get(partyKey)

        if (existing) {
          existing.role = 'dual'
          // If debtor transactions were 0 or missing, update transactions count
          if (!existing.transactionsCount && Array.isArray(p.transactions)) {
            existing.transactionsCount = p.transactions.length
          }
        } else {
          partyMap.set(partyKey, {
            party: partyKey,
            parent: p.parent || 'Sundry Creditors',
            role: 'creditor',
            netPending: Number(p.netPending) || 0,
            totalBilled: Number(p.totalBilled) || 0,
            totalPaid: Number(p.totalPaid) || 0,
            advance: Number(p.advance) || 0,
            billsCount: Number(p.billsCount) || (Array.isArray(p.bills) ? p.bills.length : 0),
            transactionsCount: Array.isArray(p.transactions) ? p.transactions.length : 0,
            openingBalance: Number(p.openingBalance) || 0
          })
        }
      }
    }

    const parties = Array.from(partyMap.values())

    // Sort: Debtors with pending balances first, then alphabetically
    parties.sort((a, b) => {
      if (Math.abs(b.netPending) !== Math.abs(a.netPending)) {
        return Math.abs(b.netPending) - Math.abs(a.netPending)
      }
      return a.party.localeCompare(b.party)
    })

    const summary = {
      totalParties: parties.length,
      debtorsCount: parties.filter(p => p.role === 'debtor' || p.role === 'dual').length,
      creditorsCount: parties.filter(p => p.role === 'creditor').length,
      totalReceivable: Number(debtorData?.totalReceivable) || parties.filter(p => p.role === 'debtor' && p.netPending > 0).reduce((acc, p) => acc + p.netPending, 0),
      totalPayable: Number(creditorData?.totalPayable) || parties.filter(p => p.role === 'creditor' && p.netPending > 0).reduce((acc, p) => acc + p.netPending, 0),
      lastSyncedAt: debtorData?.syncedAt || debtorData?.generatedAt || null
    }

    return {
      parties,
      summary
    }
  } catch (err: any) {
    console.error('Error fetching Tally parties:', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve Tally ledger parties snapshot.'
    })
  }
})
