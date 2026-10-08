<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { X, Plus, Trash2, Zap, MapPin, UserCheck, ShieldAlert, Award, FileText } from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { useSnackbar } from '~/composables/useSnackbar'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()
const { showSaving, showSaved, hide } = useSnackbar()

const form = ref({
  customerId: '',
  deliveryAddressId: '',
  deliveryAddress: '',
  paymentTerms: '',
  notes: '',
  isUrgent: false,
  items: [] as Array<{ 
    productId: string
    productSku?: string
    quantity: number
    unitPrice: number
    isTaxInclusive: boolean
    applyLastPrice: boolean
    itemNotes: string
  }>
})

const { data: customers } = await useFetch('/api/customers')
const { data: products } = await useFetch('/api/products')

const selectedCustomer = computed(() => {
  return (customers.value as any[] || []).find(c => c.id === form.value.customerId)
})

const customerOptions = computed(() => {
  return (customers.value as any[] || []).map(c => ({
    label: `${c.customerCode ? `[${c.customerCode}] ` : ''}${c.name} ${c.company ? `(${c.company})` : ''}`,
    value: c.id,
    subtitle: c.city ? `${c.city} • ${c.phone}` : c.phone
  }))
})

const addressOptions = computed(() => {
  if (!selectedCustomer.value?.addresses?.length) {
    if (selectedCustomer.value?.address || selectedCustomer.value?.city) {
      return [{
        label: 'Default Address',
        value: 'default',
        addressLine: [selectedCustomer.value.address, selectedCustomer.value.city, selectedCustomer.value.state].filter(Boolean).join(', ')
      }]
    }
    return []
  }
  return selectedCustomer.value.addresses.map((addr: any) => ({
    label: `${addr.label}${addr.isDefault ? ' (Default)' : ''}`,
    value: addr.id,
    addressLine: [addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
  }))
})

const productOptions = computed(() => {
  return (products.value as any[] || []).map(p => ({
    label: `${p.sku} - ${p.name} (Stock: ${p.stock})`,
    value: p.id,
    subtitle: p.hsnCode ? `HSN: ${p.hsnCode}` : ''
  }))
})

const onCustomerChange = () => {
  const c = selectedCustomer.value
  if (c) {
    form.value.paymentTerms = c.paymentTerms || 'Net 30'
    
    // Auto-select default address if available
    if (c.addresses && c.addresses.length > 0) {
      const defaultAddr = c.addresses.find((a: any) => a.isDefault) || c.addresses[0]
      form.value.deliveryAddressId = defaultAddr.id
      form.value.deliveryAddress = [defaultAddr.addressLine, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(', ')
    } else {
      const fullAddress = [c.address, c.city, c.state].filter(Boolean).join(', ')
      form.value.deliveryAddressId = ''
      form.value.deliveryAddress = `${fullAddress}${c.pincode ? ' - ' + c.pincode : ''}`
    }
  }
}

const onAddressSelect = (addrId: string) => {
  form.value.deliveryAddressId = addrId
  const chosen = addressOptions.value.find((a: any) => a.value === addrId)
  if (chosen) {
    form.value.deliveryAddress = chosen.addressLine
  }
}

const addItem = () => {
  form.value.items.push({ 
    productId: '', 
    quantity: 1, 
    unitPrice: 0,
    isTaxInclusive: false,
    applyLastPrice: false,
    itemNotes: ''
  })
}

const removeItem = (index: number) => {
  form.value.items.splice(index, 1)
}

const onProductChange = (index: number) => {
  const item = form.value.items[index]
  const p = (products.value as any[])?.find((p: any) => p.id === item.productId)
  if (p) {
    item.unitPrice = Number(p.price) || 0
    item.productSku = p.sku || ''
  }
}

const totalAmount = computed(() => {
  return form.value.items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0)
})

const submitOrder = async () => {
  if (!form.value.customerId) {
    alert('Please select a customer')
    return
  }
  if (!form.value.items.length) {
    alert('Please add at least one product')
    return
  }

  showSaving()
  try {
    const res = await $fetch<any>('/api/orders', {
      method: 'POST',
      body: form.value
    })
    const { notifyChange } = useRealtimeSync()
    notifyChange({ orderId: res?.id, action: 'ORDER_CREATED' })
    showSaved('Order created successfully')
    router.push('/dashboard/orders')
  } catch (err: any) {
    console.error(err)
    showSaved(err.data?.message || 'Failed to create order')
  }
}

const getPrivilegeColor = (tier: string) => {
  switch (tier) {
    case 'GOLD': return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'SILVER': return 'bg-slate-100 text-slate-800 border-slate-300'
    default: return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6 pb-12">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Create New Order</h1>
        <p class="text-xs text-gray-500 mt-1">Capture customer requirements, choose delivery destinations, and specify rates.</p>
      </div>
      
      <!-- Urgent Order Toggle Header -->
      <label class="flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer select-none transition-all shadow-xs"
        :class="form.isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
      >
        <input type="checkbox" v-model="form.isUrgent" class="w-4 h-4 text-rose-600 rounded focus:ring-rose-500" />
        <div class="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
          <Zap class="w-4 h-4 text-rose-600" />
          <span>⚡ Mark as Urgent Order</span>
        </div>
      </label>
    </div>

    <form @submit.prevent="submitOrder" class="space-y-6">
      
      <!-- Section 1: Customer Profile & Order Info -->
      <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4 flex items-center justify-between">
          <span>Customer & Fulfillment Details</span>
          <span v-if="selectedCustomer" class="text-xs font-normal normal-case text-gray-500">
            Code: <strong class="text-gray-800">{{ selectedCustomer.customerCode || 'N/A' }}</strong>
          </span>
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Customer Picker -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer *</label>
            <CustomSelect 
              :modelValue="form.customerId"
              @update:modelValue="val => { form.customerId = val; onCustomerChange() }"
              :options="customerOptions"
              searchable
              searchPlaceholder="Search customers by name, code, company..."
              placeholder="Select Customer"
              class="w-full"
            />

            <!-- Selected Customer Info Banner -->
            <div v-if="selectedCustomer" class="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-900">{{ selectedCustomer.name }}</span>
                <span v-if="selectedCustomer.company" class="text-gray-500">({{ selectedCustomer.company }})</span>
                <span 
                  class="text-[10px] px-2 py-0.5 rounded font-bold uppercase border"
                  :class="getPrivilegeColor(selectedCustomer.privilegeTier || 'BRONZE')"
                >
                  {{ selectedCustomer.privilegeTier || 'BRONZE' }} TIER
                </span>
                <span v-if="selectedCustomer.isPriorityClient" class="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ★ PRIORITY CLIENT
                </span>
              </div>

              <!-- Customer Manager Pill -->
              <div v-if="selectedCustomer.customerManager" class="flex items-center gap-1.5 text-gray-600 bg-white px-2.5 py-1 rounded border border-gray-200">
                <UserCheck class="w-3.5 h-3.5 text-[#1a5c4c]" />
                <span>Account Manager: <strong class="text-gray-900">{{ selectedCustomer.customerManager.name }}</strong></span>
              </div>
            </div>
          </div>
          
          <!-- Placed By -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Created By</label>
            <input :value="user?.name || 'Unknown'" disabled class="w-full text-sm border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed" />
          </div>
          
          <!-- Payment Terms -->
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Terms</label>
            <CustomSelect 
              :modelValue="form.paymentTerms"
              @update:modelValue="val => form.paymentTerms = val"
              :options="[
                {label: 'Net 30', value: 'Net 30'},
                {label: 'Net 15', value: 'Net 15'},
                {label: 'Net 45', value: 'Net 45'},
                {label: 'Net 60', value: 'Net 60'},
                {label: 'Due on Receipt', value: 'Due on Receipt'},
                {label: 'Advanced Payment', value: 'Advanced Payment'},
                {label: 'Cash on Delivery (COD)', value: 'COD'}
              ]"
              placeholder="Select Terms"
              class="w-full"
            />
          </div>
          
          <!-- Registered Address Picker Dropdown -->
          <div v-if="addressOptions.length > 1" class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select Registered Destination Address
            </label>
            <CustomSelect 
              :modelValue="form.deliveryAddressId"
              @update:modelValue="onAddressSelect"
              :options="addressOptions"
              placeholder="Choose destination address..."
              class="w-full"
            />
          </div>

          <!-- Delivery Address Textarea -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery Address (Site / Destination) *</label>
            <textarea v-model="form.deliveryAddress" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none" required placeholder="Enter delivery address, godown name, or landmark..."></textarea>
          </div>

          <!-- Internal Order Notes -->
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Internal Order Instructions / Dispatch Notes</label>
            <textarea v-model="form.notes" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none" placeholder="e.g. Call client 30 mins before arrival, deliver only between 10am-2pm, verify site unloading clearance..."></textarea>
          </div>
        </div>
      </div>

      <!-- Section 2: Items -->
      <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
          <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider">Order Items</h3>
          <button type="button" @click="addItem" class="text-xs font-bold text-[#1a5c4c] flex items-center gap-1 hover:underline">
            <Plus class="w-3 h-3" /> Add Product
          </button>
        </div>

        <div class="space-y-4">
          <div v-for="(item, idx) in form.items" :key="idx" class="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-3">
            <div class="flex flex-wrap md:flex-nowrap gap-4 items-end">
              <!-- Product Select -->
              <div class="flex-1 w-full min-w-0">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Product *</label>
                <CustomSelect 
                  :modelValue="item.productId"
                  @update:modelValue="val => { item.productId = val; onProductChange(idx) }"
                  :options="productOptions"
                  searchable
                  searchPlaceholder="Search product or HSN..."
                  placeholder="Select Product"
                  class="w-full"
                />
              </div>

              <!-- Qty -->
              <div class="w-full md:w-24 shrink-0">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Qty *</label>
                <input type="number" v-model.number="item.quantity" min="1" required class="w-full border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
              </div>

              <!-- Unit Price -->
              <div class="w-full md:w-28 shrink-0">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Rate (₹) *</label>
                <input type="number" v-model.number="item.unitPrice" min="0" step="0.01" required class="w-full border border-gray-300 rounded-lg shadow-xs p-2 bg-white text-sm font-bold focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
              </div>

              <!-- Line Total -->
              <div class="w-full md:w-28 shrink-0">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Subtotal</label>
                <div class="p-2 bg-white text-gray-900 rounded-lg font-bold text-sm border border-gray-200">
                  {{ formatCurrency(item.quantity * item.unitPrice) }}
                </div>
              </div>

              <!-- Remove -->
              <button type="button" @click="removeItem(idx)" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0 transition-colors" title="Remove Item">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>

            <!-- Item-Level Options & Notes -->
            <div class="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200/60 text-xs">
              <!-- Tax Inclusive Toggle -->
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="item.isTaxInclusive" class="w-3.5 h-3.5 rounded text-[#1a5c4c] focus:ring-[#1a5c4c]" />
                <span class="text-gray-700 font-medium">Tax Inclusive Rate</span>
              </label>

              <!-- Apply Last Price Checkbox -->
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" v-model="item.applyLastPrice" class="w-3.5 h-3.5 rounded text-[#1a5c4c] focus:ring-[#1a5c4c]" />
                <span class="text-gray-700 font-medium">Apply Last Price</span>
              </label>

              <!-- Item Notes Input -->
              <div class="flex-1 min-w-[200px]">
                <input 
                  type="text" 
                  v-model="item.itemNotes" 
                  placeholder="Optional item note: e.g. 10% rate agreed, custom edge-banding..."
                  class="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-[#1a5c4c]"
                />
              </div>
            </div>
          </div>

          <div v-if="!form.items.length" class="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            No products added yet. Click "Add Product" to begin.
          </div>
        </div>

        <div class="flex justify-end pt-4 border-t border-gray-100 mt-6">
          <div class="text-right">
            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Total Amount</span>
            <p class="text-3xl font-bold text-[#1a5c4c]">{{ formatCurrency(totalAmount) }}</p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4">
        <NuxtLink to="/dashboard/orders" class="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
          Cancel
        </NuxtLink>
        <button type="submit" :disabled="!form.items.length" class="px-6 py-2.5 bg-[#1a5c4c] text-white text-sm font-bold rounded-lg hover:bg-[#1a5c4c]/90 disabled:opacity-50 transition-colors shadow-sm">
          Submit Order
        </button>
      </div>

    </form>
  </div>
</template>
