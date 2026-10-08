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
      <div class="p-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 text-xs text-gray-500">
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

      <div ref="tableContainerRef" class="overflow-x-auto min-h-[350px]">
        <table class="w-full text-left border-collapse table-auto">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-3 md:px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest md:min-w-[220px]">Customer & Code</th>
              <th class="hidden md:table-cell px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-36">Tier / Manager</th>
              <th class="hidden md:table-cell px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest min-w-[150px]">Contact Person</th>
              <th class="hidden md:table-cell px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-36 min-w-[130px]">Phone</th>
              <th class="hidden md:table-cell px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-36 min-w-[120px]">City / Addresses</th>
              <th class="hidden md:table-cell px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-28">Payment Terms</th>
              <th class="px-2 md:px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-16 md:w-20 text-center md:text-left">Status</th>
              <th v-if="user?.role === 'ADMIN'" class="px-2 md:px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-20 md:w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 text-sm">
            <template v-if="pending">
              <tr v-for="i in 5" :key="i" class="animate-pulse hover:bg-transparent">
                <td class="px-3 md:px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                <td class="hidden md:table-cell px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
                <td class="hidden md:table-cell px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-1/2"></div></td>
                <td class="hidden md:table-cell px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
                <td class="hidden md:table-cell px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-20"></div></td>
                <td class="hidden md:table-cell px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
                <td class="px-2 md:px-5 py-3.5"><div class="h-5 bg-gray-200 rounded-full w-14 mx-auto md:mx-0"></div></td>
                <td v-if="user?.role === 'ADMIN'" class="px-2 md:px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
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
                <td class="px-3 md:px-5 py-3 font-medium text-[#1a1a1a] md:min-w-[220px] group-hover:text-[#1a5c4c] transition-colors">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold border border-gray-200">
                      {{ customer.customerCode || 'NO CODE' }}
                    </span>
                    <span v-if="customer.isPriorityClient" class="text-amber-500 font-bold text-xs" title="Priority Client">★ Priority</span>
                  </div>
                  <span class="text-xs md:text-sm font-semibold leading-snug break-words line-clamp-2 block" :title="customer.company || customer.name">
                    {{ customer.company || customer.name }}
                  </span>
                  <span v-if="customer.alias" class="text-[11px] text-gray-400 italic block mt-0.5">
                    Alias: {{ customer.alias }}
                  </span>
                </td>

                <!-- Tier / Manager -->
                <td class="hidden md:table-cell px-5 py-3 text-xs">
                  <div class="flex flex-col gap-1">
                    <span 
                      class="inline-block text-[9px] px-2 py-0.5 rounded font-bold uppercase border w-max"
                      :class="getPrivilegeTierClass(customer.privilegeTier || 'BRONZE')"
                    >
                      {{ customer.privilegeTier || 'BRONZE' }}
                    </span>
                    <div v-if="customer.customerManager" class="flex items-center gap-1 text-[11px] text-gray-600 font-medium">
                      <UserCheck class="w-3 h-3 text-[#1a5c4c]" />
                      <span class="truncate max-w-[120px]">{{ customer.customerManager.name }}</span>
                    </div>
                  </div>
                </td>

                <!-- Contact Person -->
                <td class="hidden md:table-cell px-5 py-3 text-gray-600 min-w-[150px]">
                  <span class="break-words line-clamp-2" :title="customer.name">{{ customer.name }}</span>
                </td>

                <!-- Phone -->
                <td class="hidden md:table-cell px-5 py-3 text-xs text-gray-600 w-36 min-w-[130px]">
                  <div class="font-mono">{{ customer.phone }}</div>
                  <div v-if="customer.alternatePhone" class="font-mono text-gray-400 text-[11px] mt-0.5">
                    Alt: {{ customer.alternatePhone }}
                  </div>
                </td>

                <!-- City / Addresses -->
                <td class="hidden md:table-cell px-5 py-3 text-gray-600 w-36 min-w-[120px]">
                  <div class="text-xs font-medium text-gray-800">{{ customer.city || '-' }}</div>
                  <div v-if="customer.addresses && customer.addresses.length > 0" class="text-[10px] text-gray-400 mt-0.5">
                    📍 {{ customer.addresses.length }} {{ customer.addresses.length === 1 ? 'address' : 'addresses' }}
                  </div>
                </td>

                <!-- Payment Terms -->
                <td class="hidden md:table-cell px-5 py-3 w-28">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                    {{ formatPaymentTerms(customer.paymentTerms) }}
                  </span>
                </td>

                <!-- Status -->
                <td class="px-2 md:px-5 py-3 w-16 md:w-20 whitespace-nowrap text-center md:text-left">
                  <span 
                    class="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[11px] md:text-xs font-medium"
                    :class="customer.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ customer.isActive !== false ? 'Active' : 'Inactive' }}
                  </span>
                </td>

                <!-- Actions -->
                <td v-if="user?.role === 'ADMIN'" @click.stop class="px-2 md:px-5 py-3 text-right w-20 md:w-24 whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1">
                    <button 
                      @click="openCustomerPinModal(customer)"
                      class="transition-colors p-1.5 rounded"
                      :class="customer.latitude && customer.longitude ? 'text-[#1a5c4c] bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-300 shadow-xs' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'"
                      :title="customer.latitude && customer.longitude ? `📍 Saved Pin: ${customer.latitude.toFixed(4)}, ${customer.longitude.toFixed(4)}${customer.landmark ? ' (' + customer.landmark + ')' : ''}` : 'Set Delivery Destination Pin'"
                    >
                      <MapPin class="w-4 h-4" :class="{ 'fill-[#1a5c4c]/30 text-[#1a5c4c]': customer.latitude && customer.longitude }" />
                    </button>
                    <button 
                      @click="openModal(customer)"
                      class="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded hover:bg-gray-100"
                      title="Edit Customer Details"
                    >
                      <Edit2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div v-if="filteredCustomers.length > 0 && pageSize !== -1" class="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          class="absolute inset-0 bg-black/50 backdrop-blur-sm" 
          @click="closeModal"
        ></div>
        
        <div 
          ref="formModalRef"
          class="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col overscroll-contain border border-gray-100"
        >
          <div class="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-[#1c1c1c] text-white">
            <h3 class="text-base sm:text-lg font-bold">
              {{ editingCustomer ? `Edit Customer: ${editingCustomer.customerCode || editingCustomer.name}` : 'Add New Customer' }}
            </h3>
            <button @click="closeModal" class="text-gray-400 hover:text-white p-1 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <div :class="['p-4 sm:p-6 overflow-y-auto flex-1 transition-all duration-300', snackbarState !== 'hidden' ? 'pb-24' : '']">
            <form id="customerForm" @submit.prevent="saveCustomer" class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <!-- Customer Code (Admin only editable) -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Customer ID / Code {{ user?.role === 'ADMIN' ? '(Admin Editable)' : '(Locked)' }}
                </label>
                <input 
                  v-model="form.customerCode" 
                  :disabled="user?.role !== 'ADMIN'"
                  type="text" 
                  placeholder="Auto-assigned (e.g. CUST-1276)"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none font-mono text-sm uppercase disabled:bg-gray-100 disabled:text-gray-500 focus:border-[#1a5c4c]" 
                />
              </div>

              <!-- Privilege Tier -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Privilege Tier *</label>
                <select 
                  v-model="form.privilegeTier" 
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm bg-white focus:border-[#1a5c4c]"
                >
                  <option value="BRONZE">Bronze (Standard)</option>
                  <option value="SILVER">Silver (Preferred)</option>
                  <option value="GOLD">Gold (VIP)</option>
                </select>
              </div>

              <!-- Company Name -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Company / Firm Name *</label>
                <input v-model="form.company" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm focus:border-[#1a5c4c]" />
              </div>
              
              <!-- Contact Name -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contact Person *</label>
                <input v-model="form.name" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm focus:border-[#1a5c4c]" />
              </div>

              <!-- Alias -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer Alias / Trade Name</label>
                <input v-model="form.alias" type="text" placeholder="e.g. Sharma Hardware" class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm focus:border-[#1a5c4c]" />
              </div>

              <!-- Customer Manager -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer Account Manager</label>
                <select 
                  v-model="form.customerManagerId" 
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm bg-white focus:border-[#1a5c4c]"
                >
                  <option value="">Unassigned</option>
                  <option v-for="u in staffUsers" :key="u.id" :value="u.id">{{ u.name }} ({{ u.role }})</option>
                </select>
              </div>

              <!-- Phone -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Primary Phone *</label>
                <input v-model="form.phone" required type="tel" class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm font-mono focus:border-[#1a5c4c]" />
              </div>

              <!-- Alternate Phone -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Alternate Phone / Mobile</label>
                <input v-model="form.alternatePhone" type="tel" placeholder="e.g. +91 98765 00000" class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm font-mono focus:border-[#1a5c4c]" />
              </div>

              <!-- Email -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Address</label>
                <input v-model="form.email" type="email" class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm focus:border-[#1a5c4c]" />
              </div>

              <!-- GST Number -->
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">GSTIN (15 Digits)</label>
                <input 
                  v-model="form.gstNumber" 
                  type="text" 
                  maxlength="15"
                  placeholder="29AAAAA0000A1Z5"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm uppercase font-mono focus:border-[#1a5c4c]" 
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

              <!-- Flags -->
              <div class="sm:col-span-2 flex items-center gap-6 pt-2 border-t border-gray-100">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input v-model="form.isActive" type="checkbox" class="w-4 h-4 text-[#1a5c4c] border-gray-300 rounded focus:ring-[#1a5c4c]" />
                  <span class="text-xs font-semibold text-gray-700">Active Customer Account</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input v-model="form.isPriorityClient" type="checkbox" class="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500" />
                  <span class="text-xs font-semibold text-amber-800">★ Mark as Priority Client</span>
                </label>
              </div>

              <!-- Multi-Address Manager Section -->
              <div class="sm:col-span-2 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Registered Locations & Godowns</h4>
                    <p class="text-[11px] text-gray-500">Add labeled addresses for order destinations and delivery dispatch</p>
                  </div>
                  <button 
                    type="button" 
                    @click="addAddressRow" 
                    class="text-xs font-bold text-[#1a5c4c] flex items-center gap-1 hover:underline"
                  >
                    <Plus class="w-3.5 h-3.5" /> Add Location
                  </button>
                </div>

                <div class="space-y-3">
                  <div 
                    v-for="(addr, idx) in form.addresses" 
                    :key="idx" 
                    class="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <input 
                        v-model="addr.label" 
                        type="text" 
                        placeholder="Label: e.g. Main Showroom, Hebbal Godown..." 
                        class="flex-1 font-bold text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white focus:border-[#1a5c4c]" 
                      />
                      <label class="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
                        <input 
                          type="radio" 
                          :name="'defaultAddress'" 
                          :checked="addr.isDefault" 
                          @change="setDefaultAddress(idx)" 
                          class="text-[#1a5c4c]" 
                        />
                        <span>Default</span>
                      </label>
                      <button 
                        v-if="form.addresses.length > 1" 
                        type="button" 
                        @click="removeAddressRow(idx)" 
                        class="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <X class="w-4 h-4" />
                      </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div class="sm:col-span-2">
                        <input 
                          v-model="addr.addressLine" 
                          type="text" 
                          placeholder="Address Line / Street / Building" 
                          class="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white focus:border-[#1a5c4c]" 
                        />
                      </div>
                      <div>
                        <input 
                          v-model="addr.city" 
                          type="text" 
                          placeholder="City" 
                          class="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white focus:border-[#1a5c4c]" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <!-- Sticky Modal Footer -->
          <div class="px-4 sm:px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="customerForm"
              :disabled="isSaving"
              class="px-5 py-2 bg-[#1a5c4c] text-white rounded-lg text-sm font-bold hover:bg-[#14483b] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
              <span>{{ isSaving ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Create Customer') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Set Customer Delivery Pin Modal -->
    <SetDeliveryPinModal
      :isOpen="isCustomerPinModalOpen"
      :customerId="selectedCustomerForPin?.id"
      :customerName="selectedCustomerForPin?.name || 'Customer'"
      :customerCompany="selectedCustomerForPin?.company"
      :deliveryAddress="selectedCustomerForPin?.address || `${selectedCustomerForPin?.city || ''} ${selectedCustomerForPin?.state || ''}`"
      :initialLat="selectedCustomerForPin?.latitude"
      :initialLng="selectedCustomerForPin?.longitude"
      :initialLandmark="selectedCustomerForPin?.landmark"
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

// Fetch staff users for Account Manager dropdown
const { data: staffUsers } = await useFetch<any[]>('/api/users')

// Customer Pin Modal State
const isCustomerPinModalOpen = ref(false)
const selectedCustomerForPin = ref<any | null>(null)

const openCustomerPinModal = (customer: any) => {
  selectedCustomerForPin.value = customer
  isCustomerPinModalOpen.value = true
}

const onCustomerPinSaved = (pin: any) => {
  if (selectedCustomerForPin.value) {
    selectedCustomerForPin.value.latitude = pin ? pin.lat : null
    selectedCustomerForPin.value.longitude = pin ? pin.lng : null
    selectedCustomerForPin.value.landmark = pin ? pin.landmark : null
  }
  if (selectedCustomer.value && selectedCustomer.value.id === selectedCustomerForPin.value?.id) {
    selectedCustomer.value.latitude = pin ? pin.lat : null
    selectedCustomer.value.longitude = pin ? pin.lng : null
    selectedCustomer.value.landmark = pin ? pin.landmark : null
  }
  if (pin) {
    showSaved(`Delivery pin saved for ${selectedCustomerForPin.value?.company || selectedCustomerForPin.value?.name || 'Customer'}`)
  } else {
    showSaved(`Delivery pin removed for ${selectedCustomerForPin.value?.company || selectedCustomerForPin.value?.name || 'Customer'}`)
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
    label: string
    addressLine: string
    city: string
    isDefault: boolean
  }>
})

// Fetch data
const { data: customers, pending, refresh } = useFetch('/api/customers')

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
    label: `Godown / Site ${count + 1}`,
    addressLine: '',
    city: form.value.addresses[0]?.city || 'Mysuru',
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
            label: a.label || 'Main Address',
            addressLine: a.addressLine || '',
            city: a.city || '',
            isDefault: Boolean(a.isDefault)
          }))
        : [{
            label: 'Main Address',
            addressLine: customer.address || '',
            city: customer.city || 'Mysuru',
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
        label: 'Main Showroom / Billing Address',
        addressLine: '',
        city: 'Mysuru',
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
