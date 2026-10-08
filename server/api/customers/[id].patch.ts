import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ADMIN', 'SALES'])
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, message: 'Missing customer ID' })

  const existing = await prisma.customer.findUnique({
    where: { id },
    include: { addresses: true }
  })
  if (!existing) throw createError({ statusCode: 404, message: 'Customer not found' })

  const body = await readBody(event)

  // 1. Customer Code uniqueness check (Admin only permission to change)
  if (body.customerCode !== undefined && body.customerCode !== existing.customerCode) {
    if (user.role !== 'ADMIN') {
      throw createError({ statusCode: 403, message: 'Only Administrator can modify Customer ID / Code.' })
    }
    const cleanCode = body.customerCode?.trim()
    if (cleanCode) {
      const codeClash = await prisma.customer.findFirst({
        where: { customerCode: cleanCode, id: { not: id } }
      })
      if (codeClash) {
        throw createError({ statusCode: 400, message: `Customer Code "${cleanCode}" is already taken by ${codeClash.name}.` })
      }
    }
  }

  // 2. GSTIN Validation & Anti-duplication check
  if (body.gstNumber !== undefined && body.gstNumber !== existing.gstNumber) {
    const gst = body.gstNumber?.trim().toUpperCase() || null
    if (gst) {
      if (gst.length !== 15) {
        throw createError({ statusCode: 400, message: 'GST Number must be exactly 15 characters long.' })
      }
      const existingGst = await prisma.customer.findFirst({
        where: { gstNumber: gst, id: { not: id }, isActive: true }
      })
      if (existingGst) {
        throw createError({ statusCode: 400, message: `GSTIN "${gst}" is already registered to ${existingGst.name}.` })
      }
    }
    body.gstNumber = gst
  }

  // 3. Phone Anti-duplication check
  if (body.phone !== undefined && body.phone !== existing.phone) {
    const phone = body.phone?.trim()
    if (phone && phone !== 'N/A') {
      const existingPhone = await prisma.customer.findFirst({
        where: { phone, id: { not: id }, isActive: true }
      })
      if (existingPhone) {
        throw createError({ statusCode: 400, message: `Phone number "${phone}" is already registered to ${existingPhone.name}.` })
      }
    }
    body.phone = phone
  }

  // 4. Update Addresses if provided
  if (Array.isArray(body.addresses)) {
    // Delete existing addresses and recreate, or update
    await prisma.customerAddress.deleteMany({
      where: { customerId: id }
    })
    if (body.addresses.length > 0) {
      await prisma.customerAddress.createMany({
        data: body.addresses.map((a: any, idx: number) => ({
          customerId: id,
          label: a.label?.trim() || `Address ${idx + 1}`,
          addressLine: a.addressLine?.trim() || a.address?.trim() || '',
          city: a.city?.trim() || null,
          state: a.state?.trim() || 'Karnataka',
          pincode: a.pincode?.trim() || null,
          landmark: a.landmark?.trim() || null,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
          isDefault: a.isDefault ?? (idx === 0),
        }))
      })
    }
  }

  // Clean data payload for main customer update
  const updateData: any = {
    name: body.name?.trim(),
    company: body.company?.trim(),
    alias: body.alias !== undefined ? (body.alias?.trim() || null) : undefined,
    phone: body.phone !== undefined ? body.phone : undefined,
    alternatePhone: body.alternatePhone !== undefined ? (body.alternatePhone?.trim() || null) : undefined,
    email: body.email !== undefined ? (body.email?.trim() || null) : undefined,
    address: body.address !== undefined ? (body.address?.trim() || null) : undefined,
    city: body.city !== undefined ? (body.city?.trim() || null) : undefined,
    state: body.state !== undefined ? (body.state?.trim() || 'Karnataka') : undefined,
    pincode: body.pincode !== undefined ? (body.pincode?.trim() || null) : undefined,
    gstNumber: body.gstNumber !== undefined ? body.gstNumber : undefined,
    paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms?.trim() : undefined,
    latitude: body.latitude !== undefined ? body.latitude : undefined,
    longitude: body.longitude !== undefined ? body.longitude : undefined,
    landmark: body.landmark !== undefined ? (body.landmark?.trim() || null) : undefined,
    customerManagerId: body.customerManagerId !== undefined ? (body.customerManagerId || null) : undefined,
    privilegeTier: body.privilegeTier !== undefined ? body.privilegeTier : undefined,
    isPriorityClient: body.isPriorityClient !== undefined ? Boolean(body.isPriorityClient) : undefined,
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
  }

  if (user.role === 'ADMIN' && body.customerCode !== undefined) {
    updateData.customerCode = body.customerCode?.trim() || null
  }

  // Remove undefined keys
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key])

  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: updateData,
    include: {
      customerManager: {
        select: { id: true, name: true, email: true }
      },
      addresses: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  return updatedCustomer
})
