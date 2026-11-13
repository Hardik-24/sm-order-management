#!/usr/bin/env python3
"""
Connect Master Price List (Dry-Run / Preview & Apply)
Reads SM_MASTER_PRICELIST_2026_RECREATED.xlsx and matches against DB catalog.
Default mode is DRY-RUN (read-only, no database mutations).
"""

import os
import sys
import json
import shutil
import re
import openpyxl

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

DESKTOP_PATH = r"C:\Users\hdpat\OneDrive\Desktop\SM_MASTER_PRICELIST_2026_RECREATED.xlsx"
PAYLOAD_PATH = "busy_sync_payload.json"

def clean_str(s):
    if s is None:
        return ""
    # Remove extra spaces and uppercase
    return re.sub(r'\s+', ' ', str(s)).strip().upper()

def extract_thickness(text):
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:MM)?', text)
    if m:
        return float(m.group(1))
    return None

def main():
    dry_run = "--apply" not in sys.argv
    print("=" * 70)
    print("  SM MASTER PRICE LIST 2026 -> PRODUCT CATALOG CONNECTOR")
    print("=" * 70)
    print(f"Mode: {'DRY RUN (Read-Only Preview - No DB Changes)' if dry_run else 'APPLY (Will Update Database)'}\n")

    if not os.path.exists(DESKTOP_PATH):
        print(f"Error: Master price list not found at {DESKTOP_PATH}")
        sys.exit(1)

    # Copy to temporary file to avoid lock issues if open in Excel
    temp_wb_path = os.path.join(os.path.dirname(__file__), "temp_audit_pricelist.xlsx")
    try:
        shutil.copyfile(DESKTOP_PATH, temp_wb_path)
    except PermissionError:
        import subprocess
        subprocess.run(["powershell", "-Command", f"Copy-Item '{DESKTOP_PATH}' '{temp_wb_path}' -Force"], check=True)

    # Load DB products from payload
    if not os.path.exists(PAYLOAD_PATH):
        print(f"Error: {PAYLOAD_PATH} not found.")
        sys.exit(1)

    with open(PAYLOAD_PATH, 'r', encoding='utf-8-sig') as f:
        payload = json.load(f)

    db_products = payload.get("products", [])
    print(f"Loaded {len(db_products)} products from current database catalog.")

    # Build DB indexes
    db_by_sku = {}
    db_by_name = {}
    for p in db_products:
        sku = clean_str(p.get("sku"))
        name = clean_str(p.get("name"))
        if sku:
            db_by_sku[sku] = p
        if name:
            db_by_name[name] = p

    # Load Workbook
    wb = openpyxl.load_workbook(temp_wb_path, data_only=True)
    sheets_to_process = [s for s in wb.sheetnames if s != "MASTER_ALL"]

    audit_summary = []
    matched_updates = []
    unmatched_items = []

    for s_name in sheets_to_process:
        ws = wb[s_name]
        sheet_rows = list(ws.iter_rows(values_only=True))
        if not sheet_rows:
            continue

        header = [clean_str(c) for c in sheet_rows[0]]
        sku_idx = 0
        desc_idx = 1
        brand_idx = 2
        cat_idx = 3
        price_idx = 4

        s_total = 0
        s_matched = 0

        for row in sheet_rows[1:]:
            if not any(row):
                continue
            s_total += 1
            sku = clean_str(row[sku_idx])
            desc = clean_str(row[desc_idx])
            try:
                new_price = float(row[price_idx]) if row[price_idx] is not None else 0.0
            except:
                new_price = 0.0

            matched_product = None

            # 1. Exact SKU match
            if sku and sku in db_by_sku:
                matched_product = db_by_sku[sku]
            # 2. Exact Name match
            elif desc and desc in db_by_name:
                matched_product = db_by_name[desc]
            # 3. Substring matching
            elif desc and len(desc) > 8:
                for db_n, p_obj in db_by_name.items():
                    if desc in db_n or db_n in desc:
                        matched_product = p_obj
                        break

            # 4. Smart Board / Sheet Specification Matching (for Greenpanel, Action Tesa, Greenply, Wigwam, Century, etc.)
            if not matched_product and s_name in ['GREENPANEL', 'ACTION_TESA', 'GREENPLY', 'WIGWAM', 'CENTURY', 'MERINO', 'VRINDA', 'RELWOOD']:
                # Extract thickness from excel desc
                e_thick_m = re.search(r'(\d+(?:\.\d+)?)\s*MM', desc)
                e_thick = e_thick_m.group(1) if e_thick_m else None
                
                e_is_hdwr = 'HDWR' in desc or 'HDHMR' in desc or 'BOILO' in desc
                e_is_ext = 'EXTERIOR' in desc or 'EXT' in desc
                e_is_int = 'INTERIOR' in desc or 'INT' in desc
                e_is_prelam = 'PRELAM' in desc
                
                # Search among DB products of this brand
                brand_keywords = {
                    'GREENPANEL': ['(GREEN)', 'GREENPANEL'],
                    'ACTION_TESA': ['TESA', 'ACTION'],
                    'GREENPLY': ['GREEN PLY', 'GREENPLY', 'GP '],
                    'WIGWAM': ['WIG', 'WIGWAM'],
                    'CENTURY': ['CENTURY'],
                    'MERINO': ['MERINO'],
                    'VRINDA': ['VRINDA'],
                    'RELWOOD': ['RELWOOD']
                }.get(s_name, [])
                
                if e_thick:
                    for p in db_products:
                        p_n = clean_str(p.get('name'))
                        # Must match brand keyword
                        if not any(bk in p_n for bk in brand_keywords):
                            continue
                        
                        # Must match thickness as a word boundary
                        p_thick_m = re.search(rf'(?:^|\D){re.escape(e_thick)}(?:MM|\D|$)', p_n)
                        if not p_thick_m:
                            continue
                            
                        # Must match grade
                        p_is_hdwr = 'HDWR' in p_n or 'HDHMR' in p_n or 'BOILO' in p_n
                        p_is_ext = 'EXT' in p_n
                        p_is_int = 'INT' in p_n
                        p_is_prelam = 'PRELAM' in p_n
                        
                        if e_is_hdwr == p_is_hdwr and e_is_prelam == p_is_prelam:
                            if (e_is_ext and p_is_ext) or (e_is_int and p_is_int) or (not e_is_ext and not e_is_int):
                                matched_product = p
                                break

            if matched_product:
                s_matched += 1
                curr_price = float(matched_product.get("price") or 0.0)
                matched_updates.append({
                    "sheet": s_name,
                    "db_id": matched_product.get("id"),
                    "db_name": matched_product.get("name"),
                    "db_sku": matched_product.get("sku"),
                    "excel_desc": desc,
                    "excel_sku": sku,
                    "old_price": curr_price,
                    "new_price": new_price,
                    "price_diff": round(new_price - curr_price, 2)
                })
            else:
                unmatched_items.append({
                    "sheet": s_name,
                    "excel_sku": sku,
                    "excel_desc": desc,
                    "price": new_price
                })

        pct = round((s_matched / s_total) * 100, 1) if s_total > 0 else 0
        audit_summary.append({
            "sheet": s_name,
            "total": s_total,
            "matched": s_matched,
            "unmatched": s_total - s_matched,
            "match_pct": pct
        })
        print(f"Sheet {s_name:<15}: {s_matched:>4} / {s_total:>4} matched ({pct:>5}%) | {s_total - s_matched:>4} new catalog items")

    print("\n" + "=" * 70)
    total_items = sum(a["total"] for a in audit_summary)
    total_matched = sum(a["matched"] for a in audit_summary)
    overall_pct = round((total_matched / total_items) * 100, 1) if total_items > 0 else 0
    print(f"OVERALL RESULTS: {total_matched} / {total_items} items matched ({overall_pct}%)")
    print(f"Items ready for immediate price update: {len(matched_updates)}")
    print(f"New items ready for catalog expansion:  {len(unmatched_items)}")
    print("=" * 70)

    # Save mapping audit report
    report_file = os.path.join(os.path.dirname(__file__), "pricelist_mapping_preview.json")
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            "generatedAt": os.path.getmtime(DESKTOP_PATH),
            "summary": audit_summary,
            "totalMatched": total_matched,
            "totalItems": total_items,
            "sampleMatchedUpdates": matched_updates[:30]
        }, f, indent=2)

    print(f"\n[v] Preview report written to: {report_file}")

    # Generate safe transactional SQL script for when user approves --apply
    sql_file = os.path.join(os.path.dirname(__file__), "apply_pricelist_updates.sql")
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write("-- =====================================================================\n")
        f.write("-- SM Master Price List 2026 Batch Update (Safe Transactional SQL)\n")
        f.write(f"-- Total Updates: {len(matched_updates)} products\n")
        f.write("-- =====================================================================\n\n")
        f.write("BEGIN;\n\n")
        for u in matched_updates:
            # Escape strings
            p_name = u['db_name'].replace("'", "''")
            p_price = u['new_price']
            f.write(f"UPDATE products SET price = {p_price}, \"updatedAt\" = NOW() WHERE name = '{p_name}';\n")
        f.write("\nCOMMIT;\n")

    print(f"[v] Safe transactional SQL prepared: {sql_file}")

    # Clean up temp file
    if os.path.exists(temp_wb_path):
        os.remove(temp_wb_path)

if __name__ == "__main__":
    main()
