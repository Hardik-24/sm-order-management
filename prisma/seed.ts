// Seed script for Silicon Marketing OMS
// Run: npx tsx prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // 1. Users
  const users = [
    { name: 'Hardik Patel', email: 'admin@sm.com', password: 'admin123', role: 'ADMIN' as const },
    { name: 'Rahul Sharma', email: 'rahul@sm.com', password: 'sales123', role: 'SALES' as const },
    { name: 'Priya Mehta', email: 'priya@sm.com', password: 'sales123', role: 'SALES' as const },
    { name: 'Amit Desai', email: 'amit@sm.com', password: 'billing123', role: 'BILLING' as const },
    { name: 'Ravi Kumar', email: 'ravi@sm.com', password: 'packing123', role: 'PACKING' as const },
    { name: 'Suresh Singh', email: 'suresh@sm.com', password: 'delivery123', role: 'DELIVERY' as const },
  ]

  const dbUsers: Record<string, any> = {}
  for (const u of users) {
    const hashedPassword = bcrypt.hashSync(u.password, 12)
    dbUsers[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
      },
    })
  }
  console.log('Users seeded.')

  // 2. Categories
  const categoryNames = ['MDF', 'Plywood', 'Laminate', 'Hardware', 'Edge Band', 'Adhesive']
  const categories: Record<string, any> = {}

  for (const name of categoryNames) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('Categories seeded.')

  // 3. Products
  const products = [
    { sku: 'MDF18W', name: 'MDF 18mm White', category: 'MDF', unit: 'SHEET' as const, price: 1850, stock: 120 },
    { sku: 'MDF12W', name: 'MDF 12mm White', category: 'MDF', unit: 'SHEET' as const, price: 1450, stock: 95 },
    { sku: 'MDF08B', name: 'MDF 8mm Brown', category: 'MDF', unit: 'SHEET' as const, price: 980, stock: 150 },
    { sku: 'PLY12B', name: 'Plywood 12mm BWR', category: 'Plywood', unit: 'SHEET' as const, price: 1650, stock: 85 },
    { sku: 'PLY18T', name: 'Plywood 18mm Teak', category: 'Plywood', unit: 'SHEET' as const, price: 2850, stock: 45 },
    { sku: 'PLY06F', name: 'Plywood 6mm Flexi', category: 'Plywood', unit: 'SHEET' as const, price: 750, stock: 200 },
    { sku: 'LAM01O', name: 'Oak Laminate 1mm', category: 'Laminate', unit: 'SHEET' as const, price: 650, stock: 200 },
    { sku: 'LAM02W', name: 'Walnut Laminate 1mm', category: 'Laminate', unit: 'SHEET' as const, price: 720, stock: 180 },
    { sku: 'LAM03M', name: 'Maple Laminate 0.8mm', category: 'Laminate', unit: 'SHEET' as const, price: 580, stock: 250 },
    { sku: 'HW-HNG01', name: 'Door Hinge SS 4inch', category: 'Hardware', unit: 'PIECE' as const, price: 180, stock: 500 },
    { sku: 'HW-SCR01', name: 'Wood Screws 1.5inch (Box-100)', category: 'Hardware', unit: 'BOX' as const, price: 280, stock: 300 },
    { sku: 'HW-HND01', name: 'Cabinet Handle Modern', category: 'Hardware', unit: 'PIECE' as const, price: 95, stock: 800 },
    { sku: 'EB-PVC01', name: 'PVC Edge Band 22mm White', category: 'Edge Band', unit: 'METER' as const, price: 12, stock: 5000 },
    { sku: 'ADH-FEV01', name: 'Fevicol SH 5kg', category: 'Adhesive', unit: 'PIECE' as const, price: 850, stock: 60 },
  ]

  const dbProducts: Record<string, any> = {}
  for (const p of products) {
    dbProducts[p.sku] = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        categoryId: categories[p.category].id,
        unit: p.unit,
        price: p.price,
        stock: p.stock,
      },
    })
  }
  console.log('Products seeded.')

  // 4. Customers
  const customersData = [
    { name: 'Rajesh Patel', company: 'ABC Interiors', phone: '+919876543210', address: '12 MG Road, Navrangpura', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009', paymentTerms: '30 Days' },
    { name: 'Neha Gupta', company: 'Royal Designs', phone: '+918765432109', address: '45 SG Highway, Bodakdev', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054', paymentTerms: '15 Days' },
    { name: 'Vikram Shah', company: 'XYZ Furnitures', phone: '+917654321098', address: '78 Ring Road, Varachha', city: 'Surat', state: 'Gujarat', pincode: '395006', paymentTerms: '45 Days' },
    { name: 'Anil Joshi', company: 'Modern Living', phone: '+916543210987', address: '23 Alkapuri Society', city: 'Vadodara', state: 'Gujarat', pincode: '390007', paymentTerms: '30 Days' },
    { name: 'Meera Kapoor', company: 'Urban Spaces', phone: '+915432109876', address: '56 Kalawad Road', city: 'Rajkot', state: 'Gujarat', pincode: '360005', paymentTerms: 'COD' },
  ]

  const dbCustomers: Record<string, any> = {}
  for (const c of customersData) {
    dbCustomers[c.company] = await prisma.customer.upsert({
      where: { id: (await prisma.customer.findFirst({ where: { phone: c.phone } }))?.id || 'non-existent' },
      update: {},
      create: {
        name: c.name,
        company: c.company,
        phone: c.phone,
        address: c.address,
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        paymentTerms: c.paymentTerms,
      },
    })
  }
  console.log('Customers seeded.')

  // 5. Orders
  const adminUser = dbUsers['admin@sm.com']
  const salesUser = dbUsers['rahul@sm.com']
  const billingUser = dbUsers['amit@sm.com']

  const ordersData = [
    {
      orderNumber: 'SO-2026-1024',
      company: 'ABC Interiors',
      overallStatus: 'AWAITING_PACKING' as const,
      totalAmount: 184500,
      billingStatus: 'IN_PROGRESS' as const,
      packingStatus: 'IN_PROGRESS' as const,
      deliveryStatus: 'WAITING' as const,
      items: [
        { sku: 'MDF18W', quantity: 50 },
        { sku: 'PLY12B', quantity: 20 },
        { sku: 'LAM01O', quantity: 30 },
        { sku: 'ADH-FEV01', quantity: 5 },
      ],
    },
    {
      orderNumber: 'SO-2026-1023',
      company: 'XYZ Furnitures',
      overallStatus: 'READY' as const,
      totalAmount: 92400,
      billingStatus: 'GENERATED' as const,
      packingStatus: 'PACKED' as const,
      deliveryStatus: 'WAITING' as const,
      items: [
        { sku: 'MDF12W', quantity: 30 },
        { sku: 'HW-HNG01', quantity: 200 },
        { sku: 'EB-PVC01', quantity: 1000 },
        { sku: 'HW-SCR01', quantity: 3 },
      ],
    },
    {
      orderNumber: 'SO-2026-1022',
      company: 'Royal Designs',
      overallStatus: 'DISPATCHED' as const,
      totalAmount: 342000,
      billingStatus: 'GENERATED' as const,
      packingStatus: 'PACKED' as const,
      deliveryStatus: 'DISPATCHED' as const,
      items: [
        { sku: 'PLY18T', quantity: 100 },
        { sku: 'LAM02W', quantity: 50 },
        { sku: 'HW-HND01', quantity: 150 },
        { sku: 'ADH-FEV01', quantity: 8 },
      ],
    },
    {
      orderNumber: 'SO-2026-1021',
      company: 'Modern Living',
      overallStatus: 'AWAITING_PACKING' as const,
      totalAmount: 128600,
      billingStatus: 'PENDING' as const,
      packingStatus: 'IN_PROGRESS' as const,
      deliveryStatus: 'WAITING' as const,
      items: [
        { sku: 'MDF08B', quantity: 60 },
        { sku: 'LAM03M', quantity: 100 },
        { sku: 'HW-SCR01', quantity: 10 },
        { sku: 'EB-PVC01', quantity: 750 },
      ],
    },
    {
      orderNumber: 'SO-2026-1020',
      company: 'Urban Spaces',
      overallStatus: 'AWAITING_BOTH' as const,
      totalAmount: 58800,
      billingStatus: 'PENDING' as const,
      packingStatus: 'PENDING' as const,
      deliveryStatus: 'WAITING' as const,
      items: [
        { sku: 'PLY06F', quantity: 40 },
        { sku: 'LAM01O', quantity: 20 },
        { sku: 'HW-HND01', quantity: 100 },
        { sku: 'ADH-FEV01', quantity: 2 },
        { sku: 'HW-HNG01', quantity: 25 },
      ],
    },
  ]

  for (const o of ordersData) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: o.orderNumber } })
    if (existing) continue

    const customer = dbCustomers[o.company]

    await prisma.order.create({
      data: {
        orderNumber: o.orderNumber,
        customerId: customer.id,
        salesPersonId: salesUser.id,
        deliveryAddress: customer.address || `${customer.city}, ${customer.state}`,
        paymentTerms: customer.paymentTerms || '30 Days',
        totalAmount: o.totalAmount,
        overallStatus: o.overallStatus,
        items: {
          create: o.items.map((i) => {
            const product = dbProducts[i.sku]
            return {
              productId: product.id,
              sku: product.sku,
              productName: product.name,
              quantity: i.quantity,
              unitPrice: Number(product.price),
              packedQuantity: o.packingStatus === 'PACKED' ? i.quantity : 0,
            }
          }),
        },
        billingStatus: {
          create: {
            status: o.billingStatus,
            ...(o.billingStatus === 'GENERATED'
              ? { invoiceNumber: `INV-${o.orderNumber.split('-').pop()}`, generatedById: billingUser.id, generatedAt: new Date() }
              : {}),
          },
        },
        packingStatus: {
          create: { status: o.packingStatus },
        },
        deliveryStatus: {
          create: {
            status: o.deliveryStatus,
            ...(o.deliveryStatus === 'DISPATCHED'
              ? { driverName: 'Suresh Singh', dispatchDate: new Date() }
              : {}),
          },
        },
        timeline: {
          create: [
            { action: 'Order Created', description: `Order ${o.orderNumber} was created.`, performedById: salesUser.id },
          ],
        },
      },
    })
  }
  console.log('Orders seeded.')

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
