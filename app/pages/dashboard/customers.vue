<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold text-[#1a1a1a]">Customers</h2>
        <p class="text-sm text-gray-500 mt-1">Manage your customer database, credit limits, and payment terms</p>
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
    <div class="bg-white p-4 rounded-xl border border-[#e5e2dc] shadow-sm flex items-center justify-between gap-4">
      <div class="relative w-full max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Search by company, contact, phone, city, GST..."
          class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] text-sm"
        />
      </div>
      <div class="text-xs text-gray-500 hidden sm:block">
        Showing <span class="font-bold text-gray-900">{{ filteredCustomers.length }}</span> customers
      </div>
    </div>

    <!-- Table Container -->
    <div class="bg-white rounded-xl border border-[#e5e2dc] shadow-sm overflow-hidden flex flex-col">
      <!-- Toolbar Header -->
      <div class="p-3.5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
        <div>
          Total Customers: <span class="font-bold text-gray-900">{{ filteredCustomers.length }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>Rows:</span>
          <select 
            v-model.number="pageSize" 
            @change="currentPage = 1"
            class="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-[#4ecdc4]"
          >
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="-1">All ({{ filteredCustomers.length }})</option>
          </select>
        </div>
      </div>

      <div ref="tableContainerRef" class="overflow-x-auto min-h-[350px]">
        <table class="w-full text-left border-collapse table-auto">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest min-w-[200px]">Company</th>
              <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest min-w-[160px]">Contact Person</th>
              <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-36 min-w-[130px]">Phone</th>
              <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-32 min-w-[110px]">City</th>
              <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-32 min-w-[110px]">Payment Terms</th>
              <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-24 min-w-[90px]">Status</th>
              <th v-if="user?.role === 'ADMIN'" class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-24 min-w-[80px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 text-sm">
            <template v-if="pending">
              <tr v-for="i in 5" :key="i" class="animate-pulse hover:bg-transparent">
                <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-1/2"></div></td>
                <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
                <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-20"></div></td>
                <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
                <td class="px-5 py-3.5"><div class="h-5 bg-gray-200 rounded-full w-16"></div></td>
                <td v-if="user?.role === 'ADMIN'" class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
              </tr>
            </template>
            <template v-else>
              <tr v-if="filteredCustomers.length === 0" class="hover:bg-gray-50">
                <td colspan="7" class="px-6 py-12 text-center text-gray-500">No customers found.</td>
              </tr>
              <tr 
                v-for="customer in paginatedCustomers" 
                :key="customer.id" 
                @click="openCustomerDetail(customer)"
                class="hover:bg-teal-50/40 cursor-pointer transition-colors group"
              >
                <td class="px-5 py-3 font-medium text-[#1a1a1a] min-w-[200px] group-hover:text-[#1a5c4c] transition-colors">
                  <span class="break-words line-clamp-2" :title="customer.company">{{ customer.company }}</span>
                </td>
                <td class="px-5 py-3 text-gray-600 min-w-[160px]">
                  <span class="break-words line-clamp-2" :title="customer.name">{{ customer.name }}</span>
                </td>
                <td class="px-5 py-3 font-mono text-xs text-gray-600 w-36 min-w-[130px]">{{ customer.phone }}</td>
                <td class="px-5 py-3 text-gray-600 w-32 min-w-[110px]">{{ customer.city || '-' }}</td>
                <td class="px-5 py-3 w-32 min-w-[110px]">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                    {{ formatPaymentTerms(customer.paymentTerms) }}
                  </span>
                </td>
                <td class="px-5 py-3 w-24 min-w-[90px]">
                  <span 
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="customer.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ customer.isActive !== false ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td v-if="user?.role === 'ADMIN'" @click.stop class="px-5 py-3 text-right w-28 min-w-[100px]">
                  <div class="flex items-center justify-end gap-1.5">
                    <button 
                      @click="openCustomerPinModal(customer)"
                      class="transition-colors p-1.5 rounded"
                      :class="customer.latitude && customer.longitude ? 'text-[#1a5c4c] bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-300 shadow-xs' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'"
                      :title="customer.latitude && customer.longitude ? `📍 Saved Pin: ${customer.latitude.toFixed(4)}, ${customer.longitude.toFixed(4)}${customer.landmark ? ' (' + customer.landmark + ')' : ''}\nClick to view, change or delete pin` : 'Set Delivery Destination Pin'"
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

    <!-- Customer Details Modal Popup (Untruncated) -->
    <div 
      v-if="isDetailModalOpen && selectedCustomer" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div 
        ref="detailBackdropRef"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        @click="closeCustomerDetail"
      ></div>

      <div 
        ref="detailModalRef"
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
      >
        <!-- Header -->
        <div class="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Building2 class="w-4 h-4 text-[#1a5c4c]" />
            Customer Profile
          </div>
          <button 
            @click="closeCustomerDetail" 
            class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
            title="Close"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- Full Company Name & Status -->
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Company / Firm</span>
              <h2 class="text-xl font-bold text-gray-900 leading-snug break-words">
                {{ selectedCustomer.company }}
              </h2>
            </div>
            <span 
              class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold shrink-0 mt-1"
              :class="selectedCustomer.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
            >
              <CheckCircle2 v-if="selectedCustomer.isActive !== false" class="w-3.5 h-3.5" />
              <XCircle v-else class="w-3.5 h-3.5" />
              {{ selectedCustomer.isActive !== false ? 'Active Account' : 'Inactive' }}
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

            <!-- Phone -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Phone class="w-3.5 h-3.5" />
                Phone Number
              </div>
              <a :href="`tel:${selectedCustomer.phone}`" class="text-sm font-mono font-semibold text-[#1a5c4c] hover:underline">
                {{ selectedCustomer.phone }}
              </a>
            </div>

            <!-- Email -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Mail class="w-3.5 h-3.5" />
                Email Address
              </div>
              <div class="text-sm font-medium text-gray-900 break-all">
                <a v-if="selectedCustomer.email" :href="`mailto:${selectedCustomer.email}`" class="text-[#1a5c4c] hover:underline">
                  {{ selectedCustomer.email }}
                </a>
                <span v-else class="text-gray-400 italic">Not Provided</span>
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
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <ShieldCheck class="w-3.5 h-3.5" />
                GSTIN / Tax ID
              </div>
              <div class="font-mono text-sm font-semibold text-gray-900 uppercase">
                {{ selectedCustomer.gstNumber || 'Not Registered' }}
              </div>
            </div>

            <!-- City & State -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <MapPin class="w-3.5 h-3.5" />
                Location
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ [selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(', ') || 'Not Specified' }}
                <span v-if="selectedCustomer.pincode" class="text-xs text-gray-500 font-normal">({{ selectedCustomer.pincode }})</span>
              </div>
            </div>
          </div>

          <!-- Delivery Destination Pin Status -->
          <div class="p-4 rounded-xl border transition-colors" :class="selectedCustomer.latitude && selectedCustomer.longitude ? 'bg-emerald-50/70 border-emerald-200' : 'bg-gray-50 border-gray-100'">
            <div class="flex items-center justify-between">
              <div class="flex items-start gap-2.5">
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" :class="selectedCustomer.latitude && selectedCustomer.longitude ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'">
                  <MapPin class="w-3.5 h-3.5" />
                </div>
                <div>
                  <span class="text-xs font-bold block" :class="selectedCustomer.latitude && selectedCustomer.longitude ? 'text-emerald-950' : 'text-gray-700'">
                    {{ selectedCustomer.latitude && selectedCustomer.longitude ? 'Saved Delivery Pin' : 'No Delivery Pin Set' }}
                  </span>
                  <p v-if="selectedCustomer.latitude && selectedCustomer.longitude" class="text-xs text-emerald-800 font-mono mt-0.5">
                    {{ selectedCustomer.latitude.toFixed(4) }}, {{ selectedCustomer.longitude.toFixed(4) }}
                    <span v-if="selectedCustomer.landmark" class="font-sans font-medium text-emerald-700 ml-1">({{ selectedCustomer.landmark }})</span>
                  </p>
                  <p v-else class="text-[11px] text-gray-500 mt-0.5">
                    Pinning this customer's gate enables 1-click GPS navigation for truck drivers.
                  </p>
                </div>
              </div>
              <button 
                v-if="user?.role === 'ADMIN'"
                @click="openCustomerPinModal(selectedCustomer)"
                class="px-3 py-1.5 text-xs font-bold rounded-lg border shadow-xs transition-colors shrink-0 flex items-center gap-1"
                :class="selectedCustomer.latitude && selectedCustomer.longitude ? 'bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-[#1a5c4c] text-white hover:bg-[#14483b] border-[#1a5c4c]'"
              >
                <MapPin class="w-3.5 h-3.5" />
                <span>{{ selectedCustomer.latitude && selectedCustomer.longitude ? 'Manage Pin' : 'Set Pin' }}</span>
              </button>
            </div>
          </div>

          <!-- Full Address -->
          <div v-if="selectedCustomer.address" class="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span class="text-xs text-gray-400 font-medium block mb-1">Registered Address</span>
            <p class="text-sm text-gray-800 leading-relaxed whitespace-pre-line break-words">
              {{ selectedCustomer.address }}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <div>
            <button 
              v-if="user?.role === 'ADMIN'"
              @click="editCustomerFromDetail()"
              class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1a5c4c] bg-[#1a5c4c]/10 hover:bg-[#1a5c4c]/20 rounded-lg transition-colors"
            >
              <Edit2 class="w-3.5 h-3.5" />
              Edit Customer
            </button>
          </div>
          <button 
            @click="closeCustomerDetail" 
            class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Edit / Add Modal Form -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        ref="formBackdropRef"
        class="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        @click="closeModal"
      ></div>
      
      <div 
        ref="formModalRef"
        class="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-[#1a1a1a]">
            {{ editingCustomer ? 'Edit Customer' : 'Add New Customer' }}
          </h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <div :class="['p-6 overflow-y-auto flex-1 transition-all duration-300', snackbarState !== 'hidden' ? 'pb-24' : '']">
          <form @submit.prevent="saveCustomer" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Company Name *</label>
              <input v-model="form.company" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>
            
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Contact Name *</label>
              <input v-model="form.name" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Phone *</label>
              <input v-model="form.phone" required type="tel" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Email</label>
              <input v-model="form.email" type="email" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1 md:col-span-2">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Address</label>
              <textarea v-model="form.address" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm"></textarea>
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">City</label>
              <input v-model="form.city" type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">State</label>
              <input v-model="form.state" type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Pincode</label>
              <input v-model="form.pincode" type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">GST Number</label>
              <input v-model="form.gstNumber" type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm uppercase" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Payment Terms</label>
              <CustomSelect 
                :modelValue="form.paymentTerms"
                @update:modelValue="val => form.paymentTerms = val"
                :options="paymentTermsOptions"
                placeholder="Select Payment Terms"
                class="w-full"
              />
            </div>

            <div class="space-y-1 flex items-center pt-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="form.isActive" type="checkbox" class="w-4 h-4 text-[#1a5c4c] border-gray-300 rounded focus:ring-[#4ecdc4]" />
                <span class="text-sm text-gray-700">Active Customer</span>
              </label>
            </div>
          </form>
        </div>
      </div>
    </div>

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
import { ref, computed, watch, nextTick } from 'vue'
import { 
  Plus, Search, Edit2, X, Loader2, Building2, User, Phone, Mail, 
  MapPin, CreditCard, ShieldCheck, CheckCircle2, XCircle, ChevronLeft, ChevronRight 
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import SetDeliveryPinModal from '~/components/dashboard/SetDeliveryPinModal.vue'
import CustomSelect from '~/components/ui/CustomSelect.vue'

definePageMeta({ layout: 'dashboard' })

const { user } = useAuth()
const { showEditing, showSaving, showSaved, hide, snackbarState } = useSnackbar()
const { animateModalOpen, animateStagger, initContext } = useGsapAnimation()

const paymentTermsOptions = [
  { label: 'COD (Cash on Delivery)', value: 'COD' },
  { label: '15 Days', value: '15_DAYS' },
  { label: '30 Days', value: '30_DAYS' },
  { label: '45 Days', value: '45_DAYS' },
  { label: '60 Days', value: '60_DAYS' }
]

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

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tableContainerRef.value && !pending.value) {
      const rows = tableContainerRef.value.querySelectorAll('tbody tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

onMounted(() => {
  initContext(tableContainerRef.value || undefined)
  triggerRowAnimation()
})

// Pagination state
const currentPage = ref(1)
const pageSize = ref(50)

watch(searchQuery, () => {
  currentPage.value = 1
})

// Form data
const form = ref({
  company: '', 
  name: '', 
  phone: '', 
  email: '', 
  address: '', 
  city: '', 
  state: '', 
  pincode: '', 
  gstNumber: '', 
  paymentTerms: 'COD', 
  isActive: true
})

// Fetch data
const { data: customers, pending, refresh } = useFetch('/api/customers', {
  default: () => [
    { id: '1', name: 'Rajesh Patel', company: 'ABC Interiors', phone: '+91 98765 43210', city: 'Ahmedabad', paymentTerms: '30_DAYS', isActive: true },
    { id: '2', name: 'Neha Gupta', company: 'Royal Designs', phone: '+91 87654 32109', city: 'Ahmedabad', paymentTerms: '15_DAYS', isActive: true },
  ]
})

// Computed filtering with multi-token smart search
const filteredCustomers = computed(() => {
  if (!customers.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return customers.value as any[]

  const terms = q.split(/\s+/).filter(Boolean)
  return (customers.value as any[]).filter(c => {
    const searchableText = `${c.company || ''} ${c.name || ''} ${c.phone || ''} ${c.email || ''} ${c.city || ''} ${c.state || ''} ${c.gstNumber || ''}`.toLowerCase()
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

watch([paginatedCustomers, pending], () => {
  if (!pending.value) {
    triggerRowAnimation()
  }
}, { immediate: false })

const startIndex = computed(() => {
  if (filteredCustomers.value.length === 0) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const endIndex = computed(() => {
  if (pageSize.value === -1) return filteredCustomers.value.length
  return Math.min(currentPage.value * pageSize.value, filteredCustomers.value.length)
})

// Methods
const formatPaymentTerms = (term: string) => {
  return term ? term.replace('_', ' ') : 'N/A'
}

const initialFormStr = ref('')

const openModal = (customer: any = null) => {
  if (customer) {
    editingCustomer.value = customer
    form.value = {
      company: customer.company || '',
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      gstNumber: customer.gstNumber || '',
      paymentTerms: customer.paymentTerms || 'COD',
      isActive: customer.isActive !== false
    }
  } else {
    editingCustomer.value = null
    form.value = {
      company: '', 
      name: '', 
      phone: '', 
      email: '', 
      address: '', 
      city: '', 
      state: '', 
      pincode: '', 
      gstNumber: '', 
      paymentTerms: 'COD', 
      isActive: true
    }
  }
  initialFormStr.value = JSON.stringify(form.value)
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
  if (!form.value.company || !form.value.name || !form.value.phone) return
  
  isSaving.value = true
  showSaving()
  try {
    const url = editingCustomer.value ? `/api/customers/${editingCustomer.value.id}` : '/api/customers'
    const method = editingCustomer.value ? 'PATCH' : 'POST'
    
    await $fetch(url, { method, body: form.value })
    await refresh()
    
    closeModal()
    showSaved('Customer saved successfully')
  } catch (e) {
    console.error('Failed to save customer', e)
    hide()
  } finally {
    isSaving.value = false
  }
}

watch(form, () => {
  if (isModalOpen.value) {
    if (JSON.stringify(form.value) !== initialFormStr.value) {
      showEditing('Unsaved customer changes', saveCustomer, closeModal)
    } else {
      hide()
    }
  }
}, { deep: true })
</script>
