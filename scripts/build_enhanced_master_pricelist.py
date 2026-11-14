#!/usr/bin/env python3
"""
Build Enhanced Master Pricelist (SM_MASTER_PRICELIST_2026.xlsx):
- Incorporates Thickness, Dimensions, Sqft, Rate/Sqft, Rate/Unit (Sheet/Piece).
- Standardizes Revision to comparable ISO Date (YYYY-MM-DD).
- Keeps uniform SM- SKUs.
- Re-syncs and protects MASTER_ALL (read-only).
- All 11 brand sheets remain completely editable.
"""

import os
import sys
import re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

SOURCE_PATH = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026_PRE_ENHANCE_20261114_142730.xlsx"
OUTPUT_PATH = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026.xlsx"

COLUMNS = [
    ("Article Number / SKU", 26, Alignment(horizontal='left', vertical='center')),
    ("Product Description", 46, Alignment(horizontal='left', vertical='center')),
    ("Brand", 16, Alignment(horizontal='center', vertical='center')),
    ("Category", 18, Alignment(horizontal='center', vertical='center')),
    ("Thickness", 12, Alignment(horizontal='center', vertical='center')),
    ("Dimensions", 14, Alignment(horizontal='center', vertical='center')),
    ("Sqft", 10, Alignment(horizontal='right', vertical='center')),
    ("Rate / Sqft (₹)", 16, Alignment(horizontal='right', vertical='center')),
    ("Rate / Unit (₹)", 18, Alignment(horizontal='right', vertical='center')),
    ("UoM", 10, Alignment(horizontal='center', vertical='center')),
    ("MOQ", 10, Alignment(horizontal='right', vertical='center')),
    ("TD %", 10, Alignment(horizontal='right', vertical='center')),
    ("CD %", 10, Alignment(horizontal='right', vertical='center')),
    ("GST %", 10, Alignment(horizontal='right', vertical='center')),
    ("Revision Date", 14, Alignment(horizontal='center', vertical='center')),
    ("Status", 14, Alignment(horizontal='center', vertical='center')),
    ("Source", 20, Alignment(horizontal='left', vertical='center'))
]

header_fill = PatternFill(start_color='1B365D', end_color='1B365D', fill_type='solid')
header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')

ACTIVE_FILL = PatternFill(start_color='E8F5E9', end_color='E8F5E9', fill_type='solid')
ACTIVE_FONT = Font(name='Segoe UI', size=10, color='1B5E20', bold=True)
LEGACY_FILL = PatternFill(start_color='FFF3E0', end_color='FFF3E0', fill_type='solid')
LEGACY_FONT = Font(name='Segoe UI', size=10, color='E65100', bold=True)

thin_border = Border(
    left=Side(style='thin', color='E0E0E0'),
    right=Side(style='thin', color='E0E0E0'),
    top=Side(style='thin', color='E0E0E0'),
    bottom=Side(style='thin', color='E0E0E0')
)
zebra_fill = PatternFill(start_color='F9FAFB', end_color='F9FAFB', fill_type='solid')

def parse_item_parameters(b_name, sku, desc, cat, mrp, uom, raw_rev):
    is_sheet_good = b_name in ['GREENPANEL', 'ACTION_TESA', 'RELWOOD', 'MERINO', 'CENTURY', 'GREENPLY', 'VRINDA', 'WIGWAM'] or (b_name == 'REHAU' and 'LAMINATE' in str(cat).upper())

    # Thickness
    thk = "-"
    if is_sheet_good:
        m_thk = re.search(r'(\d+(?:\.\d+)?)\s*(?:MM|mm)', desc) or re.search(r'(\d+(?:\.\d+)?)\s*(?:MM|mm)', sku)
        if m_thk:
            thk = f"{m_thk.group(1)}MM"
        elif re.search(r'0\.50\s*D', desc, re.I):
            thk = "0.50D"

    # Dimensions & Sqft
    dim = "-"
    sqft = 1.0
    if is_sheet_good:
        m_dim = re.search(r'(\d+)\s*[xX]\s*(\d+)', desc) or re.search(r'(\d+)\s*[xX]\s*(\d+)', sku)
        if m_dim:
            dim = f"{m_dim.group(1)}X{m_dim.group(2)}"
            sqft = float(m_dim.group(1)) * float(m_dim.group(2))
        else:
            dim = "8X4"
            sqft = 32.0

    # Rate / Sqft and Rate / Unit
    if is_sheet_good:
        rate_sqft = float(mrp)
        rate_unit = round(float(mrp) * sqft, 2)
        final_uom = "SHT"
    else:
        rate_sqft = None # stored as blank / None
        rate_unit = float(mrp)
        final_uom = uom if uom != 'SQFT' else 'PCS'

    # Revision Date (Standardize to YYYY-MM-DD)
    rev_str = str(raw_rev or '').upper()
    if 'OCT' in rev_str or '2026-OCT' in rev_str:
        rev_date = '2026-10-01'
    elif 'JUL' in rev_str or '2026JULY' in rev_str:
        rev_date = '2026-07-01'
    elif 'APR' in rev_str or '2026APRIL' in rev_str:
        rev_date = '2026-04-01'
    elif 'FEB' in rev_str or '2026FEB' in rev_str:
        rev_date = '2026-02-01'
    elif 'NOV' in rev_str or '2025NOV' in rev_str:
        rev_date = '2025-11-01'
    else:
        rev_date = '2026-10-01'

    return {
        'thickness': thk,
        'dimensions': dim,
        'sqft': sqft,
        'rate_sqft': rate_sqft,
        'rate_unit': rate_unit,
        'uom': final_uom,
        'rev_date': rev_date
    }

