<template>
  <div class="h-full w-full flex flex-col bg-white overflow-hidden">
    <!-- Header (WhatsApp style) -->
    <header class="bg-[#f0f2f5] border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-20">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 rounded-full bg-[#1a5c4c] flex items-center justify-center text-white shrink-0 shadow-sm">
          <MessageSquare class="w-5 h-5" />
        </div>
        <div>
          <h1 class="text-base font-bold text-[#111b21] leading-tight">
            Team Chat
          </h1>
          <p class="text-xs text-[#667781] flex items-center mt-0.5">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse shadow-sm"></span>
            Company-wide group chat
          </p>
        </div>
      </div>
    </header>

    <!-- Chat Messages Area (Scrollable) -->
    <div 
      class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 relative bg-[#efeae2]" 
      ref="chatContainer"
      style="background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); background-repeat: repeat; opacity: 0.95;"
    >
      <div v-if="pending" class="flex justify-center items-center h-full">
        <Loader2 class="w-8 h-8 animate-spin text-[#00a884]" />
      </div>
      
      <div v-else-if="messages.length === 0" class="flex justify-center my-10">
        <div class="bg-[#ffeecd] text-[#54656f] text-xs py-2 px-4 rounded-xl shadow-sm inline-block text-center max-w-sm">
          Messages are end-to-end secured by Silicon Marketing.<br/>No one outside this workspace can read them.
        </div>
      </div>

      <template v-else>
        <!-- Security notification banner -->
        <div class="flex justify-center mb-6">
          <div class="bg-[#ffeecd] text-[#54656f] text-xs py-1.5 px-4 rounded-lg shadow-sm inline-block text-center max-w-sm">
            Messages are end-to-end secured.
          </div>
        </div>

        <div 
          v-for="(msg, idx) in messages" 
          :key="msg.id"
          class="flex w-full group items-center"
          :class="msg.userId === user?.id ? 'justify-end' : 'justify-start'"
        >
          <!-- Delete button (visible on hover) -->
          <button 
            v-if="msg.userId === user?.id || user?.role === 'ADMIN'"
            @click="deleteMessage(msg.id)"
            class="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all shrink-0 mx-2"
            :class="msg.userId === user?.id ? 'order-first' : 'order-last'"
            title="Delete message"
          >
            <Trash2 class="w-4 h-4" />
          </button>

          <div 
            class="flex max-w-[85%] md:max-w-[70%]"
            :class="msg.userId === user?.id ? 'flex-row-reverse' : 'flex-row'"
          >
            <!-- Avatar (Only for others) -->
            <div v-if="msg.userId !== user?.id" class="mr-2 mt-1 shrink-0">
              <img 
                :src="msg.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.user.name)}&background=e8e0d4&color=1a5c4c`" 
                alt="Avatar" 
                class="w-8 h-8 rounded-full shadow-sm border border-gray-200"
              />
            </div>

            <!-- Bubble -->
            <div 
              class="relative px-3 py-2 rounded-lg shadow-sm text-[14.5px] leading-snug whitespace-pre-wrap break-words text-[#111b21] flex flex-col"
              :class="msg.userId === user?.id ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none border border-gray-100'"
            >
              <!-- Tail Triangles -->
              <div v-if="msg.userId === user?.id" class="absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-[#d9fdd3] border-r-[10px] border-r-transparent"></div>
              <div v-if="msg.userId !== user?.id" class="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>

              <!-- Sender Name (if not me) -->
              <div v-if="msg.userId !== user?.id" class="flex items-center gap-2 mb-1">
                <span class="font-bold text-xs text-[#d14b62]">{{ msg.user.name }}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500 uppercase tracking-widest border border-gray-200">
                  {{ msg.user.role }}
                </span>
              </div>

              <!-- Content -->
              <div class="pr-14 min-w-[100px]" v-html="formatMessage(msg.content)"></div>
              
              <!-- Timestamp (Float right inside bubble) -->
              <span class="text-[10px] text-[#667781] absolute bottom-1.5 right-2 flex items-center justify-end">
                {{ formatTime(msg.createdAt) }}
                <CheckCheck v-if="msg.userId === user?.id" class="w-3.5 h-3.5 ml-1 text-[#53bdeb]" />
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Composer Footer (WhatsApp style) -->
    <div class="bg-[#f0f2f5] px-4 py-3 shrink-0 flex items-end gap-3 z-20 border-t border-gray-200">
      <!-- Input container -->
      <div class="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex items-end px-4 py-2 relative">
        <textarea
          v-model="newMessage"
          @keydown.enter.prevent="handleEnter"
          placeholder="Type a message..."
          class="w-full bg-transparent text-[15px] text-[#111b21] focus:outline-none resize-none min-h-[24px] max-h-[120px] placeholder:text-[#8696a0]"
          rows="1"
          ref="inputRef"
        ></textarea>
      </div>
      
      <!-- Send Button -->
      <button 
        @click="sendMessage"
        :disabled="!newMessage.trim() || isSending"
        class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all text-white shadow-sm"
        :class="newMessage.trim() && !isSending ? 'bg-[#00a884] hover:bg-[#008f6f]' : 'bg-gray-300'"
      >
        <Loader2 v-if="isSending" class="w-5 h-5 animate-spin" />
        <Send v-else class="w-5 h-5 ml-1" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard-chat' })

import { ref, onMounted, nextTick, watch } from 'vue'
import { MessageSquare, Send, Loader2, CheckCheck, Trash2 } from 'lucide-vue-next'
import { useAuth } from '~/composables/useAuth'
import { useRealtimeSync } from '~/composables/useRealtimeSync'

const { user } = useAuth()
const { onOrderSync, notifyChange } = useRealtimeSync()

const messages = ref<any[]>([])
const pending = ref(true)
const newMessage = ref('')
const isSending = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// Format timestamps
function formatTime(isoStr: string) {
  const d = new Date(isoStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Auto-link order numbers
function formatMessage(text: string) {
  if (!text) return ''
  // Basic HTML escape
  let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // Find order numbers like #SO-2026-001 or SO-2026-001
  const orderRegex = /#?(SO-\d{4}-\d+)/gi
  return safeText.replace(orderRegex, (match, orderNum) => {
    return `<a href="/dashboard/orders?search=${orderNum}" class="font-semibold text-[#027eb5] hover:underline">${match}</a>`
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

// Listen for realtime chat updates across devices
onOrderSync((event) => {
  if (event.type === 'DB_CHAT_CHANGE' || event.type === 'CHAT_MESSAGE' || event.action === 'CHAT_MESSAGE_SENT' || event.action === 'CHAT_MESSAGE_DELETED') {
    loadMessages()
  }
})

// Send message
const sendMessage = async () => {
  if (!newMessage.value.trim() || isSending.value) return
  
  isSending.value = true
  const content = newMessage.value
  newMessage.value = '' // Clear UI immediately
  
  if (inputRef.value) inputRef.value.style.height = '24px'

  try {
    const newMsg = await $fetch<any>('/api/chat', {
      method: 'POST',
      body: { content }
    })
    
    if (!messages.value.find(m => m.id === newMsg.id)) {
      messages.value.push(newMsg)
      scrollToBottom()
    }

    // Broadcast instant update to all other devices & tabs (<100ms)
    notifyChange({
      type: 'CHAT_MESSAGE',
      action: 'CHAT_MESSAGE_SENT',
      messageId: newMsg.id
    })
  } catch (err) {
    console.error('Failed to send:', err)
    newMessage.value = content
  } finally {
    isSending.value = false
  }
}

// Delete message
const deleteMessage = async (id: string) => {
  if (!confirm('Delete this message for everyone?')) return
  
  // Optimistically remove from UI
  messages.value = messages.value.filter(m => m.id !== id)
  
  try {
    await $fetch(`/api/chat/${id}`, { method: 'DELETE' })

    // Broadcast instant deletion to all other devices (<100ms)
    notifyChange({
      type: 'CHAT_MESSAGE',
      action: 'CHAT_MESSAGE_DELETED',
      messageId: id
    })
  } catch (err) {
    console.error('Failed to delete message:', err)
    // If it fails, reload the actual messages to restore it
    loadMessages()
  }
}

const handleEnter = (e: KeyboardEvent) => {
  if (e.shiftKey) return
  sendMessage()
}

// Auto-grow textarea
watch(newMessage, () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = '24px'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 120) + 'px'
    }
  })
})
</script>
