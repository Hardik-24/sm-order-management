<template>
  <div class="h-full w-full flex flex-col bg-white overflow-hidden select-text overscroll-none">
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
      class="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3 relative bg-[#efeae2]" 
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
          :id="`msg-${msg.id}`"
          class="flex w-full group items-center relative transition-all duration-300"
          :class="[
            msg.userId === user?.id ? 'justify-end' : 'justify-start',
            highlightedMsgId === msg.id ? 'bg-[#00a884]/20 rounded-xl p-1 shadow-sm' : ''
          ]"
        >
          <!-- Swipe-to-reply floating indicator on touch drag -->
          <div 
            v-if="swipingMsgId === msg.id && swipeDistance > 8"
            class="absolute left-2 flex items-center justify-center pointer-events-none z-10 transition-transform duration-75"
            :style="{
              transform: `scale(${Math.min(swipeDistance / 45, 1.2)})`,
              opacity: Math.min(swipeDistance / 30, 1)
            }"
          >
            <div 
              class="w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-colors"
              :class="swipeDistance >= 45 ? 'bg-[#00a884] text-white' : 'bg-white text-gray-500 border border-gray-200'"
            >
              <Reply class="w-4 h-4 transform -scale-x-100" />
            </div>
          </div>

          <!-- Action buttons (visible on hover) -->
          <div 
            class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all shrink-0 mx-1.5"
            :class="msg.userId === user?.id ? 'order-first' : 'order-last'"
          >
            <button 
              @click="startReply(msg)"
              class="p-1.5 text-gray-400 hover:text-[#00a884] hover:bg-black/5 rounded-full transition-colors"
              title="Reply to message"
            >
              <Reply class="w-4 h-4 transform -scale-x-100" />
            </button>
            <button 
              v-if="msg.userId === user?.id || user?.role === 'ADMIN'"
              @click="deleteMessage(msg.id)"
              class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-black/5 rounded-full transition-colors"
              title="Delete message"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <!-- Message Body Container (with touch swipe support) -->
          <div 
            class="flex max-w-[85%] md:max-w-[70%] transition-transform duration-100 ease-out"
            :class="msg.userId === user?.id ? 'flex-row-reverse' : 'flex-row'"
            :style="swipingMsgId === msg.id ? { transform: `translateX(${swipeDistance}px)` } : {}"
            @touchstart="e => onTouchStart(e, msg)"
            @touchmove="e => onTouchMove(e, msg)"
            @touchend="e => onTouchEnd(e, msg)"
            @touchcancel="e => onTouchEnd(e, msg)"
            @dblclick="startReply(msg)"
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
              class="relative px-3 py-2 rounded-lg shadow-sm text-[14.5px] leading-snug whitespace-pre-wrap break-words text-[#111b21] flex flex-col cursor-default"
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

              <!-- Quoted Reply Reference Box (WhatsApp style) -->
              <div 
                v-if="getMsgReply(msg)" 
                @click.stop="scrollToMessage(getMsgReply(msg).id)"
                class="mb-2 p-2 rounded-md cursor-pointer transition-colors border-l-4 text-xs select-none"
                :class="msg.userId === user?.id ? 'bg-[#0000000a] hover:bg-[#00000014] border-l-[#00a884]' : 'bg-[#f0f2f5] hover:bg-[#e5e7eb] border-l-[#027eb5]'"
                title="Click to view original message"
              >
                <div class="flex items-center gap-1 font-bold text-[11px] leading-none mb-1" :class="msg.userId === user?.id ? 'text-[#008f6f]' : 'text-[#027eb5]'">
                  <Reply class="w-3 h-3 transform -scale-x-100" />
                  <span>{{ getMsgReply(msg).senderName }}</span>
                </div>
                <div class="text-[#54656f] text-[12px] truncate max-w-[260px] sm:max-w-md">
                  {{ getMsgReply(msg).text }}
                </div>
              </div>

              <!-- Content -->
              <div class="pr-14 min-w-[100px]" v-html="formatMessage(getMessageText(msg))"></div>
              
              <!-- Timestamp (Float right inside bubble) -->
              <span class="text-[10px] text-[#667781] absolute bottom-1.5 right-2 flex items-center justify-end select-none">
                {{ formatTime(msg.createdAt) }}
                <CheckCheck v-if="msg.userId === user?.id" class="w-3.5 h-3.5 ml-1 text-[#53bdeb]" />
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Reply Context Bar above composer (WhatsApp style) -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0"
    >
      <div 
        v-if="replyingTo" 
        class="bg-[#f0f2f5] border-t border-gray-200 px-4 pt-2.5 pb-1 flex items-center justify-between gap-3 shrink-0 z-20"
      >
        <div class="flex-1 min-w-0 bg-white border-l-4 border-l-[#00a884] rounded-r-lg px-3 py-1.5 shadow-sm">
          <div class="flex items-center gap-1.5 text-xs font-bold text-[#00a884]">
            <Reply class="w-3.5 h-3.5 transform -scale-x-100" />
            <span>Replying to {{ replyingTo.user?.name || 'User' }}</span>
          </div>
          <p class="text-xs text-[#54656f] truncate mt-0.5">
            {{ getMessageText(replyingTo) }}
          </p>
        </div>
        <button 
          @click="cancelReply" 
          class="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors shrink-0"
          title="Cancel reply (Esc)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </transition>

    <!-- Composer Footer (WhatsApp style) -->
    <div class="bg-[#f0f2f5] px-4 py-3 shrink-0 flex items-end gap-3 z-20 border-t border-gray-200">
      <!-- Input container -->
      <div class="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex items-end px-4 py-2 relative">
        <textarea
          v-model="newMessage"
          @keydown.enter.prevent="handleEnter"
          @keydown.esc="cancelReply"
          :placeholder="replyingTo ? 'Type your reply...' : 'Type a message...'"
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
import { MessageSquare, Send, Loader2, CheckCheck, Trash2, Reply, X } from 'lucide-vue-next'
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

