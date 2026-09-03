import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'Authorization')
  if (authHeader !== 'Bearer super-secret-key-123') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody(event)
  const items = body.items
  
  if (!Array.isArray(items)) {
    throw createError({ statusCode: 400, message: 'Invalid payload, expected { items: [] }' })
  }

  try {
    // 1. Extract and bulk insert all unique categories
    const uniqueCategoryNames = [...new Set(items.map((i: any) => i.category?.trim() || 'Uncategorized'))]
    
    if (uniqueCategoryNames.length > 0) {
      const catValues = uniqueCategoryNames.map(name => {
        const safeName = name.replace(/'/g, "''")
        return `(gen_random_uuid(), '${safeName}', NOW(), NOW())`
      }).join(',')
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO categories (id, name, "createdAt", "updatedAt")
        VALUES ${catValues}
        ON CONFLICT (name) DO NOTHING;
      `)
    }

    // Fetch them back to get their IDs
    const categories = await prisma.category.findMany({
      where: { name: { in: uniqueCategoryNames } }
    })

    const categoryMap = new Map<string, string>()
    for (const c of categories) {
      categoryMap.set(c.name, c.id)
    }

    // 2. Update stock on existing products (matching by name or sku) and insert new ones if they don't exist
    if (items.length > 0) {
      // Step A: Bulk update stock on existing products matched by name or sku
      const tempTableValues = items.map((item: any) => {
        const catName = item.category?.trim() || 'Uncategorized'
        const categoryId = categoryMap.get(catName) || categories[0]?.id
        const stockInt = Math.round(Number(item.stock)) || 0
        const safeName = item.name.replace(/'/g, "''")
        const safeSku = item.sku.replace(/'/g, "''")
        return `('${safeName}', '${safeSku}', '${categoryId}', ${stockInt})`
      }).join(',')

      await prisma.$executeRawUnsafe(`
        UPDATE products AS p
        SET 
          stock = v.stock,
          "categoryId" = v.category_id,
          "updatedAt" = NOW()
        FROM (VALUES ${tempTableValues}) AS v(item_name, item_sku, category_id, stock)
        WHERE p.name = v.item_name OR p.sku = v.item_sku;
      `)

      // Step B: Insert any brand new items that didn't exist at all
      const insertValues = items.map((item: any) => {
        const catName = item.category?.trim() || 'Uncategorized'
        const categoryId = categoryMap.get(catName) || categories[0]?.id
        const stockInt = Math.round(Number(item.stock)) || 0
        const priceVal = Number(item.price) || 0
        const safeSku = item.sku.replace(/'/g, "''")
        const safeName = item.name.replace(/'/g, "''")
        return `(gen_random_uuid(), '${safeSku}', '${safeName}', '${categoryId}', ${stockInt}, ${priceVal}, NOW(), NOW())`
      }).join(',')

      await prisma.$executeRawUnsafe(`
        INSERT INTO products (id, sku, name, "categoryId", stock, price, "createdAt", "updatedAt")
        VALUES ${insertValues}
        ON CONFLICT (sku) DO NOTHING;
      `)
    }

    // 3. Success - Reset sync flag
    await prisma.systemSetting.upsert({
      where: { key: 'sync_requested' },
      update: { value: 'false' },
      create: { key: 'sync_requested', value: 'false' }
    })

    await prisma.systemSetting.upsert({
      where: { key: 'sync_progress' },
      update: { value: JSON.stringify({ step: 5, totalSteps: 5, message: "Sync Complete!", progress: 100 }) },
      create: { key: 'sync_progress', value: JSON.stringify({ step: 5, totalSteps: 5, message: "Sync Complete!", progress: 100 }) }
    })

    await prisma.systemSetting.upsert({
      where: { key: 'last_synced' },
      update: { value: new Date().toISOString() },
      create: { key: 'last_synced', value: new Date().toISOString() }
    })

    return { success: true, updated: items.length }
    
  } catch (error) {
    // If it fails, we STILL want to cancel the sync request so the script doesn't loop infinitely!
    await prisma.systemSetting.upsert({
      where: { key: 'sync_requested' },
      update: { value: 'false' },
      create: { key: 'sync_requested', value: 'false' }
    }).catch(() => {})
    
    console.error('Webhook Error:', error)
    throw createError({ statusCode: 500, message: 'Server Error during sync' })
  }
})
