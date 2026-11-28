const http = require('http');
const { PrismaClient } = require('@prisma/client');
try { require('dotenv').config(); } catch (_) {}

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.xfzvkqjkbwwdqtxgasrh:csYX9pwTCZyZC5IZ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

const TALLY_HOST = process.env.TALLY_HOST || '127.0.0.1';
const TALLY_PORT = parseInt(process.env.TALLY_PORT || '9000', 10);

function queryTallyXml(xml, timeoutMs = 90000) {
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
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Tally request timed out (${timeoutMs / 1000}s)`));
    });

    req.write(minified);
    req.end();
  });
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatTallyDisplayDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || '';
  const y = yyyymmdd.substring(2, 4);
  const mIdx = parseInt(yyyymmdd.substring(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.substring(6, 8), 10);
  const mStr = MONTH_ABBR[mIdx] || 'Jan';
  return `${d}-${mStr}-${y}`;
}

function parseDetailedVouchers(xml) {
  if (!xml) return [];
  const vouchers = [];
  const vchPattern = /<VOUCHER[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = vchPattern.exec(xml)) !== null) {
    const block = match[1];
    const dateMatch = block.match(/<DATE[^>]*>([^<]+)<\/DATE>/i);
    const typeMatch = block.match(/<VOUCHERTYPENAME[^>]*>([^<]+)<\/VOUCHERTYPENAME>/i);
    const numMatch = block.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i);
    const refMatch = block.match(/<REFERENCE[^>]*>([^<]+)<\/REFERENCE>/i);
    const partyMatch = block.match(/<PARTYLEDGERNAME[^>]*>([^<]+)<\/PARTYLEDGERNAME>/i) || block.match(/<PARTYNAME[^>]*>([^<]+)<\/PARTYNAME>/i);
    const amtMatch = block.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i);

    const vDate = dateMatch ? formatTallyDisplayDate(dateMatch[1].trim()) : '';
    const vType = typeMatch ? typeMatch[1].trim() : '';
    const vNum = numMatch ? numMatch[1].trim() : '';
    const vRef = refMatch ? refMatch[1].trim() : vNum;
    const vParty = partyMatch ? partyMatch[1].replace(/&amp;/g, '&').trim() : '';
    const rawAmt = amtMatch ? Math.abs(parseFloat(amtMatch[1])) : 0;

    // Extract other ledger entries to identify opposing accounts (e.g. Bank HDFC, Sales GST@18%)
    const entries = [];
    const entryPattern = /<ALLLEDGERENTRIES\.LIST[^>]*>([\s\S]*?)<\/ALLLEDGERENTRIES\.LIST>/gi;
    let eMatch;
    while ((eMatch = entryPattern.exec(block)) !== null) {
      const eBlock = eMatch[1];
      const lNameMatch = eBlock.match(/<LEDGERNAME[^>]*>([^<]+)<\/LEDGERNAME>/i);
      const lAmtMatch = eBlock.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i);
      const lPosMatch = eBlock.match(/<ISDEEMEDPOSITIVE[^>]*>([^<]+)<\/ISDEEMEDPOSITIVE>/i);
      if (lNameMatch) {
        entries.push({
          name: lNameMatch[1].replace(/&amp;/g, '&').trim(),
          amount: parseFloat(lAmtMatch ? lAmtMatch[1] : 0) || 0,
          isDeemedPositive: lPosMatch ? lPosMatch[1].trim().toLowerCase() === 'yes' : false
        });
      }
    }

    if (vNum || vRef || vParty) {
      vouchers.push({
        date: vDate,
        vchType: vType,
        vchNo: vNum || vRef,
        ref: vRef,
        party: vParty,
        amount: Math.round(rawAmt * 100) / 100,
        entries
      });
    }
  }
  return vouchers;
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

function parseMergedDebtorData(ledgersXml, billsXml, companyName) {
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
    // In Tally: negative (< 0) = Debit (Dr), positive (> 0) = Credit (Cr)
    const openingType = rawOp < 0 ? 'Dr' : (rawOp > 0 ? 'Cr' : 'Dr');
    const closingType = rawCl < 0 ? 'Dr' : (rawCl > 0 ? 'Cr' : 'Dr');

    if (billed > 0 || paid > 0 || pending > 0 || opening > 0 || advance > 0) {
      sumBilled += billed;
      sumPaid += paid;
      sumNetPending += pending;
      sumOpening += opening;

      const demand = opening + billed;
      const rate = demand > 0 ? Math.min(100, (paid / demand) * 100) : (paid > 0 ? 100 : 0);

      // Extract address & contact info directly from Tally Ledger Master
      const addressLines = [];
      const addrListMatch = block.match(/<ADDRESS\.LIST[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i);
      const addrSource = addrListMatch ? addrListMatch[1] : block;
      const addrRegex = /<ADDRESS[^>]*>([^<]+)<\/ADDRESS>/gi;
      let aMatch;
      while ((aMatch = addrRegex.exec(addrSource)) !== null) {
        const line = aMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (line) addressLines.push(line);
      }

      const phoneMatch = block.match(/<LEDGERPHONE[^>]*>([^<]+)<\/LEDGERPHONE>/i);
      const mobileMatch = block.match(/<LEDGERMOBILE[^>]*>([^<]+)<\/LEDGERMOBILE>/i);
      const pinMatch = block.match(/<PINCODE[^>]*>([^<]+)<\/PINCODE>/i);
      const stateMatch = block.match(/<LEDGERSTATENAME[^>]*>([^<]+)<\/LEDGERSTATENAME>/i) || block.match(/<STATENAME[^>]*>([^<]+)<\/STATENAME>/i);
      const gstinMatch = block.match(/<PARTYGSTIN[^>]*>([^<]+)<\/PARTYGSTIN>/i) || block.match(/<GSTIN[^>]*>([^<]+)<\/GSTIN>/i);
      const gstTypeMatch = block.match(/<GSTREGISTRATIONTYPE[^>]*>([^<]+)<\/GSTREGISTRATIONTYPE>/i);

      const phone = phoneMatch ? phoneMatch[1].trim() : (mobileMatch ? mobileMatch[1].trim() : '');
      const pincode = pinMatch ? pinMatch[1].trim() : '';
      const state = stateMatch ? stateMatch[1].trim() : '';
      const gstin = gstinMatch ? gstinMatch[1].trim() : '';
      const gstType = gstTypeMatch ? gstTypeMatch[1].trim() : (gstin.length === 15 ? 'Regular' : 'Unregistered');

      partiesMap.set(cleanName, {
        party: cleanName,
        parent,
        openingBalance: Math.round(opening * 100) / 100,
        openingType,
        closingType,
        totalBilled: Math.round(billed * 100) / 100,
        totalPaid: Math.round(paid * 100) / 100,
        netPending: Math.round(pending * 100) / 100,
        advance: Math.round(advance * 100) / 100,
        collectionRate: Math.round(rate * 10) / 10,
        totalReceivable: Math.round(pending * 100) / 100,
        billsCount: 0,
        maxOverdueDays: 0,
        minOverdueDays: 0,
        bills: [],
        addressLines,
        address: addressLines.join(', '),
        phone,
        pincode,
        state,
        gstin,
        gstType
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
    company: companyName || 'SRI LAKSHMI PLYWOODS 2627',
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

function parseMergedCreditorData(ledgersXml, billsXml, companyName) {
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
    // In Tally: positive (> 0) = Credit (Cr), negative (< 0) = Debit (Dr)
    const openingType = rawOp > 0 ? 'Cr' : (rawOp < 0 ? 'Dr' : 'Cr');
    const closingType = rawCl > 0 ? 'Cr' : (rawCl < 0 ? 'Dr' : 'Cr');

    if (purchases > 0 || paid > 0 || pending > 0 || opening > 0) {
      sumPurchases += purchases;
      sumPaid += paid;
      sumNetPending += pending;
      sumOpening += opening;

      const demand = opening + purchases;
      const rate = demand > 0 ? Math.min(100, (paid / demand) * 100) : (paid > 0 ? 100 : 0);

      // Extract address & contact info directly from Tally Ledger Master
      const addressLines = [];
      const addrListMatch = block.match(/<ADDRESS\.LIST[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i);
      const addrSource = addrListMatch ? addrListMatch[1] : block;
      const addrRegex = /<ADDRESS[^>]*>([^<]+)<\/ADDRESS>/gi;
      let aMatch;
      while ((aMatch = addrRegex.exec(addrSource)) !== null) {
        const line = aMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (line) addressLines.push(line);
      }

      const phoneMatch = block.match(/<LEDGERPHONE[^>]*>([^<]+)<\/LEDGERPHONE>/i);
      const mobileMatch = block.match(/<LEDGERMOBILE[^>]*>([^<]+)<\/LEDGERMOBILE>/i);
      const pinMatch = block.match(/<PINCODE[^>]*>([^<]+)<\/PINCODE>/i);
      const stateMatch = block.match(/<LEDGERSTATENAME[^>]*>([^<]+)<\/LEDGERSTATENAME>/i) || block.match(/<STATENAME[^>]*>([^<]+)<\/STATENAME>/i);
      const gstinMatch = block.match(/<PARTYGSTIN[^>]*>([^<]+)<\/PARTYGSTIN>/i) || block.match(/<GSTIN[^>]*>([^<]+)<\/GSTIN>/i);
      const gstTypeMatch = block.match(/<GSTREGISTRATIONTYPE[^>]*>([^<]+)<\/GSTREGISTRATIONTYPE>/i);

      const phone = phoneMatch ? phoneMatch[1].trim() : (mobileMatch ? mobileMatch[1].trim() : '');
      const pincode = pinMatch ? pinMatch[1].trim() : '';
      const state = stateMatch ? stateMatch[1].trim() : '';
      const gstin = gstinMatch ? gstinMatch[1].trim() : '';
      const gstType = gstTypeMatch ? gstTypeMatch[1].trim() : (gstin.length === 15 ? 'Regular' : 'Unregistered');

      partiesMap.set(cleanName, {
        party: cleanName,
        parent,
        openingBalance: Math.round(opening * 100) / 100,
        openingType,
        closingType,
        totalPurchased: Math.round(purchases * 100) / 100,
        totalBilled: Math.round(purchases * 100) / 100,
        totalPaid: Math.round(paid * 100) / 100,
        netPending: Math.round(pending * 100) / 100,
        totalPayable: Math.round(pending * 100) / 100,
        paymentRate: Math.round(rate * 10) / 10,
        billsCount: 0,
        maxOverdueDays: 0,
        minOverdueDays: 0,
        bills: [],
        addressLines,
        address: addressLines.join(', '),
        phone,
        pincode,
        state,
        gstin,
        gstType
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
    company: companyName || 'SRI LAKSHMI PLYWOODS 2627',
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

function formatTallyDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  const y = yyyymmdd.substring(0, 4);
  const m = yyyymmdd.substring(4, 6);
  const d = yyyymmdd.substring(6, 8);
  return `${d}-${m}-${y}`;
}

async function getActiveCompany() {
  const xml = `<ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurCmpCol</ID></HEADER>
    <BODY>
      <DESC>
        <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="CurCmpCol">
              <TYPE>Company</TYPE>
              <FETCH>Name,StartingFrom,EndingAt</FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </DESC>
    </BODY>
  </ENVELOPE>`;

  const res = await queryTallyXml(xml);
  const cmpMatch = res.match(/<COMPANY[^>]*NAME="([^"]+)"/i);
  if (!cmpMatch) {
    throw new Error('Tally Prime is connected, but NO Company is opened! Please open your company in Tally Prime.');
  }

  const name = cmpMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  const startMatch = res.match(/<STARTINGFROM[^>]*>([^<]+)<\/STARTINGFROM>/i);
  const endMatch = res.match(/<ENDINGAT[^>]*>([^<]+)<\/ENDINGAT>/i);

  const fromDate = startMatch ? formatTallyDate(startMatch[1].trim()) : '';
  const toDate = endMatch ? formatTallyDate(endMatch[1].trim()) : '';

  // Safety Guard: Ensure nobody accidentally syncs the wrong company into OMS
  let expectedCompany = process.env.TALLY_EXPECTED_COMPANY;
  if (!expectedCompany) {
    try {
      const fs = require('fs');
      const path = require('path');
      const candidates = [
        path.join(__dirname, '..', 'config.json'),
        path.join(process.cwd(), 'config.json'),
        path.join(process.cwd(), 'sync_agent', 'config.json')
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          const cfg = JSON.parse(fs.readFileSync(c, 'utf8'));
          if (cfg && cfg.TallyCompanyName) {
            expectedCompany = cfg.TallyCompanyName;
            break;
          }
        }
      }
    } catch (_) {}
  }
  if (!expectedCompany) {
    expectedCompany = 'SRI LAKSHMI PLYWOODS 2627';
  }

  const cleanExpected = expectedCompany.trim().toUpperCase();
  const cleanActive = name.trim().toUpperCase();
  if (cleanActive !== cleanExpected) {
    throw new Error(`SAFETY BLOCK: Company mismatch! Currently open company in Tally is "${name}", but Sync Agent is strictly configured for "${expectedCompany}"! Sync aborted to protect OMS data.`);
  }

  return { name, fromDate, toDate, expectedCompany };
}

async function syncTally() {
  console.log('====================================================');
  console.log('  TALLY PRIME 360° FINANCIAL SYNC (DEBTORS + CREDITORS)');
  console.log('====================================================');
  console.log(`Connecting to Tally Prime at http://${TALLY_HOST}:${TALLY_PORT} ...`);
  const t0 = Date.now();

  try {
    // ----------------------------------------------------
    // 0. DETECT ACTIVE COMPANY & FINANCIAL PERIOD
    // ----------------------------------------------------
    console.log('- Identifying active Tally company...');
    const company = await getActiveCompany();
    console.log(`\n====================================================`);
    console.log(`[✓] Active Tally Company : ${company.name}`);
    console.log(`[✓] Security Match Check : PASSED (Matches "${company.expectedCompany}")`);
    if (company.fromDate && company.toDate) {
      console.log(`    Financial Period     : ${company.fromDate} to ${company.toDate}`);
    }
    console.log(`====================================================`);

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
                <FETCH>Name,Parent,ClosingBalance,OpeningBalance,DebitTotals,CreditTotals,Address,LedgerPhone,LedgerMobile,Pincode,CountryName,StateName,LedgerStateName,PartyGSTIN,GSTRegistrationType</FETCH>
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

    const debtorPayload = parseMergedDebtorData(debtorsRaw, billsRecRaw, company.name);

    console.log('- Fetching sales register vouchers (for direct voucher matching)...');
    try {
      const salesVchXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>SalesVchCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="SalesVchCol"><TYPE>Voucher</TYPE><FILTER>IsSalesFilter</FILTER><FETCH>Date,VoucherNumber,Reference,PartyLedgerName,Amount</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="IsSalesFilter">$$IsSales:$VoucherTypeName</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const salesRaw = await queryTallyXml(salesVchXml);
      debtorPayload.vouchers = parseSalesVouchers(salesRaw);
      console.log(`- Extracted ${debtorPayload.vouchers.length} sales register vouchers from Tally`);
    } catch (e) {
      console.log(`- Sales register vouchers query note: ${e.message}`);
    }

    console.log('- Fetching detailed debtor transactions (Sales, Receipts, Journals)...');
    try {
      const detailedVchXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>DetailedVchCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="DetailedVchCol"><TYPE>Voucher</TYPE><FILTER>IsFinancialVoucher</FILTER><FETCH>Date,VoucherTypeName,VoucherNumber,Reference,PartyLedgerName,Amount,AllLedgerEntries.List</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="IsFinancialVoucher">$$IsSales:$VoucherTypeName OR $$IsReceipt:$VoucherTypeName OR $$IsJournal:$VoucherTypeName OR $$IsCreditNote:$VoucherTypeName OR $$IsDebitNote:$VoucherTypeName</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const detailedRaw = await queryTallyXml(detailedVchXml);
      const allVouchers = parseDetailedVouchers(detailedRaw);
      console.log(`- Extracted ${allVouchers.length} total debtor financial vouchers from Tally`);

      const partyMap = new Map();
      debtorPayload.parties.forEach(p => {
        p.transactions = [];
        partyMap.set(p.party.toLowerCase(), p);
      });

      for (const v of allVouchers) {
        const pKey = (v.party || '').toLowerCase();
        let p = partyMap.get(pKey);
        if (!p) {
          p = {
            party: v.party,
            parent: 'Other Ledger (From Voucher Register)',
            openingBalance: 0,
            totalBilled: 0,
            totalPaid: 0,
            netPending: 0,
            advance: 0,
            collectionRate: 100,
            totalReceivable: 0,
            billsCount: 0,
            maxOverdueDays: 0,
            minOverdueDays: 0,
            bills: [],
            addressLines: [],
            address: '',
            phone: '',
            pincode: '',
            state: '',
            gstin: '',
            transactions: []
          };
          debtorPayload.parties.push(p);
          partyMap.set(pKey, p);
        }

        let opposing = '';
        if (v.entries && v.entries.length > 0) {
          const other = v.entries.find(e => e.name.toLowerCase() !== pKey);
          if (other) opposing = other.name;
        }

        let particulars = opposing || v.vchType;
        let debit = null;
        let credit = null;

        const vTypeLower = (v.vchType || '').toLowerCase();
        const pEntry = v.entries && v.entries.find(e => e.name.toLowerCase() === pKey);

        if (vTypeLower.includes('sale')) {
          particulars = `To ${opposing || 'Sales GST@18%'}`;
          debit = v.amount;
        } else if (vTypeLower.includes('receipt')) {
          particulars = `By ${opposing || 'Bank / Cash'}`;
          credit = v.amount;
        } else if (vTypeLower.includes('credit note')) {
          particulars = `By ${opposing || 'Sales Return'}`;
          credit = v.amount;
        } else if (vTypeLower.includes('debit note')) {
          particulars = `To ${opposing || 'Debit Note'}`;
          debit = v.amount;
        } else if (vTypeLower.includes('payment')) {
          particulars = `To ${opposing || 'Bank / Cash'}`;
          debit = v.amount;
        } else if (vTypeLower.includes('journal')) {
          if (pEntry && (pEntry.isDeemedPositive || pEntry.amount < 0)) {
            particulars = `To ${opposing || 'Journal'}`;
            debit = Math.abs(pEntry.amount);
          } else {
            particulars = `By ${opposing || 'Journal'}`;
            credit = pEntry ? Math.abs(pEntry.amount) : v.amount;
          }
        } else if (pEntry) {
          if (pEntry.isDeemedPositive || pEntry.amount < 0) {
            particulars = `To ${opposing || v.vchType}`;
            debit = Math.abs(pEntry.amount);
          } else {
            particulars = `By ${opposing || v.vchType}`;
            credit = Math.abs(pEntry.amount);
          }
        }

        p.transactions.push({
          date: v.date,
          particulars,
          vchType: v.vchType,
          vchNo: v.vchNo,
          debit,
          credit
        });
      }
    } catch (e) {
      console.log(`- Detailed debtor vouchers note: ${e.message}`);
    }
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
                <FETCH>Name,Parent,ClosingBalance,OpeningBalance,DebitTotals,CreditTotals,Address,LedgerPhone,LedgerMobile,Pincode,CountryName,StateName,LedgerStateName,PartyGSTIN,GSTRegistrationType</FETCH>
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

    const creditorPayload = parseMergedCreditorData(creditorsRaw, billsPayRaw, company.name);

    console.log('- Fetching purchase register vouchers (for direct voucher matching)...');
    try {
      const purVchXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>PurVchCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="PurVchCol"><TYPE>Voucher</TYPE><FILTER>IsPurFilter</FILTER><FETCH>Date,VoucherNumber,Reference,PartyLedgerName,Amount</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="IsPurFilter">$$IsPurchase:$VoucherTypeName</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const purRaw = await queryTallyXml(purVchXml);
      creditorPayload.vouchers = parseSalesVouchers(purRaw);
      console.log(`- Extracted ${creditorPayload.vouchers.length} purchase register vouchers from Tally`);
    } catch (e) {
      console.log(`- Purchase register vouchers query note: ${e.message}`);
    }

    console.log('- Fetching detailed creditor transactions (Purchases, Payments, Journals)...');
    try {
      const detailedCredVchXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>DetailedCredVchCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="DetailedCredVchCol"><TYPE>Voucher</TYPE><FILTER>IsFinancialCredVoucher</FILTER><FETCH>Date,VoucherTypeName,VoucherNumber,Reference,PartyLedgerName,Amount,AllLedgerEntries.List</FETCH></COLLECTION><SYSTEM TYPE="Formulae" NAME="IsFinancialCredVoucher">$$IsPurchase:$VoucherTypeName OR $$IsPayment:$VoucherTypeName OR $$IsJournal:$VoucherTypeName OR $$IsCreditNote:$VoucherTypeName OR $$IsDebitNote:$VoucherTypeName</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
      const detailedCredRaw = await queryTallyXml(detailedCredVchXml);
      const allCredVouchers = parseDetailedVouchers(detailedCredRaw);
      console.log(`- Extracted ${allCredVouchers.length} total creditor financial vouchers from Tally`);

      const credPartyMap = new Map();
      creditorPayload.parties.forEach(p => {
        p.transactions = [];
        credPartyMap.set(p.party.toLowerCase(), p);
      });

      for (const v of allCredVouchers) {
        const pKey = (v.party || '').toLowerCase();
        let p = credPartyMap.get(pKey);
        if (!p) {
          p = {
            party: v.party,
            parent: 'Other Ledger (From Voucher Register)',
            openingBalance: 0,
            totalPurchases: 0,
            totalPaid: 0,
            netPending: 0,
            advance: 0,
            billsCount: 0,
            maxOverdueDays: 0,
            minOverdueDays: 0,
            bills: [],
            addressLines: [],
            address: '',
            phone: '',
            pincode: '',
            state: '',
            gstin: '',
            transactions: []
          };
          creditorPayload.parties.push(p);
          credPartyMap.set(pKey, p);
        }

        let opposing = '';
        if (v.entries && v.entries.length > 0) {
          const other = v.entries.find(e => e.name.toLowerCase() !== pKey);
          if (other) opposing = other.name;
        }

        let particulars = opposing || v.vchType;
        let debit = null;
        let credit = null;

        const vTypeLower = (v.vchType || '').toLowerCase();
        const pEntry = v.entries && v.entries.find(e => e.name.toLowerCase() === pKey);

        if (vTypeLower.includes('purchase')) {
          particulars = `By ${opposing || 'Purchase GST@18%'}`;
          credit = v.amount;
        } else if (vTypeLower.includes('payment')) {
          particulars = `To ${opposing || 'Bank / Cash'}`;
          debit = v.amount;
        } else if (vTypeLower.includes('debit note')) {
          particulars = `To ${opposing || 'Purchase Return'}`;
          debit = v.amount;
        } else if (vTypeLower.includes('credit note')) {
          particulars = `By ${opposing || 'Credit Note'}`;
          credit = v.amount;
        } else if (vTypeLower.includes('receipt')) {
          particulars = `By ${opposing || 'Bank / Cash'}`;
          credit = v.amount;
        } else if (vTypeLower.includes('journal')) {
          if (pEntry && (pEntry.isDeemedPositive || pEntry.amount < 0)) {
            particulars = `To ${opposing || 'Journal'}`;
            debit = Math.abs(pEntry.amount);
          } else {
            particulars = `By ${opposing || 'Journal'}`;
            credit = pEntry ? Math.abs(pEntry.amount) : v.amount;
          }
        } else if (pEntry) {
          if (pEntry.isDeemedPositive || pEntry.amount < 0) {
            particulars = `To ${opposing || v.vchType}`;
            debit = Math.abs(pEntry.amount);
          } else {
            particulars = `By ${opposing || v.vchType}`;
            credit = Math.abs(pEntry.amount);
          }
        }

        p.transactions.push({
          date: v.date,
          particulars,
          vchType: v.vchType,
          vchNo: v.vchNo,
          debit,
          credit
        });
      }
    } catch (e) {
      console.log(`- Detailed creditor vouchers note: ${e.message}`);
    }
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

    // ----------------------------------------------------
    // 3. COMPLETE MASTER LEDGER SYNC (ALL 1000+ ACCOUNTS)
    // ----------------------------------------------------
    console.log('\n>>> [3/3] SYNCING ALL TALLY MASTER LEDGERS (ALL 1000+ ACCOUNTS)...');
    try {
      const allDebtorNamesSet = new Set();
      const debtorNameMatches = debtorsRaw.matchAll(/<LEDGER NAME="([^"]+)"/gi);
      for (const m of debtorNameMatches) {
        const clean = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (clean) allDebtorNamesSet.add(clean);
      }

      const allCreditorNamesSet = new Set();
      const creditorNameMatches = creditorsRaw.matchAll(/<LEDGER NAME="([^"]+)"/gi);
      for (const m of creditorNameMatches) {
        const clean = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (clean) allCreditorNamesSet.add(clean);
      }

      const allLedgersXml = `<ENVELOPE>
        <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>AllLedgersMasterCol</ID></HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
            <TDL>
              <TDLMESSAGE>
                <COLLECTION NAME="AllLedgersMasterCol">
                  <TYPE>Ledger</TYPE>
                  <FETCH>Name,Parent,Address,StateName,LedgerStateName,CountryName,PartyGSTIN,GSTRegistrationType,PinCode</FETCH>
                </COLLECTION>
              </TDLMESSAGE>
            </TDL>
          </DESC>
        </BODY>
      </ENVELOPE>`;

      const allLedgersRaw = await queryTallyXml(allLedgersXml);
      const allLedgerItems = [];
      const salesAccounts = new Set(['Sales GST@18%', 'Sales GST@28%', 'Sales GST@12%', 'Sales GST@5%', 'Sales IGST@18%']);
      const purchaseAccounts = new Set(['Purchase GST@18%', 'Purchase GST@28%', 'Purchase GST@12%', 'Purchase GST@5%', 'Purchase IGST@18%']);
      const taxAccounts = new Set([
        'Output CGST@9%', 'Output SGST@9%', 'Output IGST@18%',
        'Input CGST@9%', 'Input SGST@9%', 'Input IGST @18%'
      ]);
      const roundOffAccounts = new Set(['Sales Rounding Off', 'Purchase Rounding Off', 'Rounding Off']);

      const allLedgerRegex = /<LEDGER NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>/gi;
      for (const m of allLedgersRaw.matchAll(allLedgerRegex)) {
        const name = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        const block = m[2];
        const parentMatch = block.match(/<PARENT[^>]*>([^<]+)<\/PARENT>/i);
        const parent = parentMatch ? parentMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
        if (!name) continue;

        const stateMatch = block.match(/<LEDGERSTATENAME[^>]*>([^<]+)<\/LEDGERSTATENAME>/i) || block.match(/<STATENAME[^>]*>([^<]+)<\/STATENAME>/i);
        const gstinMatch = block.match(/<PARTYGSTIN[^>]*>([^<]+)<\/PARTYGSTIN>/i) || block.match(/<GSTIN[^>]*>([^<]+)<\/GSTIN>/i);
        const gstTypeMatch = block.match(/<GSTREGISTRATIONTYPE[^>]*>([^<]+)<\/GSTREGISTRATIONTYPE>/i);
        const pinMatch = block.match(/<PINCODE[^>]*>([^<]+)<\/PINCODE>/i);

        const addressLines = [];
        const addrListMatch = block.match(/<ADDRESS\.LIST[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i);
        const addrSource = addrListMatch ? addrListMatch[1] : block;
        const addrRegex = /<ADDRESS[^>]*>([^<]+)<\/ADDRESS>/gi;
        let aMatch;
        while ((aMatch = addrRegex.exec(addrSource)) !== null) {
          const line = aMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
          if (line) addressLines.push(line);
        }

        const state = stateMatch ? stateMatch[1].trim() : '';
        const gstin = gstinMatch ? gstinMatch[1].trim() : '';
        const gstType = gstTypeMatch ? gstTypeMatch[1].trim() : (gstin.length === 15 ? 'Regular' : 'Unregistered');
        const pincode = pinMatch ? pinMatch[1].trim() : '';

        allLedgerItems.push({ name, parent, addressLines, state, gstin, gstType, pincode });

        const parentUpper = parent.toUpperCase();
        const nameUpper = name.toUpperCase();

        if (parentUpper.includes('SUNDRY DEBTOR')) {
          allDebtorNamesSet.add(name);
        } else if (parentUpper.includes('SUNDRY CREDITOR')) {
          allCreditorNamesSet.add(name);
        } else if (parentUpper.includes('SALES')) {
          salesAccounts.add(name);
        } else if (parentUpper.includes('PURCHASE')) {
          purchaseAccounts.add(name);
        } else if (parentUpper.includes('DUTIES') || parentUpper.includes('TAX') || parentUpper === 'GST' || nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST')) {
          taxAccounts.add(name);
        } else if (nameUpper.includes('ROUND')) {
          roundOffAccounts.add(name);
        }
      }

      const masterPayload = {
        syncedAt: new Date().toISOString(),
        company: company.name || 'SRI LAKSHMI PLYWOODS 2627',
        totalLedgers: allLedgerItems.length || (allDebtorNamesSet.size + allCreditorNamesSet.size),
        debtors: Array.from(allDebtorNamesSet).sort(),
        creditors: Array.from(allCreditorNamesSet).sort(),
        salesAccounts: Array.from(salesAccounts).sort(),
        purchaseAccounts: Array.from(purchaseAccounts).sort(),
        taxAccounts: Array.from(taxAccounts).sort(),
        roundOffAccounts: Array.from(roundOffAccounts).sort(),
        allLedgers: allLedgerItems
      };

      const masterPayloadStr = JSON.stringify(masterPayload);
      await prisma.systemSetting.upsert({
        where: { key: 'tally_master_ledgers' },
        update: { value: masterPayloadStr },
        create: { key: 'tally_master_ledgers', value: masterPayloadStr }
      });
      console.log(`  Saved tally_master_ledgers (${(Buffer.byteLength(masterPayloadStr) / 1024).toFixed(1)} KB): ${masterPayload.debtors.length} debtors, ${masterPayload.creditors.length} creditors, ${masterPayload.totalLedgers} total ledgers across Tally.`);
    } catch (e) {
      console.log(`- Master ledgers sync note: ${e.message}`);
    }

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
