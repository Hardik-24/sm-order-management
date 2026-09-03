const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

// 1. Auto-init in fetchOrder
file = file.replace(/order\.value = data/, 
`order.value = data
    packingForm.value = {
      status: data.packingStatus?.status || 'PENDING',
      items: data.items?.map(i => ({ 
        id: i.id, 
        isPacked: i.packedQuantity === i.quantity,
        quantity: i.quantity,
        sku: i.product?.sku || i.product?.name
      })) || [],
      holdReason: data.packingStatus?.holdReason || ''
    }`)

// 2. Remove initPackingForm method entirely
file = file.replace(/const initPackingForm = \(\) => \{[\s\S]*?showEditing\(\)\n    \}\n  \}\n/m, '')
// Remove watch for packingForm
file = file.replace(/watch\(packingForm, \(\) => \{ if \(showPackingForm\.value\) showEditing\(\) \}, \{ deep: true \}\)\n/m, '')
// Remove showPackingForm from closePanel
file = file.replace(/showPackingForm\.value = false\n/g, '')

// 3. Replace Packing Section template
const newPackingSection = `
              <!-- Packing Section -->
              <div class="p-4 bg-white border border-gray-200 rounded-lg border-l-4 border-l-orange-500 shadow-sm">
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Packing Checklist</h4>
                    <StatusBadge :status="order.packingStatus?.status || 'NOT_STARTED'" />
                  </div>
                </div>
                
                <div class="space-y-2 mb-4">
                  <div v-for="(item, idx) in packingForm.items" :key="item.id" class="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100 transition-colors" :class="{ 'bg-green-50/50 border-green-200': item.isPacked }">
                    <span class="truncate pr-2 transition-all" :class="{ 'line-through text-gray-400': item.isPacked }">
                      <span class="font-bold" :class="item.isPacked ? 'text-gray-400' : 'text-gray-900'">{{ item.quantity }}x</span> 
                      {{ item.sku }}
                    </span>
                    <input 
                      type="checkbox" 
                      :checked="item.isPacked" 
                      @change="e => handlePackingChange(idx, e)" 
                      class="rounded border-gray-300 text-[#1a5c4c] focus:ring-[#1a5c4c] w-5 h-5 cursor-pointer" 
                      :disabled="!hasRole('ADMIN', 'PACKING')"
                    />
                  </div>
                </div>

                <div v-if="packingForm.status === 'ON_HOLD'" class="mb-3">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Reason for putting on hold</label>
                  <textarea v-model="packingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] resize-none" placeholder="Explain why this order is on hold..."></textarea>
                </div>

                <div class="flex items-center justify-between mt-2 pt-4 border-t border-gray-100" v-if="hasRole('ADMIN', 'PACKING')">
                  <select v-model="packingForm.status" class="text-xs border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white">
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="PACKED">PACKED</option>
                      <option value="ON_HOLD">ON HOLD</option>
                  </select>
                  <button @click="updatePacking" class="px-4 py-1.5 text-xs font-medium bg-[#1a5c4c] text-white rounded shadow-sm hover:bg-[#1a5c4c]/90">
                    Save Progress
                  </button>
                </div>
              </div>`

file = file.replace(/<!-- Packing Section -->[\s\S]*?<!-- Delivery Section -->/m, newPackingSection + '\n\n              <!-- Delivery Section -->')

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', file)
