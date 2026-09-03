const fs = require('fs');

const fn = `function calculateOverallStatus(billing: string, packing: string, delivery: string) {
  if (delivery === 'DELIVERED') return 'DELIVERED';
  if (delivery === 'DISPATCHED' || delivery === 'ASSIGNED') return 'DISPATCHED';
  if (billing === 'GENERATED' && packing === 'PACKED') return 'READY';
  if (billing !== 'PENDING' || packing !== 'PENDING') return 'PROCESSING';
  return 'CONFIRMED';
}`;

['billing.patch.ts', 'packing.patch.ts', 'delivery.patch.ts'].forEach(f => {
  let p = 'server/api/orders/[id]/' + f;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/function calculateOverallStatus[\s\S]*?return 'AWAITING_BOTH'\s*\}/, fn);
  fs.writeFileSync(p, c);
});
