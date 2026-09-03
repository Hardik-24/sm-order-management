const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

async function importUpdatedMaster() {
  console.log("=== Starting Master Catalog Import from SM_20260831_MSAll.DAT ===");
  const filePath = "D:\\App Development\\Python automation BUSY\\SM_20260831_MSAll.DAT";
  const data = fs.readFileSync(filePath, "utf8");

  // Step 1: Clean up temporary duplicates created today without HSN if a master item with the same name exists
  console.log("Checking for duplicate products created today...");
  const tempDuplicates = await prisma.product.findMany({
    where: {
      createdAt: { gte: new Date('2026-08-31T00:00:00.000Z') },
      hsnCode: null
    },
    include: { orderItems: true }
  });

  console.log(`Found ${tempDuplicates.length} items created today.`);
  let deletedCount = 0;
  for (const p of tempDuplicates) {
    if (p.orderItems.length === 0) {
      // Check if another product exists with this name
      const masterExists = await prisma.product.findFirst({
        where: {
          name: p.name,
          id: { not: p.id }
        }
      });
      if (masterExists) {
        // If the temp item had stock, preserve it in the master item!
        if (p.stock > 0 && masterExists.stock === 0) {
          await prisma.product.update({
            where: { id: masterExists.id },
            data: { stock: p.stock }
          });
        }
        await prisma.product.delete({ where: { id: p.id } });
        deletedCount++;
      }
    }
  }
  console.log(`Cleaned up ${deletedCount} duplicate entries.`);

  // Step 2: Extract & Insert all Categories
  console.log("Extracting Categories from DAT file...");
  const categoryNames = new Set();
  
  // From <ItemGroup>
  const groupMatches = data.match(/<ItemGroup>([\s\S]*?)<\/ItemGroup>/g) || [];
  groupMatches.forEach(gStr => {
    const m = gStr.match(/<Name>(.*?)<\/Name>/);
    if (m) categoryNames.add(m[1].replace(/&amp;/g, "&").trim());
  });

  // From <Item>
  const itemMatches = data.match(/<Item>([\s\S]*?)<\/Item>/g) || [];
  itemMatches.forEach(iStr => {
    const m = iStr.match(/<ParentGroup>(.*?)<\/ParentGroup>/);
    if (m) categoryNames.add(m[1].replace(/&amp;/g, "&").trim());
  });

  console.log(`Found ${categoryNames.size} unique categories. Upserting into DB...`);
  const catArray = [...categoryNames].filter(Boolean);

  if (catArray.length > 0) {
    const catValues = catArray.map(name => {
      const safeName = name.replace(/'/g, "''");
      return `(gen_random_uuid(), '${safeName}', NOW(), NOW())`;
    }).join(',');

    await prisma.$executeRawUnsafe(`
      INSERT INTO categories (id, name, "createdAt", "updatedAt")
      VALUES ${catValues}
      ON CONFLICT (name) DO NOTHING;
    `);
  }

  const allCats = await prisma.category.findMany();
  const categoryMap = new Map();
  allCats.forEach(c => categoryMap.set(c.name, c.id));
  const defaultCatId = allCats[0]?.id;

  // Step 3: Extract Items
  console.log(`Extracting ${itemMatches.length} Items...`);
  const items = [];

  for (const itemStr of itemMatches) {
    const getVal = (tag) => {
      const match = itemStr.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
      return match ? match[1].replace(/&amp;/g, "&").trim() : null;
    };

    const name = getVal("Name") || "Unknown Item";
    const sku = getVal("Alias") || name;
    const parentGroup = getVal("ParentGroup") || "General";
    const categoryId = categoryMap.get(parentGroup) || defaultCatId;
    const unit = getVal("MainUnit") || "PIECE";
    const price = parseFloat(getVal("SalePrice") || getVal("MRP") || "0") || 0;
    const hsnCode = getVal("ItemHSNCode") || getVal("HSNCodeGST") || getVal("HSNCode") || null;
    
    let taxRate = 0;
    const taxCat = getVal("TaxCatName") || getVal("TaxCategory") || "";
    const taxMatch = taxCat.match(/(\d+(\.\d+)?)/);
    if (taxMatch) {
      taxRate = parseFloat(taxMatch[1]);
    }

    items.push({
      sku,
      name,
      categoryId,
      unit,
      price,
      hsnCode,
      taxRate
    });
  }

  // Step 4: Bulk Upsert Products in chunks
  console.log(`Bulk upserting ${items.length} products to database...`);
  const chunkSize = 500;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const values = chunk.map(item => {
      const safeSku = item.sku.replace(/'/g, "''");
      const safeName = item.name.replace(/'/g, "''");
      const safeUnit = item.unit.replace(/'/g, "''");
      const safeHsn = item.hsnCode ? `'${item.hsnCode.replace(/'/g, "''")}'` : 'NULL';
      const safeTax = item.taxRate ? item.taxRate : 'NULL';

      return `(gen_random_uuid(), '${safeSku}', '${safeName}', '${item.categoryId}', '${safeUnit}', ${item.price}, 0, ${safeHsn}, ${safeTax}, true, NOW(), NOW())`;
    }).join(',');

    const query = `
      INSERT INTO products (id, sku, name, "categoryId", unit, price, stock, "hsnCode", "taxRate", "isActive", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT (sku) DO UPDATE SET
        name = EXCLUDED.name,
        "categoryId" = EXCLUDED."categoryId",
        unit = EXCLUDED.unit,
        price = CASE WHEN EXCLUDED.price > 0 THEN EXCLUDED.price ELSE products.price END,
        "hsnCode" = COALESCE(EXCLUDED."hsnCode", products."hsnCode"),
        "taxRate" = COALESCE(EXCLUDED."taxRate", products."taxRate"),
        "updatedAt" = NOW();
    `;
    await prisma.$executeRawUnsafe(query);
    console.log(`Processed chunk ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(items.length / chunkSize)}`);
  }

  // Step 5: Final stats verification
  const totalProducts = await prisma.product.count();
  const withHsn = await prisma.product.count({ where: { hsnCode: { not: null } } });
  const totalCustomers = await prisma.customer.count();

  console.log("=== Master Catalog Import Completed Successfully! ===");
  console.log(`Total Products in DB: ${totalProducts}`);
  console.log(`Products with HSN Code: ${withHsn} (${((withHsn/totalProducts)*100).toFixed(1)}%)`);
  console.log(`Total Customers in DB: ${totalCustomers}`);
}

importUpdatedMaster()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
