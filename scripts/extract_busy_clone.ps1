# =====================================================================
# Extract Operational Catalog from Local BUSY Clone (Read-Only)
# Target: D:\BusyWin Data\SM\Clone\db12026.bds
# =====================================================================

# Disable Console QuickEdit Mode to prevent accidental mouse clicks from freezing execution
try {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class QuickEditDisabler {
    [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr h, out uint m);
    [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, uint m);
    public static void Disable() {
        IntPtr h = GetStdHandle(-10);
        uint m;
        if (GetConsoleMode(h, out m)) {
            m &= ~0x0040u;
            m |= 0x0080u;
            SetConsoleMode(h, m);
        }
    }
}
"@ -ErrorAction SilentlyContinue
    [QuickEditDisabler]::Disable()
} catch {}

$cloneDir = "D:\BusyWin Data\SM\Clone"
$dbFile = Get-ChildItem -Path $cloneDir -Filter "db1*.bds" | Select-Object -First 1

if (-not $dbFile) {
    Write-Error "No financial year database (db1*.bds) found in $cloneDir"
    exit 1
}

$srcDb = $dbFile.FullName
$tmpDb = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sm_extract_$([Guid]::NewGuid().ToString('N')).bds")
Copy-Item -Path $srcDb -Destination $tmpDb -Force

$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$tmpDb;Jet OLEDB:Database Password=ILoveMyINDIA;Mode=Read;")

# 1. Categories (Item Groups)
Write-Host "Extracting Categories..."
$rsCat = $conn.Execute("SELECT Code, Name FROM Master1 WHERE MasterType = 5")
$categories = @{}
while (-not $rsCat.EOF) {
    $c = $rsCat.Fields.Item("Code").Value
    $n = $rsCat.Fields.Item("Name").Value.ToString().Trim()
    $categories[$c] = $n
    $rsCat.MoveNext()
}
Write-Host "  Found $($categories.Count) categories."

# 2. Products with Opening Stock & Daily Movements
Write-Host "Extracting Products & Stock..."
$sqlProd = @"
SELECT m.Code, m.Name, m.Alias, m.PrintName, m.ParentGrp, m.D3 AS SalePrice, m.D4 AS PurPrice, m.HSNCode, m.DeactiveMaster,
       f.D1 AS OpBal,
       d.TotalDr, d.TotalCr
FROM (Master1 m
      LEFT JOIN (SELECT MasterCode, D1 FROM Folio1 WHERE MasterType = 6) f ON m.Code = f.MasterCode)
      LEFT JOIN (SELECT MasterCode1, SUM(Dr1) AS TotalDr, SUM(Cr1) AS TotalCr FROM DailySum WHERE MasterType = 6 AND MasterCode2 = 0 GROUP BY MasterCode1) d ON m.Code = d.MasterCode1
WHERE m.MasterType = 6
"@

$rsP = $conn.Execute($sqlProd)
$products = [System.Collections.Generic.List[PSCustomObject]]::new()
$prodCodeToSku = @{}
while (-not $rsP.EOF) {
    $code = $rsP.Fields.Item("Code").Value
    $name = $rsP.Fields.Item("Name").Value.ToString().Trim()
    $alias = if ($rsP.Fields.Item("Alias").Value -ne $null) { $rsP.Fields.Item("Alias").Value.ToString().Trim() } else { "" }
    $pGrp = $rsP.Fields.Item("ParentGrp").Value
    $catName = if ($categories.ContainsKey($pGrp)) { $categories[$pGrp] } else { "General" }
    
    $sp = $rsP.Fields.Item("SalePrice").Value
    $pp = $rsP.Fields.Item("PurPrice").Value
    $hsn = $rsP.Fields.Item("HSNCode").Value
    $deactive = $rsP.Fields.Item("DeactiveMaster").Value

    $op = $rsP.Fields.Item("OpBal").Value
    $dr = $rsP.Fields.Item("TotalDr").Value
    $cr = $rsP.Fields.Item("TotalCr").Value
    
    $opVal = if ($op -ne $null -and $op -ne [DBNull]::Value) { [double]$op } else { 0 }
    $drVal = if ($dr -ne $null -and $dr -ne [DBNull]::Value) { [double]$dr } else { 0 }
    $crVal = if ($cr -ne $null -and $cr -ne [DBNull]::Value) { [double]$cr } else { 0 }
    # NOTE: In BUSY DailySum (MasterType = 6), Cr1 is Inward (Receipts) and Dr1 is Outward (Dispatches/Sales).
    # Closing Stock = Opening Balance + Total Inward (Cr1) - Total Outward (Dr1)
    $closing = [Math]::Round($opVal + $crVal - $drVal, 2)
    
    $sku = if ($alias -ne "") { $alias } else { $name }
    $prodCodeToSku[$code] = $sku

    $products.Add([PSCustomObject]@{
        busyCode = $code
        sku = $sku
        name = $name
        alias = $alias
        categoryName = $catName
        salePrice = if ($sp -ne $null -and $sp -ne [DBNull]::Value) { [double]$sp } else { 0 }
        purPrice = if ($pp -ne $null -and $pp -ne [DBNull]::Value) { [double]$pp } else { 0 }
        hsnCode = if ($hsn -ne $null) { $hsn.ToString().Trim() } else { "" }
        stock = [int][Math]::Round($closing)
        stockDecimal = $closing
        isActive = -not [bool]$deactive
    })
    $rsP.MoveNext()
}
Write-Host "  Extracted $($products.Count) products."

