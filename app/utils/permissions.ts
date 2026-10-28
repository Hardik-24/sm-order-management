import type { UserRole, UserActionPermissions } from '~/types'

export interface AppPageDef {
  key: string
  path: string
  label: string
  category: 'Dashboard' | 'Operations' | 'Data' | 'Administration'
  description: string
}

export const APP_PAGES: AppPageDef[] = [
  // Dashboard
  { key: 'OVERVIEW', path: '/dashboard', label: 'Home', category: 'Dashboard', description: 'Main metrics, KPIs, and daily business pulse' },
  { key: 'ANALYTICS', path: '/dashboard/analytics', label: 'Analytics', category: 'Dashboard', description: 'Business intelligence, stock valuation, and operational statistics' },
  { key: 'ORDERS', path: '/dashboard/orders', label: 'Orders List', category: 'Dashboard', description: 'View, filter, and track all sales orders' },
  { key: 'CREATE_ORDER', path: '/dashboard/orders/create', label: 'Create Order', category: 'Dashboard', description: 'Create and submit new orders' },
  { key: 'ORDER_REQUESTS', path: '/dashboard/order-requests', label: 'Order Requests', category: 'Dashboard', description: 'Incoming customer orders and inquiries' },
  { key: 'CHAT', path: '/dashboard/chat', label: 'Team Chat', category: 'Dashboard', description: 'Internal team communication' },

  // Operations
  { key: 'QUOTATIONS', path: '/dashboard/quotations', label: 'Quotation Builder', category: 'Operations', description: 'Build and export live price quotes' },
  { key: 'APPROVE_ORDERS', path: '/dashboard/approve-orders', label: 'Approve Orders', category: 'Operations', description: 'Review and approve pending orders' },
  { key: 'PACKING', path: '/dashboard/packing', label: 'Packing Desk', category: 'Operations', description: 'Warehouse packing and order fulfillment' },
  { key: 'BILLING', path: '/dashboard/billing', label: 'Billing & Invoicing', category: 'Operations', description: 'Generate invoices and tax splits' },
  { key: 'DELIVERY', path: '/dashboard/delivery', label: 'Delivery & Dispatch', category: 'Operations', description: 'Trip planning and driver dispatch' },
  { key: 'INVENTORY', path: '/dashboard/inventory', label: 'Inventory', category: 'Operations', description: 'Stock levels and product availability' },

  // Data
  { key: 'CUSTOMERS', path: '/dashboard/customers', label: 'Customers', category: 'Data', description: 'Customer accounts and details' },
  { key: 'PRODUCTS', path: '/dashboard/products', label: 'Products', category: 'Data', description: 'Product catalog, pricing, and SKUs' },
  { key: 'VOUCHERS', path: '/dashboard/vouchers', label: 'BUSY Vouchers', category: 'Data', description: 'Search and inspect all historical and live BUSY sales invoices' },

  // Administration
  { key: 'ADMIN', path: '/dashboard/admin', label: 'Administration', category: 'Administration', description: 'Manage users, roles, and permissions' },
]

export const DEFAULT_ROLE_PAGES: Record<UserRole, string[]> = {
  ADMIN: [
    'OVERVIEW', 'ANALYTICS', 'ORDERS', 'CREATE_ORDER', 'ORDER_REQUESTS', 'CHAT',
    'QUOTATIONS', 'APPROVE_ORDERS', 'PACKING', 'BILLING', 'DELIVERY', 'INVENTORY',
    'CUSTOMERS', 'PRODUCTS', 'VOUCHERS', 'ADMIN'
  ],
  SALES: [
    'OVERVIEW', 'ANALYTICS', 'ORDERS', 'CREATE_ORDER', 'ORDER_REQUESTS', 'CHAT',
    'QUOTATIONS', 'APPROVE_ORDERS', 'CUSTOMERS', 'PRODUCTS', 'VOUCHERS', 'INVENTORY'
  ],
  BILLING: [
    'OVERVIEW', 'ORDERS', 'QUOTATIONS', 'BILLING', 'CUSTOMERS', 'PRODUCTS', 'VOUCHERS', 'CHAT'
  ],
  PACKING: [
    'OVERVIEW', 'ORDERS', 'PACKING', 'INVENTORY', 'CHAT'
  ],
  DELIVERY: [
    'OVERVIEW', 'ORDERS', 'DELIVERY', 'CHAT'
  ],
}

/**
 * Maps a URL route pathname to a page key (e.g. '/dashboard/orders/create' -> 'CREATE_ORDER')
 */
export function getPageKeyFromPath(path: string): string | null {
  const cleanPath = (path || '').split('?')[0].replace(/\/+$/, '') || '/dashboard'

  if (cleanPath === '/dashboard') return 'OVERVIEW'
  if (cleanPath.startsWith('/dashboard/analytics')) return 'ANALYTICS'
  if (cleanPath === '/dashboard/orders/create') return 'CREATE_ORDER'
  if (cleanPath.startsWith('/dashboard/orders')) return 'ORDERS'
  if (cleanPath.startsWith('/dashboard/order-requests')) return 'ORDER_REQUESTS'
  if (cleanPath.startsWith('/dashboard/quotations')) return 'QUOTATIONS'
  if (cleanPath.startsWith('/dashboard/approve-orders')) return 'APPROVE_ORDERS'
  if (cleanPath.startsWith('/dashboard/packing')) return 'PACKING'
  if (cleanPath.startsWith('/dashboard/billing')) return 'BILLING'
  if (cleanPath.startsWith('/dashboard/delivery')) return 'DELIVERY'
  if (cleanPath.startsWith('/dashboard/inventory')) return 'INVENTORY'
  if (cleanPath.startsWith('/dashboard/customers')) return 'CUSTOMERS'
  if (cleanPath.startsWith('/dashboard/products')) return 'PRODUCTS'
  if (cleanPath.startsWith('/dashboard/vouchers')) return 'VOUCHERS'
  if (cleanPath.startsWith('/dashboard/chat')) return 'CHAT'
  if (cleanPath.startsWith('/dashboard/admin')) return 'ADMIN'

  return null
}

