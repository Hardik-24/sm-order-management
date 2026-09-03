
const fs = require("fs");
const xml2js = require("xml2js");

const xml = fs.readFileSync("Busy Exported data/SM_20260828_MSAll.DAT", "utf8");

xml2js.parseString(xml, (err, result) => {
    if (err) {
        console.error(err);
        return;
    }
    const accounts = result.BusyData.Accounts[0].Account;
    // Find a customer account (not a bank or system account)
    // usually Sundry Debtors or a specific group. Let just get the first one that has an Address.
    const customer = accounts.find(acc => acc.Address && acc.Address[0].Address1 && acc.Address[0].Address1[0]);
    
    if (customer) {
        console.log("Customer found:", JSON.stringify(customer, null, 2));
    } else {
        console.log("No customer with address found. First account:", JSON.stringify(accounts[10], null, 2));
    }
});

