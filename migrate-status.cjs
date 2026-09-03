const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  await prisma.order.updateMany({
    where: { overallStatus: 'PROCESSING' },
    data: { overallStatus: 'READY' }
  })
  await prisma.order.updateMany({
    where: { overallStatus: 'CONFIRMED' },
    data: { overallStatus: 'READY' }
  })
  console.log('Migrated old enum values successfully.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
