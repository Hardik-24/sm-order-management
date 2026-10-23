import fs from 'fs'
import path from 'path'

const credsPath = path.resolve(process.cwd(), 'google-service-account.json')

if (!fs.existsSync(credsPath)) {
  console.error('Error: google-service-account.json not found in project root.')
  process.exit(1)
}

const raw = fs.readFileSync(credsPath, 'utf8')
const parsed = JSON.parse(raw)
const base64 = Buffer.from(raw).toString('base64')
const singleLineJson = JSON.stringify(parsed)

console.log('='.repeat(70))
console.log('  GOOGLE SERVICE ACCOUNT CREDENTIALS FOR VERCEL')
console.log('='.repeat(70))
console.log('\nGo to: Vercel Dashboard -> Your Project -> Settings -> Environment Variables\n')
console.log('Add the following environment variable:\n')
console.log('Key:')
console.log('GOOGLE_SERVICE_ACCOUNT_KEY\n')
console.log('Value (Option A - Base64 Encoded, 100% foolproof on Vercel without newline issues):')
console.log(base64)
console.log('\nValue (Option B - Single-line Minified JSON):')
console.log(singleLineJson)
console.log('\nAlso ensure you have set:')
console.log('GOOGLE_SHEET_ID')
console.log('124p_ZVSTqLTkIs9o04-7BsJjDH6SLFFabArHW9UQ7FI')
console.log('\n' + '='.repeat(70))
