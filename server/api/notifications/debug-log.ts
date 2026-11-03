// Server-side push notification debug logger
import { defineEventHandler, readBody, getQuery } from 'h3'

interface DebugLogEntry {
  timestamp: string
  deviceId?: string
  deviceName?: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  data?: any
}

// In-memory circular buffer for last 100 debug logs
const debugLogs: DebugLogEntry[] = []

export function appendDebugLog(entry: Omit<DebugLogEntry, 'timestamp'>) {
  const fullEntry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  }
  debugLogs.unshift(fullEntry)
  if (debugLogs.length > 100) {
    debugLogs.pop()
  }
  console.log(`[PUSH_DEBUG ${fullEntry.level.toUpperCase()}] ${fullEntry.message}`, fullEntry.data || '')
}

export default defineEventHandler(async (event) => {
  const method = event.node.req.method

  if (method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    appendDebugLog({
      deviceId: body?.deviceId,
      deviceName: body?.deviceName,
      level: body?.level || 'info',
      message: body?.message || 'No message provided',
      data: body?.data
    })
    return { success: true }
  }

  // GET: Return recent debug logs
  return {
    success: true,
    count: debugLogs.length,
    logs: debugLogs
  }
})
