<template>
  <div class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto pb-12">
    <!-- Header with Title, Live Badge, Sync Info & Quick Actions (Matching billing.vue:195-213) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">BUSY Voucher Explorer</h1>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Mirror
          </span>
          <span v-if="formattedLastSynced" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200" :title="'Server sync time: ' + (lastSynced || '')">
            <Clock class="w-3.5 h-3.5 text-gray-400" />
            <span>Synced: {{ formattedLastSynced }}</span>
          </span>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Review BUSY ERP sales vouchers, search customer history, and inspect GST breakdowns.
        </p>
      </div>

      <!-- Action Button (Matching billing.vue Refresh Button) -->
      <div class="flex items-center gap-3">
        <button
          @click="fetchVouchers(true)"
          :disabled="isLoading"
          class="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh voucher records"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards (Matching billing.vue:216-284 exact structure & typography) -->
    <div ref="statsContainerRef" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 select-none">
      <!-- 1. Total Vouchers -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-[#1b3b5f]/10 p-2 sm:p-2.5 rounded-lg text-[#1b3b5f] border border-[#1b3b5f]/20">
              <Receipt class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-[#1b3b5f] rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 truncate">Total Sales Invoices</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="stats?.totalCount || pagination.total || 0" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-gray-500 font-medium truncate">Synced vouchers</p>
          </div>
        </div>
      </div>

      <!-- 2. Total Invoiced Value -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-emerald-50 p-2 sm:p-2.5 rounded-lg text-emerald-600 border border-emerald-100/50">
              <IndianRupee class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-emerald-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5 truncate">Total Invoiced Amount</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="stats?.totalAmount || 0" prefix="₹" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-emerald-600 font-medium truncate">Gross sales value</p>
          </div>
        </div>
      </div>

      <!-- 3. GST Tax Collected -->
      <div class="bg-white rounded-xl border border-[#e5e2dc] p-3.5 sm:p-5 shadow-sm">
        <div class="flex gap-2.5 sm:gap-4">
          <div class="flex flex-col justify-between shrink-0">
            <div class="bg-sky-50 p-2 sm:p-2.5 rounded-lg text-sky-600 border border-sky-100/50">
              <ShieldCheck class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div class="w-6 sm:w-8 h-1 bg-sky-500 rounded-full mt-4 sm:mt-6"></div>
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <p class="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-0.5 truncate">Total GST Collected</p>
            <h3 class="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">
              <OdometerNumber :value="stats?.totalTax || 0" prefix="₹" :loading="isLoading" />
            </h3>
            <p class="text-[11px] sm:text-xs text-sky-600 font-medium truncate">Taxable: {{ formatCurrency(stats?.totalTaxable || 0) }}</p>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Search & Filter Controls Toolbar (Matching BillingTable.vue:104-145) -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-4 flex flex-col sm:flex-row justify-between items-center gap-3.5 bg-gray-50/50">
        <!-- Search Input matching BillingTable.vue:106-122 -->
        <div class="relative w-full sm:w-80">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            v-model="searchInput"
            @input="onSearchInput"
            type="text"
            placeholder="Search order #, customer, invoice..."
            class="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition-all"
          />
          <button
            v-if="searchInput"
            @click="clearSearch"
            class="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Sales Series Indicator -->
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 font-semibold border border-sky-100">
            <Receipt class="w-3.5 h-3.5" />
            BUSY Sales Series: SMG
          </span>
        </div>
      </div>

      <!-- Date Presets & Filter Row -->
      <div class="px-4 py-2.5 border-t border-gray-200 bg-white flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-medium text-gray-400 mr-1 flex items-center gap-1">
            <Calendar class="w-3.5 h-3.5" /> Date:
          </span>
          <button
            v-for="preset in datePresets"
            :key="preset.id"
            @click="selectDatePreset(preset.id)"
            class="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            :class="selectedDatePreset === preset.id ? 'bg-[#1b3b5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            {{ preset.label }}
          </button>

          <button
            @click="selectedDatePreset = 'custom'"
            class="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            :class="selectedDatePreset === 'custom' ? 'bg-[#1b3b5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            Custom Range
          </button>
        </div>

        <!-- Custom Date Range Inputs -->
        <div v-if="selectedDatePreset === 'custom'" class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1 text-xs text-gray-500">
            <span>From:</span>
            <input
              v-model="customDateFrom"
              @change="fetchVouchers(false)"
              type="date"
              class="px-2 py-1 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
            />
          </div>
          <div class="flex items-center gap-1 text-xs text-gray-500">
            <span>To:</span>
            <input
              v-model="customDateTo"
              @change="fetchVouchers(false)"
              type="date"
              class="px-2 py-1 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
            />
          </div>
        </div>

        <!-- Reset All Filters -->
        <button
          v-if="hasActiveFilters"
          @click="resetAllFilters"
          class="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition cursor-pointer"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>
    </div>

    <!-- Main Vouchers Table Container (Matching BillingTable.vue) -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative">
      <LoadingTopBar :loading="isLoading" />

      <!-- Toolbar Header -->
      <div class="px-5 py-3 border-b border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <div>
          Showing <span class="font-bold text-gray-900">{{ vouchers.length }}</span> of
          <span class="font-bold text-gray-900">{{ pagination.total.toLocaleString() }}</span> vouchers
          <span v-if="hasActiveFilters" class="text-sky-600 ml-1 font-semibold">(filtered)</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span>Rows:</span>
            <RowsPerPageSelect
              :modelValue="pageSize"
              @update:modelValue="onPageSizeChange"
              :options="[15, 25, 50, 100]"
            />
          </div>
        </div>
      </div>

      <!-- Skeletons when initial loading -->
      <div v-if="isLoading && vouchers.length === 0">
        <div class="hidden md:block overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th class="px-5 py-3.5 whitespace-nowrap">Voucher No</th>
                <th class="px-5 py-3.5 whitespace-nowrap">Date</th>
                <th class="px-5 py-3.5">Customer & Series</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right">Invoice Amount</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
              </tr>
            </thead>
            <TableSkeletonRows :cols="6" :rows="5" />
          </table>
        </div>
        <TableSkeletonRows :cols="6" :rows="5" :isMobileOnly="true" :renderMobile="true" />
      </div>

      <!-- Empty State (Matching BillingTable.vue:195-201) -->
      <div v-else-if="vouchers.length === 0" class="py-14 text-center text-gray-400">
        <Receipt class="w-8 h-8 mx-auto text-gray-300 mb-2" />
        <p class="text-sm font-semibold text-gray-700">No vouchers found</p>
        <p class="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
          No BUSY sales invoices matching your criteria were found.
        </p>
        <button
          v-if="hasActiveFilters"
          @click="resetAllFilters"
          class="mt-3 px-3 py-1.5 text-xs font-semibold text-[#1b3b5f] bg-sky-50 hover:bg-sky-100 rounded-lg transition cursor-pointer"
        >
          Reset All Filters
        </button>
      </div>

      <!-- Content Views (Desktop Table + Mobile Cards) -->
      <div v-else>
        <!-- DESKTOP TABLE VIEW (Matching BillingTable.vue:152-328 exact classes) -->
        <div class="hidden md:block overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse min-w-full text-sm text-gray-600">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th class="px-5 py-3.5 whitespace-nowrap">Voucher No</th>
                <th class="px-5 py-3.5 whitespace-nowrap">Date</th>
                <th class="px-5 py-3.5">Customer & Series</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-center">Items</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right">Invoice Amount</th>
                <th class="px-5 py-3.5 whitespace-nowrap text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody ref="tbodyRef" class="divide-y divide-gray-100 bg-white">
              <tr
                v-for="v in vouchers"
                :key="'desk-' + v.id"
                @click="openVoucherDrawer(v)"
                class="cursor-pointer hover:bg-gray-50/80 transition-colors duration-150 group"
              >
                <!-- 1. Voucher No (Matching BillingTable.vue Order ID) -->
                <td class="px-5 py-3.5 whitespace-nowrap">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-bold text-gray-900 group-hover:text-[#1b3b5f] transition-colors">
                      {{ v.voucherNo }}
                    </span>
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                      {{ v.series || 'SMG' }}
                    </span>
                  </div>
                  <p class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    BUSY {{ v.voucherType || 'Sales' }}
                  </p>
                </td>

                <!-- 2. Date -->
                <td class="px-5 py-3.5 whitespace-nowrap">
                  <span class="text-xs text-gray-700">
                    {{ formatDate(v.voucherDate) }}
                  </span>
                </td>

                <!-- 3. Customer (Matching BillingTable.vue Customer & Tier) -->
                <td class="px-5 py-3.5 min-w-0">
                  <div class="text-xs font-semibold text-gray-900 truncate" :title="v.customerName">
                    {{ v.customerName }}
                  </div>
                  <p v-if="v.customerCode" class="text-[11px] text-gray-500 truncate mt-0.5 tabular-nums">
                    {{ v.customerCode }}
                  </p>
                </td>

                <!-- 4. Items (Matching BillingTable.vue Items) -->
                <td class="px-5 py-3.5 whitespace-nowrap text-center">
                  <div class="text-xs font-bold text-gray-800">
                    {{ v.itemCount || (v.items ? v.items.length : 0) }} {{ (v.itemCount === 1 || (v.items && v.items.length === 1)) ? 'item' : 'items' }}
                  </div>
                </td>

                <!-- 5. Amount (Matching BillingTable.vue Amount) -->
                <td class="px-5 py-3.5 whitespace-nowrap text-right">
                  <span class="text-xs font-bold text-gray-900 tabular-nums">
                    {{ formatCurrency(v.totalAmount) }}
                  </span>
                  <p v-if="v.taxAmount" class="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    Tax: {{ formatCurrency(v.taxAmount) }}
                  </p>
                </td>

                <!-- 6. Action Button (Matching BillingTable.vue View Bill button) -->
                <td class="px-5 py-3.5 text-right whitespace-nowrap pr-5">
                  <div class="flex items-center justify-end">
                    <button
                      @click.stop="openVoucherDrawer(v)"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span>View Bill</span>
                      <ChevronRight class="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MOBILE VIEW (Matching BillingTable.vue:351-420 exact 2-line cards) -->
        <div ref="mobileListRef" class="block md:hidden divide-y divide-gray-100 bg-white">
          <div
            v-for="v in vouchers"
            :key="'mob-' + v.id"
            @click="openVoucherDrawer(v)"
            class="px-3.5 py-3 cursor-pointer transition-colors flex flex-col gap-1.5 hover:bg-gray-50 active:bg-gray-100"
          >
            <!-- LINE 1: Voucher No, Series, Customer & Date -->
            <div class="flex items-center justify-between gap-2 min-w-0">
              <div class="flex items-center gap-1.5 min-w-0 flex-1">
                <span class="text-xs font-bold text-gray-900 shrink-0">
                  {{ v.voucherNo }}
                </span>
                <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 bg-sky-100 text-sky-800">
                  {{ v.series || 'SMG' }}
                </span>
                <span class="text-gray-300 text-xs shrink-0">&bull;</span>
                <span class="text-xs font-semibold text-gray-700 truncate" :title="v.customerName">
                  {{ v.customerName }}
                </span>
              </div>
              <span class="text-[11px] text-gray-400 tabular-nums shrink-0">
                {{ formatDate(v.voucherDate) }}
              </span>
            </div>

            <!-- LINE 2: Amount, Items, Tax & View -->
            <div class="flex items-center justify-between gap-2 min-w-0 pt-0.5">
              <div class="flex items-baseline gap-1.5 min-w-0">
                <span class="text-xs font-bold text-gray-900 tabular-nums shrink-0">
                  {{ formatCurrency(v.totalAmount) }}
                </span>
                <span class="text-[11px] text-gray-400 font-normal shrink-0">
                  ({{ v.itemCount || (v.items ? v.items.length : 0) }} items)
                </span>
                <span v-if="v.taxAmount" class="text-gray-300 text-[10px] shrink-0">&bull;</span>
                <span v-if="v.taxAmount" class="text-[11px] text-gray-400 tabular-nums truncate">
                  Tax: {{ formatCurrency(v.taxAmount) }}
                </span>
              </div>

              <span class="text-xs font-semibold text-[#1b3b5f] flex items-center gap-0.5 shrink-0">
                <span>View</span>
                <ChevronRight class="w-3 h-3 text-gray-400" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div v-if="pagination.totalPages > 1" class="px-5 py-3 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
        <div class="order-2 sm:order-1 text-center sm:text-left">
          Page <span class="font-bold text-gray-900">{{ pagination.page }}</span> of
          <span class="font-bold text-gray-900">{{ pagination.totalPages }}</span>
          <span class="text-gray-400 ml-1">({{ pagination.total.toLocaleString() }} total)</span>
        </div>

        <div class="order-1 sm:order-2 flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
          <button
            @click="goToPage(pagination.page - 1)"
            :disabled="pagination.page <= 1 || isLoading"
            class="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-1 shadow-2xs cursor-pointer text-xs"
          >
            <ChevronLeft class="w-3.5 h-3.5" /> Prev
          </button>
          <span class="sm:hidden text-xs font-semibold px-2 tabular-nums">
            {{ pagination.page }} / {{ pagination.totalPages }}
          </span>
          <button
            @click="goToPage(pagination.page + 1)"
            :disabled="pagination.page >= pagination.totalPages || isLoading"
            class="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-1 shadow-2xs cursor-pointer text-xs"
          >
            Next <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Line Items Slide-Over Drawer / Modal (Matching OrderDetailPanel.vue:1034-1644 exact width & font sizes) -->
    <Teleport to="body">
      <div
        v-if="isDrawerOpen"
        class="fixed inset-0 z-[150] overflow-hidden"
        @keydown.escape="closeVoucherDrawer"
      >
        <!-- Backdrop -->
        <div
          ref="drawerBackdropRef"
          @click="closeVoucherDrawer"
          class="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
        ></div>

        <!-- Slide-over Panel (Matching OrderDetailPanel.vue:1036 standard width: sm:max-w-[500px] md:max-w-[540px]) -->
        <div class="fixed inset-y-0 right-0 max-w-full flex w-full justify-end">
          <div ref="drawerPanelRef" class="w-full sm:max-w-[500px] md:max-w-[540px] bg-white shadow-2xl border-l border-gray-200/80 flex flex-col h-full overflow-hidden">
            <!-- 1. Drawer Header (Matching OrderDetailPanel.vue:1043-1110) -->
            <div class="px-5 sm:px-6 py-3.5 border-b border-gray-200/80 flex items-center justify-between bg-white flex-shrink-0 z-10">
              <div class="flex items-center gap-2 flex-wrap min-w-0">
                <div class="flex items-center gap-1.5">
                  <h2 class="text-base sm:text-lg font-bold font-mono tracking-tight text-gray-950">
                    {{ selectedVoucher?.voucherNo }}
                  </h2>
                  <button
                    @click="copyVoucherNumber"
                    class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition cursor-pointer"
                    :title="copiedVoucherNo ? 'Copied to clipboard!' : 'Copy Voucher Number'"
                  >
                    <Check v-if="copiedVoucherNo" class="w-3.5 h-3.5 text-emerald-600" />
                    <Copy v-else class="w-3.5 h-3.5" />
                  </button>
                </div>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="selectedVoucher?.series === 'SMG' ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'"
                >
                  {{ selectedVoucher?.series === 'SMG' ? 'Wholesale (SMG)' : 'Retail Direct' }}
                </span>
              </div>

              <button
                @click="closeVoucherDrawer"
                class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Close Panel"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- 2. Sub-header Quick Snapshot (Matching OrderDetailPanel.vue:1114-1144) -->
            <div class="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-b from-gray-50/90 to-gray-50/40 border-b border-gray-200/80 flex-shrink-0">
              <div class="flex items-center justify-between gap-3 sm:gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <Building2 class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <h3 class="text-sm font-bold text-gray-900 truncate">
                      {{ selectedVoucher?.customerName || 'Customer' }}
                    </h3>
                  </div>
                  <div class="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 mt-0.5">
                    <span v-if="selectedVoucher?.customerCode" class="font-mono text-gray-700">{{ selectedVoucher.customerCode }}</span>
                    <span v-if="selectedVoucher?.customerCode" class="w-1 h-1 rounded-full bg-gray-400 shrink-0 self-center" />
                    <span class="whitespace-nowrap shrink-0">Billed on {{ formatDate(selectedVoucher?.voucherDate) }}</span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm sm:text-lg font-black text-[#1b3b5f] tracking-tight tabular-nums">
                    {{ formatCurrency(selectedVoucher?.totalAmount || 0) }}
                  </div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200/70 text-gray-700 mt-0.5">
                    {{ selectedVoucher?.items?.length || 0 }} {{ selectedVoucher?.items?.length === 1 ? 'item' : 'items' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 3. Drawer Body (Scrollable) -->
            <div class="flex-grow overflow-y-auto bg-white p-4 sm:p-6 space-y-4">
              <!-- Quick 3 KPI Cards -->
              <div class="grid grid-cols-3 gap-2">
                <div class="px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-400">Taxable</p>
                  <p class="font-mono text-xs font-bold text-gray-700 truncate mt-0.5">
                    {{ formatCurrency(selectedVoucher?.taxableAmount) }}
                  </p>
                </div>
                <div class="px-2.5 py-1.5 bg-emerald-50/70 rounded-lg border border-emerald-200 text-center">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Total Tax</p>
                  <p class="font-mono text-xs font-bold text-emerald-800 truncate mt-0.5">
                    {{ formatCurrency(selectedVoucher?.taxAmount) }}
                  </p>
                </div>
                <div class="px-2.5 py-1.5 bg-[#1b3b5f]/10 rounded-lg border border-[#1b3b5f]/30 text-center">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-[#1b3b5f]">Grand Total</p>
                  <p class="font-mono text-xs font-extrabold text-[#1b3b5f] truncate mt-0.5">
                    {{ formatCurrency(selectedVoucher?.totalAmount) }}
                  </p>
                </div>
              </div>

              <!-- Itemized Line Items Table (Matching OrderDetailPanel.vue:1551-1644 exact typography & spacing) -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Package class="w-3.5 h-3.5 text-gray-400" />
                    Itemized Line Items
                  </span>
                  <NuxtLink
                    v-if="selectedVoucher?.customerCode"
                    :to="`/dashboard/customers?search=${encodeURIComponent(selectedVoucher.customerCode)}`"
                    class="text-[11px] text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1"
                  >
                    <span>View Customer</span>
                    <ExternalLink class="w-3 h-3" />
                  </NuxtLink>
                </div>

                <div v-if="!selectedVoucher?.items || selectedVoucher.items.length === 0" class="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  No individual item lines recorded on this invoice.
                </div>

                <div v-else class="overflow-x-auto border border-gray-200/80 rounded-xl shadow-2xs">
                  <table class="w-full text-left text-xs sm:text-sm">
                    <thead class="bg-gray-50/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200/70">
                      <tr>
                        <th class="px-3.5 py-2.5 font-semibold">Product</th>
                        <th class="px-3 py-2.5 font-semibold text-right">Rate</th>
                        <th class="px-3 py-2.5 font-semibold text-right">Qty</th>
                        <th class="px-3.5 py-2.5 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                      <tr
                        v-for="(item, idx) in selectedVoucher.items"
                        :key="'item-' + idx"
                        class="bg-white hover:bg-gray-50/60 transition-colors"
                      >
                        <!-- Product (Matching OrderDetailPanel.vue:1578-1606) -->
                        <td class="px-3.5 py-2.5">
                          <div class="font-mono font-bold text-xs text-gray-900 truncate max-w-[160px] sm:max-w-[200px]" :title="item.name">
                            {{ item.name }}
                          </div>
                          <div class="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                            <span v-if="item.sku" class="font-mono">SKU: {{ item.sku }}</span>
                            <span v-if="item.hsn" class="font-mono bg-gray-100 px-1 py-0.2 rounded text-[10px] text-gray-700">HSN: {{ item.hsn }}</span>
                            <span v-if="item.taxRate" class="font-mono text-emerald-700 text-[10px]">GST {{ item.taxRate }}%</span>
                          </div>
                        </td>

                        <!-- Rate (Matching OrderDetailPanel.vue:1610-1612) -->
                        <td class="px-3 py-2.5 text-right font-medium text-gray-600 tabular-nums whitespace-nowrap text-xs">
                          {{ formatCurrency(item.rate) }}
                        </td>

                        <!-- Qty (Matching OrderDetailPanel.vue:1615-1638) -->
                        <td class="px-3 py-2.5 font-bold tabular-nums whitespace-nowrap text-right text-gray-900 text-xs">
                          {{ item.qty }}
                        </td>

                        <!-- Total (Matching OrderDetailPanel.vue:1641-1643) -->
                        <td class="px-3.5 py-2.5 text-right font-bold text-[#1b3b5f] tabular-nums whitespace-nowrap text-xs">
                          {{ formatCurrency(item.amount) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Comprehensive Tax Invoice Summary Card (Matching OrderDetailPanel.vue design) -->
              <div class="p-3.5 sm:p-4 bg-gray-50/80 rounded-xl border border-gray-200/70 space-y-1.5 text-xs">
                <div class="flex items-center justify-between text-gray-600">
                  <span>Taxable Subtotal:</span>
                  <span class="font-mono font-semibold text-gray-800">{{ formatCurrency(selectedVoucher?.taxableAmount) }}</span>
                </div>
                <div v-if="Number(selectedVoucher?.cgstAmount) > 0" class="flex items-center justify-between text-gray-600">
                  <span>CGST (Central Tax):</span>
                  <span class="font-mono font-semibold text-gray-800">{{ formatCurrency(selectedVoucher?.cgstAmount) }}</span>
                </div>
                <div v-if="Number(selectedVoucher?.sgstAmount) > 0" class="flex items-center justify-between text-gray-600">
                  <span>SGST (State Tax):</span>
                  <span class="font-mono font-semibold text-gray-800">{{ formatCurrency(selectedVoucher?.sgstAmount) }}</span>
                </div>
                <div v-if="Number(selectedVoucher?.igstAmount) > 0" class="flex items-center justify-between text-gray-600">
                  <span>IGST (Integrated Tax):</span>
                  <span class="font-mono font-semibold text-gray-800">{{ formatCurrency(selectedVoucher?.igstAmount) }}</span>
                </div>
                <div class="flex items-center justify-between text-emerald-800 pt-1 border-t border-gray-200/70 font-semibold">
                  <span>Total Tax Amount:</span>
                  <span class="font-mono font-bold">{{ formatCurrency(selectedVoucher?.taxAmount) }}</span>
                </div>
                <div class="flex items-center justify-between text-gray-900 pt-1.5 border-t border-gray-200 font-bold text-sm">
                  <span>Invoice Grand Total:</span>
                  <span class="font-mono text-[#1b3b5f] font-black text-base">{{ formatCurrency(selectedVoucher?.totalAmount) }}</span>
                </div>
              </div>
            </div>

            <!-- Drawer Footer (Matching OrderDetailPanel.vue footer) -->
            <div class="px-5 py-3 border-t border-gray-200/80 bg-gray-50 flex items-center justify-end">
              <button
                @click="closeVoucherDrawer"
                class="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Receipt,
  Search,
  X,
  Calendar,
  Clock,
  RefreshCw,
  IndianRupee,
  ShieldCheck,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Loader2
} from 'lucide-vue-next'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import OdometerNumber from '~/components/ui/OdometerNumber.vue'
import LoadingTopBar from '~/components/ui/LoadingTopBar.vue'
import TableSkeletonRows from '~/components/ui/TableSkeletonRows.vue'
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()
const { animateStagger, animateModalOpen, initContext } = useGsapAnimation()

const statsContainerRef = ref<HTMLElement | null>(null)
const tbodyRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)
const drawerBackdropRef = ref<HTMLElement | null>(null)
const drawerPanelRef = ref<HTMLElement | null>(null)

// Reactive Filter States
const searchInput = ref((route.query.search as string) || '')
const debouncedSearch = ref(searchInput.value)
const selectedDatePreset = ref<string>('all')
const customDateFrom = ref<string>('')
const customDateTo = ref<string>('')

// Pagination
const currentPage = ref(1)
const pageSize = ref(25)

// Data state
const isLoading = ref(false)
const vouchers = ref<any[]>([])

const triggerRowAnimation = () => {
  nextTick(() => {
    if (!isLoading.value) {
      if (tbodyRef.value) {
        const rows = tbodyRef.value.querySelectorAll('tr')
        const targetRows = Array.from(rows).slice(0, 15)
        animateStagger(targetRows, { duration: 0.22, stagger: 0.02, y: 6 })
      }
      if (mobileListRef.value) {
        const cards = Array.from(mobileListRef.value.children).slice(0, 15)
        animateStagger(cards, { duration: 0.22, stagger: 0.02, y: 6 })
      }
    }
  })
}

watch([() => vouchers.value, isLoading], () => {
  triggerRowAnimation()
})
const pagination = ref({
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1
})
const summary = ref({
  totalAmount: 0,
  totalCount: 0
})
const stats = ref<any>(null)
const lastSynced = ref<string | null>(null)

// Drawer state
const selectedVoucher = ref<any>(null)
const isDrawerOpen = ref(false)
const copiedVoucherNo = ref(false)

// Date presets
const datePresets = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'fy2627', label: 'FY 2026-27' }
]

// Active filters detector
const hasActiveFilters = computed(() => {
  return !!debouncedSearch.value || selectedDatePreset.value !== 'all' || !!customDateFrom.value || !!customDateTo.value
})

// Formatted last synced time
const formattedLastSynced = computed(() => {
  if (!lastSynced.value) return null
  const d = new Date(lastSynced.value)
  if (isNaN(d.getTime())) return null
  return (
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) +
    ', ' +
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  )
})

// Computed items sum in drawer
const computedItemsSum = computed(() => {
  const items = selectedVoucher.value?.items
  if (!items) return 0
  const arr = Array.isArray(items) ? items : (typeof items === 'object' ? [items] : [])
  return arr.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0)
})

// Debounce search input
let searchTimer: any = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = searchInput.value.trim()
    currentPage.value = 1
    fetchVouchers(false)
  }, 300)
}

