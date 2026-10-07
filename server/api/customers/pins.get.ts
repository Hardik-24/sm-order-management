import { loadCustomerPins } from '~~/server/utils/customerPins'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const pins = loadCustomerPins()
  return {
    pins,
  }
})
