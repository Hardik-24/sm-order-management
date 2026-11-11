<template>
  <Teleport to="body">
    <div v-if="isOpen" data-modal-container class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 md:p-6 pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
      
      <div ref="modalCardRef" class="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-2rem)] md:max-h-[90vh] overflow-hidden">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText class="w-5 h-5 text-[#1b3b5f]" />
            <span>Generate & Reconcile Invoice</span>
          </h2>
          <p class="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Order: {{ order?.orderNumber || 'Loading...' }}</p>
        </div>
        <button @click="closeModal" data-modal-close="true" title="Close" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div v-if="pending" class="flex justify-center py-12">
          <Loader2 class="w-8 h-8 animate-spin text-[#1b3b5f]" />
        </div>
        
        <div v-else-if="order" class="space-y-6">
          <!-- Customer & Invoice Metadata Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <div class="flex items-center justify-between mb-1">
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bill To Customer</p>
                <span v-if="order.customer?.isBusySynced === false" class="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                  Not in Busy
                </span>
                <span v-else-if="order.customer?.customerCode" class="hidden sm:inline-block text-[9px] font-mono font-bold bg-white text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                  {{ order.customer.customerCode }}
                </span>
              </div>
              <p class="text-sm font-bold text-gray-900">{{ order.customer?.name }}</p>
              <p v-if="order.customer?.company" class="text-xs text-gray-600">{{ order.customer.company }}</p>
              <p class="text-xs text-gray-500 mt-0.5 truncate">{{ order.deliveryAddress || order.customer?.address || 'No address' }}</p>
              <p v-if="order.customer?.gstNumber" class="text-xs font-mono font-semibold text-gray-700 mt-1">
                GSTIN: {{ order.customer.gstNumber }}
              </p>

              <!-- Customer Link to Busy Gate -->
              <div v-if="order.customer?.isBusySynced === false" class="mt-3 p-3 bg-amber-100/90 border border-amber-300 rounded-xl text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                <div class="flex items-center gap-2 min-w-0">
                  <AlertCircle class="w-4 h-4 text-amber-700 shrink-0" />
                  <span class="text-xs font-semibold leading-tight">Customer ledger is not linked to Busy.</span>
                </div>
                <button
                  v-if="canLinkBusyData"
                  type="button"
                  @click="isLinkModalOpen = true"
                  class="w-full sm:w-auto px-3 py-1.5 bg-[#1b3b5f] text-white rounded-lg text-xs font-bold hover:bg-[#132c49] transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs active:scale-95"
                >
                  <Link2 class="w-3.5 h-3.5" />
                  <span>Link Customer Ledger</span>
                </button>
                <span v-else class="text-[10px] text-amber-900 font-medium italic">Contact Admin to link customer</span>
              </div>
            </div>
            
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Bill / Invoice No. *</label>
                  <input 
                    type="text" 
                    v-model="invoiceNumber" 
                    placeholder="e.g. INV-2026-001 or Busy No." 
                    class="w-full text-xs font-mono font-bold border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Invoice Date *</label>
                  <input 
                    type="date" 
                    v-model="invoiceDate" 
                    class="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
                  />
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Invoice Document / PDF URL (Optional)</label>
                <input 
                  type="text" 
                  v-model="invoicePdfUrl" 
                  placeholder="https://... or invoice document reference" 
                  class="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-[#1b3b5f] focus:border-[#1b3b5f]" 
                />
              </div>
            </div>
          </div>

          <!-- Items Reconciliation Table -->
          <div>
            <!-- Advisory Banner for Unsynced Items -->
            <div v-if="hasUnsyncedItems" class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle class="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <p class="font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                  <span>Items not in Busy</span>
                </p>
                <p class="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Please add these items in Busy or link them to existing products before creating the bill.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold text-gray-900 uppercase tracking-widest">
                Reconcile & Adjust Billed Quantities
              </h3>
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500">
                  Ordered vs Physically Packed vs Billed
                </span>
                <button 
                  type="button" 
                  @click="emit('openSplit', order.id)"
                  class="text-xs font-bold text-[#1b3b5f] hover:underline flex items-center gap-1 cursor-pointer"
                  title="Split unbilled or shortage quantities into a separate order"
                >
                  <GitFork class="w-3.5 h-3.5" />
                  <span>Split Order</span>
                </button>
              </div>
            </div>
            <!-- Desktop View: Full Spreadsheet Table -->
            <div class="hidden md:block border border-gray-200 rounded-xl overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[850px] text-xs">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 font-bold text-gray-500 uppercase tracking-widest text-[10px]">
                    <th class="px-3 py-3">Item / SKU</th>
                    <th class="px-3 py-3 text-center">Ordered</th>
                    <th class="px-3 py-3 text-center">Packed</th>
                    <th class="px-3 py-3 text-center w-24">Billed Qty</th>
                    <th class="px-3 py-3 text-right w-28">Rate (₹)</th>
                    <th class="px-3 py-3 text-right w-20">Disc %</th>
                    <th class="px-3 py-3 text-right w-20">Tax %</th>
                    <th class="px-3 py-3 text-right w-28">Tax Amt</th>
                    <th class="px-3 py-3 text-right w-28">Total (₹)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(item, index) in editableItems" :key="item.id" class="hover:bg-gray-50/50">
                    <td class="px-3 py-2.5">
                      <p class="font-bold text-gray-900">{{ item.productName || item.product?.name }}</p>
                      <p 
                        v-if="(item.sku || item.product?.sku) && (item.sku || item.product?.sku) !== (item.productName || item.product?.name)" 
                        class="text-[11px] font-mono text-gray-500 mt-0.5"
                      >
                        {{ item.sku || item.product?.sku }}
                      </p>
                      <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        <!-- Not in Busy Badge & Link Action -->
                        <span 
                          v-if="item.isBusySynced === false || item.product?.isBusySynced === false"
                          class="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs"
                          title="Product not yet created in Busy."
                        >
                          <AlertCircle class="w-2.5 h-2.5 text-amber-700 shrink-0" />
                          Not in Busy
                        </span>
                        <button
                          v-if="(item.isBusySynced === false || item.product?.isBusySynced === false) && canLinkBusyData"
                          type="button"
                          @click="openLinkProductModal(item)"
                          class="inline-flex items-center gap-1 text-[9px] font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 hover:bg-[#1b3b5f]/20 px-1.5 py-0.5 rounded border border-[#1b3b5f]/20 transition cursor-pointer"
                          title="Link this item to an existing Busy product"
                        >
                          <Link2 class="w-2.5 h-2.5 text-[#1b3b5f]" />
                          <span>Link Product</span>
                        </button>
                        <span 
                          v-if="item.isTaxInclusive" 
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                          title="Tax Inclusive Rate"
                        >
                          Tax Inc.
                        </span>
                        <span 
                          v-if="item.applyLastPrice" 
                          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                          title="Applied Customer's Last Agreed Price"
                        >
                          Last Price
                        </span>
                        <span 
                          v-if="item.itemNotes" 
                          class="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 truncate max-w-[200px]" 
                          :title="item.itemNotes"
                        >
                          💬 {{ item.itemNotes }}
                        </span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-center text-gray-600 font-semibold">{{ item.quantity }}</td>
                    <td class="px-3 py-2.5 text-center">
                      <div class="inline-flex flex-col items-center">
                        <span 
                          v-if="item.packedQuantity === 0"
                          class="font-bold px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap"
                        >
                          0 (Out of Stock)
                        </span>
                        <span 
                          v-else
                          class="font-bold px-2 py-0.5 rounded text-[11px]" 
                          :class="item.packedQuantity < item.quantity ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-green-100 text-green-800 border border-green-200'"
                        >
                          {{ item.packedQuantity }}
                        </span>
                        <span v-if="item.packedQuantity < item.quantity && item.packedQuantity > 0" class="text-[9px] font-bold text-amber-600 mt-0.5 whitespace-nowrap">
                          -{{ item.quantity - item.packedQuantity }} short
                        </span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                      <input 
                        type="number" 
                        min="0"
                        v-model.number="item.billedQuantity" 
                        class="w-16 text-center font-bold text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1b3b5f] bg-white"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.unitPrice" 
                        class="w-24 text-right text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1b3b5f] bg-white font-medium"
                      />
                      <div v-if="item.isTaxInclusive" class="text-[9px] font-semibold text-blue-600 mt-0.5">
                        (Tax Incl.)
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.discount" 
                        min="0" max="100"
                        class="w-16 text-right text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1b3b5f] bg-white"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <input 
                        type="number" 
                        v-model.number="item.taxRate" 
                        min="0" max="100"
                        class="w-16 text-right text-xs border border-gray-300 rounded p-1.5 focus:ring-[#1b3b5f] bg-white"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right font-medium text-gray-600">₹{{ calculateTax(item).toFixed(2) }}</td>
                    <td class="px-3 py-2.5 text-right font-bold text-gray-900">₹{{ calculateTotal(item).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile View: Touch-Friendly Responsive Item Cards -->
            <div class="md:hidden space-y-3">
              <div 
                v-for="(item, index) in editableItems" 
                :key="item.id" 
                class="bg-white border rounded-xl p-3.5 space-y-3 shadow-2xs transition"
                :class="(item.isBusySynced === false || item.product?.isBusySynced === false) ? 'border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/20' : 'border-gray-200'"
              >
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="font-bold text-xs text-gray-900 leading-snug break-words">
                      {{ item.productName || item.product?.name }}
                    </p>
                    <p 
                      v-if="(item.sku || item.product?.sku) && (item.sku || item.product?.sku) !== (item.productName || item.product?.name)" 
                      class="text-[11px] font-mono text-gray-500 mt-0.5"
                    >
                      {{ item.sku || item.product?.sku }}
                    </p>
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <span 
                      v-if="item.isTaxInclusive" 
                      class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      Tax Inc.
                    </span>
                    <span 
                      v-if="item.applyLastPrice" 
                      class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      Last Price
                    </span>
                  </div>
                </div>

                <!-- Not in Busy Callout & One-Tap Link Action -->
                <div 
                  v-if="item.isBusySynced === false || item.product?.isBusySynced === false"
                  class="p-2.5 bg-amber-100 border border-amber-300 rounded-lg flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div class="flex items-center gap-1.5 min-w-0 text-amber-950">
                    <AlertCircle class="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span class="text-[11px] font-black uppercase tracking-wide">Not in Busy</span>
                  </div>
                  <button
                    v-if="canLinkBusyData"
                    type="button"
                    @click="openLinkProductModal(item)"
                    class="px-2.5 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Link2 class="w-3.5 h-3.5" />
                    <span>Link to Busy</span>
                  </button>
                  <span v-else class="text-[10px] text-amber-900 font-medium italic">Contact Admin to link</span>
                </div>

                <!-- Quantities 3-Column Strip (Ordered | Packed | Billed) -->
                <div class="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200/80 text-center text-xs">
                  <div>
                    <span class="block text-[10px] font-bold uppercase text-gray-500">Ordered</span>
                    <span class="font-bold text-gray-900 text-sm mt-0.5 inline-block">{{ item.quantity }}</span>
                  </div>
                  <div>
                    <span class="block text-[10px] font-bold uppercase text-gray-500">Packed</span>
                    <div class="mt-0.5">
                      <span 
                        v-if="item.packedQuantity === 0" 
                        class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800"
                      >
                        0 (OOS)
                      </span>
                      <span 
                        v-else 
                        class="font-bold text-sm" 
                        :class="item.packedQuantity < item.quantity ? 'text-amber-700 font-extrabold' : 'text-emerald-700'"
                      >
                        {{ item.packedQuantity }}
                      </span>
                      <span v-if="item.packedQuantity < item.quantity && item.packedQuantity > 0" class="block text-[8px] font-bold text-amber-600">
                        -{{ item.quantity - item.packedQuantity }} short
                      </span>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold uppercase text-[#1b3b5f]">Billed Qty</label>
                    <input 
                      type="number" 
                      min="0"
                      v-model.number="item.billedQuantity"
                      class="w-full text-center font-black text-sm border border-gray-300 rounded p-1 bg-white focus:ring-2 focus:ring-[#1b3b5f] mt-0.5" 
                    />
                  </div>
                </div>

                <!-- Pricing & Tax Inputs Row -->
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Rate (₹)</label>
                    <input 
                      type="number" 
                      v-model.number="item.unitPrice"
                      class="w-full text-xs font-bold border border-gray-300 rounded p-1.5 bg-white focus:ring-[#1b3b5f]" 
                    />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="flex-1">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Disc %</label>
                      <input 
                        type="number" 
                        v-model.number="item.discount" 
                        min="0" max="100"
                        class="w-full text-center text-xs border border-gray-300 rounded p-1.5 bg-white" 
                      />
                    </div>
                    <div class="flex-1">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Tax %</label>
                      <input 
                        type="number" 
                        v-model.number="item.taxRate" 
                        min="0" max="100"
                        class="w-full text-center text-xs border border-gray-300 rounded p-1.5 bg-white" 
                      />
                    </div>
                  </div>
                </div>

                <!-- Item Total Footer -->
                <div class="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                  <span class="text-gray-500 text-[11px]">GST: ₹{{ calculateTax(item).toFixed(2) }}</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-gray-600 font-medium text-[11px]">Item Total:</span>
                    <span class="font-black text-sm text-gray-900">₹{{ calculateTotal(item).toFixed(2) }}</span>
                  </div>
                </div>

                <div v-if="item.itemNotes" class="text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200/70">
                  💬 {{ item.itemNotes }}
                </div>
              </div>
            </div>
          </div>

          <!-- Summary & Billing Blocked Section -->
          <div class="space-y-4">
            <!-- Prominent Billing Blocked Banner (Full Width) -->
            <div v-if="isBusyBlocked" class="p-3.5 sm:p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs shadow-2xs space-y-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                  <AlertTriangle class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="font-extrabold text-xs text-amber-950 uppercase tracking-wide">Billing Blocked: Busy Synchronization Required</h4>
                  <p class="text-[11px] text-amber-800 mt-0.5">
                    Before generating an invoice, all party ledgers and product items must match real Busy records.
                  </p>
                </div>
              </div>

              <!-- Actionable Checklist -->
              <div class="bg-white/90 rounded-lg p-3 border border-amber-200 space-y-2 text-xs">
                <div v-if="isCustomerUnsynced" class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <XCircle class="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Customer ledger is not linked to Busy</span>
                  </div>
                  <button 
                    v-if="canLinkBusyData"
                    type="button" 
                    @click="isLinkModalOpen = true" 
                    class="px-2.5 py-1 bg-[#1b3b5f] text-white rounded text-[11px] font-bold hover:bg-[#132c49] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Link2 class="w-3 h-3" />
                    <span>Link Customer</span>
                  </button>
                </div>

                <div v-if="hasUnsyncedItems" class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <XCircle class="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{{ unsyncedItemsCount }} item(s) not in Busy</span>
                  </div>
                  <span class="text-[10px] text-amber-900 font-medium italic">Use "Link to Busy" on item cards above</span>
                </div>
              </div>
            </div>

            <!-- Financial Totals Box -->
            <div class="flex justify-end">
              <div class="w-full sm:w-80 bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
                <div class="flex justify-between items-center text-gray-600">
                  <span>Subtotal (Billed)</span>
                  <span class="font-semibold">₹{{ grandSubtotal.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-gray-600">
                  <span>Total Discount</span>
                  <span class="text-rose-600 font-semibold">-₹{{ grandDiscount.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-gray-600">
                  <span>Total Tax (GST)</span>
                  <span class="font-semibold">₹{{ grandTax.toFixed(2) }}</span>
                </div>
                <div v-if="roundOffAmount !== 0" class="flex justify-between items-center text-gray-600">
                  <span>Round Off</span>
                  <span :class="roundOffAmount >= 0 ? 'text-gray-900 font-semibold' : 'text-rose-600 font-semibold'">
                    {{ roundOffAmount >= 0 ? '+' : '' }}₹{{ roundOffAmount.toFixed(2) }}
                  </span>
                </div>
                <div class="pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span class="text-xs font-bold text-gray-900 uppercase tracking-widest">Final Bill Amount</span>
                  <span class="text-xl font-black text-[#1b3b5f]">₹{{ grandTotal.toLocaleString('en-IN') }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <div class="p-3.5 sm:p-4 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
        <button @click="closeModal" data-modal-close="true" class="w-full sm:w-auto text-center px-4 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          Cancel
        </button>
        <button 
          @click="confirmGenerate" 
          :disabled="isGenerating || (!isBusyBlocked && !invoiceNumber.trim())"
          class="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
          :class="isBusyBlocked 
            ? 'bg-amber-600 hover:bg-amber-700 text-white' 
            : 'bg-[#1b3b5f] hover:bg-[#132c49] text-white disabled:opacity-50'"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
          <Lock v-else-if="isBusyBlocked" class="w-4 h-4" />
          <Check v-else class="w-4 h-4" />
          <span v-if="isCustomerUnsynced && hasUnsyncedItems">Link customer & products in Busy first</span>
          <span v-else-if="isCustomerUnsynced">Link customer in Busy first</span>
          <span v-else-if="hasUnsyncedItems">Link {{ unsyncedItemsCount }} product(s) in Busy first</span>
          <span v-else>{{ isGenerating ? 'Generating...' : 'Confirm & Generate Bill' }}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Link Customer Ledger Modal -->
  <LinkCustomerModal 
    :isOpen="isLinkModalOpen"
    :order="order"
    @close="isLinkModalOpen = false"
    @linked="onCustomerLinked"
  />

  <!-- Link Busy Product Modal -->
  <LinkItemModal 
    :isOpen="isLinkItemModalOpen"
    :order="order"
    :item="selectedItemForLinking"
    @close="isLinkItemModalOpen = false"
    @linked="handleItemLinked"
  />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { X, FileText, Loader2, Check, GitFork, AlertTriangle, Link2, AlertCircle, Lock, XCircle } from 'lucide-vue-next'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import { useAuth } from '~/composables/useAuth'
import LinkCustomerModal from '~/components/dashboard/LinkCustomerModal.vue'
import LinkItemModal from '~/components/dashboard/LinkItemModal.vue'

const { canLinkBusyData } = useAuth()
const { animateModalOpen } = useGsapAnimation()
const modalCardRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  isOpen: boolean
  orderId: string | null
}>()

const emit = defineEmits(['close', 'generated', 'openSplit'])

const order = ref<any>(null)
const pending = ref(false)
const isGenerating = ref(false)
const isLinkModalOpen = ref(false)
const isLinkItemModalOpen = ref(false)
const selectedItemForLinking = ref<any>(null)

const onCustomerLinked = (updatedOrder: any) => {
  if (updatedOrder && order.value) {
    order.value.customer = updatedOrder.customer
    order.value.customerId = updatedOrder.customerId
  }
}

const openLinkProductModal = (item: any) => {
  selectedItemForLinking.value = item
  isLinkItemModalOpen.value = true
}

const handleItemLinked = (updatedOrder: any) => {
  if (updatedOrder) {
    order.value = updatedOrder
    if (updatedOrder.items) {
      editableItems.value = updatedOrder.items.map((i: any) => ({
        ...i,
        billedQuantity: i.billedQuantity ?? i.packedQuantity ?? i.quantity,
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount || 0),
        taxRate: Number(i.taxRate || 0)
      }))
    }
  }
}

const invoiceNumber = ref('')
const invoiceDate = ref(new Date().toISOString().split('T')[0])
const invoicePdfUrl = ref('')

const editableItems = ref<any[]>([])

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      if (modalCardRef.value) animateModalOpen(modalCardRef.value)
    })
  }
  if (isOpen && props.orderId) {
    pending.value = true
    try {
      const data = await $fetch<any>(`/api/orders/${props.orderId}`)
      order.value = data
      
      invoiceNumber.value = data.billingStatus?.invoiceNumber || `INV-${new Date().getFullYear()}-${data.orderNumber?.replace('SO-', '') || '001'}`
      invoiceDate.value = data.billingStatus?.invoiceDate 
        ? new Date(data.billingStatus.invoiceDate).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0]
      invoicePdfUrl.value = data.billingStatus?.invoicePdfUrl || ''

      // Initialize editable items reconciling packed vs ordered
      editableItems.value = (data.items || []).map((item: any) => {
        const approvedQty = item.approvedQuantity ?? item.quantity
        const isPackingActive = data.packingStatus?.status === 'PACKED' || data.packingStatus?.status === 'IN_PROGRESS'
        
        // Take actual packedQuantity recorded by the warehouse packing team (accounts for stock shortages)
        let packedQty = approvedQty
        if (item.packedQuantity !== undefined && item.packedQuantity !== null) {
          if (isPackingActive || Number(item.packedQuantity) > 0) {
            packedQty = Number(item.packedQuantity)
          }
        }

        // Billed quantity defaults to physically packed quantity so bill accounts for stock shortage
        const billedQty = item.billedQuantity !== undefined && item.billedQuantity !== null 
          ? Number(item.billedQuantity) 
          : packedQty

        return {
          ...item,
          productName: item.productName || item.product?.name,
          sku: item.sku || item.product?.sku,
          quantity: approvedQty,
          packedQuantity: packedQty,
          billedQuantity: billedQty,
          unitPrice: Number(item.unitPrice || 0),
          discount: item.discount ? Number(item.discount) : 0,
          taxRate: item.taxRate !== undefined && item.taxRate !== null ? Number(item.taxRate) : Number(item.product?.taxRate || 0),
          isTaxInclusive: Boolean(item.isTaxInclusive),
          applyLastPrice: Boolean(item.applyLastPrice),
          itemNotes: item.itemNotes || ''
        }
      })
    } catch (e) {
      console.error(e)
    } finally {
      pending.value = false
    }
  } else {
    order.value = null
    editableItems.value = []
  }
})

