import { defineEventHandler } from 'h3'
import { getPrisma, resetPrisma } from '~~/server/utils/prisma'
import { requireActionPermission } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Allow ADMIN or any user granted the canDeleteQuotations action permission
  await requireActionPermission(event, 'canDeleteQuotations')

  const id = event.context.params?.id
  if (!id) {
    return { success: false, error: 'Quotation ID required' }
  }

  let p = getPrisma()

  try {
    await p.quotation.delete({
      where: { id }
    })
    return { success: true }
  } catch (err: any) {
    p = resetPrisma()
    await p.quotation.delete({
      where: { id }
    })
    return { success: true }
  }
})
