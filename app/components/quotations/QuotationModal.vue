<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 lg:p-6 animate-in fade-in duration-200"
    >
      <!-- Modal Box: Responsive Full-screen on mobile, rounded card on sm+ -->
      <div
        class="bg-[#faf8f5] w-full max-w-6xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden text-gray-900"
      >
        <!-- Modal Top Header -->
        <div class="px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center shrink-0">
              <Calculator class="w-5 h-5 text-[#1b3b5f]" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-sm sm:text-base font-black text-gray-900 truncate">
                  {{ isSuccessView ? 'Quotation Ready to Share' : (isEditingExisting ? 'View Quotation' : 'New Quotation') }}
                </h2>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                  {{ quoteNumber }}
                </span>
              </div>
              <p class="text-[11px] text-gray-500 truncate">
                {{ isSuccessView ? 'Share official quotation via WhatsApp, image or PDF.' : 'Search Google Sheet catalog, review DB inventory, and save quote.' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Sheet sync indicator in drafting mode -->
            <div v-if="!isSuccessView" class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] text-emerald-800 font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{{ products.length }} Sheet Items</span>
            </div>

            <!-- Close button -->
            <button
              type="button"
              @click="closeModal"
              class="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              title="Close Modal"
              data-modal-close="true"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════ -->
        <!-- VIEW 1: SUCCESS & SHARE VIEW (Shown after quote is saved or opened)-->
        <!-- ══════════════════════════════════════════════════════════════════ -->
        <div v-if="isSuccessView" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <!-- Success Banner -->
          <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 class="w-6 h-6" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm sm:text-base font-bold text-emerald-950">Quotation Generated & Saved!</h3>
              <p class="text-xs text-emerald-800 mt-0.5">
                Quote <strong>{{ quoteNumber }}</strong> for <strong>{{ customerName || 'Valued Customer' }}</strong> has been safely recorded in the database.
              </p>
            </div>
          </div>

          <!-- Sharing Action Bar -->
          <div class="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-2xs space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Share2 class="w-3.5 h-3.5 text-[#1a5c4c]" />
              <span>Share & Export Options</span>
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <!-- WhatsApp Share -->
              <button
                type="button"
                @click="exportQuote('whatsapp')"
                :disabled="isExporting"
                class="py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Loader2 v-if="isExporting && exportAction === 'whatsapp'" class="w-4 h-4 animate-spin" />
                <MessageCircle v-else class="w-4 h-4" />
                <span>Share on WhatsApp</span>
              </button>

              <!-- Save Image -->
              <button
                type="button"
                @click="exportQuote('download')"
                :disabled="isExporting"
                class="py-3 px-4 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Loader2 v-if="isExporting && exportAction === 'download'" class="w-4 h-4 animate-spin" />
                <Download v-else class="w-4 h-4" />
                <span>Save Image (PNG)</span>
              </button>

              <!-- Download PDF -->
              <button
                type="button"
                @click="exportQuote('pdf')"
                :disabled="isExporting"
                class="py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Loader2 v-if="isExporting && exportAction === 'pdf'" class="w-4 h-4 animate-spin" />
                <FileDown v-else class="w-4 h-4 text-gray-500" />
                <span>Download PDF</span>
              </button>

              <!-- Print Quotation -->
              <button
                type="button"
                @click="exportQuote('print')"
                :disabled="isExporting"
                class="py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
                title="Print quotation directly to printer or paper"
              >
                <Loader2 v-if="isExporting && exportAction === 'print'" class="w-4 h-4 animate-spin text-white" />
                <Printer v-else class="w-4 h-4 text-white" />
                <span>Print Quotation</span>
              </button>
            </div>
          </div>

          <!-- Visual Preview of the Quotation Card (Strict A4: 794px x 1123px with Fit & Zoom) -->
          <div class="space-y-3">
            <!-- Preview Controls Bar -->
            <div class="flex flex-wrap items-center justify-between bg-white border border-gray-200 px-3 sm:px-4 py-2.5 rounded-xl shadow-2xs gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-gray-800">Quotation Preview</span>
                <span class="text-xs font-mono font-bold text-[#1b3b5f] bg-[#1b3b5f]/10 px-2 py-0.5 rounded-lg border border-[#1b3b5f]/20">
                  {{ Math.round((currentScale || 1) * 100) }}% {{ zoomMode === 'fit' ? '• Fit to Screen' : '' }}
                </span>
                <span v-if="currentScale < 1" class="text-[11px] text-gray-400 hidden sm:inline">
                  &bull; Complete slip visible
                </span>

                <!-- Signature Action Pill -->
                <button
                  type="button"
                  @click="openSignatureModal(false)"
                  class="ml-1 sm:ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border shadow-2xs"
                  :class="signatureDataUrl ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'"
                  title="Draw or update authorized signatory signature"
                >
                  <PenTool class="w-3.5 h-3.5 text-[#1b3b5f]" />
                  <span>{{ signatureDataUrl ? 'Signature Added' : 'Add Signature' }}</span>
                </button>
              </div>

              <!-- Magnifying Zoom Controls -->
              <div class="flex items-center gap-1 sm:gap-1.5">
                <!-- Zoom Out -->
                <button
                  type="button"
                  @click="zoomOut"
                  :disabled="currentScale <= 0.35"
                  class="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition cursor-pointer disabled:opacity-30 border border-gray-300 flex items-center justify-center shadow-2xs"
                  title="Zoom Out"
                >
                  <ZoomOut class="w-4 h-4 text-gray-700" />
                </button>

                <!-- Fit Button -->
                <button
                  type="button"
                  @click="setZoomMode('fit')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  :class="zoomMode === 'fit' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'"
                  title="Fit preview to screen"
                >
                  Fit
                </button>

                <!-- 100% Actual Size Button -->
                <button
                  type="button"
                  @click="setZoomMode('actual')"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  :class="zoomMode === 'actual' ? 'bg-[#1b3b5f] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'"
                  title="View 100% Actual Size"
                >
                  100%
                </button>

                <!-- Zoom In -->
                <button
                  type="button"
                  @click="zoomIn"
                  :disabled="currentScale >= 1.6"
                  class="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition cursor-pointer disabled:opacity-30 border border-gray-300 flex items-center justify-center shadow-2xs"
                  title="Zoom In"
                >
                  <ZoomIn class="w-4 h-4 text-gray-700" />
                </button>

                <div class="h-4 w-px bg-gray-200 mx-0.5"></div>

                <!-- Quick Print Button -->
                <button
                  type="button"
                  @click="exportQuote('print')"
                  :disabled="isExporting"
                  class="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition cursor-pointer disabled:opacity-30 border border-gray-300 flex items-center justify-center shadow-2xs"
                  title="Print Quotation"
                >
                  <Loader2 v-if="isExporting && exportAction === 'print'" class="w-4 h-4 animate-spin text-[#1a5c4c]" />
                  <Printer v-else class="w-4 h-4 text-[#1b3b5f]" />
                </button>
              </div>
            </div>

            <!-- Canvas Container: Fixed Viewport Height & Stationary Floating Dock -->
            <div class="relative rounded-2xl overflow-hidden bg-slate-200/90 shadow-inner border border-slate-300/80">
              <!-- Scrollable Viewport with Fixed Stable Height (Does NOT change height when zooming) -->
              <div
                ref="previewViewportRef"
                class="p-3 sm:p-6 overflow-auto text-center h-[520px] sm:h-[680px] max-h-[72vh] pb-24"
              >
                <div
                  :style="{
                    width: `${Math.round(794 * currentScale)}px`,
                    height: `${Math.round(previewCardHeight * currentScale)}px`
                  }"
                  class="relative mx-auto text-left inline-block"
                >
                  <div
                    ref="onScreenCardRef"
                    :style="{
                      transform: `scale(${currentScale})`,
                      transformOrigin: 'top left',
                      width: '794px'
                    }"
                    class="absolute left-0 top-0 shadow-2xl rounded-2xl overflow-hidden bg-white min-h-[1123px] flex flex-col justify-between text-left antialiased"
                    style="-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision;"
                  >
                    <!-- Inner document padding -->
                    <div class="p-6 sm:p-8 space-y-6 text-gray-900">
                      <!-- Branded Quotation Card Header -->
                      <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1a5c4c] rounded-full"></div>
                      <div class="flex items-center justify-between border-b border-gray-200 pb-5">
                        <img
                          :src="logoDataUri || '/images/logo-original.png'"
                          alt="Silicon Marketing"
                          class="h-24 w-auto object-contain drop-shadow-xs"
                        />
                        <div class="text-right">
                          <span class="inline-block px-3.5 py-1 rounded-lg bg-[#1b3b5f] text-white text-[11px] font-black uppercase tracking-wider mb-1 shadow-2xs">
                            PRICE ESTIMATE
                          </span>
                          <div class="font-mono text-base font-black text-[#1b3b5f]">{{ quoteNumber }}</div>
                          <div class="text-xs text-gray-500 mt-0.5">
                            <span class="text-gray-400 font-medium">Date:</span>
                            <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
                          </div>
                          <div class="inline-block text-[11px] text-[#1a5c4c] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold mt-1">
                            Valid for {{ validityDays || 7 }} days
                          </div>
                        </div>
                      </div>

                      <!-- Customer Details Box (Option 3: Customer Details + Issued By) -->
                      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs gap-4">
                        <div class="min-w-0">
                          <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Customer Details:</span>
                          <div class="text-sm sm:text-base font-black text-[#1b3b5f] truncate">
                            {{ customerName || 'Valued Customer' }}
                          </div>
                          <div class="flex items-center gap-2.5 text-xs text-gray-600 mt-1 flex-wrap">
                            <span v-if="customerPhone" class="inline-flex items-center gap-1.5 font-mono">
                              <Phone class="w-3.5 h-3.5 text-[#1b3b5f]" />
                              <strong class="font-bold text-gray-800">+91 {{ customerPhone }}</strong>
                            </span>
                            <span v-if="customerPhone && customerPlace" class="text-gray-300 font-bold">&bull;</span>
                            <span v-if="customerPlace" class="inline-flex items-center gap-1.5 font-medium">
                              <MapPin class="w-3.5 h-3.5 text-[#1b3b5f]" />
                              <strong class="font-bold text-gray-800">{{ customerPlace }}</strong>
                            </span>
                          </div>
                        </div>

                        <div class="text-right border-l border-slate-200 pl-4 sm:pl-6 shrink-0">
                          <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Issued By:</span>
                          <div class="text-xs sm:text-sm font-black text-[#1b3b5f]">
                            Silicon Marketing
                          </div>
                          <div class="text-[11px] text-gray-500 mt-0.5 flex items-center justify-end gap-1">
                            <span class="text-gray-400 font-medium">Rep:</span>
                            <strong class="font-black text-gray-800">{{ displayCreatorName }}</strong>
                          </div>
                        </div>
                      </div>

                      <!-- Items Table Preview -->
                      <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr class="bg-[#1b3b5f] text-white font-extrabold text-[10px] uppercase tracking-wider">
                              <th class="py-2 px-2 text-center w-6">#</th>
                              <th class="py-2 px-2.5 w-24">Article No.</th>
                              <th class="py-2 px-2.5">Product Description</th>
                              <th class="py-2 px-2 text-center w-12">Brand</th>
                              <th class="py-2 px-2 text-center w-12">Qty</th>
                              <th class="py-2 px-2.5 text-right w-18">MRP (₹)</th>
                              <th class="py-2 px-2 text-center w-10">UoM</th>
                              <th class="py-2 px-2.5 text-right w-24">Rate (₹)</th>
                              <th class="py-2 px-2.5 text-right w-24">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100">
                            <tr v-for="(it, i) in quoteItems" :key="it.id" class="border-b border-gray-100 text-[11px]">
                              <td class="py-2 px-2 text-center text-gray-500 font-mono font-bold">{{ i + 1 }}</td>
                              <td class="py-2 px-2.5 font-mono font-black text-[#1b3b5f]">{{ it.articleNumber }}</td>
                              <td class="py-2 px-2.5 font-bold text-gray-950 leading-snug">{{ it.description }}</td>
                              <td class="py-2 px-2 text-center font-black text-[10px] text-gray-800 uppercase">{{ it.brand }}</td>
                              <td
                                class="py-2 px-2 text-center font-black"
                                :class="isItemInStock(it) ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fff3e0] text-[#d9480f]'"
                              >
                                {{ it.quantity }}
                              </td>
                              <td class="py-2 px-2.5 text-right font-mono font-bold text-gray-700">₹{{ it.mrp.toLocaleString('en-IN') }}</td>
                              <td class="py-2 px-2 text-center font-bold text-gray-700">{{ it.uom }}</td>
                              <td class="py-2 px-2.5 text-right font-mono font-black text-[#1a5c4c]">₹{{ calculateUnitRate(it).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                              <td class="py-2 px-2.5 text-right font-mono font-black text-gray-950 text-xs">₹{{ Math.round(calculateLineTotal(it)).toLocaleString('en-IN') }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <!-- Legend -->
                      <div class="flex items-center gap-4 text-[10px] px-3.5 py-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span class="font-bold uppercase tracking-wider text-gray-500">Availability:</span>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          <strong class="font-black text-gray-900">In Stock</strong>
                          <span class="text-gray-500 font-medium">(Ready to dispatch)</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                          <strong class="font-black text-gray-900">Against Order</strong>
                          <span class="text-gray-500 font-medium">(Lead time: 3–4 working days)</span>
                        </div>
                      </div>

                      <!-- Summary Breakdown -->
                      <div class="flex justify-between items-start pt-2 text-xs">
                        <div class="w-7/12 text-[11px] text-gray-600 pr-6 space-y-1">
                          <span class="font-black uppercase tracking-wider text-[#1b3b5f] block mb-1">Terms:</span>
                          <p>&bull; Rates valid for <strong class="text-gray-900 font-bold">{{ validityDays || 7 }} days</strong> from issue date.</p>
                          <p>&bull; Subject to material stock availability at the time of order confirmation.</p>
                          <p class="font-black text-rose-700">&bull; No return or exchange once order is processed.</p>
                          <p v-if="displayQuoteNotes" class="font-semibold text-gray-800">&bull; {{ displayQuoteNotes }}</p>
                        </div>

                        <div class="w-5/12 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                          <div class="flex justify-between text-gray-500">
                            <span class="font-bold text-gray-700">Total MRP:</span>
                            <span class="font-mono font-bold text-gray-800">₹{{ totalMrp.toLocaleString('en-IN') }}</span>
                          </div>
                          <div v-if="totalDiscountSaved > 0" class="flex justify-between text-[#1a5c4c] font-black bg-emerald-50 px-2 py-0.5 rounded">
                            <span>Total Discount:</span>
                            <span class="font-mono font-black">-₹{{ totalDiscountSaved.toLocaleString('en-IN') }}</span>
                          </div>
                          <div class="flex justify-between text-gray-800 font-black">
                            <span>Subtotal:</span>
                            <span class="font-mono text-gray-950 font-black">₹{{ subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                          </div>
                          <div v-if="taxMode === 'EXTRA'" class="flex justify-between text-gray-600">
                            <span class="font-bold text-gray-700">GST (18%):</span>
                            <span class="font-mono font-bold text-gray-800">+₹{{ gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                          </div>
                          <div class="pt-2 border-t-2 border-slate-200 flex justify-between items-baseline font-black">
                            <span class="text-xs uppercase font-black text-[#1b3b5f]">Grand Total:</span>
                            <span class="text-xl sm:text-2xl text-[#1b3b5f] font-mono font-black">₹{{ Math.round(grandTotal).toLocaleString('en-IN') }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Nondisclosure Obligations Notice -->
                      <div class="pt-3 border-t border-gray-100 text-[9px] text-gray-400 leading-relaxed">
                        <strong class="font-black text-gray-600 uppercase tracking-wider">Nondisclosure obligations:</strong>
                        In general, recipients of confidential information are subject to an affirmative duty to keep the information confidential, and not to disclose it to third parties except as expressly permitted by the agreement.
                      </div>
                    </div>

                    <!-- Footer Signoff pinned to bottom of A4 card -->
                    <div class="px-6 sm:px-8 pb-6 pt-4 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
                      <div>
                        <strong class="font-bold block text-gray-700">Silicon Marketing &bull; Price Estimate</strong>
                        <span class="text-[9px] text-gray-400">Order Workspace Verified</span>
                      </div>
                      <div class="flex flex-col items-center text-center">
                        <div class="h-10 flex items-end justify-center mb-1">
                          <img
                            v-if="signatureDataUrl"
                            :src="signatureDataUrl"
                            alt="Authorized Signature"
                            class="max-h-10 max-w-[130px] object-contain"
                          />
                        </div>
                        <div class="border-t border-gray-400 w-32 pt-1">
                          <strong class="font-bold text-gray-800 block">Authorized Signatory</strong>
                          <span class="text-[9px] text-gray-400 block">{{ displayCreatorName }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Stationary Floating Magnifier Zoom Dock at Bottom Center -->
              <div class="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center bg-[#1b3b5f]/95 backdrop-blur-md text-white shadow-2xl rounded-full p-1.5 gap-1.5 border border-white/20 select-none z-30 pointer-events-auto">
                <!-- Zoom Out -->
                <button
                  type="button"
                  @click="zoomOut"
                  :disabled="currentScale <= 0.35"
                  class="p-2 hover:bg-white/20 rounded-full cursor-pointer disabled:opacity-30 transition flex items-center justify-center"
                  title="Zoom Out"
                >
                  <ZoomOut class="w-4 h-4" />
                </button>

                <div class="h-4 w-px bg-white/25"></div>

                <!-- Scale percentage display -->
                <button
                  type="button"
                  @click="setZoomMode(zoomMode === 'fit' ? 'actual' : 'fit')"
                  class="px-2.5 py-1 text-xs font-mono font-bold hover:bg-white/20 rounded-full transition flex items-center gap-1 cursor-pointer"
                  title="Click to toggle Fit / 100%"
                >
                  <span>{{ Math.round((currentScale || 1) * 100) }}%</span>
                  <span class="text-[10px] text-emerald-300 font-sans font-semibold">{{ zoomMode === 'fit' ? '(Fit)' : '' }}</span>
                </button>

                <div class="h-4 w-px bg-white/25"></div>

                <!-- Zoom In -->
                <button
                  type="button"
                  @click="zoomIn"
                  :disabled="currentScale >= 1.6"
                  class="p-2 hover:bg-white/20 rounded-full cursor-pointer disabled:opacity-30 transition flex items-center justify-center"
                  title="Zoom In"
                >
                  <ZoomIn class="w-4 h-4" />
                </button>

                <div class="h-4 w-px bg-white/25"></div>

                <!-- Fit button -->
                <button
                  type="button"
                  @click="setZoomMode('fit')"
                  class="px-2.5 py-1 text-xs font-bold rounded-full transition cursor-pointer"
                  :class="zoomMode === 'fit' ? 'bg-emerald-500 text-white shadow-xs' : 'text-gray-200 hover:bg-white/20'"
                >
                  Fit
                </button>

                <!-- 100% button -->
                <button
                  type="button"
                  @click="setZoomMode('actual')"
                  class="px-2.5 py-1 text-xs font-bold rounded-full transition cursor-pointer"
                  :class="zoomMode === 'actual' ? 'bg-emerald-500 text-white shadow-xs' : 'text-gray-200 hover:bg-white/20'"
                >
                  100%
                </button>
              </div>
            </div>
        </div>
      </div>

        <!-- ══════════════════════════════════════════════════════════════════ -->
        <!-- VIEW 2: DRAFTING / BUILDER VIEW (Customer details, search, table) -->
        <!-- ══════════════════════════════════════════════════════════════════ -->
        <div v-else class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <!-- Step 1: Customer & Quotation Meta Details -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 sm:p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
                <User class="w-4 h-4 text-[#1a5c4c]" />
                <span>1. Customer & Quotation Details</span>
              </h3>
              <span class="text-[11px] font-mono text-gray-400 font-bold">Quote ID: {{ quoteNumber }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <!-- Customer / Company Name -->
              <div class="sm:col-span-5">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Customer / Company Name *</label>
                <input
                  v-model="customerName"
                  type="text"
                  placeholder="e.g. Rajesh Patel / Royal Interiors"
                  class="w-full px-3 py-2 bg-gray-50/60 focus:bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition"
                />
              </div>

              <!-- Place / City -->
              <div class="sm:col-span-3">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Place / City</label>
                <input
                  v-model="customerPlace"
                  type="text"
                  placeholder="e.g. Mysuru / Bangalore"
                  class="w-full px-3 py-2 bg-gray-50/60 focus:bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition"
                />
              </div>

              <!-- WhatsApp / Phone -->
              <div class="sm:col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Phone Number</label>
                <div class="relative">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold">+91</span>
                  <input
                    v-model="customerPhone"
                    type="tel"
                    placeholder="9876543210"
                    class="w-full pl-9 pr-2 py-2 bg-gray-50/60 focus:bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition"
                  />
                </div>
              </div>

              <!-- Validity (Days) -->
              <div class="sm:col-span-2">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Validity (Days)</label>
                <div class="relative">
                  <input
                    v-model.number="validityDays"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="7"
                    class="w-full px-3 py-2 pr-10 bg-gray-50/60 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1a5c4c]/20 focus:border-[#1a5c4c] transition"
                  />
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold select-none">
                    days
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Search & Autocomplete Bar -->
          <div class="relative z-30">
            <div class="bg-white rounded-2xl border-2 border-emerald-600/30 shadow-sm p-3 sm:p-3.5 transition-all focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-600/10">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-[#1a5c4c] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Search class="w-4 h-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <label class="block text-[10px] font-bold uppercase tracking-widest text-[#1a5c4c] mb-0.5">
                    Quick Item Finder (Search Google Sheet Hardware Catalog)
                  </label>
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    @keydown.down.prevent="navigateResults(1)"
                    @keydown.up.prevent="navigateResults(-1)"
                    @keydown.enter.prevent="selectHighlightedOrFirst"
                    type="text"
                    placeholder="Type Article Number (e.g. 372.38.151, IA120104236) or Description / Brand..."
                    class="w-full bg-transparent text-xs sm:text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <div v-if="searchQuery" class="flex items-center gap-1">
                  <button
                    @click="searchQuery = ''; highlightedIndex = -1"
                    class="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
                <div class="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-gray-400 px-2.5 py-1 bg-gray-100 rounded-lg shrink-0">
                  <span>Press</span>
                  <kbd class="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-mono text-[10px] shadow-2xs">Enter ↵</kbd>
                  <span>to add</span>
                </div>
              </div>
            </div>

            <!-- Autocomplete Results Dropdown -->
            <div
              v-if="searchQuery.trim().length >= 2"
              class="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100 max-h-[340px] overflow-y-auto z-50 animate-in fade-in duration-150"
            >
              <div v-if="filteredSearchResults.length === 0" class="p-6 text-center text-gray-500 text-xs">
                <PackageSearch class="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                <p class="font-bold text-gray-700">No matching article or product found</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Try typing the article number digits or brand name.</p>
              </div>

              <div
                v-for="(item, idx) in filteredSearchResults"
                :key="item.articleNumber"
                @click="addItemToQuote(item)"
                @mouseenter="highlightedIndex = idx"
                class="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                :class="highlightedIndex === idx ? 'bg-emerald-50/70 border-l-4 border-l-[#1a5c4c]' : 'hover:bg-gray-50/80'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-6 h-6 rounded-md bg-gray-100 text-gray-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    #
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-mono font-bold text-xs text-gray-900 bg-gray-100 px-1.5 py-0.2 rounded">
                        {{ item.articleNumber }}
                      </span>
                      <span class="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-blue-50 text-blue-800 border border-blue-200">
                        {{ item.brand }}
                      </span>
                      <span v-if="item.stock" class="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Sheet Stock: {{ item.stock }}
                      </span>
                    </div>
                    <p class="text-xs font-semibold text-gray-800 truncate mt-0.5">
                      {{ item.description }}
                    </p>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <div class="flex items-baseline gap-1.5 justify-end">
                    <span class="text-xs text-gray-400 line-through">₹{{ item.mrp.toLocaleString('en-IN') }}</span>
                    <span class="text-xs sm:text-sm font-black text-[#1a5c4c]">
                      ₹{{ Math.round(item.mrp * (1 - item.defaultDiscount / 100)).toLocaleString('en-IN') }}
                    </span>
                  </div>
                  <div class="text-[10px] text-gray-500 font-medium">
                    <span class="text-emerald-700 font-bold">{{ item.defaultDiscount }}% off</span>
                    <span> &bull; {{ item.uom }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Quoted Items Table -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div class="px-4 sm:px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-md bg-[#1a5c4c]/10 text-[#1a5c4c] flex items-center justify-center font-bold text-xs">
                  {{ quoteItems.length }}
                </span>
                <h4 class="text-xs font-bold text-gray-900">Line Items in Quotation</h4>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="addCustomItem"
                  class="px-2.5 py-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus class="w-3 h-3 text-[#1a5c4c]" />
                  <span>Custom Item</span>
                </button>
                <button
                  v-if="quoteItems.length > 0"
                  type="button"
                  @click="clearAllItems"
                  class="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <!-- Empty Items State -->
            <div v-if="quoteItems.length === 0" class="py-12 px-4 text-center">
              <FileText class="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p class="text-xs font-bold text-gray-700">No items added to quotation yet</p>
              <p class="text-[11px] text-gray-400 max-w-sm mx-auto mt-0.5">
                Type an article number in the search bar above to add items directly from your Google Sheet.
              </p>
            </div>

            <!-- Table of Items -->
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[760px] text-xs">
                <thead>
                  <tr class="bg-gray-50/90 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th class="py-2.5 px-2 w-7 text-center">#</th>
                    <th class="py-2.5 px-2.5 w-28">Article No.</th>
                    <th class="py-2.5 px-3">Description</th>
                    <th class="py-2.5 px-2 w-14 text-center">Brand</th>
                    <th class="py-2.5 px-2 w-28 text-center">Qty</th>
                    <th class="py-2.5 px-2.5 w-20 text-right">MRP (₹)</th>
                    <th class="py-2.5 px-2 w-12 text-center">UoM</th>
                    <th class="py-2.5 px-2.5 w-20 text-center bg-amber-50/40 border-x border-amber-100">Disc %</th>
                    <th class="py-2.5 px-3 w-24 text-right bg-emerald-50/30">Net Rate (₹)</th>
                    <th class="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th class="py-2.5 px-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr v-for="(row, idx) in quoteItems" :key="row.id" class="hover:bg-gray-50/70 transition-colors">
                    <td class="py-2.5 px-2 text-center text-gray-400 font-mono text-[11px]">{{ idx + 1 }}</td>
                    <td class="py-2.5 px-2.5">
                      <input
                        v-if="row.isCustom"
                        v-model="row.articleNumber"
                        type="text"
                        placeholder="Code"
                        class="w-full font-mono font-bold text-xs border border-gray-200 rounded px-1.5 py-0.5"
                      />
                      <span v-else class="font-mono font-bold text-xs text-gray-900">{{ row.articleNumber }}</span>
                    </td>
                    <td class="py-2.5 px-3">
                      <input
                        v-if="row.isCustom"
                        v-model="row.description"
                        type="text"
                        placeholder="Custom Material Name"
                        class="w-full font-semibold text-xs border border-gray-200 rounded px-1.5 py-0.5"
                      />
                      <div v-else class="font-semibold text-gray-800 leading-snug">{{ row.description }}</div>
                    </td>
                    <td class="py-2.5 px-2 text-center">
                      <input
                        v-if="row.isCustom"
                        v-model="row.brand"
                        type="text"
                        class="w-12 text-center uppercase font-bold text-[10px] border border-gray-200 rounded px-1 py-0.5"
                      />
                      <span v-else class="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                        {{ row.brand }}
                      </span>
                    </td>
                    <!-- Qty with DB Inventory status styling -->
                    <td
                      class="py-2.5 px-2 text-center transition-colors border-x"
                      :class="isItemInStock(row) ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'"
                    >
                      <div
                        class="inline-flex items-center border rounded-lg overflow-hidden shadow-2xs transition-colors"
                        :class="isItemInStock(row) ? 'border-emerald-500 bg-white text-emerald-950' : 'border-amber-400 bg-white text-amber-950'"
                      >
                        <button
                          type="button"
                          @click="row.quantity = Math.max(1, row.quantity - 1)"
                          class="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 font-bold"
                        >
                          -
                        </button>
                        <input
                          v-model.number="row.quantity"
                          type="number"
                          min="1"
                          class="w-10 text-center font-black text-xs py-0.5 focus:outline-none bg-transparent"
                          :class="isItemInStock(row) ? 'text-emerald-800' : 'text-amber-800'"
                        />
                        <button
                          type="button"
                          @click="row.quantity = row.quantity + 1"
                          class="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div class="mt-1 flex items-center justify-center">
                        <button
                          type="button"
                          @click.stop="requestToggleStock(row)"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer border shadow-2xs group select-none"
                          :class="isItemInStock(row) 
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300' 
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'"
                          :title="isItemInStock(row) ? 'In Stock (Green) • Click to toggle to Against Order' : 'Against Order (Orange) • Click to toggle to In Stock'"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full shrink-0"
                            :class="isItemInStock(row) ? 'bg-emerald-600' : 'bg-amber-500'"
                          ></span>
                          <span class="truncate max-w-[70px]">{{ isItemInStock(row) ? 'In Stock' : 'Against Order' }}</span>
                          <span
                            v-if="row.manualStockOverride !== undefined && row.manualStockOverride !== null"
                            class="text-[7.5px] font-black uppercase px-1 py-0.2 rounded bg-white/80 text-gray-700 ml-0.5 shrink-0"
                            title="Manually set by quote creator"
                          >
                            Manual
                          </span>
                          <RefreshCw class="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 shrink-0" />
                        </button>
                      </div>
                    </td>

                    <!-- MRP -->
                    <td class="py-2.5 px-2.5 text-right font-mono text-gray-600 tabular-nums">
                      <input
                        v-if="row.isCustom"
                        v-model.number="row.mrp"
                        type="number"
                        min="0"
                        class="w-16 text-right font-mono text-xs border border-gray-200 rounded px-1 py-0.5"
                      />
                      <span v-else>₹{{ row.mrp.toLocaleString('en-IN') }}</span>
                    </td>

                    <!-- UoM -->
                    <td class="py-2.5 px-2 text-center text-gray-500">
                      <input
                        v-if="row.isCustom"
                        v-model="row.uom"
                        type="text"
                        class="w-10 text-center text-xs border border-gray-200 rounded px-1 py-0.5 uppercase"
                      />
                      <span v-else>{{ row.uom }}</span>
                    </td>

                    <!-- Discount -->
                    <td class="py-2.5 px-2.5 bg-amber-50/20 border-x border-amber-100/60 text-center">
                      <div class="inline-flex items-center gap-0.5 justify-center">
                        <input
                          v-model.number="row.discount"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          class="w-12 text-center font-bold text-xs border border-amber-300 rounded-lg py-0.5 bg-white text-amber-900"
                        />
                        <span class="text-[10px] text-amber-700 font-bold">%</span>
                      </div>
                    </td>

                    <!-- Net Rate -->
                    <td class="py-2.5 px-3 text-right bg-emerald-50/20 font-bold text-emerald-900 font-mono tabular-nums">
                      ₹{{ calculateUnitRate(row).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </td>

                    <!-- Total Value -->
                    <td class="py-2.5 px-3 text-right font-black text-gray-900 font-mono tabular-nums">
                      ₹{{ Math.round(calculateLineTotal(row)).toLocaleString('en-IN') }}
                    </td>

                    <td class="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        @click="removeQuoteItem(idx)"
                        class="p-1 rounded text-gray-300 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Availability Legend & Policy Banner -->
              <div class="px-4 py-2.5 bg-gray-50/95 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-4 flex-wrap">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Availability:</span>
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 inline-block"></span>
                    <span class="font-bold text-gray-800 text-[11px]">In Stock</span>
                    <span class="text-gray-500 text-[11px]">(Ready to dispatch)</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 inline-block"></span>
                    <span class="font-bold text-gray-800 text-[11px]">Against Order</span>
                    <span class="text-gray-500 text-[11px]">(Lead time: 3–4 working days)</span>
                  </div>
                </div>
                <div class="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                  <AlertCircle class="w-3 h-3 text-rose-600 shrink-0" />
                  <span>No return or exchange once order is processed</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 4: Tax Options, Notes & Grand Total Grid -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div class="md:col-span-7 bg-white rounded-2xl border border-gray-200 p-4 space-y-3.5">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Settings class="w-3.5 h-3.5 text-[#1a5c4c]" />
                <span>GST Mode & Commercial Notes</span>
              </h4>

              <!-- GST Mode Radios -->
              <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">GST Calculation</label>
                <div class="grid grid-cols-3 gap-2">
                  <label
                    class="p-2.5 rounded-xl border cursor-pointer select-none transition text-center text-xs font-bold"
                    :class="taxMode === 'EXTRA' ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                  >
                    <input type="radio" v-model="taxMode" value="EXTRA" class="hidden" />
                    <span>+18% GST Extra</span>
                  </label>

                  <label
                    class="p-2.5 rounded-xl border cursor-pointer select-none transition text-center text-xs font-bold"
                    :class="taxMode === 'INCLUSIVE' ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                  >
                    <input type="radio" v-model="taxMode" value="INCLUSIVE" class="hidden" />
                    <span>GST Inclusive</span>
                  </label>

                  <label
                    class="p-2.5 rounded-xl border cursor-pointer select-none transition text-center text-xs font-bold"
                    :class="taxMode === 'NONE' ? 'bg-[#1a5c4c]/10 border-[#1a5c4c] text-[#1a5c4c]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                  >
                    <input type="radio" v-model="taxMode" value="NONE" class="hidden" />
                    <span>No Tax (Net)</span>
                  </label>
                </div>
              </div>

              <!-- Notes Textarea -->
              <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Terms / Remarks</label>
                <textarea
                  v-model="quoteNotes"
                  rows="2"
                  placeholder="e.g. Subject to full carton delivery."
                  class="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#1a5c4c]/20 outline-none"
                ></textarea>
              </div>

              <!-- Authorized Signatory in Draft Form -->
              <div class="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-3 shadow-2xs">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center shrink-0">
                    <PenTool class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Authorized Signatory</div>
                    <div class="text-xs font-bold text-gray-800 truncate">{{ displayCreatorName }}</div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <div v-if="signatureDataUrl" class="flex items-center gap-1.5">
                    <div class="h-8 px-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                      <img :src="signatureDataUrl" alt="Signature" class="max-h-7 max-w-[85px] object-contain" />
                    </div>
                    <button
                      type="button"
                      @click="openSignatureModal(false)"
                      class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      @click="signatureDataUrl = null"
                      class="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                      title="Remove signature"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    v-else
                    type="button"
                    @click="openSignatureModal(false)"
                    class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-gray-300/80 shadow-2xs"
                  >
                    <PenTool class="w-3.5 h-3.5 text-[#1a5c4c]" />
                    <span>Add Signature</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Grand Total Breakdown -->
            <div class="md:col-span-5 bg-white rounded-2xl border border-gray-200 p-4 space-y-2 text-xs">
              <div class="flex justify-between text-gray-500">
                <span>Total MRP:</span>
                <span class="font-mono font-semibold">₹{{ totalMrp.toLocaleString('en-IN') }}</span>
              </div>
              <div v-if="totalDiscountSaved > 0" class="flex justify-between text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded">
                <span>Total Discount:</span>
                <span class="font-mono">-₹{{ totalDiscountSaved.toLocaleString('en-IN') }}</span>
              </div>
              <div class="flex justify-between text-gray-700 font-bold">
                <span>Subtotal (After Disc):</span>
                <span class="font-mono">₹{{ subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
              </div>
              <div v-if="taxMode === 'EXTRA'" class="flex justify-between text-gray-600">
                <span>GST (18%):</span>
                <span class="font-mono font-semibold">+₹{{ gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
              </div>
              <div class="pt-2 border-t-2 border-gray-100 flex justify-between items-baseline font-black">
                <span class="text-xs uppercase text-[#1b3b5f]">Grand Total:</span>
                <span class="text-2xl font-mono text-[#1a5c4c]">₹{{ Math.round(grandTotal).toLocaleString('en-IN') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Bottom Actions Bar -->
        <div class="px-4 sm:px-6 py-3.5 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            @click="closeModal"
            class="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 transition cursor-pointer"
          >
            {{ isSuccessView ? 'Back to Quotations List' : 'Cancel' }}
          </button>

          <div class="flex items-center gap-2.5 sm:gap-3">
            <!-- Add / Edit Signature Button in Draft View -->
            <button
              v-if="!isSuccessView"
              type="button"
              @click="openSignatureModal(false)"
              class="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              :class="signatureDataUrl ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'"
              title="Add or edit your digital signature on this estimate"
            >
              <CheckCircle2 v-if="signatureDataUrl" class="w-4 h-4 text-emerald-600" />
              <PenTool v-else class="w-4 h-4 text-[#1a5c4c]" />
              <span>{{ signatureDataUrl ? 'Signed' : 'Add Signature' }}</span>
            </button>

            <!-- In Draft View: Primary Action is SAVE & GENERATE -->
            <button
              v-if="!isSuccessView"
              type="button"
              @click="saveAndGenerateQuote"
              :disabled="quoteItems.length === 0 || !customerName.trim() || isSaving"
              class="px-6 py-2.5 bg-[#1a5c4c] hover:bg-[#14483b] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
              <CheckCircle2 v-else class="w-4 h-4" />
              <span>Save & Generate Quotation</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden Off-Screen Card for Image & PDF Export (Strict A4: 794px x 1123px) -->
    <div class="fixed left-[-9999px] top-[-9999px] pointer-events-none">
      <div
        ref="quotationCardRef"
        class="w-[794px] min-h-[1123px] bg-white text-gray-900 p-8 rounded-none border border-gray-200 font-sans shadow-none flex flex-col justify-between antialiased"
        style="-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision; image-rendering: -webkit-optimize-contrast;"
      >
        <div class="space-y-6">
          <!-- Top Ribbon -->
          <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1a5c4c] rounded-full"></div>

        <!-- Header -->
        <div class="flex items-center justify-between border-b border-gray-200 pb-6 mb-6">
          <img
            :src="logoDataUri || '/images/logo-original.png'"
            alt="Silicon Marketing"
            class="h-24 w-auto object-contain"
            crossorigin="anonymous"
          />
          <div class="text-right">
            <span class="inline-block px-3.5 py-1 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-widest mb-1.5 shadow-2xs">
              PRICE ESTIMATE
            </span>
            <div class="font-mono text-base font-black text-[#1b3b5f]">{{ quoteNumber }}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              <span class="text-gray-400 font-medium">Date:</span>
              <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
            </div>
            <div class="inline-block text-[11px] text-[#1a5c4c] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold mt-1">
              Valid for {{ validityDays || 7 }} days
            </div>
          </div>
        </div>

        <!-- Customer Box (Option 3: Customer Details + Issued By) -->
        <div class="bg-slate-50/90 p-4 rounded-xl border border-slate-200/80 mb-6 flex justify-between items-center gap-6">
          <div class="min-w-0">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Customer Details:</span>
            <div class="text-base font-black text-[#1b3b5f]">
              {{ customerName || 'Valued Customer' }}
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-600 mt-1.5 flex-wrap">
              <span v-if="customerPhone" class="inline-flex items-center gap-1.5 font-mono">
                <Phone class="w-3.5 h-3.5 text-[#1b3b5f]" />
                <strong class="font-bold text-gray-800">+91 {{ customerPhone }}</strong>
              </span>
              <span v-if="customerPhone && customerPlace" class="text-gray-300 font-bold">&bull;</span>
              <span v-if="customerPlace" class="inline-flex items-center gap-1.5 font-medium">
                <MapPin class="w-3.5 h-3.5 text-[#1b3b5f]" />
                <strong class="font-bold text-gray-800">{{ customerPlace }}</strong>
              </span>
            </div>
          </div>

          <div class="text-right border-l border-slate-200 pl-6 shrink-0">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Issued By:</span>
            <div class="text-sm font-black text-[#1b3b5f]">
              Silicon Marketing
            </div>
            <div class="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
              <span class="text-gray-400 font-medium">Rep:</span>
              <strong class="font-black text-gray-800">{{ displayCreatorName }}</strong>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table class="w-full text-left border-collapse text-xs mb-3">
          <thead>
            <tr class="bg-[#1b3b5f] text-white font-extrabold text-[10px] uppercase tracking-wider">
              <th class="py-2.5 px-2 w-6 text-center">#</th>
              <th class="py-2.5 px-3 w-28">Article No.</th>
              <th class="py-2.5 px-3">Product Description</th>
              <th class="py-2.5 px-2 text-center w-14">Brand</th>
              <th class="py-2.5 px-2 text-center w-12">Qty</th>
              <th class="py-2.5 px-3 text-right w-20">MRP (₹)</th>
              <th class="py-2.5 px-2 text-center w-12">UoM</th>
              <th class="py-2.5 px-3 text-right w-28">Discounted Amount</th>
              <th class="py-2.5 px-3 text-right w-28">Total Value</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-for="(item, idx) in quoteItems" :key="item.id" class="border-b border-gray-100">
              <td class="py-2.5 px-2 text-center text-gray-500 font-mono font-bold text-[10px]">{{ idx + 1 }}</td>
              <td class="py-2.5 px-3 font-mono font-black text-[#1b3b5f] text-[11px]">{{ item.articleNumber }}</td>
              <td class="py-2.5 px-3 font-bold text-gray-950 text-[11px] leading-tight">{{ item.description }}</td>
              <td class="py-2.5 px-2 text-center font-black text-[10px] text-gray-800 uppercase">{{ item.brand }}</td>
              <td
                class="py-2.5 px-2 text-center font-black text-[11px]"
                :class="isItemInStock(item) ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fff3e0] text-[#d9480f]'"
              >
                {{ item.quantity }}
              </td>
              <td class="py-2.5 px-3 text-right font-mono font-bold text-gray-700 text-[11px]">₹{{ item.mrp.toLocaleString('en-IN') }}</td>
              <td class="py-2.5 px-2 text-center font-bold text-gray-700 text-[10px]">{{ item.uom }}</td>
              <td class="py-2.5 px-3 text-right font-mono font-black text-[#1a5c4c] text-[11px]">
                ₹{{ calculateUnitRate(item).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td class="py-2.5 px-3 text-right font-mono font-black text-gray-950 text-[11.5px]">
                ₹{{ Math.round(calculateLineTotal(item)).toLocaleString('en-IN') }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Availability Legend -->
        <div class="flex items-center gap-4 text-[10px] px-3.5 py-2 bg-slate-50 rounded-lg border border-slate-200/90 mb-5">
          <span class="font-bold uppercase tracking-wider text-gray-500">Availability:</span>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <strong class="font-black text-gray-900">In Stock</strong>
            <span class="text-gray-500 font-medium">(Ready to dispatch)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <strong class="font-black text-gray-900">Against Order</strong>
            <span class="text-gray-500 font-medium">(Lead time: 3–4 working days)</span>
          </div>
        </div>

        <!-- Summary & Totals -->
        <div class="flex justify-between items-start pt-2">
          <div class="w-7/12 text-[11px] text-gray-600 pr-6 space-y-1.5">
            <span class="font-black uppercase tracking-wider text-[#1b3b5f] block mb-1">Terms & Conditions:</span>
            <p>&bull; Rates valid for <strong class="text-gray-900 font-bold">{{ validityDays || 7 }} days</strong> from date of issue.</p>
            <p>&bull; Subject to material stock availability at the time of order confirmation.</p>
            <p class="font-black text-rose-700">&bull; No return or exchange once order is processed.</p>
            <p v-if="displayQuoteNotes" class="font-semibold text-gray-800">&bull; {{ displayQuoteNotes }}</p>
          </div>

          <div class="w-5/12 bg-slate-50/90 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div class="flex justify-between text-gray-500">
              <span class="font-bold text-gray-700">Total MRP:</span>
              <span class="font-mono font-bold text-gray-800">₹{{ totalMrp.toLocaleString('en-IN') }}</span>
            </div>
            <div v-if="totalDiscountSaved > 0" class="flex justify-between text-[#1a5c4c] font-black bg-emerald-50/80 px-2 py-1 rounded border border-emerald-100">
              <span>Total Discount:</span>
              <span class="font-mono font-black">-₹{{ totalDiscountSaved.toLocaleString('en-IN') }}</span>
            </div>
            <div class="flex justify-between text-gray-800 font-black">
              <span>Subtotal:</span>
              <span class="font-mono text-gray-950 font-black">₹{{ subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="taxMode === 'EXTRA'" class="flex justify-between text-gray-600">
              <span class="font-bold text-gray-700">GST (18%):</span>
              <span class="font-mono font-bold text-gray-800">+₹{{ gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div class="pt-2 border-t-2 border-slate-200 flex justify-between items-baseline font-black">
              <span class="text-xs uppercase font-black text-[#1b3b5f]">Total Payable:</span>
              <span class="text-2xl text-[#1b3b5f] font-mono font-black tracking-tight">₹{{ Math.round(grandTotal).toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </div>

        <!-- Nondisclosure Obligations Notice -->
        <div class="pt-3 border-t border-gray-100 text-[9px] text-gray-400 leading-relaxed">
          <span class="font-bold text-gray-500 uppercase tracking-wider">Nondisclosure obligations:</span>
          In general, recipients of confidential information are subject to an affirmative duty to keep the information confidential, and not to disclose it to third parties except as expressly permitted by the agreement.
        </div>
        </div>

        <!-- Footer Signoff pinned to bottom of A4 page -->
        <div class="mt-auto pt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-400">
          <div>
            <span class="block font-medium">Silicon Marketing &bull; Price Estimate</span>
          </div>
          <div class="flex flex-col items-center text-center">
            <div class="h-10 flex items-end justify-center mb-1">
              <img
                v-if="signatureDataUrl"
                :src="signatureDataUrl"
                alt="Authorized Signature"
                class="max-h-10 max-w-[130px] object-contain"
              />
            </div>
            <div class="border-t border-gray-400 w-32 pt-1">
              <span class="font-bold text-gray-700 block">Authorized Signatory</span>
              <span class="text-[9px] text-gray-400 block">{{ displayCreatorName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dedicated Multi-Page PDF Container (Strict 794px x 1123px A4 per page) -->
    <div v-if="pdfPages.length > 0" class="fixed left-[-9999px] top-[-9999px] pointer-events-none">
      <div ref="pdfPagesContainerRef" class="flex flex-col gap-12">
        <div
          v-for="pg in pdfPages"
          :key="pg.pageNum"
          class="pdf-page-container w-[794px] h-[1123px] bg-white text-gray-900 p-8 rounded-none border border-gray-200 font-sans shadow-none flex flex-col justify-between antialiased box-border overflow-hidden"
          style="-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: geometricPrecision;"
        >
          <!-- Page Body -->
          <div class="space-y-4">
            <!-- Top Ribbon -->
            <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1a5c4c] rounded-full"></div>

            <!-- Page 1 Header (Full) -->
            <div v-if="pg.isFirst">
              <div class="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
                <img
                  :src="logoDataUri || '/images/logo-original.png'"
                  alt="Silicon Marketing"
                  class="h-20 w-auto object-contain"
                  crossorigin="anonymous"
                />
                <div class="text-right">
                  <span class="inline-block px-3 py-0.5 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-widest mb-1 shadow-2xs">
                    PRICE ESTIMATE
                  </span>
                  <div class="font-mono text-base font-black text-[#1b3b5f]">{{ quoteNumber }}</div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    <span class="text-gray-400 font-medium">Date:</span>
                    <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
                  </div>
                  <div class="inline-block text-[11px] text-[#1a5c4c] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold mt-1">
                    Valid for {{ validityDays || 7 }} days
                  </div>
                </div>
              </div>

              <!-- Customer Box -->
              <div class="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 mb-4 flex justify-between items-center gap-6">
                <div class="min-w-0">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">Customer Details:</span>
                  <div class="text-base font-black text-[#1b3b5f]">
                    {{ customerName || 'Valued Customer' }}
                  </div>
                  <div class="flex items-center gap-3 text-xs text-gray-600 mt-1 flex-wrap">
                    <span v-if="customerPhone" class="inline-flex items-center gap-1 font-mono">
                      <Phone class="w-3.5 h-3.5 text-[#1b3b5f]" />
                      <strong class="font-bold text-gray-800">+91 {{ customerPhone }}</strong>
                    </span>
                    <span v-if="customerPhone && customerPlace" class="text-gray-300 font-bold">&bull;</span>
                    <span v-if="customerPlace" class="inline-flex items-center gap-1 font-medium">
                      <MapPin class="w-3.5 h-3.5 text-[#1b3b5f]" />
                      <strong class="font-bold text-gray-800">{{ customerPlace }}</strong>
                    </span>
                  </div>
                </div>

                <div class="text-right border-l border-slate-200 pl-5 shrink-0">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">Issued By:</span>
                  <div class="text-sm font-black text-[#1b3b5f]">
                    Silicon Marketing
                  </div>
                  <div class="text-xs text-gray-500 mt-0.5 flex items-center justify-end gap-1">
                    <span class="text-gray-400 font-medium">Rep:</span>
                    <strong class="font-black text-gray-800">{{ displayCreatorName }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Continuation Header (Page 2+) -->
            <div v-else>
              <div class="flex items-center justify-between border-b border-gray-200 pb-3 mb-3">
                <div class="flex items-center gap-3">
                  <img
                    :src="logoDataUri || '/images/logo-original.png'"
                    alt="Silicon Marketing"
                    class="h-12 w-auto object-contain"
                    crossorigin="anonymous"
                  />
                  <div class="border-l border-gray-200 pl-3">
                    <span class="inline-block px-2 py-0.5 rounded bg-[#1b3b5f] text-white text-[10px] font-black uppercase tracking-wider">
                      PRICE ESTIMATE &bull; CONTINUATION
                    </span>
                    <div class="text-[11px] text-gray-500 font-medium mt-0.5">
                      Silicon Marketing Order Management
                    </div>
                  </div>
                </div>

                <div class="text-right">
                  <div class="font-mono text-sm font-black text-[#1b3b5f]">{{ quoteNumber }}</div>
                  <div class="text-[11px] text-gray-500">
                    <span class="text-gray-400 font-medium">Date:</span>
                    <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
                  </div>
                </div>
              </div>

              <!-- Continuation Customer Bar -->
              <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-3 flex justify-between items-center text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Customer:</span>
                  <strong class="text-[#1b3b5f] font-bold">{{ customerName || 'Valued Customer' }}</strong>
                  <span v-if="customerPhone" class="text-gray-300">&bull;</span>
                  <span v-if="customerPhone" class="font-mono text-gray-700">+91 {{ customerPhone }}</span>
                  <span v-if="customerPlace" class="text-gray-300">&bull;</span>
                  <span v-if="customerPlace" class="text-gray-700">{{ customerPlace }}</span>
                </div>
                <div class="text-[11px] text-gray-500">
                  Rep: <strong class="text-gray-800">{{ displayCreatorName }}</strong>
                </div>
              </div>
            </div>

            <!-- Items Table (on EVERY page) -->
            <table class="w-full text-left border-collapse text-xs mb-2">
              <thead>
                <tr class="bg-[#1b3b5f] text-white font-extrabold text-[10px] uppercase tracking-wider">
                  <th class="py-2 px-2 w-6 text-center">#</th>
                  <th class="py-2 px-3 w-28">Article No.</th>
                  <th class="py-2 px-3">Product Description</th>
                  <th class="py-2 px-2 text-center w-14">Brand</th>
                  <th class="py-2 px-2 text-center w-12">Qty</th>
                  <th class="py-2 px-3 text-right w-20">MRP (₹)</th>
                  <th class="py-2 px-2 text-center w-12">UoM</th>
                  <th class="py-2 px-3 text-right w-28">Discounted Amount</th>
                  <th class="py-2 px-3 text-right w-28">Total Value</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                <tr v-for="(item, idx) in pg.items" :key="item.id" class="border-b border-gray-100">
                  <td class="py-2 px-2 text-center text-gray-500 font-mono font-bold text-[10px]">{{ pg.startIndex + idx + 1 }}</td>
                  <td class="py-2 px-3 font-mono font-black text-[#1b3b5f] text-[11px]">{{ item.articleNumber }}</td>
                  <td class="py-2 px-3 font-bold text-gray-950 text-[11px] leading-tight">{{ item.description }}</td>
                  <td class="py-2 px-2 text-center font-black text-[10px] text-gray-800 uppercase">{{ item.brand }}</td>
                  <td
                    class="py-2 px-2 text-center font-black text-[11px]"
                    :class="isItemInStock(item) ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fff3e0] text-[#d9480f]'"
                  >
                    {{ item.quantity }}
                  </td>
                  <td class="py-2 px-3 text-right font-mono font-bold text-gray-700 text-[11px]">₹{{ item.mrp.toLocaleString('en-IN') }}</td>
                  <td class="py-2 px-2 text-center font-bold text-gray-700 text-[10px]">{{ item.uom }}</td>
                  <td class="py-2 px-3 text-right font-mono font-black text-[#1a5c4c] text-[11px]">
                    ₹{{ calculateUnitRate(item).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </td>
                  <td class="py-2 px-3 text-right font-mono font-black text-gray-950 text-[11.5px]">
                    ₹{{ Math.round(calculateLineTotal(item)).toLocaleString('en-IN') }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Summary & Totals (ONLY ON LAST PAGE) -->
            <div v-if="pg.isLast" class="space-y-3 pt-1">
              <!-- Availability Legend -->
              <div class="flex items-center gap-4 text-[10px] px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/90">
                <span class="font-bold uppercase tracking-wider text-gray-500">Availability:</span>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <strong class="font-black text-gray-900">In Stock</strong>
                  <span class="text-gray-500 font-medium">(Ready to dispatch)</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  <strong class="font-black text-gray-900">Against Order</strong>
                  <span class="text-gray-500 font-medium">(Lead time: 3–4 working days)</span>
                </div>
              </div>

              <!-- Summary & Totals Grid -->
              <div class="flex justify-between items-start pt-1">
                <div class="w-7/12 text-[11px] text-gray-600 pr-6 space-y-1">
                  <span class="font-black uppercase tracking-wider text-[#1b3b5f] block mb-0.5">Terms & Conditions:</span>
                  <p>&bull; Rates valid for <strong class="text-gray-900 font-bold">{{ validityDays || 7 }} days</strong> from date of issue.</p>
                  <p>&bull; Subject to material stock availability at the time of order confirmation.</p>
                  <p class="font-black text-rose-700">&bull; No return or exchange once order is processed.</p>
                  <p v-if="displayQuoteNotes" class="font-semibold text-gray-800">&bull; {{ displayQuoteNotes }}</p>
                </div>

                <div class="w-5/12 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div class="flex justify-between text-gray-500">
                    <span class="font-bold text-gray-700">Total MRP:</span>
                    <span class="font-mono font-bold text-gray-800">₹{{ totalMrp.toLocaleString('en-IN') }}</span>
                  </div>
                  <div v-if="totalDiscountSaved > 0" class="flex justify-between text-[#1a5c4c] font-black bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-100">
                    <span>Total Discount:</span>
                    <span class="font-mono font-black">-₹{{ totalDiscountSaved.toLocaleString('en-IN') }}</span>
                  </div>
                  <div class="flex justify-between text-gray-800 font-black">
                    <span>Subtotal:</span>
                    <span class="font-mono text-gray-950 font-black">₹{{ subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                  <div v-if="taxMode === 'EXTRA'" class="flex justify-between text-gray-600">
                    <span class="font-bold text-gray-700">GST (18%):</span>
                    <span class="font-mono font-bold text-gray-800">+₹{{ gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                  <div class="pt-1.5 border-t-2 border-slate-200 flex justify-between items-baseline font-black">
                    <span class="text-xs uppercase font-black text-[#1b3b5f]">Total Payable:</span>
                    <span class="text-2xl text-[#1b3b5f] font-mono font-black tracking-tight">₹{{ Math.round(grandTotal).toLocaleString('en-IN') }}</span>
                  </div>
                </div>
              </div>

              <!-- Nondisclosure Obligations Notice -->
              <div class="pt-2 border-t border-gray-100 text-[9px] text-gray-400 leading-relaxed">
                <span class="font-bold text-gray-500 uppercase tracking-wider">Nondisclosure obligations:</span>
                In general, recipients of confidential information are subject to an affirmative duty to keep the information confidential, and not to disclose it to third parties except as expressly permitted by the agreement.
              </div>
            </div>
          </div>

          <!-- Footer Signoff on EVERY page (Strictly pinned to bottom) -->
          <div class="mt-auto pt-3 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-400">
            <div>
              <span class="block font-medium">Silicon Marketing &bull; Price Estimate</span>
            </div>
            <span class="font-mono font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200/80 mb-1">
              Page {{ pg.pageNum }} of {{ pdfPages.length }}
            </span>
            <div class="flex flex-col items-center text-center">
              <div class="h-9 flex items-end justify-center mb-0.5">
                <img
                  v-if="signatureDataUrl"
                  :src="signatureDataUrl"
                  alt="Authorized Signature"
                  class="max-h-9 max-w-[120px] object-contain"
                />
              </div>
              <div class="border-t border-gray-300 w-28 pt-0.5">
                <span class="font-bold text-gray-700 block">Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Stock Override Confirmation Dialog -->
    <div
      v-if="stockOverrideModalOpen && targetOverrideRow"
      class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[80] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 overflow-hidden animate-in zoom-in-95 duration-150 text-gray-900"
      >
        <!-- Dialog Header -->
        <div class="flex items-start gap-3.5 mb-4">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            :class="desiredStockState ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'"
          >
            <CheckCircle2 v-if="desiredStockState" class="w-5 h-5" />
            <AlertCircle v-else class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">
              Override Stock Availability?
            </h3>
            <p class="text-xs text-gray-500 mt-0.5">
              Change item status from system detection
            </p>
          </div>
        </div>

        <!-- Product Summary Box -->
        <div class="bg-gray-50 rounded-xl p-3 border border-gray-200/80 mb-4 text-xs space-y-1">
          <div class="flex justify-between text-gray-500 font-mono text-[11px]">
            <span>Article: <strong class="text-gray-900 font-black">{{ targetOverrideRow.articleNumber }}</strong></span>
            <span>Qty: <strong class="text-gray-900 font-bold">{{ targetOverrideRow.quantity }} {{ targetOverrideRow.uom || 'PC' }}</strong></span>
          </div>
          <div class="font-bold text-gray-900 leading-snug">
            {{ targetOverrideRow.description }}
          </div>
        </div>

        <!-- System Detection Notice -->
        <div
          class="p-3.5 rounded-xl border text-xs leading-relaxed mb-5"
          :class="desiredStockState 
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
            : 'bg-amber-50/60 border-amber-200 text-amber-950'"
        >
          <div class="font-bold flex items-center gap-1.5 mb-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="getItemInventoryStatus(targetOverrideRow).inStock ? 'bg-emerald-500' : 'bg-amber-500'"
            ></span>
            <span>
              System Detected: 
              {{ getItemInventoryStatus(targetOverrideRow).inStock ? 'IN STOCK (Green)' : 'AGAINST ORDER (Orange)' }}
            </span>
          </div>
          <p v-if="!desiredStockState" class="text-gray-700">
            The system detected this item is <strong>in stock</strong>. Are you sure you want to go against the system and mark it as <strong class="text-amber-800">Against Order (Orange)</strong> with a lead time of 3–4 working days?
          </p>
          <p v-else class="text-gray-700">
            The system detected this item is <strong>out of stock / against order</strong>. Are you sure you want to go against the system and manually mark it as <strong class="text-emerald-800">In Stock (Green)</strong> as ready to dispatch?
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-2.5">
          <button
            type="button"
            @click="stockOverrideModalOpen = false"
            data-modal-close="true"
            class="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 border border-gray-300 transition cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            @click="confirmStockOverride"
            class="px-4 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-xs flex items-center gap-1.5"
            :class="desiredStockState ? 'bg-[#1a5c4c] hover:bg-[#14473b]' : 'bg-amber-600 hover:bg-amber-700'"
          >
            <span>Set to {{ desiredStockState ? 'In Stock (Green)' : 'Against Order (Orange)' }}</span>
          </button>
        </div>

        <!-- Reset option if already overridden -->
        <div
          v-if="targetOverrideRow.manualStockOverride !== undefined && targetOverrideRow.manualStockOverride !== null"
          class="mt-3 pt-3 border-t border-gray-100 text-center"
        >
          <button
            type="button"
            @click="resetStockToSystem"
            class="text-[11px] font-semibold text-gray-500 hover:text-gray-900 underline transition cursor-pointer"
          >
            Reset to Automatic System Detection
          </button>
        </div>
      </div>
    </div>

    <!-- Drawing Canvas Signature Modal -->
    <div
      v-if="isSignatureModalOpen"
      class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[85] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        class="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg p-6 overflow-hidden animate-in zoom-in-95 duration-150 text-gray-900 flex flex-col gap-4"
      >
        <!-- Modal Top Title -->
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center">
              <PenTool class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 leading-tight">
                Authorized Signatory
              </h3>
              <p class="text-xs text-gray-500">
                Sign below to authorize this quotation estimate
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="isSignatureModalOpen = false"
            data-modal-close="true"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Signer Info Badge -->
        <div class="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs">
          <span class="text-gray-500">Signing as: <strong class="text-[#1b3b5f] font-bold">{{ displayCreatorName }}</strong></span>
          <span class="font-mono text-[11px] text-gray-400">{{ quoteNumber }}</span>
        </div>

        <!-- Signature Canvas Card -->
        <div class="relative bg-slate-50/70 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden touch-none select-none">
          <canvas
            ref="signatureCanvasRef"
            class="w-full h-44 cursor-crosshair block bg-transparent"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart.prevent="startDrawing"
            @touchmove.prevent="draw"
            @touchend="stopDrawing"
          ></canvas>

          <!-- Centered Hint when empty (Fades out when drawing) -->
          <div
            v-if="!hasDrawnSignature"
            class="absolute inset-x-0 top-0 bottom-10 pointer-events-none flex flex-col items-center justify-center text-gray-400 gap-1.5 transition-opacity duration-150"
          >
            <PenTool class="w-6 h-6 stroke-[1.5] text-gray-300" />
            <span class="text-xs font-medium text-gray-400">Draw your signature with mouse or finger</span>
          </div>

          <!-- Bottom Reference Baseline (Stays locked at the exact same bottom position) -->
          <div class="absolute bottom-6 left-8 right-8 sm:left-12 sm:right-12 pointer-events-none flex flex-col items-center">
            <div class="w-full h-px bg-gray-300/80"></div>
            <span
              v-if="!hasDrawnSignature"
              class="text-[9px] uppercase tracking-widest text-gray-400 font-bold mt-1 select-none"
            >
              Sign above line
            </span>
          </div>

          <!-- Clear Canvas Button inside pad -->
          <button
            type="button"
            @click="clearSignature"
            :disabled="!hasDrawnSignature"
            class="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/90 hover:bg-white text-gray-700 border border-gray-300/80 shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            title="Clear signature"
          >
            <Eraser class="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        <!-- Modal Bottom Actions -->
        <div class="flex flex-wrap items-center justify-between gap-2.5 pt-2">
          <button
            type="button"
            @click="skipSignatureAndProceed"
            class="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
          >
            {{ isSuccessView ? 'Remove Signature' : (isSignatureModalTriggeredBySave ? 'Skip (No Signature)' : 'Clear Signature') }}
          </button>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="isSignatureModalOpen = false"
              class="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              Cancel
            </button>

            <!-- When opened from drafting form directly (not via Save & Generate) -->
            <template v-if="!isSuccessView && !isSignatureModalTriggeredBySave">
              <button
                type="button"
                @click="confirmSignatureAndProceed(false)"
                :disabled="!hasDrawnSignature"
                class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <CheckCircle2 class="w-4 h-4" />
                <span>Apply to Draft</span>
              </button>
              <button
                v-if="quoteItems.length > 0 && customerName.trim()"
                type="button"
                @click="confirmSignatureAndProceed(true)"
                :disabled="!hasDrawnSignature"
                class="px-4 py-2 bg-[#1a5c4c] hover:bg-[#14483b] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <CheckCircle2 class="w-4 h-4" />
                <span>Apply & Save</span>
              </button>
            </template>

            <!-- When in Success View or triggered by Save & Generate -->
            <button
              v-else
              type="button"
              @click="confirmSignatureAndProceed(true)"
              :disabled="!hasDrawnSignature"
              class="px-5 py-2 bg-[#1a5c4c] hover:bg-[#14483b] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ isSuccessView ? 'Apply Signature' : 'Save & Generate Quote' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  Search,
  X,
  Plus,
  Trash2,
  Download,
  FileDown,
  MessageCircle,
  FileText,
  User,
  Settings,
  AlertCircle,
  PackageSearch,
  Loader2,
  CheckCircle2,
  Calculator,
  Share2,
  Phone,
  MapPin,
  RefreshCw,
  PenTool,
  Eraser,
  ZoomIn,
  ZoomOut,
  Printer
} from 'lucide-vue-next'
import { toBlob, toPng, toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{
  modelValue: boolean
  initialQuote?: any | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', quote: any): void
}>()

const { showSaved, showEditing } = useSnackbar()
const { user } = useAuth()

// State
const isSuccessView = ref(false)
const isEditingExisting = ref(false)
const displayCreatorName = computed(() => {
  if (isEditingExisting.value && props.initialQuote?.createdByName) {
    return props.initialQuote.createdByName
  }
  return user.value?.name || 'Sales Staff'
})
const isSaving = ref(false)
const isExporting = ref(false)
const exportAction = ref<'whatsapp' | 'download' | 'pdf' | 'print' | null>(null)
const quotationCardRef = ref<HTMLElement | null>(null)

// Multi-Page PDF Pagination State & Types
interface PdfPageData {
  pageNum: number
  items: any[]
  startIndex: number
  isFirst: boolean
  isLast: boolean
}
const pdfPages = ref<PdfPageData[]>([])
const pdfPagesContainerRef = ref<HTMLElement | null>(null)

function paginateQuoteItems(
  items: any[],
  rowHeights: number[]
): PdfPageData[] {
  if (items.length === 0) {
    return [{ pageNum: 1, items: [], startIndex: 0, isFirst: true, isLast: true }]
  }

  // 1123px total A4 height - 64px padding (p-8) - 40px footer = 1019px usable
  const USABLE_H = 1015
  const P1_HEADER_H = 285      // Page 1 ribbon + large header + customer box
  const CONT_HEADER_H = 165    // Page 2+ ribbon + compact header + customer bar
  const TOTALS_H = 270         // Availability legend + terms + totals box + nondisclosure
  const BUFFER = 25            // Generous safety margin against font/subpixel variations

  const totalRowsH = rowHeights.reduce((sum, h) => sum + (h || 38), 0)

  // Case 1: All items + Totals fit comfortably on 1 single page
  if (P1_HEADER_H + totalRowsH + TOTALS_H + BUFFER <= USABLE_H) {
    return [{
      pageNum: 1,
      items: items.slice(),
      startIndex: 0,
      isFirst: true,
      isLast: true
    }]
  }

  // Case 2: Multi-page distribution
  const pages: PdfPageData[] = []
  let currentIndex = 0
  let pageNum = 1

  while (currentIndex < items.length) {
    const isFirst = pageNum === 1
    const headerH = isFirst ? P1_HEADER_H : CONT_HEADER_H

    // Check if ALL remaining items can fit on this page WITH the totals block
    let remainingRowsH = 0
    for (let k = currentIndex; k < items.length; k++) {
      remainingRowsH += (rowHeights[k] || 38)
    }

    if (headerH + remainingRowsH + TOTALS_H + BUFFER <= USABLE_H) {
      pages.push({
        pageNum,
        items: items.slice(currentIndex),
        startIndex: currentIndex,
        isFirst,
        isLast: true
      })
      break
    }

    // Otherwise, fill this page with as many items as fit without totals
    const maxAvailableRowsH = USABLE_H - headerH - BUFFER
    let currentRowsH = 0
    let countOnThisPage = 0

    while (
      currentIndex + countOnThisPage < items.length &&
      currentRowsH + (rowHeights[currentIndex + countOnThisPage] || 38) <= maxAvailableRowsH
    ) {
      currentRowsH += (rowHeights[currentIndex + countOnThisPage] || 38)
      countOnThisPage++
    }

    if (countOnThisPage === 0) countOnThisPage = 1

    // If this would consume ALL items, but we know totals didn't fit,
    // push at least 1 item to the next page so the final page has items with the totals
    if (currentIndex + countOnThisPage === items.length && countOnThisPage > 1) {
      countOnThisPage--
    }

    pages.push({
      pageNum,
      items: items.slice(currentIndex, currentIndex + countOnThisPage),
      startIndex: currentIndex,
      isFirst,
      isLast: false
    })

    currentIndex += countOnThisPage
    pageNum++
  }

  if (pages.length > 0) {
    pages[pages.length - 1].isLast = true
  }

  return pages
}

// Viewport & Scale State for Interactive Preview
const previewViewportRef = ref<HTMLElement | null>(null)
const onScreenCardRef = ref<HTMLElement | null>(null)
const previewCardHeight = ref<number>(1123)
const zoomMode = ref<'fit' | 'actual' | 'custom'>('fit')
const zoomLevel = ref<number>(1)
const fitScale = ref<number>(1)
let resizeObserver: ResizeObserver | null = null

const updateFitScale = () => {
  if (onScreenCardRef.value) {
    const cardH = onScreenCardRef.value.offsetHeight
    if (cardH && cardH > 200) {
      previewCardHeight.value = cardH
    }
  }
  if (!previewViewportRef.value) return
  const computedPad = typeof window !== 'undefined' && window.innerWidth < 640 ? 24 : 48
  const clientW = previewViewportRef.value.clientWidth
  if (!clientW || clientW <= 0) return
  const availableWidth = clientW - computedPad
  if (availableWidth > 0 && availableWidth < 794) {
    const calculated = Math.round((availableWidth / 794) * 100) / 100
    fitScale.value = Math.max(0.25, Math.min(1, isNaN(calculated) ? 0.45 : calculated))
  } else {
    fitScale.value = 1
  }
}

const currentScale = computed(() => {
  let scale = 1
  if (zoomMode.value === 'fit') {
    scale = fitScale.value
  } else if (zoomMode.value === 'actual') {
    scale = 1
  } else {
    scale = zoomLevel.value
  }
  return (!scale || isNaN(scale) || scale <= 0) ? 1 : scale
})

const zoomIn = () => {
  const current = currentScale.value
  const next = Math.min(1.8, Math.round((current + 0.15) * 100) / 100)
  zoomLevel.value = next
  zoomMode.value = 'custom'
}

const zoomOut = () => {
  const min = Math.max(0.25, Math.min(0.45, fitScale.value))
  const current = currentScale.value
  const next = Math.max(min, Math.round((current - 0.15) * 100) / 100)
  zoomLevel.value = next
  zoomMode.value = 'custom'
}

const setZoomMode = (mode: 'fit' | 'actual') => {
  zoomMode.value = mode
  if (mode === 'fit') {
    updateFitScale()
  } else if (mode === 'actual') {
    zoomLevel.value = 1
  }
}

const setupViewportObserver = () => {
  nextTick(() => {
    updateFitScale()
    setTimeout(updateFitScale, 80)
    setTimeout(updateFitScale, 250)
    if (typeof ResizeObserver !== 'undefined' && previewViewportRef.value) {
      if (resizeObserver) resizeObserver.disconnect()
      resizeObserver = new ResizeObserver(() => {
        updateFitScale()
      })
      resizeObserver.observe(previewViewportRef.value)
    }
  })
}

// Brand Logo Data URI
const logoDataUri = ref('')
const preloadLogo = async () => {
  if (logoDataUri.value) return
  try {
    const res = await fetch('/images/logo-original.png')
    const blob = await res.blob()
    await new Promise<void>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          logoDataUri.value = reader.result
        }
        resolve()
      }
      reader.onerror = () => resolve()
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('Could not preload logo as data URI:', err)
  }
}

// Catalog Sheet Products
interface SheetProduct {
  articleNumber: string
  description: string
  brand: string
  mrp: number
  uom: string
  moq: number
  gstRate: number
  defaultDiscount: number
  stock: string
  flag: string
}
const products = ref<SheetProduct[]>([])

const loadSheetCatalog = async () => {
  try {
    const res = await $fetch<any>('/api/quotations/sheet-products')
    if (res?.products) {
      products.value = res.products
    }
  } catch (err) {
    console.warn('Could not load sheet products:', err)
  }
}

// Quotation Meta
const generateQuoteNumber = () => {
  const d = new Date()
  const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `QT-${prefix}-${rand}`
}

const quoteNumber = ref(generateQuoteNumber())
const customerName = ref('')
const customerPlace = ref('')
const customerPhone = ref('')
const validityDays = ref<number | string>(7)
const quoteNotes = ref('')
const taxMode = ref<'EXTRA' | 'INCLUSIVE' | 'NONE'>('EXTRA')

// Line Items
interface QuoteRow {
  id: string
  articleNumber: string
  description: string
  brand: string
  quantity: number
  mrp: number
  uom: string
  discount: number
  moq?: number
  gstRate?: number
  stock?: string
  isCustom?: boolean
  inStock?: boolean
  manualStockOverride?: boolean | null
}
const quoteItems = ref<QuoteRow[]>([])

// Stock Override Modal State
const stockOverrideModalOpen = ref(false)
const targetOverrideRow = ref<QuoteRow | null>(null)
const desiredStockState = ref<boolean>(false)

const requestToggleStock = (row: QuoteRow) => {
  targetOverrideRow.value = row
  const current = isItemInStock(row)
  desiredStockState.value = !current
  stockOverrideModalOpen.value = true
}

const confirmStockOverride = () => {
  if (!targetOverrideRow.value) return
  targetOverrideRow.value.manualStockOverride = desiredStockState.value
  stockOverrideModalOpen.value = false
  showSaved(`Item marked as ${desiredStockState.value ? 'In Stock (Green)' : 'Against Order (Orange)'}`)
}

const resetStockToSystem = () => {
  if (!targetOverrideRow.value) return
  targetOverrideRow.value.manualStockOverride = null
  stockOverrideModalOpen.value = false
  showSaved('Reset to automatic system inventory detection')
}

// Inventory Map
interface InventoryItemStatus {
  articleNumber: string
  requestedQty: number
  existsInDb: boolean
  stock: number
  inStock: boolean
  status: 'IN_STOCK' | 'AGAINST_ORDER'
}
const inventoryMap = ref<Record<string, InventoryItemStatus>>({})
let checkInventoryTimer: any = null

const checkQuoteInventory = async () => {
  const itemsToCheck = quoteItems.value
    .filter(i => !i.isCustom && i.articleNumber && i.articleNumber !== 'CUSTOM')
    .map(i => ({
      articleNumber: i.articleNumber,
      quantity: Number(i.quantity) || 1
    }))

  if (itemsToCheck.length === 0) {
    inventoryMap.value = {}
    return
  }

  try {
    const data = await $fetch<{ success: boolean, results: Record<string, InventoryItemStatus> }>('/api/quotations/check-inventory', {
      method: 'POST',
      body: { items: itemsToCheck }
    })
    if (data?.results) {
      const map: Record<string, InventoryItemStatus> = {}
      for (const [key, item] of Object.entries(data.results)) {
        map[key.trim().toUpperCase()] = item
      }
      inventoryMap.value = map
    }
  } catch (err) {
    console.warn('Inventory check failed:', err)
  }
}

const getItemInventoryStatus = (item: QuoteRow): InventoryItemStatus => {
  if (item.isCustom) {
    return {
      articleNumber: item.articleNumber,
      requestedQty: Number(item.quantity) || 1,
      existsInDb: false,
      stock: 0,
      inStock: false,
      status: 'AGAINST_ORDER'
    }
  }
  const key = (item.articleNumber || '').trim().toUpperCase()
  return inventoryMap.value[key] || {
    articleNumber: item.articleNumber,
    requestedQty: Number(item.quantity) || 1,
    existsInDb: false,
    stock: 0,
    inStock: false,
    status: 'AGAINST_ORDER'
  }
}

const isItemInStock = (item: QuoteRow): boolean => {
  if (item.manualStockOverride !== undefined && item.manualStockOverride !== null) {
    return Boolean(item.manualStockOverride)
  }
  return getItemInventoryStatus(item).inStock
}

watch(
  () => quoteItems.value.map(i => `${i.articleNumber}:${i.quantity}`),
  () => {
    clearTimeout(checkInventoryTimer)
    checkInventoryTimer = setTimeout(() => {
      checkQuoteInventory()
    }, 250)
  },
  { deep: true }
)

// Search
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const highlightedIndex = ref(-1)

const filteredSearchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (q.length < 2) return []
  return products.value
    .filter(p => (
      p.articleNumber.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    ))
    .slice(0, 10)
})

const navigateResults = (dir: number) => {
  if (filteredSearchResults.value.length === 0) return
  highlightedIndex.value = (highlightedIndex.value + dir + filteredSearchResults.value.length) % filteredSearchResults.value.length
}

const selectHighlightedOrFirst = () => {
  if (filteredSearchResults.value.length === 0) return
  const target = highlightedIndex.value >= 0 ? filteredSearchResults.value[highlightedIndex.value] : filteredSearchResults.value[0]
  if (target) addItemToQuote(target)
}

const addItemToQuote = (item: SheetProduct) => {
  const existing = quoteItems.value.find(r => r.articleNumber.toLowerCase() === item.articleNumber.toLowerCase())
  if (existing) {
    existing.quantity += 1
    showSaved(`Increased ${item.articleNumber} quantity to ${existing.quantity}`)
  } else {
    quoteItems.value.push({
      id: `${item.articleNumber}-${Date.now()}`,
      articleNumber: item.articleNumber,
      description: item.description,
      brand: item.brand,
      quantity: item.moq || 1,
      mrp: item.mrp,
      uom: item.uom || 'PC',
      discount: item.defaultDiscount || 0,
      moq: item.moq || 1,
      gstRate: item.gstRate || 18,
      stock: item.stock || item.flag || ''
    })
    showSaved(`Added ${item.articleNumber} to quote`)
  }
  searchQuery.value = ''
  highlightedIndex.value = -1
}

const addCustomItem = () => {
  quoteItems.value.push({
    id: `custom-${Date.now()}`,
    articleNumber: 'CUSTOM',
    description: 'Custom Material / Labour',
    brand: 'GEN',
    quantity: 1,
    mrp: 1000,
    uom: 'PC',
    discount: 0,
    isCustom: true
  })
}

const removeQuoteItem = (idx: number) => {
  quoteItems.value.splice(idx, 1)
}

const clearAllItems = () => {
  if (confirm('Clear all items from this quotation?')) {
    quoteItems.value = []
  }
}

// Calculations
const calculateUnitRate = (item: QuoteRow) => {
  const mrp = Number(item.mrp) || 0
  const disc = Number(item.discount) || 0
  const rate = mrp * (1 - disc / 100)
  return isNaN(rate) ? 0 : rate
}

const calculateLineTotal = (item: QuoteRow) => {
  const rate = calculateUnitRate(item)
  const qty = Number(item.quantity) || 1
  const lineTotal = rate * (isNaN(qty) ? 1 : qty)
  return isNaN(lineTotal) ? 0 : lineTotal
}

const totalMrp = computed(() => {
  return quoteItems.value.reduce((acc, it) => {
    const mrp = Number(it.mrp) || 0
    const qty = Number(it.quantity) || 1
    return acc + (mrp * qty)
  }, 0)
})

const subtotal = computed(() => {
  return quoteItems.value.reduce((acc, it) => acc + calculateLineTotal(it), 0)
})

const totalDiscountSaved = computed(() => {
  const diff = totalMrp.value - subtotal.value
  return (!diff || isNaN(diff) || diff <= 0) ? 0 : Math.round(diff)
})

const overallDiscountPercent = computed(() => {
  if (!totalMrp.value || isNaN(totalMrp.value) || totalMrp.value <= 0) return '0.0'
  const val = (totalDiscountSaved.value / totalMrp.value) * 100
  return isNaN(val) ? '0.0' : val.toFixed(1)
})

const gstAmount = computed(() => {
  if (taxMode.value !== 'EXTRA') return 0
  return subtotal.value * 0.18
})

const grandTotal = computed(() => {
  if (taxMode.value === 'EXTRA') {
    return subtotal.value + gstAmount.value
  }
  return subtotal.value
})

const displayQuoteNotes = computed(() => {
  if (!quoteNotes.value) return ''
  return quoteNotes.value
    .replace(/(?:^|\n|•\s*)\s*ex[- ]?godown\s+mys(?:ore|uru)[^\n.]*\.?/gi, '')
    .trim()
})

const formatDisplayDate = (d: Date) => {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// ── Drawing Canvas Signature State & Methods ────────────────────────────
const signatureCanvasRef = ref<HTMLCanvasElement | null>(null)
const signatureDataUrl = ref<string | null>(null)
const isSignatureModalOpen = ref(false)
const isSignatureModalTriggeredBySave = ref(false)
const hasDrawnSignature = ref(false)
let isDrawing = false
let sigCtx: CanvasRenderingContext2D | null = null

const initSignatureCanvas = () => {
  nextTick(() => {
    const canvas = signatureCanvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    sigCtx = canvas.getContext('2d')
    if (sigCtx) {
      sigCtx.scale(dpr, dpr)
      sigCtx.lineCap = 'round'
      sigCtx.lineJoin = 'round'
      sigCtx.lineWidth = 2.5
      sigCtx.strokeStyle = '#1b3b5f' // Deep navy blue ink
    }

    if (signatureDataUrl.value) {
      const img = new Image()
      img.onload = () => {
        if (!sigCtx || !canvas) return
        sigCtx.drawImage(img, 0, 0, rect.width, rect.height)
        hasDrawnSignature.value = true
      }
      img.src = signatureDataUrl.value
    } else {
      clearSignature()
    }
  })
}

const getCanvasCoordinates = (e: MouseEvent | TouchEvent) => {
  const canvas = signatureCanvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  if ('touches' in e && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    }
  } else if ('clientX' in e) {
    return {
      x: (e as MouseEvent).clientX - rect.left,
      y: (e as MouseEvent).clientY - rect.top
    }
  }
  return { x: 0, y: 0 }
}

const startDrawing = (e: MouseEvent | TouchEvent) => {
  isDrawing = true
  const { x, y } = getCanvasCoordinates(e)

  if (sigCtx) {
    const dotRadius = Math.max((sigCtx.lineWidth || 2.5) * 0.65, 1.6)

    // Immediately draw a crisp rounded ink dot at point of touch/click
    sigCtx.beginPath()
    sigCtx.arc(x, y, dotRadius, 0, Math.PI * 2)
    sigCtx.fillStyle = sigCtx.strokeStyle || '#1b3b5f'
    sigCtx.fill()

    // Ready path for continuous stroke if user drags
    sigCtx.beginPath()
    sigCtx.moveTo(x, y)
    hasDrawnSignature.value = true
  }
}

const draw = (e: MouseEvent | TouchEvent) => {
  if (!isDrawing || !sigCtx) return
  const { x, y } = getCanvasCoordinates(e)
  sigCtx.lineTo(x, y)
  sigCtx.stroke()
  hasDrawnSignature.value = true
}

const stopDrawing = () => {
  if (isDrawing && sigCtx) {
    sigCtx.closePath()
  }
  isDrawing = false
}

const clearSignature = () => {
  const canvas = signatureCanvasRef.value
  if (!canvas || !sigCtx) return
  const rect = canvas.getBoundingClientRect()
  sigCtx.clearRect(0, 0, rect.width, rect.height)
  hasDrawnSignature.value = false
}

const openSignatureModal = (fromSave: boolean | MouseEvent = false) => {
  isSignatureModalTriggeredBySave.value = typeof fromSave === 'boolean' ? fromSave : false
  isSignatureModalOpen.value = true
  initSignatureCanvas()
}

const confirmSignatureAndProceed = async (generateNow: boolean = true) => {
  const canvas = signatureCanvasRef.value
  if (canvas && hasDrawnSignature.value) {
    signatureDataUrl.value = canvas.toDataURL('image/png')
  }
  isSignatureModalOpen.value = false

  if (isSuccessView.value) {
    if (props.initialQuote?.id) {
      try {
        await $fetch(`/api/quotations/${props.initialQuote.id}`, {
          method: 'PATCH',
          body: { signature: signatureDataUrl.value }
        })
        showSaved('Signature saved to quotation!')
      } catch (err) {
        showSaved('Signature applied to preview!')
      }
    } else {
      showSaved('Signature applied!')
    }
  } else {
    if (generateNow || isSignatureModalTriggeredBySave.value) {
      await executeSaveQuote()
    } else {
      showSaved('Signature attached to quotation draft')
    }
  }
}

const skipSignatureAndProceed = async () => {
  isSignatureModalOpen.value = false

  if (isSuccessView.value) {
    signatureDataUrl.value = null
    if (props.initialQuote?.id) {
      try {
        await $fetch(`/api/quotations/${props.initialQuote.id}`, {
          method: 'PATCH',
          body: { signature: null }
        })
        showSaved('Signature removed')
      } catch (err) {}
    }
  } else {
    if (isSignatureModalTriggeredBySave.value) {
      await executeSaveQuote()
    } else {
      signatureDataUrl.value = null
      showSaved('Signature cleared')
    }
  }
}

watch(isSignatureModalOpen, (isOpen) => {
  if (isOpen) {
    initSignatureCanvas()
  }
})

// Save & Generate Quotation
const saveAndGenerateQuote = async () => {
  if (!customerName.value.trim()) {
    showEditing('Please enter customer / company name')
    return
  }
  if (quoteItems.value.length === 0) {
    showEditing('Add at least one item to quotation')
    return
  }

  // If creator hasn't signed yet, open the signature drawing canvas first
  if (!signatureDataUrl.value) {
    openSignatureModal(true)
    return
  }

  await executeSaveQuote()
}

const executeSaveQuote = async () => {
  isSaving.value = true
  try {
    const payload = {
      quoteNumber: quoteNumber.value,
      customerName: customerName.value.trim(),
      customerPlace: customerPlace.value.trim() || null,
      customerPhone: customerPhone.value.trim() || null,
      validityDays: Number(validityDays.value) || 7,
      taxMode: taxMode.value,
      quoteNotes: quoteNotes.value.trim() || null,
      items: quoteItems.value,
      totalItems: quoteItems.value.length,
      totalMrp: totalMrp.value,
      subtotal: subtotal.value,
      discountAmount: totalDiscountSaved.value,
      gstAmount: gstAmount.value,
      grandTotal: grandTotal.value,
      createdByName: user.value?.name || 'Sales Staff',
      signature: signatureDataUrl.value || null
    }

    const res = await $fetch<any>('/api/quotations', {
      method: 'POST',
      body: payload
    })

    if (res?.success) {
      showSaved(`Quotation ${quoteNumber.value} saved successfully!`)
      emit('created', res.quotation)
      isSuccessView.value = true
    } else {
      throw new Error(res?.error || 'Could not save quotation')
    }
  } catch (err: any) {
    console.error('Failed saving quotation:', err)
    showEditing(err.message || 'Error saving quotation')
  } finally {
    isSaving.value = false
  }
}

// Reset for creating another quote
const resetForNewQuote = () => {
  isSuccessView.value = false
  isEditingExisting.value = false
  quoteNumber.value = generateQuoteNumber()
  customerName.value = ''
  customerPlace.value = ''
  customerPhone.value = ''
  validityDays.value = 7
  quoteNotes.value = ''
  taxMode.value = 'EXTRA'
  quoteItems.value = []
  signatureDataUrl.value = null
  hasDrawnSignature.value = false
}

// Watch initialQuote prop to open existing quotes in success/view mode
watch(
  () => props.initialQuote,
  (newQuote) => {
    if (newQuote) {
      isSuccessView.value = true
      isEditingExisting.value = true
      quoteNumber.value = newQuote.quoteNumber
      customerName.value = newQuote.customerName || ''
      customerPlace.value = newQuote.customerPlace || ''
      customerPhone.value = newQuote.customerPhone || ''
      signatureDataUrl.value = newQuote.signature || null
      hasDrawnSignature.value = Boolean(newQuote.signature)
      validityDays.value = newQuote.validityDays || 7
      const rawNotes = newQuote.quoteNotes || ''
      quoteNotes.value = rawNotes.replace(/(?:^|\n|•\s*)\s*ex[- ]?godown\s+mys(?:ore|uru)[^\n.]*\.?/gi, '').trim()
      taxMode.value = (newQuote.taxMode as any) || 'EXTRA'
      const rawItems = Array.isArray(newQuote.items) ? newQuote.items : []
      quoteItems.value = rawItems.map((it: any, idx: number) => ({
        id: it.id || `${it.articleNumber || 'ITEM'}-${idx}`,
        articleNumber: it.articleNumber || '—',
        description: it.description || '',
        brand: it.brand || '—',
        quantity: Number(it.quantity) || 1,
        mrp: Number(it.mrp) || 0,
        uom: it.uom || 'PC',
        discount: Number(it.discount) || 0,
        moq: Number(it.moq) || 1,
        gstRate: Number(it.gstRate) || 18,
        stock: it.stock || '',
        inStock: it.inStock,
        manualStockOverride: it.manualStockOverride !== undefined ? it.manualStockOverride : (it.inStock !== undefined ? it.inStock : null)
      }))
      setupViewportObserver()
    } else {
      resetForNewQuote()
    }
  },
  { immediate: true }
)

// Watch modelValue prop when modal is opened
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      setupViewportObserver()
    }
  }
)

const closeModal = () => {
  emit('update:modelValue', false)
}

// Exporting Functions (WhatsApp, PNG, PDF, Print)
const exportQuote = async (action: 'whatsapp' | 'download' | 'pdf' | 'print') => {
  if (!quotationCardRef.value || quoteItems.value.length === 0) return

  isExporting.value = true
  exportAction.value = action

  try {
    const el = quotationCardRef.value

    // Guarantee high-resolution logo and fonts are fully settled before capture
    if (!logoDataUri.value) {
      await preloadLogo()
    }
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready
    }

    // Ultra HD 300 DPI export settings (2382px x 3369px for pixel-perfect clarity)
    const exportOptions = {
      pixelRatio: 3,
      quality: 1,
      backgroundColor: '#ffffff',
      cacheBust: true
    }

    if (action === 'whatsapp') {
      const fileName = `${quoteNumber.value}-${(customerName.value || 'customer').replace(/\s+/g, '_')}.png`
      const clientName = customerName.value?.trim() || ''
      const greeting = clientName ? `Hello *${clientName}*,` : 'Hello,'
      const totalPayableFormatted = `₹${Math.round(grandTotal.value).toLocaleString('en-IN')}`
      const itemCount = quoteItems.value.length

      const politeMessageText = 
        `${greeting}\n\n` +
        `Please find the price estimate quotation (*${quoteNumber.value}*) attached with this message.\n\n` +
        `📄 *Quotation Summary:*\n` +
        `• Estimate No: *${quoteNumber.value}*\n` +
        `• Total Items: *${itemCount}*\n` +
        `• Payable Amount: *${totalPayableFormatted}*\n` +
        `• Validity: *${validityDays.value || 7} Days*\n\n` +
        `Please feel free to reach out to us if you need any clarification or assistance. We look forward to fulfilling your requirements!\n\n` +
        `Warm regards,\n` +
        `*Silicon Marketing*`

      const cleanPhone = (customerPhone.value || '').replace(/[^0-9]/g, '')

      // 1. Android Capacitor Native Share Bridge (Sends real high-res PNG image + pre-filled caption)
      const isAndroidApp = 
        typeof window !== 'undefined' && (
          (window as any).isSiliconOMSApp === true ||
          !!(window as any).AndroidBridge ||
          !!(window as any).Capacitor?.Plugins?.OMSBridge ||
          navigator.userAgent.includes('SiliconOMSApp')
        )

      if (isAndroidApp) {
        showSaved('Rendering quotation slip...')
        const dataUrl = await toPng(el, exportOptions)

        // 1A. Capacitor OMSBridge Plugin
        if ((window as any).Capacitor?.Plugins?.OMSBridge?.shareImage) {
          await (window as any).Capacitor.Plugins.OMSBridge.shareImage({
            base64Data: dataUrl,
            fileName,
            message: politeMessageText,
            targetApp: 'whatsapp',
            phoneNumber: cleanPhone
          })
          showSaved('Opening WhatsApp with quotation slip image...')
          return
        }

        // 1B. Android Javascript Bridge
        if ((window as any).AndroidBridge?.shareImage) {
          ;(window as any).AndroidBridge.shareImage(dataUrl, fileName, politeMessageText, 'whatsapp', cleanPhone)
          showSaved('Opening WhatsApp with quotation slip image...')
          return
        }
      }

      // 2. Standard Web Browser (Chrome/Safari Web Share Level 2 with files)
      const blob = await toBlob(el, exportOptions)
      if (!blob) throw new Error('Could not generate quotation image')

      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Quotation ${quoteNumber.value} - Silicon Marketing`,
          text: politeMessageText
        })
        showSaved('Quotation shared successfully!')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)

        const cleanPhone = (customerPhone.value || '').replace(/[^0-9]/g, '')
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
        const textMsg = encodeURIComponent(politeMessageText)
        const waUrl = formattedPhone 
          ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${textMsg}`
          : `https://api.whatsapp.com/send?text=${textMsg}`
        
        window.open(waUrl, '_blank')
        showSaved('Quotation slip downloaded! Opening WhatsApp...')
      }
    } else if (action === 'download') {
      const dataUrl = await toPng(el, exportOptions)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${quoteNumber.value}-${(customerName.value || 'customer').replace(/\s+/g, '_')}.png`
      a.click()
      showSaved('Ultra HD 300 DPI quotation image saved to your downloads!')
    } else if (action === 'pdf' || action === 'print') {
      // ── Dedicated Multi-Page PDF & Print Generation ─────────────────────────
      // 1. Measure real row heights from the mounted off-screen quotationCardRef
      const tbody = el.querySelector<HTMLElement>('table tbody')
      const trElements = tbody ? Array.from(tbody.querySelectorAll<HTMLElement>('tr')) : []
      const rowHeights = trElements.map((tr) => tr.offsetHeight || 38)

      // 2. Compute exact page division so no page ever overflows or cuts a row
      const pages = paginateQuoteItems(quoteItems.value, rowHeights)
      pdfPages.value = pages

      // 3. Wait for Vue to render all .pdf-page-container elements into the DOM
      await nextTick()
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready
      }
      // Small pause to guarantee font rendering and layout settle
      await new Promise((r) => setTimeout(r, 80))

      // 4. Query the generated A4 page containers
      const pageContainers = pdfPagesContainerRef.value?.querySelectorAll<HTMLElement>('.pdf-page-container')
      if (!pageContainers || pageContainers.length === 0) {
        throw new Error('Failed to generate PDF/print page elements')
      }

      // 5. Capture each pristine A4 card (JPEG for compact ~400KB PDF, PNG for print)
      const pageDataUrls: string[] = []
      for (let i = 0; i < pageContainers.length; i++) {
        const pageEl = pageContainers[i]
        if (action === 'pdf') {
          // Optimized JPEG compression yields crystal-sharp text at only ~250KB per page
          const pageDataUrl = await toJpeg(pageEl, {
            pixelRatio: 2,
            quality: 0.93,
            backgroundColor: '#ffffff',
            cacheBust: true
          })
          pageDataUrls.push(pageDataUrl)
        } else {
          const pageDataUrl = await toPng(pageEl, exportOptions)
          pageDataUrls.push(pageDataUrl)
        }
      }

      if (action === 'pdf') {
        // Initialize A4 PDF with native stream compression enabled
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'a4',
          compress: true
        })
        const pdfW = pdf.internal.pageSize.getWidth()
        const pdfH = pdf.internal.pageSize.getHeight()

        for (let i = 0; i < pageDataUrls.length; i++) {
          if (i > 0) pdf.addPage()
          // Embedding as native JPEG drops PDF file size from 50MB down to ~400KB
          pdf.addImage(pageDataUrls[i], 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST')
        }

        pdf.save(`${quoteNumber.value}.pdf`)
        pdfPages.value = []
        showSaved('Quotation PDF generated & downloaded!')
      } else if (action === 'print') {
        // Direct browser printing via hidden iframe
        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        iframe.style.opacity = '0'
        iframe.style.pointerEvents = 'none'
        iframe.setAttribute('aria-hidden', 'true')
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentWindow?.document
        if (!iframeDoc) {
          throw new Error('Could not initialize print window')
        }

        const printHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Quotation_${quoteNumber.value}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  background: #ffffff;
                  width: 100%;
                }
                .print-sheet {
                  width: 100%;
                  height: 100vh;
                  page-break-after: always;
                  break-after: page;
                  page-break-inside: avoid;
                  break-inside: avoid;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #ffffff;
                  margin: 0;
                  padding: 0;
                }
                .print-sheet:last-child {
                  page-break-after: auto;
                  break-after: auto;
                }
                .print-sheet img {
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                  display: block;
                }
              </style>
            </head>
            <body>
              ${pageDataUrls
                .map(
                  (url, idx) => `
                <div class="print-sheet">
                  <img src="${url}" alt="Quotation Page ${idx + 1}" />
                </div>`
                )
                .join('')}
            </body>
          </html>
        `

        iframeDoc.open()
        iframeDoc.write(printHtml)
        iframeDoc.close()

        // Wait for all images in the print iframe to be decoded and loaded
        const imgs = Array.from(iframeDoc.querySelectorAll('img'))
        await Promise.all(
          imgs.map((img) => {
            if (img.complete) return Promise.resolve()
            return new Promise((resolve) => {
              img.onload = resolve
              img.onerror = resolve
            })
          })
        )

        // Brief pause to allow browser layout engine to settle
        await new Promise((r) => setTimeout(r, 200))

        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()

        pdfPages.value = []
        showSaved('Print dialog opened!')

        // Clean up iframe after printing is done or dismissed
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 60000)
      }
    }
  } catch (err: any) {
    console.error('Export error:', err)
    showEditing(`Export failed: ${err.message}`)
  } finally {
    isExporting.value = false
    exportAction.value = null
    pdfPages.value = []
  }
}

watch(
  () => isSuccessView.value,
  (val) => {
    if (val) {
      setupViewportObserver()
    }
  }
)

onMounted(() => {
  preloadLogo()
  loadSheetCatalog()
  setupViewportObserver()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>