const closeModal = () => {
  emit('close')
}

// Calculations based on billedQuantity
const calculateSubtotal = (item: any) => {
  const qty = Number(item.billedQuantity !== undefined ? item.billedQuantity : (item.packedQuantity ?? item.quantity))
  return qty * Number(item.unitPrice || 0)
}

const calculateDiscountAmt = (item: any) => {
  const sub = calculateSubtotal(item)
  return sub * ((Number(item.discount || 0)) / 100)
}

const calculateTax = (item: any) => {
  const afterDiscount = calculateSubtotal(item) - calculateDiscountAmt(item)
  return afterDiscount * ((Number(item.taxRate || 0)) / 100)
}

const calculateTotal = (item: any) => {
  const afterDiscount = calculateSubtotal(item) - calculateDiscountAmt(item)
  return afterDiscount + calculateTax(item)
}

const grandSubtotal = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateSubtotal(item), 0)
})

const grandDiscount = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateDiscountAmt(item), 0)
})

const grandTax = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateTax(item), 0)
})

const rawGrandTotal = computed(() => {
  return editableItems.value.reduce((sum, item) => sum + calculateTotal(item), 0)
})

const grandTotal = computed(() => {
  return Math.round(rawGrandTotal.value)
})

const roundOffAmount = computed(() => {
  return Number((grandTotal.value - rawGrandTotal.value).toFixed(2))
})

