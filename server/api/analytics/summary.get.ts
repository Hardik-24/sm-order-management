import { defineEventHandler } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  try {
    // 1. Inventory KPIs & Health Status
    const [invKpi]: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int AS total_products,
        COUNT(CASE WHEN stock > 0 THEN 1 END)::int AS in_stock_count,
        COUNT(CASE WHEN stock = 0 THEN 1 END)::int AS zero_stock_count,
        COUNT(CASE WHEN stock < 0 THEN 1 END)::int AS negative_stock_count,
        COUNT(CASE WHEN stock > 0 AND stock <= 10 THEN 1 END)::int AS low_stock_count,
        COALESCE(SUM(CASE WHEN stock > 0 THEN stock * price ELSE 0 END), 0)::numeric AS total_inventory_value
      FROM products
      WHERE "isActive" = true
    `)

    // 2. Category Capital & Stock Breakdown (Top 12)
    const categoryRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        c.name AS category_name,
        COUNT(p.id)::int AS product_count,
        COALESCE(SUM(p.stock), 0)::int AS total_units,
        COALESCE(SUM(CASE WHEN p.stock > 0 THEN p.stock * p.price ELSE 0 END), 0)::numeric AS total_value
      FROM categories c
      JOIN products p ON p."categoryId" = c.id
      WHERE p."isActive" = true
      GROUP BY c.name
      HAVING SUM(CASE WHEN p.stock > 0 THEN p.stock * p.price ELSE 0 END) > 0
      ORDER BY total_value DESC
      LIMIT 12
    `)

    // 3. Top Capital-Heavy Products (Top 10)
    const topProducts: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id, p.name, p.sku, p.stock::int, p.price::numeric,
        c.name AS category_name,
        (p.stock * p.price)::numeric AS total_value
      FROM products p
      JOIN categories c ON p."categoryId" = c.id
      WHERE p.stock > 0 AND p.price > 0 AND p."isActive" = true
      ORDER BY total_value DESC
      LIMIT 10
    `)

    // 4. Critical Stock Watchlist: Low Stock (< 10 units)
    const lowStockItems: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id, p.name, p.sku, p.stock::int, p.price::numeric,
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
        p.id, p.name, p.sku, p.stock::int, p.price::numeric,
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

    return {
      success: true,
      timestamp: new Date().toISOString(),
      inventory: {
        totalProducts: Number(invKpi.total_products || 0),
        inStockCount: Number(invKpi.in_stock_count || 0),
        zeroStockCount: Number(invKpi.zero_stock_count || 0),
        negativeStockCount: Number(invKpi.negative_stock_count || 0),
        lowStockCount: Number(invKpi.low_stock_count || 0),
        totalInventoryValue: Number(invKpi.total_inventory_value || 0),
        categories: categoryRows.map(c => ({
          name: c.category_name,
          productCount: Number(c.product_count),
          totalUnits: Number(c.total_units),
          totalValue: Number(c.total_value)
        })),
        topProducts: topProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          price: Number(p.price),
          category: p.category_name,
          totalValue: Number(p.total_value)
        })),
        lowStockItems: lowStockItems.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          price: Number(p.price),
          category: p.category_name
        })),
        negativeStockItems: negativeStockItems.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          price: Number(p.price),
          category: p.category_name
        }))
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
        }))
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
