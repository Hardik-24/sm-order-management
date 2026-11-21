const http = require('http');
const { PrismaClient } = require('@prisma/client');
try { require('dotenv').config(); } catch (_) {}

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.xfzvkqjkbwwdqtxgasrh:csYX9pwTCZyZC5IZ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

const TALLY_HOST = process.env.TALLY_HOST || '127.0.0.1';
const TALLY_PORT = parseInt(process.env.TALLY_PORT || '9000', 10);

function queryTallyXml(xml) {
  return new Promise((resolve, reject) => {
    const minified = xml.replace(/\n\s*/g, '');
    const req = http.request({
      hostname: TALLY_HOST,
      port: TALLY_PORT,
      path: '/',
      method: 'POST',
      agent: false,
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': Buffer.byteLength(minified),
        'Connection': 'close'
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tally request timed out (30s)'));
    });

    req.write(minified);
    req.end();
  });
}

function parseSalesVouchers(xml) {
  if (!xml) return [];
  const vouchers = [];
  const vchPattern = /<VOUCHER[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = vchPattern.exec(xml)) !== null) {
    const block = match[1];
    const dateMatch = block.match(/<DATE[^>]*>([^<]+)<\/DATE>/i);
    const numMatch = block.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i);
    const refMatch = block.match(/<REFERENCE[^>]*>([^<]+)<\/REFERENCE>/i);
    const partyMatch = block.match(/<PARTYLEDGERNAME[^>]*>([^<]+)<\/PARTYLEDGERNAME>/i) || block.match(/<PARTYNAME[^>]*>([^<]+)<\/PARTYNAME>/i);
    const amtMatch = block.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i);

    if (numMatch || refMatch) {
      const vDate = dateMatch ? dateMatch[1].trim() : '';
      const vNum = numMatch ? numMatch[1].trim() : '';
      const vRef = refMatch ? refMatch[1].trim() : vNum;
      const vParty = partyMatch ? partyMatch[1].replace(/&amp;/g, '&').trim() : '';
      const rawAmt = amtMatch ? Math.abs(parseFloat(amtMatch[1])) : 0;

      vouchers.push({
        date: vDate,
        voucherNo: vNum,
        ref: vRef,
        party: vParty,
        amount: Math.round(rawAmt * 100) / 100
      });
    }
  }
  return vouchers;
}

