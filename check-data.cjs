const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const prodCount = await prisma.product.count();
  const custCount = await prisma.customer.count();
  const hsnProds = await prisma.product.findMany({
    where: { hsnCode: { not: null } },
    take: 5
  });
  const sampleProducts = await prisma.product.findMany({ take: 3 });
  const sampleCustomers = await prisma.customer.findMany({ take: 3 });

  console.log('Product Count:', prodCount);
  console.log('Customer Count:', custCount);
  console.log('Products with HSN:', hsnProds.length);
  console.log('Sample Products:', sampleProducts);
  console.log('Sample Customers:', sampleCustomers);

  await prisma.$disconnect();
}

check();
