
const fs = require('fs');
const files = [
  'app/components/dashboard/BillingTable.vue',
  'app/components/dashboard/DeliveryTable.vue',
  'app/components/dashboard/OrderTable.vue',
  'app/components/dashboard/PackingTable.vue'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('pointer-events-none', '');
  fs.writeFileSync(file, content);
});

let odp = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8');
odp = odp.replace(/pointer-events-none animate-pulse transition-all/g, 'pointer-events-auto animate-pulse transition-all');
fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', odp);
console.log('Fixed pointers!');

