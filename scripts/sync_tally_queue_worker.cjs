/**
 * sync_tally_queue_worker.cjs
 * 
 * Background worker running on Main PC alongside SMFlowSyncAgent.
 * Listens for pending voucher posting jobs from OMS Cloud (Supabase),
 * transmits the XML payload to local Tally Prime (127.0.0.1:9000),
 * and reports the result (SUCCESS / FAILED) back to the cloud database.
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');
try { require('dotenv').config(); } catch (_) {}

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.xfzvkqjkbwwdqtxgasrh:csYX9pwTCZyZC5IZ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

let rawHost = process.env.TALLY_HOST || '127.0.0.1';
if (rawHost === 'localhost') rawHost = '127.0.0.1';
const TALLY_HOST = rawHost;
const TALLY_PORT = parseInt(process.env.TALLY_PORT || '9000', 10);

function queryTally(xml, timeoutMs = 15000) {
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
      reject(new Error(`Tally request timed out (${timeoutMs}ms)`));
    });

    req.write(minified);
    req.end();
  });
}

async function getOpenTallyCompany() {
  try {
    const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurCmpCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="CurCmpCol"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const res = await queryTally(xml, 4000);
    const match = res.match(/<COMPANY[^>]*NAME="([^"]+)"/i) || res.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
    if (!match) return 'SRI LAKSHMI PLYWOODS 2627';
    return match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  } catch (_) {
    return 'SRI LAKSHMI PLYWOODS 2627';
  }
}

async function processPendingJobs() {
  // Fetch pending jobs (FIFO)
  const jobs = await prisma.$queryRawUnsafe(
    `SELECT id, voucher_no as "voucherNo", voucher_type as "voucherType", payload, created_at as "createdAt"
     FROM tally_voucher_queue
     WHERE status = 'PENDING'
     ORDER BY created_at ASC
     LIMIT 5`
  );

  if (!jobs || jobs.length === 0) return 0;

  for (const job of jobs) {
    const jobId = job.id;
    const vchNo = job.voucherNo;
    const vchType = job.voucherType;
    console.log(`\n[Tally Worker] Picking up job #${jobId} (Voucher: ${vchNo}, Type: ${vchType})...`);

    // 1. Mark as PROCESSING
    await prisma.$queryRawUnsafe(
      `UPDATE tally_voucher_queue SET status = 'PROCESSING', updated_at = now() WHERE id = $1::uuid`,
      jobId
    );

    try {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      let tallyXml = payload.xml;
      const liveCompany = await getOpenTallyCompany();
      const targetCompany = liveCompany || payload.companyName || 'SRI LAKSHMI PLYWOODS 2627';

      if (!tallyXml) {
        throw new Error('Missing XML payload in queue job');
      }

      // Ensure XML targets the active company in Tally Prime
      if (liveCompany) {
        const escapedLive = liveCompany.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        tallyXml = tallyXml.replace(/<SVCURRENTCOMPANY>[\s\S]*?<\/SVCURRENTCOMPANY>/i, `<SVCURRENTCOMPANY>${escapedLive}</SVCURRENTCOMPANY>`);
      }

      console.log(`[Tally Worker] Transmitting XML to Tally Prime at http://${TALLY_HOST}:${TALLY_PORT} (Company: "${targetCompany}")...`);
      const tallyResponse = await queryTally(tallyXml, 15000);

      // Check response
      const createdMatch = tallyResponse.match(/<CREATED[^>]*>([0-9]+)<\/CREATED>/i);
      const alteredMatch = tallyResponse.match(/<ALTERED[^>]*>([0-9]+)<\/ALTERED>/i);
      const errorsMatch = tallyResponse.match(/<ERRORS[^>]*>([0-9]+)<\/ERRORS>/i);

      const createdCount = createdMatch ? parseInt(createdMatch[1], 10) : 0;
      const alteredCount = alteredMatch ? parseInt(alteredMatch[1], 10) : 0;
      const errorCount = errorsMatch ? parseInt(errorsMatch[1], 10) : 0;
      const isSuccess = (createdCount > 0 || alteredCount > 0) && errorCount === 0;

      if (isSuccess) {
        console.log(`[Tally Worker] SUCCESS! Voucher #${vchNo} created/altered in Tally Prime (${targetCompany})`);

        // Record in permanent posted registry in system_settings
        try {
          const postedSetting = await prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' } });
          let postedMap = {};
          if (postedSetting?.value) {
            try { postedMap = JSON.parse(postedSetting.value); } catch (_) {}
          }
          postedMap[vchNo] = {
            postedAt: new Date().toISOString(),
            tallyVchNo: vchNo,
            company: targetCompany,
            viaSyncAgent: true
          };
          await prisma.systemSetting.upsert({
            where: { key: 'BUSY_TALLY_POSTED_VOUCHERS' },
            update: { value: JSON.stringify(postedMap) },
            create: { key: 'BUSY_TALLY_POSTED_VOUCHERS', value: JSON.stringify(postedMap) }
          });
        } catch (_) {}

        // Save party mapping if requested
        if (payload.saveMapping && payload.busyPartyName && payload.partyLedgerName) {
          try {
            const busyKey = payload.busyPartyName.trim();
            const tallyVal = payload.partyLedgerName.trim();
            const existing = await prisma.systemSetting.findUnique({ where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' } });
            let map = {};
            if (existing?.value) {
              try { map = JSON.parse(existing.value); } catch (_) {}
            }
            map[busyKey] = tallyVal;
            await prisma.systemSetting.upsert({
              where: { key: 'BUSY_TALLY_PARTY_MAPPINGS' },
              update: { value: JSON.stringify(map) },
              create: { key: 'BUSY_TALLY_PARTY_MAPPINGS', value: JSON.stringify(map) }
            });
          } catch (_) {}
        }

        // Update Job Status to SUCCESS
        await prisma.$queryRawUnsafe(
          `UPDATE tally_voucher_queue 
           SET status = 'SUCCESS', tally_vch_no = $2, created_company = $3, updated_at = now()
           WHERE id = $1::uuid`,
          jobId,
          vchNo,
          targetCompany
        );
      } else {
        // Extract line error message from Tally response
        const lineErrors = Array.from(tallyResponse.matchAll(/<LINEERROR[^>]*>([\s\S]*?)<\/LINEERROR>/gi)).map(m => m[1].trim());
        const errorDesc = lineErrors.length > 0 ? lineErrors.join(' | ') : 'Tally Prime rejected the voucher creation.';
        console.error(`[Tally Worker] FAILED! Tally Error: ${errorDesc}`);

        await prisma.$queryRawUnsafe(
          `UPDATE tally_voucher_queue 
           SET status = 'FAILED', error_message = $2, updated_at = now()
           WHERE id = $1::uuid`,
          jobId,
          errorDesc
        );
      }
    } catch (err) {
      console.error(`[Tally Worker] Connection/Execution Error: ${err.message}`);
      await prisma.$queryRawUnsafe(
        `UPDATE tally_voucher_queue 
         SET status = 'FAILED', error_message = $2, updated_at = now()
         WHERE id = $1::uuid`,
        jobId,
        err.message || 'Worker connection error'
      );
    }
  }

  return jobs.length;
}

async function sendHeartbeat() {
  try {
    const cmpXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CurCmpCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="CurCmpCol"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const cmpRes = await queryTally(cmpXml, 4000);
    const cmpMatch = cmpRes.match(/<COMPANY[^>]*NAME="([^"]+)"/i) || cmpRes.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);
    const company = cmpMatch ? cmpMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : (process.env.TALLY_EXPECTED_COMPANY || 'SRI LAKSHMI PLYWOODS 2627');

    const vtXml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VTCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="VTCol"><TYPE>VoucherType</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    const vtRes = await queryTally(vtXml, 4000);
    const salesVoucherTypes = [];
    const purchaseVoucherTypes = [];
    const voucherTypes = [];
    const vtMatches = vtRes.matchAll(/<VOUCHERTYPE\s+NAME="([^"]+)"[^>]*>[\s\S]*?<PARENT[^>]*>([^<]+)<\/PARENT>/gi);
    for (const m of vtMatches) {
      const name = m[1].trim();
      const parent = m[2].trim().toLowerCase();
      voucherTypes.push(name);
      if (parent === 'sales') salesVoucherTypes.push(name);
      if (parent === 'purchase') purchaseVoucherTypes.push(name);
    }

    const statusObj = {
      tallyOnline: true,
      company,
      port: TALLY_PORT,
      salesVoucherTypes: salesVoucherTypes.length > 0 ? salesVoucherTypes : ['Sales', 'Sales - Manual Series'],
      purchaseVoucherTypes: purchaseVoucherTypes.length > 0 ? purchaseVoucherTypes : ['Purchase', 'Purchase Trade', 'Purchase Exps GST', 'Purchase General'],
      voucherTypes: voucherTypes.length > 0 ? voucherTypes : ['Sales', 'Purchase'],
      lastHeartbeat: new Date().toISOString()
    };

    await prisma.systemSetting.upsert({
      where: { key: 'tally_sync_agent_status' },
      update: { value: JSON.stringify(statusObj) },
      create: { key: 'tally_sync_agent_status', value: JSON.stringify(statusObj) }
    });
  } catch (err) {
    try {
      const offlineObj = {
        tallyOnline: false,
        port: TALLY_PORT,
        error: err.message,
        lastHeartbeat: new Date().toISOString()
      };
      await prisma.systemSetting.upsert({
        where: { key: 'tally_sync_agent_status' },
        update: { value: JSON.stringify(offlineObj) },
        create: { key: 'tally_sync_agent_status', value: JSON.stringify(offlineObj) }
      });
    } catch (_) {}
  }
}

async function main() {
  const isWatchMode = process.argv.includes('--watch') || process.argv.includes('-w');

  console.log('===============================================================');
  console.log('  TALLY VOUCHER QUEUE WORKER (OMS CLOUD <---> TALLY PRIME)');
  console.log(`  Target Tally: http://${TALLY_HOST}:${TALLY_PORT}`);
  console.log(`  Mode: ${isWatchMode ? 'Continuous Polling Daemon' : 'One-Shot Check'}`);
  console.log('===============================================================');

  // Perform initial heartbeat to broadcast Tally connection status to OMS Cloud
  await sendHeartbeat();

  if (!isWatchMode) {
    const count = await processPendingJobs();
    console.log(`[Tally Worker] Processed ${count} pending jobs.`);
    process.exit(0);
  }

  // Periodic heartbeat every 20 seconds
  setInterval(sendHeartbeat, 20000);

  console.log('[Tally Worker] Watching for pending vouchers from OMS Cloud (every 2s)...');
  const poll = async () => {
    try {
      await processPendingJobs();
    } catch (err) {
      console.error('[Tally Worker] Polling error:', err.message);
    }
    setTimeout(poll, 2000);
  };
  poll();
}

main().catch(err => {
  console.error('[Tally Worker] Fatal error:', err);
  process.exit(1);
});
