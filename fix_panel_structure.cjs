const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

const startIdx = file.indexOf('<!-- Scrollable Content -->')
const prefix = file.slice(0, startIdx)

const correctStructure = `<!-- Scrollable Content -->
        <div class="flex-grow overflow-y-auto bg-white p-6">
          
          <!-- DETAILS TAB -->
          <div v-if="activeTab === 'DETAILS'" class="space-y-8 flex flex-col">
            
            <!-- Order Information -->
            <div>
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Information</h3>
                <button v-if="hasRole('ADMIN', 'SALES')" class="text-xs font-medium text-[#1a5c4c] flex items-center gap-1 hover:underline">
                  <Edit class="w-3 h-3" /> Edit
                </button>
              </div>
              <div class="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span class="block text-xs text-gray-500 mb-1">Customer</span>
                  <span class="font-medium text-gray-900">{{ order.customer?.name || '—' }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">Salesperson</span>
                  <span class="font-medium text-gray-900">{{ order.salesperson?.name || '—' }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">Phone</span>
                  <span class="text-gray-900">{{ order.customer?.phone || '—' }}</span>
                </div>
                <div>
                  <span class="block text-xs text-gray-500 mb-1">Order Date</span>
                  <span class="text-gray-900">{{ formatDate(order.createdAt) || '—' }}</span>
                </div>
                <div class="col-span-2">
                  <span class="block text-xs text-gray-500 mb-1">Delivery Address</span>
                  <span class="text-gray-900">{{ order.deliveryAddress || '—' }}</span>
                </div>
                <div class="col-span-2">
                  <span class="block text-xs text-gray-500 mb-1">Payment Terms</span>
                  <span class="text-gray-900">{{ order.paymentTerms || '—' }}</span>
                </div>
                <div class="col-span-2">
                  <span class="block text-xs text-gray-500 mb-1">Notes</span>
                  <span class="text-gray-900">{{ order.notes || '—' }}</span>
                </div>
              </div>
            </div>

            <!-- Order Items -->
            <div class="order-1">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Items</h3>
                <StatusBadge v-if="context === 'packing' && hasRole('ADMIN', 'PACKING')" :status="order.packingStatus?.status || 'NOT_STARTED'" />
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
                          :disabled="context !== 'packing' || !hasRole('ADMIN', 'PACKING')"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                
                <!-- Packing Controls -->
                <div class="p-4 bg-gray-50 border-t border-gray-200" v-if="context === 'packing' && hasRole('ADMIN', 'PACKING')">
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
            </div>

            <!-- Team Sections -->
            <div class="contents">
              
              <!-- Sales Section -->
              <div class="p-4 bg-white border border-gray-200 rounded-lg border-l-4 border-l-green-500 shadow-sm flex items-start justify-between order-4">
                <div>
                  <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sales</h4>
                  <p class="text-sm text-gray-900 font-medium flex items-center gap-2">
                    Confirmed <span class="text-green-500">✓</span>
                  </p>
                  <p class="text-xs text-gray-500 mt-1">By {{ order.salesperson?.name || 'System' }} on {{ formatDateTime(order.createdAt) }}</p>
                </div>
              </div>

              <!-- Billing Section -->
              <div class="p-4 bg-white border border-gray-200 rounded-lg border-l-4 border-l-purple-500 shadow-sm" :class="context === 'billing' ? 'order-2' : 'order-5'">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billing</h4>
                    <div class="flex items-center gap-2 mb-1">
                      <StatusBadge :status="order.billingStatus?.status || 'NOT_STARTED'" />
                      <span v-if="order.billingStatus?.invoiceNumber" class="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {{ order.billingStatus.invoiceNumber }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Value: <span class="font-medium text-gray-900">{{ formatCurrency(order.totalAmount || 0) }}</span></p>
                  </div>
                  <button v-if="!showBillingForm && hasRole('ADMIN', 'BILLING')" @click="initBillingForm" class="text-xs font-medium text-[#1a5c4c] hover:underline">
                    Edit
                  </button>
                </div>
                
                <div v-if="showBillingForm" class="mt-4 pt-4 border-t border-gray-100 bg-gray-50 -mx-4 px-4 pb-2">
                  <div class="mb-3">
                    <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select v-model="billingForm.status" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c]">
                      <option value="PENDING">PENDING</option>
                      <option value="GENERATED">GENERATED</option>
                      <option value="ON_HOLD">ON HOLD</option>
                    </select>
                  </div>
                  <div v-if="billingForm.status === 'GENERATED'" class="mb-3">
                    <label class="block text-xs font-medium text-gray-700 mb-1">Invoice Number</label>
                    <input type="text" v-model="billingForm.invoiceNumber" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c]" placeholder="e.g. INV-2026-001" />
                  </div>
                  <div v-if="billingForm.status === 'ON_HOLD'" class="mb-3">
                    <label class="block text-xs font-medium text-gray-700 mb-1">Reason for putting on hold</label>
                    <textarea v-model="billingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] resize-none" placeholder="Explain why this order is on hold..."></textarea>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button @click="showBillingForm = false; billingForm.holdReason = ''; hide()" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                    <button @click="updateBilling" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                  </div>
                </div>
              </div>

              <!-- Delivery Section -->
              <div class="p-4 bg-white border border-gray-200 rounded-lg border-l-4 border-l-blue-500 shadow-sm" :class="context === 'delivery' ? 'order-2' : 'order-6'">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery</h4>
                    <div class="flex items-center gap-2 mb-1">
                      <StatusBadge :status="order.deliveryStatus?.status || 'NOT_STARTED'" />
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Driver: <span class="font-medium text-gray-900">{{ order.deliveryDriver || 'Unassigned' }}</span></p>
                    <p class="text-xs text-gray-500 mt-1">Dispatch: {{ order.dispatchDate ? formatDate(order.dispatchDate) : '-' }} | ETA: {{ order.eta ? formatDate(order.eta) : '-' }}</p>
                  </div>
                  <button v-if="!showDeliveryForm && hasRole('ADMIN', 'DELIVERY')" @click="initDeliveryForm" class="text-xs font-medium text-[#1a5c4c] hover:underline">
                    Edit
                  </button>
                </div>
                
                <div v-if="showDeliveryForm" class="mt-4 pt-4 border-t border-gray-100 bg-gray-50 -mx-4 px-4 pb-2">
                  <div class="mb-3">
                    <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select v-model="deliveryForm.status" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c]">
                      <option value="WAITING">WAITING</option>
                      <option value="DISPATCHED">DISPATCHED</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="ON_HOLD">ON HOLD</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="block text-xs font-medium text-gray-700 mb-1">Driver Name</label>
                    <input type="text" v-model="deliveryForm.driverName" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c]" placeholder="Assign a driver" />
                  </div>
                  <div class="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Dispatch Date</label>
                      <input type="date" v-model="deliveryForm.dispatchDate" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c]" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">ETA</label>
                      <input type="date" v-model="deliveryForm.eta" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c]" />
                    </div>
                  </div>
                  <div v-if="deliveryForm.status === 'ON_HOLD'" class="mb-3">
                    <label class="block text-xs font-medium text-gray-700 mb-1">Reason for putting on hold</label>
                    <textarea v-model="deliveryForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] resize-none" placeholder="Explain why this order is on hold..."></textarea>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button @click="showDeliveryForm = false; deliveryForm.holdReason = ''; hide()" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                    <button @click="updateDelivery" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
          <!-- END DETAILS TAB -->

          <!-- TIMELINE TAB (Placeholder) -->
          <div v-else-if="activeTab === 'TIMELINE'" class="text-sm text-gray-500">
            <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Timeline</h3>
            <ul class="space-y-4 border-l border-gray-200 ml-2 pl-4">
              <li v-for="t in order.timeline" :key="t.id" class="relative">
                <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-[#1a5c4c] rounded-full ring-4 ring-white"></span>
                <p class="font-medium text-gray-900">{{ t.action }}</p>
                <p v-if="t.description" class="mt-1 text-gray-600">{{ t.description }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ formatDateTime(t.createdAt) }} <span v-if="t.performedBy">by {{ t.performedBy.name }}</span></p>
              </li>
            </ul>
          </div>

          <!-- NOTES TAB (Placeholder) -->
          <div v-else-if="activeTab === 'NOTES'" class="text-sm text-gray-500">
            <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Internal Notes</h3>
            <p v-if="order.notes">{{ order.notes }}</p>
            <p v-else class="italic text-gray-400">No internal notes for this order.</p>
          </div>

        </div>
      </template>
    </div>
  </div>
</template>
`

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', prefix + correctStructure)
