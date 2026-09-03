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

/** Generate order number: SO-YYYY-NNNN */
export function generateOrderNumber(sequenceNumber: number): string {
  const year = new Date().getFullYear()
  const num = String(sequenceNumber).padStart(4, '0')
  return `SO-${year}-${num}`
}

/** Get status badge color classes */
export function getStatusColor(status: string): string {
  if (typeof status !== 'string') return 'bg-gray-100 text-gray-600 border-gray-200'
  const colors: Record<string, string> = {
    // Overall (Raw DB values, mostly overridden by getOverallColor anyway)
    CONFIRMED: 'bg-blue-100 text-blue-700 border-blue-200',
    PROCESSING: 'bg-amber-100 text-amber-700 border-amber-200',
    READY: 'bg-[#e6f4f1] text-[#1a5c4c] border-[#1a5c4c]/30',
    DISPATCHED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    DELIVERED: 'bg-gray-100 text-gray-500 border-gray-200',
    
    // Billing
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    GENERATED: 'bg-green-100 text-green-700 border-green-200',
    ERROR: 'bg-red-100 text-red-700 border-red-200',
    ON_HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
    
    // Packing
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    NOT_STARTED: 'bg-amber-100 text-amber-700 border-amber-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    PACKED: 'bg-green-100 text-green-700 border-green-200',
    SHORTAGE: 'bg-red-100 text-red-700 border-red-200',
    ON_HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
    
    // Delivery
    WAITING: 'bg-amber-100 text-amber-700 border-amber-200',
    ASSIGNED: 'bg-blue-100 text-blue-700 border-blue-200',
    ON_HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
  }
  return colors[status] || 'bg-gray-100 text-gray-600 border-gray-200'
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

export function getDisplayStatus(order: any): string {
  if (!order) return ''
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
  if (billing === 'GENERATED' && packing === 'PACKED') return 'bg-[#e6f4f1] text-[#1a5c4c] border-[#1a5c4c]/30'
  
  // Awaiting one department: Warning/Amber indicating a bottleneck
  if (billing === 'GENERATED' && packing !== 'PACKED') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (packing === 'PACKED' && billing !== 'GENERATED') return 'bg-amber-100 text-amber-700 border-amber-200'
  
  // Brand New Order: Bright Blue to indicate fresh work to be started
  return 'bg-blue-100 text-blue-700 border-blue-200'
}
