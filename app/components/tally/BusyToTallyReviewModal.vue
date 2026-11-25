<template>
  <div v-if="isOpen && voucher" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" @click="close"></div>

    <!-- Modal Dialog -->
    <div class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Top Header Bar -->
      <div class="px-6 py-4 border-b border-gray-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ArrowLeftRight class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Voucher Posting Review: {{ voucher.voucherNo }}
              </h2>
              <span 
                class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                :class="voucher.isPosted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
              >
                {{ voucher.isPosted ? 'Already Posted' : 'Ready to Review & Post' }}
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {{ voucher.voucherType || 'Sales' }}
              </span>
            </div>
            <p class="text-xs text-gray-500">
              Side-by-side comparison: verify the BUSY source on the left and edit or override Tally fields on the right.
            </p>
          </div>
        </div>

        <button 
          @click="close" 
          class="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Body: Two Columns Side-by-Side -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- ========================================== -->
        <!-- LEFT COLUMN: BUSY SOURCE (READ-ONLY)       -->
        <!-- ========================================== -->
        <div class="lg:col-span-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-gray-200 pb-6 lg:pb-0 lg:pr-6">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-slate-400"></span>
              BUSY Source of Truth (Uneditable)
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {{ voucher.voucherType === 'Purchase' ? 'Purchase Invoice' : `Series: ${voucher.series}` }}
            </span>
          </div>

          <!-- Basic Voucher Info Card -->
          <div class="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
            <div class="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span class="text-gray-500 font-medium">Invoice Number</span>
              <span class="font-bold text-gray-900 font-mono">{{ voucher.voucherNo }}</span>
            </div>
            <div class="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span class="text-gray-500 font-medium">Invoice Date</span>
              <span class="font-semibold text-gray-800">{{ voucher.displayDate }}</span>
            </div>
            <div class="flex justify-between items-start py-1 border-b border-slate-200/60">
              <span class="text-gray-500 font-medium shrink-0">
                {{ voucher.voucherType === 'Purchase' ? 'Supplier (Creditor)' : 'Customer (Debtor)' }}
              </span>
              <span class="font-bold text-gray-900 text-right break-words max-w-[200px]">{{ voucher.customerName }}</span>
            </div>
            <div class="flex justify-between items-start py-1">
              <span class="text-gray-500 font-medium shrink-0">BUSY Remarks</span>
              <span class="text-gray-600 text-right italic break-words max-w-[200px]">
                {{ voucher.narration || 'No remarks recorded in BUSY' }}
              </span>
            </div>
          </div>

          <!-- Financial Totals Breakdown -->
          <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-2xs space-y-2 text-xs">
            <h4 class="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1">Financial Breakdown</h4>
            
            <div class="flex justify-between text-gray-600">
              <span>Taxable Value:</span>
              <span class="font-semibold text-gray-900">₹{{ voucher.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="voucher.cgstAmount > 0" class="flex justify-between text-gray-600">
              <span>CGST:</span>
              <span class="font-semibold text-gray-900">₹{{ voucher.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="voucher.sgstAmount > 0" class="flex justify-between text-gray-600">
              <span>SGST:</span>
              <span class="font-semibold text-gray-900">₹{{ voucher.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="voucher.igstAmount > 0" class="flex justify-between text-purple-700 font-medium">
              <span>IGST (Inter-State):</span>
              <span class="font-bold text-purple-900">₹{{ voucher.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="Math.abs(voucher.roundOffAmount) > 0.001" class="flex justify-between text-gray-500 text-[11px]">
              <span>Round Off:</span>
              <span class="font-mono">₹{{ voucher.roundOffAmount.toFixed(2) }}</span>
            </div>

            <div class="pt-2 border-t border-gray-200 flex justify-between items-center text-sm">
              <span class="font-bold text-gray-900">Grand Total:</span>
              <span class="font-black text-indigo-700 text-base">₹{{ voucher.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
          </div>

          <!-- Items Preview Table -->
          <div class="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-3 py-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                Invoice Items ({{ (voucher.items && voucher.items.length) || voucher.itemCount || 1 }})
              </span>
              <span class="text-[10px] text-gray-500">Read-Only</span>
            </div>
            
            <div class="overflow-y-auto max-h-48 p-2 divide-y divide-gray-100 text-[11px]">
              <div v-for="(it, idx) in (voucher.items || [])" :key="idx" class="py-1.5 flex flex-col gap-0.5">
                <div class="flex justify-between font-semibold text-gray-900">
                  <span class="truncate pr-2">{{ it.name || it.description || 'Item' }}</span>
                  <span class="shrink-0 font-mono">₹{{ (Number(it.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                </div>
                <div class="flex items-center gap-2 text-[10px] text-gray-500">
                  <span v-if="it.sku" class="font-mono bg-slate-100 px-1 rounded">SKU: {{ it.sku }}</span>
                  <span>Qty: {{ it.qty }}</span>
                  <span>Rate: ₹{{ it.rate }}</span>
                  <span v-if="it.taxRate" class="text-indigo-600 font-bold">GST: {{ it.taxRate }}%</span>
                </div>
              </div>
              <div v-if="!voucher.items || voucher.items.length === 0" class="py-4 text-center text-gray-400 italic">
                Summary invoice (item-level lines aggregated in BUSY)
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- RIGHT COLUMN: TALLY PRIME (FULLY EDITABLE) -->
        <!-- ========================================== -->
        <div class="lg:col-span-7 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Tally Prime Mapping (Fully Editable)
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
              Target: Accounting Invoice View
            </span>
          </div>

          <!-- Top Config Controls -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Voucher Type -->
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Voucher Type</label>
              <select 
                v-model="form.voucherType"
                class="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option v-for="vt in availableVoucherTypes" :key="vt" :value="vt">{{ vt }}</option>
              </select>
            </div>

            <!-- Voucher Date -->
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Tally Voucher Date</label>
              <input 
                type="date"
                v-model="formDisplayDate"
                class="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <!-- Voucher No -->
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Voucher Number</label>
              <input 
                type="text"
                v-model="form.voucherNo"
                class="w-full text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 bg-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <!-- Supplier Invoice Ref (For Purchase) or Bill Ref (For Sales) -->
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">
                {{ form.voucherType === 'Purchase' ? 'Supplier Bill Ref' : 'Bill Reference' }}
              </label>
              <input 
                type="text"
                v-model="form.reference"
                :placeholder="form.voucherType === 'Purchase' ? 'e.g. PB25024493' : 'e.g. ' + form.voucherNo"
                class="w-full text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 bg-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <!-- Party Ledger in Tally (Searchable dropdown with strict selection from Tally ledgers) -->
          <div class="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div class="flex items-center justify-between">
              <label class="block text-[11px] font-black uppercase tracking-wider text-indigo-950">
                Party Ledger in Tally (All Available Tally Ledgers)
              </label>
              <span 
                v-if="voucher.isMapped && isValidTallyLedger"
                class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1"
              >
                <Check class="w-3 h-3" /> Linked to BUSY
              </span>
              <span 
                v-else-if="isValidTallyLedger"
                class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1"
              >
                <Check class="w-3 h-3" /> Selected from Tally
              </span>
              <span 
                v-else
                class="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 flex items-center gap-1 border border-amber-300"
              >
                <AlertTriangle class="w-3 h-3 text-amber-600" /> Link Required (First Time)
              </span>
            </div>

            <!-- First Time Notice & Suggestion -->
            <div v-if="!isValidTallyLedger" class="p-3 bg-amber-50 rounded-xl border border-amber-300/80 text-xs text-amber-950 space-y-2">
              <div class="flex items-start gap-2">
                <AlertCircle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div class="font-extrabold text-amber-900">Link Party to Tally (First Time Required)</div>
                  <p class="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    <strong>"{{ voucher.customerName }}"</strong> does not have a linked Tally ledger yet. You must choose an existing ledger from Tally Prime below to post this voucher.
                  </p>
                </div>
              </div>

              <!-- Quick Suggestion Chip -->
              <div v-if="suggestedMatch" class="flex items-center gap-2 pt-2 border-t border-amber-200">
                <span class="text-[11px] font-bold text-amber-900">Suggested Tally Ledger:</span>
                <button
                  type="button"
                  @mousedown.prevent="selectPartyLedger(suggestedMatch)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs cursor-pointer transition-colors"
                >
                  <span>{{ suggestedMatch }}</span>
                  <Check class="w-3.5 h-3.5 text-indigo-600" />
                </button>
              </div>
            </div>

            <!-- Confirmed Ledger Display (if already selected/valid and not currently editing) -->
            <div v-if="isValidTallyLedger && !isEditingParty" class="p-2.5 bg-white rounded-xl border border-emerald-200 shadow-2xs flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Check class="w-4 h-4" />
                </div>
                <div>
                  <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Selected Tally Ledger</div>
                  <div class="text-xs font-black text-gray-900">{{ form.partyLedgerName }}</div>
                </div>
              </div>
              <button
                type="button"
                @click="startEditingParty"
                class="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              >
                Change Ledger
              </button>
            </div>

            <!-- Searchable Dropdown (shown when no ledger is valid OR user clicked Change) -->
            <div v-else class="relative">
              <div class="relative">
                <input 
                  type="text"
                  v-model="partySearchQuery"
                  @focus="showPartyDropdown = true"
                  @input="showPartyDropdown = true"
                  @keydown.enter.prevent="onPartySearchEnter"
                  @blur="onPartySearchBlur"
                  class="w-full text-xs font-bold px-3 py-2 rounded-lg border border-indigo-200 bg-white text-gray-900 shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  :placeholder="`Search from ${activeTallyLedgers.length} existing Tally ledgers...`"
                />
                <button
                  v-if="isEditingParty && isValidTallyLedger"
                  type="button"
                  @mousedown.prevent="cancelEditingParty"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <!-- Dropdown List of Tally Ledgers Only -->
              <div 
                v-if="showPartyDropdown"
                class="absolute left-0 right-0 top-full mt-1 z-30 max-h-52 overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-200 divide-y divide-gray-100"
              >
                <div v-if="filteredTallyParties.length === 0" class="p-3 text-xs text-gray-500 text-center italic">
                  No existing Tally ledger found matching "{{ partySearchQuery }}".<br>
                  <span class="text-[10px] text-gray-400 font-semibold">Only ledgers already existing in Tally Prime can be selected.</span>
                </div>
                <button
                  type="button"
                  v-for="d in filteredTallyParties"
                  :key="d"
                  @mousedown.prevent="selectPartyLedger(d)"
                  class="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors flex items-center justify-between cursor-pointer"
                  :class="form.partyLedgerName === d ? 'bg-indigo-50/80 font-bold text-indigo-900' : 'text-gray-800'"
                >
                  <span class="font-medium">{{ d }}</span>
                  <Check v-if="form.partyLedgerName === d" class="w-3.5 h-3.5 text-indigo-600" />
                </button>
              </div>
            </div>

            <!-- Remember Mapping Option -->
            <label class="flex items-center gap-2 cursor-pointer pt-1">
              <input 
                type="checkbox" 
                v-model="form.saveMapping"
                class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span class="text-[11px] text-gray-700 font-medium select-none">
                Remember this mapping for all future vouchers for <strong>{{ voucher.customerName }}</strong>
              </span>
            </label>
          </div>

          <!-- Tally Narration (Prominent, Multi-line & Tag Supported) -->
          <div class="bg-slate-50/80 p-3.5 rounded-xl border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <FileText class="w-3.5 h-3.5 text-indigo-600" />
                <label class="block text-[11px] font-black uppercase tracking-wider text-gray-800">
                  Tally Narration (Editable Preview)
                </label>
              </div>
              <button 
                type="button" 
                @click="resetNarration" 
                class="text-[10px] font-semibold text-gray-500 hover:text-indigo-600 underline cursor-pointer"
              >
                Reset Default
              </button>
            </div>

            <textarea 
              v-model="form.narration"
              rows="2"
              class="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 bg-white font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none leading-relaxed"
              placeholder="Enter voucher narration to post to Tally Prime..."
            ></textarea>

            <!-- Quick Append Tags -->
            <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Quick Add:</span>
              <button
                type="button"
                @click="appendNarrationTag(voucher.customerName)"
                class="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 border border-gray-200 rounded-md transition-colors cursor-pointer"
              >
                + Party Name
              </button>
              <button
                type="button"
                @click="appendNarrationTag(`Inv #${voucher.voucherNo}`)"
                class="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 border border-gray-200 rounded-md transition-colors cursor-pointer"
              >
                + Voucher No
              </button>
              <button
                type="button"
                @click="appendNarrationTag(`Dt ${voucher.displayDate}`)"
                class="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 border border-gray-200 rounded-md transition-colors cursor-pointer"
              >
                + Date
              </button>
              <button
                type="button"
                @click="appendNarrationTag(`Tot ₹${voucher.totalAmount}`)"
                class="px-2 py-0.5 text-[10px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 border border-gray-200 rounded-md transition-colors cursor-pointer"
              >
                + Grand Total
              </button>
            </div>
          </div>

          <!-- Accounting Ledger Rows Breakdown (Editable Table) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                Tally Ledger Entries (Dr / Cr Breakdown)
              </h4>
              <button 
                type="button"
                @click="addLedgerRow"
                class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus class="w-3.5 h-3.5" /> Add Ledger Row
              </button>
            </div>

            <div class="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-500 tracking-wider">
                  <tr>
                    <th class="px-3 py-2">Ledger Name</th>
                    <th class="px-3 py-2 w-20">Type</th>
                    <th class="px-3 py-2 w-28 text-right">Amount (₹)</th>
                    <th class="px-2 py-2 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(entry, idx) in form.ledgerEntries" :key="idx" class="hover:bg-slate-50/60">
                    <!-- Ledger Name -->
                    <td class="px-3 py-2">
                      <input 
                        type="text"
                        v-model="entry.ledgerName"
                        class="w-full text-xs font-semibold px-2 py-1 rounded border border-gray-300 focus:border-indigo-500 outline-none bg-white"
                        :disabled="idx === 0"
                        :placeholder="idx === 0 ? 'Party Ledger' : 'Select or type ledger name...'"
                      />
                    </td>

                    <!-- Dr / Cr Selector -->
                    <td class="px-3 py-2">
                      <select 
                        v-model="entry.isDeemedPositive"
                        class="text-xs font-bold px-2 py-1 rounded border border-gray-300 bg-white outline-none"
                        :class="entry.isDeemedPositive ? 'text-blue-700 bg-blue-50/50' : 'text-emerald-700 bg-emerald-50/50'"
                      >
                        <option :value="true">Dr</option>
                        <option :value="false">Cr</option>
                      </select>
                    </td>

                    <!-- Amount -->
                    <td class="px-3 py-2 text-right">
                      <input 
                        type="number"
                        step="0.01"
                        :value="Math.abs(entry.amount)"
                        @input="entry.amount = parseFloat(($event.target as HTMLInputElement).value) || 0"
                        class="w-24 text-right text-xs font-mono font-bold px-2 py-1 rounded border border-gray-300 focus:border-indigo-500 outline-none bg-white"
                      />
                    </td>

                    <!-- Delete Row -->
                    <td class="px-2 py-2 text-center">
                      <button 
                        type="button"
                        v-if="idx > 0"
                        @click="removeLedgerRow(idx)"
                        class="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Balance Validation Banner -->
          <div 
            class="px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs font-bold"
            :class="isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'"
          >
            <div class="flex items-center gap-2">
              <CheckCircle2 v-if="isBalanced" class="w-4 h-4 text-emerald-600" />
              <AlertTriangle v-else class="w-4 h-4 text-red-600" />
              <span>
                {{ isBalanced ? 'Debit & Credit Balanced' : `Imbalance Detected! Difference: ₹${imbalanceDiff.toFixed(2)}` }}
              </span>
            </div>

            <div class="flex items-center gap-3 font-mono text-[11px]">
              <span>Dr: ₹{{ totalDr.toFixed(2) }}</span>
              <span class="mx-1.5">|</span>
              <span>Cr: ₹{{ totalCr.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Feedback Alert Message -->
          <div v-if="postFeedback" class="p-3 rounded-xl text-xs font-medium" :class="postFeedback.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'">
            <div class="flex items-center gap-2 font-bold">
              <CheckCircle2 v-if="postFeedback.success" class="w-4 h-4 text-emerald-600" />
              <AlertCircle v-else class="w-4 h-4 text-red-600" />
              <span>{{ postFeedback.success ? 'Successfully Posted to Tally Prime!' : 'Posting Error from Tally Prime:' }}</span>
            </div>
            <p class="mt-1 text-[11px] leading-relaxed break-words">{{ postFeedback.message }}</p>
          </div>

        </div>

      </div>

      <!-- Bottom Action Bar -->
      <div class="px-6 py-4 border-t border-gray-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <button 
          type="button" 
          @click="close"
          class="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <div class="flex items-center gap-3">
          <!-- Missing Ledger Alert -->
          <div v-if="!isValidTallyLedger" class="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300">
            <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0" />
            <span>Select an existing Tally ledger to enable posting</span>
          </div>

          <button 
            type="button" 
            :disabled="!isBalanced || isPosting || !isValidTallyLedger"
            @click="postToTally"
            class="px-5 py-2.5 text-xs font-black text-white rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            :class="[
              isBalanced && !isPosting && isValidTallyLedger
                ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md' 
                : 'bg-gray-400 cursor-not-allowed opacity-60'
            ]"
          >
            <Loader2 v-if="isPosting" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            <span>{{ isPosting ? 'Posting to Port 9000...' : 'Post to Tally Prime (Port 9000)' }}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ArrowLeftRight,
  X,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Send,
  Loader2,
  FileText
} from 'lucide-vue-next'
import type { PreparedVoucherItem, FormattedTallyEntry } from '~~/server/api/tally/vouchers.get'

const props = defineProps<{
  isOpen: boolean
  voucher: PreparedVoucherItem | null
  availableTallyDebtors: string[]
  availableTallyCreditors?: string[]
  availableAllLedgers?: string[]
  availableVoucherTypes: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'posted', voucherNo: string, partyLedgerName?: string, busyPartyName?: string): void
}>()

// State
const form = ref<{
  voucherType: string
  voucherNo: string
  reference: string
  date: string // YYYYMMDD
  partyLedgerName: string
  narration: string
  saveMapping: boolean
  ledgerEntries: FormattedTallyEntry[]
}>({
  voucherType: 'Sales',
  voucherNo: '',
  reference: '',
  date: '',
  partyLedgerName: '',
  narration: '',
  saveMapping: true,
  ledgerEntries: []
})

const formDisplayDate = ref<string>('')
const partySearchQuery = ref<string>('')
const showPartyDropdown = ref(false)
const isEditingParty = ref(false)
const isPosting = ref(false)
const postFeedback = ref<{ success: boolean; message: string } | null>(null)

// Active tally ledgers: Show ALL Tally ledgers, with relevant Debtors/Creditors prioritized at top
const activeTallyLedgers = computed<string[]>(() => {
  if (props.availableAllLedgers && props.availableAllLedgers.length > 0) {
    const isPurchase = props.voucher?.voucherType === 'Purchase'
    const priority = isPurchase
      ? (props.availableTallyCreditors && props.availableTallyCreditors.length > 0 ? props.availableTallyCreditors : [])
      : props.availableTallyDebtors

    const prioritySet = new Set(priority)
    const others = props.availableAllLedgers.filter(l => !prioritySet.has(l))
    return [...priority, ...others]
  }

  const isPurchase = props.voucher?.voucherType === 'Purchase'
  const list = isPurchase
    ? (props.availableTallyCreditors && props.availableTallyCreditors.length > 0 ? props.availableTallyCreditors : props.availableTallyDebtors)
    : props.availableTallyDebtors
  return list || []
})

// Check if current partyLedgerName is a genuine Tally ledger
const isValidTallyLedger = computed(() => {
  if (!form.value.partyLedgerName) return false
  const trimmed = form.value.partyLedgerName.trim().toLowerCase()
  return activeTallyLedgers.value.some(l => l.trim().toLowerCase() === trimmed)
})

// Suggested Tally ledger if available in active list
const suggestedMatch = computed(() => {
  if (!props.voucher) return ''
  const sug = props.voucher.suggestedTallyParty || ''
  if (!sug) return ''
  return activeTallyLedgers.value.find(l => l.toLowerCase() === sug.toLowerCase()) || ''
})

// Initialize form when voucher changes
watch(() => props.voucher, (v) => {
  if (!v) return
  postFeedback.value = null

  // Date formatted for date input: YYYY-MM-DD
  const rawDate = v.voucherDate || ''
  if (rawDate.length === 8) {
    const y = rawDate.slice(0, 4)
    const m = rawDate.slice(4, 6)
    const d = rawDate.slice(6, 8)
    formDisplayDate.value = `${y}-${m}-${d}`
  } else {
    formDisplayDate.value = new Date().toISOString().slice(0, 10)
  }

  // If already mapped and exists in Tally, use it. Otherwise, force selection from Tally ledgers!
  const isAlreadyMapped = Boolean(v.isMapped && v.mappedTallyParty)
  const party = isAlreadyMapped ? (v.mappedTallyParty || '') : ''

  partySearchQuery.value = party
  isEditingParty.value = false
  showPartyDropdown.value = false

  form.value = {
    voucherType: v.voucherType || 'Sales',
    voucherNo: v.voucherNo,
    reference: v.reference || (v.voucherType === 'Purchase' ? v.voucherNo : ''),
    date: v.voucherDate,
    partyLedgerName: party,
    narration: v.narration || `${v.voucherType || 'Sales'} Invoice - ${v.voucherNo}`,
    saveMapping: !isAlreadyMapped,
    ledgerEntries: JSON.parse(JSON.stringify(v.defaultTallyEntries || []))
  }

  // Ensure first entry is party
  if (form.value.ledgerEntries.length > 0) {
    form.value.ledgerEntries[0].ledgerName = party
    if (v.voucherType === 'Purchase') {
      form.value.ledgerEntries[0].isDeemedPositive = false
      form.value.ledgerEntries[0].amount = Math.abs(v.totalAmount)
    } else {
      form.value.ledgerEntries[0].isDeemedPositive = true
      form.value.ledgerEntries[0].amount = Math.abs(v.totalAmount)
    }
  }
}, { immediate: true })

// Sync date input to YYYYMMDD
watch(formDisplayDate, (val) => {
  if (!val) return
  form.value.date = val.replace(/-/g, '')
})

// Filter parties for autocomplete across ALL existing Tally ledgers
const filteredTallyParties = computed(() => {
  const list = activeTallyLedgers.value
  const q = partySearchQuery.value.toLowerCase().trim()
  if (!q) return list.slice(0, 100)
  return list.filter(d => d.toLowerCase().includes(q)).slice(0, 100)
})

const selectPartyLedger = (ledger: string) => {
  form.value.partyLedgerName = ledger
  partySearchQuery.value = ledger
  isEditingParty.value = false
  showPartyDropdown.value = false
  if (form.value.ledgerEntries.length > 0) {
    form.value.ledgerEntries[0].ledgerName = ledger
  }
}

const startEditingParty = () => {
  isEditingParty.value = true
  showPartyDropdown.value = true
  partySearchQuery.value = form.value.partyLedgerName
}

const cancelEditingParty = () => {
  isEditingParty.value = false
  showPartyDropdown.value = false
  partySearchQuery.value = form.value.partyLedgerName
}

const onPartySearchEnter = () => {
  if (filteredTallyParties.value.length === 1) {
    selectPartyLedger(filteredTallyParties.value[0])
  } else if (filteredTallyParties.value.length > 1) {
    const exact = filteredTallyParties.value.find(l => l.toLowerCase() === partySearchQuery.value.trim().toLowerCase())
    if (exact) {
      selectPartyLedger(exact)
    }
  }
}

const onPartySearchBlur = () => {
  setTimeout(() => {
    showPartyDropdown.value = false
    if (!isValidTallyLedger.value) {
      partySearchQuery.value = ''
    } else {
      isEditingParty.value = false
      partySearchQuery.value = form.value.partyLedgerName
    }
  }, 250)
}

// Narration Helpers
const appendNarrationTag = (tag: string) => {
  if (!tag) return
  if (!form.value.narration) {
    form.value.narration = tag
  } else {
    form.value.narration = `${form.value.narration.trim()} - ${tag}`
  }
}

const resetNarration = () => {
  if (!props.voucher) return
  form.value.narration = props.voucher.narration || `${props.voucher.voucherType || 'Sales'} Invoice - ${props.voucher.voucherNo}`
}

// Ledger Rows management
const addLedgerRow = () => {
  const isPurchase = form.value.voucherType === 'Purchase'
  form.value.ledgerEntries.push({
    ledgerName: isPurchase ? 'Purchase GST@18%' : 'Sales GST@18%',
    amount: 0,
    isDeemedPositive: isPurchase ? true : false,
    type: isPurchase ? 'PURCHASE' : 'SALES'
  })
}

const removeLedgerRow = (idx: number) => {
  if (idx === 0) return // Cannot remove party row
  form.value.ledgerEntries.splice(idx, 1)
}

// Balance Calculation
const totalDr = computed(() => {
  return form.value.ledgerEntries.reduce((sum, e) => {
    return e.isDeemedPositive ? sum + Math.abs(Number(e.amount) || 0) : sum
  }, 0)
})

const totalCr = computed(() => {
  return form.value.ledgerEntries.reduce((sum, e) => {
    return !e.isDeemedPositive ? sum + Math.abs(Number(e.amount) || 0) : sum
  }, 0)
})

const imbalanceDiff = computed(() => {
  return Math.abs(totalDr.value - totalCr.value)
})

const isBalanced = computed(() => {
  return imbalanceDiff.value <= 0.05
})

// Close Modal
const close = () => {
  showPartyDropdown.value = false
  emit('close')
}

// Post to Tally Prime
const postToTally = async () => {
  if (!isBalanced.value || !props.voucher) return

  isPosting.value = true
  postFeedback.value = null

  try {
    const payload = {
      voucherId: props.voucher.id,
      voucherNo: form.value.voucherNo,
      voucherType: form.value.voucherType,
      date: form.value.date,
      partyLedgerName: form.value.partyLedgerName,
      reference: form.value.reference,
      narration: form.value.narration,
      ledgerEntries: form.value.ledgerEntries,
      busyPartyName: props.voucher.customerName,
      saveMapping: form.value.saveMapping
    }

    const res = await $fetch<any>('/api/tally/post-voucher', {
      method: 'POST',
      body: payload
    })

    if (res.success) {
      postFeedback.value = {
        success: true,
        message: `Voucher ${res.voucherNo} successfully created in company "${res.company}" on Tally Prime!`
      }
      emit('posted', res.voucherNo, form.value.partyLedgerName, props.voucher.customerName)
      setTimeout(() => {
        close()
      }, 1400)
    } else {
      postFeedback.value = {
        success: false,
        message: res.error || 'Tally Prime rejected the voucher.'
      }
    }
  } catch (err: any) {
    postFeedback.value = {
      success: false,
      message: err.data?.statusMessage || err.message || 'Failed connecting to Tally Prime'
    }
  } finally {
    isPosting.value = false
  }
}
</script>
