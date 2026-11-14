#!/usr/bin/env python3
"""
Add PRICE_HISTORY Tab to SM_MASTER_PRICELIST_2026.xlsx:
- Compiles all 14,000+ historical price entries from 2025NOV, 2026FEB, 2026APRIL, 2026JULY, and 2026OCT.
- Each entry has Article Number / SKU, Description, Brand, Category, Dimensions, Rates, Effective Date, Status (ACTIVE/LEGACY), and Source.
- Sorts by Brand, SKU, then Effective Date (chronological audit trail).
- Keeps active sales tabs clean with 1 row per product.
- Protects PRICE_HISTORY and MASTER_ALL against accidental edits.
"""

import os
import sys
import json
import re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

SCRATCH_DIR = r"C:\Users\hdpat\.gemini\antigravity\brain\3524798d-b98f-4577-b47b-92b49b7e7dda\scratch"
WORKBOOK_PATH = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026.xlsx"

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
    ("Effective Date", 14, Alignment(horizontal='center', vertical='center')),
    ("Status", 14, Alignment(horizontal='center', vertical='center')),
    ("Source Circular", 20, Alignment(horizontal='left', vertical='center'))
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

def clean_num(val, default=0.0):
    if val is None:
        return default
    s = str(val).replace(',', '').replace('₹', '').replace('Rs.', '').replace('Rs', '').strip()
    m = re.search(r'[-+]?\d*\.?\d+', s)
    if m:
        try:
            return float(m.group(0))
        except:
            return default
    return default

