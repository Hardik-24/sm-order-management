import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireRole(event, ['ADMIN'])
  const body = await readBody(event)

  const { group, label, value, description, isDefault, sortOrder } = body

  if (!group || !label || !value) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields: group, label, and value' })
  }

  if (!['PAYMENT_TERMS', 'PRODUCT_UOM'].includes(group)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group. Must be PAYMENT_TERMS or PRODUCT_UOM' })
  }

  const cleanValue = value.trim()
  const cleanLabel = label.trim()

  // Check for duplicate value in same group
  const existing = await prisma.masterOption.findUnique({
    where: {
      group_value: {
        group,
        value: cleanValue
      }
    }
  })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Option "${cleanValue}" already exists in ${group}` })
  }

  // If set as default, remove default from others in group
  if (isDefault) {
    await prisma.masterOption.updateMany({
      where: { group },
      data: { isDefault: false }
    })
  }

  const option = await prisma.masterOption.create({
    data: {
      group,
      label: cleanLabel,
      value: cleanValue,
      description: description ? description.trim() : null,
      isDefault: Boolean(isDefault),
      isActive: true,
      sortOrder: Number(sortOrder) || 0
    }
  })

  return option
})
