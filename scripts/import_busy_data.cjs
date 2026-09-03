
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Busy XML Import...");
    const data = fs.readFileSync("Busy Exported data/SM_20260828_MSAll.DAT", "utf8");

    // 1. Categories
    console.log("Extracting Categories...");
    const itemMatch = data.match(/<Item>([\s\S]*?)<\/Item>/g);
    let categoryNames = new Set();
    
    const itemsData = [];
    
    if (itemMatch) {
        itemMatch.forEach(itemStr => {
            const getVal = (tag) => {
                const match = itemStr.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
                return match ? match[1].replace(/&amp;/g, "&").trim() : null;
            };
            
            const group = getVal("ParentGroup") || "General";
            categoryNames.add(group);
            
            itemsData.push({
                name: getVal("Name") || "Unknown Item",
                sku: getVal("Alias") || getVal("Name") || "UNKNOWN",
                categoryName: group,
                unit: getVal("MainUnit") || "PIECE",
                price: parseFloat(getVal("SalePrice") || getVal("MRP") || "0"),
                stock: parseInt(getVal("OPStockInMainUnit") || "0"),
                hsnCode: getVal("HSNCodeGST") || getVal("HSNCode"),
                taxRate: parseFloat(getVal("TaxCategory")?.replace("%", "") || "0")
            });
        });
    }

    // Insert Categories
    console.log(`Found ${categoryNames.size} Categories. Inserting...`);
    const categoryMap = {};
    for (const cat of categoryNames) {
        const created = await prisma.category.upsert({
            where: { name: cat },
            update: {},
            create: { name: cat }
        });
        categoryMap[cat] = created.id;
    }

    // Insert Products
    console.log(`Found ${itemsData.length} Products. Inserting...`);
    let productCount = 0;
    for (const item of itemsData) {
        try {
            await prisma.product.upsert({
                where: { sku: item.sku },
                update: {
                    name: item.name,
                    categoryId: categoryMap[item.categoryName],
                    unit: item.unit,
                    price: item.price,
                    stock: item.stock,
                    hsnCode: item.hsnCode,
                    taxRate: item.taxRate || 0
                },
                create: {
                    sku: item.sku,
                    name: item.name,
                    categoryId: categoryMap[item.categoryName],
                    unit: item.unit,
                    price: item.price,
                    stock: item.stock,
                    hsnCode: item.hsnCode,
                    taxRate: item.taxRate || 0
                }
            });
            productCount++;
        } catch(e) {
            console.error(`Failed to insert product ${item.sku}:`, e.message);
        }
    }
    console.log(`Successfully imported ${productCount} Products.`);

    // 2. Customers and Suppliers
    console.log("Extracting Accounts...");
    const accMatch = data.match(/<Account>([\s\S]*?)<\/Account>/g);
    
    let custCount = 0;
    let suppCount = 0;
    
    if (accMatch) {
        for (const accStr of accMatch) {
            const getVal = (tag) => {
                const match = accStr.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
                return match ? match[1].replace(/&amp;/g, "&").trim() : null;
            };
            
            const group = getVal("ParentGroup") || "";
            const isCreditor = group.includes("Creditor") || getVal("SupplierType") === "1";
            const isDebtor = group.includes("Debtor");
            
            if (!isCreditor && !isDebtor) continue; 

            const name = getVal("Name") || "Unknown";
            const contact = getVal("Contact") || name;
            const phone = getVal("Mobile") || getVal("TelNo") || null;
            const email = getVal("Email") || null;
            
            const add1 = getVal("Address1") || "";
            const add2 = getVal("Address2") || "";
            const add3 = getVal("Address3") || "";
            const address = [add1, add2, add3].filter(Boolean).join(", ");
            
            const city = getVal("CityName") === "---Others---" ? null : getVal("CityName");
            const state = getVal("StateName") || null;
            const pincode = getVal("PINCode") || null;
            const gst = getVal("GSTNo") || null;
            const creditDays = getVal("CreditDaysForSale") || "30";

            if (isDebtor) {
                try {
                    await prisma.customer.create({
                        data: {
                            company: name,
                            name: contact,
                            phone: phone || "N/A",
                            email,
                            address: address || null,
                            city,
                            state,
                            pincode,
                            gstNumber: gst,
                            paymentTerms: `Net ${creditDays} Days`
                        }
                    });
                    custCount++;
                } catch(e) {}
            } else if (isCreditor) {
                try {
                    await prisma.supplier.create({
                        data: {
                            company: name,
                            name: contact,
                            phone: phone || "N/A",
                            email,
                            address: address || null,
                            city,
                            state,
                            pincode,
                            gstNumber: gst,
                            paymentTerms: `Net ${creditDays} Days`
                        }
                    });
                    suppCount++;
                } catch(e) {}
            }
        }
    }
    console.log(`Successfully imported ${custCount} Customers and ${suppCount} Suppliers.`);
    console.log("Import Complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());