# 3. Customers (Debtors & Billed Parties) with Address & GST
Write-Host "Extracting Customers..."
$sqlCust = @"
SELECT m.Code, m.Name, m.Alias, m.PrintName,
       a.Address1, a.Address2, a.Address3, a.Mobile, a.TelNo, a.WhatsAppNo, a.Email, a.GSTNo, a.PINCode, a.Station
FROM Master1 m
LEFT JOIN MasterAddressInfo a ON m.Code = a.MasterCode
WHERE m.MasterType = 2 AND (m.ParentGrp IN (116, 4101, 7406) OR m.Code IN (SELECT DISTINCT MasterCode1 FROM Tran1 WHERE VchType = 9))
"@

$rsC = $conn.Execute($sqlCust)
$customers = [System.Collections.Generic.List[PSCustomObject]]::new()
while (-not $rsC.EOF) {
    $code = $rsC.Fields.Item("Code").Value
    $name = $rsC.Fields.Item("Name").Value.ToString().Trim()
    $alias = if ($rsC.Fields.Item("Alias").Value -ne $null) { $rsC.Fields.Item("Alias").Value.ToString().Trim() } else { "" }
    $print = if ($rsC.Fields.Item("PrintName").Value -ne $null) { $rsC.Fields.Item("PrintName").Value.ToString().Trim() } else { $name }
    
    $a1 = if ($rsC.Fields.Item("Address1").Value -ne $null) { $rsC.Fields.Item("Address1").Value.ToString().Trim() } else { "" }
    $a2 = if ($rsC.Fields.Item("Address2").Value -ne $null) { $rsC.Fields.Item("Address2").Value.ToString().Trim() } else { "" }
    $a3 = if ($rsC.Fields.Item("Address3").Value -ne $null) { $rsC.Fields.Item("Address3").Value.ToString().Trim() } else { "" }
    $addr = @($a1, $a2, $a3) | Where-Object { $_ -ne "" } | ForEach-Object { $_ }
    $fullAddr = $addr -join ", "

    $mobile = if ($rsC.Fields.Item("Mobile").Value -ne $null) { $rsC.Fields.Item("Mobile").Value.ToString().Trim() } else { "" }
    $tel = if ($rsC.Fields.Item("TelNo").Value -ne $null) { $rsC.Fields.Item("TelNo").Value.ToString().Trim() } else { "" }
    $wa = if ($rsC.Fields.Item("WhatsAppNo").Value -ne $null) { $rsC.Fields.Item("WhatsAppNo").Value.ToString().Trim() } else { "" }
    $phone = if ($mobile -ne "") { $mobile } elseif ($tel -ne "") { $tel } elseif ($wa -ne "") { $wa } else { "0000000000" }

    $email = if ($rsC.Fields.Item("Email").Value -ne $null) { $rsC.Fields.Item("Email").Value.ToString().Trim() } else { "" }
    $gst = if ($rsC.Fields.Item("GSTNo").Value -ne $null) { $rsC.Fields.Item("GSTNo").Value.ToString().Trim() } else { "" }
    $pin = if ($rsC.Fields.Item("PINCode").Value -ne $null) { $rsC.Fields.Item("PINCode").Value.ToString().Trim() } else { "" }
    $city = if ($rsC.Fields.Item("Station").Value -ne $null) { $rsC.Fields.Item("Station").Value.ToString().Trim() } else { "Mysore" }

    $customers.Add([PSCustomObject]@{
        customerCode = "CUST-$code"
        name = $name
        company = $print
        alias = $alias
        phone = $phone
        address = $fullAddr
        pincode = $pin
        gstNumber = $gst
        city = $city
    })
    $rsC.MoveNext()
}
Write-Host "  Extracted $($customers.Count) customers."

