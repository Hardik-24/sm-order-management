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

        // If heartbeat is within the last 5 minutes and Tally is reported online
        if (ageMs < 300000 && agentStatus.tallyOnline) {
          return {
            online: true,
            company: agentStatus.company || 'SRI LAKSHMI PLYWOODS 2627',
            port: 9000,
            viaSyncAgent: true,
            lastHeartbeat: agentStatus.lastHeartbeat
          }
        }
      } catch (_) {}
    }

    // 3. Fallback: If Tally receivables/financials was synced recently
    if (receivablesSetting?.value) {
      try {
        const rec = JSON.parse(receivablesSetting.value)
        if (rec.company && rec.company !== 'No Company Open') {
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
