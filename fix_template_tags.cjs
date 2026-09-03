const fs = require('fs')
const tables = [
  'app/components/dashboard/BillingTable.vue',
  'app/components/dashboard/PackingTable.vue',
  'app/components/dashboard/DeliveryTable.vue'
]

for (const table of tables) {
  let content = fs.readFileSync(table, 'utf8')
  // Remove rogue </template> if it appears right after </tr>
  content = content.replace(/<\/tr>\s*<\/template>/g, '</tr>')
  fs.writeFileSync(table, content)
}