# 4. Monthly Inventory Flow (DailySum)
Write-Host "Extracting Monthly Inventory Flow..."
$sqlFlow = @"
SELECT MONTH(Date) AS M, YEAR(Date) AS Y, SUM(Cr1) AS TotalIn, SUM(Dr1) AS TotalOut
FROM DailySum
WHERE MasterType = 6 AND MasterCode2 = 0
GROUP BY YEAR(Date), MONTH(Date)
ORDER BY YEAR(Date), MONTH(Date)
"@
$rsFlow = $conn.Execute($sqlFlow)
$monthlyFlow = [System.Collections.Generic.List[PSCustomObject]]::new()
$monthNames = @{ 1="Jan"; 2="Feb"; 3="Mar"; 4="Apr"; 5="May"; 6="Jun"; 7="Jul"; 8="Aug"; 9="Sep"; 10="Oct"; 11="Nov"; 12="Dec" }
while (-not $rsFlow.EOF) {
    $mNum = [int]$rsFlow.Fields.Item("M").Value
    $yNum = [int]$rsFlow.Fields.Item("Y").Value
    $inQ = [double]$rsFlow.Fields.Item("TotalIn").Value
    $outQ = [double]$rsFlow.Fields.Item("TotalOut").Value
    $monthlyFlow.Add([PSCustomObject]@{
        month = $mNum
        year = $yNum
        label = "$($monthNames[$mNum]) $yNum"
        inward = [Math]::Round($inQ, 0)
        outward = [Math]::Round($outQ, 0)
        net = [Math]::Round($inQ - $outQ, 0)
    })
    $rsFlow.MoveNext()
}
Write-Host "  Extracted $($monthlyFlow.Count) monthly flow periods."

# 5. Top Billed Customers (Tran1 - Sales Invoices)
Write-Host "Extracting Top Billed Customers..."
$sqlTopCust = @"
SELECT TOP 15 m.Code, m.Name, COUNT(*) AS BillCount, SUM(t.VchAmtBaseCur) AS TotalBilled
FROM Tran1 t INNER JOIN Master1 m ON t.MasterCode1 = m.Code
WHERE t.VchType = 9 AND t.Cancelled = False
GROUP BY m.Code, m.Name
ORDER BY SUM(t.VchAmtBaseCur) DESC
"@
$rsTopCust = $conn.Execute($sqlTopCust)
$topBilledCustomers = [System.Collections.Generic.List[PSCustomObject]]::new()
while (-not $rsTopCust.EOF) {
    $c = $rsTopCust.Fields.Item("Code").Value
    $n = $rsTopCust.Fields.Item("Name").Value.ToString().Trim()
    $cnt = [int]$rsTopCust.Fields.Item("BillCount").Value
    $amt = [Math]::Round([double]$rsTopCust.Fields.Item("TotalBilled").Value, 2)
    $topBilledCustomers.Add([PSCustomObject]@{
        customerCode = "CUST-$c"
        name = $n
        invoiceCount = $cnt
        totalBilled = $amt
    })
    $rsTopCust.MoveNext()
}
Write-Host "  Extracted $($topBilledCustomers.Count) top billed customers."

# 6. Latest Billed Sales Prices per (Customer, Product - Sales Vouchers)
Write-Host "Extracting Latest Billed Sales Prices..."
$sqlHist = @"
SELECT t1.VchType, t1.VchNo, t1.Date, t1.MasterCode1 AS CustCode, t2.MasterCode1 AS ProdCode, 
       t2.Value1 AS Qty, t2.Value2 AS Rate, t2.Value3 AS Amount, t2.D2 AS PriceInc
