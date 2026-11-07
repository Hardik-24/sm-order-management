import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const productId = event.context.params?.id
  if (!productId) {
    throw createError({ statusCode: 400, message: 'Missing product ID' })
  }

  const query = getQuery(event)
  const limit = Math.min(parseInt(query.limit as string) || 100, 300)
  const customerId = (query.customerId as string | undefined)?.trim() || undefined

  // 1. Fetch product basic info
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      unit: true,
      taxRate: true
    }
  })

  if (!product) {
    throw createError({ statusCode: 404, message: 'Product not found' })
  }

  // Look up target customer if customerId provided
  let targetCustomer: any = null
  if (customerId) {
    targetCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        company: true,
        customerCode: true,
        city: true,
        phone: true
      }
    })
  }

  // 2. Query party-wise latest billed prices from HistoricalPrice
  const historicalPrices = await prisma.historicalPrice.findMany({
    where: { productId },
    take: limit,
    orderBy: { voucherDate: 'desc' },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          company: true,
          customerCode: true,
          city: true,
          phone: true
        }
      }
    }
  })

  // 3. Query all individual voucher entries from busy_vouchers line items
  let allVouchers: Array<{
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
    const rawVouchers = await prisma.$queryRaw<any[]>`
      SELECT v."voucherNo", v."voucherDate", v."customerName", v."customerCode",
             COALESCE((item->>'qty')::numeric, 0) as qty, 
             COALESCE((item->>'rate')::numeric, 0) as rate, 
             COALESCE((item->>'amount')::numeric, 0) as amount, 
             COALESCE((item->>'isTaxInclusive')::boolean, true) as "isTaxInclusive"
      FROM busy_vouchers v,
           jsonb_array_elements(v.items) AS item
      WHERE item->>'name' ILIKE ${product.name}
      ORDER BY v."voucherDate" DESC
      LIMIT ${limit};
    `
    allVouchers = (rawVouchers || []).map((r) => ({
      voucherNo: r.voucherNo,
      voucherDate: r.voucherDate,
      customerName: r.customerName,
      customerCode: r.customerCode,
      qty: Number(r.qty),
      rate: Number(r.rate),
      amount: Number(r.amount),
      isTaxInclusive: Boolean(r.isTaxInclusive)
    }))
  } catch (err) {
    console.error('Error fetching raw busy vouchers for product:', err)
  }

  // 4. Query or filter current party vouchers specifically
  let currentPartyVouchers: typeof allVouchers = []
  if (targetCustomer) {
    currentPartyVouchers = allVouchers.filter((v) => {
      const matchCode = targetCustomer.customerCode && v.customerCode === targetCustomer.customerCode
      const matchName = targetCustomer.name && v.customerName && v.customerName.trim().toLowerCase() === targetCustomer.name.trim().toLowerCase()
      const matchComp = targetCustomer.company && v.customerName && v.customerName.trim().toLowerCase() === targetCustomer.company.trim().toLowerCase()
      return matchCode || matchName || matchComp
    })

    // If not found in the initial limit, do a targeted query for this customer
    if (currentPartyVouchers.length === 0 && (targetCustomer.customerCode || targetCustomer.name)) {
      try {
        const custRaw = await prisma.$queryRaw<any[]>`
          SELECT v."voucherNo", v."voucherDate", v."customerName", v."customerCode",
                 COALESCE((item->>'qty')::numeric, 0) as qty, 
                 COALESCE((item->>'rate')::numeric, 0) as rate, 
                 COALESCE((item->>'amount')::numeric, 0) as amount, 
                 COALESCE((item->>'isTaxInclusive')::boolean, true) as "isTaxInclusive"
          FROM busy_vouchers v,
               jsonb_array_elements(v.items) AS item
          WHERE item->>'name' ILIKE ${product.name}
            AND (
              (${targetCustomer.customerCode || ''} != '' AND v."customerCode" = ${targetCustomer.customerCode})
              OR v."customerName" ILIKE ${targetCustomer.name}
              OR (${targetCustomer.company || ''} != '' AND v."customerName" ILIKE ${targetCustomer.company})
            )
          ORDER BY v."voucherDate" DESC
          LIMIT 50;
        `
        currentPartyVouchers = (custRaw || []).map((r) => ({
          voucherNo: r.voucherNo,
          voucherDate: r.voucherDate,
          customerName: r.customerName,
          customerCode: r.customerCode,
          qty: Number(r.qty),
          rate: Number(r.rate),
          amount: Number(r.amount),
          isTaxInclusive: Boolean(r.isTaxInclusive)
        }))
      } catch (err) {
        console.error('Error fetching customer-specific vouchers:', err)
      }
    }
  }

  // 5. Calculate rate summary stats
  const rates = (allVouchers.length > 0 ? allVouchers : historicalPrices).map((i: any) =>
    Number(i.rate ?? i.unitPrice ?? 0)
  ).filter((r: number) => r > 0)

  const minRate = rates.length ? Math.min(...rates) : null
  const maxRate = rates.length ? Math.max(...rates) : null
  const avgRate = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : null

  return {
    success: true,
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit
    },
    count: historicalPrices.length,
    historicalPrices,
    allVouchers,
    currentPartyVouchers,
    currentPartyHistorical: targetCustomer
      ? historicalPrices.find((hp) => hp.customerId === targetCustomer.id) || null
      : null,
    targetCustomer,
    summary: {
      totalParties: historicalPrices.length,
      totalBills: allVouchers.length,
      minRate,
      maxRate,
      avgRate
    }
  }
})
