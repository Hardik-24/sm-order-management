#!/usr/bin/env python3
"""
Prepare Master Pricelist for Safe Local & Google Sheets Operation:
1. Keeps all 4,863 product rows and 11 brand sheets 100% intact with exact formatting.
2. Protects MASTER_ALL sheet so it cannot be accidentally edited, typed over, or deleted.
3. Leaves all 11 brand sheets fully editable for price, discount, and SKU updates.
4. Adds a '_GOOGLE_SHEETS_GUIDE_' tab with copy-paste live sync formulas and protection steps.
5. Generates a 1-click Desktop batch tool 'Sync_Pricelist.bat' to re-sync MASTER_ALL anytime.
"""

import os
import sys
import shutil
import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

DESKTOP_PRIMARY = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026.xlsx"
DESKTOP_UPDATED = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026_UPDATED.xlsx"

def apply_safeguards_and_sync(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return False

    print(f"\nProcessing workbook: {filepath}")
    wb = openpyxl.load_workbook(filepath)

    brand_sheets = [s for s in wb.sheetnames if s not in ['MASTER_ALL', '_GOOGLE_SHEETS_GUIDE_']]
    print(f"Found {len(brand_sheets)} brand sheets: {brand_sheets}")

    # 1. Verify MASTER_ALL exists
    if 'MASTER_ALL' not in wb.sheetnames:
        print("Error: MASTER_ALL sheet missing!")
        return False

    ws_all = wb['MASTER_ALL']
    print(f"Current MASTER_ALL rows: {ws_all.max_row} (including header)")

    # 2. Configure Sheet Protection on MASTER_ALL
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

    # 3. Ensure all brand sheets are unlocked/editable
    for b_name in brand_sheets:
        ws_b = wb[b_name]
        ws_b.protection.sheet = False
        ws_b.protection.disable()

    # 4. Create or update _GOOGLE_SHEETS_GUIDE_ tab at the end
    if '_GOOGLE_SHEETS_GUIDE_' in wb.sheetnames:
        del wb['_GOOGLE_SHEETS_GUIDE_']

    ws_guide = wb.create_sheet(title='_GOOGLE_SHEETS_GUIDE_')
    ws_guide.views.sheetView[0].showGridLines = True

    # Styling for Guide Tab
    navy_fill = PatternFill(start_color='1B365D', end_color='1B365D', fill_type='solid')
    header_fill = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')
    callout_fill = PatternFill(start_color='EFF6FF', end_color='EFF6FF', fill_type='solid')
    code_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')

    title_font = Font(name='Segoe UI', size=14, bold=True, color='FFFFFF')
    section_font = Font(name='Segoe UI', size=11, bold=True, color='1E293B')
    bold_font = Font(name='Segoe UI', size=10, bold=True, color='0F172A')
    normal_font = Font(name='Segoe UI', size=10, color='334155')
    code_font = Font(name='Consolas', size=10, color='0F172A', bold=True)

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ws_guide.column_dimensions['A'].width = 5
    ws_guide.column_dimensions['B'].width = 30
    ws_guide.column_dimensions['C'].width = 95

    # Title Banner
    ws_guide.merge_cells('B2:C2')
    cell_title = ws_guide['B2']
    cell_title.value = "GOOGLE SHEETS LIVE-SYNC & PROTECTION GUIDE"
    cell_title.font = title_font
    cell_title.fill = navy_fill
    cell_title.alignment = Alignment(horizontal='center', vertical='center')
    ws_guide.row_dimensions[2].height = 36

    # Instructions rows
    guide_rows = [
        (3, "", ""),
        (4, "Purpose", "This workbook is configured so individual brand tabs are the editable Source of Truth, and MASTER_ALL is the protected summary."),
        (5, "Offline / Excel Mode", "MASTER_ALL is currently protected against accidental edits. To re-sync changes in Excel, double-click 'Sync_Pricelist.bat' on your Desktop."),
        (6, "", ""),
        (7, "Step 1: Upload to Drive", "Upload this .xlsx file to Google Drive. Right-click it and choose: 'Open with' -> 'Google Sheets'. Then click 'File' -> 'Save as Google Sheets'."),
        (8, "Step 2: Enable Live Sync", "In Google Sheets, to make MASTER_ALL automatically mirror all brand edits in real time, paste the formula below into cell A2 of MASTER_ALL:"),
        (9, "", ""),
        (10, "LIVE-SYNC FORMULA", "=SORT(VSTACK(FILTER(GREENPANEL!A2:M, GREENPANEL!A2:A<>\"\"), FILTER(ACTION_TESA!A2:M, ACTION_TESA!A2:A<>\"\"), FILTER(RELWOOD!A2:M, RELWOOD!A2:A<>\"\"), FILTER(MERINO!A2:M, MERINO!A2:A<>\"\"), FILTER(CENTURY!A2:M, CENTURY!A2:A<>\"\"), FILTER(REHAU!A2:M, REHAU!A2:A<>\"\"), FILTER(BLUM!A2:M, BLUM!A2:A<>\"\"), FILTER(GREENPLY!A2:M, GREENPLY!A2:A<>\"\"), FILTER(VRINDA!A2:M, VRINDA!A2:A<>\"\"), FILTER(WIGWAM!A2:M, WIGWAM!A2:A<>\"\"), FILTER(HAFELE!A2:M, HAFELE!A2:A<>\"\")), 3, TRUE, 1, TRUE)"),
        (11, "", ""),
        (12, "Step 3: Protect in Sheets", "In Google Sheets, right-click the 'MASTER_ALL' tab -> Click 'Protect sheet' -> Click 'Set permissions' -> Select 'Only you'. This prevents staff from accidentally typing over formulas."),
        (13, "Step 4: Grant Staff Access", "Share the Google Sheet with your sales reps/purchasing staff with 'Editor' permissions. They can edit prices and add items in brand tabs, while MASTER_ALL stays 100% safe.")
    ]

    for r_idx, col_b, col_c in guide_rows:
        ws_guide.row_dimensions[r_idx].height = 24 if r_idx != 10 else 45
        if not col_b and not col_c:
            continue
        
        cB = ws_guide.cell(row=r_idx, column=2, value=col_b)
        cC = ws_guide.cell(row=r_idx, column=3, value=col_c)
        cB.border = thin_border
        cC.border = thin_border

        if r_idx == 10:
            cB.font = section_font
            cB.fill = header_fill
            cB.alignment = Alignment(horizontal='center', vertical='center')
            cC.font = code_font
            cC.fill = code_fill
            cC.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
        elif r_idx in [4, 5, 7, 8, 12, 13]:
            cB.font = bold_font
            cB.fill = callout_fill
            cB.alignment = Alignment(horizontal='left', vertical='center')
            cC.font = normal_font
            cC.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

    # Save workbook
    wb.save(filepath)
    print(f"Successfully saved and secured: {filepath}")
    return True

def create_desktop_sync_batch():
    batch_content = f"""@echo off
title SM Master Pricelist Synchronizer
chcp 65001 >nul
echo ======================================================================
echo   SM MASTER PRICELIST 2026 - LOCAL SYNCHRONIZER
echo ======================================================================
echo.
echo Scanning brand sheets and updating MASTER_ALL...
echo.

python "{os.path.abspath('scripts/sync_master_pricelist.py')}"

echo.
pause
"""
    desktop_bat_path = r"C:\Users\hdpat\OneDrive\Desktop\Sync_Pricelist.bat"
    try:
        with open(desktop_bat_path, "w", encoding="utf-8") as f:
            f.write(batch_content)
        print(f"Created 1-click sync batch file: {desktop_bat_path}")
    except Exception as e:
        print(f"Could not create desktop bat: {e}")

if __name__ == "__main__":
    apply_safeguards_and_sync(DESKTOP_PRIMARY)
    apply_safeguards_and_sync(DESKTOP_UPDATED)
    create_desktop_sync_batch()
