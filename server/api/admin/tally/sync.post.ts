import { defineEventHandler, readBody } from 'h3'
import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'
import { fetchFullTallyData } from '~~/server/utils/tallySync'

export default defineEventHandler(async (event) => {
  // Strictly Admin-Only
  requireRole(event, ['ADMIN'])

  try {
    const body = await readBody(event).catch(() => ({}))

    // If client supplied pre-parsed payload (e.g. from local sync agent)
    if (body && body.parties && body.summary) {
      const payloadString = JSON.stringify({
        ...body,
        syncedAt: new Date().toISOString()
      })
      await prisma.systemSetting.upsert({
        where: { key: 'tally_receivables_data' },
        update: { value: payloadString },
        create: { key: 'tally_receivables_data', value: payloadString }
      })
      return {
        success: true,
        message: 'Tally financial position updated successfully from payload.',
        data: JSON.parse(payloadString)
      }
    }

    // Otherwise, try querying Tally directly on local port 9000
    try {
      const parsed = await fetchFullTallyData('127.0.0.1', 9000)
      const payloadString = JSON.stringify(parsed)

      await prisma.systemSetting.upsert({
        where: { key: 'tally_receivables_data' },
        update: { value: payloadString },
        create: { key: 'tally_receivables_data', value: payloadString }
      })

      return {
        success: true,
        message: 'Synced fresh ledger balances and bills directly from Tally Prime.',
        data: parsed
      }
    } catch (netErr: any) {
      return {
        success: false,
        isLocalOnly: true,
        message: 'Could not connect to Tally Prime on localhost:9000. If you are on the cloud (Vercel), run "node scripts/sync_tally_receivables.cjs" or the desktop sync shortcut on your client PC.',
        details: netErr.message
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to sync Tally data'
    }
  }
})
