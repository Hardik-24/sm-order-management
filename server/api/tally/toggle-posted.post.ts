import { defineEventHandler, readBody, createError } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const body = await readBody(event).catch(() => ({}))
  const voucherNo = String(body?.voucherNo || '').trim()
  const action = body?.action as 'mark' | 'unmark'

  if (!voucherNo || !['mark', 'unmark'].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request: voucherNo and action ("mark" or "unmark") are required.'
    })
  }

  // 1. Fetch current posted registry
  const postedSetting = await prisma.systemSetting.findUnique({
    where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' }
  })

  let postedMap: Record<string, any> = {}
  if (postedSetting?.value) {
    try {
      postedMap = JSON.parse(postedSetting.value)
    } catch {}
  }

  // 2. Apply action
  if (action === 'mark') {
    postedMap[voucherNo] = {
      postedAt: new Date().toISOString(),
      manual: true,
      tallyVchNo: voucherNo,
      note: 'Manually marked as posted in Tally'
    }
  } else {
    // When unmarking, set explicit unmarked flag so even live heuristic/register matches respect user's reset
    postedMap[voucherNo] = {
      unmarked: true,
      unpostedAt: new Date().toISOString()
    }

    // Also remove any old queue records for this voucher so it can be cleanly enqueued and re-posted
    try {
      await prisma.tallyVoucherQueue.deleteMany({
        where: { voucherNo: { equals: voucherNo, mode: 'insensitive' } }
      })
    } catch (_) {}
  }

  // 3. Save back to permanent DB settings
  await prisma.systemSetting.upsert({
    where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' },
    update: { value: JSON.stringify(postedMap) },
    create: { key: 'BUSY_TALLY_POSTED_VOUCHERS', value: JSON.stringify(postedMap) }
  })

  return {
    success: true,
    voucherNo,
    action,
    isPosted: action === 'mark'
  }
})
