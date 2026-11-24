import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { LedgerReportData, LedgerTransaction } from './ledger'
import { INTER_REGULAR_B64, INTER_BOLD_B64 } from './fonts/inter'

function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return ''
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

interface LedgerPdfPage {
  pageNumber: number
  totalPages: number
  isFirstPage: boolean
  isLastPage: boolean
  rows: LedgerTransaction[]
  broughtForwardDebit: number
  broughtForwardCredit: number
  carriedOverDebit: number
  carriedOverCredit: number
}

function paginateLedger(
  doc: jsPDF,
  transactions: LedgerTransaction[],
  style: 'classic' | 'sm'
): LedgerPdfPage[] {
  const txs = transactions || []
  if (txs.length === 0) {
    return [{
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      isLastPage: true,
      rows: [],
      broughtForwardDebit: 0,
      broughtForwardCredit: 0,
      carriedOverDebit: 0,
      carriedOverCredit: 0
    }]
  }

  const isSm = style === 'sm'
  const fontName = isSm ? 'Inter' : 'times'
  const particularsWidth = isSm ? 225 : 230
  const baseRowH = isSm ? 15 : 13.5
  const paddingH = isSm ? 5.6 : 5.0

  doc.setFont(fontName, 'normal')
  doc.setFontSize(8)

  const txHeights = txs.map(tx => {
    const lines = doc.splitTextToSize(tx.particulars || '', particularsWidth).length
    return Math.max(baseRowH, lines * 9.6 + paddingH)
  })

  // Foot heights & reserves
  const headH = isSm ? 20 : 18
  const broughtForwardH = isSm ? 16 : 14
  const intermediateBottomReserve = isSm ? 28 : 26 // Carried Over row + continued note
  const lastPageBottomReserve = isSm ? 66 : 56 // Totals + Closing + Balanced Total + note

  // Available vertical heights on A4 (841.89 pt)
  // AutoTable bottom margin is 35 pt (cutoff at 806.89 pt)
  // Page 1: SM startY ~140 pt => 800 - 140 = 660 pt. We set 650 pt limit.
  // Page 1: Classic startY ~145 pt => 800 - 145 = 655 pt. We set 645 pt limit.
  const page1MaxAvailable = isSm ? 650 : 645

  // Subpages: startY ~44 pt => 800 - 44 = 756 pt. We set 745 pt limit.
  const subPageMaxAvailable = isSm ? 748 : 740

  // Check if ALL transactions fit on Page 1 as a single page
  const totalTxHeight = txHeights.reduce((sum, h) => sum + h, 0)
  if (headH + totalTxHeight + lastPageBottomReserve <= page1MaxAvailable) {
    return [{
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      isLastPage: true,
      rows: txs,
      broughtForwardDebit: 0,
      broughtForwardCredit: 0,
      carriedOverDebit: 0,
      carriedOverCredit: 0
    }]
  }

  const pages: LedgerPdfPage[] = []
  let currentIndex = 0
  let pageNum = 1
  let runningDebit = 0
  let runningCredit = 0

  while (currentIndex < txs.length) {
    const isFirst = pageNum === 1
    const maxAvailable = isFirst ? page1MaxAvailable : subPageMaxAvailable

    // Reserve for header & top Brought Forward row (on page > 1)
    let currentHeight = headH + (!isFirst ? broughtForwardH : 0)

    const chunk: LedgerTransaction[] = []
    const bfDebit = runningDebit
    const bfCredit = runningCredit

    while (currentIndex < txs.length) {
      const nextRowH = txHeights[currentIndex]
      const isCandidateLast = (currentIndex === txs.length - 1)
      const reserveAtBottom = isCandidateLast ? lastPageBottomReserve : intermediateBottomReserve

      // Check if adding this row would exceed available height
      if (chunk.length > 0 && (currentHeight + nextRowH + reserveAtBottom > maxAvailable)) {
        break
      }

      const row = txs[currentIndex]
      chunk.push(row)
      currentHeight += nextRowH
      if (row.debit) runningDebit += row.debit
      if (row.credit) runningCredit += row.credit
      currentIndex++
    }

    const isLast = currentIndex >= txs.length

    pages.push({
      pageNumber: pageNum,
      totalPages: 0,
      isFirstPage: isFirst,
      isLastPage: isLast,
      rows: chunk,
      broughtForwardDebit: bfDebit,
      broughtForwardCredit: bfCredit,
      carriedOverDebit: runningDebit,
      carriedOverCredit: runningCredit
    })

    pageNum++
  }

  pages.forEach(p => { p.totalPages = pages.length })
  return pages
}