FROM (Tran1 t1 INNER JOIN Tran2 t2 ON t1.VchCode = t2.VchCode)
INNER JOIN Master1 m ON t2.MasterCode1 = m.Code
WHERE t1.VchType = 9 AND t1.Cancelled = False AND m.MasterType = 6 AND t2.Value1 <> 0
ORDER BY t1.Date DESC, t1.VchCode DESC
"@
$rsHist = $conn.Execute($sqlHist)
$historicalMap = @{}
while (-not $rsHist.EOF) {
    $c = $rsHist.Fields.Item("CustCode").Value
    $p = $rsHist.Fields.Item("ProdCode").Value
    $key = "$c-$p"
    if (-not $historicalMap.ContainsKey($key)) {
        $vNo = if ($rsHist.Fields.Item("VchNo").Value -ne $null) { $rsHist.Fields.Item("VchNo").Value.ToString().Trim() } else { "BILL" }
        $vDt = [datetime]$rsHist.Fields.Item("Date").Value
        $q = [Math]::Abs([double]$rsHist.Fields.Item("Qty").Value)
        $amt = [Math]::Abs([double]$rsHist.Fields.Item("Amount").Value)
        $pInc = if ($rsHist.Fields.Item("PriceInc").Value -ne $null) { [double]$rsHist.Fields.Item("PriceInc").Value } else { 0 }
        
        $billedRate = if ($pInc -gt 0) { $pInc } elseif ($q -gt 0) { [Math]::Round($amt / $q, 2) } else { [double]$rsHist.Fields.Item("Rate").Value }
        $sku = if ($prodCodeToSku.ContainsKey($p)) { $prodCodeToSku[$p] } else { "" }

        if ($sku -ne "" -and $billedRate -gt 0 -and $q -gt 0) {
            $historicalMap[$key] = [PSCustomObject]@{
                custCode = "CUST-$c"
                prodBusyCode = $p
                prodSku = $sku
                voucherNo = $vNo
                voucherDate = $vDt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                quantity = $q
                rate = $billedRate
                isTaxInclusive = ($pInc -gt 0)
            }
        }
    }
    $rsHist.MoveNext()
}
$historicalPrices = @($historicalMap.Values)
Write-Host "  Extracted $($historicalPrices.Count) unique customer-product price records."

# 7. Extract Full Sales Vouchers with Line Items and GST Tax Information
Write-Host "Extracting GST & Tax Breakdown from VchGSTSumItemWise..."
$sqlGst = @"
SELECT VchCode, ItemCode, HSNCode, TaxableAmt, TaxAmt, TaxRate, TaxAmt1, TaxRate1
FROM VchGSTSumItemWise
"@
$rsGst = $conn.Execute($sqlGst)
$vchGstSummary = @{}
$itemGstMap = @{}

while (-not $rsGst.EOF) {
    $vCode = $rsGst.Fields.Item("VchCode").Value
    $iCode = $rsGst.Fields.Item("ItemCode").Value
    $hsn = if ($rsGst.Fields.Item("HSNCode").Value -ne $null) { $rsGst.Fields.Item("HSNCode").Value.ToString().Trim() } else { "" }
    $taxable = if ($rsGst.Fields.Item("TaxableAmt").Value -ne $null) { [double]$rsGst.Fields.Item("TaxableAmt").Value } else { 0 }
    $tAmt = if ($rsGst.Fields.Item("TaxAmt").Value -ne $null) { [double]$rsGst.Fields.Item("TaxAmt").Value } else { 0 }
    $tRate = if ($rsGst.Fields.Item("TaxRate").Value -ne $null) { [double]$rsGst.Fields.Item("TaxRate").Value } else { 0 }
    $tAmt1 = if ($rsGst.Fields.Item("TaxAmt1").Value -ne $null) { [double]$rsGst.Fields.Item("TaxAmt1").Value } else { 0 }
    $tRate1 = if ($rsGst.Fields.Item("TaxRate1").Value -ne $null) { [double]$rsGst.Fields.Item("TaxRate1").Value } else { 0 }

    if (-not $vchGstSummary.ContainsKey($vCode)) {
        $vchGstSummary[$vCode] = @{
            taxableAmount = 0.0
            cgstAmount = 0.0
            sgstAmount = 0.0
            igstAmount = 0.0
            taxAmount = 0.0
        }
    }
    $vchGstSummary[$vCode].taxableAmount += $taxable
    if ($tRate1 -gt 0) {
        $vchGstSummary[$vCode].cgstAmount += $tAmt
        $vchGstSummary[$vCode].sgstAmount += $tAmt1
        $vchGstSummary[$vCode].taxAmount += ($tAmt + $tAmt1)
    } else {
        $vchGstSummary[$vCode].igstAmount += $tAmt
        $vchGstSummary[$vCode].taxAmount += $tAmt
    }

    $key = "$vCode-$iCode"
    $itemGstMap[$key] = @{
        hsn = $hsn
        taxableAmount = [Math]::Round($taxable, 2)
        taxRate = [Math]::Round($tRate + $tRate1, 2)
        taxAmount = [Math]::Round($tAmt + $tAmt1, 2)
        cgstRate = if ($tRate1 -gt 0) { $tRate } else { 0 }
        cgstAmount = if ($tRate1 -gt 0) { [Math]::Round($tAmt, 2) } else { 0 }
        sgstRate = if ($tRate1 -gt 0) { $tRate1 } else { 0 }
        sgstAmount = if ($tRate1 -gt 0) { [Math]::Round($tAmt1, 2) } else { 0 }
        igstRate = if ($tRate1 -eq 0 -and $tRate -gt 0) { $tRate } else { 0 }
        igstAmount = if ($tRate1 -eq 0 -and $tRate -gt 0) { [Math]::Round($tAmt, 2) } else { 0 }
    }

    $rsGst.MoveNext()
}
Write-Host "  Processed GST tax breakdown for $($vchGstSummary.Count) vouchers."

