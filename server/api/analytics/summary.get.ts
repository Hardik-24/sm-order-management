import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const period = (query.period as string) || 'all' // 'all', 'fy', 'month', '30d'

  try {
    const lastSyncedSetting = await prisma.systemSetting.findUnique({
      where: { key: 'last_synced' }
    })

    // 1. Inventory KPIs & Health Status (Both Cost and Sale Valuation)
    const [invKpi]: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int AS total_products,
        COUNT(CASE WHEN stock > 0 THEN 1 END)::int AS in_stock_count,
        COUNT(CASE WHEN stock = 0 THEN 1 END)::int AS zero_stock_count,
        COUNT(CASE WHEN stock < 0 THEN 1 END)::int AS negative_stock_count,
        COUNT(CASE WHEN stock > 0 AND stock <= 10 THEN 1 END)::int AS low_stock_count,
        COALESCE(SUM(CASE WHEN stock > 0 THEN stock * COALESCE("costPrice", price, 0) ELSE 0 END), 0)::numeric AS total_cost_value,
        COALESCE(SUM(CASE WHEN stock > 0 THEN stock * COALESCE(NULLIF(price, 0), "costPrice", 0) ELSE 0 END), 0)::numeric AS total_sale_value
      FROM products
      WHERE "isActive" = true
    `)

    // 2. Category Capital & Stock Breakdown (with both Cost and Sale Value)
    const categoryRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        c.name AS category_name,
        COUNT(p.id)::int AS product_count,
        COALESCE(SUM(p.stock), 0)::int AS total_units,
        COALESCE(SUM(CASE WHEN p.stock > 0 THEN p.stock * COALESCE(p."costPrice", p.price, 0) ELSE 0 END), 0)::numeric AS cost_value,
        COALESCE(SUM(CASE WHEN p.stock > 0 THEN p.stock * COALESCE(NULLIF(p.price, 0), p."costPrice", 0) ELSE 0 END), 0)::numeric AS sale_value
      FROM categories c
      JOIN products p ON p."categoryId" = c.id
      WHERE p."isActive" = true
      GROUP BY c.name
      HAVING SUM(CASE WHEN p.stock > 0 THEN p.stock * COALESCE(p."costPrice", p.price, 0) ELSE 0 END) > 0
      ORDER BY cost_value DESC
      LIMIT 12
    `)

    // 3. Top Capital-Heavy Products (Top 10 by Cost Value)
    const topProducts: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id, p.name, p.sku, p.stock::int, 
        p.price::numeric AS sale_price,
        COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
        c.name AS category_name,
        (p.stock * COALESCE(p."costPrice", p.price, 0))::numeric AS total_cost_value,
        (p.stock * COALESCE(NULLIF(p.price, 0), p."costPrice", 0))::numeric AS total_sale_value
      FROM products p
      JOIN categories c ON p."categoryId" = c.id
      WHERE p.stock > 0 AND (p."costPrice" > 0 OR p.price > 0) AND p."isActive" = true
      ORDER BY total_cost_value DESC
      LIMIT 10
    `)

    // 4. Critical Stock Watchlist: Low Stock (< 10 units)
    const lowStockItems: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id, p.name, p.sku, p.stock::int, 
        p.price::numeric AS sale_price,
        COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
        c.name AS category_name
      FROM products p
      JOIN categories c ON p."categoryId" = c.id
      WHERE p.stock > 0 AND p.stock <= 10 AND p."isActive" = true
      ORDER BY p.stock ASC, p.name ASC
      LIMIT 10
    `)

    // 5. Negative Stock Audit Watchlist (Over-dispatched items)
    const negativeStockItems: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id, p.name, p.sku, p.stock::int, 
        p.price::numeric AS sale_price,
        COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
        c.name AS category_name
      FROM products p
      JOIN categories c ON p."categoryId" = c.id
      WHERE p.stock < 0 AND p."isActive" = true
      ORDER BY p.stock ASC
      LIMIT 10
    `)

    // 6. Customer Demographics & Tiers
    const [custKpi]: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int AS total_customers,
        COUNT(CASE WHEN "privilegeTier" = 'GOLD' THEN 1 END)::int AS gold_count,
        COUNT(CASE WHEN "privilegeTier" = 'SILVER' THEN 1 END)::int AS silver_count,
        COUNT(CASE WHEN "privilegeTier" = 'BRONZE' THEN 1 END)::int AS bronze_count,
        COUNT(CASE WHEN "gstNumber" IS NOT NULL AND "gstNumber" <> '' THEN 1 END)::int AS gst_registered_count,
        COUNT(CASE WHEN phone IS NOT NULL AND phone <> '0000000000' AND phone <> '' THEN 1 END)::int AS phone_verified_count
      FROM customers
      WHERE "isActive" = true
    `)

    // 7. Top Customer City / Area Clusters
    const cityClusters: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(NULLIF(TRIM(city), ''), 'Mysore') AS city,
        COUNT(*)::int AS count
      FROM customers
      WHERE "isActive" = true
      GROUP BY COALESCE(NULLIF(TRIM(city), ''), 'Mysore')
      ORDER BY count DESC
      LIMIT 6
    `)

    // 8. Order Pulse & Pipeline Status
    const [orderKpi]: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int AS total_orders,
        COALESCE(SUM("totalAmount"), 0)::numeric AS total_revenue,
        COUNT(CASE WHEN "overallStatus" = 'DELIVERED' THEN 1 END)::int AS delivered_count,
        COUNT(CASE WHEN "overallStatus" = 'DISPATCHED' THEN 1 END)::int AS dispatched_count,
        COUNT(CASE WHEN "overallStatus" = 'READY' THEN 1 END)::int AS ready_count,
        COUNT(CASE WHEN "overallStatus" = 'PROCESSING' THEN 1 END)::int AS processing_count,
        COUNT(CASE WHEN "overallStatus" = 'CONFIRMED' THEN 1 END)::int AS confirmed_count,
        COUNT(CASE WHEN "overallStatus" = 'CANCELLED' THEN 1 END)::int AS cancelled_count
      FROM orders
    `)

    // 9. Read Monthly Flow & Top Billed Customers from system settings
    const monthlyFlowSetting = await prisma.systemSetting.findUnique({
      where: { key: 'busy_monthly_flow' }
    })
    const monthlyFlow = monthlyFlowSetting?.value ? JSON.parse(monthlyFlowSetting.value) : []

    const topBilledCustSetting = await prisma.systemSetting.findUnique({
      where: { key: 'busy_top_billed_customers' }
    })
    const topBilledCustomers = topBilledCustSetting?.value ? JSON.parse(topBilledCustSetting.value) : []

    return {
      success: true,
      timestamp: new Date().toISOString(),
      lastSynced: lastSyncedSetting?.value || null,
      period,
      inventory: {
        totalProducts: Number(invKpi.total_products || 0),
        inStockCount: Number(invKpi.in_stock_count || 0),
        zeroStockCount: Number(invKpi.zero_stock_count || 0),
        negativeStockCount: Number(invKpi.negative_stock_count || 0),
        lowStockCount: Number(invKpi.low_stock_count || 0),
        totalCostValue: Number(invKpi.total_cost_value || 0),
        totalSaleValue: Number(invKpi.total_sale_value || 0),
        categories: categoryRows.map(c => ({
          name: c.category_name,
          productCount: Number(c.product_count),
          totalUnits: Number(c.total_units),
          costValue: Number(c.cost_value),
          saleValue: Number(c.sale_value)
        })),
        topProducts: topProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          salePrice: Number(p.sale_price),
          costPrice: Number(p.cost_price),
          category: p.category_name,
          totalCostValue: Number(p.total_cost_value),
          totalSaleValue: Number(p.total_sale_value)
        })),
        lowStockItems: lowStockItems.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          salePrice: Number(p.sale_price),
          costPrice: Number(p.cost_price),
          category: p.category_name
        })),
        negativeStockItems: negativeStockItems.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          salePrice: Number(p.sale_price),
          costPrice: Number(p.cost_price),
          category: p.category_name
        })),
        monthlyFlow
      },
      customers: {
        total: Number(custKpi.total_customers || 0),
        gold: Number(custKpi.gold_count || 0),
        silver: Number(custKpi.silver_count || 0),
        bronze: Number(custKpi.bronze_count || 0),
        gstRegistered: Number(custKpi.gst_registered_count || 0),
        phoneVerified: Number(custKpi.phone_verified_count || 0),
        topCities: cityClusters.map(c => ({
          city: c.city,
          count: Number(c.count)
        })),
        topBilledCustomers
      },
      orders: {
        totalOrders: Number(orderKpi.total_orders || 0),
        totalRevenue: Number(orderKpi.total_revenue || 0),
        delivered: Number(orderKpi.delivered_count || 0),
        dispatched: Number(orderKpi.dispatched_count || 0),
        ready: Number(orderKpi.ready_count || 0),
        processing: Number(orderKpi.processing_count || 0),
        confirmed: Number(orderKpi.confirmed_count || 0),
        cancelled: Number(orderKpi.cancelled_count || 0)
      }
    }
  } catch (error: any) {
    console.error('Analytics aggregation error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load analytics: ${error?.message || error}`
    })
  }
})
