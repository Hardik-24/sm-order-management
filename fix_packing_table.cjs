const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/PackingTable.vue', 'utf8')

// Fix table headers
file = file.replace(/<th class="px-6 py-4 whitespace-nowrap">Order ID<\/th>[\s\S]*?<th class="px-6 py-4 whitespace-nowrap"><\/th>/, 
`<th class="px-6 py-4 whitespace-nowrap">Order ID</th>
            <th class="px-6 py-4 whitespace-nowrap">Customer</th>
            <th class="px-6 py-4 whitespace-nowrap text-center">Items (Total)</th>
            <th class="px-6 py-4 whitespace-nowrap text-center">Packing Progress</th>
            <th class="px-6 py-4 whitespace-nowrap text-center">Status</th>
            <th class="px-6 py-4 whitespace-nowrap text-right">Action</th>`)

// Fix table body
file = file.replace(/<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ order\.items\?\.length \|\| 0 }}<\/td>[\s\S]*?<td class="px-6 py-4 whitespace-nowrap text-right text-gray-400">[\s\S]*?<\/td>/m, 
`<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{{ order.items?.length || 0 }}</td>
              
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                {{ order.items?.filter(i => i.packedQuantity === i.quantity).length || 0 }} / {{ order.items?.length || 0 }} SKUs
              </td>
              
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <StatusBadge v-if="order.packingStatus?.status" :status="order.packingStatus.status" class="mx-auto" />
                <span v-else class="text-gray-400 block text-center">-</span>
              </td>
              
              <td class="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                <button @click.stop="emit('select', order.id)" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90 transition-colors">
                  Pack Order
                </button>
              </td>`)

fs.writeFileSync('app/components/dashboard/PackingTable.vue', file)
