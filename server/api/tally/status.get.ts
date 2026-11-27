import { defineEventHandler } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { getTallyConnectionStatus } from '~~/server/utils/tallyClient'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  // 1. Try direct local port 9000 query (if OMS web server is on the same machine)
  try {
    const localStatus = await getTallyConnectionStatus()
    if (localStatus.online) {
      return localStatus
    }
  } catch (_) {}

  // 2. Check Sync Agent heartbeat from database
  try {
    const [agentStatusSetting, receivablesSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'tally_sync_agent_status' } }),
      prisma.systemSetting.findUnique({ where: { key: 'tally_receivables_data' } })
    ])

    if (agentStatusSetting?.value) {
      try {
        const agentStatus = JSON.parse(agentStatusSetting.value)
        const lastHb = agentStatus.lastHeartbeat ? new Date(agentStatus.lastHeartbeat).getTime() : 0
        const ageMs = Date.now() - lastHb

        // High-responsiveness: Fresh heartbeat expected within 25 seconds
        if (ageMs < 25000) {
          if (agentStatus.tallyOnline) {
            return {
              online: true,
              company: agentStatus.company || 'SRI LAKSHMI PLYWOODS 2627',
              port: 9000,
              viaSyncAgent: true,
              lastHeartbeat: agentStatus.lastHeartbeat
            }
          } else {
            // Sync Agent is active, but local Tally Prime on port 9000 is closed/unreachable
            return {
              online: false,
              port: 9000,
              viaSyncAgent: true,
              error: agentStatus.error || 'Tally Prime closed on Main PC'
            }
          }
        } else {
          // Sync Agent stopped sending heartbeats > 25 seconds ago (PC offline/network disconnected)
          return {
            online: false,
            port: 9000,
            viaSyncAgent: true,
            error: `Sync Agent offline (no heartbeat for ${Math.round(ageMs / 1000)}s)`
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  return { online: false, port: 9000 }
})