function parseMergedDebtorData(ledgersXml, billsXml) {
  const partiesMap = new Map();

  // 1. Parse Ledgers (Billed, Paid, Net Pending)
  const ledgerRegex = /<LEDGER NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/g;
  let lMatch;

  let sumBilled = 0;
  let sumPaid = 0;
  let sumNetPending = 0;
  let sumOpening = 0;

  while ((lMatch = ledgerRegex.exec(ledgersXml)) !== null) {
    const rawName = lMatch[1];
    const block = lMatch[2];

    const cleanName = rawName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const parentMatch = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/);
    const opMatch = block.match(/<OPENINGBALANCE[^>]*>([^<]+)<\/OPENINGBALANCE>/);
    const clMatch = block.match(/<CLOSINGBALANCE[^>]*>([^<]+)<\/CLOSINGBALANCE>/);
    const drMatch = block.match(/<DEBITTOTALS[^>]*>([^<]+)<\/DEBITTOTALS>/);
    const crMatch = block.match(/<CREDITTOTALS[^>]*>([^<]+)<\/CREDITTOTALS>/);

    const parent = parentMatch ? parentMatch[1].replace(/&amp;/g, '&').trim() : '';
    const rawOp = parseFloat(opMatch ? opMatch[1] : 0) || 0;
    const rawCl = parseFloat(clMatch ? clMatch[1] : 0) || 0;

    // In Debtors: Debits = Billed Sales, Credits = Payments Received
    const billed = Math.abs(parseFloat(drMatch ? drMatch[1] : 0) || 0);
    const paid = Math.abs(parseFloat(crMatch ? crMatch[1] : 0) || 0);

    const pending = rawCl < 0 ? Math.abs(rawCl) : 0;
    const advance = rawCl > 0 ? rawCl : 0;
    const opening = Math.abs(rawOp);

    if (billed > 0 || paid > 0 || pending > 0 || opening > 0 || advance > 0) {
      sumBilled += billed;
      sumPaid += paid;
      sumNetPending += pending;
      sumOpening += opening;

      const demand = opening + billed;
      const rate = demand > 0 ? Math.min(100, (paid / demand) * 100) : (paid > 0 ? 100 : 0);

      partiesMap.set(cleanName, {
        party: cleanName,
        parent,
        openingBalance: Math.round(opening * 100) / 100,
        totalBilled: Math.round(billed * 100) / 100,
        totalPaid: Math.round(paid * 100) / 100,
        netPending: Math.round(pending * 100) / 100,
        advance: Math.round(advance * 100) / 100,
        collectionRate: Math.round(rate * 10) / 10,
        totalReceivable: Math.round(pending * 100) / 100,
        billsCount: 0,
        maxOverdueDays: 0,
        minOverdueDays: 0,
        bills: []
      });
    }
  }

  // 2. Parse Bills Receivable (Aging & Open Invoices)
  const billPattern = /<BILLFIXED>\s*<BILLDATE>(.*?)<\/BILLDATE>\s*<BILLREF>(.*?)<\/BILLREF>\s*<BILLPARTY>(.*?)<\/BILLPARTY>\s*<\/BILLFIXED>\s*<BILLCL>(.*?)<\/BILLCL>\s*<BILLDUE>(.*?)<\/BILLDUE>\s*<BILLOVERDUE>(.*?)<\/BILLOVERDUE>/gs;

  let totalBills = 0;
  const agingBuckets = {
    current: 0,
    thirtyToSixty: 0,
    sixtyToNinety: 0,
    ninetyToOneEighty: 0,
    overOneEighty: 0
  };

  let bMatch;
  while ((bMatch = billPattern.exec(billsXml)) !== null) {
    const [, bdate, bref, bparty, bcl, bdue, boverdue] = bMatch;
    const rawAmt = parseFloat(bcl) || 0;
    const amount = Math.abs(rawAmt);
    const overdueDays = parseInt(boverdue, 10) || 0;
    const cleanParty = bparty.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const cleanRef = bref.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

    totalBills += 1;

    if (overdueDays <= 30) {
      agingBuckets.current += amount;
    } else if (overdueDays <= 60) {
      agingBuckets.thirtyToSixty += amount;
    } else if (overdueDays <= 90) {
      agingBuckets.sixtyToNinety += amount;
    } else if (overdueDays <= 180) {
      agingBuckets.ninetyToOneEighty += amount;
    } else {
      agingBuckets.overOneEighty += amount;
    }

    if (!partiesMap.has(cleanParty)) {
      continue;
    }

    const p = partiesMap.get(cleanParty);
    p.billsCount += 1;
    if (overdueDays > p.maxOverdueDays) p.maxOverdueDays = overdueDays;
    if (overdueDays < p.minOverdueDays || p.minOverdueDays === 0) p.minOverdueDays = overdueDays;

    p.bills.push({
      date: bdate.trim(),
      ref: cleanRef,
      amount: Math.round(amount * 100) / 100,
      dueDate: bdue.trim(),
      overdueDays
    });
  }

  const parties = Array.from(partiesMap.values()).map(p => ({
    ...p,
    minOverdueDays: p.minOverdueDays === 999999 ? 0 : p.minOverdueDays,
    bills: p.bills.sort((a, b) => b.overdueDays - a.overdueDays)
  })).sort((a, b) => {
    if (b.netPending !== a.netPending) return b.netPending - a.netPending;
    return b.totalBilled - a.totalBilled;
  });

  const totalDemand = sumOpening + sumBilled;
  const overallRate = totalDemand > 0 ? Math.min(100, (sumPaid / totalDemand) * 100) : 0;

  return {
    source: 'Tally Prime Dual Interface (Debtor Financials + Bills Receivable)',
    company: 'SRI LAKSHMI PLYWOODS 2627',
    syncedAt: new Date().toISOString(),
    summary: {
      totalBilled: Math.round(sumBilled * 100) / 100,
      totalPaid: Math.round(sumPaid * 100) / 100,
      totalNetPending: Math.round(sumNetPending * 100) / 100,
      totalOutstanding: Math.round(sumNetPending * 100) / 100,
      overallCollectionRate: Math.round(overallRate * 10) / 10,
      totalBills,
      totalParties: parties.length,
      agingBuckets: {
        current: Math.round(agingBuckets.current * 100) / 100,
        thirtyToSixty: Math.round(agingBuckets.thirtyToSixty * 100) / 100,
        sixtyToNinety: Math.round(agingBuckets.sixtyToNinety * 100) / 100,
        ninetyToOneEighty: Math.round(agingBuckets.ninetyToOneEighty * 100) / 100,
        overOneEighty: Math.round(agingBuckets.overOneEighty * 100) / 100
      }
    },
    parties
  };
}

