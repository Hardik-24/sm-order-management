<template>
  <div v-if="user?.role !== 'ADMIN'" class="flex flex-col items-center justify-center h-full pt-20">
    <div class="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 max-w-md text-center">
      <h3 class="text-lg font-bold mb-2">Access Denied</h3>
      <p class="text-sm">You do not have permission to view this page. This area is restricted to administrators only.</p>
    </div>
  </div>

  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold text-[#1a1a1a]">Administration</h2>
        <p class="text-sm text-gray-500 mt-1">Manage system users, roles, and access</p>
      </div>
      <button 
        @click="openModal()"
        class="flex items-center gap-2 bg-[#1a5c4c] text-white px-4 py-2 rounded-lg hover:bg-[#134336] transition-colors shadow-sm"
      >
        <Plus class="w-4 h-4" />
        Add User
      </button>
    </div>

    <!-- Users Table -->
    <div class="bg-white rounded-xl border border-[#e5e2dc] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Name</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Email</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Role</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Status</th>
              <th class="px-6 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody ref="tbodyRef" class="divide-y divide-gray-200 text-sm">
            <tr v-if="pending" class="hover:bg-gray-50">
              <td colspan="5" class="px-6 py-8 text-center text-gray-500">Loading users...</td>
            </tr>
            <tr v-else-if="users?.length === 0" class="hover:bg-gray-50">
              <td colspan="5" class="px-6 py-8 text-center text-gray-500">No users found.</td>
            </tr>
            <tr v-for="u in users" :key="u.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 font-medium text-[#1a1a1a]">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                    {{ u.name.charAt(0) }}
                  </div>
                  {{ u.name }}
                </div>
              </td>
              <td class="px-6 py-4 text-gray-600">{{ u.email }}</td>
              <td class="px-6 py-4">
                <select 
                  :value="u.role" 
                  @change="changeUserRole(u, ($event.target as HTMLSelectElement).value)"
                  class="text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-200 outline-none cursor-pointer transition-colors shadow-sm focus:ring-1 focus:ring-[#1a5c4c]"
                  :class="getRoleColorClass(u.role)"
                  title="Click to Change Role"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="SALES">SALES</option>
                  <option value="BILLING">BILLING</option>
                  <option value="PACKING">PACKING</option>
                  <option value="DELIVERY">DELIVERY</option>
                </select>
              </td>
              <td class="px-6 py-4">
                <button 
                  type="button"
                  :disabled="loadingStatusUsers[u.id]"
                  @click.stop="toggleUserStatus(u)"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ease-in-out focus:outline-none cursor-pointer p-0.5 disabled:opacity-75 disabled:cursor-wait"
                  :class="u.isActive !== false ? 'bg-[#1a5c4c]' : 'bg-gray-300'"
                  :title="u.isActive !== false ? 'Click to Deactivate' : 'Click to Activate'"
                >
                  <span 
                    class="flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ease-in-out"
                    :class="u.isActive !== false ? 'translate-x-5' : 'translate-x-0'"
                  >
                    <Loader2 v-if="loadingStatusUsers[u.id]" class="w-3 h-3 animate-spin text-[#1a5c4c]" />
                  </span>
                </button>
              </td>
              <td class="px-6 py-4 text-right">
                <button 
                  @click="openModal(u)"
                  class="text-[#1a5c4c] hover:text-[#4ecdc4] transition-colors p-1"
                  title="Edit User"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal"></div>
      
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-[#1a1a1a]">
            {{ editingUser ? 'Edit User' : 'Add New User' }}
          </h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1">
          <form @submit.prevent="saveUser" class="space-y-4">
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Full Name *</label>
              <input v-model="form.name" required type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>
            
            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Email Address *</label>
              <input v-model="form.email" required type="email" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" :disabled="!!editingUser" :class="editingUser ? 'bg-gray-50' : ''" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">
                Password {{ editingUser ? '(Leave blank to keep unchanged)' : '*' }}
              </label>
              <input v-model="form.password" :required="!editingUser" type="password" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] outline-none text-sm" />
            </div>

            <div class="space-y-1">
              <label class="block text-[10px] font-medium text-gray-500 uppercase tracking-widest">Role *</label>
              <CustomSelect 
                :modelValue="form.role"
                @update:modelValue="val => form.role = val"
                :options="roleOptions"
                placeholder="Select Role"
                class="w-full"
              />
            </div>
          </form>
        </div>
        
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
          <button @click="closeModal" type="button" class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button @click="saveUser" :disabled="isSaving" class="px-4 py-2 text-sm font-medium text-white bg-[#1a5c4c] rounded-lg hover:bg-[#134336] transition-colors disabled:opacity-50 flex items-center gap-2">
            <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
            {{ isSaving ? 'Saving...' : 'Save User' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { Plus, Edit2, X, Loader2 } from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'
import { useGsapAnimation } from '~/composables/useGsapAnimation'
import CustomSelect from '~/components/ui/CustomSelect.vue'

definePageMeta({ layout: 'dashboard' })

// Mock Auth
const { user } = useAuth()
const { showSaving, showSaved, showEditing } = useSnackbar()
const { animateStagger } = useGsapAnimation()

const roleOptions = [
  { label: 'ADMIN - Full System Access', value: 'ADMIN' },
  { label: 'SALES - Orders & Customers', value: 'SALES' },
  { label: 'BILLING - Invoicing & Finance', value: 'BILLING' },
  { label: 'PACKING - Warehouse & Dispatch', value: 'PACKING' },
  { label: 'DELIVERY - Driver App & Trips', value: 'DELIVERY' }
]

// State
const isModalOpen = ref(false)
const isSaving = ref(false)
const editingUser = ref<any>(null)
const loadingStatusUsers = ref<Record<string, boolean>>({})
const tbodyRef = ref<HTMLElement | null>(null)

// Form data
const form = ref({
  name: '',
  email: '',
  password: '',
  role: 'SALES',
  isActive: true
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
  })
}

watch([users, pending], () => {
  triggerRowAnimation()
}, { immediate: false })

onMounted(() => {
  triggerRowAnimation()
})

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
    showSaved(`${userToToggle.name} is now ${targetState ? 'Active' : 'Inactive'}`)
  } catch (e: any) {
    console.error('Failed to toggle status', e)
    showEditing(`Failed: ${e.data?.statusMessage || 'Could not update user status'}`)
  } finally {
    loadingStatusUsers.value[userToToggle.id] = false
  }
}

