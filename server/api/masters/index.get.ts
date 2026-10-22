import { requireAuth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/prisma'

const DEFAULT_PAYMENT_TERMS = [
  { group: 'PAYMENT_TERMS', label: 'Cash on Delivery (COD)', value: 'COD', sortOrder: 1, isDefault: false },
  { group: 'PAYMENT_TERMS', label: '15 Days', value: '15 Days', sortOrder: 2, isDefault: false },
  { group: 'PAYMENT_TERMS', label: '30 Days', value: '30 Days', sortOrder: 3, isDefault: true },
  { group: 'PAYMENT_TERMS', label: '45 Days', value: '45 Days', sortOrder: 4, isDefault: false },
  { group: 'PAYMENT_TERMS', label: '60 Days', value: '60 Days', sortOrder: 5, isDefault: false },
  { group: 'PAYMENT_TERMS', label: 'Due on Receipt', value: 'Due on Receipt', sortOrder: 6, isDefault: false },
  { group: 'PAYMENT_TERMS', label: 'Advance Payment', value: 'Advance Payment', sortOrder: 7, isDefault: false }
]

const DEFAULT_PRODUCT_UOMS = [
  { group: 'PRODUCT_UOM', label: 'SHEET', value: 'SHEET', sortOrder: 1, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'PIECE', value: 'PIECE', sortOrder: 2, isDefault: true },
  { group: 'PRODUCT_UOM', label: 'Nos.', value: 'Nos.', sortOrder: 3, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'BOX', value: 'BOX', sortOrder: 4, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'SQFT', value: 'SQFT', sortOrder: 5, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'KG', value: 'KG', sortOrder: 6, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'METER', value: 'METER', sortOrder: 7, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'ROLL', value: 'ROLL', sortOrder: 8, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'PAIR', value: 'PAIR', sortOrder: 9, isDefault: false },
  { group: 'PRODUCT_UOM', label: 'SET', value: 'SET', sortOrder: 10, isDefault: false }
]

export default defineEventHandler(async (event) => {
  requireAuth(event)

  // Check if MasterOption table has initial seed
  const totalOptions = await prisma.masterOption.count()
  if (totalOptions === 0) {
    // Seed initial defaults
    await prisma.masterOption.createMany({
      data: [...DEFAULT_PAYMENT_TERMS, ...DEFAULT_PRODUCT_UOMS]
    })
  }

  // Fetch Payment Terms & Product UOM
  const options = await prisma.masterOption.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }]
  })

  // Fetch Categories with product counts
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  const paymentTerms = options.filter(o => o.group === 'PAYMENT_TERMS')
  const productUom = options.filter(o => o.group === 'PRODUCT_UOM')

  return {
    paymentTerms,
    productUom,
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      productCount: c._count.products
    }))
  }
})
