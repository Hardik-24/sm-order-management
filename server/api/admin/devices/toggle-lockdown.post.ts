import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const body = await readBody(event)

  const mode = body?.mode === 'OFF' ? 'OFF' : 'ENFORCING'

  const setting = await prisma.systemSetting.upsert({
    where: { key: 'hardware_device_lockdown' },
    create: {
      key: 'hardware_device_lockdown',
      value: mode
    },
    update: {
      value: mode
    }
  })

  return {
    success: true,
    lockdownMode: setting.value
  }
})
