const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  try {
    const rawData = fs.readFileSync('D:\\App Development\\Python automation BUSY\\stock_data.json', 'utf8');
    const items = JSON.parse(rawData);
    
    console.log('Processing', items.length, 'items');
    
    const uniqueCategoryNames = [...new Set(items.map(i => (i.category || '').trim() || 'Uncategorized'))];
    const categoryMap = new Map();

    for (const catName of uniqueCategoryNames) {
      const category = await prisma.category.upsert({
        where: { name: catName },
        update: {},
        create: { name: catName }
      });
      categoryMap.set(catName, category.id);
    }
    
    console.log('Categories done');

    const operations = items.map(item => {
      const catName = (item.category || '').trim() || 'Uncategorized';
      const categoryId = categoryMap.get(catName);
      const stockInt = Math.round(Number(item.stock)) || 0;
      const priceVal = Number(item.price) || 0;

      return prisma.product.upsert({
        where: { sku: item.sku },
        update: {
          name: item.name,
          categoryId: categoryId,
          stock: stockInt,
          ...(priceVal > 0 && { price: priceVal })
        },
        create: {
          sku: item.sku,
          name: item.name,
          categoryId: categoryId,
          stock: stockInt,
          price: priceVal
        }
      });
    });

    console.log('Running transaction...');
    await prisma.$transaction(operations);
    console.log('Success!');
    
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
