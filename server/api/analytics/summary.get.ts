import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

// Fast in-memory cache for analytics to prevent repetitive heavy aggregations
let cachedAnalytics: any = null
let lastCacheTime = 0
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const isRefresh = query.refresh === 'true' || query.refresh === '1'

  if (!isRefresh && cachedAnalytics && Date.now() - lastCacheTime < CACHE_TTL_MS) {
    return cachedAnalytics
  }

  try {
    const lastSyncedSetting = await prisma.systemSetting.findUnique({
      where: { key: 'last_synced' }
    })

    const monthlyFlowSetting = await prisma.systemSetting.findUnique({
      where: { key: 'busy_monthly_flow' }
    })
    const monthlyFlow = monthlyFlowSetting?.value ? JSON.parse(monthlyFlowSetting.value) : []

    const [
      invKpi,
      categoryRows,
      fastMovingQty,
      topRevenueItems,
      deadStockItems,
      topCustomers,
      salesKpi,
      supplierStats,
      paymentTermsDist,
      criticalStockoutRisk,
      negativeStockItems,
      salesMonthlyTrend,
      categoryRevenueShare
    ] = await Promise.all([
      // 1. Inventory KPIs & Health Status
      prisma.$queryRawUnsafe(`
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
      `),

      // 2. Categories with margin spread and stock valuation
      prisma.$queryRawUnsafe(`
        SELECT 
          c.name AS category_name,
          COUNT(p.id)::int AS product_count,
          COALESCE(SUM(p.stock), 0)::int AS total_units,
          COALESCE(SUM(CASE WHEN p.stock > 0 THEN p.stock * COALESCE(p."costPrice", p.price, 0) ELSE 0 END), 0)::numeric AS cost_value,
          COALESCE(SUM(CASE WHEN p.stock > 0 THEN p.stock * COALESCE(NULLIF(p.price, 0), p."costPrice", 0) ELSE 0 END), 0)::numeric AS sale_value,
          ROUND(AVG(NULLIF(p.price, 0)), 2)::numeric AS avg_sale_price,
          ROUND(AVG(NULLIF(p."costPrice", 0)), 2)::numeric AS avg_cost_price
        FROM categories c
        JOIN products p ON p."categoryId" = c.id
        WHERE p."isActive" = true
        GROUP BY c.name
        HAVING SUM(CASE WHEN p.stock > 0 THEN p.stock * COALESCE(p."costPrice", p.price, 0) ELSE 0 END) > 0
        ORDER BY cost_value DESC
        LIMIT 15
      `),

      // 3. Fast Moving SKUs (by total quantity sold in vouchers)
      prisma.$queryRawUnsafe(`
        SELECT 
          item->>'name' AS name,
          item->>'sku' AS sku,
          COUNT(v.id)::int AS voucher_count,
          SUM((item->>'qty')::numeric)::numeric AS qty_sold,
          SUM((item->>'amount')::numeric)::numeric AS revenue,
          ROUND(AVG((item->>'rate')::numeric), 2)::numeric AS avg_rate
        FROM busy_vouchers v,
        LATERAL jsonb_array_elements(v.items::jsonb) AS item
        WHERE (item->>'qty')::numeric > 0 
          AND item->>'name' NOT ILIKE '%freight%' 
          AND item->>'name' NOT ILIKE '%round off%'
          AND item->>'name' NOT ILIKE '%discount%'
        GROUP BY item->>'name', item->>'sku'
        ORDER BY qty_sold DESC
        LIMIT 20
      `),

      // 4. Top Revenue Generating SKUs
      prisma.$queryRawUnsafe(`
        SELECT 
          item->>'name' AS name,
          item->>'sku' AS sku,
          COUNT(v.id)::int AS voucher_count,
          SUM((item->>'qty')::numeric)::numeric AS qty_sold,
          SUM((item->>'amount')::numeric)::numeric AS revenue,
          ROUND(AVG((item->>'rate')::numeric), 2)::numeric AS avg_rate
        FROM busy_vouchers v,
        LATERAL jsonb_array_elements(v.items::jsonb) AS item
        WHERE (item->>'qty')::numeric > 0 
          AND item->>'name' NOT ILIKE '%freight%' 
          AND item->>'name' NOT ILIKE '%round off%'
          AND item->>'name' NOT ILIKE '%discount%'
        GROUP BY item->>'name', item->>'sku'
        ORDER BY revenue DESC
        LIMIT 20
      `),

      // 5. Non-Moving Dead Stock (High stock, 0 sales in vouchers)
      prisma.$queryRawUnsafe(`
        WITH sold_items AS (
          SELECT DISTINCT item->>'name' AS name
          FROM busy_vouchers v,
          LATERAL jsonb_array_elements(v.items::jsonb) AS item
          WHERE (item->>'qty')::numeric > 0
        )
        SELECT 
          p.id, p.name, p.sku, p.stock::int,
          COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
          p.price::numeric AS sale_price,
          (p.stock * COALESCE(p."costPrice", p.price, 0))::numeric AS capital_locked,
          c.name AS category_name
        FROM products p
        JOIN categories c ON p."categoryId" = c.id
        LEFT JOIN sold_items s ON LOWER(TRIM(p.name)) = LOWER(TRIM(s.name))
        WHERE p.stock > 0 
          AND p."isActive" = true 
          AND s.name IS NULL
        ORDER BY capital_locked DESC
        LIMIT 20
      `),

      // 6. Top B2B Customers by Total Spend & Order Frequency
      prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(NULLIF(TRIM(v."customerCode"), ''), 'CASH') AS customer_code,
          v."customerName" AS customer_name,
          COUNT(v.id)::int AS invoice_count,
          SUM(v."totalAmount")::numeric AS total_spend,
          ROUND(AVG(v."totalAmount"), 2)::numeric AS avg_invoice_value,
          MAX(v."voucherDate") AS last_invoice_date
        FROM busy_vouchers v
        GROUP BY COALESCE(NULLIF(TRIM(v."customerCode"), ''), 'CASH'), v."customerName"
        ORDER BY total_spend DESC
        LIMIT 25
      `),

      // 7. Sales Aggregate KPIs (Outward Sales Invoices)
      prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(id)::int AS count,
          COALESCE(SUM("totalAmount"), 0)::numeric AS revenue,
          COALESCE(SUM("taxableAmount"), 0)::numeric AS taxable,
          COALESCE(SUM("taxAmount"), 0)::numeric AS tax
        FROM busy_vouchers
        WHERE "voucherType" = 9
      `),

      // 8. Supplier Base Statistics
      prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(*)::int AS total_suppliers,
          COUNT(CASE WHEN "gstNumber" IS NOT NULL AND "gstNumber" <> '' THEN 1 END)::int AS gst_registered_count,
          COUNT(CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 END)::int AS phone_count
        FROM suppliers
        WHERE "isActive" = true
      `),

      // 9. Supplier Payment Terms Breakdown
      prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(NULLIF(TRIM("paymentTerms"), ''), 'Net 30 Days') AS terms,
          COUNT(*)::int AS count
        FROM suppliers
        WHERE "isActive" = true
        GROUP BY COALESCE(NULLIF(TRIM("paymentTerms"), ''), 'Net 30 Days')
        ORDER BY count DESC
        LIMIT 6
      `),

      // 10. Critical Stockout Risk (High-demand items where stock <= 10 or 0)
      prisma.$queryRawUnsafe(`
        WITH demand AS (
          SELECT 
            item->>'name' AS name,
            COUNT(v.id)::int AS voucher_count,
            SUM((item->>'qty')::numeric)::numeric AS qty_sold
          FROM busy_vouchers v,
          LATERAL jsonb_array_elements(v.items::jsonb) AS item
          WHERE (item->>'qty')::numeric > 0 
            AND item->>'name' NOT ILIKE '%freight%' 
            AND item->>'name' NOT ILIKE '%round off%'
          GROUP BY item->>'name'
          HAVING COUNT(v.id) >= 5
        )
        SELECT 
          p.id, p.name, p.sku, p.stock::int,
          COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
          p.price::numeric AS sale_price,
          c.name AS category_name,
          d.voucher_count,
          d.qty_sold
        FROM products p
        JOIN categories c ON p."categoryId" = c.id
        JOIN demand d ON LOWER(TRIM(p.name)) = LOWER(TRIM(d.name))
        WHERE p.stock <= 10 AND p."isActive" = true
        ORDER BY d.voucher_count DESC, p.stock ASC
        LIMIT 15
      `),

      // 11. Negative Stock Audit (Items with stock < 0)
      prisma.$queryRawUnsafe(`
        SELECT 
          p.id, p.name, p.sku, p.stock::int, 
          p.price::numeric AS sale_price,
          COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
          c.name AS category_name
        FROM products p
        JOIN categories c ON p."categoryId" = c.id
        WHERE p.stock < 0 AND p."isActive" = true
        ORDER BY p.stock ASC
        LIMIT 15
      `),

      // 12. Monthly Sales Revenue & Invoice Count Trend (Chronological)
      prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR("voucherDate", 'YYYY-MM') AS ym,
          TO_CHAR("voucherDate", 'Mon YY') AS label,
          COUNT(id)::int AS count,
          COALESCE(SUM("totalAmount"), 0)::numeric AS revenue,
          COALESCE(SUM("taxableAmount"), 0)::numeric AS taxable,
          COALESCE(SUM("taxAmount"), 0)::numeric AS tax
        FROM busy_vouchers
        WHERE "voucherType" = 9 AND "voucherDate" IS NOT NULL
        GROUP BY ym, label
        ORDER BY ym ASC
      `),

      // 13. Category Revenue Share from Invoices
      prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(c.name, 'Uncategorized') AS category_name,
          COUNT(DISTINCT v.id)::int AS invoice_count,
          COALESCE(SUM((item->>'qty')::numeric), 0)::numeric AS total_qty,
          COALESCE(SUM((item->>'amount')::numeric), 0)::numeric AS revenue
        FROM busy_vouchers v,
        LATERAL jsonb_array_elements(v.items::jsonb) AS item
        LEFT JOIN products p ON LOWER(TRIM(p.name)) = LOWER(TRIM(item->>'name'))
        LEFT JOIN categories c ON p."categoryId" = c.id
        WHERE (item->>'qty')::numeric > 0 
          AND item->>'name' NOT ILIKE '%freight%' 
          AND item->>'name' NOT ILIKE '%discount%'
          AND item->>'name' NOT ILIKE '%round off%'
        GROUP BY c.name
        ORDER BY revenue DESC NULLS LAST
        LIMIT 8
      `)
    ])

    const inv = (invKpi as any[])[0] || {}
    const sup = (supplierStats as any[])[0] || {}

    // Cross-match current stock for fast moving items
    const productStocks: any[] = await prisma.$queryRawUnsafe(`
      SELECT p.name, p.stock::int, COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p."categoryId" = c.id
      WHERE p."isActive" = true
    `)
    const stockMap = new Map<string, { stock: number; costPrice: number; category: string }>()
    for (const p of productStocks) {
      if (p.name) stockMap.set(p.name.trim().toLowerCase(), { stock: p.stock, costPrice: Number(p.cost_price), category: p.category_name || 'General' })
    }

    const enrichItem = (item: any) => {
      const match = stockMap.get((item.name || '').trim().toLowerCase())
      const currentStock = match ? match.stock : 0
      const costPrice = match ? match.costPrice : 0
      const category = match ? match.category : 'General'
      const monthlyRunRate = Number(item.qty_sold) / 12 || 1
      const daysOfSupply = currentStock > 0 ? Math.round((currentStock / monthlyRunRate) * 30) : 0

      return {
        name: item.name,
        sku: item.sku || item.name,
        voucherCount: Number(item.voucher_count),
        qtySold: Number(item.qty_sold),
        revenue: Number(item.revenue),
        avgRate: Number(item.avg_rate),
        currentStock,
        costPrice,
        category,
        daysOfSupply
      }
    }

    // Calculate total spend across top customers for Pareto percentage
    const customerList = (topCustomers as any[]).map(c => ({
      customerCode: c.customer_code,
      name: c.customer_name,
      invoiceCount: Number(c.invoice_count),
      totalSpend: Number(c.total_spend),
      avgInvoiceValue: Number(c.avg_invoice_value),
      lastInvoiceDate: c.last_invoice_date ? new Date(c.last_invoice_date).toISOString() : null
    }))

    const salesSummary = (salesKpi as any[])[0] || {}
    const totalSalesRevenue = Number(salesSummary.revenue || 0)
    const totalSalesCount = Number(salesSummary.count || 0)
    const totalTaxable = Number(salesSummary.taxable || 0)
    const totalTax = Number(salesSummary.tax || 0)

    // Process monthly sales trend with Month-over-Month calculation
    const monthlyTrend = (salesMonthlyTrend as any[]).map((row, idx, arr) => {
      const rev = Number(row.revenue || 0)
      const prevRev = idx > 0 ? Number(arr[idx - 1].revenue || 0) : 0
      const momGrowth = prevRev > 0 ? Number((((rev - prevRev) / prevRev) * 100).toFixed(1)) : null
      return {
        ym: row.ym,
        label: row.label,
        count: Number(row.count || 0),
        revenue: rev,
        taxable: Number(row.taxable || 0),
        tax: Number(row.tax || 0),
        avgInvoiceValue: Number(row.count) > 0 ? Math.round(rev / Number(row.count)) : 0,
        momGrowth
      }
    })

    // Process category revenue share
    const totalCatRevenue = (categoryRevenueShare as any[]).reduce((sum, c) => sum + Number(c.revenue || 0), 0)
    const categoryShare = (categoryRevenueShare as any[]).map(c => {
      const rev = Number(c.revenue || 0)
      const sharePct = totalCatRevenue > 0 ? Number(((rev / totalCatRevenue) * 100).toFixed(1)) : 0
      return {
        name: c.category_name,
        invoiceCount: Number(c.invoice_count || 0),
        totalQty: Number(c.total_qty || 0),
        revenue: rev,
        sharePct
      }
    })

    // Customer Pareto 80/20 tiering
    const top5Spend = customerList.slice(0, 5).reduce((sum, c) => sum + c.totalSpend, 0)
    const top10Spend = customerList.slice(0, 10).reduce((sum, c) => sum + c.totalSpend, 0)
    const top25Spend = customerList.reduce((sum, c) => sum + c.totalSpend, 0)
    const paretoConcentration = {
      top5Spend,
      top5SharePct: totalSalesRevenue > 0 ? Number(((top5Spend / totalSalesRevenue) * 100).toFixed(1)) : 0,
      top10Spend,
      top10SharePct: totalSalesRevenue > 0 ? Number(((top10Spend / totalSalesRevenue) * 100).toFixed(1)) : 0,
      top25Spend,
      top25SharePct: totalSalesRevenue > 0 ? Number(((top25Spend / totalSalesRevenue) * 100).toFixed(1)) : 0
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      lastSynced: lastSyncedSetting?.value || null,

      // ─── 1. SALES INTELLIGENCE ──────────────────────────────────────────
      sales: {
        totalRevenue: totalSalesRevenue,
        totalVouchers: totalSalesCount,
        taxableAmount: totalTaxable,
        taxAmount: totalTax,
        averageOrderValue: totalSalesCount > 0 ? Math.round(totalSalesRevenue / totalSalesCount) : 0,
        monthlyTrend,
        categoryRevenueShare: categoryShare,
        paretoConcentration,
        highPerformingRevenue: (topRevenueItems as any[]).map(enrichItem),
        highPerformingVolume: (fastMovingQty as any[]).map(enrichItem),
        topCustomers: customerList
      },

      // ─── 2. INVENTORY MOVEMENT & VELOCITY ────────────────────────────────
      movement: {
        fastMoving: (fastMovingQty as any[]).map(enrichItem),
        deadStock: (deadStockItems as any[]).map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          costPrice: Number(p.cost_price),
          salePrice: Number(p.sale_price),
          capitalLocked: Number(p.capital_locked),
          category: p.category_name
        })),
        totalDeadStockCapital: (deadStockItems as any[]).reduce((sum, p) => sum + Number(p.capital_locked || 0), 0),
        stockoutRisk: (criticalStockoutRisk as any[]).map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          costPrice: Number(p.cost_price),
          salePrice: Number(p.sale_price),
          category: p.category_name,
          voucherCount: Number(p.voucher_count),
          qtySold: Number(p.qty_sold)
        })),
        negativeStock: (negativeStockItems as any[]).map(p => ({
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

      // ─── 3. PURCHASE & SUPPLY CHAIN ─────────────────────────────────────
      purchases: {
        totalSuppliers: Number(sup.total_suppliers || 0),
        gstRegistered: Number(sup.gst_registered_count || 0),
        phoneVerified: Number(sup.phone_count || 0),
        paymentTerms: (paymentTermsDist as any[]).map(t => ({
          terms: t.terms,
          count: Number(t.count)
        })),
        categories: (categoryRows as any[]).map(c => {
          const costVal = Number(c.cost_value || 0)
          const saleVal = Number(c.sale_value || 0)
          const marginSpread = costVal > 0 ? Number((((saleVal - costVal) / costVal) * 100).toFixed(1)) : 0
          return {
            name: c.category_name,
            productCount: Number(c.product_count),
            totalUnits: Number(c.total_units),
            costValue: costVal,
            saleValue: saleVal,
            avgCostPrice: Number(c.avg_cost_price || 0),
            avgSalePrice: Number(c.avg_sale_price || 0),
            marginSpread
          }
        })
      },

      // ─── 4. GENERAL CATALOG OVERVIEW ────────────────────────────────────
      inventory: {
        totalProducts: Number(inv.total_products || 0),
        inStockCount: Number(inv.in_stock_count || 0),
        zeroStockCount: Number(inv.zero_stock_count || 0),
        negativeStockCount: Number(inv.negative_stock_count || 0),
        lowStockCount: Number(inv.low_stock_count || 0),
        totalCostValue: Number(inv.total_cost_value || 0),
        totalSaleValue: Number(inv.total_sale_value || 0)
      }
    }

    cachedAnalytics = result
    lastCacheTime = Date.now()
    return result
  } catch (error: any) {
    console.error('Analytics aggregation error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load analytics: ${error?.message || error}`
    })
  }
})
