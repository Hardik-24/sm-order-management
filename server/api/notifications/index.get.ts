import { defineEventHandler } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  try {
    const notifications = await prisma.orderTimeline.findMany({
      take: 20,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        performedBy: {
          select: {
            name: true,
            avatar: true
          }
        },
        order: {
          select: {
            orderNumber: true
          }
        }
      }
    })

    return {
      notifications
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch notifications: ' + error.message
    })
  }
})
