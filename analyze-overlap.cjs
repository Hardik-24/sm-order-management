const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function analyze() {
  const rawData = fs.readFileSync('D:\\\\App Development\\\\Python automation BUSY\\\\stock_data.json', 'utf8');
  const busyItems = JSON.parse(rawData);
  
  console.log(`Busy exported items count: ${busyItems.length}`);
  
  // Check how many of these busy items existed before today vs created today
  const allProducts = await prisma.product.findMany({
    select: { sku: true, createdAt: true, hsnCode: true }
  });

  const productMap = new Map();
  allProducts.forEach(p => productMap.set(p.sku, p));

  let matchedExisting = 0;
  let newCreatedToday = 0;
  let existingWithHsn = 0;

  busyItems.forEach(item => {
    const existing = productMap.get(item.sku);
    if (existing) {
      if (new Date(existing.createdAt) < new Date('2026-08-31T00:00:00.000Z')) {
        matchedExisting++;
        if (existing.hsnCode) existingWithHsn++;
      } else {
        newCreatedToday++;
      }
    }
  });

  console.log(`Total Products in Database: ${allProducts.length}`);
  console.log(`Busy Exported: ${busyItems.length}`);
  console.log(`Matched with previously loaded products: ${matchedExisting} (of which ${existingWithHsn} had HSN)`);
  console.log(`New items not found in previous master list: ${newCreatedToday}`);

  await prisma.$disconnect();
}

analyze();
