import { defineEventHandler } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { queryTally } from '~~/server/utils/tallyClient'
import { prisma } from '~~/server/utils/prisma'

export interface TallyLedgersResponse {
  debtors: string[]
  creditors: string[]
  salesAccounts: string[]
  purchaseAccounts: string[]
  taxAccounts: string[]
  roundOffAccounts: string[]
  voucherTypes: string[]
  purchaseVoucherTypes: string[]
  salesVoucherTypes: string[]
  allLedgers: Array<{ name: string; parent: string }>
}

export default defineEventHandler(async (event): Promise<TallyLedgersResponse> => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const debtors = new Set<string>()
  const creditors = new Set<string>()
  const salesAccounts = new Set<string>()
  const purchaseAccounts = new Set<string>()
  const taxAccounts = new Set<string>()
  const roundOffAccounts = new Set<string>()
  const voucherTypes = new Set<string>()
  const purchaseVoucherTypes = new Set<string>()
  const salesVoucherTypes = new Set<string>()
  const allLedgers: Array<{ name: string; parent: string }> = []

  // 1. Try Live Tally Query on port 9000
  try {
    const xml = `<ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>LedgerExportCol</ID></HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="LedgerExportCol">
                <TYPE>Ledger</TYPE>
                <FETCH>Name,Parent</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`

    const raw = await queryTally(xml, 8000)
    const matches = raw.matchAll(/<LEDGER NAME="([^"]+)"[^>]*>[\s\S]*?<PARENT[^>]*>([^<]+)<\/PARENT>/gi)

    for (const m of matches) {
      const name = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      const parent = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

      if (!name) continue
      allLedgers.push({ name, parent })

      const parentUpper = parent.toUpperCase()
      const nameUpper = name.toUpperCase()

      if (parentUpper.includes('SUNDRY DEBTOR')) {
        debtors.add(name)
      } else if (parentUpper.includes('SUNDRY CREDITOR')) {
        creditors.add(name)
      } else if (parentUpper.includes('SALES')) {
        salesAccounts.add(name)
      } else if (parentUpper.includes('PURCHASE')) {
        purchaseAccounts.add(name)
      } else if (parentUpper.includes('DUTIES') || parentUpper.includes('TAX') || parentUpper === 'GST' || nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST')) {
        taxAccounts.add(name)
      } else if (nameUpper.includes('ROUND')) {
        roundOffAccounts.add(name)
      }
    }

    // Also fetch Voucher Types strictly from Tally
    try {
      const vchTypeXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VTCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="VTCol"><TYPE>VoucherType</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`
      const vtRaw = await queryTally(vchTypeXml, 4000)
      const vtMatches = vtRaw.matchAll(/<VOUCHERTYPE\s+NAME="([^"]+)"[^>]*>[\s\S]*?<PARENT[^>]*>([^<]+)<\/PARENT>/gi)
      for (const m of vtMatches) {
        const vtName = m[1].trim()
        const vtParent = m[2].trim()
        if (vtParent.toLowerCase() === 'sales') {
          salesVoucherTypes.add(vtName)
          voucherTypes.add(vtName)
        } else if (vtParent.toLowerCase() === 'purchase') {
          purchaseVoucherTypes.add(vtName)
          voucherTypes.add(vtName)
        }
      }
    } catch (_) {}

  } catch (err) {
    // 2. Fallback to cached receivables & payables data if Tally is temporarily closed
  }

  // Load from cached master ledgers first, then fallback to receivables & payables
  try {
    const [master, rec, pay] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'tally_master_ledgers' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_payables_data' } }),
    ])

    if (master?.value) {
      try {
        const parsedMaster = JSON.parse(master.value)
        if (Array.isArray(parsedMaster.debtors)) {
          for (const d of parsedMaster.debtors) debtors.add(d.trim())
        }
        if (Array.isArray(parsedMaster.creditors)) {
          for (const c of parsedMaster.creditors) creditors.add(c.trim())
        }
        if (Array.isArray(parsedMaster.salesAccounts)) {
          for (const s of parsedMaster.salesAccounts) salesAccounts.add(s.trim())
        }
        if (Array.isArray(parsedMaster.purchaseAccounts)) {
          for (const p of parsedMaster.purchaseAccounts) purchaseAccounts.add(p.trim())
        }
        if (Array.isArray(parsedMaster.taxAccounts)) {
          for (const t of parsedMaster.taxAccounts) taxAccounts.add(t.trim())
        }
        if (Array.isArray(parsedMaster.roundOffAccounts)) {
          for (const r of parsedMaster.roundOffAccounts) roundOffAccounts.add(r.trim())
        }
        if (Array.isArray(parsedMaster.allLedgers) && allLedgers.length === 0) {
          allLedgers.push(...parsedMaster.allLedgers)
        }
      } catch (_) {}
    }

    if (rec?.value) {
      const parsed = JSON.parse(rec.value)
      if (Array.isArray(parsed.parties)) {
        for (const p of parsed.parties) {
          if (p.party) debtors.add(p.party.trim())
        }
      }
    }

    if (pay?.value) {
      const parsedPay = JSON.parse(pay.value)
      if (Array.isArray(parsedPay.parties)) {
        for (const p of parsedPay.parties) {
          if (p.party) creditors.add(p.party.trim())
        }
      }
    }
  } catch (_) {}

  // Ensure standard fallbacks exist
  const defaultSales = ['Sales GST@18%', 'Sales GST@28%', 'Sales GST@12%', 'Sales GST@5%', 'Sales IGST@18%']
  for (const s of defaultSales) salesAccounts.add(s)

  const defaultPurchases = ['Purchase GST@18%', 'Purchase GST@28%', 'Purchase GST@12%', 'Purchase GST@5%', 'Purchase IGST@18%']
  for (const p of defaultPurchases) purchaseAccounts.add(p)

  const defaultTaxes = [
    'Output CGST@9%', 'Output SGST@9%',
    'Output CGST@14%', 'Output SGST@14%',
    'Output CGST@6%', 'Output SGST@6%',
    'Output CGST@2.5%', 'Output SGST@2.5%',
    'Output IGST@18%', 'Output IGST@28%', 'Output IGST@12%', 'Output IGST@5%',
    'Input CGST@9%', 'Input SGST@9%',
    'Input CGST@14%', 'Input SGST@14%',
    'Input CGST@6%', 'Input SGST@6%',
    'Input CGST@2.5%', 'Input SGST@2.5%',
    'Input IGST@18%', 'Input IGST@28%', 'Input IGST@12%', 'Input IGST@5%'
  ]
  for (const t of defaultTaxes) taxAccounts.add(t)

  roundOffAccounts.add('Sales Rounding Off')
  roundOffAccounts.add('Rounding Off')

  return {
    debtors: Array.from(debtors).sort(),
    creditors: Array.from(creditors).sort(),
    salesAccounts: Array.from(salesAccounts).sort(),
    purchaseAccounts: Array.from(purchaseAccounts).sort(),
    taxAccounts: Array.from(taxAccounts).sort(),
    roundOffAccounts: Array.from(roundOffAccounts).sort(),
    voucherTypes: Array.from(voucherTypes).sort(),
    purchaseVoucherTypes: Array.from(purchaseVoucherTypes).sort(),
    salesVoucherTypes: Array.from(salesVoucherTypes).sort(),
    allLedgers
  }
})
