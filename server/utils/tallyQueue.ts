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
  const payloadJson = JSON.stringify(data.payload)
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO tally_voucher_queue (voucher_no, voucher_type, status, payload, created_at, updated_at)
     VALUES ($1, $2, 'PENDING', $3::jsonb, now(), now())
     RETURNING id`,
    data.voucherNo,
    data.voucherType,
    payloadJson
  )
  return rows[0]?.id
}

export async function getQueueJobStatus(id: string): Promise<TallyQueueJob | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, voucher_no as "voucherNo", voucher_type as "voucherType", status, 
            payload, error_message as "errorMessage", tally_vch_no as "tallyVchNo",
            created_company as "createdCompany", created_at as "createdAt", updated_at as "updatedAt"
     FROM tally_voucher_queue
     WHERE id = $1::uuid
     LIMIT 1`,
    id
  )
  if (!rows || rows.length === 0) return null
  return rows[0] as TallyQueueJob
}

export async function getPendingTallyJobs(limit: number = 10): Promise<TallyQueueJob[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, voucher_no as "voucherNo", voucher_type as "voucherType", status, 
            payload, error_message as "errorMessage", tally_vch_no as "tallyVchNo",
            created_company as "createdCompany", created_at as "createdAt", updated_at as "updatedAt"
     FROM tally_voucher_queue
     WHERE status = 'PENDING'
     ORDER BY created_at ASC
     LIMIT $1`,
    limit
  )
  return rows as TallyQueueJob[]
}

export async function updateTallyJobStatus(id: string, update: {
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
  errorMessage?: string | null
  tallyVchNo?: string | null
  createdCompany?: string | null
}): Promise<void> {
  await prisma.$queryRawUnsafe(
    `UPDATE tally_voucher_queue
     SET status = $2,
         error_message = $3,
         tally_vch_no = $4,
         created_company = $5,
         updated_at = now()
     WHERE id = $1::uuid`,
    id,
    update.status,
    update.errorMessage || null,
    update.tallyVchNo || null,
    update.createdCompany || null
  )
}
