<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-4.5rem)] md:max-h-[92vh] overflow-hidden flex flex-col border border-gray-100">
        
        <!-- Modal Header -->
        <div class="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b3b5f]/10 text-[#1b3b5f] flex items-center justify-center border border-[#1b3b5f]/20 shrink-0">
              <Database class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold text-[#1a1a1a] flex items-center gap-2 truncate">
                Dropdown Masters & Catalogs
              </h3>
              <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                Centralized management for Terms, UOM, and Groups
              </p>
            </div>
          </div>
          <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Navigation Sub-tabs -->
        <div class="px-4 sm:px-6 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between gap-4 shrink-0">
          <nav class="-mb-px flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
              :class="activeTab === tab.id 
                ? 'border-[#1b3b5f] text-[#1b3b5f] font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'"
            >
              <component :is="tab.icon" class="w-4 h-4" />
              <span>{{ tab.label }}</span>
              <span 
                class="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                :class="activeTab === tab.id ? 'bg-[#1b3b5f]/15 text-[#1b3b5f]' : 'bg-gray-200 text-gray-600'"
              >
                {{ tab.count }}
              </span>
            </button>
          </nav>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">

          <!-- ═══════════════════════════════════════════════════════════ -->
          <!-- TAB 1: PAYMENT TERMS MASTER                                -->
          <!-- ═══════════════════════════════════════════════════════════ -->
          <div v-if="activeTab === 'PAYMENT_TERMS'" class="space-y-4">
            <!-- Toolbar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="relative flex-1 max-w-sm">
                <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="Search payment terms..." 
                  class="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
                />
              </div>

              <button
                @click="openOptionModal('PAYMENT_TERMS')"
                class="flex items-center gap-1.5 bg-[#1b3b5f] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#132c49] transition-colors shrink-0 shadow-xs"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Add Payment Term</span>
              </button>
            </div>

            <!-- Table of Payment Terms -->
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th class="px-4 py-2.5">Label</th>
                    <th class="px-4 py-2.5">Stored Value</th>
                    <th class="px-4 py-2.5">Default</th>
                    <th class="px-4 py-2.5">Status</th>
                    <th class="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-if="filteredPaymentTerms.length === 0">
                    <td colspan="5" class="px-4 py-6 text-center text-gray-400">No payment terms found.</td>
                  </tr>
                  <tr v-for="item in filteredPaymentTerms" :key="item.id" class="hover:bg-gray-50/60 transition-colors">
                    <td class="px-4 py-3 font-semibold text-gray-900">
                      <div class="flex items-center gap-2">
                        <span>{{ item.label }}</span>
                        <span v-if="item.description" class="text-[10px] text-gray-400 font-normal italic">({{ item.description }})</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 font-mono text-[11px] text-gray-600">{{ item.value }}</td>
                    <td class="px-4 py-3">
                      <button 
                        @click="setDefaultOption(item)" 
                        type="button" 
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer"
                        :class="item.isDefault 
                          ? 'bg-emerald-50 text-[#1b3b5f] border-emerald-300 shadow-2xs font-bold' 
                          : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300'"
                        :title="item.isDefault ? 'Default selection for new orders' : 'Click to set as default'"
                      >
                        {{ item.isDefault ? '★ Default' : 'Set Default' }}
                      </button>
                    </td>
                    <td class="px-4 py-3">
                      <button 
                        type="button" 
                        @click="toggleOptionActive(item)"
                        class="px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors"
                        :class="item.isActive !== false 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200'"
                      >
                        {{ item.isActive !== false ? 'Active' : 'Disabled' }}
                      </button>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button 
                          @click="openOptionModal('PAYMENT_TERMS', item)" 
                          class="p-1 text-gray-400 hover:text-[#1b3b5f] rounded hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <Edit2 class="w-3.5 h-3.5" />
                        </button>
                        <button 
                          @click="deleteOption(item)" 
                          class="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ═══════════════════════════════════════════════════════════ -->
          <!-- TAB 2: PRODUCT UOM MASTER                                  -->
          <!-- ═══════════════════════════════════════════════════════════ -->
          <div v-else-if="activeTab === 'PRODUCT_UOM'" class="space-y-4">
            <!-- Toolbar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="relative flex-1 max-w-sm">
                <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="Search units (e.g. SHEET, PIECE)..." 
                  class="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
                />
              </div>

              <button
                @click="openOptionModal('PRODUCT_UOM')"
                class="flex items-center gap-1.5 bg-[#1b3b5f] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#132c49] transition-colors shrink-0 shadow-xs"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Add Unit of Measure</span>
              </button>
            </div>

            <!-- Table of UOMs -->
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th class="px-4 py-2.5">Unit Code</th>
                    <th class="px-4 py-2.5">Display Label</th>
                    <th class="px-4 py-2.5">Default</th>
                    <th class="px-4 py-2.5">Status</th>
                    <th class="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-if="filteredProductUom.length === 0">
                    <td colspan="5" class="px-4 py-6 text-center text-gray-400">No units found.</td>
                  </tr>
                  <tr v-for="item in filteredProductUom" :key="item.id" class="hover:bg-gray-50/60 transition-colors">
                    <td class="px-4 py-3 font-mono font-bold text-gray-900">{{ item.value }}</td>
                    <td class="px-4 py-3 font-medium text-gray-700">
                      <div class="flex items-center gap-2">
                        <span>{{ item.label }}</span>
                        <span v-if="item.description" class="text-[10px] text-gray-400 font-normal italic">({{ item.description }})</span>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <button 
                        @click="setDefaultOption(item)" 
                        type="button" 
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer"
                        :class="item.isDefault 
                          ? 'bg-emerald-50 text-[#1b3b5f] border-emerald-300 shadow-2xs font-bold' 
                          : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-300'"
                      >
                        {{ item.isDefault ? '★ Default' : 'Set Default' }}
                      </button>
                    </td>
                    <td class="px-4 py-3">
                      <button 
                        type="button" 
                        @click="toggleOptionActive(item)"
                        class="px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors"
                        :class="item.isActive !== false 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200'"
                      >
                        {{ item.isActive !== false ? 'Active' : 'Disabled' }}
                      </button>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button 
                          @click="openOptionModal('PRODUCT_UOM', item)" 
                          class="p-1 text-gray-400 hover:text-[#1b3b5f] rounded hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <Edit2 class="w-3.5 h-3.5" />
                        </button>
                        <button 
                          @click="deleteOption(item)" 
                          class="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ═══════════════════════════════════════════════════════════ -->
          <!-- TAB 3: PRODUCT GROUPS / CATEGORIES (132 Brands/Lines)      -->
          <!-- ═══════════════════════════════════════════════════════════ -->
          <div v-else-if="activeTab === 'CATEGORIES'" class="space-y-4">
            <!-- Toolbar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="relative flex-1 max-w-sm">
                <Search class="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="Search among 132 categories (e.g. Hafele, MDF, Blum)..." 
                  class="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
                />
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500 font-medium">
                  Showing <strong class="text-gray-900">{{ filteredCategories.length }}</strong> of {{ categories.length }}
                </span>
                <button
                  @click="openCategoryModal()"
                  class="flex items-center gap-1.5 bg-[#1b3b5f] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#132c49] transition-colors shrink-0 shadow-xs"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Add Product Group</span>
                </button>
              </div>
            </div>

            <!-- Table of Categories -->
            <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs max-h-[460px] overflow-y-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th class="px-4 py-2.5">Group / Category Name</th>
                    <th class="px-4 py-2.5">Description</th>
                    <th class="px-4 py-2.5">Products Linked</th>
                    <th class="px-4 py-2.5">Status</th>
                    <th class="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-if="filteredCategories.length === 0">
                    <td colspan="5" class="px-4 py-8 text-center text-gray-400">No categories matching "{{ searchQuery }}"</td>
                  </tr>
                  <tr v-for="cat in filteredCategories" :key="cat.id" class="hover:bg-gray-50/60 transition-colors">
                    <td class="px-4 py-3 font-semibold text-gray-900">
                      <div class="flex items-center gap-2">
                        <Folder class="w-3.5 h-3.5 text-[#1b3b5f] shrink-0" />
                        <span class="truncate">{{ cat.name }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-gray-500 max-w-xs truncate">{{ cat.description || '—' }}</td>
                    <td class="px-4 py-3">
                      <span 
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        :class="cat.productCount > 0 
                          ? 'bg-blue-50 text-blue-700 border-blue-200 font-mono' 
                          : 'bg-gray-50 text-gray-400 border-gray-200'"
                      >
                        {{ cat.productCount }} {{ cat.productCount === 1 ? 'item' : 'items' }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <button 
                        type="button" 
                        @click="toggleCategoryActive(cat)"
                        class="px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors"
                        :class="cat.isActive !== false 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200'"
                      >
                        {{ cat.isActive !== false ? 'Active' : 'Disabled' }}
                      </button>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button 
                          @click="openCategoryModal(cat)" 
                          class="p-1 text-gray-400 hover:text-[#1b3b5f] rounded hover:bg-gray-100 transition-colors"
                          title="Edit Category Name"
                        >
                          <Edit2 class="w-3.5 h-3.5" />
                        </button>
                        <button 
                          @click="deleteCategory(cat)" 
                          class="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          :title="cat.productCount > 0 ? 'Deactivate (has products linked)' : 'Delete'"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl text-xs text-gray-500">
          <span>Changes take effect immediately across all order, customer, and product forms.</span>
          <button @click="emit('close')" class="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors">
            Close
          </button>
        </div>

      </div>
    </div>
  </Teleport>

  <!-- ═══════════════════════════════════════════════════════════ -->
  <!-- SUB-MODAL: ADD / EDIT OPTION (Payment Term / Product UOM)   -->
  <!-- ═══════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <div v-if="isOptionModalOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[150] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-xs" @click="isOptionModalOpen = false"></div>
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-gray-200 space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h4 class="text-sm font-bold text-gray-900">
            {{ editingOption ? 'Edit' : 'Add' }} {{ optionGroup === 'PAYMENT_TERMS' ? 'Payment Term' : 'Unit of Measure' }}
          </h4>
          <button @click="isOptionModalOpen = false" class="text-gray-400 hover:text-gray-600"><X class="w-4 h-4" /></button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-gray-600 uppercase tracking-wider mb-1">Display Label *</label>
            <input 
              v-model="optionForm.label" 
              type="text" 
              required
              :placeholder="optionGroup === 'PAYMENT_TERMS' ? 'e.g. 90 Days' : 'e.g. BUNDLE'" 
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
            />
          </div>

          <div>
            <label class="block font-bold text-gray-600 uppercase tracking-wider mb-1">Stored Value / Code *</label>
            <input 
              v-model="optionForm.value" 
              type="text" 
              required
              :placeholder="optionGroup === 'PAYMENT_TERMS' ? 'e.g. 90 Days' : 'e.g. BUNDLE'" 
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none font-mono"
            />
          </div>

          <div>
            <label class="block font-bold text-gray-600 uppercase tracking-wider mb-1">Description / Notes (Optional)</label>
            <input 
              v-model="optionForm.description" 
              type="text" 
              placeholder="e.g. Special credit terms for project contractors" 
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
            />
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input 
              id="optDefault" 
              v-model="optionForm.isDefault" 
              type="checkbox" 
              class="rounded border-gray-300 text-[#1b3b5f] focus:ring-[#1b3b5f]"
            />
            <label for="optDefault" class="text-xs font-medium text-gray-700 cursor-pointer select-none">
              Make this the default preselected option
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button @click="isOptionModalOpen = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button 
            @click="saveOption" 
            :disabled="isSubmittingOption || !optionForm.label || !optionForm.value" 
            class="px-4 py-1.5 text-xs bg-[#1b3b5f] text-white rounded-lg font-medium hover:bg-[#132c49] disabled:opacity-50 flex items-center gap-1.5"
          >
            <Loader2 v-if="isSubmittingOption" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isSubmittingOption ? 'Saving...' : 'Save Option' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ═══════════════════════════════════════════════════════════ -->
  <!-- SUB-MODAL: ADD / EDIT CATEGORY                             -->
  <!-- ═══════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <div v-if="isCategoryModalOpen" class="fixed inset-x-0 bottom-0 top-14 md:inset-0 z-[150] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-xs" @click="isCategoryModalOpen = false"></div>
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-gray-200 space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h4 class="text-sm font-bold text-gray-900">
            {{ editingCategory ? 'Edit Product Group' : 'Add New Product Group' }}
          </h4>
          <button @click="isCategoryModalOpen = false" class="text-gray-400 hover:text-gray-600"><X class="w-4 h-4" /></button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-gray-600 uppercase tracking-wider mb-1">Group / Category Name *</label>
            <input 
              v-model="categoryForm.name" 
              type="text" 
              required
              placeholder="e.g. VENEER BOARDS or HAFELE SLIDING" 
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
            />
          </div>

          <div>
            <label class="block font-bold text-gray-600 uppercase tracking-wider mb-1">Description (Optional)</label>
            <textarea 
              v-model="categoryForm.description" 
              rows="2"
              placeholder="Brief details about products in this category..." 
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button @click="isCategoryModalOpen = false" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button 
            @click="saveCategory" 
            :disabled="isSubmittingCategory || !categoryForm.name" 
            class="px-4 py-1.5 text-xs bg-[#1b3b5f] text-white rounded-lg font-medium hover:bg-[#132c49] disabled:opacity-50 flex items-center gap-1.5"
          >
            <Loader2 v-if="isSubmittingCategory" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isSubmittingCategory ? 'Saving...' : 'Save Category' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  Database, CreditCard, Ruler, Layers, 
  Search, Plus, Edit2, Trash2, X, Loader2, Folder
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import type { MasterOptionItem, MasterCategoryItem } from '~/composables/useMasters'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { showSaving, showSaved, showEditing } = useSnackbar()
const { notifyChange } = useRealtimeSync()

type TabKey = 'PAYMENT_TERMS' | 'PRODUCT_UOM' | 'CATEGORIES'
const activeTab = ref<TabKey>('PAYMENT_TERMS')
const searchQuery = ref('')

// Masters Data from API
const paymentTerms = ref<MasterOptionItem[]>([])
const productUom = ref<MasterOptionItem[]>([])
const categories = ref<MasterCategoryItem[]>([])
const isLoading = ref(false)

const fetchMasters = async () => {
  isLoading.value = true
  try {
    const res = await $fetch<{
      paymentTerms: MasterOptionItem[]
      productUom: MasterOptionItem[]
      categories: MasterCategoryItem[]
    }>('/api/masters')
    paymentTerms.value = res.paymentTerms || []
    productUom.value = res.productUom || []
    categories.value = res.categories || []
  } catch (err: any) {
    console.error('Failed to load masters', err)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    searchQuery.value = ''
    fetchMasters()
  }
}, { immediate: true })

const tabs = computed(() => [
  { id: 'PAYMENT_TERMS' as TabKey, label: 'Payment Terms', icon: CreditCard, count: paymentTerms.value.length },
  { id: 'PRODUCT_UOM' as TabKey, label: 'Units (UOM)', icon: Ruler, count: productUom.value.length },
  { id: 'CATEGORIES' as TabKey, label: 'Product Groups', icon: Layers, count: categories.value.length },
])

// Filtered Lists
const filteredPaymentTerms = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return paymentTerms.value
  return paymentTerms.value.filter(i => 
    i.label.toLowerCase().includes(q) || 
    i.value.toLowerCase().includes(q) ||
    (i.description && i.description.toLowerCase().includes(q))
  )
})

