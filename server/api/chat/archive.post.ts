import { defineEventHandler, createError, readBody } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { createClient } from '@supabase/supabase-js'
import { uploadBufferToDrive } from '~~/server/utils/googleDrive'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Only Admins can run chat archival' })
  }

  const body = (await readBody(event).catch(() => ({}))) || {}
  const days = Math.max(1, parseInt(body.days || '30', 10))
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://xfzvkqjkbwwdqtxgasrh.supabase.co'
  const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmenZrcWprYnd3ZHF0eGdhc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Njg1MzYsImV4cCI6MjEwNDE0NDUzNn0.0D6O8IL-2Dg53GIuMoti0yA2seDfj4XVpPj1aarfb4s'
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Find messages older than cutoff containing attachment json
  const candidateMessages = await prisma.chatMessage.findMany({
    where: {
      createdAt: { lte: cutoff },
      content: { contains: '"attachment"' }
    },
    orderBy: { createdAt: 'asc' },
    take: 100 // Process in batches of 100 for safety
  })

  let archivedCount = 0
  let freedBytes = 0
  const errors: string[] = []

  for (const msg of candidateMessages) {
    try {
      if (!msg.content.startsWith('{') || !msg.content.endsWith('}')) continue
      const parsed = JSON.parse(msg.content)
      const att = parsed.attachment
      if (!att || !att.url) continue

      // Skip if already archived to Google Drive
      if (att.storageProvider === 'gdrive' || att.gdriveFileId) continue

      // Extract Supabase storage file path from URL
      // Example: https://xfzvkqjkbwwdqtxgasrh.supabase.co/storage/v1/object/public/chat-attachments/1740637123_abc.webp
      const parts = att.url.split('/chat-attachments/')
      if (parts.length < 2) continue
      const storagePath = decodeURIComponent(parts[1])

      // 1. Download file from Supabase Storage
      const { data: blobData, error: downloadError } = await supabase.storage
        .from('chat-attachments')
        .download(storagePath)

      if (downloadError || !blobData) {
        errors.push(`Download failed for msg ${msg.id} (${storagePath}): ${downloadError?.message}`)
        continue
      }

      const buffer = Buffer.from(await blobData.arrayBuffer())

      // 2. Upload to Google Drive
      const driveFile = await uploadBufferToDrive({
        filename: att.name || storagePath,
        mimeType: att.mimeType || blobData.type || 'application/octet-stream',
        buffer
      })

      // 3. Update database record with Google Drive reference
      parsed.attachment = {
        ...att,
        url: `/api/chat/file/${driveFile.fileId}`,
        storageProvider: 'gdrive',
        gdriveFileId: driveFile.fileId,
        archivedAt: new Date().toISOString()
      }

      await prisma.chatMessage.update({
        where: { id: msg.id },
        data: {
          content: JSON.stringify(parsed)
        }
      })

      // 4. Delete file from Supabase Storage to reclaim 1GB free tier
      await supabase.storage
        .from('chat-attachments')
        .remove([storagePath])

      archivedCount++
      freedBytes += buffer.length
    } catch (err: any) {
      console.error(`[ChatArchive] Failed to archive message ${msg.id}:`, err)
      errors.push(`Error on msg ${msg.id}: ${err.message}`)
    }
  }

  return {
    success: true,
    cutoffDays: days,
    cutoffDate: cutoff.toISOString(),
    candidateCount: candidateMessages.length,
    archivedCount,
    freedBytes,
    freedFormatted: (freedBytes / (1024 * 1024)).toFixed(2) + ' MB',
    errors: errors.length > 0 ? errors : undefined
  }
})
