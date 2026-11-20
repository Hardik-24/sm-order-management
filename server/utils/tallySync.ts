import http from 'http'
import { prisma } from '~~/server/utils/prisma'

export interface TallyBill {
  date: string
  ref: string
  amount: number
  dueDate: string
  overdueDays: number
}

export interface TallyDebtorParty {
  party: string
  totalReceivable: number
  billsCount: number
  maxOverdueDays: number
  minOverdueDays: number
  bills: TallyBill[]
}

export interface TallyReceivablesPayload {
  source: string
  company: string
  syncedAt: string
  summary: {
    totalOutstanding: number
    totalBills: number
    totalParties: number
    agingBuckets: {
      current: number
      thirtyToSixty: number
      sixtyToNinety: number
      ninetyToOneEighty: number
      overOneEighty: number
    }
  }
  parties: TallyDebtorParty[]
}

export function queryTally(reportId: string, host = '127.0.0.1', port = 9000): Promise<string> {
  return new Promise((resolve, reject) => {
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>${reportId}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`

    const req = http.request({
      hostname: host,
      port,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': Buffer.byteLength(xml)
      },
      timeout: 30000
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })

    req.on('error', err => reject(err))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Tally request timed out (30s)'))
    })

    req.write(xml)
    req.end()
  })
}

export function parseBillsXml(xmlText: string): TallyReceivablesPayload {
  const pattern = /<BILLFIXED>\s*<BILLDATE>(.*?)<\/BILLDATE>\s*<BILLREF>(.*?)<\/BILLREF>\s*<BILLPARTY>(.*?)<\/BILLPARTY>\s*<\/BILLFIXED>\s*<BILLCL>(.*?)<\/BILLCL>\s*<BILLDUE>(.*?)<\/BILLDUE>\s*<BILLOVERDUE>(.*?)<\/BILLOVERDUE>/gs
  
  const partiesMap = new Map<string, TallyDebtorParty>()
  let totalOutstanding = 0
  let totalBills = 0

  const agingBuckets = {
    current: 0,
    thirtyToSixty: 0,
    sixtyToNinety: 0,
    ninetyToOneEighty: 0,
    overOneEighty: 0
  }

  let match: RegExpExecArray | null
  while ((match = pattern.exec(xmlText)) !== null) {
    const [, bdate, bref, bparty, bcl, bdue, boverdue] = match
    const rawAmt = parseFloat(bcl) || 0
    const amount = Math.abs(rawAmt)
    const overdueDays = parseInt(boverdue, 10) || 0
    const cleanParty = bparty.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    const cleanRef = bref.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

    totalOutstanding += amount
    totalBills += 1

    if (overdueDays <= 30) {
      agingBuckets.current += amount
    } else if (overdueDays <= 60) {
      agingBuckets.thirtyToSixty += amount
    } else if (overdueDays <= 90) {
      agingBuckets.sixtyToNinety += amount
    } else if (overdueDays <= 180) {
      agingBuckets.ninetyToOneEighty += amount
    } else {
      agingBuckets.overOneEighty += amount
    }

    if (!partiesMap.has(cleanParty)) {
      partiesMap.set(cleanParty, {
        party: cleanParty,
        totalReceivable: 0,
        billsCount: 0,
        maxOverdueDays: 0,
        minOverdueDays: 999999,
        bills: []
      })
    }

    const p = partiesMap.get(cleanParty)!
    p.totalReceivable += amount
    p.billsCount += 1
    if (overdueDays > p.maxOverdueDays) p.maxOverdueDays = overdueDays
    if (overdueDays < p.minOverdueDays) p.minOverdueDays = overdueDays

    p.bills.push({
      date: bdate.trim(),
      ref: cleanRef,
      amount: Math.round(amount * 100) / 100,
      dueDate: bdue.trim(),
      overdueDays
    })
  }

  const parties = Array.from(partiesMap.values()).map(p => ({
    ...p,
    totalReceivable: Math.round(p.totalReceivable * 100) / 100,
    minOverdueDays: p.minOverdueDays === 999999 ? 0 : p.minOverdueDays,
    bills: p.bills.sort((a, b) => b.overdueDays - a.overdueDays)
  })).sort((a, b) => b.totalReceivable - a.totalReceivable)

  return {
    source: 'Tally Prime Read-Only XML Interface',
    company: 'SRI LAKSHMI PLYWOODS 2627',
    syncedAt: new Date().toISOString(),
    summary: {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalBills,
      totalParties: parties.length,
      agingBuckets: {
        current: Math.round(agingBuckets.current * 100) / 100,
        thirtyToSixty: Math.round(agingBuckets.thirtyToSixty * 100) / 100,
        sixtyToNinety: Math.round(agingBuckets.sixtyToNinety * 100) / 100,
        ninetyToOneEighty: Math.round(agingBuckets.ninetyToOneEighty * 100) / 100,
        overOneEighty: Math.round(agingBuckets.overOneEighty * 100) / 100
      }
    },
    parties
  }
}
