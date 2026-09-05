import { ref, onMounted, onUnmounted } from 'vue'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null
let sharedChannel: RealtimeChannel | null = null
let localBroadcastChannel: BroadcastChannel | null = null
const listeners = new Set<(event: any) => void>()
let isSubscribed = false

// Initialize client and channels once
function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (supabaseInstance) return supabaseInstance

  const config = useRuntimeConfig()
  const url = (config.public as any).supabaseUrl
  const key = (config.public as any).supabaseKey

  if (!url || !key) return null

  try {
    supabaseInstance = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    })
    return supabaseInstance
  } catch (e) {
    console.warn('[RealtimeSync] Failed to initialize Supabase client:', e)
    return null
  }
}

function getLocalBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!localBroadcastChannel) {
    try {
      localBroadcastChannel = new BroadcastChannel('sm_instant_order_sync')
      localBroadcastChannel.onmessage = (ev) => {
        if (ev.data) {
          triggerListeners(ev.data)
        }
      }
    } catch (e) {
      console.warn('[RealtimeSync] BroadcastChannel not supported:', e)
    }
  }
  return localBroadcastChannel
}

// Debounce listener triggers slightly so burst events consolidate
let debounceTimer: any = null
let pendingEvents: any[] = []

function triggerListeners(event: any) {
  pendingEvents.push(event)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const lastEvent = pendingEvents[pendingEvents.length - 1] || event
    pendingEvents = []
    listeners.forEach((fn) => {
      try {
        fn(lastEvent)
      } catch (err) {
        console.error('[RealtimeSync] Listener callback error:', err)
      }
    })
  }, 60)
}

function setupRealtimeChannel() {
  if (typeof window === 'undefined') return
  getLocalBroadcastChannel()

  const supabase = getSupabase()
  if (!supabase || sharedChannel || isSubscribed) return

  try {
    sharedChannel = supabase.channel('sm_orders_realtime', {
      config: {
        broadcast: { ack: false, self: false },
      },
    })

    // 1. High-speed WebSocket Broadcast (50-100ms multi-device delivery)
    sharedChannel.on('broadcast', { event: 'ORDER_CHANGE' }, (payload) => {
      triggerListeners(payload?.payload || { type: 'ORDER_CHANGE' })
    })

    // 2. Direct Postgres database changes fallback
    sharedChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        triggerListeners({ type: 'DB_ORDER_CHANGE', table: 'orders', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_statuses' }, (payload) => {
        triggerListeners({ type: 'DB_BILLING_CHANGE', table: 'billing_statuses', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packing_statuses' }, (payload) => {
        triggerListeners({ type: 'DB_PACKING_CHANGE', table: 'packing_statuses', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_statuses' }, (payload) => {
        triggerListeners({ type: 'DB_DELIVERY_CHANGE', table: 'delivery_statuses', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        triggerListeners({ type: 'DB_ORDER_ITEM_CHANGE', table: 'order_items', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        triggerListeners({ type: 'DB_CUSTOMER_CHANGE', table: 'customers', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        triggerListeners({ type: 'DB_PRODUCT_CHANGE', table: 'products', record: payload.new || payload.old })
      })

    sharedChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true
      }
    })
  } catch (err) {
    console.warn('[RealtimeSync] Channel setup warning:', err)
  }
}

export function useRealtimeSync() {
  /**
   * Broadcast an instant change event to all connected devices + local browser tabs.
   * Delivers in ~0ms locally and <100ms across network devices.
   */
  const notifyChange = (eventData: {
    type?: string
    orderId?: string
    action?: string
    [key: string]: any
  }) => {
    if (typeof window === 'undefined') return

    const payload = {
      ...eventData,
      type: eventData.type || 'ORDER_CHANGE',
      timestamp: Date.now(),
    }

    // A. Local Broadcast (0ms cross-tab instant sync)
    try {
      const bc = getLocalBroadcastChannel()
      if (bc) bc.postMessage(payload)
    } catch (e) {}

    // B. WebSocket Broadcast across devices (sub-100ms multi-device instant sync)
    try {
      if (sharedChannel && isSubscribed) {
        sharedChannel.send({
          type: 'broadcast',
          event: 'ORDER_CHANGE',
          payload,
        })
      }
    } catch (e) {
      console.warn('[RealtimeSync] Failed to send broadcast:', e)
    }
  }

  /**
   * Register a reactive callback whenever ANY order, billing, packing, or delivery change occurs.
   * Automatically sets up channels and unsubscribes on unmount.
   */
  const onOrderSync = (callback: (event: any) => void) => {
    onMounted(() => {
      setupRealtimeChannel()
      listeners.add(callback)
    })

    onUnmounted(() => {
      listeners.delete(callback)
    })

    return () => {
      listeners.delete(callback)
    }
  }

  return {
    notifyChange,
    onOrderSync,
  }
}
