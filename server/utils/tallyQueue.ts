import { prisma } from './prisma'

export interface TallyQueueJob {
  id: string
  voucherNo: string
  voucherType: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
  payload: any
  errorMessage?: string | null
  tallyVchNo?: string | null
  createdCompany?: string | null
  createdAt: string
  updatedAt: string
}

export async function enqueueTallyVoucher(data: {
  voucherNo: string
  voucherType: string
  payload: any
}): Promise<string> {
  const job = await prisma.tallyVoucherQueue.create({
    data: {
      voucherNo: data.voucherNo,
      voucherType: data.voucherType,
      status: 'PENDING',
      payload: data.payload
    }
  })
  return job.id
}

export async function getQueueJobStatus(id: string): Promise<TallyQueueJob | null> {
  const job = await prisma.tallyVoucherQueue.findUnique({
    where: { id }
  })
  if (!job) return null
  return {
    id: job.id,
    voucherNo: job.voucherNo,
    voucherType: job.voucherType,
    status: job.status as any,
    payload: job.payload,
    errorMessage: job.errorMessage,
    tallyVchNo: job.tallyVchNo,
    createdCompany: job.createdCompany,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  }
}

export async function getPendingTallyJobs(limit: number = 10): Promise<TallyQueueJob[]> {
  const jobs = await prisma.tallyVoucherQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit
  })
  return jobs.map(j => ({
    id: j.id,
    voucherNo: j.voucherNo,
    voucherType: j.voucherType,
    status: j.status as any,
    payload: j.payload,
    errorMessage: j.errorMessage,
    tallyVchNo: j.tallyVchNo,
    createdCompany: j.createdCompany,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString()
  }))
}

export async function updateTallyJobStatus(id: string, update: {
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
  errorMessage?: string | null
  tallyVchNo?: string | null
  createdCompany?: string | null
}): Promise<void> {
  await prisma.tallyVoucherQueue.update({
    where: { id },
    data: {
      status: update.status,
      errorMessage: update.errorMessage ?? null,
      tallyVchNo: update.tallyVchNo ?? null,
      createdCompany: update.createdCompany ?? null
    }
  })
}
