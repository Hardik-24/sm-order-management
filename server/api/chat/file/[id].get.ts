import { defineEventHandler, createError, getRouterParam, getQuery, setHeaders } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { fetchFileFromDrive } from '~~/server/utils/googleDrive'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const fileId = getRouterParam(event, 'id')
  if (!fileId) {
    throw createError({ statusCode: 400, message: 'File ID is required' })
  }

  const query = getQuery(event)
  const isDownload = query.download === '1' || query.download === 'true'

  try {
    const file = await fetchFileFromDrive(fileId)

    const disposition = isDownload
      ? `attachment; filename="${encodeURIComponent(file.name)}"`
      : `inline; filename="${encodeURIComponent(file.name)}"`

    setHeaders(event, {
      'Content-Type': file.mimeType,
      'Content-Disposition': disposition,
      'Content-Length': file.data.length.toString(),
      'Cache-Control': 'public, max-age=86400, immutable'
    })

    return file.data
  } catch (err: any) {
    console.error(`[ChatDriveStream] Error fetching file ${fileId} from Drive:`, err.message)
    throw createError({
      statusCode: err.statusCode || 500,
      message: `Failed to retrieve file from Drive archive: ${err.message}`
    })
  }
})
