const fs = require('fs')
let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

const oldBlock = `<div v-if="showDeliveryForm">
                      <div class="mb-3">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                        <select v-model="deliveryForm.status" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white">
                          <option value="WAITING">WAITING</option>
                          <option value="DISPATCHED">DISPATCHED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="ON_HOLD">ON HOLD</option>
                        </select>
                      </div>
                      <div v-if="deliveryForm.status === 'ON_HOLD'" class="mb-3">`

const newBlock = `<div v-if="showDeliveryForm">
                      <div class="mb-3">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Driver Name</label>
                        <input type="text" v-model="deliveryForm.driverName" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white" placeholder="Assign a driver" />
                      </div>
                      <div class="mb-3">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                        <select v-model="deliveryForm.status" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white">
                          <option value="WAITING">WAITING</option>
                          <option value="DISPATCHED">DISPATCHED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="ON_HOLD">ON HOLD</option>
                        </select>
                      </div>
                      <div v-if="deliveryForm.status === 'ON_HOLD'" class="mb-3">`

file = file.replace(oldBlock, newBlock)
fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', file)
