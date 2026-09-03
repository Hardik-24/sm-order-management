const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkDiffs() {
  const rawData = fs.readFileSync('D:\\\\App Development\\\\Python automation BUSY\\\\stock_data.json', 'utf8');
  const busyItems = JSON.parse(rawData);

  const prevProducts = await prisma.product.findMany({
    where: { createdAt: { lt: new Date('2026-08-31T00:00:00.000Z') } },
    select: { sku: true, name: true }
  });

  console.log(`Original loaded products: ${prevProducts.length}`);
  console.log('Sample of Busy items created today:');
  const newOnes = busyItems.filter(b => !prevProducts.some(p => p.sku === b.sku));
  console.log(newOnes.slice(0, 5));

  // Check if any of these new ones match if we trim or lowercase
  let fuzzyMatches = 0;
  newOnes.forEach(b => {
    const cleanB = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = prevProducts.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanB);
    if (found) {
      fuzzyMatches++;
      if (fuzzyMatches <= 3) {
        console.log(`Fuzzy match example: Busy="${b.name}" vs Master="${found.name}"`);
      }
    }
  });
  console.log(`Fuzzy matches (minor punctuation/case differences): ${fuzzyMatches}`);

  await prisma.$disconnect();
}

checkDiffs();
