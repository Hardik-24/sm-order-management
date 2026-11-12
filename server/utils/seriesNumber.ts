/**
 * Standardized Number Series Utility (Option B: SO-YYMM-0001 / QT-YYMM-0001)
 * Provides month-scoped sequential numbering with full backward compatibility.
 */

/**
 * Returns the 4-character Year+Month string for monthly series.
 * e.g., November 2026 -> "2611"
 */
export function getYearMonthCode(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${yy}${mm}`
}

/**
 * Generates the next sequential Order Number in series: SO-YYMM-0001
 * Finds all orders matching the current month prefix (e.g. SO-2611-),
 * determines the true maximum sequence, and increments safely.
 */
export async function generateSequentialOrderNumber(
  prisma: any,
  date: Date = new Date(),
  attemptOffset = 1
): Promise<{ orderNumber: string; prefix: string; seq: number }> {
  const yymm = getYearMonthCode(date)
  const prefix = `SO-${yymm}-`

  const existing = await prisma.order.findMany({
    where: { orderNumber: { startsWith: prefix } },
    select: { orderNumber: true }
  })

  let maxSeq = 0
  for (const o of existing) {
    // Matches SO-YYMM-XXXX, ignoring any split suffixes like -B or -C
    const match = o.orderNumber.match(/^SO-\d{4}-(\d+)/)
    if (match) {
      const seq = parseInt(match[1], 10)
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq
      }
    }
  }

  const seq = maxSeq + attemptOffset
  const orderNumber = `${prefix}${String(seq).padStart(4, '0')}`
  return { orderNumber, prefix, seq }
}

/**
 * Generates the next sequential Quotation Number in series: QT-YYMM-0001
 * Finds all quotations matching the current month prefix (e.g. QT-2611-),
 * determines the true maximum sequence, and increments safely.
 */
export async function generateSequentialQuoteNumber(
  prisma: any,
  date: Date = new Date(),
  attemptOffset = 1
): Promise<{ quoteNumber: string; prefix: string; seq: number }> {
  const yymm = getYearMonthCode(date)
  const prefix = `QT-${yymm}-`

  const existing = await prisma.quotation.findMany({
    where: { quoteNumber: { startsWith: prefix } },
    select: { quoteNumber: true }
  })

  let maxSeq = 0
  for (const q of existing) {
    const match = q.quoteNumber.match(/^QT-\d{4}-(\d+)/)
    if (match) {
      const seq = parseInt(match[1], 10)
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq
      }
    }
  }

  const seq = maxSeq + attemptOffset
  const quoteNumber = `${prefix}${String(seq).padStart(4, '0')}`
  return { quoteNumber, prefix, seq }
}
