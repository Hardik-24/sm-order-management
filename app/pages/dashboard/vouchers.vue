<template>
  <div class="space-y-6 max-w-[1600px] mx-auto pb-12">
    <!-- Header with Title, Live Badge, Sync Info & Quick Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-gray-900">BUSY Voucher Explorer</h1>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live BUSY Mirror
          </span>
          <span v-if="formattedLastSynced" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200" :title="'Server sync time: ' + (lastSynced || '')">
            <Clock class="w-3.5 h-3.5 text-gray-400" />
            Last Synced: {{ formattedLastSynced }}
          </span>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Search and inspect sales vouchers from BUSY ERP (Wholesale SMG & Retail Direct)
        </p>
      </div>

      <!-- Action Button -->
      <div class="flex items-center gap-2 self-start sm:self-center">
        <button
          @click="fetchVouchers(true)"
          :disabled="isLoading"
          class="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#1b3b5f] rounded-xl hover:bg-[#132c49] active:bg-[#0f233a] transition shadow-xs disabled:opacity-50"
          title="Refresh voucher records"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Summary KPI Cards (Count-Only for Employees) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <!-- Total Vouchers -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Sales Invoices</p>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-gray-900">{{ (stats?.totalCount || pagination.total || 0).toLocaleString() }}</span>
            <span class="text-xs text-gray-500 font-medium">vouchers</span>
          </div>
          <p class="text-xs text-gray-500">
            Synced from BUSY ERP
          </p>
        </div>
        <div class="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b3b5f] shrink-0">
          <Receipt class="w-5 h-5" />
        </div>
      </div>

      <!-- Wholesale (SMG) -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-1.5">
            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Wholesale (SMG)</p>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-700">B2B</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-sky-950">{{ (stats?.smgCount || 0).toLocaleString() }}</span>
            <span class="text-xs text-gray-500 font-medium">vouchers</span>
          </div>
          <p class="text-xs text-gray-500">
            B2B Trade & Dealer invoices
          </p>
        </div>
        <div class="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
          <Building2 class="w-5 h-5" />
        </div>
      </div>

      <!-- Retail Direct -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-1.5">
            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Retail Direct</p>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Counter</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-emerald-950">{{ (stats?.retailCount || 0).toLocaleString() }}</span>
            <span class="text-xs text-gray-500 font-medium">vouchers</span>
          </div>
          <p class="text-xs text-gray-500">
            Direct & Counter billing
          </p>
        </div>
        <div class="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
          <ShoppingBag class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Search & Filter Controls Toolbar -->
    <div class="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1 max-w-lg">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search class="h-4 w-4 text-gray-400" />
          </div>
          <input
            v-model="searchInput"
            @input="onSearchInput"
            type="text"
            placeholder="Search by Voucher No (e.g. SMG2227, 737) or Customer name..."
            class="block w-full pl-10 pr-9 py-2.5 text-sm bg-gray-50/70 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] focus:bg-white transition"
          />
          <button
            v-if="searchInput"
            @click="clearSearch"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Series Selector Pills -->
        <div class="flex items-center gap-1.5 bg-gray-100/90 p-1 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full">
          <button
            v-for="s in seriesOptions"
            :key="s.value"
            @click="selectSeries(s.value)"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1.5"
            :class="selectedSeries === s.value ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'"
          >
            <span>{{ s.label }}</span>
            <span
              v-if="s.count !== undefined"
              class="px-1.5 py-0.2 rounded-full text-[10px]"
              :class="selectedSeries === s.value ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-600'"
            >
              {{ s.count }}
            </span>
          </button>
        </div>
      </div>

      <!-- Date Filter Bar & Quick Shortcuts -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
        <!-- Date Presets -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-medium text-gray-400 mr-1 flex items-center gap-1">
            <Calendar class="w-3.5 h-3.5" /> Date:
          </span>
          <button
            v-for="preset in datePresets"
            :key="preset.id"
            @click="selectDatePreset(preset.id)"
            class="px-2.5 py-1 text-xs rounded-lg transition font-medium"
            :class="selectedDatePreset === preset.id ? 'bg-[#1b3b5f] text-white shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'"
          >
            {{ preset.label }}
          </button>

          <!-- Custom Date Range Button -->
          <button
            @click="selectedDatePreset = 'custom'"
            class="px-2.5 py-1 text-xs rounded-lg transition font-medium flex items-center gap-1"
            :class="selectedDatePreset === 'custom' ? 'bg-[#1b3b5f] text-white shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'"
          >
            <span>Custom Range</span>
          </button>
        </div>

        <!-- Custom Date Range Pickers (Visible when custom selected) -->
        <div v-if="selectedDatePreset === 'custom'" class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1 text-xs text-gray-500">
            <span>From:</span>
            <input
              v-model="customDateFrom"
              @change="fetchVouchers(false)"
              type="date"
              class="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
            />
          </div>
          <div class="flex items-center gap-1 text-xs text-gray-500">
            <span>To:</span>
            <input
              v-model="customDateTo"
              @change="fetchVouchers(false)"
              type="date"
              class="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1b3b5f]"
            />
          </div>
        </div>

        <!-- Reset All Filters -->
        <button
          v-if="hasActiveFilters"
          @click="resetAllFilters"
          class="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 transition"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>
    </div>

    <!-- Main Vouchers Table Container -->
    <div class="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col">
      <!-- Toolbar Header -->
      <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <div>
          Showing <span class="font-bold text-gray-900">{{ vouchers.length }}</span> of
          <span class="font-bold text-gray-900">{{ pagination.total.toLocaleString() }}</span> vouchers
          <span v-if="hasActiveFilters" class="text-sky-600 ml-1">(filtered)</span>
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

      <!-- Loading State -->
      <div v-if="isLoading" class="p-16 flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
        <p class="text-sm font-medium text-gray-500">Loading BUSY sales invoices...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="vouchers.length === 0" class="p-16 flex flex-col items-center justify-center text-center gap-3">
        <div class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
          <Receipt class="w-7 h-7" />
        </div>
        <h3 class="text-base font-semibold text-gray-900">No vouchers found</h3>
        <p class="text-xs text-gray-500 max-w-sm">
          No BUSY sales invoices matched your search and filter criteria. Try adjusting your search term or date range.
        </p>
        <button
          v-if="hasActiveFilters"
          @click="resetAllFilters"
          class="mt-2 px-4 py-2 text-xs font-semibold text-[#1b3b5f] bg-sky-50 hover:bg-sky-100 rounded-xl transition"
        >
          Reset All Filters
        </button>
      </div>

      <!-- Content Views (Desktop Table + Mobile Cards) -->
      <div v-else>
        <!-- DESKTOP TABLE VIEW (hidden md:block) -->
        <div class="hidden md:block w-full overflow-x-auto no-scrollbar">
          <table class="w-full text-left border-collapse table-auto md:min-w-[980px]">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200/80 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                <th class="pl-5 pr-4 py-3.5">Voucher No</th>
                <th class="px-4 py-3.5">Date</th>
                <th class="px-4 py-3.5">Customer / Party</th>
                <th class="px-4 py-3.5 text-center">Series</th>
                <th class="px-4 py-3.5 text-center">Items</th>
                <th class="px-4 py-3.5 text-right">Invoice Amount</th>
                <th class="pr-5 pl-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="v in vouchers"
                :key="'desk-' + v.id"
                @click="openVoucherDrawer(v)"
                class="hover:bg-gray-50/80 transition-colors cursor-pointer group"
              >
                <!-- Voucher No -->
                <td class="pl-5 pr-4 py-3.5 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span
                      class="font-mono text-xs font-bold px-2 py-1 rounded-lg border transition"
                      :class="v.series === 'SMG'
                        ? 'bg-sky-50 text-sky-800 border-sky-200 group-hover:bg-sky-100'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 group-hover:bg-emerald-100'"
                    >
                      {{ v.voucherNo }}
                    </span>
                  </div>
                </td>

                <!-- Date -->
                <td class="px-4 py-3.5 whitespace-nowrap text-xs text-gray-600">
                  <div class="flex items-center gap-1.5">
                    <Calendar class="w-3.5 h-3.5 text-gray-400" />
                    <span>{{ formatDate(v.voucherDate) }}</span>
                  </div>
                </td>

                <!-- Customer -->
                <td class="px-4 py-3.5 max-w-xs">
                  <div class="flex flex-col">
                    <span class="font-semibold text-xs text-gray-900 truncate" :title="v.customerName">
                      {{ v.customerName }}
                    </span>
                    <span v-if="v.customerCode" class="text-[10px] font-mono text-gray-400">
                      {{ v.customerCode }}
                    </span>
                  </div>
                </td>

                <!-- Series -->
                <td class="px-4 py-3.5 whitespace-nowrap text-center">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="v.series === 'SMG'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ v.series === 'SMG' ? 'Wholesale (SMG)' : 'Retail Direct' }}
                  </span>
                </td>

                <!-- Items Count -->
                <td class="px-4 py-3.5 whitespace-nowrap text-center">
                  <span class="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                    <Package class="w-3 h-3 text-gray-400" />
                    {{ v.itemCount || (v.items ? v.items.length : 0) }}
                  </span>
                </td>

                <!-- Total Amount & Tax -->
                <td class="px-4 py-3.5 whitespace-nowrap text-right">
                  <div class="flex flex-col items-end">
                    <span class="font-mono text-xs font-bold text-gray-900">
                      {{ formatCurrency(v.totalAmount) }}
                    </span>
                    <div class="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                      <span>Tax: {{ formatCurrency(v.taxAmount) }}</span>
                    </div>
                  </div>
                </td>

                <!-- Action -->
                <td class="pr-5 pl-4 py-3.5 whitespace-nowrap text-center" @click.stop>
                  <button
                    @click="openVoucherDrawer(v)"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-[#1b3b5f] hover:bg-sky-50 transition"
                    title="View itemized line items"
                  >
                    <Eye class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MOBILE HIGH-DENSITY CARD VIEW (md:hidden) -->
        <div class="md:hidden divide-y divide-gray-100 bg-white">
          <div
            v-for="v in vouchers"
            :key="'mob-' + v.id"
            @click="openVoucherDrawer(v)"
            class="p-4 space-y-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
          >
            <!-- Line 1: Voucher No Badge, Series Pill, Date -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                <span
                  class="font-mono text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0"
                  :class="v.series === 'SMG'
                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'"
                >
                  {{ v.voucherNo }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  :class="v.series === 'SMG' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'"
                >
                  {{ v.series === 'SMG' ? 'Wholesale' : 'Retail' }}
                </span>
              </div>
              <span class="text-[11px] text-gray-500 flex items-center gap-1 shrink-0 font-medium">
                <Calendar class="w-3.5 h-3.5 text-gray-400" />
                {{ formatDate(v.voucherDate) }}
              </span>
            </div>

            <!-- Line 2: Customer Name & Code -->
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-gray-900 leading-snug truncate" :title="v.customerName">
                {{ v.customerName }}
              </h3>
              <span v-if="v.customerCode" class="text-[10px] font-mono text-gray-400">
                {{ v.customerCode }}
              </span>
            </div>

            <!-- Line 3: Items Count & Total Amount with Tax Split -->
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
              <span class="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                <Package class="w-3 h-3 text-gray-400" />
                {{ v.itemCount || (v.items ? v.items.length : 0) }} items
              </span>
              <div class="text-right">
                <span class="font-mono text-xs font-bold text-gray-900">
                  {{ formatCurrency(v.totalAmount) }}
                </span>
                <span v-if="v.taxAmount" class="block text-[10px] font-mono text-gray-500">
                  Tax: {{ formatCurrency(v.taxAmount) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div v-if="pagination.totalPages > 1" class="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
        <div class="order-2 sm:order-1 text-center sm:text-left">
          Page <span class="font-bold text-gray-900">{{ pagination.page }}</span> of
          <span class="font-bold text-gray-900">{{ pagination.totalPages }}</span>
          <span class="text-gray-400 ml-1">({{ pagination.total.toLocaleString() }} total)</span>
        </div>

        <div class="order-1 sm:order-2 flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
          <button
            @click="goToPage(pagination.page - 1)"
            :disabled="pagination.page <= 1 || isLoading"
            class="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-1 shadow-2xs"
          >
            <ChevronLeft class="w-3.5 h-3.5" /> Prev
          </button>
          <span class="sm:hidden font-mono text-xs font-semibold px-2">
            {{ pagination.page }} / {{ pagination.totalPages }}
          </span>
          <button
            @click="goToPage(pagination.page + 1)"
            :disabled="pagination.page >= pagination.totalPages || isLoading"
            class="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-1 shadow-2xs"
          >
            Next <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Line Items Slide-Over Drawer / Modal -->
    <Teleport to="body">
      <div
        v-if="isDrawerOpen"
        class="fixed inset-0 z-[150] overflow-hidden"
        @keydown.escape="closeVoucherDrawer"
      >
        <!-- Backdrop -->
        <div
          @click="closeVoucherDrawer"
          class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        ></div>

        <!-- Slide-over Panel -->
        <div class="fixed inset-y-0 right-0 max-w-full flex w-full sm:w-auto">
          <div class="w-full sm:w-[680px] bg-white shadow-2xl border-l border-gray-200 flex flex-col h-full max-h-screen">
            <!-- Drawer Header (Sticky Top) -->
            <div class="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/90 shrink-0 flex items-start justify-between gap-3">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="font-mono text-base font-bold px-2.5 py-0.5 rounded-lg border"
                    :class="selectedVoucher?.series === 'SMG'
                      ? 'bg-sky-50 text-sky-800 border-sky-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'"
                  >
                    {{ selectedVoucher?.voucherNo }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-semibold"
                    :class="selectedVoucher?.series === 'SMG' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ selectedVoucher?.series === 'SMG' ? 'Wholesale (SMG)' : 'Retail Direct' }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-500 pt-0.5 flex-wrap">
                  <span class="flex items-center gap-1">
                    <Calendar class="w-3.5 h-3.5 text-gray-400" />
                    {{ formatDate(selectedVoucher?.voucherDate) }}
                  </span>
                  <span>•</span>
                  <span>BUSY VchType: {{ selectedVoucher?.voucherType }}</span>
                </div>
              </div>

              <!-- Close & Copy -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  @click="copyVoucherNumber"
                  class="px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition flex items-center gap-1 shadow-2xs"
                  title="Copy Voucher Number"
                >
                  <Check v-if="copiedVoucherNo" class="w-3.5 h-3.5 text-emerald-600" />
                  <Copy v-else class="w-3.5 h-3.5 text-gray-400" />
                  <span class="hidden sm:inline">{{ copiedVoucherNo ? 'Copied' : 'Copy' }}</span>
                </button>
                <button
                  @click="closeVoucherDrawer"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                  title="Close"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Customer & Tax Summary Banner -->
            <div class="p-4 sm:p-5 bg-white border-b border-gray-100 shrink-0 flex flex-col gap-3">
              <div class="min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer / Billed Party</p>
                <p class="font-bold text-sm text-gray-900 mt-0.5 leading-snug">{{ selectedVoucher?.customerName }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span v-if="selectedVoucher?.customerCode" class="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {{ selectedVoucher?.customerCode }}
                  </span>
                  <NuxtLink
                    v-if="selectedVoucher?.customerCode"
                    :to="`/dashboard/customers?search=${encodeURIComponent(selectedVoucher.customerCode)}`"
                    class="text-[11px] text-sky-600 hover:text-sky-800 font-medium inline-flex items-center gap-0.5"
                  >
                    <span>View Customer</span>
                    <ExternalLink class="w-3 h-3" />
                  </NuxtLink>
                </div>
              </div>

              <!-- 3 KPI Badges -->
              <div class="grid grid-cols-3 gap-2">
                <div class="px-2.5 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-center sm:text-right">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-400">Taxable</p>
                  <p class="font-mono text-xs font-bold text-gray-700 truncate">
                    {{ formatCurrency(selectedVoucher?.taxableAmount) }}
                  </p>
                </div>
                <div class="px-2.5 py-1.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center sm:text-right">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Total Tax</p>
                  <p class="font-mono text-xs font-bold text-emerald-800 truncate">
                    {{ formatCurrency(selectedVoucher?.taxAmount) }}
                  </p>
                </div>
                <div class="px-2.5 py-1.5 bg-[#1b3b5f]/10 rounded-xl border border-[#1b3b5f]/30 text-center sm:text-right">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-[#1b3b5f]">Grand Total</p>
                  <p class="font-mono text-xs sm:text-sm font-extrabold text-[#1b3b5f] truncate">
                    {{ formatCurrency(selectedVoucher?.totalAmount) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Itemized Line Items Container (Scrollable) -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package class="w-4 h-4 text-gray-500" />
                  <span>Itemized Line Items</span>
                </h4>
                <span class="text-xs text-gray-500 font-medium">
                  Total Lines: <strong>{{ selectedVoucher?.items?.length || 0 }}</strong>
                </span>
              </div>

              <div v-if="!selectedVoucher?.items || selectedVoucher.items.length === 0" class="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                No individual item lines recorded on this invoice.
              </div>

              <!-- Desktop table inside drawer (hidden on very small screens, visible on sm+) -->
              <div v-else class="hidden sm:block border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table class="w-full text-left border-collapse table-auto text-xs">
                  <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th class="py-2.5 px-3 w-8 text-center">#</th>
                      <th class="py-2.5 px-3">Item & HSN</th>
                      <th class="py-2.5 px-3 text-center">Qty</th>
                      <th class="py-2.5 px-3 text-right">Billed Rate</th>
                      <th class="py-2.5 px-3 text-right">Taxable</th>
                      <th class="py-2.5 px-3 text-right">GST % & Tax</th>
                      <th class="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr
                      v-for="(item, idx) in selectedVoucher.items"
                      :key="'desk-item-' + idx"
                      class="hover:bg-gray-50/60 transition"
                    >
                      <td class="py-2.5 px-3 text-center text-gray-400 font-mono">{{ idx + 1 }}</td>
                      <td class="py-2.5 px-3 max-w-[180px]">
                        <div class="flex flex-col">
                          <span class="font-semibold text-gray-900 truncate" :title="item.name">{{ item.name }}</span>
                          <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span v-if="item.sku" class="text-[10px] font-mono text-gray-400">SKU: {{ item.sku }}</span>
                            <span v-if="item.hsn" class="text-[9px] font-mono font-medium text-gray-600 bg-gray-100 px-1 rounded">
                              HSN: {{ item.hsn }}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td class="py-2.5 px-3 text-center font-mono font-medium text-gray-800">{{ item.qty }}</td>
                      <td class="py-2.5 px-3 text-right whitespace-nowrap">
                        <div class="flex flex-col items-end">
                          <span class="font-mono text-gray-900">{{ formatCurrency(item.rate) }}</span>
                          <span v-if="item.isTaxInclusive" class="text-[9px] text-sky-700 bg-sky-50 px-1 rounded font-medium">
                            Tax Incl.
                          </span>
                        </div>
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono text-gray-700 whitespace-nowrap">
                        {{ formatCurrency(item.taxableAmount) }}
                      </td>
                      <td class="py-2.5 px-3 text-right whitespace-nowrap">
                        <div class="flex flex-col items-end">
                          <span class="font-mono font-semibold text-emerald-800">{{ formatCurrency(item.taxAmount) }}</span>
                          <span class="text-[9px] text-gray-500 font-mono">
                            {{ item.taxRate ? item.taxRate + '%' : '0%' }}
                            <span v-if="item.cgstRate && item.sgstRate">({{ item.cgstRate }}+{{ item.sgstRate }})</span>
                            <span v-else-if="item.igstRate">(IGST)</span>
                          </span>
                        </div>
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                        {{ formatCurrency(item.amount) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile line item cards inside drawer (sm:hidden) -->
              <div v-if="selectedVoucher?.items?.length" class="sm:hidden space-y-2.5">
                <div
                  v-for="(item, idx) in selectedVoucher.items"
                  :key="'mob-item-' + idx"
                  class="p-3 bg-gray-50/80 rounded-xl border border-gray-200 text-xs space-y-1.5"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <span class="text-[10px] text-gray-400 font-mono mr-1">#{{ idx + 1 }}</span>
                      <span class="font-semibold text-gray-900">{{ item.name }}</span>
                    </div>
                    <span class="font-mono font-bold text-gray-900 text-right shrink-0">
                      {{ formatCurrency(item.amount) }}
                    </span>
                  </div>

                  <div class="flex items-center gap-1.5 flex-wrap text-[10px] text-gray-500">
                    <span v-if="item.sku" class="font-mono bg-white px-1 rounded border border-gray-200">SKU: {{ item.sku }}</span>
                    <span v-if="item.hsn" class="font-mono bg-gray-200/80 px-1 rounded text-gray-700">HSN: {{ item.hsn }}</span>
                    <span>•</span>
                    <span class="font-mono font-semibold text-gray-700">Qty: {{ item.qty }}</span>
                    <span>@</span>
                    <span class="font-mono">{{ formatCurrency(item.rate) }}</span>
                    <span v-if="item.isTaxInclusive" class="text-[9px] text-sky-700 bg-sky-50 px-1 rounded">Tax Incl.</span>
                  </div>

                  <div class="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/60 font-mono text-gray-600">
                    <span>Taxable: <strong class="text-gray-800">{{ formatCurrency(item.taxableAmount) }}</strong></span>
                    <span>GST ({{ item.taxRate }}%): <strong class="text-emerald-700">{{ formatCurrency(item.taxAmount) }}</strong></span>
                  </div>
                </div>
              </div>

              <!-- Comprehensive Tax Invoice Summary Card -->
              <div class="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-2 text-xs">
                <div class="flex items-center justify-between text-gray-600">
                  <span>Taxable Subtotal:</span>
                  <span class="font-mono font-semibold text-gray-800">{{ formatCurrency(selectedVoucher?.taxableAmount) }}</span>
                </div>
                <div v-if="Number(selectedVoucher?.cgstAmount) > 0" class="flex items-center justify-between text-gray-600">
                  <span class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    CGST (Central Tax):
                  </span>
                  <span class="font-mono text-gray-800">{{ formatCurrency(selectedVoucher?.cgstAmount) }}</span>
                </div>
                <div v-if="Number(selectedVoucher?.sgstAmount) > 0" class="flex items-center justify-between text-gray-600">
                  <span class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    SGST (State Tax):
                  </span>
                  <span class="font-mono text-gray-800">{{ formatCurrency(selectedVoucher?.sgstAmount) }}</span>
                </div>
                <div v-if="Number(selectedVoucher?.igstAmount) > 0" class="flex items-center justify-between text-gray-600">
                  <span class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    IGST (Integrated Tax):
                  </span>
                  <span class="font-mono text-gray-800">{{ formatCurrency(selectedVoucher?.igstAmount) }}</span>
                </div>
                <div class="flex items-center justify-between text-emerald-800 pt-1 border-t border-gray-200/80 font-medium">
                  <span>Total Tax Amount:</span>
                  <span class="font-mono font-bold">{{ formatCurrency(selectedVoucher?.taxAmount) }}</span>
                </div>
                <div class="flex items-center justify-between text-gray-900 pt-2 border-t border-gray-300/80 font-bold text-sm">
                  <span>Invoice Grand Total:</span>
                  <span class="font-mono text-[#1b3b5f] text-base">{{ formatCurrency(selectedVoucher?.totalAmount) }}</span>
                </div>
              </div>
            </div>

            <!-- Drawer Footer (Sticky Bottom) -->
            <div class="p-3 sm:p-4 border-t border-gray-200 bg-gray-50 shrink-0 flex items-center justify-end gap-3">
              <button
                @click="closeVoucherDrawer"
                class="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Receipt,
  Search,
  X,
  Calendar,
  Clock,
  RefreshCw,
  Building2,
  ShoppingBag,
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
import RowsPerPageSelect from '~/components/ui/RowsPerPageSelect.vue'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const router = useRouter()

// Reactive Filter States
const searchInput = ref((route.query.search as string) || '')
const debouncedSearch = ref(searchInput.value)
const selectedSeries = ref<'ALL' | 'SMG' | 'RETAIL'>((route.query.series as any) || 'ALL')
const selectedDatePreset = ref<string>('all')
const customDateFrom = ref<string>('')
const customDateTo = ref<string>('')

// Pagination
const currentPage = ref(1)
const pageSize = ref(25)

// Data state
const isLoading = ref(false)
const vouchers = ref<any[]>([])
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

// Series options with counts
const seriesOptions = computed(() => [
  { label: 'All Series', value: 'ALL' },
  { label: 'Wholesale (SMG)', value: 'SMG', count: stats.value?.smgCount },
  { label: 'Retail Direct', value: 'RETAIL', count: stats.value?.retailCount }
])

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
  return !!debouncedSearch.value || selectedSeries.value !== 'ALL' || selectedDatePreset.value !== 'all' || !!customDateFrom.value || !!customDateTo.value
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
  if (!selectedVoucher.value?.items) return 0
  return selectedVoucher.value.items.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0)
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

function selectSeries(series: string) {
  selectedSeries.value = series as any
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
  selectedSeries.value = 'ALL'
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
      series: selectedSeries.value,
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
  selectedVoucher.value = voucher
  isDrawerOpen.value = true
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
  fetchVouchers(true)
})
</script>
