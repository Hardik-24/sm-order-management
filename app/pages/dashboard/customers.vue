<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold text-[#1a1a1a]">Customers</h2>
        <p class="text-sm text-gray-500 mt-1">Manage customer codes, privilege tiers, account managers, and delivery addresses</p>
      </div>
      <button 
        v-if="user?.role === 'ADMIN'"
        @click="openModal()"
        class="flex items-center gap-2 bg-[#1a5c4c] text-white px-4 py-2 rounded-lg hover:bg-[#134336] transition-colors shadow-sm"
      >
        <Plus class="w-4 h-4" />
        Add Customer
      </button>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="bg-white p-4 rounded-xl border border-[#e5e2dc] shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div class="relative w-full sm:max-w-md">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search class="h-4 w-4 text-gray-400" />
        </div>
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Search by code, company, contact, alias, phone, city, GST..."
          class="block w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all shadow-sm"
        />
        <button 
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="text-xs text-gray-500 hidden sm:block">
        Showing <span class="font-bold text-gray-900">{{ filteredCustomers.length }}</span> customers
      </div>
    </div>

    <!-- Table Container -->
    <div ref="tableRootRef" class="bg-white rounded-xl border border-[#e5e2dc] shadow-sm overflow-hidden flex flex-col">
      <!-- Toolbar Header -->
      <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 text-xs text-gray-500">
        <div>
          Total Customers: <span class="font-bold text-gray-900">{{ filteredCustomers.length }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>Rows:</span>
          <RowsPerPageSelect 
            :modelValue="pageSize" 
            @update:modelValue="val => { pageSize = val; currentPage = 1 }"
            :options="[10, 20, 50, -1]"
          />
        </div>
      </div>

      <div ref="tableContainerRef" class="w-full overflow-x-auto no-scrollbar min-h-[350px]">
        <table class="w-full text-left border-collapse table-fixed md:min-w-[940px] xl:min-w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="pl-5 pr-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[56%] md:w-[21%]">Customer & Code</th>
              <th class="hidden md:table-cell px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest md:w-[11%]">Tier / Mgr</th>
              <th class="hidden md:table-cell px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest md:w-[11%]">Contact</th>
              <th class="hidden md:table-cell px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest md:w-[11%]">Phone</th>
              <th class="hidden md:table-cell px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest md:w-[23%]">Locations & Addresses</th>
              <th class="hidden md:table-cell px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest md:w-[9%]">Terms</th>
              <th class="px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[22%] md:w-[6%] text-center md:text-left">Status</th>
              <th v-if="user?.role === 'ADMIN'" class="pl-2 pr-8 md:pr-10 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[22%] md:w-[8%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 text-sm">
            <template v-if="pending">
              <tr v-for="i in 5" :key="i" class="animate-pulse hover:bg-transparent">
                <td class="pl-5 pr-4 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-full"></div></td>
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-full"></div></td>
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-full"></div></td>
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                <td class="px-4 py-3.5 md:py-4"><div class="h-5 bg-gray-200 rounded-full w-12 mx-auto md:mx-0"></div></td>
                <td v-if="user?.role === 'ADMIN'" class="pl-2 pr-8 md:pr-10 py-3.5 md:py-4"><div class="h-4 bg-gray-200 rounded w-6 ml-auto"></div></td>
              </tr>
            </template>
            <template v-else>
              <tr v-if="filteredCustomers.length === 0" class="hover:bg-gray-50">
                <td colspan="8" class="px-6 py-12 text-center text-gray-500">No customers found.</td>
              </tr>
              <tr 
                v-for="customer in paginatedCustomers" 
                :key="customer.id" 
                @click="openCustomerDetail(customer)"
                class="hover:bg-teal-50/40 cursor-pointer transition-colors group"
              >
                <!-- Customer & Code -->
                <td class="pl-5 pr-4 py-3.5 md:py-4 font-medium text-[#1a1a1a] group-hover:text-[#1a5c4c] transition-colors overflow-hidden">
                  <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold border border-gray-200 shrink-0">
                      {{ customer.customerCode || 'NO CODE' }}
                    </span>
                    <span v-if="customer.isPriorityClient" class="text-amber-500 font-bold text-[10px] shrink-0" title="Priority Client">★ Priority</span>
                  </div>
                  <span class="text-xs md:text-sm font-semibold leading-tight truncate block" :title="customer.company || customer.name">
                    {{ customer.company || customer.name }}
                  </span>
                  <span v-if="customer.alias" class="text-[10px] text-gray-400 italic truncate block mt-0.5">
                    Alias: {{ customer.alias }}
                  </span>
                </td>

                <!-- Tier / Manager -->
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4 text-xs overflow-hidden">
                  <div class="flex flex-col gap-1.5 min-w-0">
                    <span 
                      class="inline-block text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border w-max truncate"
                      :class="getPrivilegeTierClass(customer.privilegeTier || 'BRONZE')"
                    >
                      {{ customer.privilegeTier || 'BRONZE' }}
                    </span>
                    <div v-if="customer.customerManager" class="flex items-center gap-1 text-[11px] text-gray-600 font-medium min-w-0">
                      <UserCheck class="w-3 h-3 text-[#1a5c4c] shrink-0" />
                      <span class="truncate" :title="customer.customerManager.name">{{ customer.customerManager.name }}</span>
                    </div>
                  </div>
                </td>

                <!-- Contact Person -->
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4 text-gray-600 text-xs overflow-hidden">
                  <span class="truncate block font-medium text-gray-800" :title="customer.name">{{ customer.name }}</span>
                </td>

                <!-- Phone: Single line with NA fallback -->
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4 text-gray-700 overflow-hidden">
                  <span 
                    class="font-mono text-[11px] leading-tight block truncate whitespace-nowrap"
                    :class="formatPhone(customer.phone, customer.alternatePhone) === 'NA' ? 'text-gray-400 font-sans text-xs' : 'text-gray-900'"
                    :title="formatPhone(customer.phone, customer.alternatePhone)"
                  >
                    {{ formatPhone(customer.phone, customer.alternatePhone) }}
                  </span>
                </td>

                <!-- City / Addresses Capsules with per-address Pin -->
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4 overflow-hidden">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <div 
                      v-for="(addr, aIdx) in getCustomerAddresses(customer)" 
                      :key="addr.id || aIdx"
                      class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border text-xs transition-all shadow-2xs group/cap max-w-full"
                      :class="addr.latitude && addr.longitude 
                        ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' 
                        : 'bg-gray-50 border-gray-200 text-gray-700'"
                      @click.stop
                    >
                      <div 
                        class="flex items-center gap-1 min-w-0 overflow-hidden" 
                        :title="`${addr.label || 'Address ' + (aIdx + 1)}: ${[addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}`"
                      >
                        <span class="font-bold text-[10px] truncate max-w-[85px]">
                          {{ addr.label || `Address ${aIdx + 1}` }}
                        </span>
                        <span v-if="addr.city" class="text-[9px] text-gray-500 font-medium truncate max-w-[55px]">
                          ({{ addr.city }})
                        </span>
                        <span v-if="addr.isDefault" class="text-[7px] font-black uppercase tracking-wider text-[#1a5c4c] bg-[#1a5c4c]/10 px-1 py-0.2 rounded border border-[#1a5c4c]/20 shrink-0">
                          DEF
                        </span>
                      </div>

                      <button
                        v-if="user?.role === 'ADMIN'"
                        type="button"
                        @click.stop="openAddressPinModal(customer, addr, aIdx)"
                        class="p-0.5 rounded transition-all flex items-center justify-center shrink-0"
                        :class="addr.latitude && addr.longitude 
                          ? 'text-[#1a5c4c] bg-emerald-100 hover:bg-emerald-200 ring-1 ring-emerald-300' 
                          : 'text-gray-400 hover:text-[#1a5c4c] hover:bg-gray-200/70'"
                        :title="addr.latitude && addr.longitude 
                          ? `📍 Saved Pin: ${Number(addr.latitude).toFixed(4)}, ${Number(addr.longitude).toFixed(4)}${addr.landmark ? ' (' + addr.landmark + ')' : ''} - Click to edit pin` 
                          : `Set Delivery GPS Pin for ${addr.label || 'Address ' + (aIdx + 1)}`"
                      >
                        <MapPin class="w-3 h-3" :class="{ 'fill-[#1a5c4c] text-[#1a5c4c]': addr.latitude && addr.longitude }" />
                      </button>
                    </div>
                  </div>
                </td>

                <!-- Payment Terms -->
                <td class="hidden md:table-cell px-4 py-3.5 md:py-4 overflow-hidden">
                  <span class="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium truncate max-w-full" :title="formatPaymentTerms(customer.paymentTerms)">
                    {{ formatPaymentTerms(customer.paymentTerms) }}
                  </span>
                </td>

                <!-- Status -->
                <td class="px-4 py-3.5 md:py-4 overflow-hidden text-center md:text-left">
                  <span 
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                    :class="customer.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ customer.isActive !== false ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <!-- Actions -->
                <td v-if="user?.role === 'ADMIN'" @click.stop class="pl-2 pr-8 md:pr-10 py-3.5 md:py-4 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end">
                    <button 
                      @click="openModal(customer)"
                      class="text-gray-400 hover:text-[#1a5c4c] hover:bg-[#1a5c4c]/10 transition-colors p-1.5 rounded-lg inline-flex items-center justify-center"
                      title="Edit Customer Details"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div v-if="filteredCustomers.length > 0 && pageSize !== -1" class="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="text-xs text-gray-500">
          Showing <span class="font-medium text-gray-900">{{ startIndex }}</span> to <span class="font-medium text-gray-900">{{ endIndex }}</span> of <span class="font-medium text-gray-900">{{ filteredCustomers.length }}</span> customers
        </div>

        <div class="flex items-center gap-2">
          <button 
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
            Previous
          </button>

          <span class="text-xs text-gray-600 px-2">
            Page <span class="font-semibold text-gray-900">{{ currentPage }}</span> of <span class="font-semibold text-gray-900">{{ totalPages }}</span>
          </span>

          <button 
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
          >
            Next
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Customer Details Modal Popup -->
    <Teleport to="body">
      <div 
        v-if="isDetailModalOpen && selectedCustomer" 
        class="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4"
      >
      <div 
        ref="detailBackdropRef"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        @click="closeCustomerDetail"
      ></div>

      <div 
        ref="detailModalRef"
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-100 overscroll-contain"
      >
        <!-- Header -->
        <div class="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Building2 class="w-4 h-4 text-[#1a5c4c]" />
            Customer Profile: {{ selectedCustomer.customerCode || 'CUST-XXXX' }}
          </div>
          <button 
            @click="closeCustomerDetail" 
            class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- Full Company Name & Badges -->
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 border text-gray-700">
                  {{ selectedCustomer.customerCode || 'Pending Code' }}
                </span>
                <span 
                  class="text-[10px] px-2 py-0.5 rounded font-bold uppercase border"
                  :class="getPrivilegeTierClass(selectedCustomer.privilegeTier || 'BRONZE')"
                >
                  {{ selectedCustomer.privilegeTier || 'BRONZE' }} TIER
                </span>
                <span v-if="selectedCustomer.isPriorityClient" class="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ★ PRIORITY CLIENT
                </span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 leading-snug break-words">
                {{ selectedCustomer.company || selectedCustomer.name }}
              </h2>
              <p v-if="selectedCustomer.alias" class="text-xs text-gray-500 mt-0.5">
                Trade Alias: <strong>{{ selectedCustomer.alias }}</strong>
              </p>
            </div>
            <span 
              class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold shrink-0 mt-1"
              :class="selectedCustomer.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
            >
              <CheckCircle2 v-if="selectedCustomer.isActive !== false" class="w-3.5 h-3.5" />
              <XCircle v-else class="w-3.5 h-3.5" />
              {{ selectedCustomer.isActive !== false ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <!-- Quick Info Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Contact Person -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <User class="w-3.5 h-3.5" />
                Contact Person
              </div>
              <div class="text-sm font-semibold text-gray-900 break-words">
                {{ selectedCustomer.name }}
              </div>
            </div>

            <!-- Customer Manager -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <UserCheck class="w-3.5 h-3.5 text-[#1a5c4c]" />
                Customer Account Manager
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedCustomer.customerManager?.name || 'Unassigned (General Pool)' }}
              </div>
            </div>

            <!-- Phones -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Phone class="w-3.5 h-3.5" />
                Phone & Alternate Contact
              </div>
              <div class="text-sm font-mono font-semibold text-[#1a5c4c]">
                <a :href="`tel:${selectedCustomer.phone}`" class="hover:underline">{{ selectedCustomer.phone }}</a>
                <span v-if="selectedCustomer.alternatePhone" class="text-gray-500 font-normal ml-2">/ {{ selectedCustomer.alternatePhone }}</span>
              </div>
            </div>

            <!-- Payment Terms -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <CreditCard class="w-3.5 h-3.5" />
                Payment Terms
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ formatPaymentTerms(selectedCustomer.paymentTerms) }}
              </div>
            </div>

            <!-- GST Number -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100 sm:col-span-2">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <ShieldCheck class="w-3.5 h-3.5" />
                GSTIN / Tax Identification
              </div>
              <div class="font-mono text-sm font-bold text-gray-900 uppercase">
                {{ selectedCustomer.gstNumber || 'Not Registered / Unregistered Dealer' }}
              </div>
            </div>
          </div>

          <!-- Registered Addresses List -->
          <div>
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Registered Locations & Godowns ({{ selectedCustomer.addresses?.length || 1 }})</span>
            </h4>
            <div class="space-y-2">
              <div 
                v-for="(addr, idx) in (selectedCustomer.addresses?.length ? selectedCustomer.addresses : [{ label: 'Primary Address', addressLine: selectedCustomer.address, city: selectedCustomer.city, state: selectedCustomer.state, pincode: selectedCustomer.pincode, isDefault: true }])" 
                :key="idx"
                class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-start"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-900">{{ addr.label || `Address ${idx + 1}` }}</span>
                    <span v-if="addr.isDefault" class="text-[9px] px-1.5 py-0.2 rounded font-bold bg-[#1a5c4c]/10 text-[#1a5c4c] border border-[#1a5c4c]/20">
                      DEFAULT
                    </span>
                  </div>
                  <p class="text-gray-600">{{ [addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <button 
            v-if="user?.role === 'ADMIN'"
            @click="editCustomerFromDetail()"
            class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1a5c4c] bg-[#1a5c4c]/10 hover:bg-[#1a5c4c]/20 rounded-lg transition-colors"
          >
            <Edit2 class="w-3.5 h-3.5" />
            Edit Customer
          </button>
          <button 
            @click="closeCustomerDetail" 
            class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </Teleport>

    <!-- Edit / Add Modal Form -->
    <Teleport to="body">
      <div v-if="isModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
        <div 
          ref="formBackdropRef"
          class="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          @click="closeModal"
        ></div>
        
        <div 
          ref="formModalRef"
          class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col overscroll-contain border border-gray-100"
        >
          <!-- Modern Dark Header -->
          <div class="px-5 sm:px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0 bg-[#171717] text-white">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#1a5c4c]/40 border border-[#4ecdc4]/20 flex items-center justify-center text-[#4ecdc4]">
                <Building2 class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base sm:text-lg font-bold text-white">
                    {{ editingCustomer ? 'Edit Customer Profile' : 'Add New Customer' }}
                  </h3>
                  <span v-if="editingCustomer?.customerCode" class="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-[#e8e0d4] border border-white/15">
                    {{ editingCustomer.customerCode }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-0.5 truncate max-w-sm sm:max-w-md">
                  {{ editingCustomer ? (editingCustomer.company || editingCustomer.name) : 'Register customer profile, privilege tiers & delivery addresses' }}
                </p>
              </div>
            </div>
            <button @click="closeModal" class="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <div :class="['p-4 sm:p-6 overflow-y-auto flex-1 bg-[#faf9f6] space-y-5 transition-all duration-300', snackbarState !== 'hidden' ? 'pb-24' : '']">
            <form id="customerForm" @submit.prevent="saveCustomer" class="space-y-5 text-xs">
              
              <!-- 1. Identification & Classification Card -->
              <div class="bg-white p-4 sm:p-5 rounded-xl border border-gray-200/90 shadow-2xs space-y-4">
                <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div class="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wider">
                    <ShieldCheck class="w-4 h-4 text-[#1a5c4c]" />
                    <span>Identification & Classification</span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- Customer Code -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                      <span>Customer ID / Code</span>
                      <span class="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {{ user?.role === 'ADMIN' ? 'Admin Editable' : 'Locked' }}
                      </span>
                    </label>
                    <input 
                      v-model="form.customerCode" 
                      :disabled="user?.role !== 'ADMIN'"
                      type="text" 
                      placeholder="Auto-assigned (e.g. CUST-1276)"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-mono text-sm uppercase bg-white disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Privilege Tier -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Privilege Tier *</label>
                    <CustomSelect 
                      :modelValue="form.privilegeTier"
                      @update:modelValue="val => form.privilegeTier = val"
                      :options="privilegeTierOptions"
                      placeholder="Select Privilege Tier"
                      class="w-full"
                    />
                  </div>

                  <!-- Company / Firm Name -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Company / Firm Name *</label>
                    <input 
                      v-model="form.company" 
                      required 
                      type="text" 
                      placeholder="e.g. Royal Interiors & Furnishings"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Contact Name -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contact Person *</label>
                    <input 
                      v-model="form.name" 
                      required 
                      type="text" 
                      placeholder="e.g. Ramesh Patel"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Trade Alias -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer Alias / Trade Name</label>
                    <input 
                      v-model="form.alias" 
                      type="text" 
                      placeholder="e.g. Sharma Hardware" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Customer Account Manager -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer Account Manager</label>
                    <CustomSelect 
                      :modelValue="form.customerManagerId"
                      @update:modelValue="val => form.customerManagerId = val"
                      :options="customerManagerOptions"
                      searchable
                      searchPlaceholder="Search account manager..."
                      placeholder="Unassigned (General Pool)"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>

              <!-- 2. Contact & Commercial Terms Card -->
              <div class="bg-white p-4 sm:p-5 rounded-xl border border-gray-200/90 shadow-2xs space-y-4">
                <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div class="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wider">
                    <Phone class="w-4 h-4 text-[#1a5c4c]" />
                    <span>Contact & Commercial Terms</span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- Phone -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Primary Phone *</label>
                    <input 
                      v-model="form.phone" 
                      required 
                      type="tel" 
                      placeholder="+91 98765 43210"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm font-mono bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Alternate Phone -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Alternate Phone / Mobile</label>
                    <input 
                      v-model="form.alternatePhone" 
                      type="tel" 
                      placeholder="e.g. +91 98765 00000" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm font-mono bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Email -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Address</label>
                    <input 
                      v-model="form.email" 
                      type="email" 
                      placeholder="customer@domain.com"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- GST Number -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                      <span>GSTIN (15 Digits)</span>
                      <span class="text-[9px] font-mono text-gray-400">{{ (form.gstNumber || '').length }}/15</span>
                    </label>
                    <input 
                      v-model="form.gstNumber" 
                      type="text" 
                      maxlength="15"
                      placeholder="29AAAAA0000A1Z5"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm uppercase font-mono bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition-all" 
                    />
                  </div>

                  <!-- Payment Terms -->
                  <div class="space-y-1 sm:col-span-2">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Payment Terms</label>
                    <CustomSelect 
                      :modelValue="form.paymentTerms"
                      @update:modelValue="val => form.paymentTerms = val"
                      :options="paymentTermsOptions"
                      placeholder="Select Payment Terms"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>

              <!-- 3. Account Status & Priority Toggles -->
              <div class="bg-white p-4 sm:p-5 rounded-xl border border-gray-200/90 shadow-2xs space-y-3">
                <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div class="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wider">
                    <Zap class="w-4 h-4 text-amber-500" />
                    <span>Account Status & Operational Flags</span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <!-- Active Account Toggle Card -->
                  <div 
                    @click="form.isActive = !form.isActive"
                    class="p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3"
                    :class="form.isActive ? 'bg-[#1a5c4c]/5 border-[#1a5c4c]/40 shadow-2xs' : 'bg-gray-50/70 border-gray-200 hover:border-gray-300'"
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs" :class="form.isActive ? 'text-[#1a5c4c]' : 'text-gray-700'">
                          Active Customer Account
                        </span>
                        <span 
                          class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded"
                          :class="form.isActive ? 'bg-[#1a5c4c] text-white' : 'bg-gray-200 text-gray-600'"
                        >
                          {{ form.isActive ? 'ACTIVE' : 'INACTIVE' }}
                        </span>
                      </div>
                      <p class="text-[11px] text-gray-500 mt-0.5">
                        {{ form.isActive ? 'Customer is enabled for orders and billing' : 'Customer is hidden from active order creation dropdowns' }}
                      </p>
                    </div>
                    <!-- Toggle Switch UI -->
                    <div 
                      class="w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5"
                      :class="form.isActive ? 'bg-[#1a5c4c]' : 'bg-gray-300'"
                    >
                      <div 
                        class="w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out"
                        :class="form.isActive ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </div>
                  </div>

                  <!-- Priority Client Toggle Card -->
                  <div 
                    @click="form.isPriorityClient = !form.isPriorityClient"
                    class="p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3"
                    :class="form.isPriorityClient ? 'bg-amber-50/80 border-amber-300 shadow-2xs' : 'bg-gray-50/70 border-gray-200 hover:border-gray-300'"
                  >
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs" :class="form.isPriorityClient ? 'text-amber-900' : 'text-gray-700'">
                          ★ Priority Client Account
                        </span>
                        <span 
                          v-if="form.isPriorityClient"
                          class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500 text-white"
                        >
                          VIP
                        </span>
                      </div>
                      <p class="text-[11px] text-gray-500 mt-0.5">
                        {{ form.isPriorityClient ? 'Priority badge automatically highlighted on orders' : 'Standard priority client' }}
                      </p>
                    </div>
                    <!-- Toggle Switch UI -->
                    <div 
                      class="w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5"
                      :class="form.isPriorityClient ? 'bg-amber-500' : 'bg-gray-300'"
                    >
                      <div 
                        class="w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out"
                        :class="form.isPriorityClient ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 4. Registered Locations & Godowns Card -->
              <div class="bg-white p-4 sm:p-5 rounded-xl border border-gray-200/90 shadow-2xs space-y-4">
                <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div>
                    <div class="flex items-center gap-2 font-bold text-gray-800 text-xs uppercase tracking-wider">
                      <MapPin class="w-4 h-4 text-[#1a5c4c]" />
                      <span>Registered Delivery Locations ({{ form.addresses.length }})</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5">Select a default delivery location and manage site addresses</p>
                  </div>
                  <button 
                    type="button" 
                    @click="addAddressRow" 
                    class="text-xs font-bold text-[#1a5c4c] bg-[#1a5c4c]/10 hover:bg-[#1a5c4c]/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>Add Location</span>
                  </button>
                </div>

                <div class="space-y-3.5">
                  <div 
                    v-for="(addr, idx) in form.addresses" 
                    :key="idx" 
                    class="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3 transition-colors hover:border-gray-300"
                  >
                    <!-- Address Header: Label + Default Button + Pin Indicator + Delete -->
                    <div class="flex flex-wrap items-center justify-between gap-2.5">
                      <div class="flex-1 min-w-[180px]">
                        <input 
                          v-model="addr.label" 
                          type="text" 
                          placeholder="Location Label: e.g. Main Showroom, Hebbal Godown..." 
                          class="w-full font-bold text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none" 
                        />
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <!-- Default Address Toggle Button -->
                        <button
                          type="button"
                          @click="setDefaultAddress(idx)"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none"
                          :class="addr.isDefault 
                            ? 'bg-[#1a5c4c] text-white shadow-xs' 
                            : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-100'"
                        >
                          <CheckCircle2 v-if="addr.isDefault" class="w-3.5 h-3.5 text-white" />
                          <span>{{ addr.isDefault ? 'Default Address' : 'Set as Default' }}</span>
                        </button>

                        <!-- Pin status badge -->
                        <span 
                          v-if="addr.latitude && addr.longitude" 
                          class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-1 rounded-lg border border-emerald-200"
                          :title="`Pin: ${Number(addr.latitude).toFixed(4)}, ${Number(addr.longitude).toFixed(4)}`"
                        >
                          <MapPin class="w-3 h-3 fill-emerald-700 text-emerald-700" />
                          <span>Pin Saved</span>
                        </span>

                        <!-- Delete Button -->
                        <button 
                          v-if="form.addresses.length > 1" 
                          type="button" 
                          @click="removeAddressRow(idx)" 
                          class="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Remove location"
                        >
                          <X class="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <!-- Address Fields Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div class="sm:col-span-2">
                        <input 
                          v-model="addr.addressLine" 
                          type="text" 
                          placeholder="Street Address / Building / Area" 
                          class="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none" 
                        />
                      </div>
                      <div>
                        <input 
                          v-model="addr.city" 
                          type="text" 
                          placeholder="City (e.g. Mysuru)" 
                          class="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none" 
                        />
                      </div>
                      <div>
                        <input 
                          v-model="addr.pincode" 
                          type="text" 
                          placeholder="Pincode (optional)" 
                          class="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <!-- Sticky Modal Footer -->
          <div class="px-5 sm:px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
            <div class="text-xs text-gray-500 hidden sm:block">
              {{ form.addresses.length }} delivery location{{ form.addresses.length === 1 ? '' : 's' }} registered
            </div>
            <div class="flex items-center gap-3 ml-auto">
              <button
                type="button"
                @click="closeModal"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="customerForm"
                :disabled="isSaving"
                class="px-5 py-2 bg-[#1a5c4c] text-white rounded-xl text-xs font-bold hover:bg-[#14483b] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                <span>{{ isSaving ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Create Customer') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Set Customer Delivery Pin Modal -->
    <SetDeliveryPinModal
      :isOpen="isCustomerPinModalOpen"
      :customerId="selectedCustomerForPin?.id"
      :addressId="selectedAddressForPin?.id"
      :addressLabel="selectedAddressForPin?.label || `Address ${(selectedAddressForPin?.index || 0) + 1}`"
      :customerName="selectedCustomerForPin?.name || 'Customer'"
      :customerCompany="selectedCustomerForPin?.company"
      :deliveryAddress="selectedAddressForPin ? [selectedAddressForPin.addressLine, selectedAddressForPin.city].filter(Boolean).join(', ') : selectedCustomerForPin?.address"
      :initialLat="selectedAddressForPin?.latitude ?? selectedCustomerForPin?.latitude"
      :initialLng="selectedAddressForPin?.longitude ?? selectedCustomerForPin?.longitude"
      :initialLandmark="selectedAddressForPin?.landmark ?? selectedCustomerForPin?.landmark"
      @close="isCustomerPinModalOpen = false"
      @saved="onCustomerPinSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { 
  Plus, Search, Edit2, X, Loader2, Building2, User, Phone, Mail, 
  MapPin, CreditCard, ShieldCheck, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  UserCheck, Award, Zap
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'

definePageMeta({ layout: 'dashboard' })

const { user } = useAuth()
const { showEditing, showSaving, showSaved, hide, snackbarState } = useSnackbar()
const { animateModalOpen, animateStagger, initContext } = useGsapAnimation()
const { notifyChange, onOrderSync } = useRealtimeSync()

// Realtime multi-device sync for customers
onOrderSync((event) => {
  if (event?.type === 'DB_CUSTOMER_CHANGE' || event?.type === 'CUSTOMER_CHANGE' || event?.action === 'CUSTOMER_SAVED' || event?.action === 'PIN_CHANGED') {
    refresh()
  }
})

const paymentTermsOptions = [
  { label: 'COD (Cash on Delivery)', value: 'COD' },
  { label: '15 Days', value: '15_DAYS' },
  { label: '30 Days', value: '30_DAYS' },
  { label: '45 Days', value: '45_DAYS' },
  { label: '60 Days', value: '60_DAYS' }
]

const privilegeTierOptions = [
  { label: 'Bronze (Standard)', value: 'BRONZE', subtitle: 'Standard rates & terms' },
  { label: 'Silver (Preferred)', value: 'SILVER', subtitle: 'Preferred rates' },
  { label: 'Gold (VIP)', value: 'GOLD', subtitle: 'VIP priority client' }
]

// Fetch staff users for Account Manager dropdown
const { data: staffUsers } = await useFetch<any[]>('/api/users')

const customerManagerOptions = computed(() => {
  const options = [{ label: 'Unassigned (General Pool)', value: '' }]
  if (staffUsers.value && Array.isArray(staffUsers.value)) {
    staffUsers.value.forEach((u: any) => {
      options.push({
        label: `${u.name} (${u.role})`,
        value: u.id,
        subtitle: u.email
      })
    })
  }
  return options
})

// Customer & Address Pin Modal State
const isCustomerPinModalOpen = ref(false)
const selectedCustomerForPin = ref<any | null>(null)
const selectedAddressForPin = ref<any | null>(null)

const openAddressPinModal = (customer: any, address: any, addressIndex: number) => {
  selectedCustomerForPin.value = customer
  selectedAddressForPin.value = {
    ...address,
    index: addressIndex
  }
  isCustomerPinModalOpen.value = true
}

const onCustomerPinSaved = (pin: any) => {
  if (selectedCustomerForPin.value && selectedAddressForPin.value) {
    const addrId = selectedAddressForPin.value.id
    const addrIdx = selectedAddressForPin.value.index
    if (selectedCustomerForPin.value.addresses && selectedCustomerForPin.value.addresses.length > 0) {
      const target = addrId 
        ? selectedCustomerForPin.value.addresses.find((a: any) => a.id === addrId)
        : selectedCustomerForPin.value.addresses[addrIdx]
      if (target) {
        target.latitude = pin ? pin.lat : null
        target.longitude = pin ? pin.lng : null
        target.landmark = pin ? pin.landmark : null
      }
    }
    if (!selectedAddressForPin.value.id || selectedAddressForPin.value.isDefault) {
      selectedCustomerForPin.value.latitude = pin ? pin.lat : null
      selectedCustomerForPin.value.longitude = pin ? pin.lng : null
      selectedCustomerForPin.value.landmark = pin ? pin.landmark : null
    }
  }
  if (pin) {
    showSaved(`Delivery pin saved for ${selectedAddressForPin.value?.label || selectedCustomerForPin.value?.company || 'Address'}`)
  } else {
    showSaved(`Delivery pin removed for ${selectedAddressForPin.value?.label || selectedCustomerForPin.value?.company || 'Address'}`)
  }
  refresh()
  notifyChange({ type: 'CUSTOMER_CHANGE', action: 'PIN_CHANGED' })
}

// State
const searchQuery = ref('')
const isModalOpen = ref(false)
const isSaving = ref(false)
const editingCustomer = ref<any>(null)
const tableContainerRef = ref<HTMLElement | null>(null)

// Detail modal state
const selectedCustomer = ref<any | null>(null)
const isDetailModalOpen = ref(false)
const detailModalRef = ref<HTMLElement | null>(null)
const detailBackdropRef = ref<HTMLElement | null>(null)

// Form modal state
const formModalRef = ref<HTMLElement | null>(null)
const formBackdropRef = ref<HTMLElement | null>(null)

// Form data
const form = ref({
  customerCode: '',
  company: '', 
  name: '', 
  alias: '',
  phone: '', 
  alternatePhone: '',
  email: '', 
  gstNumber: '', 
  paymentTerms: 'COD', 
  privilegeTier: 'BRONZE',
  customerManagerId: '',
  isPriorityClient: false,
  isActive: true,
  addresses: [] as Array<{
    id?: string
    label: string
    addressLine: string
    city: string
    state?: string
    pincode?: string
    landmark?: string
    latitude?: number | null
    longitude?: number | null
    isDefault: boolean
  }>
})

// Fetch all customers including inactive so status changes are fully visible & editable
const { data: customers, pending, refresh } = useFetch('/api/customers?includeInactive=true')

// Helper to format phone numbers into a single clean line with NA fallback
const formatPhone = (phone?: string, altPhone?: string) => {
  const list: string[] = []
  if (phone) {
    phone.split(/[,;/]+/).forEach(p => {
      const clean = p.trim()
      if (clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' && clean !== '-' && !list.includes(clean)) {
        list.push(clean)
      }
    })
  }
  if (altPhone) {
    altPhone.split(/[,;/]+/).forEach(p => {
      const clean = p.trim()
      if (clean && clean.toUpperCase() !== 'N/A' && clean.toUpperCase() !== 'NA' && clean !== '-' && !list.includes(clean)) {
        list.push(clean)
      }
    })
  }
  return list.length > 0 ? list.join(', ') : 'NA'
}

// Helper to safely get list of addresses for each customer
const getCustomerAddresses = (customer: any) => {
  if (customer.addresses && customer.addresses.length > 0) {
    return customer.addresses
  }
  return [{
    id: undefined,
    label: 'Address 1',
    addressLine: customer.address || '',
    city: customer.city || '',
    state: customer.state || 'Karnataka',
    pincode: customer.pincode || '',
    landmark: customer.landmark || '',
    latitude: customer.latitude,
    longitude: customer.longitude,
    isDefault: true
  }]
}

// Computed filtering with multi-token smart search
const filteredCustomers = computed(() => {
  if (!customers.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return customers.value as any[]

  const terms = q.split(/\s+/).filter(Boolean)
  return (customers.value as any[]).filter(c => {
    const searchableText = `${c.customerCode || ''} ${c.company || ''} ${c.alias || ''} ${c.name || ''} ${c.phone || ''} ${c.alternatePhone || ''} ${c.email || ''} ${c.city || ''} ${c.gstNumber || ''}`.toLowerCase()
    return terms.every(term => searchableText.includes(term))
  })
})

const totalPages = computed(() => {
  if (pageSize.value === -1) return 1
  return Math.ceil(filteredCustomers.value.length / pageSize.value) || 1
})

const paginatedCustomers = computed(() => {
  if (pageSize.value === -1) return filteredCustomers.value
  const start = (currentPage.value - 1) * pageSize.value
  return filteredCustomers.value.slice(start, start + pageSize.value)
})

const startIndex = computed(() => {
  if (filteredCustomers.value.length === 0) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const endIndex = computed(() => {
  if (pageSize.value === -1) return filteredCustomers.value.length
  return Math.min(currentPage.value * pageSize.value, filteredCustomers.value.length)
})

const formatPaymentTerms = (term: string) => {
  return term ? term.replace('_', ' ') : 'N/A'
}

const getPrivilegeTierClass = (tier: string) => {
  switch (tier) {
    case 'GOLD': return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'SILVER': return 'bg-slate-100 text-slate-800 border-slate-300'
    default: return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}

const addAddressRow = () => {
  const count = form.value.addresses.length
  form.value.addresses.push({
    id: undefined,
    label: `Godown / Site ${count + 1}`,
    addressLine: '',
    city: form.value.addresses[0]?.city || 'Mysuru',
    state: form.value.addresses[0]?.state || 'Karnataka',
    pincode: form.value.addresses[0]?.pincode || '',
    landmark: '',
    latitude: null,
    longitude: null,
    isDefault: count === 0
  })
}

const removeAddressRow = (idx: number) => {
  form.value.addresses.splice(idx, 1)
  if (!form.value.addresses.some(a => a.isDefault) && form.value.addresses.length > 0) {
    form.value.addresses[0].isDefault = true
  }
}

const setDefaultAddress = (idx: number) => {
  form.value.addresses.forEach((a, i) => {
    a.isDefault = (i === idx)
  })
}

const openCustomerDetail = (customer: any) => {
  selectedCustomer.value = customer
  isDetailModalOpen.value = true
  nextTick(() => {
    animateModalOpen(detailModalRef.value, detailBackdropRef.value, { duration: 0.26 })
  })
}

const closeCustomerDetail = () => {
  isDetailModalOpen.value = false
  selectedCustomer.value = null
}

const editCustomerFromDetail = () => {
  const cust = selectedCustomer.value
  isDetailModalOpen.value = false
  selectedCustomer.value = null
  if (cust) {
    openModal(cust)
  }
}

const openModal = (customer: any = null) => {
  if (customer) {
    editingCustomer.value = customer
    form.value = {
      customerCode: customer.customerCode || '',
      company: customer.company || '',
      name: customer.name || '',
      alias: customer.alias || '',
      phone: customer.phone || '',
      alternatePhone: customer.alternatePhone || '',
      email: customer.email || '',
      gstNumber: customer.gstNumber || '',
      paymentTerms: customer.paymentTerms || 'COD',
      privilegeTier: customer.privilegeTier || 'BRONZE',
      customerManagerId: customer.customerManagerId || customer.customerManager?.id || '',
      isPriorityClient: Boolean(customer.isPriorityClient),
      isActive: customer.isActive !== false,
      addresses: (customer.addresses && customer.addresses.length > 0)
        ? customer.addresses.map((a: any) => ({
            id: a.id,
            label: a.label || 'Main Address',
            addressLine: a.addressLine || '',
            city: a.city || '',
            state: a.state || 'Karnataka',
            pincode: a.pincode || '',
            landmark: a.landmark || '',
            latitude: a.latitude !== undefined && a.latitude !== null ? Number(a.latitude) : null,
            longitude: a.longitude !== undefined && a.longitude !== null ? Number(a.longitude) : null,
            isDefault: Boolean(a.isDefault)
          }))
        : [{
            id: undefined,
            label: 'Main Address',
            addressLine: customer.address || '',
            city: customer.city || 'Mysuru',
            state: customer.state || 'Karnataka',
            pincode: customer.pincode || '',
            landmark: customer.landmark || '',
            latitude: customer.latitude !== undefined && customer.latitude !== null ? Number(customer.latitude) : null,
            longitude: customer.longitude !== undefined && customer.longitude !== null ? Number(customer.longitude) : null,
            isDefault: true
          }]
    }
  } else {
    editingCustomer.value = null
    form.value = {
      customerCode: '',
      company: '', 
      name: '', 
      alias: '',
      phone: '', 
      alternatePhone: '',
      email: '', 
      gstNumber: '', 
      paymentTerms: 'COD', 
      privilegeTier: 'BRONZE',
      customerManagerId: '',
      isPriorityClient: false,
      isActive: true,
      addresses: [{
        id: undefined,
        label: 'Main Showroom / Billing Address',
        addressLine: '',
        city: 'Mysuru',
        state: 'Karnataka',
        pincode: '',
        landmark: '',
        latitude: null,
        longitude: null,
        isDefault: true
      }]
    }
  }
  isModalOpen.value = true
  nextTick(() => {
    animateModalOpen(formModalRef.value, formBackdropRef.value, { duration: 0.26 })
  })
}

const closeModal = () => {
  isModalOpen.value = false
  editingCustomer.value = null
  hide()
}

const saveCustomer = async () => {
  if (!form.value.company || !form.value.name || !form.value.phone) {
    alert('Please complete Company Name, Contact Name, and Phone')
    return
  }

  if (form.value.gstNumber && form.value.gstNumber.trim().length !== 15) {
    alert('GSTIN must be exactly 15 characters')
    return
  }
  
  isSaving.value = true
  showSaving()
  try {
    const url = editingCustomer.value ? `/api/customers/${editingCustomer.value.id}` : '/api/customers'
    const method = editingCustomer.value ? 'PATCH' : 'POST'
    
    await $fetch(url, { method, body: form.value })
    await refresh()
    notifyChange({ type: 'CUSTOMER_CHANGE', action: 'CUSTOMER_SAVED' })
    
    closeModal()
    showSaved('Customer profile saved successfully')
  } catch (e: any) {
    console.error('Failed to save customer', e)
    alert(e.data?.message || 'Failed to save customer')
    hide()
  } finally {
    isSaving.value = false
  }
}

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)
const tableRootRef = ref<HTMLElement | null>(null)

watch(currentPage, () => {
  nextTick(() => {
    tableRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

watch(searchQuery, () => {
  currentPage.value = 1
})
</script>