function clearSearch() {
  searchInput.value = ''
  debouncedSearch.value = ''
  currentPage.value = 1
  fetchVouchers(false)
}

function selectDatePreset(presetId: string) {
  selectedDatePreset.value = presetId
  const now = new Date()

  if (presetId === 'all') {
    customDateFrom.value = ''
    customDateTo.value = ''
  } else if (presetId === 'today') {
    const todayStr = now.toISOString().split('T')[0]
    customDateFrom.value = todayStr
    customDateTo.value = todayStr
  } else if (presetId === '7days') {
    const prior = new Date(now)
    prior.setDate(prior.getDate() - 7)
    customDateFrom.value = prior.toISOString().split('T')[0]
    customDateTo.value = now.toISOString().split('T')[0]
  } else if (presetId === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    customDateFrom.value = firstDay.toISOString().split('T')[0]
    customDateTo.value = now.toISOString().split('T')[0]
  } else if (presetId === 'fy2627') {
    customDateFrom.value = '2026-04-01'
    customDateTo.value = '2027-03-31'
  }

  currentPage.value = 1
  fetchVouchers(false)
}

function resetAllFilters() {
  searchInput.value = ''
  debouncedSearch.value = ''
  selectedDatePreset.value = 'all'
  customDateFrom.value = ''
  customDateTo.value = ''
  currentPage.value = 1
  fetchVouchers(false)
}

