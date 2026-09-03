import { loadCustomerPins } from '~~/server/utils/customerPins'

export default defineEventHandler(async (event) => {
  const pins = loadCustomerPins()
  return {
    pins,
  }
})
