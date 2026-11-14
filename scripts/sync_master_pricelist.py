#!/usr/bin/env python3
"""
Sync Script for SM_MASTER_PRICELIST_2026.xlsx:
- Supports the Append-Only Brand Ledger architecture:
    1. Scans each of the 11 Brand Sheets.
    2. Groups rows by Article Number / SKU.
    3. Finds the latest Revision Date for each SKU and marks it ACTIVE (soft green fill, bold dark green text).
    4. Marks any older revision rows for that SKU as LEGACY (soft gray fill, muted gray text).
    5. Re-sorts each Brand Sheet so the ACTIVE rate is always on top for each SKU, followed by historical rates.
    6. Rebuilds MASTER_ALL containing ONLY the single ACTIVE price for every product.
    7. Protects MASTER_ALL (read-only against accidental edits).
    8. Leaves Brand Sheets unprotected (editable so users can paste new price lists anytime).
- Handles Windows Excel open locks gracefully with interactive prompt.
- High performance sheet replacement (recreates sheets in 0.5s rather than slow cell delete).
"""

import os
import sys
import time
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

PRIMARY_PATH = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026.xlsx"

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

def wait_for_excel_close(filepath):
    while True:
        try:
            with open(filepath, 'a'):
                pass
            return True
        except PermissionError:
            print("\n" + "=" * 70)
            print("  [!] NOTICE: 'SM_MASTER_PRICELIST_2026.xlsx' IS CURRENTLY OPEN IN EXCEL")
            print("=" * 70)
            print("  Windows prevents updating the file while it is open in Excel.\n")
            print("  1. In Excel, press Ctrl+S to save any changes you just made.")
            print("  2. Close the Excel window.")
            print("  3. Press ENTER here to proceed with the synchronization.\n")
            try:
                input("Press ENTER once Excel is closed (or Ctrl+C to cancel)... ")
            except KeyboardInterrupt:
                print("\nSync cancelled by user.")
                sys.exit(0)

