const path = require('path');
const fs = require('fs');
const { createJiti } = require('jiti');
const jiti = createJiti(__filename, {
  alias: {
    '~~': path.resolve(__dirname, '..'),
    '~': path.resolve(__dirname, '..')
  }
});
const { createCanvas } = require('@napi-rs/canvas');

const artifactDir = 'C:/Users/hdpat/.gemini/antigravity/brain/3524798d-b98f-4577-b47b-92b49b7e7dda';

async function main() {
  console.log('Loading modules...');
  const { computePartyLedger } = jiti('../server/utils/ledger.ts');
  const { generateLedgerVectorPdf } = jiti('../server/utils/ledgerPdf.ts');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const partiesToTest = [
    { name: 'MAS Furniture,Mys', label: 'mas' },
    { name: 'Moddy/s Confectionery Private Limited, Ooty TN', label: 'moddys' },
    { name: 'Krishna Plywood & Hardware, Mys', label: 'krishna_multipage' }
  ];

  for (const party of partiesToTest) {
    console.log(`\nFetching ledger for: ${party.name}`);
    const data = await computePartyLedger(party.name, '2026-04-01', '2026-11-30');
    console.log(`Party found: ${data.party.name}, tx count: ${data.transactions.length}`);

    for (const style of ['classic', 'sm']) {
      console.log(`Generating PDF for ${party.label} [${style}]...`);
      const pdfBuffer = generateLedgerVectorPdf(data, style);
      const pdfPath = path.join(artifactDir, `${party.label}_${style}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Render pages to PNG
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
      const pdfDoc = await loadingTask.promise;
      console.log(`Pages count for ${party.label} [${style}]: ${pdfDoc.numPages}`);

      const pagesToRender = Array.from(new Set([1, 2, pdfDoc.numPages].filter(p => p <= pdfDoc.numPages)));
      for (const pageNum of pagesToRender) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x high-res
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        const pngPath = path.join(artifactDir, `${party.label}_${style}_p${pageNum}.png`);
        fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));
        console.log(`Saved: ${pngPath}`);
      }
    }
  }

  console.log('\nAll PDF pages rendered to PNG successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error during render:', err);
  process.exit(1);
});
