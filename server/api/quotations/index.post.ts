import { defineEventHandler, readBody, createError } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'
import { sendPushNotification } from '~~/server/utils/firebaseAdmin'
import { isNotificationEnabled } from '~~/server/utils/notificationSettings'
import { generateSequentialQuoteNumber } from '~~/server/utils/seriesNumber'
import { broadcastRealtimeEvent } from '~~/server/utils/realtimeBroadcast'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody(event)

  if (!body?.customerName || !body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return {
      success: false,
      error: 'Customer name and at least one item are required to generate a quotation'
    }
  }

  let p = getPrisma()
  let saved: any = null
  let attempts = 0

  while (!saved && attempts < 10) {
    attempts++
    const { quoteNumber } = await generateSequentialQuoteNumber(p, new Date(), attempts)

    try {
      saved = await p.quotation.create({
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
          grandTotal: Math.round(Number(body.grandTotal) || 0),
          createdById: user?.id || body.createdById || null,
          createdByName: user?.name || body.createdByName || 'Sales Staff',
          createdByRole: user?.role || body.createdByRole || 'SALES',
          requestedById: body.requestedById || user?.id || null,
          requestedByName: body.requestedByName || user?.name || 'Sales Staff',
          requestedByRole: body.requestedByRole || user?.role || 'SALES',
          signature: body.signature ? String(body.signature) : null
        }
      })
    } catch (createErr: any) {
      if (createErr.code === 'P2002' && attempts < 10) {
        continue
      }
      p = resetPrisma()
      throw createErr
    }
  }

  if (!saved) {
    throw createError({ statusCode: 500, message: 'Failed to assign a unique quotation number' })
  }

  try {

    // Non-blocking Push Notification dispatch to admins and quotation creator
    if (await isNotificationEnabled('quotations')) {
      try {
        const creatorId = saved.createdById || body.createdById || user?.id
        await sendPushNotification({
          title: `New Quotation: ${saved.quoteNumber}`,
          body: `${saved.customerName} • ₹${Number(saved.grandTotal || 0).toLocaleString('en-IN')}`,
          userId: creatorId || undefined,
          data: {
            quoteNumber: saved.quoteNumber,
            quotationId: saved.id,
            type: 'QUOTATION_CREATED'
          }
        })
      } catch (pushErr) {
        console.warn('[FCM] Quotation push failed:', pushErr)
      }
    }

    // Instant real-time broadcast across all devices
    await broadcastRealtimeEvent('sm_orders_realtime', 'QUOTATION_CHANGE', {
      type: 'QUOTATION_CHANGE',
      action: 'QUOTATION_CREATED',
      quotation: saved
    })

    return {
      success: true,
      quotation: saved
    }
  } catch (err: any) {
    console.warn('Failed saving quotation, resetting connection and retrying...', err?.message)
    p = resetPrisma()
    const saved = await saveQuotation(p)

    // Non-blocking Push Notification dispatch to admins and quotation creator
    if (await isNotificationEnabled('quotations')) {
      try {
        const creatorId = saved.createdById || body.createdById || user?.id
        await sendPushNotification({
          title: `New Quotation: ${saved.quoteNumber}`,
          body: `${saved.customerName} • ₹${Number(saved.grandTotal || 0).toLocaleString('en-IN')}`,
          userId: creatorId || undefined,
          data: {
            quoteNumber: saved.quoteNumber,
            quotationId: saved.id,
            type: 'QUOTATION_CREATED'
          }
        })
      } catch (pushErr) {
        console.warn('[FCM] Quotation push failed:', pushErr)
      }
    }

    // Instant real-time broadcast across all devices
    await broadcastRealtimeEvent('sm_orders_realtime', 'QUOTATION_CHANGE', {
      type: 'QUOTATION_CHANGE',
      action: 'QUOTATION_CREATED',
      quotation: saved
    })

    return {
      success: true,
      quotation: saved
    }
  }
})
