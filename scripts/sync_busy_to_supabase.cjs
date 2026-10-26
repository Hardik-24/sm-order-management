const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const directUrl = "postgresql://postgres.xfzvkqjkbwwdqtxgasrh:csYX9pwTCZyZC5IZ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function runSync() {
  console.log("==================================================================");
  console.log("   SYNC BUSY DATABASE (COMP0010) ---> SUPABASE POSTGRESQL");
  console.log("==================================================================");
  const startTime = Date.now();

  const raw = fs.readFileSync('busy_sync_payload.json', 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  console.log(`Loaded payload extracted at: ${data.extractedAt}`);
  console.log(`- Categories in payload: ${data.categories.length}`);
  console.log(`- Products in payload:   ${data.products.length}`);
  console.log(`- Customers in payload:  ${data.customers.length}`);

  // -----------------------------------------------------------------------------
  // STEP 1: Categories Sync
  // -----------------------------------------------------------------------------
  console.log("\n[1/3] Syncing Categories...");
  const catSet = new Set(data.categories.map(c => c.trim()).filter(Boolean));
  data.products.forEach(p => {
    if (p.categoryName && p.categoryName.trim()) {
      catSet.add(p.categoryName.trim());
    }
  });

  const allCatNames = Array.from(catSet);
  if (allCatNames.length > 0) {
    const catChunks = [];
    for (let i = 0; i < allCatNames.length; i += 100) {
      catChunks.push(allCatNames.slice(i, i + 100));
    }

    for (const chunk of catChunks) {
      const vals = chunk.map(name => `(gen_random_uuid(), ${esc(name)}, true, NOW(), NOW())`).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO categories (id, name, "isActive", "createdAt", "updatedAt")
        VALUES ${vals}
        ON CONFLICT (name) DO NOTHING;
      `);
    }
  }

  const allDBCats = await prisma.category.findMany();
  const categoryMap = new Map();
  allDBCats.forEach(c => categoryMap.set(c.name, c.id));
  const defaultCatId = categoryMap.get("General") || allDBCats[0]?.id;
  console.log(`  -> Synced ${allDBCats.length} total categories in database.`);

  // -----------------------------------------------------------------------------
  // STEP 2: Products & Stock Sync
  // -----------------------------------------------------------------------------
  console.log("\n[2/3] Syncing Products, Stock, Prices & HSN codes...");
  const existingProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, stock: true }
  });

  const existingBySku = new Map();
  const existingByName = new Map();
  existingProducts.forEach(p => {
    existingBySku.set(p.sku, p);
    if (!existingByName.has(p.name)) {
      existingByName.set(p.name, p);
    }
  });

  // Prepare batch updates and batch inserts
  let updatedCount = 0;
  let insertedCount = 0;

  const toInsert = [];
  const toUpdate = [];

  for (const p of data.products) {
    const sku = p.sku.trim();
    const name = p.name.trim();
    const catId = categoryMap.get(p.categoryName) || defaultCatId;
    const price = typeof p.salePrice === 'number' ? p.salePrice : 0;
    const stock = typeof p.stock === 'number' ? p.stock : 0;
    const hsn = p.hsnCode && p.hsnCode.trim() ? p.hsnCode.trim() : null;
    const isActive = p.isActive !== false;

    // Check if product exists by SKU or Name
    const match = existingBySku.get(sku) || existingByName.get(name);

    if (match) {
      toUpdate.push({
        id: match.id,
        sku,
        name,
        categoryId: catId,
        price,
        stock,
        hsnCode: hsn,
        isActive
      });
    } else {
      toInsert.push({
        sku,
        name,
        categoryId: catId,
        price,
        stock,
        hsnCode: hsn,
        isActive
      });
    }
  }

  // Execute Product Updates in chunks
  console.log(`  -> Updating ${toUpdate.length} existing products...`);
  const updateChunkSize = 250;
  for (let i = 0; i < toUpdate.length; i += updateChunkSize) {
    const chunk = toUpdate.slice(i, i + updateChunkSize);
    
    // Construct single batch UPDATE using VALUES table
    const valuesList = chunk.map(p => 
      `('${p.id}'::text, ${esc(p.sku)}, ${esc(p.name)}, '${p.categoryId}'::text, ${p.price}::numeric, ${p.stock}::integer, ${esc(p.hsnCode)}, ${p.isActive}::boolean)`
    ).join(',');

    await prisma.$executeRawUnsafe(`
      UPDATE products AS p
      SET 
        sku = v.sku,
        name = v.name,
        "categoryId" = v.categoryId,
        price = CASE WHEN v.price > 0 THEN v.price ELSE p.price END,
        stock = v.stock,
        "hsnCode" = COALESCE(v.hsnCode, p."hsnCode"),
        "isActive" = v.isActive,
        "updatedAt" = NOW()
      FROM (VALUES ${valuesList}) AS v(id, sku, name, categoryId, price, stock, hsnCode, isActive)
      WHERE p.id = v.id;
    `);
    updatedCount += chunk.length;
  }

  // Execute Product Inserts in chunks
  if (toInsert.length > 0) {
    console.log(`  -> Inserting ${toInsert.length} new products...`);
    const insertChunkSize = 250;
    for (let i = 0; i < toInsert.length; i += insertChunkSize) {
      const chunk = toInsert.slice(i, i + insertChunkSize);
      const valuesList = chunk.map(p => 
        `(gen_random_uuid(), ${esc(p.sku)}, ${esc(p.name)}, '${p.categoryId}'::text, 'PIECE', ${p.price}, ${p.stock}, ${esc(p.hsnCode)}, NULL, false, ${p.isActive}, NOW(), NOW())`
      ).join(',');

      await prisma.$executeRawUnsafe(`
        INSERT INTO products (id, sku, name, "categoryId", unit, price, stock, "hsnCode", "taxRate", "hasVariants", "isActive", "createdAt", "updatedAt")
        VALUES ${valuesList}
        ON CONFLICT (sku) DO UPDATE SET
          name = EXCLUDED.name,
          "categoryId" = EXCLUDED."categoryId",
          price = CASE WHEN EXCLUDED.price > 0 THEN EXCLUDED.price ELSE products.price END,
          stock = EXCLUDED.stock,
          "hsnCode" = COALESCE(EXCLUDED."hsnCode", products."hsnCode"),
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = NOW();
      `);
      insertedCount += chunk.length;
    }
  }

  console.log(`  -> Products sync complete! Updated: ${updatedCount}, Inserted: ${insertedCount}.`);

  // -----------------------------------------------------------------------------
  // STEP 3: Customers Sync
  // -----------------------------------------------------------------------------
  console.log("\n[3/3] Syncing Customers & Addresses...");
  const existingCustomers = await prisma.customer.findMany({
    select: { id: true, customerCode: true, name: true }
  });

  const existingCustByCode = new Map();
  const existingCustByName = new Map();
  existingCustomers.forEach(c => {
    if (c.customerCode) existingCustByCode.set(c.customerCode, c);
    if (!existingCustByName.has(c.name)) existingCustByName.set(c.name, c);
  });

  const custToUpdate = [];
  const custToInsert = [];

  for (const c of data.customers) {
    const code = c.customerCode.trim();
    const name = c.name.trim();
    const company = c.company ? c.company.trim() : name;
    const alias = c.alias ? c.alias.trim() : null;
    const phone = c.phone ? c.phone.trim() : "0000000000";
    const address = c.address ? c.address.trim() : null;
    const pincode = c.pincode ? c.pincode.trim() : null;
    const gst = c.gstNumber ? c.gstNumber.trim() : null;
    const city = c.city ? c.city.trim() : "Mysore";

    const match = existingCustByCode.get(code) || existingCustByName.get(name);

    if (match) {
      custToUpdate.push({
        id: match.id,
        customerCode: code,
        name,
        company,
        alias,
        phone,
        address,
        pincode,
        gstNumber: gst,
        city
      });
    } else {
      custToInsert.push({
        customerCode: code,
        name,
        company,
        alias,
        phone,
        address,
        pincode,
        gstNumber: gst,
        city
      });
    }
  }

  // Update existing customers
  console.log(`  -> Updating ${custToUpdate.length} existing customers...`);
  let custUpdatedCount = 0;
  const custChunkSize = 200;
  for (let i = 0; i < custToUpdate.length; i += custChunkSize) {
    const chunk = custToUpdate.slice(i, i + custChunkSize);
    const valuesList = chunk.map(c => 
      `('${c.id}'::text, ${esc(c.customerCode)}, ${esc(c.name)}, ${esc(c.company)}, ${esc(c.alias)}, ${esc(c.phone)}, ${esc(c.address)}, ${esc(c.pincode)}, ${esc(c.gstNumber)}, ${esc(c.city)})`
    ).join(',');

    await prisma.$executeRawUnsafe(`
      UPDATE customers AS c
      SET 
        "customerCode" = v.customerCode,
        name = v.name,
        company = v.company,
        alias = v.alias,
        phone = CASE WHEN v.phone <> '0000000000' AND v.phone <> '' THEN v.phone ELSE c.phone END,
        address = COALESCE(v.address, c.address),
        pincode = COALESCE(v.pincode, c.pincode),
        "gstNumber" = COALESCE(v.gstNumber, c."gstNumber"),
        city = COALESCE(v.city, c.city),
        "updatedAt" = NOW()
      FROM (VALUES ${valuesList}) AS v(id, customerCode, name, company, alias, phone, address, pincode, gstNumber, city)
      WHERE c.id = v.id;
    `);
    custUpdatedCount += chunk.length;
  }

  // Insert new customers
  let custInsertedCount = 0;
  if (custToInsert.length > 0) {
    console.log(`  -> Inserting ${custToInsert.length} new customers...`);
    for (let i = 0; i < custToInsert.length; i += custChunkSize) {
      const chunk = custToInsert.slice(i, i + custChunkSize);
      const valuesList = chunk.map(c => 
        `(gen_random_uuid(), ${esc(c.customerCode)}, ${esc(c.name)}, ${esc(c.company)}, ${esc(c.alias)}, ${esc(c.phone)}, ${esc(c.address)}, ${esc(c.pincode)}, ${esc(c.gstNumber)}, ${esc(c.city)}, 'Net 30 Days', 'BRONZE', false, true, NOW(), NOW())`
      ).join(',');

      await prisma.$executeRawUnsafe(`
        INSERT INTO customers (id, "customerCode", name, company, alias, phone, address, pincode, "gstNumber", city, "paymentTerms", "privilegeTier", "isPriorityClient", "isActive", "createdAt", "updatedAt")
        VALUES ${valuesList}
        ON CONFLICT ("customerCode") DO UPDATE SET
          name = EXCLUDED.name,
          company = EXCLUDED.company,
          phone = EXCLUDED.phone,
          address = COALESCE(EXCLUDED.address, customers.address),
          pincode = COALESCE(EXCLUDED.pincode, customers.pincode),
          "gstNumber" = COALESCE(EXCLUDED."gstNumber", customers."gstNumber"),
          city = COALESCE(EXCLUDED.city, customers.city),
          "updatedAt" = NOW();
      `);
      custInsertedCount += chunk.length;
    }
  }

  console.log(`  -> Customers sync complete! Updated: ${custUpdatedCount}, Inserted: ${custInsertedCount}.`);

  // -----------------------------------------------------------------------------
  // VERIFICATION
  // -----------------------------------------------------------------------------
  const totalProducts = await prisma.product.count();
  const productsWithStock = await prisma.product.count({ where: { stock: { not: 0 } } });
  const totalCustomers = await prisma.customer.count();
  const totalCategories = await prisma.category.count();

  // Spot-check calibrated items
  const testItems = await prisma.product.findMany({
    where: {
      name: {
        in: [
          '3.3 HDWR GR (GREEN)',
          '11 HDWR GR (GREEN)',
          '1MMOTH Paper Base Laminate',
          'FEVICOL HEATX 1 LTR',
          'FEVICOL 500 GMS PROBOND ADHESIVE'
        ]
      }
    },
    select: { name: true, sku: true, stock: true, price: true }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n==================================================================");
  console.log(`   SYNC FINISHED IN ${durationSec} SECONDS!`);
  console.log("==================================================================");
  console.log(`- Total Categories in Supabase: ${totalCategories}`);
  console.log(`- Total Products in Supabase:   ${totalProducts} (${productsWithStock} with non-zero stock)`);
  console.log(`- Total Customers in Supabase:  ${totalCustomers}`);
  console.log("\nSpot-check verification:");
  testItems.forEach(item => {
    console.log(`   * ${item.name}: Stock = ${item.stock}, Price = ₹${item.price}`);
  });
  console.log("==================================================================");
}

runSync()
  .catch(err => {
    console.error("SYNC FAILED WITH ERROR:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