const changeUserRole = async (userToUpdate: any, newRole: string) => {
  const previousRole = userToUpdate.role
  userToUpdate.role = newRole
  if (users.value) {
    users.value = [...users.value]
  }
  showSaving(`Updating ${userToUpdate.name}'s role to ${newRole}...`)

  try {
    await $fetch(`/api/users/${userToUpdate.id}`, {
      method: 'PATCH',
      body: { role: newRole }
    })
    showSaved(`${userToUpdate.name}'s role updated to ${newRole}`)
  } catch (e: any) {
    console.error('Failed to update role', e)
    userToUpdate.role = previousRole
    if (users.value) {
      users.value = [...users.value]
    }
    showEditing(`Failed: ${e.data?.statusMessage || 'Could not update role'}`)
  }
}

const openModal = (u: any = null) => {
  if (u) {
    editingUser.value = u
    form.value = { ...u, password: '' }
  } else {
    editingUser.value = null
    form.value = { name: '', email: '', password: '', role: 'SALES', isActive: true }
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
  
  isSaving.value = true
  showSaving(editingUser.value ? `Updating ${form.value.name}...` : 'Creating user...')

  try {
    if (editingUser.value) {
      await $fetch(`/api/users/${editingUser.value.id}`, {
        method: 'PATCH',
        body: {
          name: form.value.name,
          role: form.value.role,
          email: form.value.email,
          password: form.value.password || undefined
        }
      })
      showSaved(`${form.value.name} updated successfully`)
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: {
          name: form.value.name,
          email: form.value.email,
          password: form.value.password,
          role: form.value.role
        }
      })
      showSaved(`User ${form.value.name} created successfully`)
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
