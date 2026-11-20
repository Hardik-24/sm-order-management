import { prisma } from './prisma'

// In-memory cache for intelligence calculations (TTL: 2 minutes)
let cachedIntelligence: any = null
let lastCacheTime = 0
const CACHE_TTL_MS = 2 * 60 * 1000

export interface DraftPOItem {
  name: string
  sku?: string
  qty: number
  unitPrice?: number
}

/**
 * Core Intelligence Engine: Calculates all 5 mathematical engines from live database records.
 */
export async function calculateIntelligence(forceRefresh = false) {
  if (!forceRefresh && cachedIntelligence && Date.now() - lastCacheTime < CACHE_TTL_MS) {
    return cachedIntelligence
  }

  // 1. Fetch products catalog
  const products: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      p.id, 
      p.name, 
      p.sku, 
      p.stock::int, 
      COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
      p.price::numeric AS sale_price,
      c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p."categoryId" = c.id
    WHERE p."isActive" = true
      AND (c.name IS NULL OR c.name NOT IN ('GENERAL', 'Services', 'DISPLAY SHOWROOM', 'MACHINE'))
      AND p.name NOT ILIKE '%KIA CARNES%'
      AND p.name NOT ILIKE '%FORK LIFT%'
  `)

  // 2. Aggregate sales velocities across intervals (14 days, 30 days, 60 days, 90 days)
  // Incorporating Outlier Clipping (Winsorization) to prevent one-off bulk orders from skewing velocity
  const salesAggregates: any[] = await prisma.$queryRawUnsafe(`
    WITH raw_items AS (
      SELECT 
        LOWER(TRIM(item->>'name')) AS item_key,
        item->>'name' AS original_name,
        (item->>'qty')::numeric AS qty,
        (item->>'amount')::numeric AS amount,
        v."voucherDate" AS voucher_date,
        v.id AS voucher_id
      FROM busy_vouchers v,
      LATERAL jsonb_array_elements(v.items::jsonb) AS item
      WHERE v."voucherDate" >= NOW() - INTERVAL '90 days'
        AND (item->>'qty')::numeric > 0
        AND item->>'name' NOT ILIKE '%freight%'
        AND item->>'name' NOT ILIKE '%round off%'
        AND item->>'name' NOT ILIKE '%discount%'
    ),
    item_medians AS (
      SELECT 
        item_key,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY qty) AS median_qty
      FROM raw_items
      GROUP BY item_key
    )
    SELECT 
      r.item_key,
      MAX(r.original_name) AS original_name,
      -- Raw actual quantities
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '14 days' THEN r.qty ELSE 0 END) AS qty_14,
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '30 days' THEN r.qty ELSE 0 END) AS qty_30,
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '60 days' THEN r.qty ELSE 0 END) AS qty_60,
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '90 days' THEN r.qty ELSE 0 END) AS qty_90,
      -- Outlier-capped velocity quantities (caps orders > 3.5x median or 25 units)
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '14 days' 
               THEN LEAST(r.qty, GREATEST(COALESCE(m.median_qty, 10) * 3.5, 25)) 
               ELSE 0 END) AS capped_qty_14,
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '30 days' 
               THEN LEAST(r.qty, GREATEST(COALESCE(m.median_qty, 10) * 3.5, 25)) 
               ELSE 0 END) AS capped_qty_30,
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '60 days' 
               THEN LEAST(r.qty, GREATEST(COALESCE(m.median_qty, 10) * 3.5, 25)) 
               ELSE 0 END) AS capped_qty_60,
      -- Historical validation metrics: Past 7-day actual vs prior 14d pace
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '7 days' THEN r.qty ELSE 0 END) AS actual_qty_7,
      SUM(CASE WHEN r.voucher_date >= NOW() - INTERVAL '21 days' AND r.voucher_date < NOW() - INTERVAL '7 days' 
               THEN r.qty ELSE 0 END) AS prior_qty_14_to_7,
      SUM(r.amount) AS revenue_90,
      COUNT(DISTINCT r.voucher_id) AS voucher_count_90,
      MAX(r.voucher_date) AS last_sale_date
    FROM raw_items r
    JOIN item_medians m ON r.item_key = m.item_key
    GROUP BY r.item_key
  `)

  const salesMap = new Map<string, any>()
  for (const row of salesAggregates) {
    salesMap.set(row.item_key, {
      name: row.original_name,
      qty14: Number(row.qty_14 || 0),
      qty30: Number(row.qty_30 || 0),
      qty60: Number(row.qty_60 || 0),
      qty90: Number(row.qty_90 || 0),
      cappedQty14: Number(row.capped_qty_14 || 0),
      cappedQty30: Number(row.capped_qty_30 || 0),
      cappedQty60: Number(row.capped_qty_60 || 0),
      actualQty7: Number(row.actual_qty_7 || 0),
      priorQty14to7: Number(row.prior_qty_14_to_7 || 0),
      revenue90: Number(row.revenue_90 || 0),
      voucherCount: Number(row.voucher_count_90 || 0),
      lastSaleDate: row.last_sale_date
    })
  }

  // 3. Process Engine 1 (Replenishment & Runway), Engine 2 (Trends & Forecasts), and Engine 3 (Profitability)
  const replenishmentList: any[] = []
  const trendsList: any[] = []
  const profitabilityList: any[] = []

  let totalCapitalLockedDead = 0
  let totalCapitalLockedSlow = 0
  let criticalReordersCount = 0
  let growingCount = 0
  let decliningCount = 0

  const LEAD_TIME_DAYS = 7 // Standard default lead time in days
  const TARGET_BUFFER_DAYS = 21 // Desired stock target when replenishing

  for (const prod of products) {
    const key = (prod.name || '').trim().toLowerCase()
    const sales = salesMap.get(key) || { 
      qty14: 0, qty30: 0, qty60: 0, qty90: 0, 
      cappedQty14: 0, cappedQty30: 0, cappedQty60: 0, 
      actualQty7: 0, priorQty14to7: 0,
      revenue90: 0, voucherCount: 0, lastSaleDate: null 
    }
    
    const stock = Number(prod.stock || 0)
    const costPrice = Number(prod.cost_price || 0)
    const salePrice = Number(prod.sale_price || 0)

    // Velocities: Use outlier-capped quantities for future forecast rate
    const ads14 = Number((sales.cappedQty14 / 14).toFixed(2))
    const ads30 = Number((sales.cappedQty30 / 30).toFixed(2))
    const ads60 = Number((sales.cappedQty60 / 60).toFixed(2))
    const isIntermittent = sales.voucherCount <= 3 && sales.voucherCount > 0

    // Active ADS for replenishment buffer
    const activeAds = isIntermittent
      ? Number((sales.qty90 / 90).toFixed(2))
      : (ads30 > 0 ? ads30 : (ads14 > 0 ? ads14 : Number((sales.qty90 / 90).toFixed(2))))

    // --- Engine 2: Sales Trend Classification ---
    let trend: 'GROWING' | 'STABLE' | 'DECLINING' | 'NOT_MOVING' = 'NOT_MOVING'
    let velocityRatio = 1.0

    if (sales.qty60 === 0 && sales.qty14 === 0) {
      trend = 'NOT_MOVING'
      velocityRatio = 0
    } else if (ads60 > 0) {
      velocityRatio = Number((ads14 / ads60).toFixed(2))
      if (velocityRatio >= 1.25) trend = 'GROWING'
      else if (velocityRatio <= 0.75) trend = 'DECLINING'
      else trend = 'STABLE'
    } else if (ads14 > 0) {
      trend = 'GROWING'
      velocityRatio = 2.0
    }

    if (trend === 'GROWING') growingCount++
    if (trend === 'DECLINING') decliningCount++

    // --- Demand Forecasting (7, 15, 30 days) with Outlier Resilience ---
    let blendRate = 0
    if (isIntermittent) {
      blendRate = Number((sales.qty90 / 90).toFixed(2))
    } else {
      blendRate = trend === 'DECLINING' ? ads14 : Number(((ads14 * 0.6) + (ads30 * 0.4)).toFixed(2))
    }

    const forecast7d = Math.ceil(blendRate * 7)
    const forecast15d = Math.ceil(blendRate * 15)
    const forecast30d = Math.ceil(blendRate * 30)

    // --- Engine 1: Replenishment & Runway ---
    // Daily variance approximation for safety stock
    const stdDev = activeAds > 0 ? Math.max(0.5, Number((Math.sqrt(activeAds) * 1.2).toFixed(2))) : 0
    const safetyStock = activeAds > 0 ? Math.ceil(1.65 * stdDev * Math.sqrt(LEAD_TIME_DAYS)) : 0
    const reorderPoint = Math.ceil((activeAds * LEAD_TIME_DAYS) + safetyStock)

    let runwayDays = 0
    if (activeAds > 0) {
      runwayDays = stock > 0 ? Math.round(stock / activeAds) : 0
    } else {
      runwayDays = stock > 0 ? 999 : 0
    }

    let status: 'STOCKOUT' | 'CRITICAL_RUNOUT' | 'REORDER_DUE' | 'HEALTHY' | 'OVERSTOCKED' | 'DEAD_STOCK' = 'HEALTHY'
    if (stock <= 0) {
      status = 'STOCKOUT'
    } else if (activeAds === 0) {
      status = 'DEAD_STOCK'
      totalCapitalLockedDead += stock * costPrice
    } else if (stock <= safetyStock || runwayDays < 7) {
      status = 'CRITICAL_RUNOUT'
      criticalReordersCount++
    } else if (stock <= reorderPoint || runwayDays <= 14) {
      status = 'REORDER_DUE'
      criticalReordersCount++
    } else if (runwayDays > 60) {
      status = 'OVERSTOCKED'
      const excessUnits = Math.max(0, stock - Math.ceil(activeAds * 45))
      totalCapitalLockedSlow += excessUnits * costPrice
    } else {
      status = 'HEALTHY'
    }

    const suggestedPOQty = (status === 'STOCKOUT' || status === 'CRITICAL_RUNOUT' || status === 'REORDER_DUE')
      ? Math.max(0, Math.ceil(reorderPoint + (activeAds * TARGET_BUFFER_DAYS) - Math.max(0, stock)))
      : 0

    // Add to Replenishment array
    if (status !== 'HEALTHY' || activeAds > 0) {
      replenishmentList.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku || prod.name,
        category: prod.category_name || 'General',
        stock,
        costPrice,
        salePrice,
        activeAds,
        runwayDays,
        safetyStock,
        reorderPoint,
        suggestedPOQty,
        status,
        trend
      })
    }

    // Add to Trends array
    trendsList.push({
      id: prod.id,
      name: prod.name,
      sku: prod.sku || prod.name,
      category: prod.category_name || 'General',
      trend,
      velocityRatio,
      ads14,
      ads30,
      ads60,
      forecast7d,
      forecast15d,
      forecast30d,
      qty30: sales.qty30,
      revenue90: sales.revenue90
    })

    // --- Engine 3: Profitability & Capital Quadrants ---
    const grossMarginPct = costPrice > 0 ? Number((((salePrice - costPrice) / costPrice) * 100).toFixed(1)) : 0
    let quadrant: 'STAR' | 'CASH_COW' | 'NICHE_GEM' | 'DRAIN' = 'DRAIN'

    // Margin threshold: 12%, Volume threshold: 15 units/month
    const isHighMargin = grossMarginPct >= 12
    const isHighVolume = sales.qty30 >= 15

    if (isHighVolume && isHighMargin) quadrant = 'STAR'
    else if (isHighVolume && !isHighMargin) quadrant = 'CASH_COW'
    else if (!isHighVolume && isHighMargin) quadrant = 'NICHE_GEM'
    else quadrant = 'DRAIN'

    profitabilityList.push({
      id: prod.id,
      name: prod.name,
      sku: prod.sku || prod.name,
      category: prod.category_name || 'General',
      stock,
      costPrice,
      salePrice,
      grossMarginPct,
      quadrant,
      qty30: sales.qty30,
      revenue90: sales.revenue90,
      capitalLocked: stock * costPrice
    })
  }

  // Sort replenishment: critical items first, then by lowest runway
  replenishmentList.sort((a, b) => {
    const priority = { STOCKOUT: 0, CRITICAL_RUNOUT: 1, REORDER_DUE: 2, OVERSTOCKED: 3, DEAD_STOCK: 4, HEALTHY: 5 }
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status]
    }
    return a.runwayDays - b.runwayDays
  })

  // 4. Engine 4: Credit-Safe Customer Segmentation (RFM) & Cross-Selling Pairs
  const customerStats: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      COALESCE(NULLIF(TRIM(v."customerCode"), ''), 'CASH') AS customer_code,
      v."customerName" AS customer_name,
      COUNT(v.id)::int AS frequency,
      SUM(v."totalAmount")::numeric AS monetary,
      MAX(v."voucherDate") AS last_invoice_date,
      EXTRACT(DAY FROM (NOW() - MAX(v."voucherDate")))::int AS recency_days
    FROM busy_vouchers v
    WHERE v."voucherDate" IS NOT NULL
    GROUP BY COALESCE(NULLIF(TRIM(v."customerCode"), ''), 'CASH'), v."customerName"
    HAVING SUM(v."totalAmount") > 0
    ORDER BY monetary DESC
  `)

  // Check Tally Receivables Data for credit risk integration
  const tallySetting = await prisma.systemSetting.findUnique({
    where: { key: 'tally_receivables_data' }
  })
  const tallyData = tallySetting?.value ? JSON.parse(tallySetting.value) : null
  const tallyPartyMap = new Map<string, { closingBalance: number; overdueBills: number }>()

  if (tallyData && Array.isArray(tallyData.parties)) {
    for (const p of tallyData.parties) {
      const clean = (p.party || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      tallyPartyMap.set(clean, {
        closingBalance: Number(p.closingBalance || 0),
        overdueBills: Number(p.billsOverdue || 0)
      })
    }
  }

  const customerRFM = customerStats.map(c => {
    const recency = Number(c.recency_days || 0)
    const frequency = Number(c.frequency || 0)
    const monetary = Number(c.monetary || 0)

    let segment: 'CHAMPION' | 'LOYAL' | 'POTENTIAL' | 'AT_RISK' | 'HIBERNATING' = 'POTENTIAL'
    if (recency <= 21 && frequency >= 8) segment = 'CHAMPION'
    else if (recency <= 35 && frequency >= 4) segment = 'LOYAL'
    else if (recency > 35 && frequency >= 4) segment = 'AT_RISK'
    else if (recency > 75) segment = 'HIBERNATING'
    else segment = 'POTENTIAL'

    // Check credit risk
    const cleanName = (c.customer_name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const tallyMatch = tallyPartyMap.get(cleanName)
    const isCreditRisky = tallyMatch ? (tallyMatch.overdueBills > 0 || tallyMatch.closingBalance > 150000) : false

    return {
      customerCode: c.customer_code,
      customerName: c.customer_name,
      recencyDays: recency,
      frequency,
      monetary,
      lastInvoiceDate: c.last_invoice_date,
      segment,
      isCreditRisky,
      overdueBalance: tallyMatch ? tallyMatch.closingBalance : 0,
      overdueBillsCount: tallyMatch ? tallyMatch.overdueBills : 0
    }
  })

  // Market Basket Cross-Selling (Product Pair Affinity)
  const multiItemVouchers = await prisma.busyVoucher.findMany({
    where: { itemCount: { gte: 2 } },
    select: { items: true },
    take: 350,
    orderBy: { voucherDate: 'desc' }
  })

  const pairCounts = new Map<string, number>()
  const singleCounts = new Map<string, number>()

  for (const v of multiItemVouchers) {
    const rawItems = Array.isArray(v.items) ? v.items : []
    const itemNames = [...new Set(
      rawItems
        .map((i: any) => (i.name || '').trim())
        .filter((n: string) => n && !/freight|round off|discount/i.test(n))
    )]

    for (let i = 0; i < itemNames.length; i++) {
      const a = itemNames[i]
      singleCounts.set(a, (singleCounts.get(a) || 0) + 1)
      for (let j = i + 1; j < itemNames.length; j++) {
        const b = itemNames[j]
        const pairKey = a < b ? `${a} ||| ${b}` : `${b} ||| ${a}`
        pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1)
      }
    }
  }

  const crossSellingPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([key, count]) => {
      const [itemA, itemB] = key.split(' ||| ')
      const countA = singleCounts.get(itemA) || 1
      const confidence = Math.round((count / countA) * 100)
      return { itemA, itemB, coOccurrences: count, confidence: `${confidence}%` }
    })

  // 5. Engine 5: Anomaly & Risk Watchdog
  const anomalies: any[] = []

  // Check 5a: Churn risk anomalies on high-value customers
  for (const cust of customerRFM) {
    if (cust.segment === 'AT_RISK' && cust.monetary >= 200000 && cust.recencyDays >= 35) {
      anomalies.push({
        type: 'CUSTOMER_CHURN_RISK',
        severity: 'HIGH',
        title: `High-Value Customer Inactive: ${cust.customerName}`,
        detail: `Customer spent ₹${(cust.monetary / 100000).toFixed(2)} Lakhs across ${cust.frequency} orders, but has had 0 purchases in the last ${cust.recencyDays} days.`,
        action: 'Schedule proactive account manager outreach.'
      })
    }
  }

  // Check 5b: Rapid depletion surge on stock
  for (const item of replenishmentList) {
    if ((item.status === 'CRITICAL_RUNOUT' || item.status === 'STOCKOUT') && item.trend === 'GROWING') {
      anomalies.push({
        type: 'DEMAND_SURGE_STOCKOUT',
        severity: 'CRITICAL',
        title: `Surging Demand with Stockout Threat: ${item.name}`,
        detail: `Demand velocity is up +${Math.round((item.velocityRatio - 1) * 100)}% while only ${item.runwayDays} days of inventory remain. Reorder point (${item.reorderPoint} units) breached.`,
        action: `Expedite purchase order for ${item.suggestedPOQty} units.`
      })
    }
  }

  // Check 5c: Margin leakage on items
  for (const p of profitabilityList) {
    if (p.grossMarginPct < 2 && p.costPrice > 0 && p.qty30 >= 10) {
      anomalies.push({
        type: 'MARGIN_LEAKAGE',
        severity: 'MEDIUM',
        title: `Zero/Low Margin Velocity: ${p.name}`,
        detail: `Gross margin spread is only ${p.grossMarginPct}%. High handling volume with negligible net profit contribution.`,
        action: 'Review sales discounts or renegotiate vendor supply pricing.'
      })
    }
  }

  // 6. Live Weekly Forecast Validation Scorecard (Past 7 Days Realized vs Prior Week Forecast)
  let totalPredicted7d = 0
  let totalActual7d = 0
  const validatedItems: any[] = []

  for (const [key, s] of salesMap.entries()) {
    const act7 = Number(s.actualQty7 || 0)
    let pred7 = 0
    if (s.voucherCount <= 3) {
      pred7 = Math.ceil((Number(s.qty90 || 0) / 90) * 7)
    } else {
      pred7 = Math.ceil((Number(s.priorQty14to7 || 0) / 14) * 7)
    }

    if (pred7 > 0 || act7 > 0) {
      totalPredicted7d += pred7
      totalActual7d += act7

      const diff = act7 - pred7
      const maxVal = Math.max(act7, pred7)
      const accuracyPct = maxVal > 0 ? Math.round((1 - Math.abs(diff) / maxVal) * 100) : 100

      let status: 'EXACT_MATCH' | 'CLOSE' | 'DEMAND_SURGE' | 'DEMAND_DIP' = 'CLOSE'
      if (accuracyPct >= 85) status = 'EXACT_MATCH'
      else if (accuracyPct >= 70) status = 'CLOSE'
      else if (act7 > pred7) status = 'DEMAND_SURGE'
      else status = 'DEMAND_DIP'

      validatedItems.push({
        name: s.name || key,
        predicted: pred7,
        actual: act7,
        variance: diff,
        accuracyPct,
        status,
        isSpike: act7 > (pred7 * 3.5) && act7 >= 40
      })
    }
  }

  validatedItems.sort((a, b) => b.actual - a.actual)
  const catalogAccuracy = totalActual7d > 0
    ? Math.round((1 - Math.abs(totalActual7d - totalPredicted7d) / Math.max(totalActual7d, totalPredicted7d)) * 100)
    : 100

  const weeklyScorecard = {
    period: 'Past 7-Day Performance (Forecast vs Actual Invoices)',
    catalogAccuracy,
    totalPredictedUnits: totalPredicted7d,
    totalActualUnits: totalActual7d,
    surgeCount: validatedItems.filter(i => i.status === 'DEMAND_SURGE').length,
    matchCount: validatedItems.filter(i => i.status === 'EXACT_MATCH' || i.status === 'CLOSE').length,
    topValidatedItems: validatedItems.slice(0, 15)
  }

  const result = {
    success: true,
    timestamp: new Date().toISOString(),
    kpis: {
      criticalReordersCount,
      totalCapitalLockedDead: Math.round(totalCapitalLockedDead),
      totalCapitalLockedSlow: Math.round(totalCapitalLockedSlow),
      totalCapitalAtRisk: Math.round(totalCapitalLockedDead + totalCapitalLockedSlow),
      growingCount,
      decliningCount,
      activeAnomaliesCount: anomalies.length
    },
    weeklyScorecard,
    replenishment: replenishmentList,
    trends: trendsList,
    profitability: profitabilityList,
    customers: customerRFM.slice(0, 50),
    crossSellingPairs,
    anomalies: anomalies.slice(0, 20)
  }

  cachedIntelligence = result
  lastCacheTime = Date.now()
  return result
}

