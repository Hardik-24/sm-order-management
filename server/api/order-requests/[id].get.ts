import { defineEventHandler, createError } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, message: 'Request ID is required' })
  }

  const orderRequest = await prisma.orderRequest.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              price: true,
              stock: true,
              unit: true,
              hsnCode: true,
              taxRate: true
            }
          }
        }
      },
      convertedOrder: {
        select: {
          id: true,
          orderNumber: true,
          overallStatus: true,
          totalAmount: true,
          createdAt: true
        }
      },
      confirmedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  if (!orderRequest) {
    throw createError({ statusCode: 404, message: 'Order request not found' })
  }

  // Check if this phone or company matches an existing customer
  const matchedCustomer = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone: orderRequest.phone },
        orderRequest.companyName ? { company: { equals: orderRequest.companyName, mode: 'insensitive' } } : {}
      ]
    },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      address: true,
      city: true,
      paymentTerms: true
    }
  })

  return {
    request: orderRequest,
    matchedCustomer
  }
})