function onPageSizeChange(newSize: number) {
  pageSize.value = newSize
  currentPage.value = 1
  fetchVouchers(false)
}

function goToPage(page: number) {
  if (page < 1 || page > pagination.value.totalPages) return
  currentPage.value = page
  fetchVouchers(false)
}

// Fetch vouchers from backend API
async function fetchVouchers(includeStats = false) {
  isLoading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      limit: pageSize.value,
      search: debouncedSearch.value,
      sortBy: 'voucherDate',
      sortOrder: 'desc'
    }

    if (customDateFrom.value) params.dateFrom = customDateFrom.value
    if (customDateTo.value) params.dateTo = customDateTo.value
    if (includeStats || !stats.value) params.includeStats = 'true'

    const res: any = await $fetch('/api/vouchers', { params })
    if (res?.success) {
      vouchers.value = res.vouchers || []
      pagination.value = res.pagination || pagination.value
      summary.value = res.summary || summary.value
      if (res.stats) stats.value = res.stats
      if (res.lastSynced) lastSynced.value = res.lastSynced

      // If URL had a specific voucherNo to open
      if (route.query.voucherNo && !isDrawerOpen.value) {
        const target = vouchers.value.find(v => v.voucherNo === route.query.voucherNo)
        if (target) openVoucherDrawer(target)
      }
    }
  } catch (err: any) {
    console.error('Failed to load vouchers:', err)
  } finally {
    isLoading.value = false
  }
}

