const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSkuFormat() {
  const masterSample = await prisma.product.findFirst({
    where: { name: '3M 518 WOD SHEETS P100' }
  });
  console.log('Original Master product found for "3M 518 WOD SHEETS P100":', masterSample);
  
  const allWithSameName = await prisma.product.findMany({
    where: { name: { contains: '3M 518 WOD SHEETS P100' } }
  });
  console.log('All with same name in DB:', allWithSameName);

  await prisma.$disconnect();
}

checkSkuFormat();
