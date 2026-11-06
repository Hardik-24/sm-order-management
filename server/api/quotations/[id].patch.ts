import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Quotation ID required' })
  }

  const body = await readBody(event)
  let p = getPrisma()

  const data: Record<string, any> = {}
  if (body.signature !== undefined) {
    data.signature = body.signature ? String(body.signature) : null
  }
  if (body.customerName !== undefined) {
    data.customerName = String(body.customerName).trim()
  }
  if (body.customerPlace !== undefined) {
    data.customerPlace = body.customerPlace ? String(body.customerPlace).trim() : null
  }
  if (body.customerPhone !== undefined) {
    data.customerPhone = body.customerPhone ? String(body.customerPhone).trim() : null
  }
  if (body.validityDays !== undefined) {
    data.validityDays = Number(body.validityDays) || 7
  }
  if (body.taxMode !== undefined) {
    data.taxMode = body.taxMode
  }
  if (body.quoteNotes !== undefined) {
    data.quoteNotes = body.quoteNotes ? String(body.quoteNotes).trim() : null
  }
  if (body.items !== undefined && Array.isArray(body.items)) {
    data.items = body.items
    data.totalItems = body.items.length
  }
  if (body.totalMrp !== undefined) {
    data.totalMrp = Number(body.totalMrp) || 0
  }
  if (body.subtotal !== undefined) {
    data.subtotal = Number(body.subtotal) || 0
  }
  if (body.discountAmount !== undefined) {
    data.discountAmount = Number(body.discountAmount) || 0
  }
  if (body.gstAmount !== undefined) {
    data.gstAmount = Number(body.gstAmount) || 0
  }
  if (body.grandTotal !== undefined) {
    data.grandTotal = Math.round(Number(body.grandTotal) || 0)
  }
  if (body.createdById !== undefined) {
    data.createdById = body.createdById || null
  }
  if (body.createdByName !== undefined) {
    data.createdByName = body.createdByName
  }
  if (body.createdByRole !== undefined) {
    data.createdByRole = body.createdByRole
  }

  try {
    const updated = await p.quotation.update({
      where: { id },
      data
    })
    return { success: true, quotation: updated }
  } catch (err: any) {
    p = resetPrisma()
    const updated = await p.quotation.update({
      where: { id },
      data
    })
    return { success: true, quotation: updated }
  }
})
