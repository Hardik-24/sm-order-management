// Shared TypeScript types for Silicon Marketing OMS

export type UserRole = 'ADMIN' | 'SALES' | 'BILLING' | 'PACKING' | 'DELIVERY'

export type OrderStatus = 'CONFIRMED' | 'PROCESSING' | 'READY' | 'DISPATCHED' | 'DELIVERED'
export type BillingState = 'PENDING' | 'IN_PROGRESS' | 'GENERATED'
export type PackingState = 'PENDING' | 'IN_PROGRESS' | 'PACKED'
export type DeliveryState = 'WAITING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED'
export type ProductUnit = 'SHEET' | 'PIECE' | 'SQFT' | 'BOX' | 'KG' | 'METER'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

export interface Category {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  createdAt: string
}

export interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  category?: Category
  unit: ProductUnit
  price: number
  stock: number
  isActive: boolean
}

export interface Customer {
  id: string
  name: string
  company: string
  phone: string
  email?: string | null
  address: string
  city: string
  state: string
  pincode: string
  gstNumber?: string | null
  paymentTerms: string
  isActive: boolean
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  packedQuantity: number
  remainingQuantity?: number
}

export interface BillingStatus {
  id: string
  orderId: string
  status: BillingState
  invoiceNumber?: string | null
  generatedById?: string | null
  generatedBy?: { name: string } | null
  generatedAt?: string | null
}

export interface PackingStatus {
  id: string
  orderId: string
  status: PackingState
  assignedToId?: string | null
  assignedTo?: { name: string } | null
}

export interface DeliveryStatus {
  id: string
  orderId: string
  status: DeliveryState
  driverName?: string | null
  dispatchDate?: string | null
  eta?: string | null
  deliveredAt?: string | null
}

export interface TimelineEntry {
  id: string
  orderId: string
  action: string
  description: string
  performedBy: { name: string }
  timestamp: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  salesPersonId: string
  customer: Customer
  salesPerson: { id: string; name: string }
  orderDate: string
  deliveryAddress: string
  paymentTerms: string
  notes?: string | null
  totalAmount: number
  overallStatus: OrderStatus
  items: OrderItem[]
  billingStatus?: BillingStatus | null
  packingStatus?: PackingStatus | null
  deliveryStatus?: DeliveryStatus | null
  timeline?: TimelineEntry[]
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  ordersToday: number
  ordersTodayChange: number
  awaitingBilling: number
  packing: number
  readyForDelivery: number
  delivered: number
  orderFlow: {
    confirmed: number
    billing: number
    packing: number
    ready: number
    delivery: number
    delivered: number
    total: number
  }
  needsAttention: NeedsAttentionItem[]
}

export interface NeedsAttentionItem {
  orderId: string
  orderNumber: string
  customerName: string
  issue: string
  issueType: 'billing_pending' | 'packing_shortage' | 'ready_for_delivery' | 'delayed'
  timeAgo: string
}
