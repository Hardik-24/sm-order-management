// Role-based permission helpers
import type { UserRole } from '~/types'

export function canCreateOrder(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR', 'SALES'].includes(role)
}

export function canEditOrder(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR', 'SALES'].includes(role)
}

export function canUpdateBilling(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR', 'BILLING'].includes(role)
}

export function canUpdatePacking(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR', 'PACKING'].includes(role)
}

export function canUpdateDelivery(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR', 'DELIVERY'].includes(role)
}

export function canManageProducts(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR'].includes(role)
}

export function canManageCategories(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR'].includes(role)
}

export function canManageCustomers(role: UserRole): boolean {
  return ['ADMIN', 'SUPERVISOR'].includes(role)
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'ADMIN'
}
