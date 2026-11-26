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

        // If heartbeat is fresh (within last 3 minutes), respect the Sync Agent's explicit live verdict
        if (ageMs < 180000) {
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
        }
      } catch (_) {}
    }

    // 3. Fallback: Only if NO Sync Agent heartbeat exists yet AND receivables was synced very recently (< 15 mins)
    if (receivablesSetting?.value) {
      try {
        const rec = JSON.parse(receivablesSetting.value)
        const syncTime = rec.syncedAt ? new Date(rec.syncedAt).getTime() : 0
        const syncAgeMs = Date.now() - syncTime

        if (syncAgeMs < 900000 && rec.company && rec.company !== 'No Company Open') {
          return {
            online: true,
            company: rec.company,
            port: 9000,
            viaSyncAgent: true,
            lastSynced: rec.syncedAt
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  return { online: false, port: 9000 }
})