def sync_workbook(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found at {filepath}")
        return False

    wait_for_excel_close(filepath)

    print(f"\nOpening workbook: {filepath}")
    wb = openpyxl.load_workbook(filepath)

    EXCLUDED_SHEETS = {'MASTER_ALL', 'PRICE_HISTORY', '_GOOGLE_SHEETS_GUIDE_'}
    brand_sheet_names = [s for s in wb.sheetnames if s not in EXCLUDED_SHEETS]
    print(f"Scanning {len(brand_sheet_names)} brand sheets...")

    master_active_items = []
    brand_stats = {}

    for b_name in brand_sheet_names:
        ws_old = wb[b_name]
        sheet_idx = wb.sheetnames.index(b_name)

        raw_items = []
        for row in ws_old.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            sku = str(row[0]).strip()
            if not sku:
                continue

            rev = str(row[14]).strip() if len(row) > 14 and row[14] is not None else '2026-10-01'
            item = {
                'sku': sku,
                'description': row[1] if len(row) > 1 and row[1] is not None else '',
                'brand': row[2] if len(row) > 2 and row[2] is not None else b_name,
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
                'source': row[16] if len(row) > 16 and row[16] is not None else f'Sheet:{b_name}'
            }
            raw_items.append(item)

        # Group by SKU
        sku_groups = {}
        for it in raw_items:
            sku_groups.setdefault(it['sku'], []).append(it)

        # For each SKU, determine newest date -> ACTIVE, older -> LEGACY
        brand_final_rows = []
        for sku, group in sku_groups.items():
            group.sort(key=lambda x: str(x['revision']), reverse=True)
            group[0]['status'] = 'ACTIVE'
            master_active_items.append(group[0])

            for leg in group[1:]:
                leg['status'] = 'LEGACY'

            brand_final_rows.extend(group)

        # Sort brand sheet: SKU ascending, ACTIVE before LEGACY, date descending
        brand_final_rows.sort(key=lambda x: (
            str(x['sku']).upper(),
            0 if x['status'] == 'ACTIVE' else 1,
            str(x['revision'])
        ))

        # Fast recreate sheet at exact same index
        wb.remove(ws_old)
        ws = wb.create_sheet(title=b_name, index=sheet_idx)
        ws.views.sheetView[0].showGridLines = True
        ws.row_dimensions[1].height = 28
        ws.freeze_panes = 'A2'

        # Write Headers
        for c_idx, (col_name, col_width, _) in enumerate(COLUMNS, 1):
            cell = ws.cell(row=1, column=c_idx, value=col_name)
            cell.font = header_font
            cell.fill = brand_header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            ws.column_dimensions[get_column_letter(c_idx)].width = col_width

        # Write Rows
        for r_idx, item in enumerate(brand_final_rows, 2):
            row_vals = [
                item['sku'], item['description'], item['brand'], item['category'],
                item['thickness'], item['dimensions'], item['sqft'], item['rate_sqft'],
                item['rate_unit'], item['uom'], item['moq'], item['td'],
                item['cd'], item['gst'], item['revision'], item['status'], item['source']
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

                if c_idx == 7:
                    cell.number_format = '#,##0.0'
                elif c_idx == 8 and val is not None:
                    cell.number_format = '₹#,##0.00'
                elif c_idx == 9:
                    cell.number_format = '₹#,##0.00'
                elif c_idx == 11:
                    cell.number_format = '#,##0'
                elif c_idx in [12, 13, 14]:
                    cell.number_format = '0.0%'
                elif c_idx == 15:
                    cell.number_format = 'YYYY-MM-DD'

                if c_idx == 16:
                    if is_active:
                        cell.fill = ACTIVE_FILL
                        cell.font = ACTIVE_FONT
                    else:
                        cell.fill = LEGACY_FILL
                        cell.font = LEGACY_FONT

            ws.row_dimensions[r_idx].height = 20

        # Unprotected so users can edit freely
        ws.protection.sheet = False
        ws.protection.disable()

        brand_stats[b_name] = (len(sku_groups), len(brand_final_rows))
        print(f"  - {b_name:<16}: {len(sku_groups):>5} unique active SKUs ({len(brand_final_rows):>6} total ledger rows)")

    print(f"\nTotal ACTIVE products selected for MASTER_ALL: {len(master_active_items)}")

    # Sort MASTER_ALL by Brand, then SKU
    master_active_items.sort(key=lambda x: (
        str(x['brand']).upper(),
        str(x['sku']).upper()
    ))

    # Recreate MASTER_ALL sheet
    if 'MASTER_ALL' in wb.sheetnames:
        del wb['MASTER_ALL']

    ws_all = wb.create_sheet(title='MASTER_ALL', index=0)
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
    for r_idx, item in enumerate(master_active_items, 2):
        row_vals = [
            item['sku'], item['description'], item['brand'], item['category'],
            item['thickness'], item['dimensions'], item['sqft'], item['rate_sqft'],
            item['rate_unit'], item['uom'], item['moq'], item['td'],
            item['cd'], item['gst'], item['revision'], item['status'], item['source']
        ]
        is_even = (r_idx % 2 == 0)
        for c_idx, val in enumerate(row_vals, 1):
            cell = ws_all.cell(row=r_idx, column=c_idx, value=val)
            cell.font = Font(name='Segoe UI', size=10, bold=(c_idx in [1, 9]))
            cell.alignment = COLUMNS[c_idx - 1][2]
            cell.border = thin_border

            if is_even:
                cell.fill = zebra_fill

            if c_idx == 7:
                cell.number_format = '#,##0.0'
            elif c_idx == 8 and val is not None:
                cell.number_format = '₹#,##0.00'
            elif c_idx == 9:
                cell.number_format = '₹#,##0.00'
            elif c_idx == 11:
                cell.number_format = '#,##0'
            elif c_idx in [12, 13, 14]:
                cell.number_format = '0.0%'
            elif c_idx == 15:
                cell.number_format = 'YYYY-MM-DD'

            if c_idx == 16:
                cell.fill = ACTIVE_FILL
                cell.font = ACTIVE_FONT

        ws_all.row_dimensions[r_idx].height = 21

    # Lock & Protect MASTER_ALL (read-only against accidental edits)
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

    # Remove PRICE_HISTORY if still present
    if 'PRICE_HISTORY' in wb.sheetnames:
        del wb['PRICE_HISTORY']

    # Check lock again before saving
    wait_for_excel_close(filepath)
    wb.save(filepath)
    print(f"\n[OK] MASTER_ALL synchronized and protected successfully ({len(master_active_items)} active products).")
    return True

if __name__ == '__main__':
    print("=" * 70)
    print("  SM MASTER PRICELIST - SYNCHRONIZER (APPEND-ONLY BRAND ARCHITECTURE)")
    print("=" * 70)
    sync_workbook(PRIMARY_PATH)
    print("\nAll done! MASTER_ALL is fully updated and protected.")
