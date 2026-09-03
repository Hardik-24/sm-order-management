import { deleteCustomerPin } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const body = event.node.req.method === 'DELETE' ? await readBody(event).catch(() => ({})) : {}

    const customerId = (query.customerId as string) || body?.customerId
    const customerName = (query.customerName as string) || body?.customerName
    const customerCompany = (query.customerCompany as string) || body?.customerCompany
    const customerKey = (query.customerKey as string) || body?.customerKey

    const keys = [
      customerId,
      customerName,
      customerCompany,
      customerKey,
    ].filter(Boolean).map(k => String(k).trim())

    if (keys.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing customer identifier to delete pin',
      })
    }

    await deleteCustomerPin(keys)

    return {
      success: true,
      message: 'Customer delivery pin deleted successfully',
    }
  } catch (err: any) {
    console.error('Failed to delete pin in pins.delete.ts:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Failed to delete customer pin',
    })
  }
})