// Reply states
const replyingTo = ref<any | null>(null)
const highlightedMsgId = ref<string | null>(null)

// Swipe-to-reply gesture tracking
const swipingMsgId = ref<string | null>(null)
const swipeDistance = ref<number>(0)
let touchStartX = 0
let touchStartY = 0
let isSwiping = false

const onTouchStart = (e: TouchEvent, msg: any) => {
  if (e.touches.length !== 1) return
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  swipingMsgId.value = msg.id
  swipeDistance.value = 0
  isSwiping = false
}

const onTouchMove = (e: TouchEvent, msg: any) => {
  if (swipingMsgId.value !== msg.id || e.touches.length !== 1) return
  const dx = e.touches[0].clientX - touchStartX
  const dy = Math.abs(e.touches[0].clientY - touchStartY)

  if (!isSwiping) {
    if (dx > 10 && dx > dy) {
      isSwiping = true
    } else if (dy > 10) {
      swipingMsgId.value = null
      return
    }
  }

  if (isSwiping && dx > 0) {
    swipeDistance.value = Math.min(dx * 0.65, 75)
  }
}

const onTouchEnd = (e: TouchEvent, msg: any) => {
  if (swipingMsgId.value === msg.id) {
    if (swipeDistance.value >= 45) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(20) } catch (err) {}
      }
      startReply(msg)
    }
    swipeDistance.value = 0
    swipingMsgId.value = null
    isSwiping = false
  }
}

const startReply = (msg: any) => {
  replyingTo.value = msg
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const cancelReply = () => {
  replyingTo.value = null
}

const scrollToMessage = (targetId: string) => {
  if (!targetId) return
  const el = document.getElementById(`msg-${targetId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedMsgId.value = targetId
    setTimeout(() => {
      if (highlightedMsgId.value === targetId) {
        highlightedMsgId.value = null
      }
    }, 1500)
  }
}

// Content and Reply Helpers
function getMessageText(msg: any): string {
  if (!msg) return ''
  if (msg.parsedContent !== undefined) return msg.parsedContent
  if (typeof msg.content === 'string' && msg.content.startsWith('{') && msg.content.endsWith('}')) {
    try {
      const obj = JSON.parse(msg.content)
      if (obj && obj.text !== undefined) {
        msg.parsedContent = obj.text
        msg.replyTo = obj.replyTo || null
        return obj.text
      }
    } catch (e) {}
  }
  return msg.content || ''
}

function getMsgReply(msg: any): any | null {
  if (!msg) return null
  if (msg.replyTo) return msg.replyTo
  if (typeof msg.content === 'string' && msg.content.startsWith('{') && msg.content.endsWith('}')) {
    try {
      const obj = JSON.parse(msg.content)
      if (obj && obj.replyTo) {
        msg.replyTo = obj.replyTo
        return obj.replyTo
      }
    } catch (e) {}
  }
  return null
}

// Format timestamps
function formatTime(isoStr: string) {
  const d = new Date(isoStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Auto-link order numbers
function formatMessage(text: string) {
  if (!text) return ''
  let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
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
let chatDebounce: any = null
onOrderSync((event) => {
  if (event.type === 'DB_CHAT_CHANGE' || event.type === 'CHAT_MESSAGE' || event.action === 'CHAT_MESSAGE_SENT' || event.action === 'CHAT_MESSAGE_DELETED') {
    if (chatDebounce) clearTimeout(chatDebounce)
    chatDebounce = setTimeout(() => {
      loadMessages()
    }, 50)
  }
})

// Send message
const sendMessage = async () => {
  if (!newMessage.value.trim() || isSending.value) return
  
  isSending.value = true
  const content = newMessage.value
  const replyContext = replyingTo.value ? {
    id: replyingTo.value.id,
    senderName: replyingTo.value.user?.name || 'User',
    text: getMessageText(replyingTo.value).slice(0, 150)
  } : null

  newMessage.value = '' // Clear UI immediately
  replyingTo.value = null // Clear reply banner
  
  if (inputRef.value) inputRef.value.style.height = '24px'

  try {
    const newMsg = await $fetch<any>('/api/chat', {
      method: 'POST',
      body: { 
        content,
        replyTo: replyContext
      }
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
  
  messages.value = messages.value.filter(m => m.id !== id)
  
  try {
    await $fetch(`/api/chat/${id}`, { method: 'DELETE' })

    notifyChange({
      type: 'CHAT_MESSAGE',
      action: 'CHAT_MESSAGE_DELETED',
      messageId: id
    })
  } catch (err) {
    console.error('Failed to delete message:', err)
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