def build_workbook():
    print(f"Reading source workbook: {SOURCE_PATH}")
    wb_src = openpyxl.load_workbook(SOURCE_PATH, data_only=True)
    
    brand_sheet_names = [s for s in wb_src.sheetnames if s not in ['MASTER_ALL', '_GOOGLE_SHEETS_GUIDE_']]
    print(f"Found {len(brand_sheet_names)} brand sheets: {brand_sheet_names}")

    wb_out = openpyxl.Workbook()
    # remove default sheet
    wb_out.remove(wb_out.active)

    all_master_items = []

    # 1. Process each brand sheet
    for b_name in brand_sheet_names:
        ws_src = wb_src[b_name]
        ws_dst = wb_out.create_sheet(title=b_name)
        ws_dst.views.sheetView[0].showGridLines = True

        # Headers
        for c_idx, (col_name, col_width, _) in enumerate(COLUMNS, 1):
            cell = ws_dst.cell(row=1, column=c_idx, value=col_name)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            ws_dst.column_dimensions[get_column_letter(c_idx)].width = col_width

        ws_dst.row_dimensions[1].height = 28
        ws_dst.freeze_panes = 'A2'

        # Process rows
        r_out = 2
        for row in ws_src.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            sku = str(row[0]).strip()
            if not sku:
                continue

            desc = row[1] if len(row) > 1 and row[1] is not None else ''
            brand = row[2] if len(row) > 2 and row[2] is not None else b_name
            cat = row[3] if len(row) > 3 and row[3] is not None else ''
            mrp = row[4] if len(row) > 4 and row[4] is not None else 0.0
            uom = row[5] if len(row) > 5 and row[5] is not None else 'NOS'
            moq = row[6] if len(row) > 6 and row[6] is not None else 1
            td = row[7] if len(row) > 7 and row[7] is not None else 0.0
            cd = row[8] if len(row) > 8 and row[8] is not None else 0.0
            gst = row[9] if len(row) > 9 and row[9] is not None else 0.18
            raw_rev = row[10] if len(row) > 10 and row[10] is not None else '2026-10-01'
            status = row[11] if len(row) > 11 and row[11] is not None else 'ACTIVE'
            source = row[12] if len(row) > 12 and row[12] is not None else f'Sheet: {b_name}'

            parsed = parse_item_parameters(b_name, sku, desc, cat, mrp, uom, raw_rev)

            row_data = [
                sku,
                desc,
                brand,
                cat,
                parsed['thickness'],
                parsed['dimensions'],
                parsed['sqft'],
                parsed['rate_sqft'],
                parsed['rate_unit'],
                parsed['uom'],
                moq,
                td,
                cd,
                gst,
                parsed['rev_date'],
                status,
                source
            ]

            all_master_items.append(row_data)

            is_even = (r_out % 2 == 0)
            for c_idx, val in enumerate(row_data, 1):
                cell = ws_dst.cell(row=r_out, column=c_idx, value=val)
                cell.font = Font(name='Segoe UI', size=10, bold=(c_idx in [1, 9]))
                cell.alignment = COLUMNS[c_idx - 1][2]
                cell.border = thin_border

                if is_even:
                    cell.fill = zebra_fill

                # Number formats
                if c_idx == 7: # Sqft
                    cell.number_format = '#,##0.0'
                elif c_idx == 8: # Rate / Sqft
                    if val is not None:
                        cell.number_format = '₹#,##0.00'
                elif c_idx == 9: # Rate / Unit
                    cell.number_format = '₹#,##0.00'
                elif c_idx == 11: # MOQ
                    cell.number_format = '#,##0'
                elif c_idx in [12, 13, 14]: # TD, CD, GST %
                    cell.number_format = '0.0%'
                elif c_idx == 15: # Revision Date
                    cell.number_format = 'YYYY-MM-DD'

                if c_idx == 16: # Status
                    if 'ACTIVE' in str(val).upper():
                        cell.fill = ACTIVE_FILL
                        cell.font = ACTIVE_FONT
                    else:
                        cell.fill = LEGACY_FILL
                        cell.font = LEGACY_FONT

            ws_dst.row_dimensions[r_out].height = 21
            r_out += 1

        # Brand sheets are explicitly editable / unprotected
        ws_dst.protection.sheet = False
        ws_dst.protection.disable()
        print(f"  - {b_name:<16}: {r_out - 2:>5} products")

    print(f"\nTotal products scanned: {len(all_master_items)}")

    # 2. Sort all items for MASTER_ALL by Brand, Status (ACTIVE first), then SKU
    all_master_items.sort(key=lambda x: (
        str(x[2]).upper(), # Brand
        0 if 'ACTIVE' in str(x[15]).upper() else 1, # Status
        str(x[0]).upper()  # SKU
    ))

    # 3. Create MASTER_ALL as first sheet
    ws_all = wb_out.create_sheet(title='MASTER_ALL', index=0)
    ws_all.views.sheetView[0].showGridLines = True

    # Headers
    for c_idx, (col_name, col_width, _) in enumerate(COLUMNS, 1):
        cell = ws_all.cell(row=1, column=c_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws_all.column_dimensions[get_column_letter(c_idx)].width = col_width

    ws_all.row_dimensions[1].height = 28
    ws_all.freeze_panes = 'A2'

    # Rows
    for r_idx, row_data in enumerate(all_master_items, 2):
        is_even = (r_idx % 2 == 0)
        for c_idx, val in enumerate(row_data, 1):
            cell = ws_all.cell(row=r_idx, column=c_idx, value=val)
            cell.font = Font(name='Segoe UI', size=10, bold=(c_idx in [1, 9]))
            cell.alignment = COLUMNS[c_idx - 1][2]
            cell.border = thin_border

            if is_even:
                cell.fill = zebra_fill

            if c_idx == 7: # Sqft
                cell.number_format = '#,##0.0'
            elif c_idx == 8: # Rate / Sqft
                if val is not None:
                    cell.number_format = '₹#,##0.00'
            elif c_idx == 9: # Rate / Unit
                cell.number_format = '₹#,##0.00'
            elif c_idx == 11: # MOQ
                cell.number_format = '#,##0'
            elif c_idx in [12, 13, 14]: # TD, CD, GST %
                cell.number_format = '0.0%'
            elif c_idx == 15: # Revision Date
                cell.number_format = 'YYYY-MM-DD'

            if c_idx == 16: # Status
                if 'ACTIVE' in str(val).upper():
                    cell.fill = ACTIVE_FILL
                    cell.font = ACTIVE_FONT
                else:
                    cell.fill = LEGACY_FILL
                    cell.font = LEGACY_FONT

        ws_all.row_dimensions[r_idx].height = 21

    # 4. Sheet Protection on MASTER_ALL
    ws_all.protection.sheet = True
    ws_all.protection.enable()
    ws_all.protection.selectLockedCells = True
    ws_all.protection.selectUnlockedCells = True
    ws_all.protection.formatCells = True
    ws_all.protection.formatColumns = True
    ws_all.protection.formatRows = True
    ws_all.protection.insertColumns = False
    ws_all.protection.insertRows = False
    ws_all.protection.deleteColumns = False
    ws_all.protection.deleteRows = False

    # Save
    wb_out.save(OUTPUT_PATH)
    print(f"\nSuccessfully built and saved enhanced workbook: {OUTPUT_PATH}")
    print(f"Total Sheets: {len(wb_out.sheetnames)}")
    print(f"Total Products in MASTER_ALL: {len(all_master_items)}")

if __name__ == '__main__':
    print("=" * 70)
    print("  BUILDING ENHANCED SM MASTER PRICELIST")
    print("=" * 70)
    build_workbook()
