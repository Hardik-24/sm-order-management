import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'SALES'])
  const body = await readBody(event)

  if (!body.name || !body.company) {
    throw createError({ statusCode: 400, message: 'Customer Name and Company are required.' })
  }

  // 1. Auto-generate or validate sequential customer code (e.g. CUST-1001)
  let code = body.customerCode?.trim()
  if (code) {
    const existingCode = await prisma.customer.findFirst({
      where: { customerCode: code }
    })
    if (existingCode) {
      throw createError({ statusCode: 400, message: `Customer Code "${code}" is already in use by ${existingCode.name}.` })
    }
  } else {
    const count = await prisma.customer.count()
    let candidateNum = 1000 + count + 1
    code = `CUST-${candidateNum}`
    while (await prisma.customer.findFirst({ where: { customerCode: code } })) {
      candidateNum++
      code = `CUST-${candidateNum}`
    }
  }

  // 2. GSTIN Validation & Anti-duplication check
  let gst = body.gstNumber ? body.gstNumber.trim().toUpperCase() : null
  if (gst) {
    if (gst.length !== 15) {
      throw createError({ statusCode: 400, message: 'GST Number must be exactly 15 characters long.' })
    }
    const existingGst = await prisma.customer.findFirst({
      where: { gstNumber: gst, isActive: true }
    })
    if (existingGst) {
      throw createError({ statusCode: 400, message: `A customer with GSTIN "${gst}" already exists (${existingGst.name}).` })
    }
  }

  // 3. Primary Phone Anti-duplication check
  const phone = body.phone?.trim()
  if (phone && phone !== 'N/A') {
    const existingPhone = await prisma.customer.findFirst({
      where: { phone, isActive: true }
    })
    if (existingPhone) {
      throw createError({ statusCode: 400, message: `A customer with phone "${phone}" already exists (${existingPhone.name}).` })
    }
  }

  // 4. Build Customer Addresses array
  const addressesToCreate: any[] = []
  if (Array.isArray(body.addresses) && body.addresses.length > 0) {
    body.addresses.forEach((addr: any, idx: number) => {
      const line = addr.addressLine?.trim() || addr.address?.trim()
      if (line) {
        addressesToCreate.push({
          label: addr.label?.trim() || `Address ${idx + 1}`,
          addressLine: line,
          city: addr.city?.trim() || body.city || null,
          state: addr.state?.trim() || body.state || 'Karnataka',
          pincode: addr.pincode?.trim() || body.pincode || null,
          landmark: addr.landmark?.trim() || null,
          latitude: addr.latitude ?? null,
          longitude: addr.longitude ?? null,
          isDefault: addr.isDefault ?? (idx === 0),
        })
      }
    })
  }

  // If no addresses in array, check fallback single address field
  if (addressesToCreate.length === 0 && body.address?.trim()) {
    addressesToCreate.push({
      label: 'Address 1 (Main Showroom / Billing)',
      addressLine: body.address.trim(),
      city: body.city?.trim() || null,
      state: body.state?.trim() || 'Karnataka',
      pincode: body.pincode?.trim() || null,
      landmark: body.landmark?.trim() || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      isDefault: true,
    })
  }

  // 5. Create Customer with nested addresses
  const customer = await prisma.customer.create({
    data: {
      customerCode: code,
      name: body.name.trim(),
      company: body.company.trim(),
      alias: body.alias?.trim() || null,
      phone: phone || 'N/A',
      alternatePhone: body.alternatePhone?.trim() || null,
      email: body.email?.trim() || null,
      address: body.address?.trim() || (addressesToCreate[0]?.addressLine ?? null),
      city: body.city?.trim() || (addressesToCreate[0]?.city ?? null),
      state: body.state?.trim() || 'Karnataka',
      pincode: body.pincode?.trim() || (addressesToCreate[0]?.pincode ?? null),
      gstNumber: gst,
      paymentTerms: body.paymentTerms?.trim() || '30 Days',
      latitude: body.latitude ?? (addressesToCreate[0]?.latitude ?? null),
      longitude: body.longitude ?? (addressesToCreate[0]?.longitude ?? null),
      landmark: body.landmark?.trim() || (addressesToCreate[0]?.landmark ?? null),
      customerManagerId: body.customerManagerId || null,
      privilegeTier: body.privilegeTier || 'BRONZE',
      isPriorityClient: Boolean(body.isPriorityClient),
      addresses: addressesToCreate.length > 0 ? {
        create: addressesToCreate
      } : undefined
    },
    include: {
      customerManager: {
        select: { id: true, name: true, email: true }
      },
      addresses: true
    }
  })

  return customer
})
