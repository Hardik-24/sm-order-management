/**
 * Standalone Chat Storage Archival to Google Drive Script
 * 
 * Usage:
 *   node scripts/archive_chat_to_drive.cjs [days]
 * Default days: 30
 * 
 * What it does:
 * 1. Connects to PostgreSQL directly via Prisma
 * 2. Finds chat attachments older than [days] still in Supabase Storage
 * 3. Uploads file to Google Drive (using service account)
 * 4. Updates ChatMessage content JSON with Google Drive fileId (/api/chat/file/[id])
 * 5. Deletes file from Supabase Storage bucket 'chat-attachments'
 * 6. Chat history & text remain completely intact!
 */

const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@supabase/supabase-js')
const { JWT } = require('google-auth-library')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

// 1. Get Google Credentials
function getGoogleAuth() {
  let email = process.env.GOOGLE_CLIENT_EMAIL
  let key = process.env.GOOGLE_PRIVATE_KEY

  if (!email || !key) {
    const credsPath = path.resolve(__dirname, '../google-service-account.json')
    if (fs.existsSync(credsPath)) {
      const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
      email = raw.client_email
      key = raw.private_key
    }
  }

  if (!email || !key) {
    throw new Error('Google service account credentials not found in env or google-service-account.json')
  }

  key = key.replace(/\\n/g, '\n')
  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']
  })
}

// 2. Upload to Drive
async function uploadToDrive(auth, { filename, mimeType, buffer, folderId }) {
  const metadata = {
    name: filename,
    mimeType
  }
  if (folderId) metadata.parents = [folderId]

  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const body = Buffer.concat([
    Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n'
    ),
    Buffer.from(buffer.toString('base64')),
    Buffer.from(closeDelimiter)
  ])

  const res = await auth.request({
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body
  })

  return res.data
}

async function run() {
  const days = parseInt(process.argv[2] || '30', 10)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  console.log(`[Archive] Starting chat archival for attachments older than ${days} days (Cutoff: ${cutoff.toISOString()})...`)

  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://xfzvkqjkbwwdqtxgasrh.supabase.co'
  const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmenZrcWprYnd3ZHF0eGdhc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Njg1MzYsImV4cCI6MjEwNDE0NDUzNn0.0D6O8IL-2Dg53GIuMoti0yA2seDfj4XVpPj1aarfb4s'
  const supabase = createClient(supabaseUrl, supabaseKey)

  const googleAuth = getGoogleAuth()
  const folderId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || null

  const candidates = await prisma.chatMessage.findMany({
    where: {
      createdAt: { lte: cutoff },
      content: { contains: '"attachment"' }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`[Archive] Found ${candidates.length} candidate messages to evaluate.`)

  let archivedCount = 0
  let freedBytes = 0

  for (const msg of candidates) {
    try {
      if (!msg.content.startsWith('{') || !msg.content.endsWith('}')) continue
      const parsed = JSON.parse(msg.content)
      const att = parsed.attachment
      if (!att || !att.url) continue

      if (att.storageProvider === 'gdrive' || att.gdriveFileId) {
        // Already archived
        continue
      }

      const parts = att.url.split('/chat-attachments/')
      if (parts.length < 2) continue
      const storagePath = decodeURIComponent(parts[1])

      console.log(`[Archive] Downloading from Supabase: ${storagePath}`)
      const { data: blobData, error: dlErr } = await supabase.storage
        .from('chat-attachments')
        .download(storagePath)

      if (dlErr || !blobData) {
        console.error(`[Archive] Download failed for ${storagePath}:`, dlErr)
        continue
      }

      const buffer = Buffer.from(await blobData.arrayBuffer())

      console.log(`[Archive] Uploading to Google Drive: ${att.name || storagePath} (${buffer.length} bytes)...`)
      const driveFile = await uploadToDrive(googleAuth, {
        filename: att.name || storagePath,
        mimeType: att.mimeType || 'application/octet-stream',
        buffer,
        folderId
      })

      console.log(`[Archive] Uploaded to Drive! ID: ${driveFile.id}`)

      // Update message JSON in DB
      parsed.attachment = {
        ...att,
        url: `/api/chat/file/${driveFile.id}`,
        storageProvider: 'gdrive',
        gdriveFileId: driveFile.id,
        archivedAt: new Date().toISOString()
      }

      await prisma.chatMessage.update({
        where: { id: msg.id },
        data: {
          content: JSON.stringify(parsed)
        }
      })

      // Delete from Supabase Storage
      await supabase.storage.from('chat-attachments').remove([storagePath])
      console.log(`[Archive] Removed from Supabase Storage: ${storagePath}`)

      archivedCount++
      freedBytes += buffer.length
    } catch (err) {
      console.error(`[Archive] Error on message ${msg.id}:`, err.message)
    }
  }

  console.log(`\n======================================================`)
  console.log(`  Archival Finished!`)
  console.log(`  Archived Files: ${archivedCount}`)
  console.log(`  Storage Freed: ${(freedBytes / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`======================================================\n`)

  await prisma.$disconnect()
}

run().catch((err) => {
  console.error('Fatal error during archival:', err)
  prisma.$disconnect()
  process.exit(1)
})
