import { requireRole } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // 1. Strictly enforce ADMIN role: non-admins cannot access purchase pricing or margins
  requireRole(event, ['ADMIN'])

  const productId = event.context.params?.id
  if (!productId) {
    throw createError({ statusCode: 400, message: 'Missing product ID' })
  }

  // 2. Fetch product identity
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      price: true,
      costPrice: true,
      stock: true
    }
  })

  if (!product) {
    throw createError({ statusCode: 404, message: 'Product not found' })
  }

  const query = getQuery(event)
  const limit = Math.min(parseInt(query.limit as string) || 10, 30)

  // 3. Query Recent Purchases from busy_purchases line items
  let purchases: Array<{
    voucherNo: string
    voucherDate: Date
    supplierName: string
    supplierCode: string | null
    qty: number
    rate: number
    amount: number
    isTaxInclusive: boolean
  }> = []

  try {
    const rawPurchases = await prisma.$queryRaw<any[]>`
      SELECT p."voucherNo", p."voucherDate", p."supplierName", p."supplierCode",
             COALESCE((item->>'qty')::numeric, 0) as qty, 
             COALESCE((item->>'rate')::numeric, 0) as rate, 
             COALESCE((item->>'amount')::numeric, 0) as amount, 
             COALESCE((item->>'isTaxInclusive')::boolean, true) as "isTaxInclusive"
      FROM busy_purchases p,
           jsonb_array_elements(p.items) AS item
      WHERE item->>'name' ILIKE ${product.name}
         OR (${product.sku || ''} != '' AND item->>'sku' = ${product.sku})
      ORDER BY p."voucherDate" DESC
      LIMIT ${limit};
    `
    purchases = (rawPurchases || []).map((r) => ({
      voucherNo: r.voucherNo,
      voucherDate: r.voucherDate,
      supplierName: r.supplierName,
      supplierCode: r.supplierCode || null,
      qty: Number(r.qty),
      rate: Number(r.rate),
      amount: Number(r.amount),
      isTaxInclusive: Boolean(r.isTaxInclusive)
    }))
  } catch (err) {
    console.error('Error fetching product purchase history:', err)
  }

  // 4. Query Recent Sales from busy_vouchers line items
  let sales: Array<{
    voucherNo: string
    voucherDate: Date
    customerName: string
    customerCode: string | null
    qty: number
    rate: number
    amount: number
    isTaxInclusive: boolean
  }> = []

  try {
    const rawSales = await prisma.$queryRaw<any[]>`
      SELECT v."voucherNo", v."voucherDate", v."customerName", v."customerCode",
             COALESCE((item->>'qty')::numeric, 0) as qty, 
             COALESCE((item->>'rate')::numeric, 0) as rate, 
             COALESCE((item->>'amount')::numeric, 0) as amount, 
             COALESCE((item->>'isTaxInclusive')::boolean, true) as "isTaxInclusive"
      FROM busy_vouchers v,
           jsonb_array_elements(v.items) AS item
      WHERE item->>'name' ILIKE ${product.name}
         OR (${product.sku || ''} != '' AND item->>'sku' = ${product.sku})
      ORDER BY v."voucherDate" DESC
      LIMIT ${limit};
    `
    sales = (rawSales || []).map((r) => ({
      voucherNo: r.voucherNo,
      voucherDate: r.voucherDate,
      customerName: r.customerName,
      customerCode: r.customerCode || null,
      qty: Number(r.qty),
      rate: Number(r.rate),
      amount: Number(r.amount),
      isTaxInclusive: Boolean(r.isTaxInclusive)
    }))
  } catch (err) {
    console.error('Error fetching product sales history:', err)
  }

  // 5. Calculate Price Intelligence Summary
  const lastPurchase = purchases.length > 0 ? purchases[0] : null
  const lastSale = sales.length > 0 ? sales[0] : null

  const purchaseRates = purchases.map((p) => p.rate).filter((r) => r > 0)
  const salesRates = sales.map((s) => s.rate).filter((r) => r > 0)

  const avgPurchaseRate = purchaseRates.length > 0
    ? Number((purchaseRates.reduce((a, b) => a + b, 0) / purchaseRates.length).toFixed(2))
    : null

  const avgSaleRate = salesRates.length > 0
    ? Number((salesRates.reduce((a, b) => a + b, 0) / salesRates.length).toFixed(2))
    : null

  let marginAmount: number | null = null
  let marginPercent: number | null = null
  if (lastSale && lastPurchase && lastPurchase.rate > 0) {
    marginAmount = Number((lastSale.rate - lastPurchase.rate).toFixed(2))
    marginPercent = Number((((lastSale.rate - lastPurchase.rate) / lastPurchase.rate) * 100).toFixed(1))
  }

  return {
    success: true,
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      price: Number(product.price),
      costPrice: product.costPrice ? Number(product.costPrice) : null,
      stock: product.stock
    },
    summary: {
      lastPurchase,
      lastSale,
      marginAmount,
      marginPercent,
      avgPurchaseRate,
      avgSaleRate,
      totalPurchasesFound: purchases.length,
      totalSalesFound: sales.length
    },
    purchases,
    sales
  }
})