const filteredProductUom = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return productUom.value
  return productUom.value.filter(i => 
    i.label.toLowerCase().includes(q) || 
    i.value.toLowerCase().includes(q)
  )
})

const filteredCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter(c => 
    c.name.toLowerCase().includes(q) ||
    (c.description && c.description.toLowerCase().includes(q))
  )
})

// ─── Option Modal State (Payment Terms & UOM) ────────────────
const isOptionModalOpen = ref(false)
const optionGroup = ref<'PAYMENT_TERMS' | 'PRODUCT_UOM'>('PAYMENT_TERMS')
const editingOption = ref<MasterOptionItem | null>(null)
const isSubmittingOption = ref(false)
const optionForm = ref({
  label: '',
  value: '',
  description: '',
  isDefault: false
})

const openOptionModal = (group: 'PAYMENT_TERMS' | 'PRODUCT_UOM', item: MasterOptionItem | null = null) => {
  optionGroup.value = group
  editingOption.value = item
  if (item) {
    optionForm.value = {
      label: item.label,
      value: item.value,
      description: item.description || '',
      isDefault: item.isDefault || false
    }
  } else {
    optionForm.value = {
      label: '',
      value: '',
      description: '',
      isDefault: false
    }
  }
  isOptionModalOpen.value = true
}

