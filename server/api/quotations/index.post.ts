import { defineEventHandler, readBody } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  if (!body?.customerName || !body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return {
      success: false,
      error: 'Customer name and at least one item are required to generate a quotation'
    }
  }

  // Generate unique Quote ID if not provided
  const now = new Date()
  const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const quoteNumber = body.quoteNumber || `QT-${datePrefix}-${randomSuffix}`

  let p = getPrisma()

  const saveQuotation = async (prismaClient: typeof p) => {
    return await prismaClient.quotation.create({
      data: {
        quoteNumber,
        customerName: String(body.customerName).trim(),
        customerPlace: body.customerPlace ? String(body.customerPlace).trim() : null,
        customerPhone: body.customerPhone ? String(body.customerPhone).trim() : null,
        validityDays: Number(body.validityDays) || 7,
        taxMode: body.taxMode || 'EXTRA',
        quoteNotes: body.quoteNotes ? String(body.quoteNotes).trim() : null,
        items: body.items,
        totalItems: body.items.length,
        totalMrp: Number(body.totalMrp) || 0,
        subtotal: Number(body.subtotal) || 0,
        discountAmount: Number(body.discountAmount) || 0,
        gstAmount: Number(body.gstAmount) || 0,
        grandTotal: Number(body.grandTotal) || 0,
        createdById: user?.id || null,
        createdByName: user?.name || body.createdByName || 'Sales Staff',
        createdByRole: user?.role || 'SALES',
        signature: body.signature ? String(body.signature) : null
      }
    })
  }

  try {
    const saved = await saveQuotation(p)
    return {
      success: true,
      quotation: saved
    }
  } catch (err: any) {
    console.warn('Failed saving quotation, resetting connection and retrying...', err?.message)
    p = resetPrisma()
    const saved = await saveQuotation(p)
    return {
      success: true,
      quotation: saved
    }
  }
})
