const fs = require("fs");

async function previewData() {
  const filePath = "D:\\App Development\\Python automation BUSY\\SM_20260831_MSAll.DAT";
  console.log("Reading:", filePath);
  const data = fs.readFileSync(filePath, "utf8");

  // 1. Items
  const itemMatch = data.match(/<Item>([\s\S]*?)<\/Item>/g) || [];
  console.log(`Found ${itemMatch.length} <Item> tags`);

  const categoryNames = new Set();
  const sampleItems = [];

  itemMatch.forEach((itemStr, idx) => {
    const getVal = (tag) => {
      const match = itemStr.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
      return match ? match[1].replace(/&amp;/g, "&").trim() : null;
    };

    const group = getVal("ParentGroup") || "General";
    categoryNames.add(group);

    if (idx < 3) {
      sampleItems.push({
        name: getVal("Name"),
        sku: getVal("Alias") || getVal("Name"),
        categoryName: group,
        unit: getVal("MainUnit"),
        price: getVal("SalePrice") || getVal("MRP"),
        stock: getVal("OPStockInMainUnit"),
        hsnCode: getVal("HSNCodeGST") || getVal("HSNCode"),
        taxRate: getVal("TaxCategory")
      });
    }
  });

  console.log(`Unique Categories in DAT: ${categoryNames.size}`);
  console.log("Sample Items:", sampleItems);

  // 2. Accounts (Customers / Suppliers)
  const accMatch = data.match(/<Account>([\s\S]*?)<\/Account>/g) || [];
  console.log(`Found ${accMatch.length} <Account> tags`);

  let debtorCount = 0;
  let creditorCount = 0;
  const sampleAccounts = [];

  for (const accStr of accMatch) {
    const getVal = (tag) => {
      const match = accStr.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
      return match ? match[1].replace(/&amp;/g, "&").trim() : null;
    };

    const group = getVal("ParentGroup") || "";
    const isCreditor = group.includes("Creditor") || getVal("SupplierType") === "1";
    const isDebtor = group.includes("Debtor");

    if (isDebtor) {
      debtorCount++;
      if (debtorCount <= 2) {
        sampleAccounts.push({
          type: "Customer (Debtor)",
          company: getVal("Name"),
          contact: getVal("Contact"),
          phone: getVal("Mobile") || getVal("TelNo"),
          gst: getVal("GSTNo")
        });
      }
    } else if (isCreditor) {
      creditorCount++;
      if (creditorCount <= 2) {
        sampleAccounts.push({
          type: "Supplier (Creditor)",
          company: getVal("Name"),
          contact: getVal("Contact"),
          phone: getVal("Mobile") || getVal("TelNo"),
          gst: getVal("GSTNo")
        });
      }
    }
  }

  console.log(`Found ${debtorCount} Debtors (Customers) and ${creditorCount} Creditors (Suppliers)`);
  console.log("Sample Accounts:", sampleAccounts);
}

previewData();
