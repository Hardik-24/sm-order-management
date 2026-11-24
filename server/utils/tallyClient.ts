import http from 'http'

const TALLY_HOST = process.env.TALLY_HOST || '127.0.0.1'
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
