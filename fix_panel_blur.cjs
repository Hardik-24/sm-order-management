const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

// Remove skeleton block
file = file.replace(/<!-- Skeleton Loader -->[\s\S]*?<\/div>\s*<template v-else-if="order">/, '<template v-if="order">')

// Add pulsing blur overlay inside the template block
const headerMatch = '<!-- Header -->'
const blurOverlay = `<!-- Loading Overlay -->
        <div v-if="isLoading" class="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 pointer-events-none animate-pulse transition-all duration-300"></div>\n\n        <!-- Header -->`

file = file.replace(headerMatch, blurOverlay)

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', file)
