/**
 * scripts/apply_pricelist_updates.cjs
 * 
 * Safely executes the generated SQL price updates from scripts/apply_pricelist_updates.sql
 * into Supabase PostgreSQL using Prisma.
 * 
 * Usage:
 *   node scripts/apply_pricelist_updates.cjs           # Dry-run audit (safe)
 *   node scripts/apply_pricelist_updates.cjs --apply   # Commits price updates to Supabase
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const directUrl = process.env.DATABASE_URL || "postgresql://postgres.xfzvkqjkbwwdqtxgasrh:csYX9pwTCZyZC5IZ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
});

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log("==================================================================");
  console.log("   SM MASTER PRICELIST 2026 -> SUPABASE BATCH EXECUTOR");
  console.log("==================================================================");
  console.log(`Execution Mode: ${isApply ? '>>> LIVE APPLY (COMMITTING TO DATABASE) <<<' : 'DRY RUN (Preview Only)'}\n`);

  const sqlPath = path.join(__dirname, 'apply_pricelist_updates.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`Error: SQL file not found at ${sqlPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const lines = sqlContent.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('UPDATE products'));

  console.log(`Found ${lines.length} UPDATE statements in ${path.basename(sqlPath)}`);

  if (!isApply) {
    console.log("\n[DRY RUN PREVIEW] Showing first 5 statements:");
    lines.slice(0, 5).forEach((stmt, idx) => console.log(`  ${idx + 1}. ${stmt}`));
    console.log("\nTo apply these updates to your live Supabase database, run:");
    console.log("  node scripts/apply_pricelist_updates.cjs --apply\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nExecuting ${lines.length} updates in a safe transaction...`);
  const startTime = Date.now();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      for (const stmt of lines) {
        // Execute each statement
        await tx.$executeRawUnsafe(stmt);
        updatedCount++;
        if (updatedCount % 200 === 0) {
          process.stdout.write(`... ${updatedCount} / ${lines.length} executed\n`);
        }
      }
      return updatedCount;
    }, {
      timeout: 60000 // 60s timeout for bulk update
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[SUCCESS] Successfully updated ${result} products in Supabase in ${elapsed}s!`);
  } catch (err) {
    console.error("\n[ERROR] Transaction aborted. No changes were committed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
