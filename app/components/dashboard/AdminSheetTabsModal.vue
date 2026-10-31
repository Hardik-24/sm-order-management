<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] overflow-y-auto">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:max-h-[92vh] overflow-hidden flex flex-col border border-gray-100">
        
        <!-- Header -->
        <div class="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <FileSpreadsheet class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold text-[#1a1a1a] flex items-center gap-2 truncate">
                Google Sheets Price List Manager
              </h3>
              <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs sm:max-w-md">
                Configure cascading priority tabs for real-time quotation pricing
              </p>
            </div>
          </div>
          <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          <!-- Connection Status Card -->
          <div class="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck class="w-3 h-3 mr-1" /> STRICTLY READ-ONLY
                </span>
                <span class="text-xs font-semibold text-gray-700 truncate max-w-[220px] sm:max-w-xs">
                  {{ sheetTitle || 'HARDWARE INSTA_QUOTE V3.0' }}
                </span>
              </div>
              <p class="text-[11px] text-gray-500">
                Impersonating <span class="font-mono text-gray-700 font-medium">hardikpatel@siliconmarketing.in</span> via Google Domain-Wide Delegation.
              </p>
            </div>

            <button
              @click="fetchSheetTabs()"
              :disabled="isLoadingTabs"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoadingTabs }" />
              <span>Refresh Tabs</span>
            </button>
          </div>

          <!-- Explanatory Banner -->
          <div class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <Info class="w-4 h-4 text-[#1b3b5f] shrink-0 mt-0.5" />
            <div class="space-y-1">
              <p class="font-semibold text-[#1b3b5f]">How Cascading Priority Works:</p>
              <p>
                When a sales rep enters an Article Number, OMS checks the <strong>Top Tab (Priority 1)</strong> first. 
                If the product isn't found (e.g. older inventory discontinued in latest list), it seamlessly falls back to Priority 2, then Priority 3, and so on.
              </p>
            </div>
          </div>

          <!-- Active Priority Tabs -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <span>Active Quoted Tabs (Ordered by Priority)</span>
                <span class="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                  {{ activeTabs.length }} tabs active
                </span>
              </h4>
              <span class="text-[11px] text-gray-400">Top = Highest Priority (Newest)</span>
            </div>

            <div v-if="activeTabs.length === 0" class="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
              No tabs currently active. Add tabs from the available list below.
            </div>

            <div v-else class="space-y-2">
              <div 
                v-for="(tabName, idx) in activeTabs" 
                :key="tabName"
                class="flex items-center justify-between p-3 rounded-xl border transition-all"
                :class="idx === 0 
                  ? 'bg-emerald-50/30 border-emerald-200 shadow-xs' 
                  : 'bg-white border-gray-200 hover:border-gray-300'"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span 
                    class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    :class="idx === 0 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ idx + 1 }}
                  </span>

                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-sm text-[#1b3b5f] font-mono">{{ tabName }}</span>
                      <span v-if="idx === 0" class="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Primary (Newest)
                      </span>
                      <span v-else class="text-[10px] font-medium px-2 py-0.2 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        Fallback {{ idx }}
                      </span>
                    </div>
                    <span v-if="getTabRowCount(tabName) !== null" class="text-[11px] text-gray-500 mt-0.5 block">
                      ~{{ getTabRowCount(tabName) }} rows in Google Sheet
                    </span>
                  </div>
                </div>

                <!-- Reorder & Remove Controls -->
                <div class="flex items-center gap-1">
                  <button 
                    @click="moveTabUp(idx)"
                    :disabled="idx === 0"
                    title="Move up in priority"
                    class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronUp class="w-4 h-4" />
                  </button>
                  <button 
                    @click="moveTabDown(idx)"
                    :disabled="idx === activeTabs.length - 1"
                    title="Move down in priority"
                    class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronDown class="w-4 h-4" />
                  </button>
                  <button 
                    @click="removeActiveTab(idx)"
                    title="Remove from active search"
                    class="p-1.5 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-600 transition-colors cursor-pointer ml-1"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Inactive / Available Tabs -->
          <div v-if="availableTabs.length > 0" class="space-y-2.5 pt-2 border-t border-gray-100">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500">
              Other Detected Tabs in Spreadsheet (Inactive)
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div 
                v-for="t in availableTabs" 
                :key="t.title"
                class="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white transition-all text-xs"
              >
                <div class="min-w-0 pr-2">
                  <span class="font-medium text-gray-700 truncate block font-mono">{{ t.title }}</span>
                  <span class="text-[10px] text-gray-400">{{ t.rowCount }} rows</span>
                </div>
                <button 
                  @click="addActiveTab(t.title)"
                  class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-[#1b3b5f] hover:text-white hover:border-[#1b3b5f] transition-all text-[11px] font-medium shrink-0 cursor-pointer shadow-2xs"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Sync Feedback / Stats -->
          <div v-if="syncResult" class="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 space-y-1.5">
            <div class="flex items-center gap-2 font-bold">
              <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Catalog Successfully Synced!</span>
            </div>
            <p class="text-[11px] text-blue-800">
              Total <strong>{{ syncResult.count?.toLocaleString() }}</strong> unique products merged into OMS quotation engine.
            </p>
            <div v-if="syncResult.breakdown" class="flex flex-wrap gap-1.5 pt-1">
              <span 
                v-for="(count, tab) in syncResult.breakdown" 
                :key="tab"
                class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-white border border-blue-200 text-blue-800"
              >
                {{ tab }}: <strong>{{ count }}</strong> items
              </span>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-red-500" />
            <span class="flex-1">{{ errorMessage }}</span>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-4 sm:px-6 py-3.5 border-t border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
          <button 
            @click="emit('close')"
            class="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 text-xs font-medium cursor-pointer"
          >
            Close
          </button>

          <button 
            @click="saveAndSync()"
            :disabled="isSaving || activeTabs.length === 0"
            class="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1b3b5f] hover:bg-[#132c49] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
            <Save v-else class="w-3.5 h-3.5" />
            <span>{{ isSaving ? 'Saving & Syncing...' : 'Save & Sync Now' }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  FileSpreadsheet,
  X,
  ShieldCheck,
  RefreshCw,
  Info,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-vue-next'
import { useSnackbar } from '~/composables/useSnackbar'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'synced'): void
}>()

const { showSuccess, showError } = useSnackbar()

const sheetTitle = ref('HARDWARE INSTA_QUOTE V3.0')
const allSheetTabs = ref<Array<{ title: string; rowCount: number; columnCount: number }>>([])
const activeTabs = ref<string[]>(['2026JULY', '2026APRIL', '2026FEB', '2025NOV'])

const isLoadingTabs = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const syncResult = ref<{ count?: number; breakdown?: Record<string, number> } | null>(null)

// Inactive tabs detected from Google Spreadsheet
const availableTabs = computed(() => {
  const activeSet = new Set(activeTabs.value)
  return allSheetTabs.value.filter(t => !activeSet.has(t.title))
})

const getTabRowCount = (tabName: string): number | null => {
  const t = allSheetTabs.value.find(s => s.title === tabName)
  return t ? t.rowCount : null
}

const moveTabUp = (idx: number) => {
  if (idx <= 0) return
  const temp = activeTabs.value[idx]
  activeTabs.value[idx] = activeTabs.value[idx - 1]
  activeTabs.value[idx - 1] = temp
}

const moveTabDown = (idx: number) => {
  if (idx >= activeTabs.value.length - 1) return
  const temp = activeTabs.value[idx]
  activeTabs.value[idx] = activeTabs.value[idx + 1]
  activeTabs.value[idx + 1] = temp
}

const removeActiveTab = (idx: number) => {
  activeTabs.value.splice(idx, 1)
}

const addActiveTab = (title: string) => {
  if (!activeTabs.value.includes(title)) {
    activeTabs.value.push(title)
  }
}

const fetchSheetTabs = async () => {
  isLoadingTabs.value = true
  errorMessage.value = null
  try {
    const res = await $fetch<any>('/api/quotations/sheet-tabs')
    if (res?.success) {
      if (res.sheetTitle) sheetTitle.value = res.sheetTitle
      if (res.allTabs) allSheetTabs.value = res.allTabs
      if (res.configuredTabs && Array.isArray(res.configuredTabs)) {
        activeTabs.value = res.configuredTabs
      }
    }
  } catch (err: any) {
    console.error('Failed to load sheet tabs:', err)
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Failed to connect to Google Sheet.'
  } finally {
    isLoadingTabs.value = false
  }
}

const saveAndSync = async () => {
  if (activeTabs.value.length === 0) {
    showError('Please activate at least one tab.')
    return
  }

  isSaving.value = true
  errorMessage.value = null
  syncResult.value = null

  try {
    // 1. Save configured tabs order
    await $fetch('/api/quotations/sheet-tabs', {
      method: 'POST',
      body: { tabs: activeTabs.value }
    })

    // 2. Force a live sync across the newly configured tabs
    const syncRes = await $fetch<any>('/api/quotations/sheet-products?force=true')
    if (syncRes?.success) {
      syncResult.value = {
        count: syncRes.count,
        breakdown: syncRes.breakdown
      }
      showSuccess(`Synced ${syncRes.count} products from Google Sheet!`)
      emit('synced')
    }
  } catch (err: any) {
    console.error('Save and sync failed:', err)
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Save and sync failed.'
    showError(errorMessage.value || 'Failed to sync catalog.')
  } finally {
    isSaving.value = false
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchSheetTabs()
  }
})

onMounted(() => {
  if (props.isOpen) {
    fetchSheetTabs()
  }
})
</script>
