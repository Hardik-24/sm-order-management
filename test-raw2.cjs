const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  try {
    const rawData = fs.readFileSync('D:\\\\App Development\\\\Python automation BUSY\\\\stock_data.json', 'utf8');
    const items = JSON.parse(rawData);
    
    console.log('Processing', items.length, 'items');
    const t0 = Date.now();
    
    const uniqueCategoryNames = [...new Set(items.map(i => (i.category || '').trim() || 'Uncategorized'))];
    
    if (uniqueCategoryNames.length > 0) {
      const catValues = uniqueCategoryNames.map(name => {
        const safeName = name.replace(/'/g, "''");
        return `(gen_random_uuid(), '${safeName}', NOW(), NOW())`;
      }).join(',');
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO categories (id, name, "createdAt", "updatedAt")
        VALUES ${catValues}
        ON CONFLICT (name) DO NOTHING;
      `);
    }

    const categories = await prisma.category.findMany({
      where: { name: { in: uniqueCategoryNames } }
    });

    const categoryMap = new Map();
    for (const c of categories) {
      categoryMap.set(c.name, c.id);
    }
    
    console.log('Categories done in', Date.now() - t0, 'ms');

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

    console.log('Success total:', Date.now() - t0, 'ms');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
