const fs = require('fs');

async function test() {
  const rawData = fs.readFileSync('D:\\App Development\\Python automation BUSY\\stock_data.json', 'utf8');
  const items = JSON.parse(rawData);
  
  console.log(`Sending ${items.length} items to Vercel...`);
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://sm-order-management.vercel.app/api/inventory/webhook', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer super-secret-key-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ items })
    });
    
    const text = await response.text();
    console.log(`Response Status: ${response.status}`);
    console.log(`Time taken: ${Date.now() - startTime}ms`);
    console.log(`Response Body: ${text}`);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
