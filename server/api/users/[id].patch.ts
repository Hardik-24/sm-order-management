import { requireRole } from '~~/server/utils/auth'
import { hashPassword } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const currentUser = requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing user ID' })

  const body = await readBody(event)

  // Lockout Prevention: An admin cannot demote or deactivate their own account
  if (currentUser.id === id) {
    if (body.role !== undefined && body.role !== 'ADMIN') {
      throw createError({ 
        statusCode: 400, 
        statusMessage: 'You cannot change your own role from Administrator to avoid system lockout.' 
      })
    }
    if (body.isActive === false) {
      throw createError({ 
        statusCode: 400, 
        statusMessage: 'You cannot deactivate your own account to avoid system lockout.' 
      })
    }
  }

  // Find target user to know their existing role
  const targetUser = await prisma.user.findUnique({ where: { id } })
  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const effectiveRole = body.role || targetUser.role
  let allowedPages = body.allowedPages
  let actionPermissions = body.actionPermissions
  // Lockout Prevention: Administrator role always retains full access to all modules and actions
  if (effectiveRole === 'ADMIN') {
    allowedPages = [
      'OVERVIEW', 'ORDERS', 'CREATE_ORDER', 'ORDER_REQUESTS', 'CHAT',
      'APPROVE_ORDERS', 'PACKING', 'BILLING', 'DELIVERY', 'INVENTORY',
      'CUSTOMERS', 'PRODUCTS', 'ADMIN'
    ]
    actionPermissions = {
      canEditOrders: true,
      canEditOrderStatus: true,
      canCancelOrders: true,
      canEditCustomers: true,
      canEditProducts: true,
      canDeleteQuotations: true,
    }
  }

  const data: Record<string, any> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.role !== undefined) data.role = body.role
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.email !== undefined) data.email = body.email.toLowerCase()
  if (allowedPages !== undefined) data.allowedPages = allowedPages
  if (actionPermissions !== undefined) data.actionPermissions = actionPermissions

  // Hash password with bcrypt if provided
  if (body.password) {
    data.password = await hashPassword(body.password)
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      allowedPages: true,
      actionPermissions: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return user
})
