const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectMissingHsn() {
  const total = await prisma.product.count();
  const missingHsn = await prisma.product.findMany({
    where: {
      OR: [
        { hsnCode: null },
        { hsnCode: '' }
      ]
    },
    select: {
      sku: true,
      name: true,
      category: { select: { name: true } },
      stock: true,
      price: true,
      createdAt: true
    },
    take: 15
  });

  const missingCount = await prisma.product.count({
    where: {
      OR: [
        { hsnCode: null },
        { hsnCode: '' }
      ]
    }
  });

  console.log(`Total Products: ${total}`);
  console.log(`Missing HSN: ${missingCount} products`);
  console.log('Sample of products missing HSN:');
  console.log(missingHsn);

  await prisma.$disconnect();
}

inspectMissingHsn();
