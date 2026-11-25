import http from 'http'

const TALLY_HOST = process.env.TALLY_HOST || 'Desktop-2pps0fa'
const TALLY_PORT = parseInt(process.env.TALLY_PORT || '9000', 10)

export function queryTally(xml: string, timeoutMs: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const minified = xml.replace(/\n\s*/g, '')
    const req = http.request({
      hostname: TALLY_HOST,
      port: TALLY_PORT,
      path: '/',
      method: 'POST',
      agent: false,
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': Buffer.byteLength(minified),
        'Connection': 'close'
      },
      timeout: timeoutMs
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })

    req.on('error', err => reject(err))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Tally request timed out (${timeoutMs}ms)`))
    })

    req.write(minified)
    req.end()
  })
}

export async function getTallyConnectionStatus(): Promise<{ online: boolean; company?: string; port: number; error?: string }> {
  try {
    const xml = `<ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurCmpCol</ID></HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="CurCmpCol">
                <TYPE>Company</TYPE>
                <FETCH>Name,StartingFrom,EndingAt</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`

    const res = await queryTally(xml, 4000)
    const cmpMatch = res.match(/<COMPANY[^>]*NAME="([^"]+)"/i) || res.match(/<NAME[^>]*>([^<]+)<\/NAME>/i)
    if (!cmpMatch) {
      return { online: true, company: 'No Company Open', port: TALLY_PORT }
    }
    const cleanCompany = cmpMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    return { online: true, company: cleanCompany, port: TALLY_PORT }
  } catch (err: any) {
    return { online: false, port: TALLY_PORT, error: err.message || 'Port unreachable' }
  }
}

export interface ExistingTallyVoucherInfo {
  exists: boolean
  voucherNo?: string
  voucherType?: string
  partyLedgerName?: string
  amount?: number
  date?: string
  reference?: string
}

/**
 * Checks live in Tally Prime whether a voucher with the given number or reference already exists.
 * This directly prevents double posting (both from OMS and manual vouchers entered in Tally).
 */
export async function checkTallyVoucherExists(
  voucherNo: string,
  companyName: string = 'SRI LAKSHMI PLYWOODS 2627',
  reference?: string
): Promise<ExistingTallyVoucherInfo> {
  const normNo = (voucherNo || '').trim().toUpperCase()
  const normRef = (reference || '').trim().toUpperCase()
  if (!normNo && !normRef) return { exists: false }

  const filterTerms: string[] = []
  if (normNo) {
    filterTerms.push(`$$Upper:$VoucherNumber = "${normNo}"`)
    filterTerms.push(`$$Upper:$Reference = "${normNo}"`)
  }
  if (normRef && normRef !== normNo) {
    filterTerms.push(`$$Upper:$VoucherNumber = "${normRef}"`)
    filterTerms.push(`$$Upper:$Reference = "${normRef}"`)
  }

  const formula = filterTerms.join(' or ')
  const escapedCompany = companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const xml = `<ENVELOPE>
    <HEADER>
      <VERSION>1</VERSION>
      <TALLYREQUEST>Export</TALLYREQUEST>
      <TYPE>Collection</TYPE>
      <ID>CheckVchCol</ID>
    </HEADER>
    <BODY>
      <DESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${escapedCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="CheckVchCol">
              <TYPE>Voucher</TYPE>
              <FETCH>VoucherNumber,Reference,Date,VoucherTypeName,PartyLedgerName,Amount</FETCH>
              <FILTER>VchFilter</FILTER>
            </COLLECTION>
            <SYSTEM TYPE="Formulae" NAME="VchFilter">${formula}</SYSTEM>
          </TDLMESSAGE>
        </TDL>
      </DESC>
    </BODY>
  </ENVELOPE>`

  try {
    const raw = await queryTally(xml, 5000)
    const dataMatch = raw.match(/<DATA>([\s\S]*?)<\/DATA>/i)
    const dataContent = dataMatch ? dataMatch[1] : ''
    const hasVoucher = /<VOUCHER\b[^>]*>/i.test(dataContent)
    if (!hasVoucher) {
      return { exists: false }
    }

    const vchNoMatch = dataContent.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i)
    const vchTypeMatch = dataContent.match(/<VOUCHERTYPENAME[^>]*>([^<]+)<\/VOUCHERTYPENAME>/i)
    const partyMatch = dataContent.match(/<PARTYLEDGERNAME[^>]*>([^<]+)<\/PARTYLEDGERNAME>/i)
    const amtMatch = dataContent.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i)
    const dateMatch = dataContent.match(/<DATE[^>]*>([^<]+)<\/DATE>/i)
    const refMatch = dataContent.match(/<REFERENCE[^>]*>([^<]+)<\/REFERENCE>/i)

    const rawAmt = amtMatch ? Math.abs(parseFloat(amtMatch[1])) : 0
    return {
      exists: true,
      voucherNo: vchNoMatch ? vchNoMatch[1].trim() : voucherNo,
      voucherType: vchTypeMatch ? vchTypeMatch[1].trim() : undefined,
      partyLedgerName: partyMatch ? partyMatch[1].trim() : undefined,
      amount: isNaN(rawAmt) ? undefined : rawAmt,
      date: dateMatch ? dateMatch[1].trim() : undefined,
      reference: refMatch ? refMatch[1].trim() : undefined
    }
  } catch (err: any) {
    console.warn('[checkTallyVoucherExists] Warning querying live Tally:', err.message)
    return { exists: false }
  }
}