Write-Host "Extracting Full Sales Vouchers & Line Items..."
$sqlItems = @"
SELECT t2.VchCode, t2.MasterCode1 AS ItemCode, m.Name AS ItemName, m.Alias AS ItemSku, t2.Value1 AS Qty, t2.Value2 AS Rate, t2.Value3 AS Amount, t2.D2 AS PriceInc
FROM Tran2 t2 INNER JOIN Master1 m ON t2.MasterCode1 = m.Code
WHERE m.MasterType = 6 AND t2.Value1 <> 0
"@
$rsItems = $conn.Execute($sqlItems)
$vchItemsMap = @{}
while (-not $rsItems.EOF) {
    $vCode = $rsItems.Fields.Item("VchCode").Value
    $iCode = $rsItems.Fields.Item("ItemCode").Value
    if (-not $vchItemsMap.ContainsKey($vCode)) {
        $vchItemsMap[$vCode] = [System.Collections.Generic.List[PSCustomObject]]::new()
    }
    $q = [Math]::Abs([double]$rsItems.Fields.Item("Qty").Value)
    $amt = [Math]::Abs([double]$rsItems.Fields.Item("Amount").Value)
    $pInc = if ($rsItems.Fields.Item("PriceInc").Value -ne $null) { [double]$rsItems.Fields.Item("PriceInc").Value } else { 0 }
    $rate = if ($pInc -gt 0) { $pInc } elseif ($q -gt 0) { [Math]::Round($amt / $q, 2) } else { [double]$rsItems.Fields.Item("Rate").Value }
    
    $gstItem = if ($itemGstMap.ContainsKey("$vCode-$iCode")) { $itemGstMap["$vCode-$iCode"] } else { $null }
    $finalAmt = if ($pInc -gt 0) { [Math]::Round($pInc * $q, 2) } else { $amt }
    
    $itemTaxable = if ($gstItem) { $gstItem.taxableAmount } elseif ($pInc -gt 0) { [Math]::Round($finalAmt / 1.18, 2) } else { $finalAmt }
    $itemTaxRate = if ($gstItem) { $gstItem.taxRate } elseif ($pInc -gt 0) { 18 } else { 0 }
    $itemTaxAmt = if ($gstItem) { $gstItem.taxAmount } elseif ($pInc -gt 0) { [Math]::Round($finalAmt - $itemTaxable, 2) } else { 0 }
    $itemHsn = if ($gstItem) { $gstItem.hsn } else { "" }
    $cgstRate = if ($gstItem) { $gstItem.cgstRate } elseif ($itemTaxRate -gt 0) { 9 } else { 0 }
    $cgstAmt = if ($gstItem) { $gstItem.cgstAmount } elseif ($itemTaxAmt -gt 0) { [Math]::Round($itemTaxAmt / 2, 2) } else { 0 }
    $sgstRate = if ($gstItem) { $gstItem.sgstRate } elseif ($itemTaxRate -gt 0) { 9 } else { 0 }
    $sgstAmt = if ($gstItem) { $gstItem.sgstAmount } elseif ($itemTaxAmt -gt 0) { [Math]::Round($itemTaxAmt / 2, 2) } else { 0 }
    $igstRate = if ($gstItem) { $gstItem.igstRate } else { 0 }
    $igstAmt = if ($gstItem) { $gstItem.igstAmount } else { 0 }

    $vchItemsMap[$vCode].Add([PSCustomObject]@{
        name = $rsItems.Fields.Item("ItemName").Value.ToString().Trim()
        sku = if ($rsItems.Fields.Item("ItemSku").Value -ne $null) { $rsItems.Fields.Item("ItemSku").Value.ToString().Trim() } else { "" }
        qty = $q
        rate = $rate
        amount = $finalAmt
        isTaxInclusive = ($pInc -gt 0)
        hsn = $itemHsn
        taxableAmount = $itemTaxable
        taxRate = $itemTaxRate
        taxAmount = $itemTaxAmt
        cgstRate = $cgstRate
        cgstAmount = $cgstAmt
        sgstRate = $sgstRate
        sgstAmount = $sgstAmt
        igstRate = $igstRate
        igstAmount = $igstAmt
    })
    $rsItems.MoveNext()
}

