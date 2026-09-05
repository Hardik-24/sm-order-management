<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { X, Plus, Trash2 } from 'lucide-vue-next'
import { formatCurrency } from '~/lib/utils'
import CustomSelect from '~/components/ui/CustomSelect.vue'
import { useSnackbar } from '~/composables/useSnackbar'

definePageMeta({ layout: 'dashboard' })

const router = useRouter()
const { user } = useAuth()

const form = ref({
  customerId: '',
  deliveryAddress: '',
  paymentTerms: '',
  notes: '',
  items: [] as Array<{ productId: string, productSku?: string, quantity: number, unitPrice: number }>
})

const { data: customers } = await useFetch('/api/customers')
const { data: products } = await useFetch('/api/products')

const customerOptions = computed(() => {
  return (customers.value as any[] || []).map(c => ({
    label: c.name,
    value: c.id
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
  const c = (customers.value as any[])?.find((c: any) => c.id === form.value.customerId)
  if (c) {
    const fullAddress = [c.address, c.city, c.state].filter(Boolean).join(', ')
    form.value.deliveryAddress = `${fullAddress}${c.pincode ? ' - ' + c.pincode : ''}`
    form.value.paymentTerms = c.paymentTerms || 'Net 30'
  }
}

const addItem = () => {
  form.value.items.push({ productId: '', quantity: 1, unitPrice: 0 })
}

const removeItem = (index: number) => {
  form.value.items.splice(index, 1)
}

const onProductChange = (index: number) => {
  const item = form.value.items[index]
  const p = (products.value as any[])?.find((p: any) => p.id === item.productId)
  if (p) {
    item.unitPrice = p.price || 0
    item.productSku = p.sku || ''
  }
}

const totalAmount = computed(() => {
  return form.value.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
})

const { showSaving, showSaved, hide } = useSnackbar()

const submitOrder = async () => {
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
  } catch (err) {
    console.error(err)
    showSaved('Failed to create order')
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6 pb-12">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Create New Order</h1>
    </div>

    <form @submit.prevent="submitOrder" class="space-y-6">
      
      <!-- Section 1: Order Info -->
      <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h3 class="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Order Details</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer</label>
            <CustomSelect 
              :modelValue="form.customerId"
              @update:modelValue="val => { form.customerId = val; onCustomerChange() }"
              :options="customerOptions"
              searchable
              searchPlaceholder="Search customers..."
              placeholder="Select Customer"
              class="w-full"
            />
          </div>
          
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Placed By</label>
            <input :value="user?.name || 'Unknown'" disabled class="w-full text-sm border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed" />
          </div>
          
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Terms</label>
            <CustomSelect 
              :modelValue="form.paymentTerms"
              @update:modelValue="val => form.paymentTerms = val"
              :options="[
                {label: 'Net 30', value: 'Net 30'},
                {label: 'Net 60', value: 'Net 60'},
                {label: 'Due on Receipt', value: 'Due on Receipt'},
                {label: 'Advanced Payment', value: 'Advanced Payment'}
              ]"
              placeholder="Select Terms"
              class="w-full"
            />
          </div>
          
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery Address</label>
            <textarea v-model="form.deliveryAddress" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none" required placeholder="Enter delivery address..."></textarea>
          </div>

          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Internal Notes</label>
            <textarea v-model="form.notes" rows="2" class="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-[#1a5c4c] focus:border-[#1a5c4c] resize-none" placeholder="Add any internal instructions or notes..."></textarea>
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

        <div class="space-y-3">
          <div v-for="(item, idx) in form.items" :key="idx" class="flex flex-wrap md:flex-nowrap gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div class="flex-1 w-full min-w-0">
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Product</label>
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
            <div class="w-full md:w-24 shrink-0">
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Qty</label>
              <input type="number" v-model.number="item.quantity" min="1" required class="w-full border-gray-300 rounded-lg shadow-sm p-2.5 bg-white text-sm focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
            </div>
            <div class="w-full md:w-32 shrink-0">
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Unit Price</label>
              <input type="number" v-model.number="item.unitPrice" min="0" required class="w-full border-gray-300 rounded-lg shadow-sm p-2.5 bg-white text-sm focus:ring-[#1a5c4c] focus:border-[#1a5c4c]" />
            </div>
            <div class="w-full md:w-32 shrink-0">
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Line Total</label>
              <div class="p-2.5 bg-white text-gray-900 rounded-lg font-medium text-sm border border-gray-200">
                {{ formatCurrency(item.quantity * item.unitPrice) }}
              </div>
            </div>
            <button type="button" @click="removeItem(idx)" class="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg mb-0 md:mb-0 shrink-0 transition-colors">
              <Trash2 class="w-5 h-5" />
            </button>
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
