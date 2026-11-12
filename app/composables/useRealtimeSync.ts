import { ref, onMounted, onUnmounted } from 'vue'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null
let sharedChannel: RealtimeChannel | null = null
let localBroadcastChannel: BroadcastChannel | null = null
const listeners = new Set<(event: any) => void>()
let isSubscribed = false
let reconnectTimer: any = null
let reconnectAttempts = 0
let lastWakeupSync = 0
let isGlobalLifecycleAttached = false
let heartbeatInterval: any = null

function triggerWakeupSync() {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastWakeupSync < 10000) return // 10-second throttle to prevent rapid spam
  lastWakeupSync = now
  triggerListeners({ type: 'WAKEUP_SYNC', timestamp: now })
}

function attachGlobalLifecycleListeners() {
  if (typeof window === 'undefined' || isGlobalLifecycleAttached) return
  isGlobalLifecycleAttached = true

  // 1. Phone wake-up / tab visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!isSubscribed || !sharedChannel) {
        reconnectChannel(true)
      }
      triggerWakeupSync()
    }
  })

  // 2. Window focus (desktop tab switch / app return)
  window.addEventListener('focus', () => {
    if (!isSubscribed || !sharedChannel) {
      reconnectChannel(true)
    }
    triggerWakeupSync()
  })

  // 3. Online connection restored
  window.addEventListener('online', () => {
    reconnectChannel(true)
    triggerWakeupSync()
  })

  // 4. Visible-only background safety heartbeat (every 40 seconds)
  // Ensures WebSocket connection stays alive and recovers dropped channels without emitting fake record change events
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (!isSubscribed || !sharedChannel) {
          reconnectChannel(true)
        }
      }
    }, 40000)
  }
}

function reconnectChannel(immediate = false) {
  if (typeof window === 'undefined') return
  clearTimeout(reconnectTimer)

  const delay = immediate ? 50 : Math.min(1000 * Math.pow(1.5, reconnectAttempts), 15000)
  reconnectTimer = setTimeout(() => {
    const supabase = getSupabase()
    if (!supabase) return

    if (sharedChannel) {
      try {
        supabase.removeChannel(sharedChannel)
      } catch (e) {}
      sharedChannel = null
    }
    isSubscribed = false
    reconnectAttempts++
    setupRealtimeChannel()
  }, delay)
}

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

function triggerListeners(event: any) {
  listeners.forEach((fn) => {
    try {
      fn(event)
    } catch (err) {
      console.error('[RealtimeSync] Listener callback error:', err)
    }
  })
}

function setupRealtimeChannel() {
  if (typeof window === 'undefined') return
  attachGlobalLifecycleListeners()
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
    sharedChannel.on('broadcast', { event: 'TRIP_CHANGE' }, (payload) => {
      triggerListeners(payload?.payload || { type: 'TRIP_CHANGE' })
    })
    sharedChannel.on('broadcast', { event: 'SYNC_CHANGE' }, (payload) => {
      triggerListeners(payload?.payload || { type: 'SYNC_CHANGE' })
    })
    sharedChannel.on('broadcast', { event: 'DEVICE_CHANGE' }, (payload) => {
      triggerListeners(payload?.payload || { type: 'DEVICE_CHANGE' })
    })
    sharedChannel.on('broadcast', { event: 'USER_CHANGE' }, (payload) => {
      triggerListeners(payload?.payload || { type: 'USER_CHANGE' })
    })
    sharedChannel.on('broadcast', { event: 'QUOTATION_CHANGE' }, (payload) => {
      triggerListeners(payload?.payload || { type: 'QUOTATION_CHANGE' })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        triggerListeners({ type: 'DB_CATEGORY_CHANGE', table: 'categories', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        triggerListeners({ type: 'DB_USER_CHANGE', table: 'users', eventType: payload.eventType, record: payload.new || payload.old, oldRecord: payload.old, newRecord: payload.new })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload) => {
        triggerListeners({ type: 'DB_CHAT_CHANGE', table: 'chat_messages', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_timeline' }, (payload) => {
        triggerListeners({ type: 'DB_TIMELINE_CHANGE', table: 'order_timeline', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, (payload) => {
        triggerListeners({ type: 'DB_ORDER_REQUEST_CHANGE', table: 'order_requests', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
        triggerListeners({ type: 'DB_TRIP_CHANGE', table: 'trips', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stops' }, (payload) => {
        triggerListeners({ type: 'DB_TRIP_STOP_CHANGE', table: 'trip_stops', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, (payload) => {
        triggerListeners({ type: 'DB_SYSTEM_SETTING_CHANGE', table: 'system_settings', record: payload.new || payload.old })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_devices' }, (payload) => {
        triggerListeners({ type: 'DB_DEVICE_CHANGE', table: 'trusted_devices', eventType: payload.eventType, record: payload.new || payload.old, oldRecord: payload.old, newRecord: payload.new })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, (payload) => {
        triggerListeners({ type: 'DB_QUOTATION_CHANGE', table: 'quotations', record: payload.new || payload.old })
      })

    sharedChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true
        reconnectAttempts = 0
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        isSubscribed = false
        console.warn(`[RealtimeSync] Channel status changed to: ${status}, scheduling reconnect...`)
        reconnectChannel(false)
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

    // Also trigger listeners immediately in current window/tab
    triggerListeners(payload)

    // B. WebSocket Broadcast across devices (sub-100ms multi-device instant sync)
    const sendBroadcast = () => {
      if (!sharedChannel || !isSubscribed) return false
      try {
        sharedChannel.send({
          type: 'broadcast',
          event: 'ORDER_CHANGE',
          payload,
        })
        if (payload.type?.includes('TRIP') || payload.action?.includes('TRIP')) {
          sharedChannel.send({
            type: 'broadcast',
            event: 'TRIP_CHANGE',
            payload,
          })
        }
        if (
          payload.type?.includes('DEVICE') || 
          payload.action?.includes('DEVICE') || 
          payload.type === 'LOGOUT_ALL_OTHERS' || 
          payload.action === 'LOGOUT_ALL_OTHERS'
        ) {
          sharedChannel.send({
            type: 'broadcast',
            event: 'DEVICE_CHANGE',
            payload,
          })
        }
        if (
          payload.type?.includes('USER') || 
          payload.action?.includes('USER')
        ) {
          sharedChannel.send({
            type: 'broadcast',
            event: 'USER_CHANGE',
            payload,
          })
        }
        if (
          payload.type?.includes('QUOTATION') || 
          payload.action?.includes('QUOTATION')
        ) {
          sharedChannel.send({
            type: 'broadcast',
            event: 'QUOTATION_CHANGE',
            payload,
          })
        }
        return true
      } catch (e) {
        console.warn('[RealtimeSync] Failed to send broadcast:', e)
        return false
      }
    }

    const sent = sendBroadcast()
    if (!sent && sharedChannel) {
      // Retry once after 350ms in case socket is in the middle of subscribing or recovering
      setTimeout(() => {
        sendBroadcast()
      }, 350)
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
