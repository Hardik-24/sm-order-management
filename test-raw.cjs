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

    const values = items.map((item) => {
      const catName = (item.category || '').trim() || 'Uncategorized';
      const categoryId = categoryMap.get(catName);
      const stockInt = Math.round(Number(item.stock)) || 0;
      const priceVal = Number(item.price) || 0;
      
      const safeSku = item.sku.replace(/'/g, "''");
      const safeName = item.name.replace(/'/g, "''");
      
      return `(gen_random_uuid(), '${safeSku}', '${safeName}', '${categoryId}', ${stockInt}, ${priceVal}, NOW(), NOW())`;
    });

    if (values.length > 0) {
      const query = `
        INSERT INTO products (id, sku, name, "categoryId", stock, price, "createdAt", "updatedAt")
        VALUES ${values.join(',')}
        ON CONFLICT (sku) DO UPDATE SET
          name = EXCLUDED.name,
          "categoryId" = EXCLUDED."categoryId",
          stock = EXCLUDED.stock,
          price = EXCLUDED.price,
          "updatedAt" = EXCLUDED."updatedAt";
      `;
      await prisma.$executeRawUnsafe(query);
    }

    console.log('Success!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
