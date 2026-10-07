import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const syncSecret = process.env.NUXT_SYNC_SECRET || 'super-secret-key-123'
  const authHeader = getHeader(event, 'Authorization')
  if (authHeader !== `Bearer ${syncSecret}`) {
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
      await prisma.category.createMany({
        data: uniqueCategoryNames.map(name => ({ name })),
        skipDuplicates: true
      })
    }

    // Fetch them back to get their IDs
    const categories = await prisma.category.findMany({
      where: { name: { in: uniqueCategoryNames } }
    })

    const categoryMap = new Map<string, string>()
    for (const c of categories) {
      categoryMap.set(c.name, c.id)
    }

    // 2. Update stock on existing products and insert new ones
    if (items.length > 0) {
      const operations = items.map((item: any) => {
        const catName = item.category?.trim() || 'Uncategorized'
        const categoryId = categoryMap.get(catName) || categories[0]?.id
        const stockInt = Math.round(Number(item.stock)) || 0
        const priceVal = Number(item.price) || 0

        return prisma.product.upsert({
          where: { sku: item.sku },
          update: {
            stock: stockInt,
            categoryId: categoryId,
            name: item.name
          },
          create: {
            sku: item.sku,
            name: item.name,
            categoryId: categoryId,
            stock: stockInt,
            price: priceVal
          }
        })
      })

      // Execute in chunks to avoid overwhelming the database
      const chunkSize = 500
      for (let i = 0; i < operations.length; i += chunkSize) {
        await prisma.$transaction(operations.slice(i, i + chunkSize))
      }
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
