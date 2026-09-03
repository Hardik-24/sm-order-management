<template>
  <div class="space-y-8">
    <!-- PRODUCTS SECTION -->
    <section>
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 class="text-xl font-bold text-[#1a1a1a]">Products</h2>
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <!-- Search -->
          <div class="relative w-full sm:w-56">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              v-model="searchQuery"
              type="text"
              placeholder="Search SKU or Name..."
              class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] text-sm"
            />
          </div>
          
          <!-- Category Filter Custom Dropdown -->
          <div class="relative w-full sm:w-56 z-40">
            <div 
              @click="openCategoryFilter"
              class="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] text-sm bg-white text-gray-700 cursor-pointer flex items-center justify-between transition-colors hover:bg-gray-50"
            >
              <Filter class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <span class="truncate block w-full text-left">{{ selectedCategory ? getCategoryName(selectedCategory) : 'All Categories' }}</span>
              <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <!-- Transparent Overlay to close dropdown -->
            <div v-if="isCategoryFilterOpen" @click="isCategoryFilterOpen = false" class="fixed inset-0 z-30"></div>

            <!-- Dropdown Menu -->
            <div v-if="isCategoryFilterOpen" class="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
              <div class="p-2 border-b border-gray-100 bg-gray-50">
                <div class="relative">
                  <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input 
                    ref="categorySearchInput"
                    v-model="categorySearchQuery"
                    type="text"
                    placeholder="Search categories..."
                    class="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] bg-white"
                    @click.stop
                    @keydown.down.prevent="handleKeydown('down')"
                    @keydown.up.prevent="handleKeydown('up')"
                    @keydown.enter.prevent="selectFocusedCategory"
                  />
                </div>
              </div>
              <ul ref="categoryListRef" class="max-h-64 overflow-y-auto p-1">
                <li 
                  @click="selectedCategory = null; isCategoryFilterOpen = false"
                  class="px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between"
                  :class="{
                    'text-[#1a5c4c] font-medium bg-[#1a5c4c]/5': selectedCategory === null,
                    'bg-gray-100': focusedCategoryIndex === 0 && selectedCategory !== null,
                    'hover:bg-gray-100': focusedCategoryIndex !== 0
                  }"
                  @mouseenter="focusedCategoryIndex = 0"
                >
                  All Categories
                  <Check v-if="selectedCategory === null" class="w-4 h-4" />
                </li>
                <li 
                  v-for="(category, index) in filteredFilterCategories" 
                  :key="category.id"
                  @click="selectedCategory = category.id; isCategoryFilterOpen = false"
                  class="px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between"
                  :class="{
                    'text-[#1a5c4c] font-medium bg-[#1a5c4c]/5': selectedCategory === category.id,
                    'bg-gray-100': focusedCategoryIndex === index + 1 && selectedCategory !== category.id,
                    'hover:bg-gray-100': focusedCategoryIndex !== index + 1
                  }"
                  @mouseenter="focusedCategoryIndex = index + 1"
                >
                  {{ category.name }}
                  <Check v-if="selectedCategory === category.id" class="w-4 h-4" />
                </li>
                <li v-if="filteredFilterCategories.length === 0" class="px-3 py-4 text-sm text-center text-gray-500">
                  No categories found.
                </li>
              </ul>
            </div>
          </div>

          <!-- Add Buttons -->
          <button 
            v-if="user?.role === 'ADMIN'"
            @click="openCategoryModal()"
            class="flex items-center gap-2 bg-white border border-[#1a5c4c] text-[#1a5c4c] px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap text-sm font-medium"
          >
            <Plus class="w-4 h-4" />
            Category
          </button>
          <button 
            v-if="user?.role === 'ADMIN'"
            @click="openProductModal()"
            class="flex items-center gap-2 bg-[#1a5c4c] text-white px-4 py-2 rounded-lg hover:bg-[#134336] transition-colors shadow-sm whitespace-nowrap text-sm font-medium"
          >
            <Plus class="w-4 h-4" />
            Product
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-[#e5e2dc] shadow-sm overflow-hidden flex flex-col">
        <!-- Optional Toolbar Header -->
        <div class="p-3.5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Total Products: <span class="font-bold text-gray-900">{{ filteredProducts.length }}</span>
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
              <option :value="-1">All ({{ filteredProducts.length }})</option>
            </select>
          </div>
        </div>

        <div ref="tableContainerRef" class="overflow-x-auto min-h-[350px]">
          <table class="w-full text-left border-collapse table-auto">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-36 min-w-[130px] max-w-[160px]">SKU</th>
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest min-w-[220px]">Product Name</th>
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-40 min-w-[140px]">Category</th>
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-28 min-w-[100px]">HSN</th>
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-28 min-w-[110px] text-right">Price</th>
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-24 min-w-[90px] text-right">Stock</th>
                <th class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-24 min-w-[90px]">Status</th>
                <th v-if="user?.role === 'ADMIN'" class="px-5 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest w-24 min-w-[90px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 text-sm">
                <template v-if="productsPending">
                  <tr v-for="i in 5" :key="i" class="animate-pulse hover:bg-transparent">
                    <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                    <td class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td class="px-5 py-3.5"><div class="h-5 bg-gray-200 rounded-full w-16"></div></td>
                    <td v-if="user?.role === 'ADMIN'" class="px-5 py-3.5"><div class="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                  </tr>
                </template>
                <template v-else>
                  <tr v-if="filteredProducts.length === 0" class="hover:bg-gray-50">
                    <td colspan="8" class="px-6 py-12 text-center text-gray-500">No products found.</td>
                  </tr>
                  <tr 
                    v-for="product in paginatedProducts" 
                    :key="product.id" 
                    @click="openProductDetail(product)"
                    class="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                  >
                <td class="px-5 py-3 font-mono text-xs text-gray-600 w-36 min-w-[130px] max-w-[160px] group-hover:text-[#1a5c4c]">
                  <span class="break-words line-clamp-2" :title="product.sku">{{ product.sku }}</span>
                </td>
                <td class="px-5 py-3 font-medium text-[#1a1a1a] min-w-[220px] group-hover:text-[#1a5c4c] transition-colors">
                  <span class="break-words line-clamp-2" :title="product.name">{{ product.name }}</span>
                </td>
                <td class="px-5 py-3 text-gray-600 w-40 min-w-[140px]">
                  <span class="truncate block max-w-[140px]" :title="getCategoryName(product.categoryId)">{{ getCategoryName(product.categoryId) }}</span>
                </td>
                <td class="px-5 py-3 font-mono text-xs text-gray-500 w-28 min-w-[100px]">{{ product.hsnCode || '-' }}</td>
                <td class="px-5 py-3 text-right w-28 min-w-[110px]">
                  <span v-if="!product.isEditingPrice">₹{{ Number(product.price || 0).toLocaleString('en-IN') }} <span class="text-xs text-gray-400">/ {{ product.unit }}</span></span>
                  <div v-else @click.stop class="flex items-center justify-end gap-1">
                    <input type="number" v-model="product.editPrice" class="w-20 px-2 py-1 text-xs border rounded" />
                    <button @click="saveInlineUpdate(product)" class="text-green-600"><Check class="w-4 h-4" /></button>
                    <button @click="product.isEditingPrice = false" class="text-red-500"><X class="w-4 h-4" /></button>
                  </div>
                </td>
                <td class="px-5 py-3 text-right w-24 min-w-[90px]">
                  <span v-if="!product.isEditingStock" :class="(product.stock !== undefined ? product.stock : (product.stockQuantity || 0)) < 10 ? 'text-red-600 font-bold' : 'text-gray-700'">
                    {{ product.stock !== undefined ? product.stock : (product.stockQuantity || 0) }}
                  </span>
                  <div v-else @click.stop class="flex items-center justify-end gap-1">
                    <input type="number" v-model="product.editStock" class="w-16 px-2 py-1 text-xs border rounded" />
                    <button @click="saveInlineUpdate(product)" class="text-green-600"><Check class="w-4 h-4" /></button>
                    <button @click="product.isEditingStock = false" class="text-red-500"><X class="w-4 h-4" /></button>
                  </div>
                </td>
                <td class="px-5 py-3 w-24 min-w-[90px]">
                  <span 
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="product.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ product.isActive !== false ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td v-if="user?.role === 'ADMIN'" @click.stop class="px-5 py-3 text-right w-24 min-w-[90px]">
                  <div class="flex items-center justify-end gap-2">
                    <button @click="product.isEditingPrice = true; product.editPrice = product.price" class="text-gray-400 hover:text-gray-700 p-1" title="Quick Edit Price">
                      <IndianRupee class="w-3.5 h-3.5" />
                    </button>
                    <button @click="product.isEditingStock = true; product.editStock = (product.stock !== undefined ? product.stock : product.stockQuantity)" class="text-gray-400 hover:text-gray-700 p-1" title="Quick Edit Stock">
                      <Package class="w-3.5 h-3.5" />
                    </button>
                    <button @click="openProductModal(product)" class="text-[#1a5c4c] hover:text-[#4ecdc4] p-1" title="Edit Product">
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
        <div v-if="filteredProducts.length > 0 && pageSize !== -1" class="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="text-xs text-gray-500">
            Showing <span class="font-medium text-gray-900">{{ startIndex }}</span> to <span class="font-medium text-gray-900">{{ endIndex }}</span> of <span class="font-medium text-gray-900">{{ filteredProducts.length }}</span> products
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
    </section>

    <!-- Product Details Modal Popup (Untruncated) -->
    <div 
      v-if="isDetailModalOpen && selectedProduct" 
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div 
        ref="detailBackdropRef"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        @click="closeProductDetail"
      ></div>

      <div 
        ref="detailModalRef"
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
      >
        <!-- Header -->
        <div class="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Package class="w-4 h-4 text-[#1a5c4c]" />
            Product Details
          </div>
          <button 
            @click="closeProductDetail" 
            class="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
            title="Close"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- Full Untruncated Name -->
          <div>
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Product Description</span>
            <h2 class="text-xl font-bold text-gray-900 leading-snug break-words">
              {{ selectedProduct.name }}
            </h2>
          </div>

          <!-- Status & Quantity Banner -->
          <div class="p-4 rounded-xl flex items-center justify-between" :class="(selectedProduct.stock || selectedProduct.stockQuantity || 0) > 0 ? 'bg-green-50/70 border border-green-100' : 'bg-red-50/70 border border-red-100'">
            <div>
              <span class="text-xs text-gray-500 block font-medium">Current Stock</span>
              <div class="text-2xl font-bold mt-0.5" :class="(selectedProduct.stock || selectedProduct.stockQuantity || 0) > 0 ? 'text-green-800' : 'text-red-700'">
                {{ selectedProduct.stock !== undefined ? selectedProduct.stock : (selectedProduct.stockQuantity || 0) }} 
                <span class="text-sm font-normal text-gray-600">{{ selectedProduct.unit || 'Units' }}</span>
              </div>
            </div>
            <div class="text-right">
              <span 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                :class="(selectedProduct.stock || selectedProduct.stockQuantity || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              >
                <CheckCircle2 v-if="(selectedProduct.stock || selectedProduct.stockQuantity || 0) > 0" class="w-3.5 h-3.5" />
                <XCircle v-else class="w-3.5 h-3.5" />
                {{ (selectedProduct.stock || selectedProduct.stockQuantity || 0) > 0 ? 'In Stock' : 'Out of Stock' }}
              </span>
            </div>
          </div>

          <!-- Details Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- SKU -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Hash class="w-3.5 h-3.5" />
                SKU / Item Code
              </div>
              <div class="font-mono text-sm font-semibold text-gray-900 break-all select-all">
                {{ selectedProduct.sku }}
              </div>
            </div>

            <!-- Category -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Layers class="w-3.5 h-3.5" />
                Category
              </div>
              <div class="text-sm font-semibold text-gray-900 break-words">
                {{ getCategoryName(selectedProduct.categoryId) }}
              </div>
            </div>

            <!-- HSN Code -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <ShieldCheck class="w-3.5 h-3.5" />
                HSN Code
              </div>
              <div class="font-mono text-sm font-semibold text-gray-900">
                {{ selectedProduct.hsnCode || 'Not Specified' }}
              </div>
            </div>

            <!-- Price -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <IndianRupee class="w-3.5 h-3.5" />
                Sale Price / Unit
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedProduct.price > 0 ? `₹${Number(selectedProduct.price).toLocaleString('en-IN')}` : 'Not Specified' }}
                <span v-if="selectedProduct.price > 0 && selectedProduct.unit" class="text-xs text-gray-500 font-normal">/ {{ selectedProduct.unit }}</span>
              </div>
            </div>

            <!-- GST Rate -->
            <div v-if="selectedProduct.taxRate" class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Tag class="w-3.5 h-3.5" />
                GST Tax Rate
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedProduct.taxRate }}%
              </div>
            </div>

            <!-- Measurement Unit -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div class="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                <Package class="w-3.5 h-3.5" />
                Measurement Unit
              </div>
              <div class="text-sm font-semibold text-gray-900">
                {{ selectedProduct.unit || 'PIECE' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <div>
            <button 
              v-if="user?.role === 'ADMIN'"
              @click="editProductFromDetail()"
              class="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1a5c4c] bg-[#1a5c4c]/10 hover:bg-[#1a5c4c]/20 rounded-lg transition-colors"
            >
              <Edit2 class="w-3.5 h-3.5" />
              Edit Product
            </button>
          </div>
          <button 
            @click="closeProductDetail" 
            class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Product Form Modal (Edit / Add) -->
    <div v-if="isProductModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        ref="formBackdropRef"
        class="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        @click="closeProductModal"
      ></div>
      
      <div 
        ref="formModalRef"
        class="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-[#1a1a1a]">
            {{ editingProduct ? 'Edit Product' : 'Add New Product' }}
          </h3>
          <button @click="closeProductModal" class="text-gray-400 hover:text-gray-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <div :class="['p-6 overflow-y-auto flex-1 transition-all duration-300', snackbarState !== 'hidden' ? 'pb-24' : '']">
          <form @submit.prevent="saveProduct" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">SKU / Item Code *</label>
                <input v-model="productForm.sku" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm uppercase font-mono" />
              </div>

              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">HSN Code</label>
                <input v-model="productForm.hsnCode" type="text" placeholder="e.g. 44089090" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm font-mono" />
              </div>
            </div>
            
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Product Name *</label>
              <input v-model="productForm.name" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Category *</label>
                <CustomSelect 
                  :modelValue="productForm.categoryId"
                  @update:modelValue="val => productForm.categoryId = val"
                  :options="categoryOptions"
                  searchable
                  searchPlaceholder="Search category..."
                  placeholder="Select Category"
                  class="w-full"
                />
              </div>

              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Unit *</label>
                <CustomSelect 
                  :modelValue="productForm.unit"
                  @update:modelValue="val => productForm.unit = val"
                  :options="unitOptions"
                  searchable
                  searchPlaceholder="Search unit..."
                  placeholder="Select Unit"
                  class="w-full"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Price (₹) *</label>
                <input v-model.number="productForm.price" required type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
              </div>

              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Stock *</label>
                <input v-model.number="productForm.stockQuantity" required type="number" min="0" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
              </div>

              <div class="space-y-1">
                <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">GST Rate (%)</label>
                <input v-model.number="productForm.taxRate" type="number" min="0" max="100" step="0.1" placeholder="e.g. 18" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
              </div>
            </div>
            
            <div class="space-y-1 flex items-center pt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="productForm.isActive" type="checkbox" class="w-4 h-4 text-[#1a5c4c] border-gray-300 rounded focus:ring-[#4ecdc4]" />
                <span class="text-sm text-gray-700">Active Product</span>
              </label>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="isCategoryModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeCategoryModal"></div>
      
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-[#1a1a1a]">Add Category</h3>
          <button @click="closeCategoryModal" class="text-gray-400 hover:text-gray-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <div :class="['p-6 overflow-y-auto flex-1 transition-all duration-300', snackbarState !== 'hidden' ? 'pb-24' : '']">
          <form @submit.prevent="saveCategory" class="space-y-4">
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Name *</label>
              <input v-model="categoryForm.name" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Description</label>
              <textarea v-model="categoryForm.description" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm"></textarea>
            </div>
          </form>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { 
  Plus, Search, Edit2, X, Loader2, Check, IndianRupee, Package, Filter, 
  ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Tag, Hash, Layers, ShieldCheck
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import CustomSelect from '~/components/ui/CustomSelect.vue'

definePageMeta({ layout: 'dashboard' })

const { user } = useAuth()
const { showEditing, showSaving, showSaved, hide, snackbarState } = useSnackbar()
const { animateModalOpen, animateStagger, initContext } = useGsapAnimation()

const categoryOptions = computed(() => {
  return (categories.value || []).map((cat: any) => ({
    label: cat.name,
    value: cat.id
  }))
})

const unitOptions = [
  { label: 'PIECE', value: 'PIECE' },
  { label: 'SHEET', value: 'SHEET' },
  { label: 'Nos.', value: 'Nos.' },
  { label: 'SQFT', value: 'SQFT' },
  { label: 'BOX', value: 'BOX' },
  { label: 'KG', value: 'KG' },
  { label: 'METER', value: 'METER' },
  { label: 'ROLL', value: 'ROLL' },
  { label: 'SET', value: 'SET' },
  { label: 'PAIR', value: 'PAIR' }
]

// State
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const isCategoryFilterOpen = ref(false)
const categorySearchQuery = ref('')
const focusedCategoryIndex = ref(0)
const categorySearchInput = ref<HTMLInputElement | null>(null)
const categoryListRef = ref<HTMLUListElement | null>(null)
const tableContainerRef = ref<HTMLElement | null>(null)

// Detail modal state
const selectedProduct = ref<any | null>(null)
const isDetailModalOpen = ref(false)
const detailModalRef = ref<HTMLElement | null>(null)
const detailBackdropRef = ref<HTMLElement | null>(null)

// Form modal state
const isProductModalOpen = ref(false)
const isSavingProduct = ref(false)
const editingProduct = ref<any>(null)
const formModalRef = ref<HTMLElement | null>(null)
const formBackdropRef = ref<HTMLElement | null>(null)

const openProductDetail = (product: any) => {
  selectedProduct.value = product
  isDetailModalOpen.value = true
  nextTick(() => {
    animateModalOpen(detailModalRef.value, detailBackdropRef.value, { duration: 0.26 })
  })
}

const closeProductDetail = () => {
  isDetailModalOpen.value = false
  selectedProduct.value = null
}

const editProductFromDetail = () => {
  const prod = selectedProduct.value
  isDetailModalOpen.value = false
  selectedProduct.value = null
  if (prod) {
    openProductModal(prod)
  }
}

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tableContainerRef.value && !productsPending.value) {
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

watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
})

const openCategoryFilter = () => {
  isCategoryFilterOpen.value = !isCategoryFilterOpen.value
  if (isCategoryFilterOpen.value) {
    categorySearchQuery.value = ''
    focusedCategoryIndex.value = 0
    nextTick(() => {
      categorySearchInput.value?.focus()
    })
  }
}

const handleKeydown = (direction: 'up' | 'down') => {
  if (direction === 'down') {
    focusedCategoryIndex.value = Math.min(filteredFilterCategories.value.length, focusedCategoryIndex.value + 1)
  } else {
    focusedCategoryIndex.value = Math.max(0, focusedCategoryIndex.value - 1)
  }
  
  nextTick(() => {
    if (categoryListRef.value) {
      const li = categoryListRef.value.children[focusedCategoryIndex.value] as HTMLElement
      if (li && li.scrollIntoView) {
        li.scrollIntoView({ block: 'nearest' })
      }
    }
  })
}

const selectFocusedCategory = () => {
  if (focusedCategoryIndex.value === 0) {
    selectedCategory.value = null
  } else {
    const cat = filteredFilterCategories.value[focusedCategoryIndex.value - 1]
    if (cat) {
      selectedCategory.value = cat.id
    }
  }
  isCategoryFilterOpen.value = false
}

watch(categorySearchQuery, () => {
  focusedCategoryIndex.value = 0
})

// Category Modals state
const isCategoryModalOpen = ref(false)
const isSavingCategory = ref(false)

// Forms
const productForm = ref({
  sku: '', 
  name: '', 
  categoryId: '', 
  unit: 'PIECE', 
  price: 0, 
  stockQuantity: 0, 
  hsnCode: '', 
  taxRate: 0, 
  isActive: true
})

const categoryForm = ref({
  name: '', description: ''
})

// Data fetching
const { data: categories, refresh: refreshCategories } = useFetch('/api/categories', {
  default: () => [
    { id: 'c1', name: 'MDF' },
    { id: 'c2', name: 'Plywood' },
    { id: 'c3', name: 'Hardware' }
  ]
})

const { data: products, pending: productsPending, refresh: refreshProducts } = useFetch('/api/products', {
  default: () => [
    { id: '1', sku: 'MDF18W', name: 'MDF 18mm White', categoryId: 'c1', unit: 'SHEET', price: 1850, stockQuantity: 120, isActive: true },
    { id: '2', sku: 'PLY12B', name: 'Plywood 12mm BWR', categoryId: 'c2', unit: 'SHEET', price: 1650, stockQuantity: 8, isActive: true },
    { id: '3', sku: 'HW-HNG01', name: 'Door Hinge SS 4inch', categoryId: 'c3', unit: 'PIECE', price: 180, stockQuantity: 500, isActive: true },
  ]
})

// Computed
const filteredFilterCategories = computed(() => {
  if (!categories.value) return []
  if (!categorySearchQuery.value) return categories.value
  const q = categorySearchQuery.value.toLowerCase()
  return categories.value.filter((c: any) => c.name.toLowerCase().includes(q))
})

const filteredProducts = computed(() => {
  if (!products.value) return []
  let filtered = products.value as any[]
  
  if (selectedCategory.value) {
    filtered = filtered.filter((p: any) => p.categoryId === selectedCategory.value)
  }
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim()
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean)
      filtered = filtered.filter((p: any) => {
        const catName = getCategoryName(p.categoryId)
        const searchableText = `${p.name || ''} ${p.sku || ''} ${p.hsnCode || ''} ${catName || ''}`.toLowerCase()
        return terms.every(term => searchableText.includes(term))
      })
    }
  }
  
  return filtered
})

