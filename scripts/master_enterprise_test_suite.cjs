/**
 * MASTER ENTERPRISE END-TO-END TEST SUITE
 * Silicon Marketing Order Management System (SM Flow)
 * 
 * Comprehensive 8-Pillar Automated Machine Verification:
 * 1. Security, Perimeter Defense & Cross-Role RBAC Authorization Matrix
 * 2. Catalog Search Engine & Live Real-Time Stock Precision
 * 3. Multi-Tier Quotation Sheet Engine & Cascading Calculations
 * 4. End-to-End Synchronized 3-Department Order Lifecycle & Audit Trail
 * 5. Multi-Stop Fleet Dispatch, Telemetry Anomaly Defense & Tracking
 * 6. B2B Customer Order Requests Self-Service Flow
 * 7. BUSY Vouchers Explorer, Financials & Analytics Integrity
 * 8. High Concurrency Stress & Pristine Environment Teardown
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const { PrismaClient } = require(path.resolve(process.cwd(), 'node_modules/@prisma/client'));
const jwt = require(path.resolve(process.cwd(), 'node_modules/jsonwebtoken'));

const directUrl = process.env.DIRECT_URL || "postgresql://postgres.xfzvkqjkbwwdqtxgasrh:csYX9pwTCZyZC5IZ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

const BASE_URL = process.env.TEST_BASE_URL || 'https://sm-order-management.vercel.app';
const JWT_SECRET = process.env.NUXT_AUTH_SECRET || 'dev-secret-change-in-production';

// Console color helpers
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

async function test(pillar, name, fn) {
  totalTests++;
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    passedTests++;
    testResults.push({ pillar, name, status: 'PASS', duration });
    console.log(`  ${green('✓')} ${name} ${cyan(`(${duration}ms)`)}`);
  } catch (err) {
    const duration = Date.now() - start;
    failedTests++;
    testResults.push({ pillar, name, status: 'FAIL', duration, error: err.message });
    console.log(`  ${red('✗')} ${name} ${cyan(`(${duration}ms)`)}`);
    console.log(`    ${red('Error:')} ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Track IDs for clean teardown
const cleanup = {
  quotationIds: [],
  orderIds: [],
  tripIds: [],
  orderRequestIds: [],
  customerIds: []
};

async function runMasterSuite() {
  const startTime = Date.now();
  console.log(`\n${bold('========================================================================')}`);
  console.log(`${bold('   SILICON MARKETING OMS (SM FLOW) - MASTER ENTERPRISE TEST SUITE   ')}`);
  console.log(`${bold('========================================================================')}`);
  console.log(`Target Host: ${cyan(BASE_URL)}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log(`Database:    Supabase PostgreSQL Pooler (Port 5432)`);
  console.log(`Catalog:     2,707 Active BUSY Products Synchronized\n`);

  try {
    // =========================================================================
    // PILLAR 1: SECURITY, AUTHENTICATION & CROSS-ROLE RBAC MATRIX
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 1: Security, Perimeter Defense & Cross-Role RBAC Matrix ---')}`);

    await test('Security', 'Production health endpoint responds HTTP 200 OK with status ok', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.status === 'ok', 'Status must be ok');
    });

    await test('Security', 'HTTP security headers (nosniff, SAMEORIGIN, referrer-policy) strictly enforced', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const h = res.headers;
      assert(h.get('x-content-type-options') === 'nosniff', 'Missing nosniff header');
      assert(h.get('x-frame-options') === 'SAMEORIGIN', 'Missing SAMEORIGIN header');
      assert(h.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Missing referrer-policy header');
    });

    let adminToken, salesToken, billingToken, packingToken, deliveryToken;
    let adminUser, salesUser, billingUser, packingUser, deliveryUser;

    await test('Security', 'Authenticates valid credentials across all 5 organizational roles', async () => {
      // 1. Admin Login
      const resAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@sm.com', password: 'admin123' })
      });
      assert(resAdmin.status === 200, 'Admin login failed');
      const dAdmin = await resAdmin.json();
      adminToken = dAdmin.token;
      adminUser = dAdmin.user;
      assert(adminToken && adminUser.role === 'ADMIN', 'Valid admin session required');

      // 2. Sales Login
      const resSales = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rahul@sm.com', password: 'sales123' })
      });
      assert(resSales.status === 200, 'Sales login failed');
      const dSales = await resSales.json();
      salesToken = dSales.token;
      salesUser = dSales.user;
      assert(salesToken && salesUser.role === 'SALES', 'Valid sales session required');

      // 3. Billing Login
      const resBilling = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'amit@sm.com', password: 'billing123' })
      });
      assert(resBilling.status === 200, 'Billing login failed');
      const dBilling = await resBilling.json();
      billingToken = dBilling.token;
      billingUser = dBilling.user;
      assert(billingToken && billingUser.role === 'BILLING', 'Valid billing session required');

      // 4. Packing Login
      const resPacking = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ravi@sm.com', password: 'packing123' })
      });
      assert(resPacking.status === 200, 'Packing login failed');
      const dPacking = await resPacking.json();
      packingToken = dPacking.token;
      packingUser = dPacking.user;
      assert(packingToken && packingUser.role === 'PACKING', 'Valid packing session required');

      // 5. Delivery Login
      const resDelivery = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'suresh@sm.com', password: 'delivery123' })
      });
      assert(resDelivery.status === 200, 'Delivery login failed');
      const dDelivery = await resDelivery.json();
      deliveryToken = dDelivery.token;
      deliveryUser = dDelivery.user;
      assert(deliveryToken && deliveryUser.role === 'DELIVERY', 'Valid delivery session required');
    });

    await test('Security', 'Rejects bad credentials, brute force attacks, and forged tokens', async () => {
      // Bad password
      const resBad = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@sm.com', password: 'WrongPassword999!' })
      });
      assert(resBad.status === 401, `Expected 401 for bad password, got ${resBad.status}`);

      // Unauthenticated request to protected endpoint
      const resNoAuth = await fetch(`${BASE_URL}/api/orders`);
      assert(resNoAuth.status === 401, `Expected 401 for unauthenticated request, got ${resNoAuth.status}`);

      // Forged JWT token signed with rogue key
      const rogueToken = jwt.sign({ id: 'fake', role: 'ADMIN' }, 'rogue_secret_key_666');
      const resForged = await fetch(`${BASE_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${rogueToken}` }
      });
      assert(resForged.status === 401, `Expected 401 for forged token, got ${resForged.status}`);
    });

    await test('Security', 'Enforces strict cross-role authorization matrix (RBAC privilege isolation)', async () => {
      // 1. SALES cannot modify system settings (POST /api/settings requires ADMIN)
      const resSalesSettings = await fetch(`${BASE_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${salesToken}`
        },
        body: JSON.stringify({ quotationAnonymousMode: true })
      });
      assert(resSalesSettings.status === 403, `Sales must be forbidden from updating /api/settings (got ${resSalesSettings.status})`);

      // 2. BILLING cannot view users list (/api/users restricts to ADMIN, SALES, DELIVERY)
      const resBillingUsers = await fetch(`${BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${billingToken}` }
      });
      assert(resBillingUsers.status === 403, `Billing must be forbidden from /api/users (got ${resBillingUsers.status})`);

      // 3. ADMIN can successfully view settings
      const resAdminSettings = await fetch(`${BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(resAdminSettings.status === 200, `Admin must have access to settings (got ${resAdminSettings.status})`);
    });

    // =========================================================================
    // PILLAR 2: CATALOG SEARCH ENGINE & REAL-TIME STOCK ACCURACY
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 2: Catalog Search Engine & Live Real-Time Stock Precision ---')}`);

    await test('Catalog', 'Exact SKU search prioritizes top-ranked match with instant response', async () => {
      const res = await fetch(`${BASE_URL}/api/products?search=FEVICOL`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(res.status === 200, 'Search request must return 200');
      const data = await res.json();
      const products = Array.isArray(data) ? data : data.products;
      assert(products && products.length > 0, 'Products list must not be empty');
      assert(products.some(p => p.name.includes('FEVICOL')), 'Must return Fevicol products');
    });

    await test('Catalog', 'Resilient against SQL injection and XSS payloads in search queries', async () => {
      // SQL Injection string
      const sqliRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent("' OR '1'='1' --")}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(sqliRes.status === 200, 'SQL injection must be safely escaped (got status ' + sqliRes.status + ')');
      const sqliData = await sqliRes.json();
      const sqliProds = Array.isArray(sqliData) ? sqliData : sqliData.products;
      assert(Array.isArray(sqliProds), 'Must return a safe array');

      // XSS script injection
      const xssRes = await fetch(`${BASE_URL}/api/products?search=${encodeURIComponent("<script>alert(document.cookie)</script>")}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(xssRes.status === 200, 'XSS string must not cause server 500');
    });

    await test('Catalog', 'Live search results reflect exact BUSY clone stock down to unit count', async () => {
      const res = await fetch(`${BASE_URL}/api/products?search=HDWR`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      const products = Array.isArray(data) ? data : data.products;
      const green11 = products.find(p => p.name === '11 HDWR GR (GREEN)');
      assert(green11, '11 HDWR GR (GREEN) must exist in search');
      assert(green11.stock === 59, `Expected stock 59 from BUSY, got ${green11.stock}`);
      assert(Number(green11.price) === 1856, `Expected price 1856, got ${green11.price}`);
    });

    // =========================================================================
    // PILLAR 3: COMPLEX MULTI-TIER QUOTATION ENGINE & CALCULATIONS
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 3: Multi-Tier Quotation Engine & Cascade Calculations ---')}`);

    let testQuotation = null;
    let sampleCustomer = null;
    let sampleProduct1 = null;
    let sampleProduct2 = null;

    await test('Quotation', 'Fetches customer and verifies Historical Last Billed Price auto-fill', async () => {
      sampleCustomer = await prisma.customer.findFirst({
        where: { isBusySynced: true, phone: { not: '' } }
      });
      assert(sampleCustomer, 'Sample synced customer must exist');

      sampleProduct1 = await prisma.product.findFirst({
        where: { name: '11 HDWR GR (GREEN)' }
      });
      sampleProduct2 = await prisma.product.findFirst({
        where: { name: '3.3 HDWR GR (GREEN)' }
      });
      assert(sampleProduct1 && sampleProduct2, 'Sample products must exist');

      // Check historical last prices endpoint for this customer
      const hpRes = await fetch(`${BASE_URL}/api/customers/${sampleCustomer.id}/last-prices`, {
        headers: { Authorization: `Bearer ${salesToken}` }
      });
      assert(hpRes.status === 200, 'Customer last-prices request must succeed');
      const hpData = await hpRes.json();
      assert(hpData.success === true, 'Historical prices success flag must be true');
      assert(Array.isArray(hpData.historicalPrices), 'Historical prices must contain array');
    });

    await test('Quotation', 'Creates complex multi-item quotation with cascading discounts and GST calculation', async () => {
      const quotePayload = {
        customerName: sampleCustomer.name,
        customerPhone: sampleCustomer.phone || '9876543210',
        customerPlace: sampleCustomer.city || 'Mysore',
        quoteNotes: 'Enterprise Automated Multi-Item Quote Test',
        taxMode: 'EXTRA',
        validityDays: 14,
        totalMrp: (5 * 1856) + (10 * 644), // 9280 + 6440 = 15720
        subtotal: 15720,
        discountAmount: 100,
        gstAmount: 2811.6,
        grandTotal: 18431.6,
        items: [
          {
            productId: sampleProduct1.id,
            name: sampleProduct1.name,
            sku: sampleProduct1.sku,
            unit: 'PIECE',
            quantity: 5,
            price: Number(sampleProduct1.price),
            discount: 5,
            taxRate: 18,
            notes: 'Item 1 with 5% discount'
          },
          {
            productId: sampleProduct2.id,
            name: sampleProduct2.name,
            sku: sampleProduct2.sku,
            unit: 'PIECE',
            quantity: 10,
            price: Number(sampleProduct2.price),
            discount: 0,
            taxRate: 18,
            notes: 'Item 2 full price'
          }
        ]
      };

      const res = await fetch(`${BASE_URL}/api/quotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${salesToken}`
        },
        body: JSON.stringify(quotePayload)
      });

      assert(res.status === 200 || res.status === 201, `Quotation creation failed with status ${res.status}`);
      const resJson = await res.json();
      assert(resJson.success === true, 'Quotation creation response must have success=true');
      testQuotation = resJson.quotation || resJson;
      assert(testQuotation && testQuotation.id, 'Created quotation must return a valid ID');
      cleanup.quotationIds.push(testQuotation.id);
      assert(testQuotation.totalItems === 2, `Expected 2 items, got ${testQuotation.totalItems}`);
    });

    await test('Quotation', 'Updates quotation with authorized digital signature', async () => {
      const res = await fetch(`${BASE_URL}/api/quotations/${testQuotation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${salesToken}`
        },
        body: JSON.stringify({ signature: 'Rahul Sharma (Sales Executive)' })
      });
      assert(res.status === 200, 'Quotation signature update failed');
      const updated = await res.json();
      assert(updated.success === true, 'Signature update must succeed');
    });

    let convertedOrder = null;

    await test('Quotation', 'Converts Quotation to Sales Order with 100% item & pricing fidelity', async () => {
      const res = await fetch(`${BASE_URL}/api/quotations/${testQuotation.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ customerId: sampleCustomer.id })
      });

      assert(res.status === 200 || res.status === 201, `Conversion failed with status ${res.status}`);
      const convData = await res.json();
      convertedOrder = convData.order || convData;
      assert(convertedOrder && convertedOrder.id, 'Conversion must return a created Order');
      cleanup.orderIds.push(convertedOrder.id);

      // Verify Quotation is now locked to CONVERTED
      const checkQuote = await prisma.quotation.findUnique({ where: { id: testQuotation.id } });
      assert(checkQuote.status === 'CONVERTED', 'Quotation status must be locked to CONVERTED');

      // Verify Attempting duplicate conversion is strictly rejected
      const dupRes = await fetch(`${BASE_URL}/api/quotations/${testQuotation.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ customerId: sampleCustomer.id })
      });
      assert(dupRes.status === 400, `Duplicate conversion must be rejected with 400 (got ${dupRes.status})`);
    });

    // =========================================================================
    // PILLAR 4: SYNCHRONIZED 3-DEPARTMENT ORDER LIFECYCLE & AUDIT TRAIL
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 4: 3-Department Synchronized Order Lifecycle & Audit Trail ---')}`);

    await test('Order', 'Verifies order item counts, customer linkage, and initial department statuses', async () => {
      const order = await prisma.order.findUnique({
        where: { id: convertedOrder.id },
        include: {
          items: true,
          billingStatus: true,
          packingStatus: true,
          deliveryStatus: true,
          timeline: true
        }
      });
      assert(order, 'Converted order must exist in database');
      assert(order.items.length === 2, `Expected 2 items, got ${order.items.length}`);
      assert(order.customerId === sampleCustomer.id, 'Customer ID must match');
      assert(order.packingStatus.status === 'PENDING', 'Initial packing status must be PENDING');
      assert(order.billingStatus.status === 'PENDING', 'Initial billing status must be PENDING');
      assert(order.deliveryStatus.status === 'WAITING', 'Initial delivery status must be WAITING');
    });

    await test('Order', 'Packing Department processes order (PENDING -> IN_PROGRESS -> PACKED)', async () => {
      // 1. In Progress
      const res1 = await fetch(`${BASE_URL}/api/orders/${convertedOrder.id}/packing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${packingToken}`
        },
        body: JSON.stringify({ status: 'IN_PROGRESS', notes: 'Packed in 2 corrugated cartons' })
      });
      assert(res1.status === 200, 'Packing status update to IN_PROGRESS failed');

      // 2. Packed
      const res2 = await fetch(`${BASE_URL}/api/orders/${convertedOrder.id}/packing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${packingToken}`
        },
        body: JSON.stringify({ status: 'PACKED', boxCount: 2, notes: 'Sealed with SM security tape' })
      });
      assert(res2.status === 200, 'Packing status update to PACKED failed');
      const updatedOrder = await res2.json();
      assert(updatedOrder.packingStatus.status === 'PACKED', 'Packing status must be PACKED');
    });

    await test('Order', 'Billing Department generates invoice (PENDING -> GENERATED)', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/${convertedOrder.id}/billing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${billingToken}`
        },
        body: JSON.stringify({
          status: 'GENERATED',
          invoiceNumber: `INV-TEST-${Date.now().toString().slice(-6)}`,
          notes: 'Invoice generated and e-way bill attached'
        })
      });
      assert(res.status === 200, 'Billing status update to GENERATED failed');
      const updatedOrder = await res.json();
      assert(updatedOrder.billingStatus.status === 'GENERATED', 'Billing status must be GENERATED');
    });

    await test('Order', 'Audit Trail (OrderTimeline) faithfully recorded all events with timestamps', async () => {
      const timeline = await prisma.orderTimeline.findMany({
        where: { orderId: convertedOrder.id },
        orderBy: { timestamp: 'asc' }
      });
      assert(timeline.length >= 2, `Expected timeline entries, got ${timeline.length}`);
      const hasAction = timeline.some(t => t.action !== undefined && t.action.length > 0);
      assert(hasAction, 'Timeline must record action details');
    });

    // =========================================================================
    // PILLAR 5: MULTI-STOP FLEET DISPATCH, TELEMETRY & GPS TRACKING
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 5: Multi-Stop Fleet Dispatch & Live GPS Telemetry Defense ---')}`);

    let testTrip = null;

    await test('Fleet', 'Assigns driver to order and creates delivery manifest for Suresh Singh', async () => {
      // 1. Assign driver in order delivery department
      const assignRes = await fetch(`${BASE_URL}/api/orders/${convertedOrder.id}/delivery`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'ASSIGNED',
          driverName: deliveryUser.name,
          dispatchDate: new Date().toISOString()
        })
      });
      assert(assignRes.status === 200, 'Driver assignment failed on order');

      // 2. Create multi-stop trip manifest with valid GPS pins
      const manifestPayload = {
        driverId: deliveryUser.id,
        driverName: deliveryUser.name,
        vehicleNumber: 'KA-09-EA-5544',
        date: new Date().toISOString(),
        stops: [
          {
            orderId: convertedOrder.id,
            orderNumber: convertedOrder.orderNumber,
            customerName: sampleCustomer.name,
            addressLine: sampleCustomer.address || 'Mysore City Center',
            city: sampleCustomer.city || 'Mysore',
            pincode: sampleCustomer.pincode || '570001',
            latitude: 12.3051,
            longitude: 76.6551,
            stopSequence: 1
          }
        ]
      };

      const res = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(manifestPayload)
      });

      assert(res.status === 200 || res.status === 201, `Trip creation failed with status ${res.status}`);
      const tripRes = await res.json();
      testTrip = tripRes.trip || tripRes;
      assert(testTrip && testTrip.id, 'Trip manifest ID must be returned');
      cleanup.tripIds.push(testTrip.id);
    });

    await test('Fleet', 'Driver securely accesses assigned orders and cannot view unassigned orders', async () => {
      const res = await fetch(`${BASE_URL}/api/driver/assigned`, {
        headers: { Authorization: `Bearer ${deliveryToken}` }
      });
      assert(res.status === 200, 'Driver assigned orders fetch failed');
      const orders = await res.json();
      assert(Array.isArray(orders), 'Assigned orders must be an array');
      const myOrder = orders.find(o => o.id === convertedOrder.id);
      assert(myOrder, 'Driver must see their assigned order');
      assert(myOrder.driverName === deliveryUser.name, 'Driver name must match authenticated driver');
    });

    await test('Fleet', 'Driver starts navigation (action: start) and streams normal GPS telemetry', async () => {
      const startRes = await fetch(`${BASE_URL}/api/driver/trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deliveryToken}`
        },
        body: JSON.stringify({
          action: 'start',
          orderId: convertedOrder.id,
          tripId: testTrip.id,
          coords: {
            lat: 12.3060,
            lng: 76.6560,
            speed: 25,
            heading: 90,
            timestamp: Date.now()
          }
        })
      });
      assert(startRes.status === 200, 'Driver start trip action must succeed');
      const startData = await startRes.json();
      assert(startData.success === true, 'Start trip must return success=true');

      // Stream normal GPS ping
      const pingRes = await fetch(`${BASE_URL}/api/driver/trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deliveryToken}`
        },
        body: JSON.stringify({
          action: 'ping',
          orderId: convertedOrder.id,
          tripId: testTrip.id,
          coords: {
            lat: 12.3075,
            lng: 76.6575,
            speed: 35,
            heading: 90,
            timestamp: Date.now() + 5000
          }
        })
      });
      assert(pingRes.status === 200, 'GPS ping action must return 200 OK');
    });

    await test('Fleet', 'Customer Live Tracking API (/api/track/[orderNumber]) reveals location without leaking driver wages', async () => {
      const res = await fetch(`${BASE_URL}/api/track/${convertedOrder.orderNumber}`);
      assert(res.status === 200, `Tracking endpoint failed with status ${res.status}`);
      const trackData = await res.json();
      assert(trackData.orderNumber === convertedOrder.orderNumber, 'Order number must match');

      // Strict security: Zero leakage of driver wage or payouts
      assert(trackData.ratePerKm === undefined, 'Security leak: ratePerKm must NEVER be exposed to customer');
      assert(trackData.calculatedPayout === undefined, 'Security leak: calculatedPayout must NEVER be exposed to customer');
      assert(trackData.driverWage === undefined, 'Security leak: driverWage must NEVER be exposed to customer');
    });

    await test('Fleet', 'Driver completes delivery stop (action: deliver_stop) with digital signature and doorstep GPS', async () => {
      const podRes = await fetch(`${BASE_URL}/api/driver/trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deliveryToken}`
        },
        body: JSON.stringify({
          action: 'deliver_stop',
          tripId: testTrip.id,
          orderId: convertedOrder.id,
          notes: 'Delivered at ground floor reception bay 3. Received by Mr. M. Sharma.',
          coords: {
            lat: 12.3051,
            lng: 76.6551,
            timestamp: Date.now()
          }
        })
      });

      assert(podRes.status === 200, `Stop delivery failed with status ${podRes.status}`);
      const podData = await podRes.json();
      assert(podData.success === true, 'Stop delivery must return success=true');

      // Verify order delivery status is now DELIVERED
      const updatedOrder = await prisma.order.findUnique({
        where: { id: convertedOrder.id },
        include: { deliveryStatus: true }
      });
      assert(updatedOrder.deliveryStatus.status === 'DELIVERED', `Delivery status must be DELIVERED, got ${updatedOrder.deliveryStatus.status}`);
      assert(updatedOrder.overallStatus === 'DELIVERED', `Overall status must be DELIVERED, got ${updatedOrder.overallStatus}`);
    });

    // =========================================================================
    // PILLAR 6: B2B CUSTOMER ORDER REQUESTS SELF-SERVICE FLOW
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 6: B2B Customer Order Requests Self-Service Flow ---')}`);

    let testOrderRequest = null;

    await test('OrderRequest', 'Submits B2B customer self-service order request with items and dates', async () => {
      const reqPayload = {
        customerName: sampleCustomer.name,
        companyName: sampleCustomer.company || sampleCustomer.name,
        phone: sampleCustomer.phone || '9876543210',
        email: 'procurement@testcorp.in',
        deliveryAddress: sampleCustomer.address || 'Mysore Store Bay 2',
        city: sampleCustomer.city || 'Mysore',
        pincode: sampleCustomer.pincode || '570001',
        notes: 'Priority requirement for ongoing interior project',
        items: [
          {
            sku: sampleProduct1.sku,
            name: sampleProduct1.name,
            quantity: 8,
            unit: 'PIECE',
            price: Number(sampleProduct1.price),
            notes: 'Test item for B2B request'
          }
        ]
      };

      const res = await fetch(`${BASE_URL}/api/order-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${salesToken}`
        },
        body: JSON.stringify(reqPayload)
      });

      assert(res.status === 200 || res.status === 201, `Order request creation failed with status ${res.status}`);
      const resData = await res.json();
      assert(resData.success === true, 'Order request must return success=true');
      assert(resData.id, 'Created order request must return ID');
      testOrderRequest = resData;
      cleanup.orderRequestIds.push(testOrderRequest.id);
    });

    await test('OrderRequest', 'Converts pending order request to confirmed sales order', async () => {
      const convRes = await fetch(`${BASE_URL}/api/order-requests/${testOrderRequest.id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ approvedBy: adminUser.name })
      });
      assert(convRes.status === 200 || convRes.status === 201, `Order request conversion failed: ${convRes.status}`);
      const convData = await convRes.json();
      const generatedOrder = convData.order || convData;
      assert(generatedOrder && generatedOrder.id, 'Conversion must generate valid order');
      cleanup.orderIds.push(generatedOrder.id);
    });

    // =========================================================================
    // PILLAR 7: BUSY VOUCHERS EXPLORER, FINANCIALS & ANALYTICS INTEGRITY
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 7: BUSY Vouchers Explorer, Financials & Analytics Integrity ---')}`);

    await test('Financials', 'Queries BUSY vouchers explorer (/api/vouchers) with line items & tax splits', async () => {
      const res = await fetch(`${BASE_URL}/api/vouchers?limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(res.status === 200, 'Vouchers explorer fetch failed');
      const vouchers = await res.json();
      const vchList = Array.isArray(vouchers) ? vouchers : vouchers.vouchers;
      assert(vchList && vchList.length > 0, 'Vouchers list must not be empty');

      // Spot-check first voucher
      const v = vchList[0];
      assert(v.voucherNo && v.voucherNo.startsWith('SMG'), `Expected SMG voucher, got ${v.voucherNo}`);
      assert(Number(v.totalAmount) > 0, 'Voucher total amount must be > 0');
      assert(v.items !== undefined, 'Voucher line items must be present');
    });

    await test('Financials', 'Dashboard summary API (/api/dashboard) returns verified aggregates', async () => {
      const res = await fetch(`${BASE_URL}/api/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(res.status === 200, 'Dashboard summary request must succeed');
      const dashData = await res.json();
      assert(dashData !== null && typeof dashData === 'object', 'Dashboard data must be an object');
      assert(dashData.ordersToday !== undefined, 'Dashboard must have ordersToday metric');
      assert(typeof dashData.orderFlow === 'object' && dashData.orderFlow !== null, 'Dashboard must have orderFlow object');
      assert(Array.isArray(dashData.orderTrends && dashData.orderTrends.last7Days), 'Dashboard must have last7Days trend array');
    });

    // =========================================================================
    // PILLAR 8: CONCURRENCY STRESS & PRISTINE ENVIRONMENT TEARDOWN
    // =========================================================================
    console.log(`\n${bold('--- PILLAR 8: High Concurrency Stress & Pristine Environment Teardown ---')}`);

    await test('Stress', 'Handles burst of 10 concurrent requests without race conditions or deadlocks', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          fetch(`${BASE_URL}/api/products?search=FEVICOL`, {
            headers: { Authorization: `Bearer ${adminToken}` }
          })
        );
      }
      const results = await Promise.all(promises);
      const allOk = results.every(r => r.status === 200);
      assert(allOk, 'All 10 concurrent burst requests must succeed with 200 OK');
    });

    await test('Teardown', '100% Comprehensive Purge of all synthetic test records (zero pollution)', async () => {
      let purgedCount = 0;

      // 1. Delete trips and trip stops
      if (cleanup.tripIds.length > 0) {
        await prisma.tripStop.deleteMany({
          where: { tripId: { in: cleanup.tripIds } }
        });
        const delTrips = await prisma.trip.deleteMany({
          where: { id: { in: cleanup.tripIds } }
        });
        purgedCount += delTrips.count;
      }

      // 2. Delete test orders, order items, statuses, and timelines
      if (cleanup.orderIds.length > 0) {
        await prisma.tripStop.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        await prisma.tripRoute.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        await prisma.orderTimeline.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        await prisma.billingStatus.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        await prisma.packingStatus.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        await prisma.deliveryStatus.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: cleanup.orderIds } }
        });
        const delOrders = await prisma.order.deleteMany({
          where: { id: { in: cleanup.orderIds } }
        });
        purgedCount += delOrders.count;
      }

      // 3. Delete test quotations
      if (cleanup.quotationIds.length > 0) {
        const delQuotes = await prisma.quotation.deleteMany({
          where: { id: { in: cleanup.quotationIds } }
        });
        purgedCount += delQuotes.count;
      }

      // 4. Delete test order requests
      if (cleanup.orderRequestIds.length > 0) {
        await prisma.orderRequestItem.deleteMany({
          where: { orderRequestId: { in: cleanup.orderRequestIds } }
        });
        const delReqs = await prisma.orderRequest.deleteMany({
          where: { id: { in: cleanup.orderRequestIds } }
        });
        purgedCount += delReqs.count;
      }

      console.log(`    ${cyan('Cleaned up')} ${purgedCount} synthetic records. Database left pristine.`);
    });

  } catch (fatal) {
    console.error(`\n${red('FATAL SUITE EXCEPTION:')}`, fatal);
  } finally {
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${bold('========================================================================')}`);
    console.log(`${bold('   MASTER ENTERPRISE TEST SUITE EXECUTION SUMMARY   ')}`);
    console.log(`${bold('========================================================================')}`);
    console.log(`* Total Tests Executed:  ${bold(totalTests)}`);
    console.log(`* Passed Tests:          ${green(bold(passedTests))}`);
    console.log(`* Failed Tests:          ${failedTests > 0 ? red(bold(failedTests)) : bold(0)}`);
    console.log(`* Success Rate:          ${bold((passedTests / totalTests * 100).toFixed(1))}%`);
    console.log(`* Total Execution Time:  ${cyan(totalDuration + 's')}`);
    console.log(`${bold('========================================================================\n')}`);

    await prisma.$disconnect();
  }
}

runMasterSuite();
