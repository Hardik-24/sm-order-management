const fs = require('fs')

let file = fs.readFileSync('app/components/dashboard/OrderDetailPanel.vue', 'utf8')

// 1. Add activeFlowStep to the script
const scriptInjection = `
const activeFlowStep = ref(props.context ? props.context.toUpperCase() : 'SALES')
watch(() => props.context, (newVal) => {
  if (newVal && newVal !== 'overview') activeFlowStep.value = newVal.toUpperCase()
})
`
// Find a good place to inject it, like after `const isPanelOpen = ref(false)` or `const activeTab = ref('DETAILS')`
file = file.replace(/const activeTab = ref\('DETAILS'\)/, `const activeTab = ref('DETAILS')\n${scriptInjection}`)

// We also need some helper functions for the step colors/icons
const helperFunctions = `
const getStepStatus = (step) => {
  if (!order.value) return 'PENDING'
  switch(step) {
    case 'SALES': return 'COMPLETED'
    case 'BILLING': return order.value.billingStatus?.status || 'PENDING'
    case 'PACKING': return order.value.packingStatus?.status || 'NOT_STARTED'
    case 'DELIVERY': return order.value.deliveryStatus?.status || 'NOT_STARTED'
    default: return 'PENDING'
  }
}

const getStepColor = (step) => {
  const status = getStepStatus(step)
  if (['COMPLETED', 'GENERATED', 'PACKED', 'DELIVERED', 'DISPATCHED'].includes(status)) return 'text-green-600 border-green-600 bg-green-50'
  if (status === 'IN_PROGRESS' || status === 'WAITING') return 'text-blue-600 border-blue-600 bg-blue-50'
  if (status === 'ON_HOLD') return 'text-orange-600 border-orange-600 bg-orange-50'
  return 'text-gray-400 border-gray-300 bg-white'
}
`
// inject before updatePacking
file = file.replace(/const updatePacking = async/, `${helperFunctions}\nconst updatePacking = async`)


// 2. Replace the old layout. We will grab the template and rebuild it.
const templateStartIdx = file.indexOf('<template>')
const scriptPart = file.slice(0, templateStartIdx)

