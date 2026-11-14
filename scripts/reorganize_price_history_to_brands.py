#!/usr/bin/env python3
"""
Reorganize SM_MASTER_PRICELIST_2026:
- Merges all historical rows from PRICE_HISTORY directly into their respective Brand Sheets.
- Merges with current brand sheet rows to ensure 100% of products (4,865 unique SKUs) are present.
- In each Brand Sheet:
    - Products are grouped by Article Number / SKU.
    - The newest Revision Date per SKU is marked ACTIVE (soft green fill, bold dark green text).
    - Older Revision Dates per SKU are marked LEGACY (soft gray fill, muted gray text).
    - Sorted by SKU (ascending) with ACTIVE row on top, followed by historical revisions.
- Rebuilds MASTER_ALL containing ONLY the ACTIVE products (1 row per product).
- Removes the standalone PRICE_HISTORY sheet.
- Protects MASTER_ALL (read-only against accidental edits).
- Leaves Brand Sheets unprotected (editable).
"""

import os
import sys
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

SRC_WORKBOOK = r"C:\Users\hdpat\.gemini\antigravity\brain\3524798d-b98f-4577-b47b-92b49b7e7dda\scratch\current_snapshot.xlsx"
OUT_WORKBOOK = r"C:\Users\hdpat\.gemini\antigravity\brain\3524798d-b98f-4577-b47b-92b49b7e7dda\scratch\SM_MASTER_PRICELIST_2026_ORGANIZED.xlsx"

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
    ("Revision Date", 16, Alignment(horizontal='center', vertical='center')),
    ("Status", 14, Alignment(horizontal='center', vertical='center')),
    ("Source", 22, Alignment(horizontal='left', vertical='center'))
]

BRAND_SHEET_MAP = {
    'ACTION TESA': 'ACTION_TESA',
    'BLUM': 'BLUM',
    'CENTURY': 'CENTURY',
    'GREENPANEL': 'GREENPANEL',
    'GREENPLY': 'GREENPLY',
    'HAFELE': 'HAFELE',
    'MERINO': 'MERINO',
    'REHAU': 'REHAU',
    'RELWOOD': 'RELWOOD',
    'VRINDA': 'VRINDA',
    'WIGWAM': 'WIGWAM'
}

# Styling
header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
header_fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Navy
brand_header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid') # Slate
zebra_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')

ACTIVE_FILL = PatternFill(start_color='D1E7DD', end_color='D1E7DD', fill_type='solid')
ACTIVE_FONT = Font(name='Segoe UI', size=10, bold=True, color='0F5132')

LEGACY_FILL = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')
LEGACY_FONT = Font(name='Segoe UI', size=10, italic=True, color='64748B')

thin_border = Border(
    left=Side(style='thin', color='E2E8F0'),
    right=Side(style='thin', color='E2E8F0'),
    top=Side(style='thin', color='E2E8F0'),
    bottom=Side(style='thin', color='E2E8F0')
)

