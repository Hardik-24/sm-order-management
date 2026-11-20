const http = require('http');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
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
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': Buffer.byteLength(minified)
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

function parseMergedTallyData(ledgersXml, billsXml) {
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

    // Option 1: Strictly associate bills with genuine Sundry Debtors (discard suppliers/creditors with debit balances)
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
    source: 'Tally Prime Dual Interface (Ledger Financials + Bills Outstandings)',
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

async function syncTally() {
  console.log('====================================================');
  console.log('  TALLY PRIME 360° FINANCIAL SYNC (BILLED + PAID)');
  console.log('====================================================');
  console.log(`Connecting to Tally Prime at http://${TALLY_HOST}:${TALLY_PORT} ...`);
  const t0 = Date.now();

  try {
    const ledgerXml = `<ENVELOPE>
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

    const billsXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Bills Receivable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;

    console.log('[1/2] Fetching Debtor Ledger Balances (Total Billed & Total Paid)...');
    const ledgersRaw = await queryTallyXml(ledgerXml);
    console.log(`- Received ${Buffer.byteLength(ledgersRaw, 'utf8')} bytes of ledger accounts`);

    console.log('[2/2] Fetching Bills Receivable Register (Aging & Overdue days)...');
    const billsRaw = await queryTallyXml(billsXml);
    console.log(`- Received ${Buffer.byteLength(billsRaw, 'utf8')} bytes of bill outstandings`);

    const payload = parseMergedTallyData(ledgersRaw, billsRaw);
    console.log('\n--- FINANCIAL POSITION SUMMARY ---');
    console.log(`- Total Invoiced (Billed):  Rs. ${payload.summary.totalBilled.toLocaleString('en-IN')}`);
    console.log(`- Total Payments Received: Rs. ${payload.summary.totalPaid.toLocaleString('en-IN')}`);
    console.log(`- Total Net Pending:       Rs. ${payload.summary.totalNetPending.toLocaleString('en-IN')}`);
    console.log(`- Overall Collection Rate: ${payload.summary.overallCollectionRate}%`);
    console.log(`- Active Debtors:          ${payload.summary.totalParties}`);
    console.log(`- Unadjusted Bills:        ${payload.summary.totalBills}`);

    const payloadString = JSON.stringify(payload);
    console.log(`\nSaving complete snapshot to Postgres (${(Buffer.byteLength(payloadString, 'utf8') / 1024).toFixed(1)} KB)...`);

    await prisma.systemSetting.upsert({
      where: { key: 'tally_receivables_data' },
      update: { value: payloadString },
      create: { key: 'tally_receivables_data', value: payloadString }
    });

    console.log(`\nSUCCESS! Synced in ${Date.now() - t0}ms`);
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

module.exports = { syncTally, queryTallyXml, parseMergedTallyData };
