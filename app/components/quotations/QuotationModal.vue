<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 sm:inset-0 z-[300] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 lg:p-6 animate-in fade-in duration-200"
    >
      <!-- Modal Box: Responsive Full-screen on mobile, rounded card on sm+ (Matching GenerateBillModal.vue:6) -->
      <div
        class="bg-white w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden text-gray-900"
      >
        <!-- Modal Top Header (Matching GenerateBillModal.vue:9-20) -->
        <div class="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-8 h-8 rounded-lg bg-[#1b3b5f]/10 text-[#1b3b5f] items-center justify-center shrink-0"
              :class="isSuccessView ? 'hidden sm:flex' : 'flex'"
            >
              <Calculator class="w-4 h-4 text-[#1b3b5f]" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2
                  class="text-base sm:text-lg font-bold text-gray-900 truncate"
                  :class="isSuccessView ? 'hidden sm:block' : 'block'"
                >
                  {{ isSuccessView ? 'Quotation Ready to Share' : (isEditingExisting ? 'View Quotation' : 'New Quotation') }}
                </h2>
                <span class="text-xs sm:text-[10px] font-bold px-2.5 py-1 sm:py-0.5 rounded-md sm:rounded bg-gray-200/80 text-gray-700 shrink-0">
                  {{ quoteNumber }}
                </span>
              </div>
              <p
                class="text-xs text-gray-500 truncate mt-0.5"
                :class="isSuccessView ? 'hidden sm:block' : 'hidden sm:block'"
              >
                {{ isSuccessView ? 'Share official quotation via WhatsApp, image or PDF.' : 'Search Google Sheet catalog, review DB inventory, and save quote.' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Edit Quotation Button in Header (shown in Preview / Success mode) -->
            <button
              v-if="isSuccessView"
              type="button"
              @click="enterEditMode"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] active:scale-98 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Edit Quotation items, customer details, or discounts"
            >
              <Edit3 class="w-3.5 h-3.5" />
              <span>Edit Quotation</span>
            </button>

            <!-- Back to Preview Button (shown when editing an existing quote) -->
            <button
              v-if="!isSuccessView && (isEditingExisting || props.initialQuote)"
              type="button"
              @click="isSuccessView = true"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-700 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              title="Return to Quotation Preview"
            >
              <span>Back to Preview</span>
            </button>

            <!-- Sheet sync indicator in drafting mode -->
            <div
              v-if="!isSuccessView"
              class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors"
              :class="sheetSyncStatus?.isFallback
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200/80 text-emerald-800'"
              :title="sheetSyncStatus?.isFallback
                ? 'Using offline catalog cache. Add GOOGLE_SERVICE_ACCOUNT_KEY in Vercel to sync live from Google Sheet.'
                : 'Synced live with Google Sheet hardware catalog'"
            >
              <span
                class="w-2 h-2 rounded-full"
                :class="isSyncingSheet
                  ? 'bg-amber-400 animate-spin'
                  : (sheetSyncStatus?.isFallback ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse')"
              ></span>
              <span>{{ products.length }} Items{{ sheetSyncStatus?.isFallback ? ' (Cached)' : '' }}</span>
              <button
                type="button"
                tabindex="-1"
                @click.stop="loadSheetCatalog(true)"
                :disabled="isSyncingSheet"
                title="Re-sync from Google Sheet now"
                class="p-0.5 rounded hover:bg-black/5 text-current transition cursor-pointer disabled:opacity-40 ml-0.5"
              >
                <RefreshCw class="w-3 h-3" :class="isSyncingSheet ? 'animate-spin' : ''" />
              </button>
            </div>

            <!-- Close button matching GenerateBillModal.vue:17 -->
            <button
              type="button"
              @click="closeModal"
              class="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-pointer"
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
          <div
            class="border rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3.5 flex-wrap"
            :class="props.initialQuote?.status === 'CONVERTED'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-emerald-50/70 border-emerald-200/80'"
          >
            <div class="flex items-center gap-3.5 min-w-0">
              <div
                class="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm"
                :class="props.initialQuote?.status === 'CONVERTED' ? 'bg-emerald-600' : 'bg-[#1b3b5f]'"
              >
                <CheckCircle2 v-if="props.initialQuote?.status === 'CONVERTED'" class="w-6 h-6" />
                <FileText v-else class="w-6 h-6" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm sm:text-base font-bold text-gray-900">
                    {{ props.initialQuote?.status === 'CONVERTED' ? 'Quotation Converted to Sales Order' : (isEditingExisting ? 'Quotation Details & Slip' : 'Quotation Generated & Saved!') }}
                  </h3>
                  <span
                    v-if="props.initialQuote?.status === 'CONVERTED'"
                    class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
                  >
                    Order # {{ props.initialQuote.convertedOrderNumber }}
                  </span>
                  <span
                    v-else
                    class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                  >
                    Pending Conversion
                  </span>
                </div>
                <p class="text-xs text-gray-600 mt-0.5">
                  Quote <strong>{{ quoteNumber }}</strong> for <strong>{{ customerName || 'Valued Customer' }}</strong>.
                  <span v-if="props.initialQuote?.status === 'CONVERTED'"> Converted into official Sales Order.</span>
                  <span v-else> Ready to share or convert into a confirmed Sales Order.</span>
                </p>
              </div>
            </div>

            <!-- Convert Button right on banner if eligible -->
            <button
              v-if="canConvertCurrentQuote"
              type="button"
              @click="triggerConversion"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <ShoppingBag class="w-4 h-4" />
              <span>Convert to Sales Order</span>
            </button>
          </div>

          <!-- Sharing Action Bar -->
          <div class="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-2xs space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Share2 class="w-3.5 h-3.5 text-[#1b3b5f]" />
              <span>Share & Export Options</span>
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <!-- WhatsApp Share -->
              <button
                type="button"
                @click="exportQuote('whatsapp')"
                :disabled="isExporting"
                title="Share crisp high-resolution quotation PDF via WhatsApp"
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

              <!-- Print Quotation (Desktop only) -->
              <button
                type="button"
                @click="exportQuote('print')"
                :disabled="isExporting"
                class="hidden sm:flex py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
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
                  {{ Math.round((currentScale || 1) * 100) }}%
                </span>
                <span v-if="currentScale < 1" class="text-[11px] text-gray-400 hidden sm:inline">
                  &bull; Complete slip visible
                </span>

                <!-- Signature Action Pill (Hidden in Anonymous Mode, visible in Branded mode) -->
                <button
                  v-if="!isAnonymousMode"
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

                <div class="hidden sm:block h-4 w-px bg-gray-200 mx-0.5"></div>

                <!-- Quick Print Button (Desktop only) -->
                <button
                  type="button"
                  @click="exportQuote('print')"
                  :disabled="isExporting"
                  class="hidden sm:flex p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition cursor-pointer disabled:opacity-30 border border-gray-300 items-center justify-center shadow-2xs"
                  title="Print Quotation"
                >
                  <Loader2 v-if="isExporting && exportAction === 'print'" class="w-4 h-4 animate-spin text-[#1b3b5f]" />
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
                      <!-- Quotation Card Header -->
                      <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1b3b5f] rounded-full"></div>
                      <div class="flex items-center justify-between border-b border-gray-200 pb-5">
                        <div v-if="!isAnonymousMode">
                          <img
                            :src="logoDataUri || '/images/logo-original.png'"
                            alt="Silicon Marketing"
                            class="h-24 w-auto object-contain drop-shadow-xs"
                          />
                        </div>
                        <div v-else class="space-y-1">
                          <span class="inline-block px-3.5 py-1.5 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-wider shadow-2xs">
                            PRICE QUOTATION
                          </span>
                        </div>
                        <div class="text-right">
                          <span v-if="!isAnonymousMode" class="inline-block px-3.5 py-1 rounded-lg bg-[#1b3b5f] text-white text-[11px] font-black uppercase tracking-wider mb-1 shadow-2xs">
                            PRICE QUOTATION
                          </span>
                          <div class="text-base font-black text-[#1b3b5f] tabular-nums">{{ quoteNumber }}</div>
                          <div class="text-xs text-gray-500 mt-0.5">
                            <span class="text-gray-400 font-medium">Date:</span>
                            <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
                          </div>
                          <div class="inline-block text-[11px] text-[#1b3b5f] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold mt-1">
                            Valid for {{ validityDays || 7 }} days
                          </div>
                        </div>
                      </div>

                      <!-- Customer Details Box -->
                      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs gap-4">
                        <div class="min-w-0 flex-1">
                          <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Customer Details:</span>
                          <div class="text-sm sm:text-base font-black text-[#1b3b5f] truncate">
                            {{ customerName || 'Valued Customer' }}
                          </div>
                          <div class="flex items-center gap-2.5 text-xs text-gray-600 mt-1 flex-wrap">
                            <span v-if="customerPhone" class="inline-flex items-center gap-1.5 tabular-nums">
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

                        <!-- Issued By (Branded Mode Only) -->
                        <div v-if="!isAnonymousMode" class="text-right border-l border-slate-200 pl-4 sm:pl-6 shrink-0">
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
                              <th class="py-2 px-1 text-center w-5">#</th>
                              <th class="py-2 px-1.5 w-20">Article No.</th>
                              <th class="py-2 px-2">Product Description</th>
                              <th class="py-2 px-1 text-center w-10">Brand</th>
                              <th class="py-2 px-1 text-center w-9">Qty</th>
                              <th class="py-2 px-1.5 text-right w-16">MRP (₹)</th>
                              <th v-if="showDiscountColumn" class="py-2 px-1 text-center w-11">Disc %</th>
                              <th class="py-2 px-1 text-center w-8">UoM</th>
                              <th class="py-2 px-1.5 text-right w-20">Rate (₹)</th>
                              <th class="py-2 px-1.5 text-right w-20">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100">
                            <tr v-for="(it, i) in quoteItems" :key="it.id" class="border-b border-gray-100 text-[11px]">
                              <td class="py-2 px-1 text-center text-gray-500 font-bold tabular-nums">{{ i + 1 }}</td>
                              <td class="py-2 px-1.5 font-black text-[#1b3b5f] text-[11px] whitespace-nowrap tabular-nums">{{ it.articleNumber }}</td>
                              <td class="py-2 px-2 font-bold text-gray-950 leading-snug">{{ it.description }}</td>
                              <td class="py-2 px-1 text-center font-black text-[10px] text-gray-800 uppercase">{{ it.brand }}</td>
                              <td
                                class="py-2 px-1 text-center font-black tabular-nums"
                                :class="isItemInStock(it) ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fff3e0] text-[#d9480f]'"
                              >
                                {{ it.quantity }}
                              </td>
                              <td class="py-2 px-1.5 text-right font-bold text-gray-700 whitespace-nowrap tabular-nums">₹{{ formatSlipNumber(it.mrp) }}</td>
                              <td v-if="showDiscountColumn" class="py-2 px-1 text-center font-bold text-emerald-700 tabular-nums">{{ it.discount ? it.discount + '%' : '-' }}</td>
                              <td class="py-2 px-1 text-center font-bold text-gray-700 text-[10px]">{{ it.uom }}</td>
                              <td class="py-2 px-1.5 text-right font-black text-[#1b3b5f] whitespace-nowrap tabular-nums">₹{{ calculateUnitRate(it).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                              <td class="py-2 px-1.5 text-right font-black text-gray-950 whitespace-nowrap tabular-nums">₹{{ formatSlipNumber(calculateLineTotal(it)) }}</td>
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

                        <div class="w-5/12 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                          <table class="w-full border-collapse text-xs">
                            <tbody>
                              <!-- Total MRP -->
                              <tr class="text-gray-600">
                                <td class="py-1 text-left font-bold pr-2">Total MRP:</td>
                                <td class="py-1 w-3 text-center"></td>
                                <td class="py-1 w-4 text-right font-bold text-gray-700">₹</td>
                                <td class="py-1 text-right font-bold text-gray-800 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalMrp) }}</td>
                              </tr>

                              <!-- Total Discount -->
                              <tr v-if="totalDiscountSaved > 0" class="text-emerald-700 font-bold">
                                <td class="py-1 text-left pr-2">Total Discount:</td>
                                <td class="py-1 w-3 text-center font-bold text-emerald-600">-</td>
                                <td class="py-1 w-4 text-right font-bold text-emerald-600">₹</td>
                                <td class="py-1 text-right font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalDiscountSaved) }}</td>
                              </tr>

                              <!-- Subtotal -->
                              <tr class="border-t border-slate-200 text-gray-900 font-black">
                                <td class="py-1 text-left pr-2">Subtotal:</td>
                                <td class="py-1 w-3 text-center"></td>
                                <td class="py-1 w-4 text-right font-black text-gray-950">₹</td>
                                <td class="py-1 text-right font-black text-gray-950 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(subtotal) }}</td>
                              </tr>

                              <!-- GST -->
                              <tr v-if="taxMode === 'EXTRA'" class="text-gray-700 font-bold">
                                <td class="py-1 text-left pr-2">GST:</td>
                                <td class="py-1 w-3 text-center font-bold text-sky-600">+</td>
                                <td class="py-1 w-4 text-right font-bold text-sky-600">₹</td>
                                <td class="py-1 text-right font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(gstAmount) }}</td>
                              </tr>

                              <!-- Round Off -->
                              <tr v-if="roundOffAmount !== 0" class="text-gray-600 font-medium text-[11px]">
                                <td class="py-1 text-left pr-2">Round Off:</td>
                                <td class="py-1 w-3 text-center">{{ roundOffAmount > 0 ? '+' : '-' }}</td>
                                <td class="py-1 w-4 text-right font-medium">₹</td>
                                <td class="py-1 text-right font-medium tabular-nums whitespace-nowrap pl-1">{{ Math.abs(roundOffAmount).toFixed(2) }}</td>
                              </tr>

                              <!-- Grand Total -->
                              <tr class="border-t-2 border-b-2 border-slate-300 text-[#1b3b5f] font-black">
                                <td class="py-1.5 text-left uppercase text-xs tracking-wider pr-2">Grand Total:</td>
                                <td class="py-1.5 w-3 text-center"></td>
                                <td class="py-1.5 w-4 text-right font-black text-[#1b3b5f]">₹</td>
                                <td class="py-1.5 text-right font-black tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(grandTotal) }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <!-- Nondisclosure Obligations Notice -->
                      <div class="pt-3 border-t border-gray-200 text-[9px] text-black leading-relaxed">
                        <strong class="font-bold text-black uppercase tracking-wider">Nondisclosure obligations:</strong>
                        In general, recipients of confidential information are subject to an affirmative duty to keep the information confidential, and not to disclose it to third parties except as expressly permitted by the agreement.
                      </div>
                    </div>

                    <!-- Footer Signoff pinned to bottom of A4 card -->
                    <div class="px-6 sm:px-8 pb-6 pt-4 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
                      <div>
                        <strong class="font-bold block text-gray-700">
                          {{ isAnonymousMode ? 'Price Quotation' : 'Silicon Marketing • Price Quotation' }}
                        </strong>
                        <span class="text-[9px] text-gray-400">
                          {{ isAnonymousMode ? `Valid for ${validityDays || 7} days` : 'Order Workspace Verified' }}
                        </span>
                      </div>
                      <div class="flex flex-col items-center text-center">
                        <div class="h-10 flex items-end justify-center mb-1">
                          <img
                            v-if="!isAnonymousMode && signatureDataUrl"
                            :src="signatureDataUrl"
                            alt="Authorized Signature"
                            class="max-h-10 max-w-[130px] object-contain"
                          />
                        </div>
                        <div class="border-t border-gray-400 w-32 pt-1">
                          <strong class="font-bold text-gray-800 block">Authorized Signatory</strong>
                          <span v-if="!isAnonymousMode" class="text-[9px] text-gray-400 block">{{ displayCreatorName }}</span>
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
          <!-- Step 1: Customer & Quotation Meta Details (Matching GenerateBillModal.vue:29-71) -->
          <div class="bg-gray-50/80 rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3.5">
            <div class="flex items-center justify-between border-b border-gray-200/70 pb-2.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <User class="w-4 h-4 text-[#1b3b5f]" />
                <span>1. Customer & Quotation Details</span>
              </h3>
              <span class="text-[11px] text-gray-500 font-bold">Quote ID: {{ quoteNumber }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-3.5">
              <!-- Customer / Company Name (DB Picker or Manual Entry) -->
              <div class="sm:col-span-5">
                <div class="flex items-center justify-between mb-1 gap-1">
                  <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                    Customer / Company *
                  </label>
                  <button
                    type="button"
                    @click="toggleCustomerInputMode()"
                    class="text-[10px] font-bold text-[#1b3b5f] hover:text-[#132c49] flex items-center gap-1 hover:underline cursor-pointer shrink-0"
                  >
                    <component :is="isManualCustomer ? Database : Edit3" class="w-3 h-3 text-[#1b3b5f]" />
                    <span>{{ isManualCustomer ? 'Choose from Database' : '+ Enter Manually' }}</span>
                  </button>
                </div>

                <!-- Mode A: Database Customer Picker -->
                <div v-if="!isManualCustomer" class="space-y-1.5">
                  <CustomSelect
                    :modelValue="selectedCustomerId"
                    @update:modelValue="onCustomerSelect"
                    :options="customerOptions"
                    searchable
                    searchPlaceholder="Search customers by name, company, city..."
                    placeholder="Select Customer from Database"
                    class="w-full text-xs"
                    triggerClass="px-3 py-2 text-xs font-medium"
                  />
                  <div v-if="selectedCustomerObj" class="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                    <span v-if="selectedCustomerObj.companyName" class="text-gray-600 truncate font-medium">
                      {{ selectedCustomerObj.companyName }}
                    </span>
                    <button 
                      type="button" 
                      tabindex="-1"
                      @click="clearCustomerSelection()" 
                      class="text-red-500 hover:text-red-700 hover:underline ml-auto font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <!-- Mode B: Manual Customer Input -->
                <div v-else class="space-y-1">
                  <input
                    v-model="customerName"
                    type="text"
                    placeholder="e.g. Rajesh Patel / Royal Interiors"
                    class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition"
                  />
                  <p class="text-[10px] text-amber-700 font-medium">
                    Manual entry: saved for this quote only, not added to customer database.
                  </p>
                </div>
              </div>

              <!-- Place / City -->
              <div class="sm:col-span-4">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Place / City</label>
                <input
                  v-model="customerPlace"
                  type="text"
                  placeholder="e.g. Mysuru / Bangalore"
                  class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition"
                />
              </div>

              <!-- WhatsApp / Phone -->
              <div class="sm:col-span-3">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Phone Number</label>
                <div class="relative">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold">+91</span>
                  <input
                    v-model="customerPhone"
                    type="tel"
                    placeholder="9876543210"
                    class="w-full pl-9 pr-2 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition"
                  />
                </div>
              </div>

              <!-- Row 2: Quotation By (Sales Rep) -->
              <div class="sm:col-span-5">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                  Quotation By (Sales Rep)
                </label>
                <CustomSelect
                  :modelValue="selectedCreatorId"
                  @update:modelValue="onCreatorSelect"
                  :options="userOptions"
                  searchable
                  searchPlaceholder="Search employee..."
                  placeholder="Select Sales Rep / Employee"
                  class="w-full text-xs"
                  triggerClass="px-3 py-2 text-xs font-medium"
                />
              </div>

              <!-- Validity (Days) -->
              <div class="sm:col-span-3">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Validity (Days)</label>
                <div class="relative">
                  <input
                    v-model.number="validityDays"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="7"
                    class="w-full px-3 py-2 pr-10 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1b3b5f]/20 focus:border-[#1b3b5f] transition"
                  />
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold select-none">
                    days
                  </span>
                </div>
              </div>

              <!-- Show Disc % in Slip -->
              <div class="sm:col-span-4 flex items-end">
                <label class="w-full flex items-center gap-2.5 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition h-[38px] select-none">
                  <input
                    v-model="showDiscountColumn"
                    type="checkbox"
                    class="w-4 h-4 rounded text-[#1b3b5f] focus:ring-[#1b3b5f] border-gray-300 cursor-pointer"
                  />
                  <div class="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <Percent class="w-3.5 h-3.5 text-[#1b3b5f]" />
                    <span>Show Disc % in Slip</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Step 2: Search & Autocomplete Bar -->
          <div class="relative z-30">
            <div class="bg-white rounded-2xl border-2 border-[#1b3b5f]/30 shadow-sm p-3 sm:p-3.5 transition-all focus-within:border-[#1b3b5f] focus-within:ring-4 focus-within:ring-[#1b3b5f]/10">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-[#1b3b5f] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Search class="w-4 h-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <label class="block text-[10px] font-bold uppercase tracking-widest text-[#1b3b5f] mb-0.5">
                    Quick Item Finder (Search Google Sheet Hardware Catalog)
                  </label>
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    data-autofocus="true"
                    data-quick-search="true"
                    @keydown.down.prevent="navigateResults(1)"
                    @keydown.up.prevent="navigateResults(-1)"
                    @keydown.enter.prevent="selectHighlightedOrFirst"
                    @keydown.tab.prevent="selectHighlightedOrFirst"
                    @keydown.esc="if (searchQuery) { searchQuery = ''; highlightedIndex = -1; $event.stopPropagation(); } else { closeModal(); }"
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
              ref="dropdownContainerRef"
              v-if="searchQuery.trim().length >= 2"
              class="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100 max-h-[min(480px,60vh)] overflow-y-auto z-50 animate-in fade-in duration-150 scrollbar-thin scrollbar-thumb-gray-200"
            >
              <!-- Dropdown Header helper bar -->
              <div v-if="filteredSearchResults.length > 0" class="sticky top-0 z-10 px-4 py-2 bg-gray-50/95 backdrop-blur-xs border-b border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                <span class="font-semibold text-gray-700">
                  Found {{ filteredSearchResults.length }} matching catalog item{{ filteredSearchResults.length > 1 ? 's' : '' }}
                </span>
                <span class="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span>Use</span>
                  <kbd class="px-1 py-0.2 bg-white border border-gray-300 rounded font-mono shadow-2xs">↑</kbd>
                  <kbd class="px-1 py-0.2 bg-white border border-gray-300 rounded font-mono shadow-2xs">↓</kbd>
                  <span>to navigate</span>
                  <kbd class="px-1 py-0.2 bg-white border border-gray-300 rounded font-mono shadow-2xs">Enter ↵</kbd>
                  <span>to select</span>
                </span>
              </div>

              <div v-if="filteredSearchResults.length === 0" class="p-6 text-center text-gray-500 text-xs">
                <PackageSearch class="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                <p class="font-bold text-gray-700">No matching article or product found</p>
                <p class="text-[11px] text-gray-400 mt-0.5">Try typing the article number digits or brand name.</p>
              </div>

              <div
                v-for="(item, idx) in filteredSearchResults"
                :key="item.articleNumber"
                :data-index="idx"
                @click="addItemToQuote(item)"
                @mouseenter="highlightedIndex = idx"
                class="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                :class="highlightedIndex === idx ? 'bg-sky-50/90 border-l-4 border-l-[#1b3b5f]' : 'hover:bg-gray-50/80'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-6 h-6 rounded-md bg-gray-100 text-gray-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                    #
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-bold text-xs text-gray-900 bg-gray-100 px-1.5 py-0.2 rounded">
                        {{ item.articleNumber }}
                      </span>
                      <span class="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-blue-50 text-blue-800 border border-blue-200">
                        {{ item.brand }}
                      </span>
                      <span 
                        v-if="item.sourceTab" 
                        class="text-[9px] font-semibold px-1.5 py-0.2 rounded border"
                        :class="item.sourceTab === '2026JULY' 
                          ? 'bg-slate-100 text-slate-700 border-slate-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'"
                      >
                        {{ item.sourceTab === '2026JULY' ? item.sourceTab : 'Old Price List: ' + item.sourceTab }}
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
                    <span class="text-xs sm:text-sm font-bold text-[#1b3b5f]">
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
                <span class="w-6 h-6 rounded-md bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center font-bold text-xs">
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
                  <Plus class="w-3 h-3 text-[#1b3b5f]" />
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
              <table class="w-full text-left border-collapse min-w-[830px] text-xs">
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
                    <th class="py-2.5 px-2.5 w-20 text-center bg-sky-50/40 border-r border-sky-100" title="Tax bracket per item. Prefilled from Sheets.">GST %</th>
                    <th class="py-2.5 px-3 w-24 text-right bg-emerald-50/30">Net Rate (₹)</th>
                    <th class="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th class="py-2.5 px-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr v-for="(row, idx) in quoteItems" :key="row.id" class="hover:bg-gray-50/70 transition-colors">
                    <td class="py-2.5 px-2 text-center text-gray-400 font-semibold text-xs">{{ idx + 1 }}</td>
                    <td class="py-2.5 px-2.5">
                      <input
                        v-if="row.isCustom"
                        v-model="row.articleNumber"
                        type="text"
                        placeholder="Code"
                        class="w-full font-bold text-xs border border-gray-200 rounded px-1.5 py-0.5"
                      />
                      <div v-else class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-bold text-xs text-gray-900">{{ row.articleNumber }}</span>
                        <span 
                          v-if="row.sourceTab && row.sourceTab !== '2026JULY'" 
                          class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200"
                          :title="'Price from old price list: ' + row.sourceTab"
                        >
                          Old Price List: {{ row.sourceTab }}
                        </span>
                      </div>
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
                          tabindex="-1"
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
                          tabindex="-1"
                          @click="row.quantity = row.quantity + 1"
                          class="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div class="mt-1 flex items-center justify-center">
                        <button
                          type="button"
                          tabindex="-1"
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
                    <td class="py-2.5 px-2.5 text-right font-medium text-gray-700">
                      <input
                        v-if="row.isCustom"
                        v-model.number="row.mrp"
                        type="number"
                        min="0"
                        class="w-16 text-right font-medium text-xs border border-gray-200 rounded px-1 py-0.5"
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

                    <!-- GST % (Tax Bracket) -->
                    <td class="py-2.5 px-2.5 bg-sky-50/20 border-r border-sky-100/60 text-center">
                      <div class="inline-flex items-center gap-0.5 justify-center">
                        <input
                          v-model.number="row.gstRate"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="18"
                          class="w-12 text-center font-bold text-xs border border-sky-300 rounded-lg py-0.5 bg-white text-sky-950 focus:ring-1 focus:ring-sky-500 outline-none"
                        />
                        <span class="text-[10px] text-sky-700 font-bold">%</span>
                      </div>
                    </td>

                    <!-- Net Rate -->
                    <td class="py-2.5 px-3 text-right bg-emerald-50/20 font-bold text-emerald-900">
                      ₹{{ calculateUnitRate(row).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </td>

                    <!-- Total Value -->
                    <td class="py-2.5 px-3 text-right font-bold text-gray-900">
                      ₹{{ Math.round(calculateLineTotal(row)).toLocaleString('en-IN') }}
                    </td>

                    <td class="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        tabindex="-1"
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

              <!-- Bottom Add Item Actions (Below last item added in quotation) -->
              <div v-if="quoteItems.length > 0" class="px-4 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    @click="focusSearchInput"
                    class="px-3.5 py-1.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    title="Jump to search bar to find and add products from Google Sheets"
                  >
                    <Search class="w-3.5 h-3.5" />
                    <span>Add Item (Search Catalog)</span>
                  </button>
                  <button
                    type="button"
                    @click="addCustomItem"
                    class="px-3.5 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    title="Add a custom manual material item"
                  >
                    <Plus class="w-3.5 h-3.5 text-[#1b3b5f]" />
                    <span>Custom Item</span>
                  </button>
                </div>
                <span class="text-xs text-gray-500 font-medium">
                  {{ quoteItems.length }} {{ quoteItems.length === 1 ? 'item' : 'items' }} in quotation
                </span>
              </div>
            </div>
          </div>

          <!-- Step 4: Tax Options, Notes & Grand Total Grid -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div class="md:col-span-7 bg-white rounded-2xl border border-gray-200 p-4 space-y-3.5">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Settings class="w-3.5 h-3.5 text-[#1b3b5f]" />
                <span>GST Mode & Commercial Notes</span>
              </h4>

              <!-- GST Mode Radios -->
              <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">GST Calculation</label>
                <div class="grid grid-cols-2 gap-2">
                  <label
                    class="p-2.5 rounded-xl border cursor-pointer select-none transition text-center text-xs font-bold"
                    :class="taxMode === 'EXTRA' ? 'bg-[#1b3b5f]/10 border-[#1b3b5f] text-[#1b3b5f]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                  >
                    <input type="radio" v-model="taxMode" value="EXTRA" class="hidden" />
                    <span>+ GST Extra</span>
                  </label>

                  <label
                    class="p-2.5 rounded-xl border cursor-pointer select-none transition text-center text-xs font-bold"
                    :class="taxMode === 'INCLUSIVE' ? 'bg-[#1b3b5f]/10 border-[#1b3b5f] text-[#1b3b5f]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                  >
                    <input type="radio" v-model="taxMode" value="INCLUSIVE" class="hidden" />
                    <span>GST Inclusive</span>
                  </label>
                </div>

                <!-- Quick Apply Tax Bracket to All Items -->
                <div v-if="quoteItems.length > 0" class="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Set all items:</span>
                  <button
                    v-for="rate in [0, 5, 12, 18, 28]"
                    :key="rate"
                    type="button"
                    @click="applyGstRateToAll(rate)"
                    class="px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer"
                    :class="isAllGstRate(rate) ? 'bg-sky-100 text-sky-800 border-sky-300 font-extrabold shadow-2xs' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'"
                    :title="`Set tax bracket for all items to ${rate}%`"
                  >
                    {{ rate }}%
                  </button>
                </div>
              </div>

              <!-- Notes Textarea -->
              <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Terms / Remarks</label>
                <textarea
                  v-model="quoteNotes"
                  rows="2"
                  placeholder="e.g. Subject to full carton delivery."
                  class="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#1b3b5f]/20 outline-none"
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
                    <PenTool class="w-3.5 h-3.5 text-[#1b3b5f]" />
                    <span>Add Signature</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Grand Total Breakdown -->
            <div class="md:col-span-5 bg-white rounded-2xl border border-gray-200 p-4 text-xs shadow-2xs">
              <table class="w-full border-collapse text-xs">
                <tbody>
                  <!-- Total MRP -->
                  <tr class="text-gray-600">
                    <td class="py-1 text-left font-bold pr-2">Total MRP:</td>
                    <td class="py-1 w-3 text-center font-mono"></td>
                    <td class="py-1 w-4 text-right font-mono font-bold text-gray-700">₹</td>
                    <td class="py-1 text-right font-mono font-bold text-gray-800 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalMrp) }}</td>
                  </tr>

                  <!-- Total Discount -->
                  <tr v-if="totalDiscountSaved > 0" class="text-emerald-700 font-bold">
                    <td class="py-1 text-left pr-2">Total Discount:</td>
                    <td class="py-1 w-3 text-center font-mono font-bold text-emerald-600">-</td>
                    <td class="py-1 w-4 text-right font-mono font-bold text-emerald-600">₹</td>
                    <td class="py-1 text-right font-mono font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalDiscountSaved) }}</td>
                  </tr>

                  <!-- Subtotal -->
                  <tr class="border-t border-gray-200 text-gray-900 font-black">
                    <td class="py-1 text-left pr-2">Subtotal:</td>
                    <td class="py-1 w-3 text-center font-mono"></td>
                    <td class="py-1 w-4 text-right font-mono font-black text-gray-950">₹</td>
                    <td class="py-1 text-right font-mono font-black text-gray-950 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(subtotal) }}</td>
                  </tr>

                  <!-- GST -->
                  <tr v-if="taxMode === 'EXTRA'" class="text-gray-700 font-bold">
                    <td class="py-1 text-left pr-2">GST:</td>
                    <td class="py-1 w-3 text-center font-mono font-bold text-sky-600">+</td>
                    <td class="py-1 w-4 text-right font-mono font-bold text-sky-600">₹</td>
                    <td class="py-1 text-right font-mono font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(gstAmount) }}</td>
                  </tr>

                  <!-- Round Off -->
                  <tr v-if="roundOffAmount !== 0" class="text-gray-600 font-medium text-[11px]">
                    <td class="py-1 text-left pr-2">Round Off:</td>
                    <td class="py-1 w-3 text-center font-mono">{{ roundOffAmount > 0 ? '+' : '-' }}</td>
                    <td class="py-1 w-4 text-right font-mono">₹</td>
                    <td class="py-1 text-right font-mono tabular-nums whitespace-nowrap pl-1">{{ Math.abs(roundOffAmount).toFixed(2) }}</td>
                  </tr>

                  <!-- Grand Total -->
                  <tr class="border-t-2 border-b-2 border-gray-300 text-[#1b3b5f] font-black">
                    <td class="py-1.5 text-left uppercase text-xs tracking-wider pr-2">Grand Total:</td>
                    <td class="py-1.5 w-3 text-center font-mono"></td>
                    <td class="py-1.5 w-4 text-right font-mono font-black text-[#1b3b5f]">₹</td>
                    <td class="py-1.5 text-right font-mono font-black tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(grandTotal) }}</td>
                  </tr>
                </tbody>
              </table>
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
            <!-- In Draft View: Primary Action is CREATE QUOTATION -->
            <button
              v-if="!isSuccessView"
              type="button"
              @click="saveAndGenerateQuote"
              :disabled="quoteItems.length === 0 || !customerName.trim() || isSaving"
              class="px-6 py-2.5 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
              <CheckCircle2 v-else class="w-4 h-4" />
              <span>Create Quotation</span>
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
          <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1b3b5f] rounded-full"></div>

        <!-- Header -->
        <div class="flex items-center justify-between border-b border-gray-200 pb-6 mb-6">
          <div v-if="!isAnonymousMode">
            <img
              :src="logoDataUri || '/images/logo-original.png'"
              alt="Silicon Marketing"
              class="h-24 w-auto object-contain"
              crossorigin="anonymous"
            />
          </div>
          <div v-else class="space-y-1">
            <span class="inline-block px-3.5 py-1.5 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-wider shadow-2xs">
              PRICE QUOTATION
            </span>
          </div>
          <div class="text-right">
            <span v-if="!isAnonymousMode" class="inline-block px-3.5 py-1 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-widest mb-1.5 shadow-2xs">
              PRICE QUOTATION
            </span>
            <div class="text-base font-black text-[#1b3b5f] tabular-nums">{{ quoteNumber }}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              <span class="text-gray-400 font-medium">Date:</span>
              <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
            </div>
            <div class="inline-block text-[11px] text-[#1b3b5f] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold mt-1">
              Valid for {{ validityDays || 7 }} days
            </div>
          </div>
        </div>

        <!-- Customer Box -->
        <div class="bg-slate-50/90 p-4 rounded-xl border border-slate-200/80 mb-6 flex justify-between items-center gap-6">
          <div class="min-w-0 flex-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Customer Details:</span>
            <div class="text-base font-black text-[#1b3b5f]">
              {{ customerName || 'Valued Customer' }}
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-600 mt-1.5 flex-wrap">
              <span v-if="customerPhone" class="inline-flex items-center gap-1.5 tabular-nums">
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

          <!-- Issued By (Branded Mode Only) -->
          <div v-if="!isAnonymousMode" class="text-right border-l border-slate-200 pl-6 shrink-0">
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
              <th class="py-2 px-1 w-5 text-center">#</th>
              <th class="py-2 px-1.5 w-20">Article No.</th>
              <th class="py-2 px-2">Product Description</th>
              <th class="py-2 px-1 text-center w-10">Brand</th>
              <th class="py-2 px-1 text-center w-9">Qty</th>
              <th class="py-2 px-1.5 text-right w-16">MRP (₹)</th>
              <th v-if="showDiscountColumn" class="py-2 px-1 text-center w-11">Disc %</th>
              <th class="py-2 px-1 text-center w-8">UoM</th>
              <th class="py-2 px-1.5 text-right w-20">Rate (₹)</th>
              <th class="py-2 px-1.5 text-right w-20">Total (₹)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-for="(item, idx) in quoteItems" :key="item.id" class="border-b border-gray-100 text-[11px]">
              <td class="py-2 px-1 text-center text-gray-500 font-bold text-[10px] tabular-nums">{{ idx + 1 }}</td>
              <td class="py-2 px-1.5 font-black text-[#1b3b5f] text-[11px] whitespace-nowrap tabular-nums">{{ item.articleNumber }}</td>
              <td class="py-2 px-2 font-bold text-gray-950 text-[11px] leading-snug">{{ item.description }}</td>
              <td class="py-2 px-1 text-center font-black text-[10px] text-gray-800 uppercase">{{ item.brand }}</td>
              <td
                class="py-2 px-1 text-center font-black text-[11px] tabular-nums"
                :class="isItemInStock(item) ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fff3e0] text-[#d9480f]'"
              >
                {{ item.quantity }}
              </td>
              <td class="py-2 px-1.5 text-right font-bold text-gray-700 text-[11px] whitespace-nowrap tabular-nums">₹{{ formatSlipNumber(item.mrp) }}</td>
              <td v-if="showDiscountColumn" class="py-2 px-1 text-center font-bold text-emerald-700 text-[11px] tabular-nums">{{ item.discount ? item.discount + '%' : '-' }}</td>
              <td class="py-2 px-1 text-center font-bold text-gray-700 text-[10px]">{{ item.uom }}</td>
              <td class="py-2 px-1.5 text-right font-black text-[#1b3b5f] text-[11px] whitespace-nowrap tabular-nums">
                ₹{{ calculateUnitRate(item).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td class="py-2 px-1.5 text-right font-black text-gray-950 text-[11px] whitespace-nowrap tabular-nums">
                ₹{{ formatSlipNumber(calculateLineTotal(item)) }}
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

          <div class="w-5/12 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 text-xs">
            <table class="w-full border-collapse text-xs">
              <tbody>
                <!-- Total MRP -->
                <tr class="text-gray-600">
                  <td class="py-1 text-left font-bold pr-2">Total MRP:</td>
                  <td class="py-1 w-3 text-center"></td>
                  <td class="py-1 w-4 text-right font-bold text-gray-700">₹</td>
                  <td class="py-1 text-right font-bold text-gray-800 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalMrp) }}</td>
                </tr>

                <!-- Total Discount -->
                <tr v-if="totalDiscountSaved > 0" class="text-emerald-700 font-bold">
                  <td class="py-1 text-left pr-2">Total Discount:</td>
                  <td class="py-1 w-3 text-center font-bold text-emerald-600">-</td>
                  <td class="py-1 w-4 text-right font-bold text-emerald-600">₹</td>
                  <td class="py-1 text-right font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalDiscountSaved) }}</td>
                </tr>

                <!-- Subtotal -->
                <tr class="border-t border-slate-200 text-gray-900 font-black">
                  <td class="py-1 text-left pr-2">Subtotal:</td>
                  <td class="py-1 w-3 text-center"></td>
                  <td class="py-1 w-4 text-right font-black text-gray-950">₹</td>
                  <td class="py-1 text-right font-black text-gray-950 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(subtotal) }}</td>
                </tr>

                <!-- GST -->
                <tr v-if="taxMode === 'EXTRA'" class="text-gray-700 font-bold">
                  <td class="py-1 text-left pr-2">GST:</td>
                  <td class="py-1 w-3 text-center font-bold text-sky-600">+</td>
                  <td class="py-1 w-4 text-right font-bold text-sky-600">₹</td>
                  <td class="py-1 text-right font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(gstAmount) }}</td>
                </tr>

                <!-- Round Off -->
                <tr v-if="roundOffAmount !== 0" class="text-gray-600 font-medium text-[11px]">
                  <td class="py-1 text-left pr-2">Round Off:</td>
                  <td class="py-1 w-3 text-center">{{ roundOffAmount > 0 ? '+' : '-' }}</td>
                  <td class="py-1 w-4 text-right font-medium">₹</td>
                  <td class="py-1 text-right font-medium tabular-nums whitespace-nowrap pl-1">{{ Math.abs(roundOffAmount).toFixed(2) }}</td>
                </tr>

                <!-- Grand Total -->
                <tr class="border-t-2 border-b-2 border-slate-300 text-[#1b3b5f] font-black">
                  <td class="py-1.5 text-left uppercase text-xs tracking-wider pr-2">Grand Total:</td>
                  <td class="py-1.5 w-3 text-center"></td>
                  <td class="py-1.5 w-4 text-right font-black text-[#1b3b5f]">₹</td>
                  <td class="py-1.5 text-right font-black tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(grandTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Nondisclosure Obligations Notice -->
        <div class="pt-3 border-t border-gray-200 text-[9px] text-black leading-relaxed">
          <span class="font-bold text-black uppercase tracking-wider">Nondisclosure obligations:</span>
          In general, recipients of confidential information are subject to an affirmative duty to keep the information confidential, and not to disclose it to third parties except as expressly permitted by the agreement.
        </div>
        </div>

        <!-- Footer Signoff pinned to bottom of A4 page -->
        <div class="mt-auto pt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-400">
          <div>
            <span class="block font-medium">
              {{ isAnonymousMode ? 'Price Quotation' : 'Silicon Marketing • Price Quotation' }}
            </span>
          </div>
          <div class="flex flex-col items-center text-center">
            <div class="h-10 flex items-end justify-center mb-1">
              <img
                v-if="!isAnonymousMode && signatureDataUrl"
                :src="signatureDataUrl"
                alt="Authorized Signature"
                class="max-h-10 max-w-[130px] object-contain"
              />
            </div>
            <div class="border-t border-gray-400 w-32 pt-1">
              <span class="font-bold text-gray-700 block">Authorized Signatory</span>
              <span v-if="!isAnonymousMode" class="text-[9px] text-gray-400 block">{{ displayCreatorName }}</span>
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
            <div class="h-1.5 w-full bg-gradient-to-r from-[#1b3b5f] via-[#d92546] to-[#1b3b5f] rounded-full"></div>

            <!-- Page 1 Header (Full) -->
            <div v-if="pg.isFirst">
              <div class="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
                <div v-if="!isAnonymousMode">
                  <img
                    :src="logoDataUri || '/images/logo-original.png'"
                    alt="Silicon Marketing"
                    class="h-20 w-auto object-contain"
                    crossorigin="anonymous"
                  />
                </div>
                <div v-else class="space-y-1">
                  <span class="inline-block px-3 py-1 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-wider shadow-2xs">
                    PRICE QUOTATION
                  </span>
                </div>
                <div class="text-right">
                  <span v-if="!isAnonymousMode" class="inline-block px-3 py-0.5 rounded-lg bg-[#1b3b5f] text-white text-xs font-black uppercase tracking-widest mb-1 shadow-2xs">
                    PRICE QUOTATION
                  </span>
                  <div class="text-base font-black text-[#1b3b5f] tabular-nums">{{ quoteNumber }}</div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    <span class="text-gray-400 font-medium">Date:</span>
                    <strong class="font-bold text-gray-800 ml-1">{{ formatDisplayDate(new Date()) }}</strong>
                  </div>
                  <div class="inline-block text-[11px] text-[#1b3b5f] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold mt-1">
                    Valid for {{ validityDays || 7 }} days
                  </div>
                </div>
              </div>

              <!-- Customer Box -->
              <div class="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 mb-4 flex justify-between items-center gap-6">
                <div class="min-w-0 flex-1">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">Customer Details:</span>
                  <div class="text-base font-black text-[#1b3b5f]">
                    {{ customerName || 'Valued Customer' }}
                  </div>
                  <div class="flex items-center gap-3 text-xs text-gray-600 mt-1 flex-wrap">
                    <span v-if="customerPhone" class="inline-flex items-center gap-1 tabular-nums">
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

                <!-- Issued By (Branded Mode Only) -->
                <div v-if="!isAnonymousMode" class="text-right border-l border-slate-200 pl-5 shrink-0">
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
                <div v-if="!isAnonymousMode" class="flex items-center gap-3">
                  <img
                    :src="logoDataUri || '/images/logo-original.png'"
                    alt="Silicon Marketing"
                    class="h-12 w-auto object-contain"
                    crossorigin="anonymous"
                  />
                  <div class="border-l border-gray-200 pl-3">
                    <span class="inline-block px-2 py-0.5 rounded bg-[#1b3b5f] text-white text-[10px] font-black uppercase tracking-wider">
                      PRICE QUOTATION &bull; CONTINUATION
                    </span>
                    <div class="text-[11px] text-gray-500 font-medium mt-0.5">
                      Silicon Marketing Order Management
                    </div>
                  </div>
                </div>
                <div v-else>
                  <span class="inline-block px-2.5 py-0.5 rounded bg-[#1b3b5f] text-white text-[10px] font-black uppercase tracking-wider">
                    PRICE QUOTATION &bull; CONTINUATION
                  </span>
                </div>

                <div class="text-right">
                  <div class="text-sm font-black text-[#1b3b5f] tabular-nums">{{ quoteNumber }}</div>
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
                  <span v-if="customerPhone" class="text-gray-700 tabular-nums">+91 {{ customerPhone }}</span>
                  <span v-if="customerPlace" class="text-gray-300">&bull;</span>
                  <span v-if="customerPlace" class="text-gray-700">{{ customerPlace }}</span>
                </div>
                <div v-if="!isAnonymousMode" class="text-[11px] text-gray-500">
                  Rep: <strong class="text-gray-800">{{ displayCreatorName }}</strong>
                </div>
              </div>
            </div>

            <!-- Items Table (on EVERY page) -->
            <table class="w-full text-left border-collapse text-xs mb-2">
              <thead>
                <tr class="bg-[#1b3b5f] text-white font-extrabold text-[10px] uppercase tracking-wider">
                  <th class="py-2 px-1 w-5 text-center">#</th>
                  <th class="py-2 px-1.5 w-20">Article No.</th>
                  <th class="py-2 px-2">Product Description</th>
                  <th class="py-2 px-1 text-center w-10">Brand</th>
                  <th class="py-2 px-1 text-center w-9">Qty</th>
                  <th class="py-2 px-1.5 text-right w-16">MRP (₹)</th>
                  <th v-if="showDiscountColumn" class="py-2 px-1 text-center w-11">Disc %</th>
                  <th class="py-2 px-1 text-center w-8">UoM</th>
                  <th class="py-2 px-1.5 text-right w-20">Rate (₹)</th>
                  <th class="py-2 px-1.5 text-right w-20">Total (₹)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                <tr v-for="(item, idx) in pg.items" :key="item.id" class="border-b border-gray-100 text-[11px]">
                  <td class="py-2 px-1 text-center text-gray-500 font-bold text-[10px] tabular-nums">{{ pg.startIndex + idx + 1 }}</td>
                  <td class="py-2 px-1.5 font-black text-[#1b3b5f] text-[11px] whitespace-nowrap tabular-nums">{{ item.articleNumber }}</td>
                  <td class="py-2 px-2 font-bold text-gray-950 text-[11px] leading-snug">{{ item.description }}</td>
                  <td class="py-2 px-1 text-center font-black text-[10px] text-gray-800 uppercase">{{ item.brand }}</td>
                  <td
                    class="py-2 px-1 text-center font-black text-[11px] tabular-nums"
                    :class="isItemInStock(item) ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fff3e0] text-[#d9480f]'"
                  >
                    {{ item.quantity }}
                  </td>
                  <td class="py-2 px-1.5 text-right font-bold text-gray-700 text-[11px] whitespace-nowrap tabular-nums">₹{{ formatSlipNumber(item.mrp) }}</td>
                  <td v-if="showDiscountColumn" class="py-2 px-1 text-center font-bold text-emerald-700 text-[11px] tabular-nums">{{ item.discount ? item.discount + '%' : '-' }}</td>
                  <td class="py-2 px-1 text-center font-bold text-gray-700 text-[10px]">{{ item.uom }}</td>
                  <td class="py-2 px-1.5 text-right font-black text-[#1b3b5f] text-[11px] whitespace-nowrap tabular-nums">
                    ₹{{ calculateUnitRate(item).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </td>
                  <td class="py-2 px-1.5 text-right font-black text-gray-950 text-[11px] whitespace-nowrap tabular-nums">
                    ₹{{ formatSlipNumber(calculateLineTotal(item)) }}
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

                <div class="w-5/12 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 text-xs">
                  <table class="w-full border-collapse text-xs">
                    <tbody>
                      <!-- Total MRP -->
                      <tr class="text-gray-600">
                        <td class="py-1 text-left font-bold pr-2">Total MRP:</td>
                        <td class="py-1 w-3 text-center"></td>
                        <td class="py-1 w-4 text-right font-bold text-gray-700">₹</td>
                        <td class="py-1 text-right font-bold text-gray-800 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalMrp) }}</td>
                      </tr>

                      <!-- Total Discount -->
                      <tr v-if="totalDiscountSaved > 0" class="text-emerald-700 font-bold">
                        <td class="py-1 text-left pr-2">Total Discount:</td>
                        <td class="py-1 w-3 text-center font-bold text-emerald-600">-</td>
                        <td class="py-1 w-4 text-right font-bold text-emerald-600">₹</td>
                        <td class="py-1 text-right font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(totalDiscountSaved) }}</td>
                      </tr>

                      <!-- Subtotal -->
                      <tr class="border-t border-slate-200 text-gray-900 font-black">
                        <td class="py-1 text-left pr-2">Subtotal:</td>
                        <td class="py-1 w-3 text-center"></td>
                        <td class="py-1 w-4 text-right font-black text-gray-950">₹</td>
                        <td class="py-1 text-right font-black text-gray-950 tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(subtotal) }}</td>
                      </tr>

                      <!-- GST -->
                      <tr v-if="taxMode === 'EXTRA'" class="text-gray-700 font-bold">
                        <td class="py-1 text-left pr-2">GST:</td>
                        <td class="py-1 w-3 text-center font-bold text-sky-600">+</td>
                        <td class="py-1 w-4 text-right font-bold text-sky-600">₹</td>
                        <td class="py-1 text-right font-bold tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(gstAmount) }}</td>
                      </tr>

                      <!-- Round Off -->
                      <tr v-if="roundOffAmount !== 0" class="text-gray-600 font-medium text-[11px]">
                        <td class="py-1 text-left pr-2">Round Off:</td>
                        <td class="py-1 w-3 text-center">{{ roundOffAmount > 0 ? '+' : '-' }}</td>
                        <td class="py-1 w-4 text-right font-medium">₹</td>
                        <td class="py-1 text-right font-medium tabular-nums whitespace-nowrap pl-1">{{ Math.abs(roundOffAmount).toFixed(2) }}</td>
                      </tr>

                      <!-- Grand Total -->
                      <tr class="border-t-2 border-b-2 border-slate-300 text-[#1b3b5f] font-black">
                        <td class="py-1.5 text-left uppercase text-xs tracking-wider pr-2">Grand Total:</td>
                        <td class="py-1.5 w-3 text-center"></td>
                        <td class="py-1.5 w-4 text-right font-black text-[#1b3b5f]">₹</td>
                        <td class="py-1.5 text-right font-black tabular-nums whitespace-nowrap pl-1">{{ formatSlipNumber(grandTotal) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Nondisclosure Obligations Notice -->
              <div class="pt-2 border-t border-gray-200 text-[9px] text-black leading-relaxed">
                <span class="font-bold text-black uppercase tracking-wider">Nondisclosure obligations:</span>
                In general, recipients of confidential information are subject to an affirmative duty to keep the information confidential, and not to disclose it to third parties except as expressly permitted by the agreement.
              </div>
            </div>
          </div>

          <!-- Footer Signoff on EVERY page (Strictly pinned to bottom) -->
          <div class="mt-auto pt-3 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-400">
            <div>
              <span class="block font-medium">
                {{ isAnonymousMode ? 'Price Quotation' : 'Silicon Marketing • Price Quotation' }}
              </span>
            </div>
            <span class="inline-flex items-center justify-center font-bold text-gray-600 bg-gray-100 px-3.5 py-1.5 rounded-full border border-gray-200/80 mb-1 tabular-nums whitespace-nowrap shrink-0 leading-none">Page&nbsp;{{ pg.pageNum }}&nbsp;of&nbsp;{{ pdfPages.length }}</span>
            <div class="flex flex-col items-center text-center">
              <div class="h-9 flex items-end justify-center mb-0.5">
                <img
                  v-if="!isAnonymousMode && signatureDataUrl"
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
      class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 sm:inset-0 z-[350] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
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
            :class="desiredStockState ? 'bg-[#1b3b5f] hover:bg-[#132c49]' : 'bg-amber-600 hover:bg-amber-700'"
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
      class="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 sm:inset-0 z-[360] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
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
          <span class="text-[11px] font-bold text-gray-500 tabular-nums">{{ quoteNumber }}</span>
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
                class="px-4 py-2 bg-white border border-[#1b3b5f] text-[#1b3b5f] hover:bg-[#1b3b5f]/5 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <CheckCircle2 class="w-4 h-4" />
                <span>Apply to Draft</span>
              </button>
              <button
                v-if="quoteItems.length > 0 && customerName.trim()"
                type="button"
                @click="confirmSignatureAndProceed(true)"
                :disabled="!hasDrawnSignature"
                class="px-4 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
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
              class="px-5 py-2 bg-[#1b3b5f] hover:bg-[#132c49] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
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
  Printer,
  Edit3,
  Database,
  UserPlus,
  ShoppingBag,
  EyeOff,
  ChevronDown,
  Percent
} from 'lucide-vue-next'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { toBlob, toPng, toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { useSnackbar } from '~/composables/useSnackbar'
import { useAuth } from '~/composables/useAuth'
import { rankAndFilter } from '~/utils/search'

const props = defineProps<{
  modelValue: boolean
  initialQuote?: any | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', quote: any): void
  (e: 'convert', quote: any): void
}>()

const { showSaved, showEditing } = useSnackbar()
const { user } = useAuth()

// State
const isSuccessView = ref(false)
const isEditingExisting = ref(false)
const isAnonymousMode = ref(false)

// Employees / Created By On Behalf Of
const dbUsers = ref<any[]>([])
const isLoadingUsers = ref(false)
const selectedCreatorId = ref<string>('')
const selectedCreatorName = ref<string>('')
const selectedCreatorRole = ref<string>('')
const showDiscountColumn = ref<boolean>(false)

const loadDbUsers = async () => {
  if (dbUsers.value.length > 0) return
  isLoadingUsers.value = true
  try {
    const data = await $fetch<any[]>('/api/users')
    dbUsers.value = (data || []).filter((u: any) => u.isActive !== false)
    if (!selectedCreatorId.value && user.value?.id) {
      const match = dbUsers.value.find(u => u.id === user.value?.id)
      if (match) {
        selectedCreatorId.value = match.id
        selectedCreatorName.value = match.name
        selectedCreatorRole.value = match.role
      }
    }
  } catch (err) {
    console.warn('Could not load users for quotation:', err)
  } finally {
    isLoadingUsers.value = false
  }
}

const onCreatorSelect = (userId: string) => {
  selectedCreatorId.value = userId
  const found = dbUsers.value.find(u => u.id === userId)
  if (found) {
    selectedCreatorName.value = found.name
    selectedCreatorRole.value = found.role
  }
}

const userOptions = computed(() => {
  if (!dbUsers.value || dbUsers.value.length === 0) {
    if (user.value?.id) {
      return [{
        label: `${user.value.name} (${user.value.role || 'Staff'})`,
        value: user.value.id
      }]
    }
    return []
  }
  return dbUsers.value.map(u => ({
    label: `${u.name} (${u.role || 'Staff'})`,
    value: u.id,
    sublabel: u.email
  }))
})

const loadGlobalSettings = async () => {
  try {
    const res = await $fetch<{ quotationAnonymousMode: boolean }>('/api/settings')
    if (res && res.quotationAnonymousMode !== undefined) {
      isAnonymousMode.value = Boolean(res.quotationAnonymousMode)
    }
  } catch (err) {
    console.warn('Could not load quotation settings:', err)
  }
}
const displayCreatorName = computed(() => {
  if (selectedCreatorName.value) return selectedCreatorName.value
  if (isEditingExisting.value && props.initialQuote?.createdByName) {
    return props.initialQuote.createdByName
  }
  return user.value?.name || 'Sales Staff'
})
const isSaving = ref(false)
const isExporting = ref(false)
const exportAction = ref<'whatsapp' | 'download' | 'pdf' | 'print' | null>(null)
const quotationCardRef = ref<HTMLElement | null>(null)

const canConvertCurrentQuote = computed(() => {
  if (!props.initialQuote || !user.value) return false
  if (props.initialQuote.status === 'CONVERTED') return false
  if (user.value.role === 'ADMIN') return true
  if (props.initialQuote.createdById && props.initialQuote.createdById === user.value.id) return true
  if (props.initialQuote.createdByName && user.value.name && props.initialQuote.createdByName.toLowerCase() === user.value.name.toLowerCase()) return true
  return false
})

const triggerConversion = () => {
  emit('convert', props.initialQuote)
  emit('update:modelValue', false)
}

const enterEditMode = () => {
  isSuccessView.value = false
  isEditingExisting.value = true
}

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
  const TOTALS_H = 215         // Availability legend + terms + totals box + nondisclosure
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
  sourceTab?: string
}
const products = ref<SheetProduct[]>([])
const isSyncingSheet = ref(false)
const sheetSyncError = ref<string | null>(null)
const sheetSyncStatus = ref<{ isFallback?: boolean; lastSyncedAt?: string } | null>(null)

const loadSheetCatalog = async (force = false) => {
  isSyncingSheet.value = true
  sheetSyncError.value = null
  try {
    const url = force ? '/api/quotations/sheet-products?force=true' : '/api/quotations/sheet-products'
    const res = await $fetch<any>(url)
    if (res?.products) {
      products.value = res.products
      sheetSyncStatus.value = {
        isFallback: res.isFallback,
        lastSyncedAt: res.lastSyncedAt
      }
    }
  } catch (err: any) {
    console.warn('Could not load sheet products:', err)
    sheetSyncError.value = err?.data?.statusMessage || err?.message || 'Sync failed'
  } finally {
    isSyncingSheet.value = false
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

// Customer DB vs Manual Selection
const dbCustomers = ref<any[]>([])
const isLoadingCustomers = ref(false)
const selectedCustomerId = ref<string>('')
const isManualCustomer = ref(false)

const loadDbCustomers = async () => {
  if (dbCustomers.value.length > 0) return
  isLoadingCustomers.value = true
  try {
    const data = await $fetch<any[]>('/api/customers')
    dbCustomers.value = data || []
  } catch (err) {
    console.warn('Could not load customers for quotation:', err)
  } finally {
    isLoadingCustomers.value = false
  }
}

const customerOptions = computed(() => {
  return dbCustomers.value.map(c => {
    const city = c.addresses?.[0]?.city ? ` (${c.addresses[0].city})` : (c.city ? ` (${c.city})` : '')
    const comp = c.companyName ? ` • ${c.companyName}` : ''
    return {
      label: `${c.name}${comp}${city}`,
      value: c.id
    }
  })
})

const selectedCustomerObj = computed(() => {
  return dbCustomers.value.find(c => c.id === selectedCustomerId.value) || null
})

const onCustomerSelect = (val: string) => {
  selectedCustomerId.value = val
  const cust = dbCustomers.value.find(c => c.id === val)
  if (cust) {
    customerName.value = cust.name || ''
    customerPlace.value = cust.addresses?.[0]?.city || cust.city || ''
    customerPhone.value = cust.phone || cust.addresses?.[0]?.phone || ''
  }
}

const clearCustomerSelection = () => {
  selectedCustomerId.value = ''
  customerName.value = ''
  customerPlace.value = ''
  customerPhone.value = ''
}

const toggleCustomerInputMode = () => {
  isManualCustomer.value = !isManualCustomer.value
  if (isManualCustomer.value) {
    selectedCustomerId.value = ''
  } else {
    if (customerName.value.trim() && dbCustomers.value.length > 0) {
      const match = dbCustomers.value.find(c => c.name.toLowerCase() === customerName.value.trim().toLowerCase())
      if (match) {
        selectedCustomerId.value = match.id
      }
    }
  }
}

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
  sourceTab?: string
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

// Search & Autocomplete
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const dropdownContainerRef = ref<HTMLElement | null>(null)
const highlightedIndex = ref(-1)

const filteredSearchResults = computed(() => {
  const q = searchQuery.value.trim()
  if (q.length < 2) return []
  return rankAndFilter(products.value, q, {
    primary: p => [p.articleNumber, p.description],
    secondary: p => p.brand
  }).slice(0, 20)
})

const scrollToHighlightedItem = () => {
  if (!dropdownContainerRef.value || highlightedIndex.value < 0) return
  const container = dropdownContainerRef.value
  const targetEl = container.querySelector<HTMLElement>(`[data-index="${highlightedIndex.value}"]`)
  if (!targetEl) return

  const containerRect = container.getBoundingClientRect()
  const targetRect = targetEl.getBoundingClientRect()

  // If item is scrolled above the visible viewport of dropdown
  if (targetRect.top < containerRect.top) {
    container.scrollTop -= (containerRect.top - targetRect.top)
  }
  // If item is scrolled below the visible viewport of dropdown
  else if (targetRect.bottom > containerRect.bottom) {
    container.scrollTop += (targetRect.bottom - containerRect.bottom)
  }
}

const navigateResults = (dir: number) => {
  const total = filteredSearchResults.value.length
  if (total === 0) return
  
  if (highlightedIndex.value === -1) {
    highlightedIndex.value = 0
  } else {
    // Clamp at ends (no looping)
    const next = highlightedIndex.value + dir
    highlightedIndex.value = Math.max(0, Math.min(total - 1, next))
  }

  nextTick(() => {
    scrollToHighlightedItem()
  })
}

const selectHighlightedOrFirst = () => {
  if (filteredSearchResults.value.length === 0) return
  const target = highlightedIndex.value >= 0 ? filteredSearchResults.value[highlightedIndex.value] : filteredSearchResults.value[0]
  if (target) addItemToQuote(target)
}

watch(searchQuery, (newVal) => {
  if (newVal.trim().length >= 2) {
    highlightedIndex.value = 0
    nextTick(() => {
      if (dropdownContainerRef.value) {
        dropdownContainerRef.value.scrollTop = 0
      }
    })
  } else {
    highlightedIndex.value = -1
  }
})

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
      gstRate: item.gstRate !== undefined && item.gstRate !== null && !isNaN(Number(item.gstRate)) ? Number(item.gstRate) : 18,
      stock: item.stock || item.flag || '',
      sourceTab: item.sourceTab
    })
    showSaved(`Added ${item.articleNumber} to quote`)
  }
  searchQuery.value = ''
  highlightedIndex.value = -1
  nextTick(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      searchInputRef.value?.focus()
    }
  })
}

const focusSearchInput = () => {
  if (searchInputRef.value) {
    searchInputRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
    searchInputRef.value.focus()
  }
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
    gstRate: 18,
    isCustom: true
  })
}

const applyGstRateToAll = (rate: number) => {
  quoteItems.value.forEach(row => {
    row.gstRate = rate
  })
  showSaved(`Applied ${rate}% GST to all items`)
}

const isAllGstRate = (rate: number) => {
  if (quoteItems.value.length === 0) return false
  return quoteItems.value.every(row => Number(row.gstRate) === rate)
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
  return (!diff || isNaN(diff) || diff <= 0) ? 0 : Number(diff.toFixed(2))
})

const formatSlipNumber = (val: number | string | undefined | null) => {
  const num = Number(val || 0)
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const overallDiscountPercent = computed(() => {
  if (!totalMrp.value || isNaN(totalMrp.value) || totalMrp.value <= 0) return '0.0'
  const val = (totalDiscountSaved.value / totalMrp.value) * 100
  return isNaN(val) ? '0.0' : val.toFixed(1)
})

const gstAmount = computed(() => {
  if (taxMode.value !== 'EXTRA') return 0
  return quoteItems.value.reduce((acc, it) => {
    const lineTotal = calculateLineTotal(it)
    const rate = it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate))
      ? Number(it.gstRate)
      : 18
    return acc + (lineTotal * (rate / 100))
  }, 0)
})

const rawGrandTotal = computed(() => {
  if (taxMode.value === 'EXTRA') {
    return subtotal.value + gstAmount.value
  }
  return subtotal.value
})

const grandTotal = computed(() => {
  return Math.round(rawGrandTotal.value)
})

const roundOffAmount = computed(() => {
  return Number((grandTotal.value - rawGrandTotal.value).toFixed(2))
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
      showDiscountColumn: showDiscountColumn.value,
      items: quoteItems.value.map(it => ({ ...it, showDiscountColumn: showDiscountColumn.value })),
      totalItems: quoteItems.value.length,
      totalMrp: totalMrp.value,
      subtotal: subtotal.value,
      discountAmount: totalDiscountSaved.value,
      gstAmount: gstAmount.value,
      grandTotal: grandTotal.value,
      createdById: selectedCreatorId.value || user.value?.id || null,
      createdByName: displayCreatorName.value,
      createdByRole: selectedCreatorRole.value || user.value?.role || 'SALES',
      signature: signatureDataUrl.value || null
    }

    const quoteId = props.initialQuote?.id
    const url = quoteId ? `/api/quotations/${quoteId}` : '/api/quotations'
    const method = quoteId ? 'PATCH' : 'POST'

    const res = await $fetch<any>(url, {
      method,
      body: payload
    })

    if (res?.success) {
      showSaved(`Quotation ${quoteNumber.value} ${quoteId ? 'updated' : 'saved'} successfully!`)
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
  selectedCustomerId.value = ''
  isManualCustomer.value = false
  validityDays.value = 7
  quoteNotes.value = ''
  taxMode.value = 'EXTRA'
  quoteItems.value = []
  signatureDataUrl.value = null
  hasDrawnSignature.value = false
  showDiscountColumn.value = false
  selectedCreatorId.value = user.value?.id || ''
  const match = dbUsers.value.find(u => u.id === selectedCreatorId.value)
  selectedCreatorName.value = match?.name || user.value?.name || ''
  selectedCreatorRole.value = match?.role || user.value?.role || 'SALES'
}

const loadQuoteIntoState = (newQuote: any) => {
  if (newQuote) {
    isSuccessView.value = true
    isEditingExisting.value = true
    quoteNumber.value = newQuote.quoteNumber
    customerName.value = newQuote.customerName || ''
    customerPlace.value = newQuote.customerPlace || ''
    customerPhone.value = newQuote.customerPhone || ''
    selectedCreatorId.value = newQuote.createdById || ''
    selectedCreatorName.value = newQuote.createdByName || ''
    selectedCreatorRole.value = newQuote.createdByRole || ''
    showDiscountColumn.value = Boolean(newQuote.showDiscountColumn ?? newQuote.items?.[0]?.showDiscountColumn)
    
    const match = dbCustomers.value.find(c => c.name.toLowerCase() === (newQuote.customerName || '').trim().toLowerCase())
    if (match) {
      selectedCustomerId.value = match.id
      isManualCustomer.value = false
    } else {
      selectedCustomerId.value = ''
      isManualCustomer.value = true
    }
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
      gstRate: it.gstRate !== undefined && it.gstRate !== null && !isNaN(Number(it.gstRate)) ? Number(it.gstRate) : 18,
      stock: it.stock || '',
      inStock: it.inStock,
      manualStockOverride: it.manualStockOverride !== undefined ? it.manualStockOverride : (it.inStock !== undefined ? it.inStock : null)
    }))
    setupViewportObserver()
  } else {
    resetForNewQuote()
  }
}

// Watch initialQuote prop to open existing quotes in success/view mode
watch(
  () => props.initialQuote,
  (newQuote) => {
    loadQuoteIntoState(newQuote)
  },
  { immediate: true }
)

// Watch modelValue prop when modal is opened or closed
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.initialQuote) {
        loadQuoteIntoState(props.initialQuote)
      } else {
        resetForNewQuote()
      }
      loadGlobalSettings()
      loadDbUsers()
      setupViewportObserver()
      loadDbCustomers()
      nextTick(() => {
        if (!isSuccessView.value && searchInputRef.value) {
          if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            searchInputRef.value.focus()
          }
        }
      })
    } else {
      if (props.initialQuote) {
        isSuccessView.value = true
      }
    }
  }
)

