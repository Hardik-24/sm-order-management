import { defineEventHandler, getQuery, createError } from 'h3'
import { requireActionPermission } from '~~/server/utils/auth'
import { getQueueJobStatus } from '~~/server/utils/tallyQueue'

export default defineEventHandler(async (event) => {
  await requireActionPermission(event, 'canPostBusyToTally')

  const query = getQuery(event)
  const jobId = String(query.jobId || '').trim()

  if (!jobId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'jobId query parameter is required.'
    })
  }

  const job = await getQueueJobStatus(jobId)
  if (!job) {
    throw createError({
      statusCode: 404,
      statusMessage: `Job #${jobId} not found in queue.`
    })
  }

  return {
    success: true,
    job: {
      id: job.id,
      voucherNo: job.voucherNo,
      voucherType: job.voucherType,
      status: job.status,
      errorMessage: job.errorMessage,
      tallyVchNo: job.tallyVchNo,
      createdCompany: job.createdCompany,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }
  }
})
