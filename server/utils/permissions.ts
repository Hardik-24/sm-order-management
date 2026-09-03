// Role-based permission helpers
import type { UserRole } from '~/types'

export function canCreateOrder(role: UserRole): boolean {
  return ['ADMIN', 'SALES'].includes(role)
}

export function canEditOrder(role: UserRole): boolean {
  return ['ADMIN', 'SALES'].includes(role)
}

export function canUpdateBilling(role: UserRole): boolean {
  return ['ADMIN', 'BILLING'].includes(role)
}

export function canUpdatePacking(role: UserRole): boolean {
  return ['ADMIN', 'PACKING'].includes(role)
}

export function canUpdateDelivery(role: UserRole): boolean {
  return ['ADMIN', 'DELIVERY'].includes(role)
}

export function canManageProducts(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canManageCategories(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canManageCustomers(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'ADMIN'
}