const totalPages = computed(() => {
  if (pageSize.value === -1) return 1
  return Math.ceil(filteredProducts.value.length / pageSize.value) || 1
})

const paginatedProducts = computed(() => {
  if (pageSize.value === -1) return filteredProducts.value
  const start = (currentPage.value - 1) * pageSize.value
  return filteredProducts.value.slice(start, start + pageSize.value)
})

watch([paginatedProducts, productsPending], () => {
  if (!productsPending.value) {
    triggerRowAnimation()
  }
}, { immediate: false })

const startIndex = computed(() => {
  if (filteredProducts.value.length === 0) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const endIndex = computed(() => {
  if (pageSize.value === -1) return filteredProducts.value.length
  return Math.min(currentPage.value * pageSize.value, filteredProducts.value.length)
})

const getCategoryName = (id: string) => {
  const cat = categories.value?.find((c: any) => c.id === id)
  return cat ? cat.name : 'Unknown'
}

// Methods
const initialProductFormStr = ref('')

const openProductModal = (product: any = null) => {
  if (product) {
    editingProduct.value = product
    productForm.value = {
      sku: product.sku || '',
      name: product.name || '',
      categoryId: product.categoryId || categories.value?.[0]?.id || '',
      unit: product.unit || 'PIECE',
      price: Number(product.price || 0),
      stockQuantity: product.stock !== undefined ? Number(product.stock) : Number(product.stockQuantity || 0),
      hsnCode: product.hsnCode || '',
      taxRate: product.taxRate !== undefined && product.taxRate !== null ? Number(product.taxRate) : 0,
      isActive: product.isActive !== false
    }
  } else {
    editingProduct.value = null
    productForm.value = {
      sku: '',
      name: '',
      categoryId: categories.value?.[0]?.id || '',
      unit: 'PIECE',
      price: 0,
      stockQuantity: 0,
      hsnCode: '',
      taxRate: 0,
      isActive: true
    }
  }
  initialProductFormStr.value = JSON.stringify(productForm.value)
  isProductModalOpen.value = true
  nextTick(() => {
    animateModalOpen(formModalRef.value, formBackdropRef.value, { duration: 0.26 })
  })
}

const closeProductModal = () => {
  isProductModalOpen.value = false
  hide()
}

const saveProduct = async () => {
  if (!productForm.value.sku || !productForm.value.name) return
  isSavingProduct.value = true
  showSaving()
  try {
    const url = editingProduct.value ? `/api/products/${editingProduct.value.id}` : '/api/products'
    const method = editingProduct.value ? 'PATCH' : 'POST'
    await $fetch(url, { method, body: productForm.value })
    await refreshProducts()
    closeProductModal()
    showSaved('Product saved successfully')
  } catch (e) {
    console.error('Failed to save product', e)
    hide()
  } finally {
    isSavingProduct.value = false
  }
}

watch(productForm, () => {
  if (isProductModalOpen.value) {
    if (JSON.stringify(productForm.value) !== initialProductFormStr.value) {
      showEditing('Unsaved product changes', saveProduct, closeProductModal)
    } else {
      hide()
    }
  }
}, { deep: true })

const initialCategoryFormStr = ref('')

const openCategoryModal = () => {
  categoryForm.value = { name: '', description: '' }
  initialCategoryFormStr.value = JSON.stringify(categoryForm.value)
  isCategoryModalOpen.value = true
}

const closeCategoryModal = () => {
  isCategoryModalOpen.value = false
  hide()
}

const saveCategory = async () => {
  if (!categoryForm.value.name) return
  isSavingCategory.value = true
  showSaving()
  try {
    await $fetch('/api/categories', { method: 'POST', body: categoryForm.value })
    await refreshCategories()
    closeCategoryModal()
    showSaved('Category saved successfully')
  } catch (e) {
    console.error('Failed to save category', e)
    hide()
  } finally {
    isSavingCategory.value = false
  }
}

watch(categoryForm, () => {
  if (isCategoryModalOpen.value) {
    if (JSON.stringify(categoryForm.value) !== initialCategoryFormStr.value) {
      showEditing('Unsaved category changes', saveCategory, closeCategoryModal)
    } else {
      hide()
    }
  }
}, { deep: true })

const saveInlineUpdate = async (product: any) => {
  try {
    if (product.isEditingPrice) {
      product.price = product.editPrice
      product.isEditingPrice = false
    }
    if (product.isEditingStock) {
      product.stockQuantity = product.editStock
      product.isEditingStock = false
    }
    // API update call
    await $fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      body: { price: product.price, stock: product.stockQuantity }
    })
  } catch (e) {
    console.error(e)
  }
}
</script>
