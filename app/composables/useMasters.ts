import { computed } from 'vue'

export interface MasterOptionItem {
  id: string
  group: 'PAYMENT_TERMS' | 'PRODUCT_UOM' | 'SHEET_SIZE'
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
    sheetSizes: MasterOptionItem[]
    categories: MasterCategoryItem[]
  }>('/api/masters', {
    key: 'app_masters_data',
    default: () => ({
      paymentTerms: [],
      productUom: [],
      sheetSizes: [],
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

  // Active Sheet Sizes formatted for Rate Calculator
  const sheetSizesOptions = computed(() => {
    const list = data.value?.sheetSizes || []
    const active = list.filter(item => item.isActive !== false)
    if (active.length === 0) {
      return [
        { label: '8 x 4 (Std)', length: 8, width: 4, isDefault: true, value: '8x4' },
        { label: '7 x 4', length: 7, width: 4, isDefault: false, value: '7x4' },
        { label: '7 x 3', length: 7, width: 3, isDefault: false, value: '7x3' },
        { label: '6 x 4', length: 6, width: 4, isDefault: false, value: '6x4' },
        { label: '6 x 3', length: 6, width: 3, isDefault: false, value: '6x3' }
      ]
    }
    return active.map(item => {
      const parts = item.value.toLowerCase().split(/[x*]/).map(s => parseFloat(s.trim()))
      const length = !isNaN(parts[0]) && parts[0] > 0 ? parts[0] : 8
      const width = !isNaN(parts[1]) && parts[1] > 0 ? parts[1] : 4
      return {
        id: item.id,
        label: item.label,
        value: item.value,
        length,
        width,
        isDefault: item.isDefault,
        description: item.description
      }
    })
  })

  return {
    data,
    pending,
    refreshMasters: refresh,
    paymentTermsOptions,
    unitOptions,
    categoryOptions,
    sheetSizesOptions,
    rawPaymentTerms: computed(() => data.value?.paymentTerms || []),
    rawProductUom: computed(() => data.value?.productUom || []),
    rawSheetSizes: computed(() => data.value?.sheetSizes || []),
    rawCategories: computed(() => data.value?.categories || [])
  }
}
