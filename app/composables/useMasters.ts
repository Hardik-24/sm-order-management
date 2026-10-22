import { computed } from 'vue'

export interface MasterOptionItem {
  id: string
  group: 'PAYMENT_TERMS' | 'PRODUCT_UOM'
  label: string
  value: string
  description?: string | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

export interface MasterCategoryItem {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  productCount: number
}

export const useMasters = () => {
  const { onOrderSync } = useRealtimeSync()

  const { data, pending, refresh } = useFetch<{
    paymentTerms: MasterOptionItem[]
    productUom: MasterOptionItem[]
    categories: MasterCategoryItem[]
  }>('/api/masters', {
    key: 'app_masters_data',
    default: () => ({
      paymentTerms: [],
      productUom: [],
      categories: []
    })
  })

  // Realtime multi-device sync
  onOrderSync((event) => {
    if (
      event?.type === 'MASTERS_UPDATED' ||
      event?.type === 'CATEGORY_UPDATED' ||
      event?.action === 'MASTERS_CHANGED'
    ) {
      refresh()
    }
  })

  // Active Payment Terms formatted for CustomSelect
  const paymentTermsOptions = computed(() => {
    const list = data.value?.paymentTerms || []
    return list
      .filter(item => item.isActive !== false)
      .map(item => ({
        label: item.label,
        value: item.value,
        subtitle: item.description || (item.isDefault ? 'Default Term' : undefined)
      }))
  })

  // Active Product UOM formatted for CustomSelect
  const unitOptions = computed(() => {
    const list = data.value?.productUom || []
    return list
      .filter(item => item.isActive !== false)
      .map(item => ({
        label: item.label,
        value: item.value,
        subtitle: item.description || undefined
      }))
  })

  // Active Categories formatted for CustomSelect & Filters
  const categoryOptions = computed(() => {
    const list = data.value?.categories || []
    return list
      .filter(c => c.isActive !== false)
      .map(c => ({
        label: c.name,
        value: c.id,
        id: c.id,
        subtitle: c.productCount > 0 ? `${c.productCount} products` : undefined
      }))
  })

  return {
    data,
    pending,
    refreshMasters: refresh,
    paymentTermsOptions,
    unitOptions,
    categoryOptions,
    rawPaymentTerms: computed(() => data.value?.paymentTerms || []),
    rawProductUom: computed(() => data.value?.productUom || []),
    rawCategories: computed(() => data.value?.categories || [])
  }
}