/**
 * Gets effective allowed page keys for a user object
 */
export function getEffectiveAllowedPages(user: { role?: string; allowedPages?: string[] | null } | null): string[] {
  if (!user) return []
  
  // ADMIN role has full access to all pages
  if (user.role === 'ADMIN') {
    return APP_PAGES.map(p => p.key)
  }

  // If user has explicit allowedPages configured (array with items or explicit 'NONE')
  if (Array.isArray(user.allowedPages)) {
    if (user.allowedPages.length === 0) {
      // If empty array, fallback to default role pages
      const roleKey = (user.role as UserRole) || 'SALES'
      return DEFAULT_ROLE_PAGES[roleKey] || []
    }
    // Filter out 'NONE' placeholder if present
    return user.allowedPages.filter(k => k !== 'NONE')
  }

  // Default fallback based on role
  const roleKey = (user.role as UserRole) || 'SALES'
  return DEFAULT_ROLE_PAGES[roleKey] || []
}

/**
 * Checks whether a user can access a specific page key
 */
export function userCanAccessPage(user: { role?: string; allowedPages?: string[] | null } | null, pageKey: string): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true

  // Admin section is strictly reserved for ADMIN role
  if (pageKey === 'ADMIN') return false

  const allowed = getEffectiveAllowedPages(user)
  return allowed.includes(pageKey)
}

/**
 * Checks whether a user can access a specific route pathname
 */
export function userCanAccessRoute(user: { role?: string; allowedPages?: string[] | null } | null, path: string): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true

  const pageKey = getPageKeyFromPath(path)
  // If the path doesn't map to any restricted app page, allow it
  if (!pageKey) return true

  return userCanAccessPage(user, pageKey)
}

export const DEFAULT_ROLE_ACTION_PERMISSIONS: Record<UserRole, UserActionPermissions> = {
  ADMIN: {
    canEditOrders: true,
    canEditOrderStatus: true,
    canCancelOrders: true,
    canEditCustomers: true,
    canEditProducts: true,
    canDeleteQuotations: true,
  },
  SALES: {
    canEditOrders: true,
    canEditOrderStatus: false,
    canCancelOrders: false,
    canEditCustomers: true,
    canEditProducts: false,
    canDeleteQuotations: false,
  },
  BILLING: {
    canEditOrders: false,
    canEditOrderStatus: false,
    canCancelOrders: false,
    canEditCustomers: false,
    canEditProducts: false,
    canDeleteQuotations: false,
  },
  PACKING: {
    canEditOrders: false,
    canEditOrderStatus: false,
    canCancelOrders: false,
    canEditCustomers: false,
    canEditProducts: false,
    canDeleteQuotations: false,
  },
  DELIVERY: {
    canEditOrders: false,
    canEditOrderStatus: false,
    canCancelOrders: false,
    canEditCustomers: false,
    canEditProducts: false,
    canDeleteQuotations: false,
  },
}

/**
 * Gets effective action permissions for a user
 */
export function getEffectiveActionPermissions(
  user: { role?: string; actionPermissions?: Partial<UserActionPermissions> | null } | null
): UserActionPermissions {
  if (!user) {
    return {
      canEditOrders: false,
      canEditOrderStatus: false,
      canCancelOrders: false,
      canEditCustomers: false,
      canEditProducts: false,
      canDeleteQuotations: false,
    }
  }

  // Admin role always has all action permissions
  if (user.role === 'ADMIN') {
    return {
      canEditOrders: true,
      canEditOrderStatus: true,
      canCancelOrders: true,
      canEditCustomers: true,
      canEditProducts: true,
      canDeleteQuotations: true,
    }
  }

  const roleKey = (user.role as UserRole) || 'SALES'
  const defaults = DEFAULT_ROLE_ACTION_PERMISSIONS[roleKey] || {
    canEditOrders: false,
    canEditOrderStatus: false,
    canCancelOrders: false,
    canEditCustomers: false,
    canEditProducts: false,
    canDeleteQuotations: false,
  }

  const userPerms = (user.actionPermissions && typeof user.actionPermissions === 'object')
    ? (user.actionPermissions as any)
    : {}

  return {
    canEditOrders: userPerms.canEditOrders !== undefined ? Boolean(userPerms.canEditOrders) : defaults.canEditOrders,
    canEditOrderStatus: userPerms.canEditOrderStatus !== undefined ? Boolean(userPerms.canEditOrderStatus) : defaults.canEditOrderStatus,
    canCancelOrders: userPerms.canCancelOrders !== undefined ? Boolean(userPerms.canCancelOrders) : defaults.canCancelOrders,
    canEditCustomers: userPerms.canEditCustomers !== undefined ? Boolean(userPerms.canEditCustomers) : defaults.canEditCustomers,
    canEditProducts: userPerms.canEditProducts !== undefined ? Boolean(userPerms.canEditProducts) : defaults.canEditProducts,
    canDeleteQuotations: userPerms.canDeleteQuotations !== undefined ? Boolean(userPerms.canDeleteQuotations) : defaults.canDeleteQuotations,
  }
}

