const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

// Replace Order Items table
const newOrderItems = `
              <!-- Order Items -->
              <div>
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Items</h3>
                  <StatusBadge v-if="hasRole('ADMIN', 'PACKING')" :status="order.packingStatus?.status || 'NOT_STARTED'" />
                </div>
                <div class="border border-gray-200 rounded-lg overflow-hidden">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th class="px-4 py-2 font-medium">Product</th>
                        <th class="px-4 py-2 font-medium text-right">Qty</th>
                        <th class="px-4 py-2 font-medium text-center">Packed</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="(item, idx) in order.items" :key="item.id" class="bg-white transition-colors" :class="{ 'bg-green-50/30': packingForm.items[idx]?.isPacked }">
                        <td class="px-4 py-3">
                          <div class="font-medium truncate max-w-[150px]" :class="packingForm.items[idx]?.isPacked ? 'text-gray-400 line-through' : 'text-gray-900'">{{ item.product?.sku }}</div>
                          <div class="text-xs text-gray-400 truncate max-w-[150px]">{{ item.product?.name }}</div>
                        </td>
                        <td class="px-4 py-3 text-right font-medium text-gray-900">{{ item.quantity }}</td>
                        <td class="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            :checked="packingForm.items[idx]?.isPacked" 
                            @change="e => handlePackingChange(idx, e)" 
                            class="rounded border-gray-300 text-[#1a5c4c] focus:ring-[#1a5c4c] w-5 h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                            :disabled="!hasRole('ADMIN', 'PACKING')"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <!-- Packing Controls -->
                  <div class="p-4 bg-gray-50 border-t border-gray-200" v-if="hasRole('ADMIN', 'PACKING')">
                    <div v-if="packingForm.status === 'ON_HOLD'" class="mb-3">
                      <label class="block text-xs font-medium text-gray-700 mb-1">Reason for putting on hold</label>
                      <textarea v-model="packingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] resize-none" placeholder="Explain why this order is on hold..."></textarea>
                    </div>
                    <div class="flex items-center justify-between">
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
                  </div>
                </div>
              </div>`

file = file.replace(/<!-- Order Items -->[\s\S]*?<!-- Team Sections -->/m, newOrderItems + '\n\n              <!-- Team Sections -->')

// Delete the old separate Packing Section
file = file.replace(/<!-- Packing Section -->[\s\S]*?<!-- Delivery Section -->/m, '<!-- Delivery Section -->')

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', file)
