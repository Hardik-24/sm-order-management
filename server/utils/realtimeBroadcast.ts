export async function broadcastRealtimeEvent(topic: string, event: string, payload: any) {
  try {
    const config = useRuntimeConfig()
    const supabaseUrl = (config.public as any)?.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://xfzvkqjkbwwdqtxgasrh.supabase.co'
    const supabaseKey = (config.public as any)?.supabaseKey || process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmenZrcWprYnd3ZHF0eGdhc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Njg1MzYsImV4cCI6MjEwNDE0NDUzNn0.0D6O8IL-2Dg53GIuMoti0yA2seDfj4XVpPj1aarfb4s'

    if (!supabaseUrl || !supabaseKey) return

    await $fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        messages: [
          {
            topic,
            event,
            payload: {
              ...payload,
              timestamp: Date.now()
            }
          },
          {
            topic: topic.startsWith('realtime:') ? topic : `realtime:${topic}`,
            event,
            payload: {
              ...payload,
              timestamp: Date.now()
            }
          }
        ]
      }
    })
  } catch (err: any) {
    // Non-blocking catch so failure to broadcast never breaks the HTTP API response
    console.warn('[RealtimeBroadcast] Server broadcast warning:', err?.message || err)
  }
}
