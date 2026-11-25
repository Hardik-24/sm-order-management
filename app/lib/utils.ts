// Utility functions for Silicon Marketing OMS
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind CSS classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format currency in Indian Rupees */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format currency in Indian Rupees without rounding off, showing all decimal places present.
 * Prevents rounding 4026.75 to 4027 or 2730.51 to 2731.
 */
export function formatPriceExact(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '₹0'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '₹0'

  // Clean floating point artifacts (e.g. 491.4899999999998 -> 491.49)
  const cleanNum = Math.round(num * 10000) / 10000
  const str = String(cleanNum).trim()
  const decParts = str.split('.')
  const decimals = decParts.length > 1 ? decParts[1].length : 0
  const minDec = decimals > 0 ? Math.min(2, decimals) : 0
  const maxDec = Math.max(decimals, 2)

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec
  }).format(cleanNum)
}

/** Format date to "24 Aug 2026, 4:32 PM" */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/** Format date to "24 August 2026" */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/** Format time to "4:32 PM" */
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/** Get relative time like "1h 42m" */
export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m`

  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`

  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/** Generate order number: SO-YYMM-NNNN */
export function generateOrderNumber(sequenceNumber: number, date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const num = String(sequenceNumber).padStart(4, '0')
  return `SO-${yy}${mm}-${num}`
}

/** Get status badge color classes - Standardized 4-Semantic System:
 * ⚪ Gray (Pending / Waiting / Not Started)
 * 🔵 Blue (Active / In Progress / Assigned / Dispatched)
 * 🟠 Amber/Red (On Hold / Shortage / Blocked)
 * 🟢 Green / Teal (Done / Generated / Packed / Delivered)
 */
