import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { LedgerReportData } from './ledger'

function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return ''
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
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

  const pageWidth = doc.internal.pageSize.getWidth() // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight() // 841.89 pt
  const margin = 32 // 32 pt (~11.3 mm) margins for clean A4 fit
  const contentWidth = pageWidth - (margin * 2) // 531.28 pt

  if (style === 'classic') {
    // ═══════════════════════════════════════════════════════════════
    // CLASSIC TALLY PRIME LOOK
    // ═══════════════════════════════════════════════════════════════
    let startY = margin

    // Top Right: Page 1 indicator
    doc.setFont('times', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 30, 30)
    doc.text('Page 1', pageWidth - margin, startY, { align: 'right' })
    startY += 12

    // Centered Company Header
    doc.setFont('times', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(0, 0, 0)
    doc.text(ledgerData.company.name, pageWidth / 2, startY, { align: 'center' })
    startY += 12

    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(70, 70, 70)
    doc.text(ledgerData.company.tradeName, pageWidth / 2, startY, { align: 'center' })
    startY += 10

    doc.setFont('times', 'normal')
    doc.setFontSize(7.5)
    const compAddressLines = ledgerData.company.address.split('\n')
    compAddressLines.forEach(line => {
      doc.text(line.trim(), pageWidth / 2, startY, { align: 'center' })
      startY += 9
    })
    startY += 4

    // Centered Party Details
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text(ledgerData.party.name, pageWidth / 2, startY, { align: 'center' })
    startY += 11

    doc.setFont('times', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    doc.text('Ledger Account', pageWidth / 2, startY, { align: 'center' })
    startY += 10

    if (ledgerData.party.addressLines && ledgerData.party.addressLines.length > 0) {
      doc.setFontSize(7.5)
      ledgerData.party.addressLines.forEach(line => {
        doc.text(line.trim(), pageWidth / 2, startY, { align: 'center' })
        startY += 9
      })
    }
    if (ledgerData.party.phone) {
      doc.setFontSize(7.5)
      doc.text(ledgerData.party.phone, pageWidth / 2, startY, { align: 'center' })
      startY += 9
    }
    startY += 4

    // Period Centered Directly Above Table
    doc.setFont('times', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(0, 0, 0)
    doc.text(ledgerData.period.display, pageWidth / 2, startY, { align: 'center' })
    startY += 12

    // Build Table Rows
    const rows = ledgerData.transactions.map(tx => [
      tx.date,
      tx.particulars,
      tx.vchType || '',
      tx.vchNo || '',
      tx.debit !== null ? formatIndianNumber(tx.debit) : '',
      tx.credit !== null ? formatIndianNumber(tx.credit) : ''
    ])

    const footRows: any[] = [
      ['', '', '', '', formatIndianNumber(ledgerData.totals.totalDebit), formatIndianNumber(ledgerData.totals.totalCredit)]
    ]

    if (ledgerData.totals.closingBalance > 0) {
      const isDr = ledgerData.totals.closingBalanceType === 'Dr'
      footRows.push([
        '',
        isDr ? 'By Closing Balance' : 'To Closing Balance',
        '',
        '',
        isDr ? '' : formatIndianNumber(ledgerData.totals.closingBalance),
        isDr ? formatIndianNumber(ledgerData.totals.closingBalance) : ''
      ])
    }

    footRows.push([
      '',
      '',
      '',
      '',
      formatIndianNumber(ledgerData.totals.balancedTotal),
      formatIndianNumber(ledgerData.totals.balancedTotal)
    ])

    autoTable(doc, {
      startY,
      head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit', 'Credit']],
      body: rows,
      foot: footRows,
      margin: { left: margin, right: margin, top: 40, bottom: 60 },
      theme: 'plain',
      styles: {
        font: 'times',
        fontSize: 8,
        textColor: [0, 0, 0],
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
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
        0: { cellWidth: 60, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 60, halign: 'left' },
        3: { cellWidth: 55, halign: 'center' },
        4: { cellWidth: 70, halign: 'right' },
        5: { cellWidth: 70, halign: 'right' }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFont('times', 'bold')
          doc.setFontSize(8.5)
          doc.setTextColor(0, 0, 0)
          doc.text(ledgerData.company.name, margin, 24)
          doc.setFont('times', 'normal')
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, 24, { align: 'right' })

          doc.text(`${ledgerData.party.name}  •  ${ledgerData.period.display}`, margin, 34)
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.5)
          doc.line(margin, 38, pageWidth - margin, 38)
        }
      }
    })

  } else {
    // ═══════════════════════════════════════════════════════════════
    // SM LOOK (MODERN EXECUTIVE BRANDED)
    // ═══════════════════════════════════════════════════════════════
    let startY = margin

    // Top Brand Gradient Bar
    doc.setFillColor(27, 59, 95) // #1b3b5f
    doc.rect(margin, startY, contentWidth * 0.7, 3, 'F')
    doc.setFillColor(217, 37, 70) // #d92546 accent
    doc.rect(margin + contentWidth * 0.7, startY, contentWidth * 0.3, 3, 'F')
    startY += 14

    // Row 1: Company Header (Left) & Document Meta (Right)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(27, 59, 95)
    doc.text(ledgerData.company.name, margin, startY)

    // Document Meta (Right)
    doc.setFillColor(27, 59, 95)
    doc.roundedRect(pageWidth - margin - 130, startY - 10, 130, 16, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.text('STATEMENT OF ACCOUNT', pageWidth - margin - 65, startY + 1, { align: 'center' })

    startY += 13
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(ledgerData.company.tradeName, margin, startY)

    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(`Period: ${ledgerData.period.display}`, pageWidth - margin, startY, { align: 'right' })

    startY += 11
    doc.setFontSize(7.5)
    doc.setTextColor(110, 110, 110)
    const singleLineAddr = ledgerData.company.address.replace(/\n/g, ', ')
    doc.text(singleLineAddr.length > 70 ? singleLineAddr.slice(0, 70) + '...' : singleLineAddr, margin, startY)

    startY += 10
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, startY, pageWidth - margin, startY)
    startY += 8

    // Row 2: Customer Box (Left: Name & Phone, Right: Address)
    const custBoxY = startY
    const custBoxH = 42
    doc.setFillColor(248, 250, 252) // slate-50
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.roundedRect(margin, custBoxY, contentWidth, custBoxH, 4, 4, 'FD')

    // Left: Account of
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 140)
    doc.text('ACCOUNT OF', margin + 10, custBoxY + 13)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(27, 59, 95)
    const partyNameShort = ledgerData.party.name.length > 38 ? ledgerData.party.name.slice(0, 38) + '...' : ledgerData.party.name
    doc.text(partyNameShort, margin + 10, custBoxY + 26)

    if (ledgerData.party.phone) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      doc.text(`Contact: ${ledgerData.party.phone}`, margin + 10, custBoxY + 36)
    }

    // Right: Address
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 140)
    doc.text('ADDRESS', pageWidth - margin - 10, custBoxY + 13, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)
    if (ledgerData.party.addressLines && ledgerData.party.addressLines.length > 0) {
      const line1 = ledgerData.party.addressLines[0] || ''
      const line2 = ledgerData.party.addressLines[1] || ''
      doc.text(line1.slice(0, 45), pageWidth - margin - 10, custBoxY + 25, { align: 'right' })
      if (line2) doc.text(line2.slice(0, 45), pageWidth - margin - 10, custBoxY + 35, { align: 'right' })
    } else {
      doc.text('—', pageWidth - margin - 10, custBoxY + 25, { align: 'right' })
    }

    startY = custBoxY + custBoxH + 10

    // Table Data
    const rows = ledgerData.transactions.map(tx => [
      tx.date,
      tx.particulars,
      tx.vchType || '-',
      tx.vchNo || '-',
      tx.debit !== null ? formatIndianNumber(tx.debit) : '',
      tx.credit !== null ? formatIndianNumber(tx.credit) : ''
    ])

    const footRows: any[] = [
      ['', 'Totals', '', '', formatIndianNumber(ledgerData.totals.totalDebit), formatIndianNumber(ledgerData.totals.totalCredit)]
    ]

    if (ledgerData.totals.closingBalance > 0) {
      const isDr = ledgerData.totals.closingBalanceType === 'Dr'
      footRows.push([
        '',
        isDr ? 'By Closing Balance (Dr)' : 'To Closing Balance (Cr)',
        '',
        '',
        isDr ? '' : formatIndianNumber(ledgerData.totals.closingBalance),
        isDr ? formatIndianNumber(ledgerData.totals.closingBalance) : ''
      ])
    }

    footRows.push([
      '',
      '',
      '',
      '',
      formatIndianNumber(ledgerData.totals.balancedTotal),
      formatIndianNumber(ledgerData.totals.balancedTotal)
    ])

    autoTable(doc, {
      startY,
      head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit (Rs.)', 'Credit (Rs.)']],
      body: rows,
      foot: footRows,
      margin: { left: margin, right: margin, top: 40, bottom: 68 },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: [30, 30, 30],
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        lineColor: [226, 232, 240],
        lineWidth: 0.5
      },
      headStyles: {
        fillColor: [27, 59, 95], // Navy
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 }
      },
      footStyles: {
        fillColor: [241, 245, 249], // slate-100
        textColor: [27, 59, 95],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }
      },
      alternateRowStyles: {
        fillColor: [250, 252, 255]
      },
      columnStyles: {
        0: { cellWidth: 60, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 55, halign: 'center' },
        3: { cellWidth: 55, halign: 'center' },
        4: { cellWidth: 75, halign: 'right' },
        5: { cellWidth: 75, halign: 'right' }
      },
      didDrawPage: (data) => {
        // Page Header for Page 2+
        if (data.pageNumber > 1) {
          doc.setFillColor(27, 59, 95)
          doc.rect(margin, 20, contentWidth, 2, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8.5)
          doc.setTextColor(27, 59, 95)
          doc.text(ledgerData.company.name, margin, 32)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(90, 90, 90)
          doc.text(`• ${ledgerData.party.name} • Statement of Account`, margin + 130, 32)
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, 32, { align: 'right' })
        }

        // Running Footer on every page
        const footerY = pageHeight - 20
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(140, 140, 140)
        doc.text(
          'Computer generated statement • Sri Lakshmi Plywoods (Silicon Marketing)',
          margin,
          footerY
        )
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth - margin,
          footerY,
          { align: 'right' }
        )
      }
    })

    // Balance Confirmation Note on Last Page
    const finalY = (doc as any).lastAutoTable?.finalY || startY
    if (finalY <= pageHeight - 55) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(120, 120, 120)
      doc.text(
        'Note: Please verify this statement. If no discrepancy is reported within 7 days, this balance will be deemed confirmed.',
        margin,
        finalY + 14
      )
    }
  }

  // Update total page numbers across all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    if (style === 'sm') {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(140, 140, 140)
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 20,
        { align: 'right' }
      )
    } else if (style === 'classic') {
      doc.setFont('times', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(50, 50, 50)
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        i === 1 ? margin : 24,
        { align: 'right' }
      )
    }
  }

  return Buffer.from(doc.output('arraybuffer'))
}
