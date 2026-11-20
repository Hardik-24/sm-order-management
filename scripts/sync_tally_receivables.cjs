const http = require('http');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

const TALLY_HOST = process.env.TALLY_HOST || '127.0.0.1';
const TALLY_PORT = parseInt(process.env.TALLY_PORT || '9000', 10);

function queryTally(reportId) {
  return new Promise((resolve, reject) => {
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>${reportId}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
    const req = http.request({
      hostname: TALLY_HOST,
      port: TALLY_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': Buffer.byteLength(xml)
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

    req.write(xml);
    req.end();
  });
}

function parseBillsXml(xmlText) {
  // Regex to extract each BILL block
  const pattern = /<BILLFIXED>\s*<BILLDATE>(.*?)<\/BILLDATE>\s*<BILLREF>(.*?)<\/BILLREF>\s*<BILLPARTY>(.*?)<\/BILLPARTY>\s*<\/BILLFIXED>\s*<BILLCL>(.*?)<\/BILLCL>\s*<BILLDUE>(.*?)<\/BILLDUE>\s*<BILLOVERDUE>(.*?)<\/BILLOVERDUE>/gs;
  
  const partiesMap = new Map();
  let totalOutstanding = 0;
  let totalBills = 0;

  const agingBuckets = {
    current: 0,       // 0-30 days
    thirtyToSixty: 0, // 31-60 days
    sixtyToNinety: 0, // 61-90 days
    ninetyToOneEighty: 0, // 91-180 days
    overOneEighty: 0  // 180+ days
  };

  let match;
  while ((match = pattern.exec(xmlText)) !== null) {
    const [, bdate, bref, bparty, bcl, bdue, boverdue] = match;
    
    // In Tally standard export, negative number indicates Debit (receivable from customer)
    const rawAmt = parseFloat(bcl) || 0;
    const amount = Math.abs(rawAmt);
    const overdueDays = parseInt(boverdue, 10) || 0;
    const cleanParty = bparty.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const cleanRef = bref.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

    totalOutstanding += amount;
    totalBills += 1;

    // Aging categorization
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
      partiesMap.set(cleanParty, {
        party: cleanParty,
        totalReceivable: 0,
        billsCount: 0,
        maxOverdueDays: 0,
        minOverdueDays: 999999,
        bills: []
      });
    }

    const p = partiesMap.get(cleanParty);
    p.totalReceivable += amount;
    p.billsCount += 1;
    if (overdueDays > p.maxOverdueDays) p.maxOverdueDays = overdueDays;
    if (overdueDays < p.minOverdueDays) p.minOverdueDays = overdueDays;

    p.bills.push({
      date: bdate.trim(),
      ref: cleanRef,
      amount: Math.round(amount * 100) / 100,
      dueDate: bdue.trim(),
      overdueDays
    });
  }

  // Convert map to sorted array
  const parties = Array.from(partiesMap.values()).map(p => ({
    ...p,
    totalReceivable: Math.round(p.totalReceivable * 100) / 100,
    minOverdueDays: p.minOverdueDays === 999999 ? 0 : p.minOverdueDays,
    // Sort bills newest date / highest overdue
    bills: p.bills.sort((a, b) => b.overdueDays - a.overdueDays)
  })).sort((a, b) => b.totalReceivable - a.totalReceivable);

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalBills,
    totalParties: parties.length,
    agingBuckets: {
      current: Math.round(agingBuckets.current * 100) / 100,
      thirtyToSixty: Math.round(agingBuckets.thirtyToSixty * 100) / 100,
      sixtyToNinety: Math.round(agingBuckets.sixtyToNinety * 100) / 100,
      ninetyToOneEighty: Math.round(agingBuckets.ninetyToOneEighty * 100) / 100,
      overOneEighty: Math.round(agingBuckets.overOneEighty * 100) / 100
    },
    parties
  };
}

async function syncTally() {
  console.log('====================================================');
  console.log('  TALLY PRIME READ-ONLY RECEIVABLES SYNC AGENT');
  console.log('====================================================');
  console.log(`Connecting to Tally Prime at http://${TALLY_HOST}:${TALLY_PORT} ...`);
  const t0 = Date.now();

  try {
    const xml = await queryTally('Bills Receivable');
    console.log(`Received ${Buffer.byteLength(xml, 'utf8')} bytes from Tally in ${Date.now() - t0}ms`);

    const parsed = parseBillsXml(xml);
    console.log(`Parsed Data:`);
    console.log(`- Total Outstanding:  Rs. ${parsed.totalOutstanding.toLocaleString('en-IN')}`);
    console.log(`- Total Debtors:      ${parsed.totalParties}`);
    console.log(`- Total Unpaid Bills: ${parsed.totalBills}`);

    const payload = {
      source: 'Tally Prime Local Read-Only Sync',
      company: 'SRI LAKSHMI PLYWOODS 2627',
      syncedAt: new Date().toISOString(),
      summary: {
        totalOutstanding: parsed.totalOutstanding,
        totalBills: parsed.totalBills,
        totalParties: parsed.totalParties,
        agingBuckets: parsed.agingBuckets
      },
      parties: parsed.parties
    };

    const payloadString = JSON.stringify(payload);
    console.log(`Saving to database key 'tally_receivables_data' (${(Buffer.byteLength(payloadString, 'utf8') / 1024).toFixed(1)} KB)...`);

    await prisma.systemSetting.upsert({
      where: { key: 'tally_receivables_data' },
      update: { value: payloadString },
      create: { key: 'tally_receivables_data', value: payloadString }
    });

    console.log(`SUCCESS! Tally receivables synced to Postgres in ${Date.now() - t0}ms`);
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

module.exports = { syncTally, queryTally, parseBillsXml };
