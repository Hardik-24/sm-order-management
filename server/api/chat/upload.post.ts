import { defineEventHandler, createError, readMultipartFormData } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { createClient } from '@supabase/supabase-js'
import { enforceRateLimit } from '~~/server/utils/rateLimit'

const FORBIDDEN_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'vbs', 'scr', 'jar', 'html', 'htm', 'js', 'py', 'dll', 'com', 'msi', 'reg', 'ps1', 'apk'
])

export default defineEventHandler(async (event) => {
  requireAuth(event)

  enforceRateLimit(event, {
    max: 30,
    windowSeconds: 600,
    namespace: 'chat_upload',
    message: 'Too many files uploaded in a short period. Please wait a moment.'
  })

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No file uploaded' })
  }

  const filePart = parts.find(p => p.filename && p.data)
  if (!filePart || !filePart.filename) {
    throw createError({ statusCode: 400, message: 'Valid file is required' })
  }

  // Optional blur preview passed from client
  const blurPart = parts.find(p => p.name === 'blurPreview')
  const blurPreview = blurPart ? blurPart.data.toString('utf-8') : null

  // File size check: max 15MB
  if (filePart.data.length > 15 * 1024 * 1024) {
    throw createError({ statusCode: 400, message: 'File exceeds 15MB limit' })
  }

  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://xfzvkqjkbwwdqtxgasrh.supabase.co'
  const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmenZrcWprYnd3ZHF0eGdhc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Njg1MzYsImV4cCI6MjEwNDE0NDUzNn0.0D6O8IL-2Dg53GIuMoti0yA2seDfj4XVpPj1aarfb4s'
  const supabase = createClient(supabaseUrl, supabaseKey)

  const originalName = filePart.filename
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase()
  const cleanExt = ext.replace(/[^a-z0-9]/g, '')
  if (FORBIDDEN_EXTENSIONS.has(cleanExt)) {
    throw createError({ statusCode: 400, message: `File type .${cleanExt} is not permitted for security reasons.` })
  }
  const randomSuffix = Math.random().toString(36).substring(2, 10)
  const storagePath = `${Date.now()}_${randomSuffix}.${cleanExt}`

  const mimeType = filePart.type || 'application/octet-stream'
  const isImage = mimeType.startsWith('image/')

  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .upload(storagePath, filePart.data, {
      contentType: mimeType,
      upsert: false
    })

  if (error) {
    console.error('[ChatUpload] Supabase Storage upload error:', error)
    throw createError({ statusCode: 500, message: `Upload failed: ${error.message}` })
  }

  const { data: pubData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(storagePath)

  return {
    success: true,
    url: pubData.publicUrl,
    name: originalName,
    size: filePart.data.length,
    type: isImage ? 'image' : 'file',
    mimeType,
    blurPreview
  }
})