const saveOption = async () => {
  if (!optionForm.value.label || !optionForm.value.value) return
  isSubmittingOption.value = true
  showSaving(editingOption.value ? 'Updating option...' : 'Creating option...')

  try {
    if (editingOption.value) {
      await $fetch(`/api/masters/options/${editingOption.value.id}`, {
        method: 'PATCH',
        body: {
          label: optionForm.value.label,
          value: optionForm.value.value,
          description: optionForm.value.description,
          isDefault: optionForm.value.isDefault
        }
      })
      showSaved(`"${optionForm.value.label}" updated`)
    } else {
      await $fetch('/api/masters/options', {
        method: 'POST',
        body: {
          group: optionGroup.value,
          label: optionForm.value.label,
          value: optionForm.value.value,
          description: optionForm.value.description,
          isDefault: optionForm.value.isDefault
        }
      })
      showSaved(`"${optionForm.value.label}" added to ${optionGroup.value === 'PAYMENT_TERMS' ? 'Payment Terms' : 'Units'}`)
    }

    notifyChange({ type: 'MASTERS_UPDATED', action: 'MASTERS_CHANGED' })
    await fetchMasters()
    isOptionModalOpen.value = false
  } catch (err: any) {
    showEditing(`Error: ${err.data?.statusMessage || err.message || 'Failed to save option'}`)
  } finally {
    isSubmittingOption.value = false
  }
}