const isCustomerUnsynced = computed(() => order.value?.customer?.isBusySynced === false)

const hasUnsyncedItems = computed(() => {
  return editableItems.value.some((i: any) => i.isBusySynced === false || i.product?.isBusySynced === false)
})

const unsyncedItemsCount = computed(() => {
  return editableItems.value.filter((i: any) => i.isBusySynced === false || i.product?.isBusySynced === false).length
})

const isBusyBlocked = computed(() => isCustomerUnsynced.value || hasUnsyncedItems.value)

const confirmGenerate = async () => {
  if (isCustomerUnsynced.value && hasUnsyncedItems.value) {
    alert('Cannot generate bill: Please link customer and products with real Busy data first.')
    return
  }
  if (isCustomerUnsynced.value) {
    alert('Cannot generate bill: Please link customer with real Busy data first.')
    return
  }
  if (hasUnsyncedItems.value) {
    alert('Cannot generate bill: Please link products with real Busy data first.')
    return
  }
  if (!invoiceNumber.value.trim()) {
    alert('Please enter an Invoice / Bill Number')
    return
  }
  isGenerating.value = true
  try {
    const itemsToSave = editableItems.value.map(item => ({
      id: item.id,
      billedQuantity: Number(item.billedQuantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount || 0),
      taxRate: Number(item.taxRate || 0),
      taxAmount: calculateTax(item),
      totalPrice: calculateTotal(item)
    }))

    await $fetch(`/api/orders/${props.orderId}/billing`, {
      method: 'PATCH',
      body: { 
        status: 'GENERATED',
        invoiceNumber: invoiceNumber.value.trim(),
        invoiceDate: invoiceDate.value || undefined,
        invoicePdfUrl: invoicePdfUrl.value?.trim() || undefined,
        items: itemsToSave
      }
    })
    const { notifyChange } = useRealtimeSync()
    notifyChange({ orderId: props.orderId, action: 'BILL_GENERATED' })
    emit('generated')
    closeModal()
  } catch (error: any) {
    console.error('Failed to generate invoice:', error)
    alert(error.data?.message || 'Failed to generate invoice')
  } finally {
    isGenerating.value = false
  }
}
</script>
