import { JWT } from 'google-auth-library'
import { getGoogleCredentials } from './googleAuth'

let _driveAuthClient: JWT | null = null

export function getGoogleDriveClient(): JWT {
  if (_driveAuthClient) return _driveAuthClient

  const creds = getGoogleCredentials()
  if (!creds) {
    throw new Error('Google service account credentials not configured')
  }

  _driveAuthClient = new JWT({
    email: creds.email,
    key: creds.key,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  })

  return _driveAuthClient
}

export function getGoogleDriveFolderId(): string | null {
  const config = useRuntimeConfig()
  return (
    (config.googleDriveFolderId as string) ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID ||
    null
  )
}

export interface DriveUploadResult {
  fileId: string
  name: string
  mimeType: string
  size: number
}

/**
 * Uploads a file buffer directly to Google Drive via multipart REST API
 */
export async function uploadBufferToDrive(params: {
  filename: string
  mimeType: string
  buffer: Buffer
  folderId?: string | null
}): Promise<DriveUploadResult> {
  const client = getGoogleDriveClient()
  const folderId = params.folderId || getGoogleDriveFolderId()

  const metadata: any = {
    name: params.filename,
    mimeType: params.mimeType
  }

  if (folderId) {
    metadata.parents = [folderId]
  }

  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const multipartRequestBody = Buffer.concat([
    Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${params.mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n'
    ),
    Buffer.from(params.buffer.toString('base64')),
    Buffer.from(closeDelimiter)
  ])

  const response = await client.request<any>({
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': multipartRequestBody.length.toString()
    },
    body: multipartRequestBody
  })

  if (!response.data || !response.data.id) {
    throw new Error('Failed to get file ID from Google Drive upload response')
  }

  return {
    fileId: response.data.id,
    name: response.data.name || params.filename,
    mimeType: response.data.mimeType || params.mimeType,
    size: params.buffer.length
  }
}

/**
 * Stream or fetch binary file from Google Drive by File ID
 */
export async function fetchFileFromDrive(fileId: string): Promise<{
  data: Buffer
  mimeType: string
  name: string
  size?: number
}> {
  const client = getGoogleDriveClient()

  // 1. Get file metadata (name, mimeType)
  const metaRes = await client.request<any>({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
    method: 'GET'
  })

  const name = metaRes.data.name || 'file'
  const mimeType = metaRes.data.mimeType || 'application/octet-stream'
  const size = metaRes.data.size ? parseInt(metaRes.data.size, 10) : undefined

  // 2. Fetch raw binary content
  const contentRes = await client.request<any>({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    method: 'GET',
    responseType: 'arraybuffer'
  })

  const buffer = Buffer.from(contentRes.data)

  return {
    data: buffer,
    mimeType,
    name,
    size: size || buffer.length
  }
}
