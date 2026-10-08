import { saveCustomerPin, DestinationPin } from '~~/server/utils/customerPins'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const body = await readBody(event)

    const { customerKey, customerId, addressId, customerName, customerCompany, deliveryAddress, lat, lng, landmark, areaName } = body || {}

    const numericLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat)
    const numericLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng)

    if (isNaN(numericLat) || isNaN(numericLng)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid latitude or longitude coordinates',
      })
    }

    const pin: DestinationPin = {
      lat: numericLat,
      lng: numericLng,
      landmark: landmark || undefined,
      areaName: areaName || undefined,
    }

    // If specific addressId is provided, persist pin to CustomerAddress
    if (addressId) {
      try {
        await prisma.customerAddress.update({
          where: { id: addressId },
          data: {
            latitude: numericLat,
            longitude: numericLng,
            landmark: landmark || null,
          }
        })
      } catch (addrErr) {
        console.warn('Could not update customer address with pin:', addrErr)
      }
    }

    // Sync to customer root if no addressId or if address is default
    if (customerId) {
      try {
        const addr = addressId ? await prisma.customerAddress.findUnique({ where: { id: addressId } }) : null
        if (!addr || addr.isDefault) {
          await prisma.customer.update({
            where: { id: customerId },
            data: {
              latitude: numericLat,
              longitude: numericLng,
              landmark: landmark || null,
            }
          })
        }
      } catch (cErr) {
        console.warn('Could not sync customer pin:', cErr)
      }
    }

    const keys = [
      addressId,
      customerId,
      customerName,
      customerCompany,
      customerKey,
      deliveryAddress,
    ].filter(Boolean).map(k => String(k).trim())

    if (keys.length === 0) {
      keys.push('default')
    }

    const saved = await saveCustomerPin(keys, pin)

    return {
      success: true,
      pin: saved,
    }
  } catch (err: any) {
    console.error('Failed to save pin in pins.post.ts:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Failed to save customer pin',
    })
  }
})
