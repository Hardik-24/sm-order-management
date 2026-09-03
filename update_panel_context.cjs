const fs = require('fs')

let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

// 1. Add context prop
file = file.replace(/const props = defineProps<\{[\s\S]*?isOpen: boolean\n\}>/, 
`const props = defineProps<{
  orderId: string | null
  isOpen: boolean
  context?: 'billing' | 'packing' | 'delivery' | 'overview'
}>`)

// 2. Adjust Order Items table to only show Packing checkboxes if context is 'packing' or 'overview' (wait, the user said only packing)
// Let's change the v-if for packing controls in the table
file = file.replace(/v-if="hasRole\('ADMIN', 'PACKING'\)"/g, `v-if="context === 'packing' && hasRole('ADMIN', 'PACKING')"`)
file = file.replace(/:disabled="!hasRole\('ADMIN', 'PACKING'\)"/g, `:disabled="context !== 'packing' || !hasRole('ADMIN', 'PACKING')"`)

// 3. Re-order sections dynamically
// Right now it's:
// <!-- Order Items -->
// ...
// <!-- Team Sections -->
//   <!-- Sales Section -->
//   <!-- Billing Section -->
//   <!-- Delivery Section -->

// Let's wrap each section in a <template> or just re-order them using v-if or flex order.
// CSS flex order is actually the easiest way!
// Let's add a wrapper with `flex flex-col gap-4` to the Team Sections and Order Items if we want, but they are in a space-y-4 div.
// Wait, CSS `order` property!
// <div class="space-y-4 flex flex-col">
//   <div class="order-1" :class="context === 'packing' ? 'order-first' : ''">Order Items...</div>
//   <div class="order-2" :class="context === 'billing' ? 'order-first' : ''">Billing Section...</div>
// </div>

// But the user specifically said: "as soon as the order information and order items is over... it should appear at top".
// Meaning:
// 1. Order Information (Header, etc)
// 2. Order Items
// 3. The Active Context's Section (Billing / Packing / Delivery)
// 4. The other sections

// So we can do:
// <div class="flex flex-col space-y-4">
//   <div style="order: 1">Order Items</div>
//   <div :style="{ order: context === 'sales' ? 2 : 5 }">Sales</div>
//   <div :style="{ order: context === 'billing' ? 2 : 6 }">Billing</div>
//   <div :style="{ order: context === 'delivery' ? 2 : 7 }">Delivery</div>
// </div>
// Wait, the packing checklist is IN the Order Items! So for packing, Order Items itself is the action section.
// For billing, Billing should be order 2.
// Let's modify the HTML structure.

let html = file.match(/<!-- Order Items -->[\s\S]*?<\/template>/)[0]
file = file.replace(html, '')

// Replace classes in html to support flex order
html = html.replace(/<!-- Order Items -->\s*<div>/m, `<!-- Order Items -->\n              <div class="order-1">`)
html = html.replace(/<!-- Team Sections -->\s*<div class="space-y-4">/m, `<!-- Team Sections -->\n              <div class="contents">`)
html = html.replace(/<!-- Sales Section -->\s*<div class="p-4/m, `<!-- Sales Section -->\n                <div class="p-4 order-4"`)
html = html.replace(/<!-- Billing Section -->\s*<div class="p-4/m, `<!-- Billing Section -->\n                <div class="p-4" :class="context === 'billing' ? 'order-2' : 'order-5'"`)
html = html.replace(/<!-- Delivery Section -->\s*<div class="p-4/m, `<!-- Delivery Section -->\n                <div class="p-4" :class="context === 'delivery' ? 'order-2' : 'order-6'"`)

// Also wrap the whole scrollable area in flex-col
file = file.replace(/<div class="flex-1 overflow-y-auto p-6">\s*<div class="space-y-6">/, 
`<div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-6 flex flex-col">`)

file = file.replace(/<\/div>\s*<!-- Footer -->/m, html + '\n          </div>\n        <!-- Footer -->')

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', file)