function parseMergedCreditorData(ledgersXml, billsXml) {
  const partiesMap = new Map();

  // 1. Parse Creditor Ledgers (Purchases, Payments, Net Pending Payable)
  const ledgerRegex = /<LEDGER NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/g;
  let lMatch;

  let sumPurchases = 0;
  let sumPaid = 0;
  let sumNetPending = 0;
  let sumOpening = 0;

  while ((lMatch = ledgerRegex.exec(ledgersXml)) !== null) {
    const rawName = lMatch[1];
    const block = lMatch[2];

    const cleanName = rawName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const parentMatch = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/);
    const opMatch = block.match(/<OPENINGBALANCE[^>]*>([^<]+)<\/OPENINGBALANCE>/);
    const clMatch = block.match(/<CLOSINGBALANCE[^>]*>([^<]+)<\/CLOSINGBALANCE>/);
    const drMatch = block.match(/<DEBITTOTALS[^>]*>([^<]+)<\/DEBITTOTALS>/);
    const crMatch = block.match(/<CREDITTOTALS[^>]*>([^<]+)<\/CREDITTOTALS>/);

    const parent = parentMatch ? parentMatch[1].replace(/&amp;/g, '&').trim() : '';
    const rawOp = parseFloat(opMatch ? opMatch[1] : 0) || 0;
    const rawCl = parseFloat(clMatch ? clMatch[1] : 0) || 0;

    // In Creditors: Debits = Payments made to supplier, Credits = Purchases invoiced
    const paid = Math.abs(parseFloat(drMatch ? drMatch[1] : 0) || 0);
    const purchases = Math.abs(parseFloat(crMatch ? crMatch[1] : 0) || 0);

    const pending = rawCl > 0 ? rawCl : (rawCl < 0 ? Math.abs(rawCl) : 0);
    const opening = Math.abs(rawOp);

    if (purchases > 0 || paid > 0 || pending > 0 || opening > 0) {
      sumPurchases += purchases;
      sumPaid += paid;
      sumNetPending += pending;
      sumOpening += opening;

      const demand = opening + purchases;
      const rate = demand > 0 ? Math.min(100, (paid / demand) * 100) : (paid > 0 ? 100 : 0);

      partiesMap.set(cleanName, {
        party: cleanName,
        parent,
        openingBalance: Math.round(opening * 100) / 100,
        totalPurchased: Math.round(purchases * 100) / 100,
        totalBilled: Math.round(purchases * 100) / 100,
        totalPaid: Math.round(paid * 100) / 100,
        netPending: Math.round(pending * 100) / 100,
        totalPayable: Math.round(pending * 100) / 100,
        paymentRate: Math.round(rate * 10) / 10,
        billsCount: 0,
        maxOverdueDays: 0,
        minOverdueDays: 0,
        bills: []
      });
    }
  }

  // 2. Parse Bills Payable (Aging & Open Supplier Invoices)
  const billPattern = /<BILLFIXED>\s*<BILLDATE>(.*?)<\/BILLDATE>\s*<BILLREF>(.*?)<\/BILLREF>\s*<BILLPARTY>(.*?)<\/BILLPARTY>\s*<\/BILLFIXED>\s*<BILLCL>(.*?)<\/BILLCL>\s*<BILLDUE>(.*?)<\/BILLDUE>\s*<BILLOVERDUE>(.*?)<\/BILLOVERDUE>/gs;

  let totalBills = 0;
  const agingBuckets = {
    current: 0,
    thirtyToSixty: 0,
    sixtyToNinety: 0,
    ninetyToOneEighty: 0,
    overOneEighty: 0
  };

  let bMatch;
  while ((bMatch = billPattern.exec(billsXml)) !== null) {
    const [, bdate, bref, bparty, bcl, bdue, boverdue] = bMatch;
    const rawAmt = parseFloat(bcl) || 0;
    const amount = Math.abs(rawAmt);
    const overdueDays = parseInt(boverdue, 10) || 0;
    const cleanParty = bparty.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const cleanRef = bref.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

    totalBills += 1;

    if (overdueDays <= 30) {
      agingBuckets.current += amount;
    } else if (overdueDays <= 60) {
      agingBuckets.thirtyToSixty += amount;
    } else if (overdueDays <= 90) {
      agingBuckets.sixtyToNinety += amount;
    } else if (overdueDays <= 180) {
      agingBuckets.ninetyToOneEighty += amount;
    } else {
      agingBuckets.overOneEighty += amount;
    }

    if (!partiesMap.has(cleanParty)) {
      continue;
    }

    const p = partiesMap.get(cleanParty);
    p.billsCount += 1;
    if (overdueDays > p.maxOverdueDays) p.maxOverdueDays = overdueDays;
    if (overdueDays < p.minOverdueDays || p.minOverdueDays === 0) p.minOverdueDays = overdueDays;

    p.bills.push({
      date: bdate.trim(),
      ref: cleanRef,
      amount: Math.round(amount * 100) / 100,
      dueDate: bdue.trim(),
      overdueDays
    });
  }

  const parties = Array.from(partiesMap.values()).map(p => ({
    ...p,
    minOverdueDays: p.minOverdueDays === 999999 ? 0 : p.minOverdueDays,
    bills: p.bills.sort((a, b) => b.overdueDays - a.overdueDays)
  })).sort((a, b) => {
    if (b.netPending !== a.netPending) return b.netPending - a.netPending;
    return b.totalPurchased - a.totalPurchased;
  });

  const totalDemand = sumOpening + sumPurchases;
  const overallRate = totalDemand > 0 ? Math.min(100, (sumPaid / totalDemand) * 100) : 0;

  return {
    source: 'Tally Prime Dual Interface (Creditor Financials + Bills Payable)',
    company: 'SRI LAKSHMI PLYWOODS 2627',
    syncedAt: new Date().toISOString(),
    summary: {
      totalPurchased: Math.round(sumPurchases * 100) / 100,
      totalBilled: Math.round(sumPurchases * 100) / 100,
      totalPaid: Math.round(sumPaid * 100) / 100,
      totalNetPending: Math.round(sumNetPending * 100) / 100,
      totalOutstanding: Math.round(sumNetPending * 100) / 100,
      overallPaymentRate: Math.round(overallRate * 10) / 10,
      totalBills,
      totalParties: parties.length,
      agingBuckets: {
        current: Math.round(agingBuckets.current * 100) / 100,
        thirtyToSixty: Math.round(agingBuckets.thirtyToSixty * 100) / 100,
        sixtyToNinety: Math.round(agingBuckets.sixtyToNinety * 100) / 100,
        ninetyToOneEighty: Math.round(agingBuckets.ninetyToOneEighty * 100) / 100,
        overOneEighty: Math.round(agingBuckets.overOneEighty * 100) / 100
      }
    },
    parties
  };
}