const toggleOptionActive = async (item: MasterOptionItem) => {
  const targetState = !item.isActive
  try {
    await $fetch(`/api/masters/options/${item.id}`, {
      method: 'PATCH',
      body: { isActive: targetState }
    })
    item.isActive = targetState
    notifyChange({ type: 'MASTERS_UPDATED', action: 'MASTERS_CHANGED' })
    showSaved(`"${item.label}" is now ${targetState ? 'Active' : 'Disabled'}`)
  } catch (err: any) {
    showEditing('Failed to update option status')
  }
}

const setDefaultOption = async (item: MasterOptionItem) => {
  if (item.isDefault) return
  try {
    await $fetch(`/api/masters/options/${item.id}`, {
      method: 'PATCH',
      body: { isDefault: true }
    })
    notifyChange({ type: 'MASTERS_UPDATED', action: 'MASTERS_CHANGED' })
    await fetchMasters()
    showSaved(`"${item.label}" set as default`)
  } catch (err: any) {
    showEditing('Failed to set default')
  }
}

const deleteOption = async (item: MasterOptionItem) => {
  if (!confirm(`Are you sure you want to delete "${item.label}"?`)) return
  try {
    await $fetch(`/api/masters/options/${item.id}`, { method: 'DELETE' })
    notifyChange({ type: 'MASTERS_UPDATED', action: 'MASTERS_CHANGED' })
    await fetchMasters()
    showSaved(`"${item.label}" deleted`)
  } catch (err: any) {
    showEditing('Failed to delete option')
  }
}

