import { defineEventHandler } from 'h3'
import { prisma } from '~~/server/utils/prisma'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  try {
    const isAdmin = user.role === 'ADMIN'

    const where: any = isAdmin
      ? {}
      : {
          OR: [
            // Timeline event performed by this user
            { performedById: user.id },
            // Order created by or assigned to this user (sales person)
            {
              order: {
                salesPersonId: user.id
              }
            },
            // Order assigned to this user for warehouse packing
            {
              order: {
                packingStatus: {
                  assignedToId: user.id
                }
              }
            },
            // Order billing handled by this user
            {
              order: {
                billingStatus: {
                  generatedById: user.id
                }
              }
            },
            // Order assigned to this user for delivery via trip route
            {
              order: {
                tripRoute: {
                  driverId: user.id
                }
              }
            },
            // Order assigned to this user for delivery via multi-stop trip
            {
              order: {
                tripStops: {
                  some: {
                    trip: {
                      driverId: user.id
                    }
                  }
                }
              }
            },
            // Order approved or cancelled by this user
            {
              order: {
                approvedById: user.id
              }
            },
            {
              order: {
                cancelledById: user.id
              }
            },
            // Customer of this order is managed by this user
            {
              order: {
                customer: {
                  customerManagerId: user.id
                }
              }
            }
          ]
        }

    const notifications = await prisma.orderTimeline.findMany({
      where,
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