async function syncTally() {
  console.log('====================================================');
  console.log('  TALLY PRIME 360° FINANCIAL SYNC (DEBTORS + CREDITORS)');
  console.log('====================================================');
  console.log(`Connecting to Tally Prime at http://${TALLY_HOST}:${TALLY_PORT} ...`);
  const t0 = Date.now();

  try {
    // ----------------------------------------------------
    // 1. DEBTORS & RECEIVABLES SYNC
    // ----------------------------------------------------
    console.log('\n>>> [1/2] SYNCING SUNDRY DEBTORS & RECEIVABLES...');
    const debtorXml = `<ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>DebtorsCol</ID></HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="DebtorsCol">
                <TYPE>Ledger</TYPE>
                <CHILDOF>$$GroupSundryDebtors</CHILDOF>
                <BELONGSTO>Yes</BELONGSTO>
                <FETCH>Name,Parent,ClosingBalance,OpeningBalance,DebitTotals,CreditTotals</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`;

    const billsRecXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Bills Receivable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;

    console.log('- Fetching debtor ledgers...');
    const debtorsRaw = await queryTallyXml(debtorXml);
    console.log(`- Received ${Buffer.byteLength(debtorsRaw, 'utf8')} bytes of debtor ledgers`);

    console.log('- Fetching bills receivable...');
    const billsRecRaw = await queryTallyXml(billsRecXml);
    console.log(`- Received ${Buffer.byteLength(billsRecRaw, 'utf8')} bytes of bills receivable`);

    const debtorPayload = parseMergedDebtorData(debtorsRaw, billsRecRaw);
    console.log('  --- DEBTORS FINANCIAL SUMMARY ---');
    console.log(`  - Total Billed:        Rs. ${debtorPayload.summary.totalBilled.toLocaleString('en-IN')}`);
    console.log(`  - Total Collected:     Rs. ${debtorPayload.summary.totalPaid.toLocaleString('en-IN')}`);
    console.log(`  - Net Pending Balance: Rs. ${debtorPayload.summary.totalNetPending.toLocaleString('en-IN')}`);
    console.log(`  - Active Debtors:      ${debtorPayload.summary.totalParties}`);
    console.log(`  - Open Bills:          ${debtorPayload.summary.totalBills}`);
    console.log(`  - Collection Rate:     ${debtorPayload.summary.overallCollectionRate}%`);

    const debtorPayloadStr = JSON.stringify(debtorPayload);
    await prisma.systemSetting.upsert({
      where: { key: 'tally_receivables_data' },
      update: { value: debtorPayloadStr },
      create: { key: 'tally_receivables_data', value: debtorPayloadStr }
    });
    console.log(`  Saved tally_receivables_data (${(Buffer.byteLength(debtorPayloadStr) / 1024).toFixed(1)} KB)`);

    // ----------------------------------------------------
    // 2. CREDITORS & PAYABLES SYNC
    // ----------------------------------------------------
    console.log('\n>>> [2/2] SYNCING SUNDRY CREDITORS & PAYABLES...');
    const creditorXml = `<ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CreditorsCol</ID></HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="CreditorsCol">
                <TYPE>Ledger</TYPE>
                <CHILDOF>$$GroupSundryCreditors</CHILDOF>
                <BELONGSTO>Yes</BELONGSTO>
                <FETCH>Name,Parent,ClosingBalance,OpeningBalance,DebitTotals,CreditTotals</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`;

    const billsPayXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Bills Payable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;

    console.log('- Fetching creditor ledgers...');
    const creditorsRaw = await queryTallyXml(creditorXml);
    console.log(`- Received ${Buffer.byteLength(creditorsRaw, 'utf8')} bytes of creditor ledgers`);

    console.log('- Fetching bills payable...');
    const billsPayRaw = await queryTallyXml(billsPayXml);
    console.log(`- Received ${Buffer.byteLength(billsPayRaw, 'utf8')} bytes of bills payable`);

    const creditorPayload = parseMergedCreditorData(creditorsRaw, billsPayRaw);
    console.log('  --- CREDITORS FINANCIAL SUMMARY ---');
    console.log(`  - Total Purchased:     Rs. ${creditorPayload.summary.totalPurchased.toLocaleString('en-IN')}`);
    console.log(`  - Total Paid:          Rs. ${creditorPayload.summary.totalPaid.toLocaleString('en-IN')}`);
    console.log(`  - Net Pending Payable: Rs. ${creditorPayload.summary.totalNetPending.toLocaleString('en-IN')}`);
    console.log(`  - Active Creditors:    ${creditorPayload.summary.totalParties}`);
    console.log(`  - Open Bills:          ${creditorPayload.summary.totalBills}`);
    console.log(`  - Payment Rate:        ${creditorPayload.summary.overallPaymentRate}%`);

    const creditorPayloadStr = JSON.stringify(creditorPayload);
    await prisma.systemSetting.upsert({
      where: { key: 'tally_payables_data' },
      update: { value: creditorPayloadStr },
      create: { key: 'tally_payables_data', value: creditorPayloadStr }
    });
    console.log(`  Saved tally_payables_data (${(Buffer.byteLength(creditorPayloadStr) / 1024).toFixed(1)} KB)`);

    console.log(`\n====================================================`);
    console.log(`  ALL TALLY FINANCIALS SYNCED SUCCESSFULLY in ${Date.now() - t0}ms`);
    console.log(`====================================================`);
  } catch (err) {
    console.error('SYNC ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  syncTally();
}

module.exports = { syncTally, queryTallyXml, parseMergedDebtorData, parseMergedCreditorData };
