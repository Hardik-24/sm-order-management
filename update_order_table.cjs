const fs = require('fs')

let code = fs.readFileSync('app/components/dashboard/OrderTable.vue', 'utf8')

const startIndex = code.indexOf('<div class="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between bg-white relative">')
const tableStartIndex = code.indexOf('<div class="overflow-x-auto">')

if (startIndex === -1 || tableStartIndex === -1) {
  console.log("Could not find blocks")
  process.exit(1)
}

const newHeader = `<div class="p-4 border-b border-gray-200 bg-white relative flex flex-col gap-4">
      <!-- Search and Date Row -->
      <div class="flex flex-wrap gap-4 items-center justify-between">
        <div class="relative w-full md:w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search class="h-4 w-4 text-gray-400" />
          </div>
          <input 
            :value="search"
            @input="e => emit('update:search', (e.target as HTMLInputElement).value)"
            type="text" 
            placeholder="Search orders..."
            class="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]"
          />
        </div>
        
        <div class="flex items-center gap-2 w-full md:w-auto ml-auto">
          <!-- Date Range Filter (Floating Popover) -->
          <div class="relative" ref="dateFilterRef">
            <button 
              @click="isDatePickerOpen = !isDatePickerOpen; isFiltersOpen = false"
              class="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              :class="{ 'border-[#1a5c4c] ring-1 ring-[#1a5c4c]': startDate || endDate }"
            >
              <Calendar class="w-4 h-4 text-gray-500" :class="{ 'text-[#1a5c4c]': startDate || endDate }" />
              {{ dateButtonText }}
            </button>
  
            <!-- Date Popover Content -->
            <div v-if="isDatePickerOpen" class="absolute right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl z-50 w-72 max-h-[80vh] flex flex-col transform translate-z-0">
              <div class="p-4 border-b border-gray-100 flex-shrink-0">
                <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Date Range</h4>
              </div>
              
              <div class="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input 
                    :value="startDate"
                    @input="e => emit('update:startDate', (e.target as HTMLInputElement).value)"
                    type="date" 
                    class="w-full text-sm border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">End Date</label>
                  <input 
                    :value="endDate"
                    @input="e => emit('update:endDate', (e.target as HTMLInputElement).value)"
                    type="date" 
                    class="w-full text-sm border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" 
                  />
                </div>
              </div>
  
              <div class="p-4 pt-3 bg-gray-50 rounded-b-xl border-t border-gray-100 flex justify-between items-center flex-shrink-0">
                <button @click="emit('update:startDate', ''); emit('update:endDate', '')" class="text-xs text-red-600 hover:underline">Clear</button>
                <button @click="isDatePickerOpen = false" class="px-3 py-1.5 bg-[#1a5c4c] text-white text-xs font-medium rounded hover:bg-[#1a5c4c]/90 transition-colors">Apply</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Individual Filters Row -->
      <div class="flex flex-wrap items-center gap-3 w-full bg-gray-50/50 p-2 rounded-lg border border-gray-100">
        <select :value="status" @change="e => emit('update:status', (e.target as HTMLSelectElement).value)" class="text-sm border border-gray-300 rounded-md bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] shadow-sm min-w-[140px]">
          <option value="">Status: All</option>
          <option value="CONFIRMED">Awaiting Billing & Packing</option>
          <option value="PROCESSING">Action Required</option>
          <option value="READY">Ready</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="DELIVERED">Delivered</option>
        </select>

        <select :value="billingStatus" @change="e => emit('update:billingStatus', (e.target as HTMLSelectElement).value)" class="text-sm border border-gray-300 rounded-md bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] shadow-sm min-w-[140px]">
          <option value="">Billing: All</option>
          <option value="PENDING">Pending</option>
          <option value="GENERATED">Generated</option>
          <option value="ERROR">Errors</option>
        </select>

        <select :value="packingStatus" @change="e => emit('update:packingStatus', (e.target as HTMLSelectElement).value)" class="text-sm border border-gray-300 rounded-md bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] shadow-sm min-w-[140px]">
          <option value="">Packing: All</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="PACKED">Packed</option>
        </select>

        <select :value="deliveryStatus" @change="e => emit('update:deliveryStatus', (e.target as HTMLSelectElement).value)" class="text-sm border border-gray-300 rounded-md bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1a5c4c] shadow-sm min-w-[140px]">
          <option value="">Delivery: All</option>
          <option value="WAITING">Waiting</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="DELIVERED">Delivered</option>
        </select>
        
        <button v-if="activeFilterCount > 0" @click="clearFilters" class="text-sm text-red-600 hover:text-red-700 font-medium px-2 py-1.5 ml-auto">Clear Filters</button>
      </div>
    </div>
    
    `

code = code.substring(0, startIndex) + newHeader + code.substring(tableStartIndex)
fs.writeFileSync('app/components/dashboard/OrderTable.vue', code)