export function generateLedgerVectorPdf(
  ledgerData: LedgerReportData,
  style: 'sm' | 'classic' = 'sm'
): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  })

  // Register modern Inter vector font
  doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR_B64)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD_B64)
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')

  const pageWidth = doc.internal.pageSize.getWidth() // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight() // 841.89 pt
  const margin = 28 // 28 pt (~9.8 mm) margins for generous modern layout
  const contentWidth = pageWidth - (margin * 2) // 539.28 pt

  const pages = paginateLedger(doc, ledgerData.transactions, style)

  if (style === 'classic') {
    // ═══════════════════════════════════════════════════════════════
    // CLASSIC TALLY PRIME LOOK (Traditional serif, double rules)
    // ═══════════════════════════════════════════════════════════════
    pages.forEach((page, pageIdx) => {
      if (pageIdx > 0) {
        doc.addPage('a4', 'portrait')
      }

      let startY = 24

      if (page.isFirstPage) {
        // Top Right: Page indicator
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(40, 40, 40)
        doc.text(`Page 1 of ${page.totalPages}`, pageWidth - margin, startY, { align: 'right' })
        startY += 12

        // Centered Company Header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(0, 0, 0)
        doc.text(ledgerData.company.name.toUpperCase(), pageWidth / 2, startY, { align: 'center' })
        startY += 12

        doc.setFont('times', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(60, 60, 60)
        doc.text(ledgerData.company.tradeName, pageWidth / 2, startY, { align: 'center' })
        startY += 10

        doc.setFont('times', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(70, 70, 70)
        const compAddressLines = ledgerData.company.address.split('\n')
        compAddressLines.forEach(line => {
          doc.text(line.trim().toUpperCase(), pageWidth / 2, startY, { align: 'center' })
          startY += 9
        })
        startY += 4

        // Centered Party Details
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11.5)
        doc.setTextColor(0, 0, 0)
        doc.text(ledgerData.party.name.toUpperCase(), pageWidth / 2, startY, { align: 'center' })
        startY += 12

        doc.setFont('times', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(60, 60, 60)
        doc.text('Ledger Account', pageWidth / 2, startY, { align: 'center' })
        startY += 10

        if (ledgerData.party.addressLines && ledgerData.party.addressLines.length > 0) {
          doc.setFontSize(7.5)
          doc.setTextColor(70, 70, 70)
          ledgerData.party.addressLines.forEach(line => {
            doc.text(line.trim().toUpperCase(), pageWidth / 2, startY, { align: 'center' })
            startY += 9
          })
        }
        if (ledgerData.party.phone) {
          doc.setFontSize(7.5)
          doc.setTextColor(70, 70, 70)
          doc.text(ledgerData.party.phone, pageWidth / 2, startY, { align: 'center' })
          startY += 9
        }
        startY += 4

        // Period Centered Directly Above Table
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(0, 0, 0)
        doc.text(ledgerData.period.display, pageWidth / 2, startY, { align: 'center' })
        startY += 12
      } else {
        // Subsequent Pages (Page 2+) Short Header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(0, 0, 0)
        doc.text(ledgerData.company.name.toUpperCase(), margin, 24)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`Page ${page.pageNumber} of ${page.totalPages}`, pageWidth - margin, 24, { align: 'right' })

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.text(ledgerData.party.name.toUpperCase(), margin, 34)

        doc.setFont('times', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(70, 70, 70)
        doc.text(`Ledger Account : ${ledgerData.period.display}`, pageWidth - margin, 34, { align: 'right' })

        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.5)
        doc.line(margin, 38, pageWidth - margin, 38)
        startY = 44
      }

      // Build Table Body Rows for this page
      const tableBody: any[] = []

      // 1. Brought Forward row (if page > 1)
      if (!page.isFirstPage) {
        tableBody.push([
          '',
          'Brought Forward',
          '',
          '',
          page.broughtForwardDebit > 0 ? formatIndianNumber(page.broughtForwardDebit) : '',
          page.broughtForwardCredit > 0 ? formatIndianNumber(page.broughtForwardCredit) : ''
        ])
      }

      // 2. Transaction rows for this chunk
      for (const tx of page.rows) {
        tableBody.push([
          tx.date,
          tx.particulars,
          tx.vchType || '',
          tx.vchNo || '',
          tx.debit !== null ? formatIndianNumber(tx.debit) : '',
          tx.credit !== null ? formatIndianNumber(tx.credit) : ''
        ])
      }

      // Build Table Foot Rows for this page
      const tableFoot: any[] = []

      if (!page.isLastPage) {
        // Intermediate page: Carried Over
        tableFoot.push([
          '',
          'Carried Over',
          '',
          '',
          formatIndianNumber(page.carriedOverDebit),
          formatIndianNumber(page.carriedOverCredit)
        ])
      } else {
        // Last page: Totals, Closing Balance, Balanced Total
        tableFoot.push([
          '',
          '',
          '',
          '',
          formatIndianNumber(ledgerData.totals.totalDebit),
          formatIndianNumber(ledgerData.totals.totalCredit)
        ])

        if (ledgerData.totals.closingBalance > 0) {
          const isDr = ledgerData.totals.closingBalanceType === 'Dr'
          tableFoot.push([
            '',
            isDr ? 'By Closing Balance' : 'To Closing Balance',
            '',
            '',
            isDr ? '' : formatIndianNumber(ledgerData.totals.closingBalance),
            isDr ? formatIndianNumber(ledgerData.totals.closingBalance) : ''
          ])
        }

        tableFoot.push([
          '',
          '',
          '',
          '',
          formatIndianNumber(ledgerData.totals.balancedTotal),
          formatIndianNumber(ledgerData.totals.balancedTotal)
        ])
      }

      autoTable(doc, {
        startY,
        head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit', 'Credit']],
        body: tableBody,
        foot: tableFoot,
        showFoot: 'lastPage',
        margin: { left: margin, right: margin, top: 40, bottom: 35 },
        theme: 'plain',
        styles: {
          font: 'times',
          fontSize: 8,
          textColor: [0, 0, 0],
          cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 },
          lineColor: [0, 0, 0],
          lineWidth: 0
        },
        headStyles: {
          fontStyle: 'bold',
          fontSize: 8.5,
          lineWidth: { top: 0.75, bottom: 0.75 },
          lineColor: [0, 0, 0]
        },
        footStyles: {
          fontStyle: 'bold',
          fontSize: 8,
          lineWidth: { top: 0.75, bottom: 0.75 },
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 58, halign: 'left' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 58, halign: 'left' },
          3: { cellWidth: 52, halign: 'center' },
          4: { cellWidth: 72, halign: 'right' },
          5: { cellWidth: 72, halign: 'right' }
        },
        didParseCell: (data) => {
          const rowRaw = data.row.raw as any[]
          if (rowRaw && (rowRaw[1] === 'Brought Forward' || rowRaw[1] === 'Carried Over')) {
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })

      // Intermediate page: "continued ..." indicator
      if (!page.isLastPage) {
        const finalY = (doc as any).lastAutoTable?.finalY || startY
        doc.setFont('times', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(60, 60, 60)
        doc.text('continued ...', pageWidth - margin, finalY + 11, { align: 'right' })
      }
    })

  } else {
    // ═══════════════════════════════════════════════════════════════
    // SM LOOK (MODERN EXECUTIVE BRANDED WITH INTER VECTOR FONT)
    // ═══════════════════════════════════════════════════════════════
    pages.forEach((page, pageIdx) => {
      if (pageIdx > 0) {
        doc.addPage('a4', 'portrait')
      }

      let startY = 22

      if (page.isFirstPage) {
        // Top Brand Gradient Bar
        doc.setFillColor(27, 59, 95) // #1b3b5f
        doc.rect(margin, startY, contentWidth * 0.7, 3, 'F')
        doc.setFillColor(217, 37, 70) // #d92546 accent
        doc.rect(margin + contentWidth * 0.7, startY, contentWidth * 0.3, 3, 'F')
        startY += 13

        // Row 1: Company Header (Left) & Document Meta Badge (Right)
        doc.setFont('Inter', 'bold')
        doc.setFontSize(12.5)
        doc.setTextColor(27, 59, 95)
        doc.text(ledgerData.company.name.toUpperCase(), margin, startY)

        // Document Meta Badge (Right)
        const metaBoxW = 140
        doc.setFillColor(27, 59, 95)
        doc.roundedRect(pageWidth - margin - metaBoxW, startY - 9, metaBoxW, 16, 2, 2, 'F')
        doc.setFont('Inter', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(255, 255, 255)
        doc.text('STATEMENT OF ACCOUNT', pageWidth - margin - (metaBoxW / 2), startY + 2.5, { align: 'center' })

        startY += 13
        doc.setFont('Inter', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139) // slate-500
        doc.text(ledgerData.company.tradeName, margin, startY)

        // Period (Right aligned)
        doc.setFont('Inter', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(71, 85, 105)
        const periodPrefix = 'Period: '
        const periodVal = ledgerData.period.display
        const pValW = doc.getTextWidth(periodVal)
        const pPrefW = doc.getTextWidth(periodPrefix)
        doc.text(periodPrefix, pageWidth - margin - pValW - pPrefW, startY)
        doc.setFont('Inter', 'bold')
        doc.setTextColor(27, 59, 95)
        doc.text(periodVal, pageWidth - margin, startY, { align: 'right' })

        startY += 10
        // Company Address (2 lines wrapped, no cut off)
        doc.setFont('Inter', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(100, 116, 139)
        const compCleanAddr = ledgerData.company.address.replace(/\n/g, ', ')
        const compAddrLines = doc.splitTextToSize(compCleanAddr, 340)
        compAddrLines.slice(0, 2).forEach((line: string) => {
          doc.text(line, margin, startY)
          startY += 9
        })

        // Page indicator (Right aligned)
        doc.setFont('Inter', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(148, 163, 184)
        doc.text(`Page 1 of ${page.totalPages}`, pageWidth - margin, startY - 9, { align: 'right' })

        startY += 3
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(margin, startY, pageWidth - margin, startY)
        startY += 8

        // Row 2: Customer Box (Left: Name & Phone, Right: Address)
        const custBoxY = startY
        const partyNameUpper = ledgerData.party.name.toUpperCase()
        const partyLines = doc.splitTextToSize(partyNameUpper, 280)
        const hasPhone = !!ledgerData.party.phone
        const addrLines = (ledgerData.party.addressLines && ledgerData.party.addressLines.length > 0)
          ? ledgerData.party.addressLines
          : []

        const custBoxH = Math.max(48, Math.max(partyLines.length * 12 + 28, addrLines.length * 9.5 + 24))
        doc.setFillColor(248, 250, 252) // slate-50
        doc.setDrawColor(226, 232, 240) // slate-200
        doc.roundedRect(margin, custBoxY, contentWidth, custBoxH, 4, 4, 'FD')

        // Left: Account of
        doc.setFont('Inter', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text('ACCOUNT OF', margin + 10, custBoxY + 11)

        doc.setFont('Inter', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(27, 59, 95)
        let pY = custBoxY + 23
        partyLines.forEach((line: string) => {
          doc.text(line, margin + 10, pY)
          pY += 12
        })

        if (hasPhone) {
          doc.setFont('Inter', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(100, 116, 139)
          const contactLabel = 'Contact: '
          const cY = pY + 2
          doc.text(contactLabel, margin + 10, cY)
          doc.setFont('Inter', 'bold')
          doc.setTextColor(30, 41, 59)
          doc.text(ledgerData.party.phone, margin + 10 + doc.getTextWidth(contactLabel), cY)
        }

        // Right: Address
        doc.setFont('Inter', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text('ADDRESS', pageWidth - margin - 10, custBoxY + 11, { align: 'right' })

        doc.setFont('Inter', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(71, 85, 105)
        if (addrLines.length > 0) {
          let aY = custBoxY + 22
          addrLines.forEach((line: string) => {
            const trimmed = line.trim().toUpperCase()
            doc.text(trimmed, pageWidth - margin - 10, aY, { align: 'right' })
            aY += 9.5
          })
        } else {
          doc.text('—', pageWidth - margin - 10, custBoxY + 22, { align: 'right' })
        }

        startY = custBoxY + custBoxH + 8
      } else {
        // Subsequent Pages (Page 2+) Clean Strip Header
        doc.setFillColor(27, 59, 95)
        doc.rect(margin, 18, contentWidth * 0.7, 2, 'F')
        doc.setFillColor(217, 37, 70)
        doc.rect(margin + contentWidth * 0.7, 18, contentWidth * 0.3, 2, 'F')

        doc.setFont('Inter', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(27, 59, 95)
        const compUpper = ledgerData.company.name.toUpperCase()
        doc.text(compUpper, margin, 30)
        let currX = margin + doc.getTextWidth(compUpper)

        doc.setFont('Inter', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text('  •  ', currX, 30)
        currX += doc.getTextWidth('  •  ')

        doc.setFont('Inter', 'bold')
        doc.setTextColor(30, 41, 59)
        const partyUpper = ledgerData.party.name.toUpperCase()
        const maxPartyWidth = (pageWidth - margin - 160) - currX
        const partyDisplay = doc.getTextWidth(partyUpper) > maxPartyWidth
          ? partyUpper.slice(0, 30) + '...'
          : partyUpper
        doc.text(partyDisplay, currX, 30)
        currX += doc.getTextWidth(partyDisplay)

        doc.setFont('Inter', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text('  •  Statement of Account', currX, 30)

        doc.setFont('Inter', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(148, 163, 184)
        doc.text(`Page ${page.pageNumber} of ${page.totalPages}`, pageWidth - margin, 30, { align: 'right' })

        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(margin, 34, pageWidth - margin, 34)
        startY = 42
      }

      // Build Table Body Rows for this page
      const tableBody: any[] = []

      // 1. Brought Forward row (if page > 1)
      if (!page.isFirstPage) {
        tableBody.push([
          '',
          'Brought Forward',
          '-',
          '-',
          page.broughtForwardDebit > 0 ? formatIndianNumber(page.broughtForwardDebit) : '',
          page.broughtForwardCredit > 0 ? formatIndianNumber(page.broughtForwardCredit) : ''
        ])
      }

      // 2. Transaction rows for this chunk
      for (const tx of page.rows) {
        tableBody.push([
          tx.date,
          tx.particulars,
          tx.vchType || '-',
          tx.vchNo || '-',
          tx.debit !== null ? formatIndianNumber(tx.debit) : '',
          tx.credit !== null ? formatIndianNumber(tx.credit) : ''
        ])
      }

      // Build Table Foot Rows for this page
      const tableFoot: any[] = []

      if (!page.isLastPage) {
        // Intermediate page: Carried Over
        tableFoot.push([
          '',
          'Carried Over',
          '-',
          '-',
          formatIndianNumber(page.carriedOverDebit),
          formatIndianNumber(page.carriedOverCredit)
        ])
      } else {
        // Last page: Totals, Closing Balance, Balanced Total
        tableFoot.push([
          '',
          'Totals',
          '',
          '',
          formatIndianNumber(ledgerData.totals.totalDebit),
          formatIndianNumber(ledgerData.totals.totalCredit)
        ])

        if (ledgerData.totals.closingBalance > 0) {
          const isDr = ledgerData.totals.closingBalanceType === 'Dr'
          tableFoot.push([
            ledgerData.period.to,
            isDr ? 'By Closing Balance (Dr)' : 'To Closing Balance (Cr)',
            '',
            '',
            isDr ? '' : formatIndianNumber(ledgerData.totals.closingBalance),
            isDr ? formatIndianNumber(ledgerData.totals.closingBalance) : ''
          ])
        }

        tableFoot.push([
          '',
          '',
          '',
          '',
          formatIndianNumber(ledgerData.totals.balancedTotal),
          formatIndianNumber(ledgerData.totals.balancedTotal)
        ])
      }

      autoTable(doc, {
        startY,
        head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit (Rs.)', 'Credit (Rs.)']],
        body: tableBody,
        foot: tableFoot,
        showFoot: 'lastPage',
        margin: { left: margin, right: margin, top: 40, bottom: 35 },
        theme: 'grid',
        styles: {
          font: 'Inter',
          fontSize: 7.8,
          textColor: [15, 23, 42], // slate-900
          cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 3.5 },
          lineColor: [226, 232, 240],
          lineWidth: 0.4
        },
        headStyles: {
          fillColor: [27, 59, 95], // Navy #1b3b5f
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.8,
          cellPadding: { top: 4.0, bottom: 4.0, left: 3.5, right: 3.5 }
        },
        footStyles: {
          fillColor: [241, 245, 249], // slate-100
          textColor: [27, 59, 95],
          fontStyle: 'bold',
          fontSize: 7.8,
          cellPadding: { top: 3.5, bottom: 3.5, left: 3.5, right: 3.5 }
        },
        alternateRowStyles: {
          fillColor: [250, 252, 255]
        },
        columnStyles: {
          0: { cellWidth: 58, halign: 'left' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 54, halign: 'center' },
          3: { cellWidth: 52, halign: 'center' },
          4: { cellWidth: 74, halign: 'right' },
          5: { cellWidth: 74, halign: 'right' }
        },
        didParseCell: (data) => {
          const rowRaw = data.row.raw as any[]
          if (rowRaw && (rowRaw[1] === 'Brought Forward' || rowRaw[1] === 'Carried Over')) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [241, 245, 249] // slate-100
            if (data.column.index === 4) {
              data.cell.styles.textColor = [27, 59, 95] // Navy
            } else if (data.column.index === 5) {
              data.cell.styles.textColor = [4, 120, 87] // Emerald
            }
          }
          if (data.section === 'foot' && rowRaw && typeof rowRaw[1] === 'string' && rowRaw[1].includes('Closing Balance')) {
            data.cell.styles.fillColor = [254, 243, 199] // amber-100 highlight
            data.cell.styles.textColor = [146, 64, 14] // amber-800
          }
        }
      })

      const finalY = (doc as any).lastAutoTable?.finalY || startY

      // Intermediate page: "continued ..." note
      if (!page.isLastPage) {
        doc.setFont('Inter', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text('continued ...', pageWidth - margin, finalY + 10, { align: 'right' })
      }

      // Running Footer on every page
      const footerY = pageHeight - 16
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.4)
      doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6)

      doc.setFont('Inter', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(
        'Computer generated statement • Sri Lakshmi Plywoods (Silicon Marketing)',
        margin,
        footerY
      )
      doc.text(
        `Page ${page.pageNumber} of ${page.totalPages}`,
        pageWidth - margin,
        footerY,
        { align: 'right' }
      )

      // Balance Confirmation Note on Last Page
      if (page.isLastPage && finalY <= pageHeight - 45) {
        doc.setFont('Inter', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text(
          'Note: Please verify this statement. If no discrepancy is reported within 7 days, this balance will be deemed confirmed.',
          margin,
          finalY + 12
        )
      }
    })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