const closeModal = () => {
  if (props.initialQuote) {
    isSuccessView.value = true
  }
  emit('update:modelValue', false)
}

/**
 * Renders and captures PDF pages inside an isolated desktop viewport iframe (1200px wide).
 * Completely bypasses mobile font boosting and ensures Android and Windows PC
 * produce 100% identical row heights, word wrapping, and page distribution.
 */
async function renderAndCaptureInDesktopIframe(
  cardEl: HTMLElement,
  items: any[],
  exportAction: 'whatsapp' | 'pdf' | 'print'
): Promise<{ pageDataUrls: string[]; pageCount: number }> {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = '1200px'
  iframe.style.height = '1600px'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-9999'
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      throw new Error('Unable to create desktop rendering environment')
    }

    // Clone all stylesheets and link tags from main document
    const headNodes = document.querySelectorAll('link[rel="stylesheet"], style')
    headNodes.forEach((node) => {
      iframeDoc.head.appendChild(node.cloneNode(true))
    })

    iframeDoc.body.style.margin = '0'
    iframeDoc.body.style.padding = '0'
    iframeDoc.body.style.backgroundColor = '#ffffff'

    // Step 1: Mount card clone to measure desktop row heights
    const cardClone = cardEl.cloneNode(true) as HTMLElement
    iframeDoc.body.appendChild(cardClone)

    if (iframeDoc.fonts) {
      await iframeDoc.fonts.ready
    }
    await new Promise((r) => setTimeout(r, 60))

    const tbody = cardClone.querySelector<HTMLElement>('table tbody')
    const trElements = tbody ? Array.from(tbody.querySelectorAll<HTMLElement>('tr')) : []
    const rowHeights = trElements.map((tr) => tr.offsetHeight || 38)

    iframeDoc.body.removeChild(cardClone)

    // Step 2: Compute pagination using desktop row heights
    const pages = paginateQuoteItems(items, rowHeights)
    pdfPages.value = pages

    // Wait for Vue to render .pdf-page-container elements in the DOM
    await nextTick()
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready
    }
    await new Promise((r) => setTimeout(r, 80))

    // Step 3: Mount the generated .pdf-page-container elements into desktop iframe
    const pageContainers = pdfPagesContainerRef.value?.querySelectorAll<HTMLElement>('.pdf-page-container')
    if (!pageContainers || pageContainers.length === 0) {
      throw new Error('Failed to generate PDF page elements')
    }

    const clonedPageContainers: HTMLElement[] = []
    for (let i = 0; i < pageContainers.length; i++) {
      const clone = pageContainers[i].cloneNode(true) as HTMLElement
      iframeDoc.body.appendChild(clone)
      clonedPageContainers.push(clone)
    }

    if (iframeDoc.fonts) {
      await iframeDoc.fonts.ready
    }
    await new Promise((r) => setTimeout(r, 100))

    // Step 4: Capture each pristine page from the desktop iframe
    const pageDataUrls: string[] = []
    for (let i = 0; i < clonedPageContainers.length; i++) {
      const pageEl = clonedPageContainers[i]
      if (exportAction === 'print') {
        const pageDataUrl = await toPng(pageEl, {
          pixelRatio: 2,
          quality: 0.95,
          backgroundColor: '#ffffff',
          cacheBust: true
        })
        pageDataUrls.push(pageDataUrl)
      } else {
        const pageDataUrl = await toJpeg(pageEl, {
          pixelRatio: 2,
          quality: 0.93,
          backgroundColor: '#ffffff',
          cacheBust: true
        })
        pageDataUrls.push(pageDataUrl)
      }
    }

    return { pageDataUrls, pageCount: pages.length }
  } finally {
    try {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    } catch {}
  }
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

    // Original export settings (Retina 2x: 1588px x 2246px crisp resolution, lightweight ~1MB)
    const exportOptions = {
      pixelRatio: 2,
      quality: 0.95,
      backgroundColor: '#ffffff',
      cacheBust: true
    }

    if (action === 'whatsapp') {
      showSaved('Generating high-resolution quotation PDF for WhatsApp...')

      // Render & capture inside isolated background desktop iframe (1200px wide)
      // This completely eliminates mobile font boosting and guarantees 100% parity with Windows PC
      const { pageDataUrls } = await renderAndCaptureInDesktopIframe(el, quoteItems.value, 'whatsapp')

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
        pdf.addImage(pageDataUrls[i], 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST')
      }

      const fileName = `${quoteNumber.value}-${(customerName.value || 'customer').replace(/\s+/g, '_')}.pdf`
      const clientName = customerName.value?.trim() || ''
      const formattedTotal = formatSlipNumber(grandTotal.value)
      const itemsCount = quoteItems.value.length
      const itemsWord = itemsCount === 1 ? '1 item' : `${itemsCount} items`
      const validityText = `${validityDays.value || 7} Days`

      const politeMessageText = 
        `📄 *QUOTATION ESTIMATE* (${quoteNumber.value})\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        (clientName ? `👤 *Customer:* ${clientName}\n` : '') +
        (customerPlace.value?.trim() ? `📍 *Location:* ${customerPlace.value.trim()}\n` : '') +
        `📦 *Scope:* ${itemsWord}\n` +
        `💰 *Grand Total:* ₹${formattedTotal}\n` +
        `⏳ *Validity:* ${validityText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`

      // Pre-copy message to clipboard so user can instantly paste if needed
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(politeMessageText)
        } catch {}
      }

      const cleanPhone = (customerPhone.value || '').replace(/[^0-9]/g, '')

      // 1. Android Capacitor Native Share Bridge (Sends real uncompressed PDF document + pre-filled caption)
      const isAndroidApp = 
        typeof window !== 'undefined' && (
          (window as any).isSiliconOMSApp === true ||
          !!(window as any).AndroidBridge ||
          !!(window as any).Capacitor?.Plugins?.OMSBridge ||
          navigator.userAgent.includes('SiliconOMSApp')
        )

      if (isAndroidApp) {
        const pdfDataUri = pdf.output('datauristring')

        // 1A. Capacitor OMSBridge Plugin
        if ((window as any).Capacitor?.Plugins?.OMSBridge?.shareImage) {
          await (window as any).Capacitor.Plugins.OMSBridge.shareImage({
            base64Data: pdfDataUri,
            fileName,
            message: politeMessageText,
            targetApp: 'whatsapp',
            phoneNumber: cleanPhone
          })
          showSaved('Opening WhatsApp with quotation PDF...')
          return
        }

        // 1B. Android Javascript Bridge
        if ((window as any).AndroidBridge?.shareImage) {
          ;(window as any).AndroidBridge.shareImage(pdfDataUri, fileName, politeMessageText, 'whatsapp', cleanPhone)
          showSaved('Opening WhatsApp with quotation PDF...')
          return
        }
      }

      // 2. Standard Web Browser (Web Share API for PDF documents)
      const pdfBlob = pdf.output('blob')
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: politeMessageText
        })
        showSaved('Quotation PDF shared successfully!')
      } else {
        // Desktop Browser fallback: save the PDF and launch WhatsApp with pre-filled message
        pdf.save(fileName)

        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
        const textMsg = encodeURIComponent(politeMessageText)
        const waUrl = formattedPhone 
          ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${textMsg}`
          : `https://api.whatsapp.com/send?text=${textMsg}`
        
        window.open(waUrl, '_blank')
        showSaved('Quotation PDF downloaded! Opening WhatsApp...')
      }
    } else if (action === 'download') {
      const dataUrl = await toPng(el, exportOptions)
      const fileName = `${quoteNumber.value}-${(customerName.value || 'customer').replace(/\s+/g, '_')}.png`

      // Android App Native File Save (Saves directly into phone's Downloads directory)
      if (typeof window !== 'undefined' && ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile || (window as any).AndroidBridge?.saveFile)) {
        if ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile) {
          await (window as any).Capacitor.Plugins.OMSBridge.saveFile({
            base64Data: dataUrl,
            fileName,
            mimeType: 'image/png',
            openAfterSave: true
          })
        } else {
          ;(window as any).AndroidBridge.saveFile(dataUrl, fileName, 'image/png', true)
        }
        showSaved('Quotation image saved to your Downloads folder!')
        return
      }

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = fileName
      a.click()
      showSaved('Quotation image saved to your downloads!')
    } else if (action === 'pdf' || action === 'print') {
      // ── Dedicated Multi-Page PDF & Print Generation in Desktop Iframe ─────────
      // Render & capture inside isolated background desktop iframe (1200px wide)
      // This completely eliminates mobile font boosting and guarantees 100% parity with Windows PC
      const { pageDataUrls } = await renderAndCaptureInDesktopIframe(el, quoteItems.value, action)

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

        const pdfFileName = `${quoteNumber.value}.pdf`

        // Android App Native File Save (Saves directly into phone's Downloads directory and opens viewer)
        if (typeof window !== 'undefined' && ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile || (window as any).AndroidBridge?.saveFile)) {
          const pdfDataUri = pdf.output('datauristring')
          if ((window as any).Capacitor?.Plugins?.OMSBridge?.saveFile) {
            await (window as any).Capacitor.Plugins.OMSBridge.saveFile({
              base64Data: pdfDataUri,
              fileName: pdfFileName,
              mimeType: 'application/pdf',
              openAfterSave: true
            })
          } else {
            ;(window as any).AndroidBridge.saveFile(pdfDataUri, pdfFileName, 'application/pdf', true)
          }
          pdfPages.value = []
          showSaved('Quotation PDF saved to your Downloads folder!')
          return
        }

        pdf.save(pdfFileName)
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
  loadGlobalSettings()
  loadDbUsers()
  preloadLogo()
  loadSheetCatalog()
  loadDbCustomers()
  setupViewportObserver()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>