/**
 * PO Pre-Flight Auditor & Simulator:
 * Evaluates draft purchase order items against inventory, runway, trends, and historical purchase prices.
 */
export async function simulatePurchaseOrder(items: DraftPOItem[]) {
  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No purchase order items provided for audit.'
    }
  }

  // 1. Fetch live product data for items
  const productNames = items.map(i => (i.name || '').trim().toLowerCase())
  const products: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      p.id, 
      p.name, 
      p.sku, 
      p.stock::int, 
      COALESCE(p."costPrice", p.price, 0)::numeric AS cost_price,
      p.price::numeric AS sale_price
    FROM products p
    WHERE p."isActive" = true
  `)
  const productMap = new Map<string, any>()
  for (const p of products) {
    productMap.set((p.name || '').trim().toLowerCase(), p)
  }

  // 2. Fetch sales velocity over last 30 & 60 days
  const velocities: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      LOWER(TRIM(item->>'name')) AS item_key,
      SUM(CASE WHEN v."voucherDate" >= NOW() - INTERVAL '14 days' THEN (item->>'qty')::numeric ELSE 0 END) AS qty_14,
      SUM(CASE WHEN v."voucherDate" >= NOW() - INTERVAL '30 days' THEN (item->>'qty')::numeric ELSE 0 END) AS qty_30,
      SUM(CASE WHEN v."voucherDate" >= NOW() - INTERVAL '60 days' THEN (item->>'qty')::numeric ELSE 0 END) AS qty_60
    FROM busy_vouchers v,
    LATERAL jsonb_array_elements(v.items::jsonb) AS item
    WHERE v."voucherDate" >= NOW() - INTERVAL '60 days'
      AND (item->>'qty')::numeric > 0
    GROUP BY LOWER(TRIM(item->>'name'))
  `)
  const velocityMap = new Map<string, { ads: number; ads14: number; ads60: number }>()
  for (const v of velocities) {
    const qty30 = Number(v.qty_30 || 0)
    const ads = Number((qty30 / 30).toFixed(2))
    const ads14 = Number((Number(v.qty_14 || 0) / 14).toFixed(2))
    const ads60 = Number((Number(v.qty_60 || 0) / 60).toFixed(2))
    velocityMap.set(v.item_key, { ads, ads14, ads60 })
  }

  // 3. Fetch recent purchase prices from busy_purchases for price inflation check
  const recentPurchases = await prisma.busyPurchase.findMany({
    select: {
      voucherDate: true,
      supplierName: true,
      items: true
    },
    orderBy: { voucherDate: 'desc' },
    take: 400
  })

  const priceHistoryMap = new Map<string, { rate: number; supplier: string; date: Date }>()
  for (const p of recentPurchases) {
    const rawItems = Array.isArray(p.items) ? p.items : []
    for (const it of rawItems) {
      const k = (it.name || '').trim().toLowerCase()
      if (!k || priceHistoryMap.has(k)) continue
      priceHistoryMap.set(k, {
        rate: Number(it.rate || 0),
        supplier: p.supplierName,
        date: p.voucherDate
      })
    }
  }

  // 4. Run Audit on each item
  let totalScore = 100
  let totalPOValue = 0
  let totalRecommendedPOValue = 0
  let capitalSavings = 0

  const auditedItems: any[] = []
  const LEAD_TIME = 7 // days

  for (const item of items) {
    const nameKey = (item.name || '').trim().toLowerCase()
    const prod = productMap.get(nameKey)
    const vel = velocityMap.get(nameKey) || { ads: 0, ads14: 0, ads60: 0 }
    const lastPurchase = priceHistoryMap.get(nameKey)

    const proposedQty = Number(item.qty || 0)
    const currentStock = prod ? Number(prod.stock || 0) : 0
    const costPrice = prod ? Number(prod.cost_price || 0) : 0
    const quotedRate = item.unitPrice != null && item.unitPrice > 0 ? Number(item.unitPrice) : (lastPurchase?.rate || costPrice)
    const lineTotal = proposedQty * quotedRate
    totalPOValue += lineTotal

    const activeAds = vel.ads > 0 ? vel.ads : (vel.ads14 > 0 ? vel.ads14 : 0)
    const projectedRunwayDays = activeAds > 0 ? Math.round((currentStock + proposedQty) / activeAds) : (proposedQty > 0 ? 999 : 0)
    const currentRunwayDays = activeAds > 0 ? Math.round(currentStock / activeAds) : 0

    // Trend check
    let trend = 'STABLE'
    if (vel.ads60 > 0 && (vel.ads14 / vel.ads60) <= 0.75) trend = 'DECLINING'
    else if (activeAds === 0) trend = 'NOT_MOVING'
    else if (vel.ads60 > 0 && (vel.ads14 / vel.ads60) >= 1.25) trend = 'GROWING'

    // Status & Adjustments
    const issues: string[] = []
    let suggestedQty = proposedQty
    let itemStatus: 'OPTIMAL' | 'OVER_ORDERING' | 'UNDER_ORDERING' | 'DECLINING_RISK' | 'PRICE_INCREASE' = 'OPTIMAL'

    // Check 1: Over-ordering / excessive runway (> 45 days)
    if (activeAds > 0 && projectedRunwayDays > 45) {
      itemStatus = 'OVER_ORDERING'
      suggestedQty = Math.max(0, Math.ceil((activeAds * 30) - currentStock))
      const excessDays = projectedRunwayDays - 45
      totalScore -= Math.min(15, Math.ceil(excessDays / 5))
      issues.push(`Over-ordering: Will result in ${projectedRunwayDays} days of supply (Target: 30 days). Suggest reducing to ${suggestedQty} units.`)
    } else if (activeAds === 0 && proposedQty > 0) {
      itemStatus = 'OVER_ORDERING'
      suggestedQty = 0
      totalScore -= 20
      issues.push(`Non-moving product: 0 sales in last 60 days. Ordering more creates dead stock.`)
    }

    // Check 2: Under-ordering / Stockout risk (< 15 days runway)
    if (activeAds > 0 && projectedRunwayDays < (LEAD_TIME + 5)) {
      itemStatus = 'UNDER_ORDERING'
      suggestedQty = Math.ceil((activeAds * 30) - currentStock)
      totalScore -= 12
      issues.push(`Under-ordering: Only ${projectedRunwayDays} days of runway. Risk of stockout during 7-day supplier lead time.`)
    }

    // Check 3: Trend check
    if (trend === 'DECLINING' && proposedQty > 15) {
      itemStatus = 'DECLINING_RISK'
      totalScore -= 10
      issues.push(`Sales are declining by >25%. Lower order volume recommended to avoid excess accumulation.`)
    }

    // Check 4: Cost inflation check
    let priceVariancePct = 0
    if (lastPurchase && quotedRate > lastPurchase.rate * 1.03) {
      priceVariancePct = Number((((quotedRate - lastPurchase.rate) / lastPurchase.rate) * 100).toFixed(1))
      totalScore -= Math.min(15, Math.ceil(priceVariancePct / 2))
      issues.push(`Price Alert: Quoted ₹${quotedRate} is +${priceVariancePct}% higher than last purchase invoice (₹${lastPurchase.rate} from ${lastPurchase.supplier}).`)
    }

    const recommendedLineTotal = suggestedQty * quotedRate
    totalRecommendedPOValue += recommendedLineTotal
    if (lineTotal > recommendedLineTotal) {
      capitalSavings += (lineTotal - recommendedLineTotal)
    }

    auditedItems.push({
      name: item.name,
      proposedQty,
      suggestedQty,
      unitPrice: quotedRate,
      lastPurchasePrice: lastPurchase ? lastPurchase.rate : costPrice,
      lastSupplier: lastPurchase ? lastPurchase.supplier : null,
      currentStock,
      activeAds,
      projectedRunwayDays,
      itemStatus,
      trend,
      issues
    })
  }

  // Ensure score is clamped between 10 and 100
  const finalScore = Math.max(10, Math.min(100, totalScore))
  let grade = 'A+'
  if (finalScore >= 90) grade = 'A+'
  else if (finalScore >= 80) grade = 'A'
  else if (finalScore >= 70) grade = 'B'
  else if (finalScore >= 60) grade = 'C'
  else grade = 'NEEDS REVISION'

  return {
    success: true,
    score: finalScore,
    grade,
    summary: {
      totalPOValue: Math.round(totalPOValue),
      recommendedPOValue: Math.round(totalRecommendedPOValue),
      capitalSavings: Math.round(capitalSavings),
      itemCount: items.length,
      overorderedCount: auditedItems.filter(i => i.itemStatus === 'OVER_ORDERING').length,
      underorderedCount: auditedItems.filter(i => i.itemStatus === 'UNDER_ORDERING').length,
      priceAlertCount: auditedItems.filter(i => i.issues.some((iss: string) => iss.includes('Price Alert'))).length
    },
    items: auditedItems
  }
}