// ─── Category Modal State ────────────────────────────────────
const isCategoryModalOpen = ref(false)
const editingCategory = ref<MasterCategoryItem | null>(null)
const isSubmittingCategory = ref(false)
const categoryForm = ref({
  name: '',
  description: ''
})

const openCategoryModal = (cat: MasterCategoryItem | null = null) => {
  editingCategory.value = cat
  if (cat) {
    categoryForm.value = {
      name: cat.name,
      description: cat.description || ''
    }
  } else {
    categoryForm.value = {
      name: '',
      description: ''
    }
  }
  isCategoryModalOpen.value = true
}

const saveCategory = async () => {
  if (!categoryForm.value.name.trim()) return
  isSubmittingCategory.value = true
  showSaving(editingCategory.value ? 'Updating category...' : 'Creating category...')

  try {
    if (editingCategory.value) {
      await $fetch(`/api/categories/${editingCategory.value.id}`, {
        method: 'PATCH',
        body: {
          name: categoryForm.value.name.trim(),
          description: categoryForm.value.description?.trim() || null
        }
      })
      showSaved(`Category "${categoryForm.value.name}" updated`)
    } else {
      await $fetch('/api/categories', {
        method: 'POST',
        body: {
          name: categoryForm.value.name.trim(),
          description: categoryForm.value.description?.trim() || null
        }
      })
      showSaved(`Category "${categoryForm.value.name}" created`)
    }

    notifyChange({ type: 'CATEGORY_UPDATED', action: 'CATEGORY_CHANGED' })
    await fetchMasters()
    isCategoryModalOpen.value = false
  } catch (err: any) {
    showEditing(`Error: ${err.data?.statusMessage || err.message || 'Failed to save category'}`)
  } finally {
    isSubmittingCategory.value = false
  }
}

const toggleCategoryActive = async (cat: MasterCategoryItem) => {
  const targetState = !cat.isActive
  try {
    await $fetch(`/api/categories/${cat.id}`, {
      method: 'PATCH',
      body: { isActive: targetState }
    })
    cat.isActive = targetState
    notifyChange({ type: 'CATEGORY_UPDATED', action: 'CATEGORY_CHANGED' })
    showSaved(`Category "${cat.name}" is now ${targetState ? 'Active' : 'Disabled'}`)
  } catch (err: any) {
    showEditing('Failed to update category status')
  }
}

const deleteCategory = async (cat: MasterCategoryItem) => {
  const msg = cat.productCount > 0 
    ? `Category "${cat.name}" has ${cat.productCount} products linked. Deleting will deactivate it to protect records. Continue?`
    : `Are you sure you want to delete category "${cat.name}"?`
    
  if (!confirm(msg)) return

  try {
    const res: any = await $fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
    notifyChange({ type: 'CATEGORY_UPDATED', action: 'CATEGORY_CHANGED' })
    await fetchMasters()
    showSaved(res.message || `Category updated`)
  } catch (err: any) {
    showEditing('Failed to delete category')
  }
}
</script>
