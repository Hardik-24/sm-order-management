const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/BillingTable.vue', 'utf8')

// Remove everything from <!-- Skeleton Loading State --> up to <!-- Real Data --> and its template tag
file = file.replace(/<!-- Skeleton Loading State -->[\s\S]*?<!-- Real Data -->\s*<template v-else>/, '')
// Remove the closing </template> we added earlier
file = file.replace(/<\/template>\s*<\/tbody>/, '</tbody>')
// Also remove <tr v-if="!pending && !orders?.length"> and replace with <tr v-if="!orders?.length">
file = file.replace(/<tr v-if="!pending && !orders\?\.length">/, '<tr v-if="!orders?.length">')

fs.writeFileSync('app/components/dashboard/BillingTable.vue', file)
