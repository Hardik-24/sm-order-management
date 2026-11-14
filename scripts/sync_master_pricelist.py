#!/usr/bin/env python3
"""
SM Master Pricelist Synchronizer
Reads all brand sheets from SM_MASTER_PRICELIST_2026.xlsx and synchronizes MASTER_ALL.
Keeps MASTER_ALL read-only / protected while preserving all styles and formatting.
Handles Excel open/lock gracefully with an interactive retry prompt.
"""

import os
import sys
import shutil
import datetime
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
    ("Rate / MRP (₹)", 18, Alignment(horizontal='right', vertical='center')),
    ("UoM", 10, Alignment(horizontal='center', vertical='center')),
    ("MOQ", 10, Alignment(horizontal='right', vertical='center')),
    ("TD %", 10, Alignment(horizontal='right', vertical='center')),
    ("CD %", 10, Alignment(horizontal='right', vertical='center')),
    ("GST %", 10, Alignment(horizontal='right', vertical='center')),
    ("Revision", 14, Alignment(horizontal='center', vertical='center')),
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

def wait_for_excel_close(filepath):
    """
    Checks if the file is locked by Excel.
    Prompts the user to save and close Excel if locked.
    """
    while True:
        try:
            with open(filepath, 'a+'):
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

    brand_sheets = [s for s in wb.sheetnames if s not in ['MASTER_ALL', '_GOOGLE_SHEETS_GUIDE_']]
    print(f"Scanning {len(brand_sheets)} brand sheets:")

    all_items = []
    brand_counts = {}

    for b_name in brand_sheets:
        ws = wb[b_name]
        ws.protection.sheet = False
        ws.protection.disable()

        count = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            sku = str(row[0]).strip()
            if not sku:
                continue

            item = {
                'sku': sku,
                'description': row[1] if len(row) > 1 and row[1] is not None else '',
                'brand': row[2] if len(row) > 2 and row[2] is not None else b_name,
                'category': row[3] if len(row) > 3 and row[3] is not None else '',
                'mrp': row[4] if len(row) > 4 and row[4] is not None else 0.0,
                'uom': row[5] if len(row) > 5 and row[5] is not None else 'NOS',
                'moq': row[6] if len(row) > 6 and row[6] is not None else 1,
                'td': row[7] if len(row) > 7 and row[7] is not None else 0.0,
                'cd': row[8] if len(row) > 8 and row[8] is not None else 0.0,
                'gst': row[9] if len(row) > 9 and row[9] is not None else 0.18,
                'revision': row[10] if len(row) > 10 and row[10] is not None else '2026-R1',
                'status': row[11] if len(row) > 11 and row[11] is not None else 'ACTIVE',
                'source': row[12] if len(row) > 12 and row[12] is not None else f'Sheet: {b_name}'
            }
            all_items.append(item)
            count += 1
        brand_counts[b_name] = count
        print(f"  - {b_name:<16}: {count:>5} products")

    print(f"\nTotal products scanned across all brand sheets: {len(all_items)}")

    # Sort items by Brand, then Status (ACTIVE first), then SKU
    all_items.sort(key=lambda x: (
        str(x['brand']).upper(),
        0 if 'ACTIVE' in str(x['status']).upper() else 1,
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
    for r_idx, item in enumerate(all_items, 2):
        row_vals = [
            item['sku'],
            item['description'],
            item['brand'],
            item['category'],
            item['mrp'],
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
            cell = ws_all.cell(row=r_idx, column=c_idx, value=val)
            cell.font = Font(name='Segoe UI', size=10, bold=(c_idx in [1, 5]))
            cell.alignment = COLUMNS[c_idx - 1][2]
            cell.border = thin_border

            if is_even:
                cell.fill = zebra_fill

            if c_idx == 5:
                cell.number_format = '₹#,##0.00'
            elif c_idx == 7:
                cell.number_format = '#,##0'
            elif c_idx in [8, 9, 10]:
                cell.number_format = '0.0%'

            if c_idx == 12:
                if 'ACTIVE' in str(val).upper():
                    cell.fill = ACTIVE_FILL
                    cell.font = ACTIVE_FONT
                else:
                    cell.fill = LEGACY_FILL
                    cell.font = LEGACY_FONT

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

    # Check lock again before saving
    wait_for_excel_close(filepath)
    wb.save(filepath)
    print(f"\n[OK] MASTER_ALL synchronized and protected successfully ({len(all_items)} products).")
    return True

if __name__ == '__main__':
    print("=" * 70)
    print("  SM MASTER PRICELIST - SYNCHRONIZER")
    print("=" * 70)
    sync_workbook(PRIMARY_PATH)
    print("\nAll done! MASTER_ALL is fully updated and protected.")