// Drawer handlers
function openVoucherDrawer(voucher: any) {
  let items = voucher.items
  if (!Array.isArray(items)) {
    items = items && typeof items === 'object' ? [items] : []
  }
  selectedVoucher.value = {
    ...voucher,
    items,
    itemCount: items.length
  }
  isDrawerOpen.value = true
  nextTick(() => {
    animateModalOpen(drawerPanelRef.value, drawerBackdropRef.value, { duration: 0.28 })
  })
}

function closeVoucherDrawer() {
  isDrawerOpen.value = false
  selectedVoucher.value = null
}

function copyVoucherNumber() {
  if (!selectedVoucher.value?.voucherNo) return
  navigator.clipboard.writeText(selectedVoucher.value.voucherNo)
  copiedVoucherNo.value = true
  setTimeout(() => {
    copiedVoucherNo.value = false
  }, 2000)
}

// Formatters
function formatCurrency(val: any) {
  const num = Number(val) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(num)
}

function formatCompactCurrency(val: any) {
  const num = Number(val) || 0
  if (num >= 10000000) {
    return '₹' + (num / 10000000).toFixed(2) + ' Cr'
  }
  if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(2) + ' L'
  }
  return formatCurrency(num)
}

function formatDate(dateVal: any) {
  if (!dateVal) return '-'
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

onMounted(() => {
  initContext(statsContainerRef.value || undefined)
  if (statsContainerRef.value) {
    animateStagger(statsContainerRef.value.children, { duration: 0.35, stagger: 0.06, y: 12 })
  }
  fetchVouchers(true)
})
</script>
