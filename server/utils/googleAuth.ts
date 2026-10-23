import { JWT } from 'google-auth-library'
import fs from 'fs'
import path from 'path'

export interface GoogleCredentials {
  email: string
  key: string
  source: string
}

export function getGoogleSheetId(): string {
  const config = useRuntimeConfig()
  return (
    (config.googleSheetId as string) ||
    process.env.GOOGLE_SHEET_ID ||
    '124p_ZVSTqLTkIs9o04-7BsJjDH6SLFFabArHW9UQ7FI'
  )
}

export function getGoogleCredentials(): GoogleCredentials | null {
  const config = useRuntimeConfig()

  // 1. Check Full JSON string or Base64 in Environment Variables
  const jsonEnv =
    (config.googleServiceAccountKey as string) ||
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CREDENTIALS

  if (jsonEnv && typeof jsonEnv === 'string') {
    let raw = jsonEnv.trim()

    // Unwrap surrounding quotes if any
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      raw = raw.slice(1, -1).trim()
    }

    // Try base64 decoding if it doesn't look like JSON
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8').trim()
        if (decoded.startsWith('{')) {
          raw = decoded
        }
      } catch (e) {
        // Not base64, continue
      }
    }

    try {
      const parsed = JSON.parse(raw)
      const email = parsed.client_email || parsed.clientEmail
      let key = parsed.private_key || parsed.privateKey

      if (email && key) {
        key = String(key).replace(/\\n/g, '\n')
        return {
          email: String(email).trim(),
          key,
          source: 'GOOGLE_SERVICE_ACCOUNT_KEY (env)'
        }
      }
    } catch (e: any) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON string:', e.message)
    }
  }

  // 2. Check Individual Environment Variables (Email + Private Key)
  const clientEmail =
    (config.googleClientEmail as string) ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

  let privateKey =
    (config.googlePrivateKey as string) ||
    process.env.GOOGLE_PRIVATE_KEY

  if (clientEmail && privateKey) {
    let cleanKey = String(privateKey).trim()
    if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
      cleanKey = cleanKey.slice(1, -1)
    }
    cleanKey = cleanKey.replace(/\\n/g, '\n')

    return {
      email: String(clientEmail).trim(),
      key: cleanKey,
      source: 'GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY (env)'
    }
  }

  // 3. Check Local File on Disk (for Local Dev)
  try {
    const credsPath = path.resolve(process.cwd(), 'google-service-account.json')
    if (fs.existsSync(credsPath)) {
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
      if (creds.client_email && creds.private_key) {
        return {
          email: String(creds.client_email).trim(),
          key: String(creds.private_key).replace(/\\n/g, '\n'),
          source: 'google-service-account.json (local file)'
        }
      }
    }
  } catch (e: any) {
    console.warn('Could not read local google-service-account.json file:', e.message)
  }

  return null
}

export function createGoogleAuth(): { auth: JWT; credentials: GoogleCredentials } | null {
  const creds = getGoogleCredentials()
  if (!creds) return null

  const auth = new JWT({
    email: creds.email,
    key: creds.key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })

  return { auth, credentials: creds }
}
