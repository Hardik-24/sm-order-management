import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'
import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { isNotificationEnabled } from '~~/server/utils/notificationSettings'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
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

  const notifyQuotationEdit = async (quote: any, prismaClient: typeof p) => {
    if (await isNotificationEnabled('quotations')) {
      try {
        let creatorId = quote.createdById || body.createdById
        if (!creatorId && quote.createdByName) {
          const match = await prismaClient.user.findFirst({
            where: { name: { equals: quote.createdByName, mode: 'insensitive' } },
            select: { id: true }
          })
          if (match) creatorId = match.id
        }
        if (!creatorId) creatorId = user?.id

        if (creatorId) {
          await sendPushNotification({
            title: `Quotation Updated: ${quote.quoteNumber}`,
            body: `${quote.customerName} • ₹${Number(quote.grandTotal || 0).toLocaleString('en-IN')}`,
            userId: creatorId,
            data: {
              quoteNumber: quote.quoteNumber,
              quotationId: quote.id,
              type: 'QUOTATION_UPDATED'
            }
          })
        }
      } catch (pushErr) {
        console.warn('[FCM] Quotation edit push failed:', pushErr)
      }
    }
  }

  try {
    const updated = await p.quotation.update({
      where: { id },
      data
    })
    await notifyQuotationEdit(updated, p)
    return { success: true, quotation: updated }
  } catch (err: any) {
    p = resetPrisma()
    const updated = await p.quotation.update({
      where: { id },
      data
    })
    await notifyQuotationEdit(updated, p)
    return { success: true, quotation: updated }
  }
})
