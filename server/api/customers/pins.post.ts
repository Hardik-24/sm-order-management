import { saveCustomerPin, DestinationPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const { customerKey, customerId, customerName, customerCompany, deliveryAddress, lat, lng, landmark, areaName } = body || {}

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

    const keys = [
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