def build_organized_workbook():
    print(f"Loading source snapshot from {SRC_WORKBOOK}...")
    wb_src = openpyxl.load_workbook(SRC_WORKBOOK, read_only=True)
    
    # 1. Combine entries from PRICE_HISTORY + existing brand sheets
    # Key: (sheet_name, sku, revision_date) -> dict
    combined_entries = {}

    def extract_item(row, fallback_brand, fallback_source):
        sku = str(row[0]).strip()
        brand = row[2] if len(row) > 2 and row[2] else fallback_brand
        rev = str(row[14]).strip() if len(row) > 14 and row[14] else '2026-10-01'
        return {
            'sku': sku,
            'description': row[1] if len(row) > 1 and row[1] is not None else '',
            'brand': brand,
            'category': row[3] if len(row) > 3 and row[3] is not None else '',
            'thickness': row[4] if len(row) > 4 and row[4] is not None else '-',
            'dimensions': row[5] if len(row) > 5 and row[5] is not None else '-',
            'sqft': row[6] if len(row) > 6 and row[6] is not None else 1.0,
            'rate_sqft': row[7] if len(row) > 7 and row[7] is not None else None,
            'rate_unit': row[8] if len(row) > 8 and row[8] is not None else 0.0,
            'uom': row[9] if len(row) > 9 and row[9] is not None else 'NOS',
            'moq': row[10] if len(row) > 10 and row[10] is not None else 1,
            'td': row[11] if len(row) > 11 and row[11] is not None else 0.0,
            'cd': row[12] if len(row) > 12 and row[12] is not None else 0.0,
            'gst': row[13] if len(row) > 13 and row[13] is not None else 0.18,
            'revision': rev,
            'status': str(row[15]).strip() if len(row) > 15 and row[15] is not None else 'ACTIVE',
            'source': row[16] if len(row) > 16 and row[16] is not None else fallback_source
        }

    # First from PRICE_HISTORY
    if 'PRICE_HISTORY' in wb_src.sheetnames:
        ws_hist = wb_src['PRICE_HISTORY']
        for r in ws_hist.iter_rows(min_row=2, values_only=True):
            if not r or not r[0]: continue
            b_raw = str(r[2]).strip().upper() if len(r) > 2 and r[2] else 'HAFELE'
            sheet_name = BRAND_SHEET_MAP.get(b_raw, b_raw)
            item = extract_item(r, b_raw, 'PRICE_HISTORY')
            key = (sheet_name, item['sku'], item['revision'])
            combined_entries[key] = item

    # Second from brand sheets (to capture any active products not in historical tabs)
    brand_sheet_names = [s for s in wb_src.sheetnames if s not in ['MASTER_ALL', 'PRICE_HISTORY', '_GOOGLE_SHEETS_GUIDE_']]
    for b_sheet in brand_sheet_names:
        ws = wb_src[b_sheet]
        for r in ws.iter_rows(min_row=2, values_only=True):
            if not r or not r[0]: continue
            item = extract_item(r, b_sheet, f'Sheet:{b_sheet}')
            key = (b_sheet, item['sku'], item['revision'])
            if key not in combined_entries:
                combined_entries[key] = item

    print(f"Total unique (brand, sku, date) records assembled: {len(combined_entries)}")

    # Group by Brand Sheet
    by_brand = {}
    for (b_sheet, sku, rev), item in combined_entries.items():
        by_brand.setdefault(b_sheet, []).append(item)

    # Create new clean workbook
    wb_out = openpyxl.Workbook()
    wb_out.remove(wb_out.active) # Remove default sheet

    sheet_order = [
        'GREENPANEL', 'ACTION_TESA', 'RELWOOD', 'MERINO', 'CENTURY',
        'REHAU', 'BLUM', 'GREENPLY', 'VRINDA', 'WIGWAM', 'HAFELE'
    ]

    master_active_items = []

    for b_sheet in sheet_order:
        items = by_brand.get(b_sheet, [])
        print(f"\nProcessing {b_sheet} ({len(items)} records)...")

        # Group by SKU
        sku_groups = {}
        for it in items:
            sku_groups.setdefault(it['sku'], []).append(it)

        brand_final_rows = []
        for sku, group in sku_groups.items():
            # Sort revisions by revision date descending (newest first)
            group.sort(key=lambda x: str(x['revision']), reverse=True)
            
            # Newest date becomes ACTIVE
            group[0]['status'] = 'ACTIVE'
            master_active_items.append(group[0])

            # Older dates become LEGACY
            for leg in group[1:]:
                leg['status'] = 'LEGACY'

            brand_final_rows.extend(group)

        # Sort the entire brand sheet:
        # Primary: SKU ascending
        # Secondary: ACTIVE (0) before LEGACY (1)
        # Tertiary: Revision date descending
        brand_final_rows.sort(key=lambda x: (
            str(x['sku']).upper(),
            0 if x['status'] == 'ACTIVE' else 1,
            str(x['revision'])
        ))

        # Create sheet
        ws = wb_out.create_sheet(title=b_sheet)
        ws.views.sheetView[0].showGridLines = True
        ws.row_dimensions[1].height = 28
        ws.freeze_panes = 'A2'

        # Headers
        for c_idx, (col_name, col_width, _) in enumerate(COLUMNS, 1):
            cell = ws.cell(row=1, column=c_idx, value=col_name)
            cell.font = header_font
            cell.fill = brand_header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            ws.column_dimensions[get_column_letter(c_idx)].width = col_width

        # Write rows
        for r_idx, item in enumerate(brand_final_rows, 2):
            row_vals = [
                item['sku'],
                item['description'],
                item['brand'],
                item['category'],
                item['thickness'],
                item['dimensions'],
                item['sqft'],
                item['rate_sqft'],
                item['rate_unit'],
                item['uom'],
                item['moq'],
                item['td'],
                item['cd'],
                item['gst'],
                item['revision'],
                item['status'],
                item['source']
            ]
            is_active = (item['status'] == 'ACTIVE')
            for c_idx, val in enumerate(row_vals, 1):
                cell = ws.cell(row=r_idx, column=c_idx, value=val)
                cell.font = Font(name='Segoe UI', size=10, bold=(c_idx in [1, 9] and is_active))
                cell.alignment = COLUMNS[c_idx - 1][2]
                cell.border = thin_border

                if is_active:
                    if r_idx % 2 == 0:
                        cell.fill = zebra_fill
                else:
                    cell.fill = LEGACY_FILL
                    cell.font = LEGACY_FONT

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
                    if is_active:
                        cell.fill = ACTIVE_FILL
                        cell.font = ACTIVE_FONT
                    else:
                        cell.fill = LEGACY_FILL
                        cell.font = LEGACY_FONT

            ws.row_dimensions[r_idx].height = 20

        # Brand sheets are explicitly UNPROTECTED (editable)
        ws.protection.sheet = False
        ws.protection.disable()
        print(f"  [OK] Sheet '{b_sheet}' populated: {len(brand_final_rows)} rows ({len(sku_groups)} unique SKUs).")

    # Now create MASTER_ALL as first sheet
    print(f"\nBuilding MASTER_ALL with {len(master_active_items)} ACTIVE products...")
    master_active_items.sort(key=lambda x: (str(x['brand']).upper(), str(x['sku']).upper()))

    ws_master = wb_out.create_sheet(title='MASTER_ALL', index=0)
    ws_master.views.sheetView[0].showGridLines = True
    ws_master.row_dimensions[1].height = 28
    ws_master.freeze_panes = 'A2'

    for c_idx, (col_name, col_width, _) in enumerate(COLUMNS, 1):
        cell = ws_master.cell(row=1, column=c_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws_master.column_dimensions[get_column_letter(c_idx)].width = col_width

    for r_idx, item in enumerate(master_active_items, 2):
        row_vals = [
            item['sku'],
            item['description'],
            item['brand'],
            item['category'],
            item['thickness'],
            item['dimensions'],
            item['sqft'],
            item['rate_sqft'],
            item['rate_unit'],
            item['uom'],
            item['moq'],
            item['td'],
            item['cd'],
            item['gst'],
            item['revision'],
            item['status'],
            item['source']
        ]
        is_even = (r_idx % 2 == 0)
        for c_idx, val in enumerate(row_vals, 1):
            cell = ws_master.cell(row=r_idx, column=c_idx, value=val)
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
                cell.fill = ACTIVE_FILL
                cell.font = ACTIVE_FONT

        ws_master.row_dimensions[r_idx].height = 21

    # Lock & Protect MASTER_ALL (read-only against accidental edits)
    ws_master.protection.sheet = True
    ws_master.protection.enable()
    ws_master.protection.selectLockedCells = True
    ws_master.protection.selectUnlockedCells = True
    ws_master.protection.formatCells = True
    ws_master.protection.formatColumns = True
    ws_master.protection.formatRows = True
    ws_master.protection.insertColumns = False
    ws_master.protection.insertRows = False
    ws_master.protection.deleteColumns = False
    ws_master.protection.deleteRows = False

    print(f"\nSaving organized workbook to {OUT_WORKBOOK}...")
    wb_out.save(OUT_WORKBOOK)
    print(f"\n[OK] Successfully generated organized workbook with {len(wb_out.sheetnames)} sheets (PRICE_HISTORY removed):")
    for s in wb_out.sheetnames:
        print(f"  - {s:<16}: {wb_out[s].max_row - 1} rows")

if __name__ == '__main__':
    build_organized_workbook()
