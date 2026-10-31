<template>
  <div v-if="user?.role !== 'ADMIN'" class="flex flex-col items-center justify-center h-full pt-20">
    <div class="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 max-w-md text-center">
      <h3 class="text-lg font-bold mb-2">Access Denied</h3>
      <p class="text-sm">You do not have permission to view this page. This area is restricted to administrators only.</p>
    </div>
  </div>

  <div v-else class="space-y-5 sm:space-y-6 md:space-y-8 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold text-[#1a1a1a]">Administration</h2>
        <p class="text-sm text-gray-500 mt-1">Manage system users, roles, and granular page access permissions</p>
      </div>
      <div class="flex items-center gap-2.5">
        <button 
          @click="isSheetTabsModalOpen = true"
          class="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-[#1b3b5f] hover:border-[#1b3b5f]/40 px-3.5 py-2 rounded-lg hover:bg-[#1b3b5f]/5 transition-all shadow-xs text-sm font-medium cursor-pointer"
        >
          <FileSpreadsheet class="w-4 h-4 text-emerald-600" />
          <span>Price List Sheets</span>
        </button>

        <button 
          @click="isMastersModalOpen = true"
          class="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-[#1b3b5f] hover:border-[#1b3b5f]/40 px-3.5 py-2 rounded-lg hover:bg-[#1b3b5f]/5 transition-all shadow-xs text-sm font-medium cursor-pointer"
        >
          <Database class="w-4 h-4 text-[#1b3b5f]" />
          <span>Dropdown Masters</span>
        </button>

        <button 
          @click="openModal()"
          class="flex items-center gap-2 bg-[#1b3b5f] text-white px-4 py-2 rounded-lg hover:bg-[#132c49] transition-colors shadow-sm text-sm font-medium cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>
    </div>

    <!-- Users Table -->
    <div class="bg-white rounded-xl border border-[#e5e2dc] shadow-sm overflow-hidden">
      <div ref="adminTableRef" class="hidden md:block overflow-x-auto no-scrollbar">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Name</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Email</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Role</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Access & Permissions</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Status</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-200 text-sm">
            <tr v-if="pending" class="hover:bg-gray-50">
              <td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading users...</td>
            </tr>
            <tr v-else-if="users?.length === 0" class="hover:bg-gray-50">
              <td colspan="6" class="px-6 py-8 text-center text-gray-500">No users found.</td>
            </tr>
            <tr v-for="u in users" :key="u.id" class="hover:bg-gray-50 transition-colors">
              <!-- Name -->
              <td class="px-6 py-4 font-medium text-[#1a1a1a]">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium shrink-0">
                    {{ u.name.charAt(0) }}
                  </div>
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="truncate">{{ u.name }}</span>
                    <span 
                      v-if="u.id === user?.id" 
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0"
                    >
                      You (Admin)
                    </span>
                  </div>
                </div>
              </td>

              <!-- Email -->
              <td class="px-6 py-4 text-gray-600 font-mono text-xs">{{ u.email }}</td>

              <!-- Role with Dropdown -->
              <td class="px-6 py-4">
                <!-- If self, show protected lock badge to prevent self-demotion -->
                <div 
                  v-if="u.id === user?.id" 
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 shadow-2xs select-none"
                  title="Your Administrator role is protected to prevent accidental system lockout"
                >
                  <ShieldCheck class="w-3.5 h-3.5 text-purple-600" />
                  <span>ADMIN</span>
                  <Lock class="w-3 h-3 text-purple-400 ml-0.5" />
                </div>

                <div v-else class="relative inline-block text-left">
                  <button
                    type="button"
                    @click="activeRoleDropdownUserId = activeRoleDropdownUserId === u.id ? null : u.id"
                    class="text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-200 outline-none cursor-pointer transition-all shadow-xs flex items-center gap-1.5 hover:shadow-sm"
                    :class="getRoleColorClass(u.role)"
                    title="Click to Change Role"
                  >
                    <span>{{ u.role }}</span>
                    <ChevronDown class="w-3 h-3 opacity-70" />
                  </button>

                  <!-- Overlay backdrop -->
                  <div 
                    v-if="activeRoleDropdownUserId === u.id" 
                    @click="activeRoleDropdownUserId = null" 
                    class="fixed inset-0 z-30"
                  ></div>

                  <!-- Dropdown Menu -->
                  <div 
                    v-if="activeRoleDropdownUserId === u.id" 
                    class="absolute left-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-xl z-40 p-1"
                  >
                    <button 
                      v-for="role in ['ADMIN', 'SALES', 'BILLING', 'PACKING', 'DELIVERY']" 
                      :key="role"
                      type="button"
                      @click="changeUserRole(u, role); activeRoleDropdownUserId = null"
                      class="w-full text-left px-2 py-1.5 text-xs font-medium rounded flex items-center justify-between hover:bg-gray-100 transition-colors"
                      :class="u.role === role ? 'font-bold' : 'text-gray-700'"
                    >
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" :class="getRoleColorClass(role)">
                        {{ role }}
                      </span>
                      <Check v-if="u.role === role" class="w-3.5 h-3.5 text-[#1b3b5f]" />
                    </button>
                  </div>
                </div>
              </td>

              <!-- Page Access & Action Permissions Column -->
              <td class="px-6 py-4">
                <div v-if="u.role === 'ADMIN'" class="flex flex-col gap-1">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs w-fit">
                    <ShieldCheck class="w-3.5 h-3.5 text-purple-600" />
                    <span>Full Access (All 13 Modules)</span>
                  </div>
                  <div class="text-[10px] text-purple-700/80 font-medium pl-1">
                    All 5 operations unlocked
                  </div>
                </div>
                <div v-else class="flex flex-col gap-1.5">
                  <button
                    type="button"
                    @click="openModal(u)"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 hover:bg-[#1b3b5f]/5 text-gray-700 hover:text-[#1b3b5f] border border-gray-200 hover:border-[#1b3b5f]/30 transition-all cursor-pointer group shadow-2xs w-fit"
                    title="Click to view and edit page permissions"
                  >
                    <KeyRound class="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1b3b5f] transition-colors" />
                    <span>{{ getEffectiveAllowedPages(u).length }} of {{ APP_PAGES.length - 1 }} pages</span>
                  </button>
                  
                  <div class="flex items-center gap-1 flex-wrap">
                    <span 
                      v-if="getEffectiveActionPermissions(u).canEditOrders"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                      title="Can Edit Orders"
                    >
                      Edit Orders
                    </span>
                    <span 
                      v-if="getEffectiveActionPermissions(u).canEditOrderStatus"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                      title="Can Edit Order Status"
                    >
                      Edit Status
                    </span>
                    <span 
                      v-if="getEffectiveActionPermissions(u).canCancelOrders"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                      title="Can Cancel Orders"
                    >
                      Cancel Orders
                    </span>
                    <span 
                      v-if="getEffectiveActionPermissions(u).canEditCustomers"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                      title="Can Edit Customers"
                    >
                      Edit Customers
                    </span>
                    <span 
                      v-if="getEffectiveActionPermissions(u).canEditProducts"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                      title="Can Edit Products"
                    >
                      Edit Products
                    </span>
                    <span 
                      v-if="getEffectiveActionPermissions(u).canDeleteQuotations"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                      title="Can Delete Quotations"
                    >
                      Delete Quotes
                    </span>
                    <span 
                      v-if="!getEffectiveActionPermissions(u).canEditOrders && !getEffectiveActionPermissions(u).canEditOrderStatus && !getEffectiveActionPermissions(u).canCancelOrders && !getEffectiveActionPermissions(u).canEditCustomers && !getEffectiveActionPermissions(u).canEditProducts && !getEffectiveActionPermissions(u).canDeleteQuotations"
                      class="text-[9px] text-gray-400 italic"
                    >
                      No action permissions
                    </span>
                  </div>
                </div>
              </td>

              <!-- Status Toggle -->
              <td class="px-6 py-4">
                <button 
                  type="button"
                  :disabled="loadingStatusUsers[u.id] || u.id === user?.id"
                  @click.stop="toggleUserStatus(u)"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ease-in-out focus:outline-none p-0.5"
                  :class="[
                    u.id === user?.id ? 'opacity-80 cursor-not-allowed bg-[#1b3b5f]' : (loadingStatusUsers[u.id] ? 'opacity-75 cursor-wait' : 'cursor-pointer'),
                    u.isActive !== false ? 'bg-[#1b3b5f]' : 'bg-gray-300'
                  ]"
                  :title="u.id === user?.id ? 'You cannot deactivate your own account' : (u.isActive !== false ? 'Click to Deactivate' : 'Click to Activate')"
                >
                  <span 
                    class="flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ease-in-out"
                    :class="u.isActive !== false ? 'translate-x-5' : 'translate-x-0'"
                  >
                    <Loader2 v-if="loadingStatusUsers[u.id]" class="w-3 h-3 animate-spin text-[#1b3b5f]" />
                    <Lock v-else-if="u.id === user?.id" class="w-2.5 h-2.5 text-gray-500" />
                  </span>
                </button>
              </td>

              <!-- Actions -->
              <td class="px-6 py-4 text-right">
                <button 
                  @click="openModal(u)"
                  class="inline-flex items-center gap-1.5 text-[#1b3b5f] hover:text-[#132c49] bg-gray-50 hover:bg-[#1b3b5f]/5 px-2.5 py-1 rounded-md border border-gray-200 hover:border-[#1b3b5f]/30 transition-all text-xs font-medium"
                  title="Edit User & Permissions"
                >
                  <Edit2 class="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Floating Horizontal Scrollbar (Desktop only) -->
      <FloatingHorizontalScrollbar :target="adminTableRef" />

      <!-- MOBILE VIEW: High-Density User & Permission Cards (md:hidden) -->
      <div ref="mobileListRef" class="md:hidden divide-y divide-gray-100 bg-white">
        <!-- Skeleton Loading -->
        <template v-if="pending">
          <div v-for="i in 4" :key="'mob-usr-skel-' + i" class="p-3.5 space-y-2 animate-pulse">
            <div class="flex justify-between">
              <div class="h-4 bg-gray-200 rounded w-28"></div>
              <div class="h-4 bg-gray-200 rounded w-16"></div>
            </div>
            <div class="h-3 bg-gray-100 rounded w-40"></div>
            <div class="h-5 bg-gray-100 rounded w-32"></div>
          </div>
        </template>

        <template v-else>
          <div v-if="!users || users.length === 0" class="p-8 text-center text-sm text-gray-500">
            No users found.
          </div>

          <div 
            v-for="u in users" 
            :key="'mob-usr-' + u.id"
            class="p-3.5 space-y-2.5 hover:bg-gray-50/70 transition-colors"
          >
            <!-- Line 1: Avatar, Name, Role & Status Switch -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-xs shrink-0 border border-gray-200">
                  {{ u.name.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm font-bold text-gray-900 truncate">{{ u.name }}</span>
                    <span 
                      v-if="u.id === user?.id" 
                      class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0"
                    >
                      You
                    </span>
                  </div>
                </div>
              </div>

              <!-- Role Badge & Status Switch -->
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded border" :class="getRoleColorClass(u.role)">
                  {{ u.role }}
                </span>
                <button 
                  type="button"
                  :disabled="loadingStatusUsers[u.id] || u.id === user?.id"
                  @click.stop="toggleUserStatus(u)"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ease-in-out focus:outline-none p-0.5 shrink-0"
                  :class="[
                    u.id === user?.id ? 'opacity-80 cursor-not-allowed bg-[#1b3b5f]' : (loadingStatusUsers[u.id] ? 'opacity-75 cursor-wait' : 'cursor-pointer'),
                    u.isActive !== false ? 'bg-[#1b3b5f]' : 'bg-gray-300'
                  ]"
                >
                  <span 
                    class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-150 ease-in-out"
                    :class="u.isActive !== false ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>
            </div>

            <!-- Line 2: Email -->
            <div class="text-xs text-gray-500 font-mono truncate pl-10.5 -mt-1">
              {{ u.email }}
            </div>

            <!-- Line 3: Access & Permissions Pills -->
            <div class="pl-10.5 space-y-1.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <div v-if="u.role === 'ADMIN'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  <ShieldCheck class="w-3 h-3 text-purple-600" />
                  <span>Full Access (All Modules)</span>
                </div>
                <div v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-700 border border-gray-200">
                  <KeyRound class="w-3 h-3 text-gray-400" />
                  <span>{{ getEffectiveAllowedPages(u).length }} pages allowed</span>
                </div>

                <!-- Action Permissions Badges -->
                <span 
                  v-if="getEffectiveActionPermissions(u).canEditOrders"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200"
                >
                  Edit Orders
                </span>
                <span 
                  v-if="getEffectiveActionPermissions(u).canEditOrderStatus"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  Edit Status
                </span>
                <span 
                  v-if="getEffectiveActionPermissions(u).canCancelOrders"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200"
                >
                  Cancel Orders
                </span>
                <span 
                  v-if="getEffectiveActionPermissions(u).canEditCustomers"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  Edit Customers
                </span>
                <span 
                  v-if="getEffectiveActionPermissions(u).canEditProducts"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200"
                >
                  Edit Products
                </span>
                <span 
                  v-if="getEffectiveActionPermissions(u).canDeleteQuotations"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200"
                >
                  Delete Quotes
                </span>
              </div>
            </div>

            <!-- Line 4: Action Button -->
            <div class="flex items-center justify-end gap-2 pt-1.5 border-t border-gray-100">
              <button 
                @click="openModal(u)"
                class="px-3 py-1.5 text-xs font-semibold text-[#1b3b5f] bg-[#1b3b5f]/10 hover:bg-[#1b3b5f]/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 class="w-3 h-3" />
                <span>Edit User & Permissions</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Edit / Add User Modal with Page Access Fields -->
    <Teleport to="body">
      <div v-if="isModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
        
        <!-- Modal Dialog -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[92vh] overflow-hidden flex flex-col border border-gray-100">
          <!-- Header -->
          <div class="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold text-[#1a1a1a] flex items-center gap-2 truncate">
                <ShieldCheck class="w-5 h-5 text-[#1b3b5f] shrink-0" />
                <span>{{ editingUser?.id === user?.id ? 'Edit My Account & Profile' : (editingUser ? 'Edit User & Permissions' : 'Add New User') }}</span>
              </h3>
              <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                {{ editingUser?.id === user?.id ? 'Update your name, email, and password.' : (editingUser ? `Manage account details and page access for ${editingUser.name}` : 'Configure credentials, system role, and accessible pages') }}
              </p>
            </div>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2">
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Scrollable Form Body -->
          <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
            <!-- Basic User Info -->
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Full Name *</label>
                  <input 
                    v-model="form.name" 
                    required 
                    type="text" 
                    placeholder="e.g. Rahul Sharma"
                    class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none text-sm transition-colors" 
                  />
                </div>
                
                <div class="space-y-1">
                  <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Email Address *</label>
                  <input 
                    v-model="form.email" 
                    required 
                    type="email" 
                    placeholder="e.g. rahul@sm.com"
                    class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none text-sm transition-colors" 
                    :disabled="!!editingUser" 
                    :class="editingUser ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''" 
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">
                    Password {{ editingUser ? '(Leave blank to keep unchanged)' : '*' }}
                  </label>
                  <input 
                    v-model="form.password" 
                    :required="!editingUser" 
                    type="password" 
                    placeholder="••••••••"
                    class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#1b3b5f] focus:ring-1 focus:ring-[#1b3b5f] outline-none text-sm transition-colors" 
                  />
                </div>

                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Role *</label>
                    <span v-if="editingUser?.id === user?.id" class="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                      <Lock class="w-2.5 h-2.5" />
                      Protected (Self)
                    </span>
                  </div>

                  <!-- If editing self, lock role to ADMIN -->
                  <div 
                    v-if="editingUser?.id === user?.id" 
                    class="px-3 py-2 bg-purple-50/70 border border-purple-200 rounded-lg text-sm font-semibold text-purple-900 flex items-center justify-between select-none"
                    title="You cannot change your own role to prevent system lockout"
                  >
                    <div class="flex items-center gap-2">
                      <ShieldCheck class="w-4 h-4 text-purple-600" />
                      <span>ADMIN - Full System Access</span>
                    </div>
                    <span class="text-[11px] text-purple-600 font-normal">Cannot demote self</span>
                  </div>

                  <CustomSelect 
                    v-else
                    :modelValue="form.role"
                    @update:modelValue="onRoleChanged"
                    :options="roleOptions"
                    placeholder="Select Role"
                    class="w-full"
                  />
                </div>
              </div>
            </div>

            <!-- Action & Operations Permissions Section -->
            <div class="border-t border-gray-200 pt-5 space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider">Action & Operation Permissions</h4>
                    <span 
                      class="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      :class="form.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-emerald-50 text-[#1b3b5f] border border-emerald-200'"
                    >
                      {{ form.role === 'ADMIN' ? 'All 6 Operations Granted' : `${activeActionCount} of 6 Actions Permitted` }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">
                    {{ form.role === 'ADMIN' ? 'Administrator accounts are automatically granted full permission to edit, delete, and cancel system records.' : 'Control whether this user can see and click Edit for Orders, Order Statuses, Customers, Products, Delete Quotations, or Cancel orders.' }}
                  </p>
                </div>
              </div>

              <!-- Action Checkbox Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <!-- 1. Edit Orders -->
                <div
                  @click="toggleActionPermission('canEditOrders')"
                  class="p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                  :class="[
                    form.role === 'ADMIN' ? 'cursor-not-allowed bg-purple-50/30 border-purple-200' : 'cursor-pointer',
                    form.actionPermissions.canEditOrders 
                      ? 'border-[#1b3b5f] bg-emerald-50/25 text-[#1a1a1a] shadow-2xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                  ]"
                >
                  <div class="mt-0.5 shrink-0">
                    <div 
                      class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      :class="form.actionPermissions.canEditOrders ? 'bg-[#1b3b5f] border-[#1b3b5f] text-white' : 'border-gray-300 bg-white'"
                    >
                      <Check v-if="form.actionPermissions.canEditOrders" class="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold text-gray-900">Edit Orders</span>
                      <span 
                        class="text-[10px] font-semibold px-1.5 py-0.2 rounded"
                        :class="form.actionPermissions.canEditOrders ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ form.actionPermissions.canEditOrders ? 'Granted' : 'Blocked' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Allow modifying items, quantities, prices, delivery address, and notes on orders.
                    </p>
                  </div>
                </div>

                <!-- 2. Edit Order Status -->
                <div
                  @click="toggleActionPermission('canEditOrderStatus')"
                  class="p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                  :class="[
                    form.role === 'ADMIN' ? 'cursor-not-allowed bg-purple-50/30 border-purple-200' : 'cursor-pointer',
                    form.actionPermissions.canEditOrderStatus 
                      ? 'border-indigo-400 bg-indigo-50/25 text-[#1a1a1a] shadow-2xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                  ]"
                >
                  <div class="mt-0.5 shrink-0">
                    <div 
                      class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      :class="form.actionPermissions.canEditOrderStatus ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'"
                    >
                      <Check v-if="form.actionPermissions.canEditOrderStatus" class="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold text-gray-900">Edit Order Status</span>
                      <span 
                        class="text-[10px] font-semibold px-1.5 py-0.2 rounded"
                        :class="form.actionPermissions.canEditOrderStatus ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ form.actionPermissions.canEditOrderStatus ? 'Granted' : 'Blocked' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Allow modifying workflow statuses across departments (Approval, Billing, Packing, Delivery).
                    </p>
                  </div>
                </div>

                <!-- 3. Cancel Orders -->
                <div
                  @click="toggleActionPermission('canCancelOrders')"
                  class="p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                  :class="[
                    form.role === 'ADMIN' ? 'cursor-not-allowed bg-purple-50/30 border-purple-200' : 'cursor-pointer',
                    form.actionPermissions.canCancelOrders 
                      ? 'border-rose-400 bg-rose-50/25 text-[#1a1a1a] shadow-2xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                  ]"
                >
                  <div class="mt-0.5 shrink-0">
                    <div 
                      class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      :class="form.actionPermissions.canCancelOrders ? 'bg-rose-600 border-rose-600 text-white' : 'border-gray-300 bg-white'"
                    >
                      <Check v-if="form.actionPermissions.canCancelOrders" class="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold text-gray-900">Cancel Orders</span>
                      <span 
                        class="text-[10px] font-semibold px-1.5 py-0.2 rounded"
                        :class="form.actionPermissions.canCancelOrders ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ form.actionPermissions.canCancelOrders ? 'Granted' : 'Blocked' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Allow cancelling sales orders with a mandatory recorded cancellation reason.
                    </p>
                  </div>
                </div>

                <!-- 4. Edit Customers -->
                <div
                  @click="toggleActionPermission('canEditCustomers')"
                  class="p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                  :class="[
                    form.role === 'ADMIN' ? 'cursor-not-allowed bg-purple-50/30 border-purple-200' : 'cursor-pointer',
                    form.actionPermissions.canEditCustomers 
                      ? 'border-[#1b3b5f] bg-emerald-50/25 text-[#1a1a1a] shadow-2xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                  ]"
                >
                  <div class="mt-0.5 shrink-0">
                    <div 
                      class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      :class="form.actionPermissions.canEditCustomers ? 'bg-[#1b3b5f] border-[#1b3b5f] text-white' : 'border-gray-300 bg-white'"
                    >
                      <Check v-if="form.actionPermissions.canEditCustomers" class="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold text-gray-900">Edit Customers</span>
                      <span 
                        class="text-[10px] font-semibold px-1.5 py-0.2 rounded"
                        :class="form.actionPermissions.canEditCustomers ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ form.actionPermissions.canEditCustomers ? 'Granted' : 'Blocked' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Allow editing customer profiles, credit terms, contacts, and delivery addresses.
                    </p>
                  </div>
                </div>

                <!-- 5. Edit Products -->
                <div
                  @click="toggleActionPermission('canEditProducts')"
                  class="p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                  :class="[
                    form.role === 'ADMIN' ? 'cursor-not-allowed bg-purple-50/30 border-purple-200' : 'cursor-pointer',
                    form.actionPermissions.canEditProducts 
                      ? 'border-[#1b3b5f] bg-emerald-50/25 text-[#1a1a1a] shadow-2xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                  ]"
                >
                  <div class="mt-0.5 shrink-0">
                    <div 
                      class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      :class="form.actionPermissions.canEditProducts ? 'bg-[#1b3b5f] border-[#1b3b5f] text-white' : 'border-gray-300 bg-white'"
                    >
                      <Check v-if="form.actionPermissions.canEditProducts" class="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold text-gray-900">Edit Products</span>
                      <span 
                        class="text-[10px] font-semibold px-1.5 py-0.2 rounded"
                        :class="form.actionPermissions.canEditProducts ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ form.actionPermissions.canEditProducts ? 'Granted' : 'Blocked' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Allow editing product descriptions, prices, SKUs, tax rates, and stock.
                    </p>
                  </div>
                </div>

                <!-- 6. Delete Quotations -->
                <div
                  @click="toggleActionPermission('canDeleteQuotations')"
                  class="p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                  :class="[
                    form.role === 'ADMIN' ? 'cursor-not-allowed bg-purple-50/30 border-purple-200' : 'cursor-pointer',
                    form.actionPermissions.canDeleteQuotations 
                      ? 'border-rose-500 bg-rose-50/25 text-[#1a1a1a] shadow-2xs' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                  ]"
                >
                  <div class="mt-0.5 shrink-0">
                    <div 
                      class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                      :class="form.actionPermissions.canDeleteQuotations ? 'bg-rose-600 border-rose-600 text-white' : 'border-gray-300 bg-white'"
                    >
                      <Check v-if="form.actionPermissions.canDeleteQuotations" class="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold text-gray-900">Delete Quotations</span>
                      <span 
                        class="text-[10px] font-semibold px-1.5 py-0.2 rounded"
                        :class="form.actionPermissions.canDeleteQuotations ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ form.actionPermissions.canDeleteQuotations ? 'Granted' : 'Blocked' }}
                      </span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Allow permanently deleting saved quotations from the quotation builder and overview list.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page Access Permissions Section -->
            <div class="border-t border-gray-200 pt-5 space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider">Page Access Permissions</h4>
                    <span 
                      class="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      :class="form.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-emerald-50 text-[#1b3b5f] border border-emerald-200'"
                    >
                      {{ form.role === 'ADMIN' ? `All ${APP_PAGES.length} Modules Granted` : `${form.allowedPages.length} of ${availablePagesCount} Selected` }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">
                    {{ form.role === 'ADMIN' ? 'Administrator accounts are automatically granted unrestricted access across all modules to prevent system lockout.' : 'Check the pages this user is allowed to access. Non-selected pages show an "Access Denied" view and are blocked immediately in real time.' }}
                  </p>
                </div>

                <!-- Quick Action Buttons (Only for non-admin roles) -->
                <div v-if="form.role !== 'ADMIN'" class="flex items-center gap-1.5 shrink-0">
                  <button 
                    type="button" 
                    @click="selectAllPages" 
                    class="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Select All
                  </button>
                  <button 
                    type="button" 
                    @click="clearAllPages" 
                    class="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Clear
                  </button>
                  <button 
                    type="button" 
                    @click="applyRoleDefaults" 
                    class="px-2.5 py-1 text-xs font-medium text-[#1b3b5f] hover:bg-[#1b3b5f]/10 bg-[#1b3b5f]/5 border border-[#1b3b5f]/20 rounded-md transition-colors"
                    title="Reset to default pages for this role"
                  >
                    Role Defaults
                  </button>
                </div>
              </div>

              <!-- Admin Role Banner & Guaranteed Access -->
              <div v-if="form.role === 'ADMIN'" class="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                <div class="flex items-start gap-3">
                  <div class="p-2 bg-purple-100 rounded-lg text-purple-700 shrink-0 mt-0.5">
                    <ShieldCheck class="w-5 h-5" />
                  </div>
                  <div class="space-y-1 flex-1">
                    <div class="flex items-center justify-between">
                      <h5 class="text-sm font-bold text-purple-900">Lockout Protected: Permanent Full Access</h5>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800 uppercase tracking-wide">
                        {{ APP_PAGES.length }} of {{ APP_PAGES.length }} Modules
                      </span>
                    </div>
                    <p class="text-xs text-purple-800/80 leading-relaxed">
                      {{ editingUser?.id === user?.id 
                        ? 'To ensure you never get trapped or lose access to critical operations, your administrator account is permanently unlocked across all system areas.' 
                        : 'Administrators retain full administrative rights and cannot be blocked from any workspace modules.' }}
                    </p>
                  </div>
                </div>

                <!-- Granted Module Badges -->
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2 border-t border-purple-200/60">
                  <div 
                    v-for="p in APP_PAGES" 
                    :key="p.key"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/80 border border-purple-200/60 text-[11px] font-medium text-purple-950 shadow-2xs"
                  >
                    <Check class="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[3]" />
                    <span class="truncate">{{ p.label }}</span>
                  </div>
                </div>
              </div>

              <!-- Page Categories & Checkbox Grid (Only for non-admin roles) -->
              <div v-else class="space-y-4">
                <div v-for="cat in pageCategories" :key="cat" class="space-y-2">
                  <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500 px-1">
                    <span class="flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#1b3b5f]"></span>
                      {{ cat }}
                    </span>
                    <span class="text-[10px] font-normal text-gray-400">
                      {{ getSelectedCountForCategory(cat) }} / {{ getPagesForCategory(cat).length }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      v-for="p in getPagesForCategory(cat)"
                      :key="p.key"
                      @click="togglePageAccess(p.key)"
                      class="p-2.5 rounded-lg border text-left transition-all flex items-start gap-2.5 select-none"
                      :class="[
                        isPageDisabled(p.key) ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'cursor-pointer',
                        form.allowedPages.includes(p.key) 
                          ? 'border-[#1b3b5f] bg-emerald-50/25 text-[#1a1a1a] shadow-2xs' 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                      ]"
                    >
                      <div class="mt-0.5 shrink-0">
                        <div 
                          class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                          :class="form.allowedPages.includes(p.key) ? 'bg-[#1b3b5f] border-[#1b3b5f] text-white' : 'border-gray-300 bg-white'"
                        >
                          <Check v-if="form.allowedPages.includes(p.key)" class="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-1">
                          <span class="text-xs font-semibold text-gray-900 truncate">{{ p.label }}</span>
                          <span class="text-[10px] text-gray-400 font-mono shrink-0">{{ p.path }}</span>
                        </div>
                        <p class="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{{ p.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 rounded-b-2xl">
            <span class="text-xs text-gray-500">
              <span class="font-semibold text-gray-800">{{ form.allowedPages.length }}</span> pages &bull; <span class="font-semibold text-gray-800">{{ activeActionCount }}</span> actions permitted
            </span>
            <div class="flex items-center justify-end gap-2.5 sm:gap-3">
              <button 
                @click="closeModal" 
                type="button" 
                class="flex-1 sm:flex-initial text-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                @click="saveUser" 
                :disabled="isSaving" 
                class="flex-1 sm:flex-initial text-center justify-center px-5 py-2 text-sm font-medium text-white bg-[#1b3b5f] rounded-lg hover:bg-[#132c49] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                <span>{{ isSaving ? 'Saving...' : (editingUser ? 'Save Permissions' : 'Create User') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Dropdown Masters Modal -->
    <AdminMastersModal :isOpen="isMastersModalOpen" @close="isMastersModalOpen = false" />

    <!-- Google Sheet Price List Tabs Modal -->
    <AdminSheetTabsModal :isOpen="isSheetTabsModalOpen" @close="isSheetTabsModalOpen = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { 
  Plus, 
  Edit2, 
  X, 
  Loader2, 
  ChevronDown, 
  Check, 
  ShieldCheck, 
  KeyRound,
  Lock,
  Database,
  FileSpreadsheet
} from 'lucide-vue-next'
import AdminMastersModal from '~/components/dashboard/AdminMastersModal.vue'
import AdminSheetTabsModal from '~/components/dashboard/AdminSheetTabsModal.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import FloatingHorizontalScrollbar from '~/components/ui/FloatingHorizontalScrollbar.vue'
import { 
  APP_PAGES, 
  DEFAULT_ROLE_PAGES, 
  DEFAULT_ROLE_ACTION_PERMISSIONS,
  getEffectiveAllowedPages,
  getEffectiveActionPermissions,
} from '~/utils/permissions'
import type { UserRole, UserActionPermissions } from '~/types'

definePageMeta({ layout: 'dashboard' })

const { user } = useAuth()
const { showSaving, showSaved, showEditing } = useSnackbar()
const { animateStagger } = useGsapAnimation()
const { notifyChange, onOrderSync } = useRealtimeSync()

const activeRoleDropdownUserId = ref<string | null>(null)

// Realtime multi-device sync for users and admin management
onOrderSync((event) => {
  if (
    event?.type === 'DB_USER_CHANGE' || 
    event?.type === 'USER_CHANGE' || 
    event?.action === 'USER_UPDATED' ||
    event?.action === 'USER_PERMISSIONS_UPDATED'
  ) {
    refresh()
  }
})

const roleOptions = [
  { label: 'ADMIN - Full System Access', value: 'ADMIN' },
  { label: 'SALES - Orders & Customers', value: 'SALES' },
  { label: 'BILLING - Invoicing & Finance', value: 'BILLING' },
  { label: 'PACKING - Warehouse & Dispatch', value: 'PACKING' },
  { label: 'DELIVERY - Driver App & Trips', value: 'DELIVERY' }
]

const pageCategories = ['Dashboard', 'Operations', 'Data', 'Administration'] as const

// State
const adminTableRef = ref<HTMLElement | null>(null)
const mobileListRef = ref<HTMLElement | null>(null)
const isModalOpen = ref(false)
const isMastersModalOpen = ref(false)
const isSheetTabsModalOpen = ref(false)
const isSaving = ref(false)
const editingUser = ref<any>(null)
const loadingStatusUsers = ref<Record<string, boolean>>({})
const tbodyRef = ref<HTMLElement | null>(null)

// Form data
const form = ref<{
  name: string
  email: string
  password: string
  role: UserRole
  isActive: boolean
  allowedPages: string[]
  actionPermissions: UserActionPermissions
}>({
  name: '',
  email: '',
  password: '',
  role: 'SALES',
  isActive: true,
  allowedPages: [],
  actionPermissions: {
    canEditOrders: false,
    canEditOrderStatus: false,
    canCancelOrders: false,
    canEditCustomers: false,
    canEditProducts: false,
    canDeleteQuotations: false,
  }
})

// Fetch real data with forwarded auth cookies
const headers = useRequestHeaders(['cookie'])
const { data: users, pending, refresh } = useFetch<any[]>('/api/users', {
  headers
})

const triggerRowAnimation = () => {
  nextTick(() => {
    if (tbodyRef.value && !pending.value) {
      const rows = tbodyRef.value.querySelectorAll('tr')
      const targetRows = Array.from(rows).slice(0, 15)
      animateStagger(targetRows, { duration: 0.18, stagger: 0.015, y: 4 })
    }
    if (mobileListRef.value && !pending.value) {
      const cards = Array.from(mobileListRef.value.children).slice(0, 15)
      animateStagger(cards, { duration: 0.18, stagger: 0.015, y: 4 })
    }
  })
}

watch([users, pending], () => {
  triggerRowAnimation()
}, { immediate: false })

onMounted(() => {
  triggerRowAnimation()
})

// Action Permissions helpers
const activeActionCount = computed(() => {
  if (form.value.role === 'ADMIN') return 6
  const a = form.value.actionPermissions
  return (a.canEditOrders ? 1 : 0) + 
         (a.canEditOrderStatus ? 1 : 0) + 
         (a.canCancelOrders ? 1 : 0) + 
         (a.canEditCustomers ? 1 : 0) + 
         (a.canEditProducts ? 1 : 0) + 
         (a.canDeleteQuotations ? 1 : 0)
})

const toggleActionPermission = (key: keyof UserActionPermissions) => {
  if (form.value.role === 'ADMIN') return
  form.value.actionPermissions[key] = !form.value.actionPermissions[key]
}

// Page Access helpers
const availablePagesCount = computed(() => {
  return form.value.role === 'ADMIN' ? APP_PAGES.length : APP_PAGES.length - 1
})

const getPagesForCategory = (cat: string) => {
  return APP_PAGES.filter(p => p.category === cat)
}

const getSelectedCountForCategory = (cat: string) => {
  return form.value.allowedPages.filter(key => {
    const p = APP_PAGES.find(item => item.key === key)
    return p?.category === cat
  }).length
}

const isPageDisabled = (key: string) => {
  if (form.value.role === 'ADMIN') return true
  if (key === 'ADMIN') return true
  return false
}

const togglePageAccess = (key: string) => {
  if (isPageDisabled(key)) return
  const idx = form.value.allowedPages.indexOf(key)
  if (idx >= 0) {
    form.value.allowedPages.splice(idx, 1)
  } else {
    form.value.allowedPages.push(key)
  }
}

const selectAllPages = () => {
  if (form.value.role === 'ADMIN') return
  form.value.allowedPages = APP_PAGES
    .filter(p => p.key !== 'ADMIN')
    .map(p => p.key)
}

const clearAllPages = () => {
  if (form.value.role === 'ADMIN') return
  form.value.allowedPages = []
}

const applyRoleDefaults = () => {
  if (form.value.role === 'ADMIN') return
  const role = form.value.role || 'SALES'
  const defaults = DEFAULT_ROLE_PAGES[role] || []
  form.value.allowedPages = [...defaults]
}

const onRoleChanged = (newRole: any) => {
  if (editingUser.value?.id === user.value?.id) {
    return // Prevent self-demotion
  }
  form.value.role = newRole
  if (newRole === 'ADMIN') {
    form.value.allowedPages = APP_PAGES.map(p => p.key)
    form.value.actionPermissions = {
      canEditOrders: true,
      canEditOrderStatus: true,
      canCancelOrders: true,
      canEditCustomers: true,
      canEditProducts: true,
      canDeleteQuotations: true,
    }
  } else {
    form.value.allowedPages = form.value.allowedPages.filter(k => k !== 'ADMIN')
    if (form.value.allowedPages.length === 0) {
      form.value.allowedPages = [...(DEFAULT_ROLE_PAGES[newRole as UserRole] || [])]
    }
    const defaultActions = DEFAULT_ROLE_ACTION_PERMISSIONS[newRole as UserRole] || {
      canEditOrders: false,
      canEditOrderStatus: false,
      canCancelOrders: false,
      canEditCustomers: false,
      canEditProducts: false,
      canDeleteQuotations: false,
    }
    form.value.actionPermissions = { ...defaultActions }
  }
}

// Methods
const getRoleColorClass = (role: string) => {
  switch (role) {
    case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'SALES': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'BILLING': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'PACKING': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'DELIVERY': return 'bg-green-100 text-green-700 border-green-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const toggleUserStatus = async (userToToggle: any) => {
  if (userToToggle.id === user.value?.id) {
    showEditing('You cannot deactivate your own account.')
    return
  }
  if (loadingStatusUsers.value[userToToggle.id]) return
  loadingStatusUsers.value[userToToggle.id] = true
  
  const targetState = !userToToggle.isActive
  showSaving(`Updating ${userToToggle.name}'s status...`)

  try {
    await $fetch(`/api/users/${userToToggle.id}`, {
      method: 'PATCH',
      body: { isActive: targetState }
    })
    userToToggle.isActive = targetState
    if (users.value) {
      users.value = [...users.value]
    }
    notifyChange({ type: 'USER_CHANGE', action: 'USER_UPDATED', userId: userToToggle.id })
    showSaved(`${userToToggle.name} is now ${targetState ? 'Active' : 'Inactive'}`)
  } catch (e: any) {
    console.error('Failed to toggle status', e)
    showEditing(`Failed: ${e.data?.statusMessage || 'Could not update user status'}`)
  } finally {
    loadingStatusUsers.value[userToToggle.id] = false
  }
}

const changeUserRole = async (userToUpdate: any, newRole: string) => {
  if (userToUpdate.id === user.value?.id) {
    showEditing('You cannot change your own role from Administrator to avoid system lockout.')
    return
  }
  const previousRole = userToUpdate.role
  const previousAllowed = userToUpdate.allowedPages
  userToUpdate.role = newRole
  const newDefaults = DEFAULT_ROLE_PAGES[newRole as UserRole] || []
  userToUpdate.allowedPages = newDefaults
  if (users.value) {
    users.value = [...users.value]
  }
  showSaving(`Updating ${userToUpdate.name}'s role to ${newRole}...`)

  try {
    await $fetch(`/api/users/${userToUpdate.id}`, {
      method: 'PATCH',
      body: { role: newRole, allowedPages: newDefaults }
    })
    notifyChange({ 
      type: 'USER_CHANGE', 
      action: 'USER_PERMISSIONS_UPDATED', 
      userId: userToUpdate.id,
      allowedPages: newDefaults 
    })
    showSaved(`${userToUpdate.name}'s role updated to ${newRole}`)
  } catch (e: any) {
    console.error('Failed to update role', e)
    userToUpdate.role = previousRole
    userToUpdate.allowedPages = previousAllowed
    if (users.value) {
      users.value = [...users.value]
    }
    showEditing(`Failed: ${e.data?.statusMessage || 'Could not update role'}`)
  }
}

const openModal = (u: any = null) => {
  if (u) {
    editingUser.value = u
    const effective = getEffectiveAllowedPages(u)
    const effectiveActions = getEffectiveActionPermissions(u)
    form.value = {
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive !== false,
      allowedPages: u.role === 'ADMIN' ? APP_PAGES.map(p => p.key) : [...effective],
      actionPermissions: u.role === 'ADMIN' 
        ? { canEditOrders: true, canEditOrderStatus: true, canCancelOrders: true, canEditCustomers: true, canEditProducts: true, canDeleteQuotations: true }
        : { ...effectiveActions }
    }
  } else {
    editingUser.value = null
    const defaultPages = DEFAULT_ROLE_PAGES.SALES || []
    const defaultActions = DEFAULT_ROLE_ACTION_PERMISSIONS.SALES || {
      canEditOrders: true,
      canEditOrderStatus: false,
      canCancelOrders: false,
      canEditCustomers: true,
      canEditProducts: false,
      canDeleteQuotations: false,
    }
    form.value = {
      name: '',
      email: '',
      password: '',
      role: 'SALES',
      isActive: true,
      allowedPages: [...defaultPages],
      actionPermissions: { ...defaultActions }
    }
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  editingUser.value = null
}

const saveUser = async () => {
  if (!form.value.name || !form.value.email) return
  if (!editingUser.value && !form.value.password) return
  
  // Guard against self-demotion
  if (editingUser.value?.id === user.value?.id) {
    form.value.role = 'ADMIN'
  }

  isSaving.value = true
  showSaving(editingUser.value ? `Updating ${form.value.name}...` : 'Creating user...')

  const allowedPagesToSave = form.value.role === 'ADMIN'
    ? APP_PAGES.map(p => p.key)
    : (form.value.allowedPages.length === 0 ? ['NONE'] : form.value.allowedPages)

  const actionPermissionsToSave = form.value.role === 'ADMIN'
    ? {
        canEditOrders: true,
        canEditOrderStatus: true,
        canCancelOrders: true,
        canEditCustomers: true,
        canEditProducts: true,
        canDeleteQuotations: true,
      }
    : { ...form.value.actionPermissions }

  try {
    if (editingUser.value) {
      await $fetch(`/api/users/${editingUser.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.value.name,
          role: form.value.role,
          email: form.value.email,
          password: form.value.password || undefined,
          allowedPages: allowedPagesToSave,
          actionPermissions: actionPermissionsToSave,
        }
      })
      showSaved(`${form.value.name} updated successfully`)
      notifyChange({ 
        type: 'USER_CHANGE', 
        action: 'USER_PERMISSIONS_UPDATED', 
        userId: editingUser.value.id,
        allowedPages: allowedPagesToSave,
        actionPermissions: actionPermissionsToSave
      })
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: {
          name: form.value.name,
          email: form.value.email,
          password: form.value.password,
          role: form.value.role,
          allowedPages: allowedPagesToSave,
          actionPermissions: actionPermissionsToSave,
        }
      })
      showSaved(`User ${form.value.name} created successfully`)
      notifyChange({ type: 'USER_CHANGE', action: 'USER_UPDATED' })
    }
    
    await refresh()
    closeModal()
  } catch (e: any) {
    console.error('Failed to save user', e)
    showEditing(`Error: ${e.data?.statusMessage || 'Could not save user'}`)
  } finally {
    isSaving.value = false
  }
}
</script>
