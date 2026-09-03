import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['sync_requested', 'sync_progress'] } }
  })
  
  const syncRequested = settings.find(s => s.key === 'sync_requested')?.value === 'true'
  const progressRaw = settings.find(s => s.key === 'sync_progress')?.value
  
  let progress = null
  if (progressRaw) {
    try {
      progress = JSON.parse(progressRaw)
    } catch {
      progress = null
    }
  }
  
  return { 
    syncRequested,
    progress: syncRequested ? progress : null
  }
})
