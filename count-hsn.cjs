const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countHsn() {
  const total = await prisma.product.count();
  const withHsn = await prisma.product.count({
    where: {
      hsnCode: {
        not: null
      }
    }
  });
  console.log({ total, withHsn });
  await prisma.$disconnect();
}

countHsn();
