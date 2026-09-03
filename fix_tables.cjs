const fs = require('fs')
const tables = [
  'app/components/dashboard/PackingTable.vue',
  'app/components/dashboard/DeliveryTable.vue'
]

for (const table of tables) {
  let file = fs.readFileSync(table, 'utf8')
  file = file.replace(/<!-- Skeleton Loading State -->[\s\S]*?<!-- Real Data -->\s*<template v-else>/, '')
  file = file.replace(/<\/template>\s*<\/tbody>/, '</tbody>')
  file = file.replace(/<tr v-if="!pending && !orders\?\.length">/, '<tr v-if="!orders?.length">')
  fs.writeFileSync(table, file)
}