export function getStatusColor(status: string): string {
  if (typeof status !== 'string') return 'bg-gray-100 text-gray-600 border-gray-200'
  const colors: Record<string, string> = {
    // 🟢 DONE / COMPLETED
    GENERATED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PACKED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    READY: 'bg-[#e8eff7] text-[#1b3b5f] border-[#1b3b5f]/30',

    // 🔵 ACTIVE / IN PROGRESS
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
    DISPATCHED: 'bg-blue-50 text-blue-700 border-blue-200',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
    PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
    PARTIAL: 'bg-blue-50 text-blue-700 border-blue-200',

    // 🟠 BLOCKED / ON HOLD / WARNING / UNPAID
    ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
    HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
    UNPAID: 'bg-amber-50 text-amber-700 border-amber-200',
    SHORTAGE: 'bg-rose-50 text-rose-700 border-rose-200',
    ERROR: 'bg-rose-50 text-rose-700 border-rose-200',
    OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
    CANCELLED: 'bg-gray-200 text-gray-700 border-gray-300',

    // ⚪ WAITING / NOT STARTED / PENDING
    PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
    WAITING: 'bg-gray-100 text-gray-600 border-gray-200',
    NOT_STARTED: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return colors[status] || 'bg-gray-100 text-gray-600 border-gray-200'
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

export function getDisplayStatus(order: any): string {
  if (!order) return ''
  if (order.overallStatus === 'CANCELLED') return 'Cancelled'
  if (order.isBatchOnHold) return `Batch ${order.batchNumber || ''} On Hold`

  // Master Order with child batches: aggregate fulfillment progress
  if (order?.batches && order.batches.length > 0) {
    const totalBatches = order.batches.length
    const deliveredBatches = order.batches.filter((b: any) => b?.deliveryStatus?.status === 'DELIVERED').length
    if (deliveredBatches === totalBatches) return 'All Batches Delivered'
    if (deliveredBatches > 0) return `${deliveredBatches}/${totalBatches} Batches Delivered`

    const packedBatches = order.batches.filter((b: any) => b?.packingStatus?.status === 'PACKED').length
    if (packedBatches === totalBatches) return 'All Batches Packed'
    if (packedBatches > 0) return `${packedBatches}/${totalBatches} Batches Packed`

    return `${totalBatches} Batches In Progress`
  }

  const delivery = order.deliveryStatus?.status
  const packing = order.packingStatus?.status
  const billing = order.billingStatus?.status

  if (delivery === 'DELIVERED') return 'Delivered'
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'In Transit'
  if (billing === 'ON_HOLD' || packing === 'ON_HOLD' || delivery === 'ON_HOLD') return 'On Hold'
  if (billing === 'ERROR' || packing === 'SHORTAGE') return 'Action Required'
  if (billing === 'GENERATED' && packing === 'PACKED') return 'Ready for Dispatch'
  if (billing === 'GENERATED' && packing !== 'PACKED') return 'Awaiting Packing'
  if (packing === 'PACKED' && billing !== 'GENERATED') return 'Awaiting Billing'
  return 'Awaiting Billing & Packing'
}

export function getOverallColor(order: any): string {
  if (!order) return 'bg-gray-100 text-gray-600 border-gray-200'
  if (order.overallStatus === 'CANCELLED') return 'bg-gray-200 text-gray-700 border-gray-300'
  if (order.isBatchOnHold) return 'bg-amber-100 text-amber-900 border-amber-300'

  if (order?.batches && order.batches.length > 0) {
    const totalBatches = order.batches.length
    const deliveredBatches = order.batches.filter((b: any) => b?.deliveryStatus?.status === 'DELIVERED').length
    if (deliveredBatches === totalBatches) return 'bg-gray-100 text-gray-500 border-gray-200'
    if (deliveredBatches > 0) return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    return 'bg-amber-50 text-amber-800 border-amber-200'
  }

  const delivery = order.deliveryStatus?.status
  const packing = order.packingStatus?.status
  const billing = order.billingStatus?.status

  // Delivered: Fade it out so active orders pop
  if (delivery === 'DELIVERED') return 'bg-gray-100 text-gray-500 border-gray-200'
  
  // In Transit: Purple/Indigo indicates it's out of our hands
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  
  // Hold: Orange
  if (billing === 'ON_HOLD' || packing === 'ON_HOLD' || delivery === 'ON_HOLD') return 'bg-orange-100 text-orange-700 border-orange-200'

  // Blockers: Bright Red to scream for attention
  if (billing === 'ERROR' || packing === 'SHORTAGE') return 'bg-red-100 text-red-700 border-red-200'
  
  // Ready: Use the brand's mint/teal to indicate a 'Greenlight' for the delivery driver
  if (billing === 'GENERATED' && packing === 'PACKED') return 'bg-[#e8eff7] text-[#1b3b5f] border-[#1b3b5f]/30'
  
  // Awaiting one department: Warning/Amber indicating a bottleneck
  if (billing === 'GENERATED' && packing !== 'PACKED') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (packing === 'PACKED' && billing !== 'GENERATED') return 'bg-amber-100 text-amber-700 border-amber-200'
  
  // Brand New Order: Bright Blue to indicate fresh work to be started
  return 'bg-blue-100 text-blue-700 border-blue-200'
}

/** Extract and format primary contact number and city: "Phone • City" */
export function formatCustomerContact(customer?: any): string {
  if (!customer) return '—'

  // Extract clean primary phone
  let cleanPhone = ''
  const rawPhone = customer.phone || customer.alternatePhone
  if (rawPhone && typeof rawPhone === 'string') {
    const parts = rawPhone.split(/[,;\/\n]+/).map((p: string) => p.trim()).filter(Boolean)
    for (const part of parts) {
      const digitsOnly = part.replace(/\D/g, '')
      // Reject placeholder zeroes (like 0000000000) or strings with fewer than 5 digits
      if (digitsOnly.length >= 5 && !/^0+$/.test(digitsOnly)) {
        cleanPhone = part
        break
      }
    }
  }

  // Extract city
  const city = customer.city?.trim() || customer.addresses?.[0]?.city?.trim() || ''

  return [cleanPhone, city].filter(Boolean).join(' • ') || '—'
}

/** Format a Date object to "YYYY-MM-DD" local date string */
export function formatDateYMD(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Return today's date formatted as "YYYY-MM-DD" in local time */
export function getTodayYMD(): string {
  return formatDateYMD(new Date())
}