$sqlVchHeaders = @"
SELECT t1.VchCode, t1.VchType, t1.VchNo, t1.Date, m1.Name AS CustName, m1.Code AS CustCode, t1.VchAmtBaseCur AS TotalAmt
FROM Tran1 t1 INNER JOIN Master1 m1 ON t1.MasterCode1 = m1.Code
WHERE t1.VchType = 9 AND t1.Cancelled = False
ORDER BY t1.Date DESC, t1.VchCode DESC
"@
$rsVch = $conn.Execute($sqlVchHeaders)
$vouchers = [System.Collections.Generic.List[PSCustomObject]]::new()
while (-not $rsVch.EOF) {
    $vCode = $rsVch.Fields.Item("VchCode").Value
    $vType = [int]$rsVch.Fields.Item("VchType").Value
    $vNo = if ($rsVch.Fields.Item("VchNo").Value -ne $null) { $rsVch.Fields.Item("VchNo").Value.ToString().Trim() } else { "BILL" }
    $vDate = [datetime]$rsVch.Fields.Item("Date").Value
    $cName = $rsVch.Fields.Item("CustName").Value.ToString().Trim()
    $cCode = "CUST-$($rsVch.Fields.Item('CustCode').Value)"
    $totAmt = [Math]::Round([double]$rsVch.Fields.Item("TotalAmt").Value, 2)
    $series = "SMG"

    $items = if ($vchItemsMap.ContainsKey($vCode)) { $vchItemsMap[$vCode] } else { @() }

    $gst = if ($vchGstSummary.ContainsKey($vCode)) { $vchGstSummary[$vCode] } else { $null }
    $taxableAmt = if ($gst -and $gst.taxableAmount -gt 0) { [Math]::Round($gst.taxableAmount, 2) } else { [Math]::Round($totAmt / 1.18, 2) }
    $cgstAmt = if ($gst) { [Math]::Round($gst.cgstAmount, 2) } else { [Math]::Round(($totAmt - $taxableAmt) / 2, 2) }
    $sgstAmt = if ($gst) { [Math]::Round($gst.sgstAmount, 2) } else { [Math]::Round(($totAmt - $taxableAmt) / 2, 2) }
    $igstAmt = if ($gst) { [Math]::Round($gst.igstAmount, 2) } else { 0 }
    $taxAmt = if ($gst -and $gst.taxAmount -gt 0) { [Math]::Round($gst.taxAmount, 2) } else { [Math]::Round($totAmt - $taxableAmt, 2) }

    $vouchers.Add([PSCustomObject]@{
        voucherNo = $vNo
        voucherType = $vType
        series = $series
        voucherDate = $vDate.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        customerCode = $cCode
        customerName = $cName
        totalAmount = $totAmt
        taxableAmount = $taxableAmt
        taxAmount = $taxAmt
        cgstAmount = $cgstAmt
        sgstAmount = $sgstAmt
        igstAmount = $igstAmt
        itemCount = $items.Count
        items = $items
    })
    $rsVch.MoveNext()
}
Write-Host "  Extracted $($vouchers.Count) full vouchers with line items."
} finally {
    if ($conn -ne $null) {
        $conn.Close()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($conn) | Out-Null
    }
    Remove-Item -Path $tmpDb -Force -ErrorAction SilentlyContinue
}

# Save to payload JSON
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$payloadPath = Join-Path $projectRoot "busy_sync_payload.json"

$payload = [PSCustomObject]@{
    extractedAt = (Get-Date).ToString("o")
    categories = $categories.Values | Select-Object -Unique
    products = $products
    customers = $customers
    monthlyFlow = $monthlyFlow
    topBilledCustomers = $topBilledCustomers
    historicalPrices = $historicalPrices
    vouchers = $vouchers
}

Write-Host "Saving payload to $payloadPath..."
$payload | ConvertTo-Json -Depth 5 | Set-Content -Path $payloadPath -Encoding UTF8
Write-Host "Extraction from Clone completed successfully!"
