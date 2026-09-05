<template>
  <div class="h-full flex flex-col bg-gray-50/50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h1 class="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare class="w-5 h-5 text-emerald-600" />
          Team Chat
        </h1>
        <p class="text-xs text-gray-500 mt-1">Company-wide group chat for dispatch, sales, and warehouse.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Live</span>
      </div>
    </header>

    <!-- Chat Messages Area -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6" ref="chatContainer">
      <div v-if="pending" class="flex justify-center items-center h-full">
        <Loader2 class="w-8 h-8 animate-spin text-emerald-600" />
      </div>
      
      <div v-else-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
        <MessageSquare class="w-12 h-12 opacity-20" />
        <p>No messages yet. Say hello to the team!</p>
      </div>

      <template v-else>
        <div 
          v-for="(msg, idx) in messages" 
          :key="msg.id"
          class="flex gap-4"
          :class="{ 'flex-row-reverse': msg.userId === user?.id }"
        >
          <!-- Avatar -->
          <img 
            :src="msg.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.user.name)}&background=1a5c4c&color=e8e0d4`" 
            alt="Avatar" 
            class="w-10 h-10 rounded-full shadow-sm shrink-0 mt-1"
          />

          <!-- Message Content -->
          <div class="max-w-[75%]" :class="{ 'text-right': msg.userId === user?.id }">
            <div class="flex items-baseline gap-2 mb-1" :class="{ 'flex-row-reverse': msg.userId === user?.id }">
              <span class="font-bold text-sm text-gray-900">{{ msg.user.name }}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-wider">
                {{ msg.user.role }}
              </span>
              <span class="text-[11px] text-gray-400">{{ formatTime(msg.createdAt) }}</span>
            </div>
            
            <div 
              class="px-4 py-2.5 rounded-2xl shadow-sm text-sm whitespace-pre-wrap break-words"
              :class="msg.userId === user?.id ? 'bg-[#1a5c4c] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'"
              v-html="formatMessage(msg.content, msg.userId === user?.id)"
            >
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Composer -->
    <div class="bg-white border-t border-gray-200 p-4 shrink-0">
      <form @submit.prevent="sendMessage" class="flex gap-3 max-w-5xl mx-auto">
        <div class="flex-1 relative">
          <textarea
            v-model="newMessage"
            @keydown.enter.prevent="handleEnter"
            placeholder="Type a message to the team... (Use #SO- to link an order)"
            class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-inner resize-none min-h-[50px] max-h-[150px]"
            rows="1"
            ref="inputRef"
          ></textarea>
          <div class="absolute right-3 bottom-3 text-[10px] text-gray-400 font-bold uppercase tracking-widest hidden sm:block pointer-events-none">
            Press Enter to send
          </div>
        </div>
        <button 
          type="submit" 
          :disabled="!newMessage.trim() || isSending"
          class="bg-[#1a5c4c] hover:bg-[#134336] text-white px-5 rounded-xl font-bold flex items-center justify-center transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Loader2 v-if="isSending" class="w-5 h-5 animate-spin" />
          <Send v-else class="w-5 h-5" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { MessageSquare, Send, Loader2 } from 'lucide-vue-next'
import { useAuth } from '~/composables/useAuth'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const { user } = useAuth()
const { onOrderSync } = useRealtimeSync()

const messages = ref<any[]>([])
const pending = ref(true)
const newMessage = ref('')
const isSending = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// Format timestamps
function formatTime(isoStr: string) {
  const d = new Date(isoStr)
  const today = new Date()
  const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return timeStr
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`
}

// Auto-link order numbers
function formatMessage(text: string, isOwnMessage: boolean) {
  if (!text) return ''
  // Basic HTML escape
  let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // Find order numbers like #SO-2026-001 or SO-2026-001
  const orderRegex = /#?(SO-\d{4}-\d+)/gi
  return safeText.replace(orderRegex, (match, orderNum) => {
    const linkColor = isOwnMessage ? 'text-emerald-200 hover:text-white' : 'text-emerald-600 hover:text-emerald-800'
    return `<a href="/dashboard/orders?search=${orderNum}" class="font-bold underline ${linkColor}">${match}</a>`
  })
}

// Scroll to bottom
const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// Fetch initial messages
const loadMessages = async () => {
  try {
    const data = await $fetch<any[]>('/api/chat')
    messages.value = data
    scrollToBottom()
  } catch (err) {
    console.error('Failed to load chat:', err)
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  loadMessages()
  inputRef.value?.focus()
})

// Listen for realtime chat updates
onOrderSync((event) => {
  if (event.type === 'DB_CHAT_CHANGE') {
    // We just reload all messages for simplicity, but we could fetch just the new one
    // or append the payload if it contained full user details (it doesn't by default)
    loadMessages()
  }
})

// Send message
const sendMessage = async () => {
  if (!newMessage.value.trim() || isSending.value) return
  
  isSending.value = true
  const content = newMessage.value
  newMessage.value = '' // Clear UI immediately for responsiveness
  
  // Reset textarea height
  if (inputRef.value) inputRef.value.style.height = 'auto'

  try {
    const newMsg = await $fetch('/api/chat', {
      method: 'POST',
      body: { content }
    })
    
    // Add locally to feel instantaneous before the websocket bounce-back
    if (!messages.value.find(m => m.id === newMsg.id)) {
      messages.value.push(newMsg)
      scrollToBottom()
    }
  } catch (err) {
    console.error('Failed to send:', err)
    newMessage.value = content // restore on error
  } finally {
    isSending.value = false
  }
}

const handleEnter = (e: KeyboardEvent) => {
  if (e.shiftKey) {
    // Allow multi-line
    return
  }
  sendMessage()
}

// Auto-grow textarea
watch(newMessage, () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 150) + 'px'
    }
  })
})
</script>