const templatePart = `
<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden pointer-events-none">
    <div class="absolute inset-0 bg-black/20 pointer-events-auto transition-opacity" @click="closePanel"></div>
    
    <div class="absolute inset-y-0 right-0 max-w-[450px] w-full bg-white shadow-xl pointer-events-auto flex flex-col h-full overflow-hidden transform transition-transform duration-300">
      
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="text-gray-500">Loading...</span>
      </div>

      <template v-else-if="order">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white flex-shrink-0">
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-bold text-gray-900">{{ order.orderNumber }}</h2>
              <StatusBadge 
                :status="order.overallStatus" 
                :display="getDisplayStatus(order)" 
                :class="getOverallColor(order)" 
              />
            </div>
          <div class="flex items-center gap-2">
            <button class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
              <Printer class="w-5 h-5" />
            </button>
            <button class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
              <Download class="w-5 h-5" />
            </button>
            <button class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
              <MoreHorizontal class="w-5 h-5" />
            </button>
            <button @click="closePanel" class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 ml-2">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Sub-header -->
        <div class="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div class="flex justify-between items-end">
            <div>
              <p class="text-sm font-medium text-gray-900">{{ order.customer?.name }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ order.items?.length || 0 }} items</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-[#1a5c4c]">{{ formatCurrency(order.totalAmount || 0) }}</p>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="px-6 border-b border-gray-200 flex gap-6 text-sm font-medium text-gray-500 flex-shrink-0">
          <button 
            v-for="tab in ['DETAILS', 'TIMELINE', 'NOTES']" 
            :key="tab"
            @click="activeTab = tab as any"
            :class="[
              'py-3 border-b-2 transition-colors',
              activeTab === tab ? 'border-[#1a5c4c] text-[#1a5c4c]' : 'border-transparent hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-grow overflow-y-auto bg-white p-6">
          
          <!-- DETAILS TAB -->
          <div v-if="activeTab === 'DETAILS'" class="space-y-8 flex flex-col">
            
            <!-- Order Information Grid -->
            <div>
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Information</h3>
                <button v-if="hasRole('ADMIN', 'SALES')" class="text-xs font-medium text-[#1a5c4c] flex items-center gap-1 hover:underline">
                  <Edit class="w-3 h-3" /> Edit
                </button>
              </div>
              <div class="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Customer</span>
                  <span class="font-medium text-gray-900">{{ order.customer?.name || '—' }}</span>
                </div>
                <div>
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Phone</span>
                  <span class="text-gray-900">{{ order.customer?.phone || '—' }}</span>
                </div>
                <div class="col-span-2">
                  <span class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Delivery Address</span>
                  <span class="text-gray-900">{{ order.deliveryAddress || '—' }}</span>
                </div>
              </div>
            </div>

            <!-- Flow Stepper -->
            <div>
              <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6">Order Flow</h3>
              
              <div class="relative flex items-start justify-between mb-4">
                <!-- Background Line -->
                <div class="absolute top-4 left-[10%] right-[10%] h-0.5 bg-gray-200 -z-10"></div>
                
                <!-- Steps -->
                <button 
                  v-for="step in [
                    { id: 'SALES', label: 'Sales', icon: 'FileText' },
                    { id: 'BILLING', label: 'Billing', icon: 'Receipt' },
                    { id: 'PACKING', label: 'Packing', icon: 'Box' },
                    { id: 'DELIVERY', label: 'Delivery', icon: 'Truck' }
                  ]" 
                  :key="step.id"
                  @click="activeFlowStep = step.id"
                  class="flex flex-col items-center gap-2 bg-white px-2 cursor-pointer group outline-none"
                >
                  <!-- Icon Circle -->
                  <div 
                    class="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200"
                    :class="[
                      getStepColor(step.id),
                      activeFlowStep === step.id ? 'ring-4 ring-gray-100 scale-110 shadow-sm' : 'opacity-70 group-hover:opacity-100 group-hover:scale-105'
                    ]"
                  >
                    <!-- Wait, dynamic component mapping is tricky without explicit imports for every icon. We'll use simple icons or just check id -->
                    <Check v-if="step.id === 'SALES'" class="w-4 h-4" />
                    <Receipt v-else-if="step.id === 'BILLING'" class="w-4 h-4" />
                    <Box v-else-if="step.id === 'PACKING'" class="w-4 h-4" />
                    <Truck v-else-if="step.id === 'DELIVERY'" class="w-4 h-4" />
                  </div>
                  <!-- Label -->
                  <span 
                    class="text-[10px] font-bold uppercase tracking-wider transition-colors"
                    :class="activeFlowStep === step.id ? 'text-gray-900' : 'text-gray-400'"
                  >
                    {{ step.label }}
                  </span>
                </button>
              </div>

              <!-- Active Flow Panel -->
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all">
                <!-- SALES -->
                <div v-if="activeFlowStep === 'SALES'">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Order Confirmed</p>
                      <p class="text-xs text-gray-500 mt-1">Processed by {{ order.salesperson?.name || 'System' }} on {{ formatDateTime(order.createdAt) }}</p>
                    </div>
                    <StatusBadge status="CONFIRMED" display="Confirmed" class="bg-green-100 text-green-700" />
                  </div>
                </div>

                <!-- BILLING -->
                <div v-else-if="activeFlowStep === 'BILLING'">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Billing Status</p>
                      <p class="text-xs text-gray-500 mt-1">
                        Invoice: <span class="font-mono text-gray-900">{{ order.billingStatus?.invoiceNumber || 'Not generated' }}</span>
                      </p>
                    </div>
                    <StatusBadge :status="order.billingStatus?.status || 'PENDING'" />
                  </div>
                  
                  <div class="flex flex-col gap-2 items-stretch" v-if="hasRole('ADMIN', 'BILLING')">
                    <button 
                      v-if="order.billingStatus?.status !== 'GENERATED'"
                      @click="markBillGenerated" 
                      class="py-2 text-xs font-medium bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90 shadow-sm w-full flex justify-center items-center gap-2"
                    >
                      <Receipt class="w-3.5 h-3.5" /> Mark as Generated
                    </button>
                    
                    <button 
                      v-if="!showBillingForm" 
                      @click="showBillingForm = true" 
                      class="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:underline text-center mt-1"
                    >
                      Advanced Options...
                    </button>
                  </div>
                  
                  <!-- Advanced Billing Form -->
                  <div v-if="showBillingForm" class="mt-4 pt-4 border-t border-gray-200">
                    <div class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                      <select v-model="billingForm.status" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white">
                        <option value="PENDING">PENDING</option>
                        <option value="GENERATED">GENERATED</option>
                        <option value="ON_HOLD">ON HOLD</option>
                      </select>
                    </div>
                    <div v-if="billingForm.status === 'GENERATED'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Invoice Number</label>
                      <input type="text" v-model="billingForm.invoiceNumber" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white" placeholder="e.g. INV-2026-001" />
                    </div>
                    <div v-if="billingForm.status === 'ON_HOLD'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Hold Reason</label>
                      <textarea v-model="billingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white resize-none" placeholder="Reason..."></textarea>
                    </div>
                    <div class="flex justify-end gap-2">
                      <button @click="showBillingForm = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                      <button @click="updateBilling" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                    </div>
                  </div>
                </div>

                <!-- PACKING -->
                <div v-else-if="activeFlowStep === 'PACKING'">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Packing Status</p>
                      <p class="text-xs text-gray-500 mt-1">
                        Use the checkboxes in the Order Items list below to mark items as packed.
                      </p>
                    </div>
                    <StatusBadge :status="order.packingStatus?.status || 'NOT_STARTED'" />
                  </div>
                  
                  <div v-if="hasRole('ADMIN', 'PACKING')">
                    <div v-if="packingForm.status === 'ON_HOLD'" class="mb-3">
                      <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Hold Reason</label>
                      <textarea v-model="packingForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white resize-none" placeholder="Reason..."></textarea>
                    </div>
                    <div class="flex items-center gap-2">
                      <select v-model="packingForm.status" class="w-1/3 text-xs border-gray-300 rounded p-2 focus:ring-[#1a5c4c] bg-white">
                          <option value="PENDING">PENDING</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="PACKED">PACKED</option>
                          <option value="ON_HOLD">ON HOLD</option>
                      </select>
                      <button @click="updatePacking" class="flex-1 py-2 text-xs font-medium bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90 shadow-sm">
                        Save Packing Progress
                      </button>
                    </div>
                  </div>
                </div>

                <!-- DELIVERY -->
                <div v-else-if="activeFlowStep === 'DELIVERY'">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Delivery Status</p>
                      <p class="text-xs text-gray-500 mt-1">
                        Driver: <span class="font-medium text-gray-900">{{ order.deliveryDriver || 'Unassigned' }}</span>
                      </p>
                    </div>
                    <StatusBadge :status="order.deliveryStatus?.status || 'NOT_STARTED'" />
                  </div>
                  
                  <div v-if="hasRole('ADMIN', 'DELIVERY')" class="flex flex-col gap-2">
                    <button 
                      v-if="!showDeliveryForm" 
                      @click="showDeliveryForm = true" 
                      class="py-2 text-xs font-medium border border-[#1a5c4c] text-[#1a5c4c] bg-white rounded hover:bg-gray-50 shadow-sm w-full flex justify-center items-center gap-2"
                    >
                      <Truck class="w-3.5 h-3.5" /> Update Delivery Details
                    </button>
                    
                    <!-- Delivery Form -->
                    <div v-if="showDeliveryForm" class="mt-2 pt-4 border-t border-gray-200">
                      <div class="mb-3">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
                        <select v-model="deliveryForm.status" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white">
                          <option value="WAITING">WAITING</option>
                          <option value="DISPATCHED">DISPATCHED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="ON_HOLD">ON HOLD</option>
                        </select>
                      </div>
                      <div class="mb-3">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Driver Name</label>
                        <input type="text" v-model="deliveryForm.driverName" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white" placeholder="Assign a driver" />
                      </div>
                      <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Dispatch Date</label>
                          <input type="date" v-model="deliveryForm.dispatchDate" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white" />
                        </div>
                        <div>
                          <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">ETA</label>
                          <input type="date" v-model="deliveryForm.eta" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white" />
                        </div>
                      </div>
                      <div v-if="deliveryForm.status === 'ON_HOLD'" class="mb-3">
                        <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Hold Reason</label>
                        <textarea v-model="deliveryForm.holdReason" rows="2" class="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-[#1a5c4c] bg-white resize-none"></textarea>
                      </div>
                      <div class="flex justify-end gap-2">
                        <button @click="showDeliveryForm = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                        <button @click="updateDelivery" class="px-3 py-1.5 text-xs bg-[#1a5c4c] text-white rounded hover:bg-[#1a5c4c]/90">Save</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Order Items List -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order Items</h3>
              </div>
              <div class="border border-gray-200 rounded-lg overflow-hidden">
                <table class="w-full text-left text-sm">
                  <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th class="px-4 py-2 font-medium">Product</th>
                      <th class="px-4 py-2 font-medium text-right">Qty</th>
                      <th v-if="activeFlowStep === 'PACKING'" class="px-4 py-2 font-medium text-center">Packed</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="(item, idx) in order.items" :key="item.id" class="bg-white transition-colors" :class="{ 'bg-green-50/30': activeFlowStep === 'PACKING' && packingForm.items[idx]?.isPacked }">
                      <td class="px-4 py-3">
                        <div class="font-medium truncate max-w-[150px]" :class="activeFlowStep === 'PACKING' && packingForm.items[idx]?.isPacked ? 'text-gray-400 line-through' : 'text-gray-900'">
                          {{ item.product?.sku }}
                        </div>
                        <div class="text-xs text-gray-400 truncate max-w-[150px]">{{ item.product?.name }}</div>
                      </td>
                      <td class="px-4 py-3 text-right font-medium text-gray-900">{{ item.quantity }}</td>
                      <td v-if="activeFlowStep === 'PACKING'" class="px-4 py-3 text-center">
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

fs.writeFileSync('app/components/dashboard/OrderDetailPanel.vue', scriptPart + templatePart)