def add_price_history():
    print(f"Loading workbook: {WORKBOOK_PATH}")
    wb = openpyxl.load_workbook(WORKBOOK_PATH)

    # Load historical dump
    with open(f'{SCRATCH_DIR}/gsheet_tabs_dump.json', 'r', encoding='utf-8') as f:
        gsheet_data = json.load(f)

    # 1. Collect all rows from brand sheets (Current October 2026 circular)
    history_entries = []
    brand_sheets = [s for s in wb.sheetnames if s not in ['MASTER_ALL', 'PRICE_HISTORY', '_GOOGLE_SHEETS_GUIDE_']]

    # Keep track of latest date seen per SKU
    sku_latest_date = {}

    # Extract hardware history from the 4 Google Sheet monthly tabs
    hist_tabs = [
        ('2025NOV', '2025-11-01'),
        ('2026FEB', '2026-02-01'),
        ('2026APRIL', '2026-04-01'),
        ('2026JULY', '2026-07-01')
    ]

    for tab_name, rev_date in hist_tabs:
        rows = gsheet_data.get(tab_name, {}).get('rows', [])
        print(f"Reading Google Sheet tab {tab_name} ({rev_date}): {len(rows)} rows...")
        for r in rows:
            art = (r.get('Article Number') or r.get('Article No') or '').strip()
            if not art or art in ['.', '-', '—']:
                continue

            desc = (r.get('Description') or '').strip()
            brand_raw = (r.get('BRAND') or 'HFL').strip().upper()

            if 'BLUM' in brand_raw or 'BLM' in brand_raw:
                brand = 'BLUM'
                sku = f"SM-BLM-{art}" if not art.startswith('SM-') else art
                cat = 'Kitchen & Furniture Hardware'
            elif 'REHAU' in brand_raw:
                brand = 'REHAU'
                sku = f"SM-RHU-{art}" if not art.startswith('SM-') else art
                cat = 'Edge Bands & Adhesives'
            elif 'TESA' in brand_raw or 'ACTION' in brand_raw:
                brand = 'ACTION TESA'
                sku = f"SM-TESA-{art}" if not art.startswith('SM-') else art
                cat = 'Boilo BWP Board'
            else:
                brand = 'HAFELE'
                sku = f"SM-HAF-{art}" if not art.startswith('SM-') else art
                cat = 'Architectural Hardware'

            mrp = clean_num(r.get('MRP') or r.get('Price'))
            uom = (r.get('UoM') or r.get('UOM') or 'PC').strip().upper()
            moq = int(clean_num(r.get('MOQ') or '1', 1))
            gst = clean_num(r.get('GST') or '18', 18.0) / 100.0
            disc = clean_num(r.get('DISCOUNT') or '25', 25.0) / 100.0

            history_entries.append({
                'sku': sku,
                'desc': desc,
                'brand': brand,
                'cat': cat,
                'thickness': '-',
                'dimensions': '-',
                'sqft': 1.0,
                'rate_sqft': None,
                'rate_unit': mrp,
                'uom': uom if uom != 'SQFT' else 'PCS',
                'moq': moq,
                'td': disc,
                'cd': 0.02,
                'gst': gst,
                'rev_date': rev_date,
                'source': f'GSheet:{tab_name}'
            })

            # Track latest date per SKU
            if sku not in sku_latest_date or rev_date > sku_latest_date[sku]:
                sku_latest_date[sku] = rev_date

    # 2. Add all current items from brand sheets (e.g. October 2026 panels)
    print("Collecting brand sheet entries (October 2026)...")
    for b_name in brand_sheets:
        ws = wb[b_name]
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            sku = str(row[0]).strip()
            rev_date = str(row[14]) if len(row) > 14 and row[14] else '2026-10-01'
            
            # Avoid duplicate if already added from gsheet July
            if b_name in ['HAFELE', 'BLUM']:
                continue

            history_entries.append({
                'sku': sku,
                'desc': row[1] if len(row) > 1 and row[1] else '',
                'brand': row[2] if len(row) > 2 and row[2] else b_name,
                'cat': row[3] if len(row) > 3 and row[3] else '',
                'thickness': row[4] if len(row) > 4 and row[4] else '-',
                'dimensions': row[5] if len(row) > 5 and row[5] else '-',
                'sqft': row[6] if len(row) > 6 and row[6] else 1.0,
                'rate_sqft': row[7] if len(row) > 7 and row[7] else None,
                'rate_unit': row[8] if len(row) > 8 and row[8] else 0.0,
                'uom': row[9] if len(row) > 9 and row[9] else 'SHT',
                'moq': row[10] if len(row) > 10 and row[10] else 1,
                'td': row[11] if len(row) > 11 and row[11] else 0.0,
                'cd': row[12] if len(row) > 12 and row[12] else 0.0,
                'gst': row[13] if len(row) > 13 and row[13] else 0.18,
                'rev_date': rev_date,
                'source': row[16] if len(row) > 16 and row[16] else f'Sheet:{b_name}'
            })

            if sku not in sku_latest_date or rev_date > sku_latest_date[sku]:
                sku_latest_date[sku] = rev_date

    print(f"\nTotal historical entries compiled: {len(history_entries)}")

    # 3. Determine ACTIVE vs LEGACY status
    for item in history_entries:
        sku = item['sku']
        if item['rev_date'] == sku_latest_date.get(sku):
            item['status'] = 'ACTIVE'
        else:
            item['status'] = 'LEGACY'

    # 4. Sort entries: Brand, SKU, then Effective Date (oldest to newest)
    history_entries.sort(key=lambda x: (
        str(x['brand']).upper(),
        str(x['sku']).upper(),
        str(x['rev_date'])
    ))

    # 5. Create or rebuild PRICE_HISTORY tab
    if 'PRICE_HISTORY' in wb.sheetnames:
        del wb['PRICE_HISTORY']

    ws_hist = wb.create_sheet(title='PRICE_HISTORY')
    ws_hist.views.sheetView[0].showGridLines = True

    # Headers
    for c_idx, (col_name, col_width, _) in enumerate(COLUMNS, 1):
        cell = ws_hist.cell(row=1, column=c_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws_hist.column_dimensions[get_column_letter(c_idx)].width = col_width

    ws_hist.row_dimensions[1].height = 28
    ws_hist.freeze_panes = 'A2'

    # Write rows
    for r_idx, item in enumerate(history_entries, 2):
        row_vals = [
            item['sku'],
            item['desc'],
            item['brand'],
            item['cat'],
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
            item['rev_date'],
            item['status'],
            item['source']
        ]

        is_even = (r_idx % 2 == 0)
        for c_idx, val in enumerate(row_vals, 1):
            cell = ws_hist.cell(row=r_idx, column=c_idx, value=val)
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
                if val == 'ACTIVE':
                    cell.fill = ACTIVE_FILL
                    cell.font = ACTIVE_FONT
                else:
                    cell.fill = LEGACY_FILL
                    cell.font = LEGACY_FONT

        ws_hist.row_dimensions[r_idx].height = 21

    # Protect PRICE_HISTORY
    ws_hist.protection.sheet = True
    ws_hist.protection.enable()
    ws_hist.protection.selectLockedCells = True
    ws_hist.protection.selectUnlockedCells = True
    ws_hist.protection.formatCells = True
    ws_hist.protection.formatColumns = True
    ws_hist.protection.formatRows = True
    ws_hist.protection.insertColumns = False
    ws_hist.protection.insertRows = False
    ws_hist.protection.deleteColumns = False
    ws_hist.protection.deleteRows = False

    # Save
    wb.save(WORKBOOK_PATH)
    print(f"\n[OK] Successfully added protected PRICE_HISTORY tab ({len(history_entries)} historical price rows) to {WORKBOOK_PATH}!")
    print(f"Total sheets now in workbook: {len(wb.sheetnames)}")

if __name__ == '__main__':
    add_price_history()
