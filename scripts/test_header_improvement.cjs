const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const { createCanvas } = require('@napi-rs/canvas');

const { createJiti } = require('jiti');
const jiti = createJiti(__filename, { alias: { '~~': path.resolve(__dirname, '..'), '~': path.resolve(__dirname, '..') } });
const { INTER_REGULAR_B64, INTER_BOLD_B64 } = jiti('../server/utils/fonts/inter.ts');

async function testHeader() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR_B64);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD_B64);
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const margin = 28;
  const contentWidth = pageWidth - (margin * 2); // 539.28 pt
  const leftMaxW = contentWidth * 0.65; // ~350 pt max width for company side

  let startY = 18;

  // 1. Top Brand Gradient Bar
  doc.setFillColor(27, 59, 95); // #1b3b5f
  doc.rect(margin, startY, contentWidth * 0.72, 3.5, 'F');
  doc.setFillColor(217, 37, 70); // #d92546 accent
  doc.rect(margin + contentWidth * 0.72, startY, contentWidth * 0.28, 3.5, 'F');
  startY += 21; // Generous 8.5 pt clearance below the 3.5 pt bar (21.5 pt to 30 pt)

  // 2. Company Info (Left 65%) & Document Meta Block (Right 35%)
  // Left: Company Name
  doc.setFont('Inter', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(27, 59, 95); // Deep Navy
  doc.text('SRI LAKSHMI PLYWOODS', margin, startY);

  // Right: Document Badge
  const metaBoxW = 140;
  const metaBoxH = 17;
  const metaBoxY = startY - 9; // Top of badge at y = 30 pt (8.5 pt below top bar)
  doc.setFillColor(27, 59, 95);
  doc.roundedRect(pageWidth - margin - metaBoxW, metaBoxY, metaBoxW, metaBoxH, 2.5, 2.5, 'F');
  doc.setFont('Inter', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('STATEMENT OF ACCOUNT', pageWidth - margin - (metaBoxW / 2), metaBoxY + 11.5, { align: 'center' });

  startY += 13;
  // Left: Trade Name
  doc.setFont('Inter', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(217, 37, 70); // Crimson accent
  doc.text('Trade Name : Silicon Marketing', margin, startY);

  // Right: Period Row
  const periodY = metaBoxY + metaBoxH + 11;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const pVal = '01-Apr-2026 to 30-Nov-2026';
  const pValW = doc.getTextWidth(pVal);
  doc.text('Period: ', pageWidth - margin - pValW - 4, periodY, { align: 'right' });
  doc.setFont('Inter', 'bold');
  doc.setTextColor(27, 59, 95);
  doc.text(pVal, pageWidth - margin, periodY, { align: 'right' });

  startY += 10;
  // Left: Only Address (wrapped to 2 lines within leftMaxW ~340pt)
  doc.setFont('Inter', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const rawCompAddr = '34F/F2, AKKAMAHDEVI ROAD, 2ND STAGE INDUSTRIAL SUBURB, VISVESHWARAYA NAGAR, MYSORE SOUTH, MYSORE';
  const addrLines = doc.splitTextToSize(rawCompAddr, leftMaxW);
  addrLines.forEach(line => {
    doc.text(line, margin, startY);
    startY += 9;
  });

  // Right: Page Indicator
  const pageMetaY = periodY + 10;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text('Page 1 of 6', pageWidth - margin, pageMetaY, { align: 'right' });

  startY += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, startY, pageWidth - margin, startY);
  startY += 9;

  // 3. Customer Box: Two-Column Split Card
  const custBoxY = startY;
  const halfW = (contentWidth - 14) / 2;

  // Filter out any phone numbers from party address lines
  const rawPartyAddress = [
    '#36 MYSORE-HUNSUR ROAD BELAVADI POST',
    'HOOTAGALLI',
    'MYSORE-570018',
    '0821 2404343'
  ];
  const cleanPartyAddrLines = rawPartyAddress.filter(line => !/^[\d\s+-]{6,}$/.test(line.trim()));

  const partyNameUpper = 'MAS FURNITURE,MYS';
  const partyLines = doc.splitTextToSize(partyNameUpper, halfW - 20);
  const partyPhone = '+91 9845302944';
  const partyGstin = '29AADFM2471Q1ZP';

  const leftContentH = 14 + (partyLines.length * 12) + (partyPhone ? 11 : 0) + (partyGstin ? 10 : 0) + 8;
  const rightContentH = 14 + (cleanPartyAddrLines.length * 9.5) + 8;
  const custBoxH = Math.max(50, Math.max(leftContentH, rightContentH));

  // Card Background
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, custBoxY, contentWidth, custBoxH, 4, 4, 'FD');

  // Vertical Divider in Middle
  const dividerX = margin + halfW + 7;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(dividerX, custBoxY + 7, dividerX, custBoxY + custBoxH - 7);

  // --- LEFT COLUMN: Customer Info ---
  const leftX = margin + 12;
  let cY = custBoxY + 12;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('PARTY DETAILS', leftX, cY);

  cY += 12;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(27, 59, 95); // Deep Navy
  partyLines.forEach(line => {
    doc.text(line, leftX, cY);
    cY += 12;
  });

  if (partyPhone) {
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Contact No: ', leftX, cY);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(partyPhone, leftX + doc.getTextWidth('Contact No: '), cY);
    cY += 10;
  }

  if (partyGstin) {
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('GSTIN: ', leftX, cY);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(27, 59, 95);
    doc.text(partyGstin, leftX + doc.getTextWidth('GSTIN: '), cY);
  }

  // --- RIGHT COLUMN: Party Address ---
  const rightX = dividerX + 12;
  let rY = custBoxY + 12;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('PARTY ADDRESS', rightX, rY);

  rY += 12;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  cleanPartyAddrLines.forEach(line => {
    doc.text(line, rightX, rY);
    rY += 9.5;
  });

  // Render to image
  const buf = Buffer.from(doc.output('arraybuffer'));
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  const outPath = 'scripts/test_user_requested_header.png';
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Saved test header to:', outPath);
}

testHeader();
