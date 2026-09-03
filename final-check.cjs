const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.count();
  const withHsn = await prisma.product.count({ where: { hsnCode: { not: null } } });
  const categories = await prisma.category.count();
  const customers = await prisma.customer.count();
  console.log({ products, withHsn, categories, customers });
  await prisma.$disconnect();
}

check();
