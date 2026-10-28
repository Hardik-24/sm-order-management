<template>
  <div class="h-full w-full flex flex-col bg-white overflow-hidden select-text overscroll-none">
    <!-- Header (WhatsApp style) -->
    <header class="bg-[#f0f2f5] border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-20">
      <div class="flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 rounded-full bg-[#1b3b5f] flex items-center justify-center text-white shrink-0 shadow-sm">
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
      class="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-3 relative bg-[#efeae2]" 
      ref="chatContainer"
      style="background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); background-repeat: repeat; opacity: 0.95;"
    >
      <!-- Chat Shimmer Bubble Skeletons -->
      <div v-if="pending" class="space-y-4 py-4 max-w-lg mx-auto">
        <div class="flex justify-start">
          <div class="h-12 w-48 rounded-2xl rounded-tl-none animate-shimmer"></div>
        </div>
        <div class="flex justify-end">
          <div class="h-16 w-64 rounded-2xl rounded-tr-none animate-shimmer"></div>
        </div>
        <div class="flex justify-start">
          <div class="h-10 w-40 rounded-2xl rounded-tl-none animate-shimmer"></div>
        </div>
        <div class="flex justify-end">
          <div class="h-14 w-52 rounded-2xl rounded-tr-none animate-shimmer"></div>
        </div>
      </div>
      
      <div v-else-if="messages.length === 0" class="flex justify-center my-10">
        <div class="bg-[#ffeecd] text-[#54656f] text-xs py-2 px-4 rounded-xl shadow-sm inline-block text-center max-w-sm">
          Messages are end-to-end secured by Silicon Marketing.<br/>No one outside this workspace can read them.
        </div>
      </div>

      <template v-else>
        <!-- Security notification banner -->
        <div class="flex justify-center mb-4 sm:mb-6">
          <div class="bg-[#ffeecd] text-[#54656f] text-xs py-1.5 px-4 rounded-lg shadow-sm inline-block text-center max-w-sm">
            Messages are end-to-end secured.
          </div>
        </div>

        <div 
          v-for="(msg, idx) in messages" 
          :key="msg.id"
          :id="`msg-${msg.id}`"
          class="message-bubble flex w-full group items-center relative transition-all duration-300"
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
            class="flex max-w-[88%] sm:max-w-[80%] md:max-w-[70%] transition-transform duration-100 ease-out"
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
                :src="msg.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.user.name)}&background=e8e0d4&color=1b3b5f`" 
                alt="Avatar" 
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm border border-gray-200"
              />
            </div>

            <!-- WhatsApp Native Bubble -->
            <div 
              class="relative rounded-2xl shadow-sm text-[14.5px] leading-snug whitespace-pre-wrap break-words text-[#111b21] flex flex-col cursor-default min-w-[120px] max-w-full overflow-hidden"
              :class="[
                msg.userId === user?.id ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none border border-gray-100',
                getMsgAttachment(msg)?.type === 'image' && !getMessageText(msg) ? 'p-1' : 'px-3 py-2'
              ]"
            >
              <!-- Tail Triangles -->
              <div v-if="msg.userId === user?.id" class="absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-[#d9fdd3] border-r-[10px] border-r-transparent"></div>
              <div v-if="msg.userId !== user?.id" class="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>

              <!-- Sender Name (if not me) -->
              <div v-if="msg.userId !== user?.id" class="flex items-center gap-2 mb-1" :class="getMsgAttachment(msg)?.type === 'image' && !getMessageText(msg) ? 'px-2 pt-1' : ''">
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
                :class="[
                  msg.userId === user?.id ? 'bg-[#0000000a] hover:bg-[#00000014] border-l-[#00a884]' : 'bg-[#f0f2f5] hover:bg-[#e5e7eb] border-l-[#027eb5]',
                  getMsgAttachment(msg)?.type === 'image' && !getMessageText(msg) ? 'mx-1 mt-1' : ''
                ]"
                title="Click to view original message"
              >
                <div class="flex items-center gap-1 font-bold text-[11px] leading-none mb-1" :class="msg.userId === user?.id ? 'text-[#008f6f]' : 'text-[#027eb5]'">
                  <Reply class="w-3 h-3 transform -scale-x-100" />
                  <span>{{ getMsgReply(msg).senderName }}</span>
                </div>
                <div class="text-[#54656f] text-[12px] truncate max-w-[240px] sm:max-w-md">
                  {{ getMsgReply(msg).text }}
                </div>
              </div>

              <!-- ATTACHMENT SECTION -->
              <div v-if="getMsgAttachment(msg)" :class="getMessageText(msg) ? 'mb-1.5' : ''">
                <!-- Case 1: Image Attachment -->
                <div v-if="getMsgAttachment(msg).type === 'image'" class="relative rounded-xl overflow-hidden max-w-sm sm:max-w-md">
                  <!-- A. Image is revealed (Full resolution) -->
                  <div 
                    v-if="isImageRevealed(msg)" 
                    class="relative group/img rounded-xl overflow-hidden bg-black/5 cursor-pointer select-none"
                    @click="openLightbox(getMsgAttachment(msg).url, getMsgAttachment(msg).name, getMsgAttachment(msg).size)"
                  >
                    <img 
                      :src="getMsgAttachment(msg).url" 
                      :alt="getMsgAttachment(msg).name" 
                      loading="lazy"
                      class="w-full max-h-[340px] sm:max-h-[420px] object-cover rounded-xl transition-all duration-200 group-hover/img:brightness-[0.98]"
                    />
                    
                    <!-- Top-Right 1-Tap Save Button -->
                    <button 
                      @click.stop="saveFileToDevice(getMsgAttachment(msg).url, getMsgAttachment(msg).name)"
                      class="absolute top-2 right-2 p-1.5 rounded-full bg-black/45 hover:bg-emerald-600 active:scale-90 text-white backdrop-blur-md shadow-md transition-all flex items-center justify-center z-10"
                      title="Save to Phone/PC"
                    >
                      <Loader2 v-if="downloadingFile === getMsgAttachment(msg).name" class="w-4 h-4 animate-spin" />
                      <Download v-else class="w-4 h-4" />
                    </button>

                    <!-- Bottom Gradient Overlay for High Contrast Timestamp on Image -->
                    <div class="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none rounded-b-xl"></div>

                    <!-- Floating WhatsApp Timestamp badge ON the image (when no caption text) -->
                    <div 
                      v-if="!getMessageText(msg)"
                      class="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-sm text-white text-[10px] font-medium flex items-center gap-1 shadow-sm select-none z-10"
                    >
                      <span>{{ formatTime(msg.createdAt) }}</span>
                      <CheckCheck v-if="msg.userId === user?.id" class="w-3.5 h-3.5 text-[#53bdeb]" />
                    </div>

                    <!-- Archived Badge on Image if from Drive -->
                    <div 
                      v-if="getMsgAttachment(msg).storageProvider === 'gdrive'"
                      class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-sky-200 text-[10px] font-medium flex items-center gap-1 border border-sky-400/20 shadow-sm z-10"
                    >
                      <Cloud class="w-3 h-3 text-sky-400" />
                      <span>Drive Archive</span>
                    </div>
                  </div>

                  <!-- B. WhatsApp-style Blur Preview (Tap to load) -->
                  <div 
                    v-else 
                    class="relative w-64 h-56 rounded-xl overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-3 cursor-pointer select-none group/blur shadow-inner"
                    @click="revealImage(msg.id)"
                  >
                    <!-- Blurred background image -->
                    <img 
                      v-if="getMsgAttachment(msg).blurPreview"
                      :src="getMsgAttachment(msg).blurPreview" 
                      class="absolute inset-0 w-full h-full object-cover filter blur-md scale-110 opacity-75 transition-opacity"
                    />
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-xs"></div>

                    <!-- Center circular WhatsApp download button -->
                    <div class="relative z-10 flex flex-col items-center gap-2">
                      <div class="w-14 h-14 rounded-full bg-black/55 border-2 border-white/50 text-white flex items-center justify-center shadow-2xl group-hover/blur:scale-105 active:scale-95 transition-all">
                        <Download class="w-6 h-6 text-white" />
                      </div>
                      <div class="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-semibold shadow-md flex items-center gap-1.5 border border-white/15">
                        <span>Load Photo</span>
                        <span class="text-white/40">·</span>
                        <span class="text-white/95 text-[11px]">{{ formatFileSize(getMsgAttachment(msg).size) }}</span>
                      </div>
                      <div v-if="getMsgAttachment(msg).storageProvider === 'gdrive'" class="flex items-center gap-1 text-[10px] text-sky-200 bg-sky-950/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-sky-400/30 font-medium shadow-sm">
                        <Cloud class="w-3 h-3 text-sky-400" />
                        <span>Drive Archive</span>
                      </div>
                    </div>

                    <!-- Top right instant Save to Device -->
                    <button 
                      @click.stop="saveFileToDevice(getMsgAttachment(msg).url, getMsgAttachment(msg).name)"
                      class="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 hover:bg-emerald-600 active:scale-90 text-white transition-all shadow-md backdrop-blur-md"
                      title="Save Directly to Device"
                    >
                      <Download class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Case 2: Document / File Attachment (PDF, Excel, Word, etc.) -->
                <div 
                  v-else 
                  class="rounded-xl p-3 transition-colors border max-w-sm sm:max-w-md shadow-xs"
                  :class="msg.userId === user?.id ? 'bg-black/5 hover:bg-black/10 border-black/10' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                      <!-- Badge Icon -->
                      <div 
                        class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                        :class="getFileBadgeClass(getMsgAttachment(msg).name)"
                      >
                        <FileSpreadsheet v-if="isSpreadsheet(getMsgAttachment(msg).name)" class="w-5 h-5 text-white" />
                        <FileText v-else-if="isPdf(getMsgAttachment(msg).name) || isDoc(getMsgAttachment(msg).name)" class="w-5 h-5 text-white" />
                        <File v-else class="w-5 h-5 text-white" />
                      </div>

                      <!-- File Info -->
                      <div class="min-w-0 flex-1">
                        <div class="text-xs sm:text-[13px] font-semibold text-[#111b21] truncate leading-tight">
                          {{ getMsgAttachment(msg).name }}
                        </div>
                        <div class="text-[11px] text-[#667781] mt-0.5 flex items-center gap-1.5 font-medium flex-wrap">
                          <span>{{ formatFileSize(getMsgAttachment(msg).size) }}</span>
                          <span>•</span>
                          <span class="uppercase">{{ getFileExt(getMsgAttachment(msg).name) }}</span>
                          <span v-if="getMsgAttachment(msg).storageProvider === 'gdrive'" class="inline-flex items-center gap-0.5 text-[9.5px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 font-semibold ml-1">
                            <Cloud class="w-2.5 h-2.5 text-sky-600" /> Drive Archive
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- 1-Tap Save to Device Button -->
                    <button 
                      @click.stop="saveFileToDevice(getMsgAttachment(msg).url, getMsgAttachment(msg).name)"
                      class="p-2 rounded-full bg-white hover:bg-emerald-600 hover:text-white text-gray-700 shadow-sm border border-gray-200 transition-all flex items-center justify-center shrink-0 active:scale-95"
                      :title="`Save ${getMsgAttachment(msg).name} to device`"
                    >
                      <Loader2 v-if="downloadingFile === getMsgAttachment(msg).name" class="w-4 h-4 animate-spin text-emerald-600" />
                      <Download v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Content Text (Caption or text message) -->
              <div 
                v-if="getMessageText(msg)" 
                class="min-w-[100px] text-[14.5px] leading-snug break-words"
                :class="getMsgAttachment(msg)?.type === 'image' ? 'px-2 pt-1 pb-4' : 'pr-14'"
                v-html="formatMessage(getMessageText(msg))"
              ></div>

              <!-- Timestamp for text messages OR messages with captions -->
              <span 
                v-if="getMessageText(msg) || !getMsgAttachment(msg) || getMsgAttachment(msg).type !== 'image'"
                class="text-[10px] text-[#667781] absolute bottom-1.5 right-2 flex items-center justify-end select-none"
              >
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

    <!-- Pending Attachment Preview Bar above composer (WhatsApp style) -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0"
    >
      <div 
        v-if="pendingAttachment" 
        class="bg-[#f0f2f5] border-t border-gray-200 px-4 pt-2.5 pb-1 flex items-center justify-between gap-3 shrink-0 z-20"
      >
        <div class="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex items-center gap-3">
          <!-- Thumbnail if image -->
          <div v-if="pendingAttachment.type === 'image'" class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
            <img :src="pendingAttachment.previewUrl" class="w-full h-full object-cover" />
          </div>
          <!-- Icon if document -->
          <div 
            v-else 
            class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
            :class="getFileBadgeClass(pendingAttachment.name)"
          >
            <FileSpreadsheet v-if="isSpreadsheet(pendingAttachment.name)" class="w-5 h-5 text-white" />
            <FileText v-else-if="isPdf(pendingAttachment.name) || isDoc(pendingAttachment.name)" class="w-5 h-5 text-white" />
            <File v-else class="w-5 h-5 text-white" />
          </div>

          <!-- File details -->
          <div class="min-w-0 flex-1">
            <div class="text-xs sm:text-sm font-semibold text-[#111b21] truncate">
              {{ pendingAttachment.name }}
            </div>
            <div class="text-[11px] text-[#667781] flex items-center gap-2 mt-0.5">
              <span>{{ formatFileSize(pendingAttachment.size) }}</span>
              <span v-if="pendingAttachment.type === 'image'" class="text-emerald-600 font-semibold">• High-Res WebP (Text Preserved)</span>
            </div>
          </div>

          <!-- Discard attachment button -->
          <button 
            @click="cancelPendingAttachment" 
            class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Remove attachment"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </transition>

    <!-- Composer Footer (WhatsApp style) -->
    <div class="bg-[#f0f2f5] px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 flex items-end gap-2 sm:gap-2.5 z-20 border-t border-gray-200">
      <!-- Hidden File Input -->
      <input 
        ref="fileInputRef" 
        type="file" 
        class="hidden" 
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" 
        @change="handleFileSelected" 
      />

      <!-- Attachment Button (Paperclip) -->
      <button 
        type="button"
        @click="triggerFilePicker"
        :disabled="isProcessingAttachment || isSending"
        class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-gray-600 hover:text-[#00a884] hover:bg-gray-200/80 transition-colors"
        title="Attach photo or document"
      >
        <Loader2 v-if="isProcessingAttachment" class="w-5 h-5 animate-spin text-[#00a884]" />
        <Paperclip v-else class="w-5 h-5 transform -rotate-45" />
      </button>

      <!-- Input container -->
      <div class="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex items-end px-3 sm:px-4 py-2 relative">
        <textarea
          v-model="newMessage"
          @keydown.enter.prevent="handleEnter"
          @keydown.esc="cancelReply"
          :placeholder="pendingAttachment ? 'Add a caption...' : (replyingTo ? 'Type your reply...' : 'Type a message...')"
          class="w-full bg-transparent text-[15px] text-[#111b21] focus:outline-none resize-none min-h-[24px] max-h-[120px] placeholder:text-[#8696a0]"
          rows="1"
          ref="inputRef"
        ></textarea>
      </div>
      
      <!-- Send Button -->
      <button 
        @click="sendMessage"
        :disabled="(!newMessage.trim() && !pendingAttachment) || isSending || isProcessingAttachment"
        class="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-all text-white shadow-sm"
        :class="(newMessage.trim() || pendingAttachment) && !isSending && !isProcessingAttachment ? 'bg-[#00a884] hover:bg-[#008f6f]' : 'bg-gray-300'"
        :title="pendingAttachment ? 'Send attachment' : 'Send message'"
      >
        <Loader2 v-if="isSending" class="w-5 h-5 animate-spin" />
        <Send v-else class="w-5 h-5 ml-0.5" />
      </button>
    </div>

    <!-- Fullscreen Lightbox Modal with Multi-Touch Pinch-To-Zoom & Pan -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="lightbox" 
        class="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col select-none touch-none pt-[max(env(safe-area-inset-top),10px)] pb-[max(env(safe-area-inset-bottom),14px)] pl-[max(env(safe-area-inset-left),10px)] pr-[max(env(safe-area-inset-right),10px)]"
        @keydown.esc="closeLightbox"
      >
        <!-- Lightbox Top Navigation Bar (Always in Safe Area) -->
        <div class="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-black/70 border-b border-white/10 shrink-0 text-white z-20">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-md">{{ lightbox.name }}</span>
            <span v-if="lightbox.size" class="text-[10px] sm:text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full font-medium shrink-0">
              {{ formatFileSize(lightbox.size) }}
            </span>
          </div>

          <!-- Controls (Zoom, Save to Device, Close) -->
          <div class="flex items-center gap-1.5 sm:gap-2">
            <!-- Zoom Out -->
            <button 
              @click="zoomOut" 
              class="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition active:scale-95"
              title="Zoom out"
            >
              <ZoomOut class="w-4 h-4" />
            </button>

            <!-- Reset Zoom Badge -->
            <button 
              @click="resetZoom"
              class="text-xs text-white/80 font-mono px-1.5 py-0.5 rounded hover:bg-white/10 transition"
              title="Tap to reset zoom (100%)"
            >
              {{ Math.round(lightbox.scale * 100) }}%
            </button>

            <!-- Zoom In -->
            <button 
              @click="zoomIn" 
              class="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition active:scale-95"
              title="Zoom in"
            >
              <ZoomIn class="w-4 h-4" />
            </button>

            <div class="h-4 w-px bg-white/20 mx-0.5 sm:mx-1"></div>

            <!-- 1-Tap Save to Device -->
            <button 
              @click="saveFileToDevice(lightbox.url, lightbox.name)" 
              class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              title="Save to Phone/PC Downloads"
            >
              <Loader2 v-if="downloadingFile === lightbox.name" class="w-3.5 h-3.5 animate-spin" />
              <Download v-else class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Save</span>
            </button>

            <!-- Close Lightbox -->
            <button 
              @click="closeLightbox" 
              class="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition ml-1 active:scale-95"
              title="Close (Esc)"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Lightbox Center Content with Gesture Handlers -->
        <div 
          class="flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-4 relative select-none touch-none"
          @wheel="onLightboxWheel"
          @mousedown="onLightboxMouseDown"
          @mousemove="onLightboxMouseMove"
          @mouseup="onLightboxMouseUp"
          @mouseleave="onLightboxMouseUp"
          @touchstart="onLightboxTouchStart"
          @touchmove="onLightboxTouchMove"
          @touchend="onLightboxTouchEnd"
          @touchcancel="onLightboxTouchEnd"
          @click.self="closeLightbox"
        >
          <img 
            :src="lightbox.url" 
            :alt="lightbox.name"
            class="max-h-[85vh] max-w-[95vw] object-contain rounded-lg shadow-2xl pointer-events-auto select-none"
            :style="{
              transform: `translate(${lightbox.translateX}px, ${lightbox.translateY}px) scale(${lightbox.scale})`,
              transition: isPinchingOrDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
              cursor: lightbox.scale > 1 ? 'grab' : 'zoom-in'
            }"
            draggable="false"
          />

          <!-- Mobile Gesture Hint -->
          <div 
            v-if="lightbox.scale === 1" 
            class="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none transition-opacity duration-300"
          >
            <div class="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/70 text-[11px] font-medium border border-white/10 shadow-sm">
              Pinch or double-tap to zoom
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard-chat' })

import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  MessageSquare, Send, Loader2, CheckCheck, Trash2, Reply, X, 
  Paperclip, Download, FileText, FileSpreadsheet, File, 
  ZoomIn, ZoomOut, Maximize2, Cloud 
} from 'lucide-vue-next'
import { useAuth } from '~/composables/useAuth'
import { useRealtimeSync } from '~/composables/useRealtimeSync'
import { useGsapAnimation } from '~/composables/useGsapAnimation'

const { user } = useAuth()
const { onOrderSync, notifyChange } = useRealtimeSync()
const { animateStagger, initContext } = useGsapAnimation()

const messages = ref<any[]>([])
const pending = ref(true)
const newMessage = ref('')
const isSending = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Reply states
const replyingTo = ref<any | null>(null)
const highlightedMsgId = ref<string | null>(null)

// Attachment states
const isProcessingAttachment = ref(false)
const pendingAttachment = ref<{
  file: Blob | File
  name: string
  size: number
  type: 'image' | 'file'
  mimeType: string
  previewUrl: string
  blurPreview?: string | null
} | null>(null)

// Image reveal states (messages whose full image has been loaded/unblurred)
const revealedImageIds = ref<Set<string>>(new Set())

// Download state for "Save to Device"
const downloadingFile = ref<string | null>(null)

// Lightbox modal state with Pinch-To-Zoom and Pan
const lightbox = ref<{
  url: string
  name: string
  size?: number
  scale: number
  translateX: number
  translateY: number
} | null>(null)

// Gestures tracking for Lightbox
const isPinchingOrDragging = ref(false)
let initialPinchDistance = 0
let initialScaleAtPinch = 1
let panStartPointer = { x: 0, y: 0 }
let lastTapTimestamp = 0
let isMouseDown = false
let mouseDragStart = { x: 0, y: 0 }

function openLightbox(url: string, name: string, size?: number) {
  lightbox.value = {
    url,
    name,
    size,
    scale: 1,
    translateX: 0,
    translateY: 0
  }
}

function closeLightbox() {
  lightbox.value = null
  isPinchingOrDragging.value = false
}

function resetZoom() {
  if (!lightbox.value) return
  lightbox.value.scale = 1
  lightbox.value.translateX = 0
  lightbox.value.translateY = 0
}

function zoomIn() {
  if (!lightbox.value) return
  lightbox.value.scale = Math.min(5, +(lightbox.value.scale + 0.4).toFixed(1))
}

function zoomOut() {
  if (!lightbox.value) return
  const nextScale = Math.max(1, +(lightbox.value.scale - 0.4).toFixed(1))
  lightbox.value.scale = nextScale
  if (nextScale === 1) {
    lightbox.value.translateX = 0
    lightbox.value.translateY = 0
  }
}

// Multi-Touch Pinch-To-Zoom & Pan for Mobile
function onLightboxTouchStart(e: TouchEvent) {
  if (!lightbox.value) return

  if (e.touches.length === 2) {
    // 2 fingers: Pinch to zoom
    isPinchingOrDragging.value = true
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    initialPinchDistance = Math.hypot(dx, dy)
    initialScaleAtPinch = lightbox.value.scale
  } else if (e.touches.length === 1) {
    // 1 finger: Check for double-tap
    const now = Date.now()
    if (now - lastTapTimestamp < 300) {
      // Double tap toggles zoom
      if (lightbox.value.scale > 1.2) {
        resetZoom()
      } else {
        lightbox.value.scale = 2.5
        lightbox.value.translateX = 0
        lightbox.value.translateY = 0
      }
      lastTapTimestamp = 0
      return
    }
    lastTapTimestamp = now

    // If already zoomed in, enable smooth 1-finger pan
    if (lightbox.value.scale > 1) {
      isPinchingOrDragging.value = true
      panStartPointer = {
        x: e.touches[0].clientX - lightbox.value.translateX,
        y: e.touches[0].clientY - lightbox.value.translateY
      }
    }
  }
}

function onLightboxTouchMove(e: TouchEvent) {
  if (!lightbox.value) return

  if (e.touches.length === 2) {
    e.preventDefault()
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const currentDist = Math.hypot(dx, dy)
    if (initialPinchDistance > 0) {
      const factor = currentDist / initialPinchDistance
      const nextScale = Math.min(Math.max(initialScaleAtPinch * factor, 0.8), 5)
      lightbox.value.scale = parseFloat(nextScale.toFixed(2))
    }
  } else if (e.touches.length === 1 && lightbox.value.scale > 1 && isPinchingOrDragging.value) {
    e.preventDefault()
    lightbox.value.translateX = e.touches[0].clientX - panStartPointer.x
    lightbox.value.translateY = e.touches[0].clientY - panStartPointer.y
  }
}

function onLightboxTouchEnd(e: TouchEvent) {
  if (!lightbox.value) return
  if (e.touches.length === 0) {
    isPinchingOrDragging.value = false
    if (lightbox.value.scale < 1) {
      resetZoom()
    }
  } else if (e.touches.length === 1 && lightbox.value.scale > 1) {
    panStartPointer = {
      x: e.touches[0].clientX - lightbox.value.translateX,
      y: e.touches[0].clientY - lightbox.value.translateY
    }
  }
}

// Mouse wheel & drag on desktop
function onLightboxWheel(e: WheelEvent) {
  if (!lightbox.value) return
  e.preventDefault()
  const delta = e.deltaY < 0 ? 0.25 : -0.25
  const nextScale = Math.min(Math.max(lightbox.value.scale + delta, 1), 5)
  lightbox.value.scale = parseFloat(nextScale.toFixed(1))
  if (lightbox.value.scale === 1) {
    lightbox.value.translateX = 0
    lightbox.value.translateY = 0
  }
}

function onLightboxMouseDown(e: MouseEvent) {
  if (!lightbox.value || lightbox.value.scale <= 1) return
  isMouseDown = true
  mouseDragStart = {
    x: e.clientX - lightbox.value.translateX,
    y: e.clientY - lightbox.value.translateY
  }
}

function onLightboxMouseMove(e: MouseEvent) {
  if (!isMouseDown || !lightbox.value || lightbox.value.scale <= 1) return
  lightbox.value.translateX = e.clientX - mouseDragStart.x
  lightbox.value.translateY = e.clientY - mouseDragStart.y
}

function onLightboxMouseUp() {
  isMouseDown = false
}

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

// Attachment File Trigger & Processing
const triggerFilePicker = () => {
  fileInputRef.value?.click()
}

const handleFileSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Size limit check: 15MB
  if (file.size > 15 * 1024 * 1024) {
    alert('File size exceeds 15MB limit. Please choose a smaller file.')
    target.value = ''
    return
  }

  isProcessingAttachment.value = true
  try {
    if (file.type.startsWith('image/')) {
      const processed = await processImageForUpload(file)
      pendingAttachment.value = {
        file: processed.blob,
        name: file.name.replace(/\.[^/.]+$/, '') + '.webp',
        size: processed.blob.size,
        type: 'image',
        mimeType: 'image/webp',
        previewUrl: URL.createObjectURL(processed.blob),
        blurPreview: processed.blurPreview
      }
    } else {
      pendingAttachment.value = {
        file,
        name: file.name,
        size: file.size,
        type: 'file',
        mimeType: file.type || 'application/octet-stream',
        previewUrl: '',
        blurPreview: null
      }
    }
  } catch (err) {
    console.error('Failed to process attachment:', err)
    alert('Could not prepare file for upload.')
  } finally {
    isProcessingAttachment.value = false
    target.value = ''
    nextTick(() => inputRef.value?.focus())
  }
}

const cancelPendingAttachment = () => {
  if (pendingAttachment.value?.previewUrl) {
    URL.revokeObjectURL(pendingAttachment.value.previewUrl)
  }
  pendingAttachment.value = null
}

// Client-side Image Optimization (Preserves Tack-Sharp Text at 2048px + WebP 85%)
async function processImageForUpload(file: File): Promise<{ blob: Blob; blurPreview: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // 1. Generate micro blur preview thumbnail (32px width, ~1KB base64)
        const blurCanvas = document.createElement('canvas')
        const aspect = img.height / img.width
        blurCanvas.width = 32
        blurCanvas.height = Math.max(1, Math.round(32 * aspect))
        const blurCtx = blurCanvas.getContext('2d')
        if (blurCtx) {
          blurCtx.drawImage(img, 0, 0, blurCanvas.width, blurCanvas.height)
        }
        const blurPreview = blurCanvas.toDataURL('image/jpeg', 0.6)

        // 2. High-res downscale preserving razor-sharp text (max 2048px)
        const MAX_DIM = 2048
        let width = img.width
        let height = img.height

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          } else {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)
        }

        // Export as WebP 85% quality: keeps invoice/UPI numbers razor sharp
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, blurPreview })
            } else {
              resolve({ blob: file, blurPreview })
            }
          },
          'image/webp',
          0.85
        )
      }
      img.onerror = () => resolve({ blob: file, blurPreview: '' })
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve({ blob: file, blurPreview: '' })
    reader.readAsDataURL(file)
  })
}

// 1-Tap Save to Device (Phone storage / PC downloads)
async function saveFileToDevice(url: string, filename: string) {
  if (!url) return
  downloadingFile.value = filename
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500)

    // Mobile haptic pulse
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30) } catch (e) {}
    }
  } catch (err) {
    console.warn('Fetch blob download failed, falling back to direct anchor:', err)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'download'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    downloadingFile.value = null
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (lightbox.value) closeLightbox()
    else if (replyingTo.value) cancelReply()
    else if (pendingAttachment.value) cancelPendingAttachment()
  }
}

// WhatsApp-style blur-to-download reveal
function revealImage(msgId: string) {
  revealedImageIds.value.add(msgId)
}

function isImageRevealed(msg: any): boolean {
  if (!msg) return true
  // Sender always sees their own image revealed
  if (msg.userId === user.value?.id) return true
  // If user tapped to load image
  if (revealedImageIds.value.has(msg.id)) return true
  // If image does not have a blur preview
  const att = getMsgAttachment(msg)
  if (!att?.blurPreview) return true
  return false
}

// Content, Reply, and Attachment Parsers
function getMsgAttachment(msg: any): any | null {
  if (!msg) return null
  if (msg.attachment !== undefined) return msg.attachment
  if (typeof msg.content === 'string' && msg.content.startsWith('{') && msg.content.endsWith('}')) {
    try {
      const obj = JSON.parse(msg.content)
      if (obj && obj.attachment) {
        msg.attachment = obj.attachment
        return obj.attachment
      }
    } catch (e) {}
  }
  return null
}

function getMessageText(msg: any): string {
  if (!msg) return ''
  if (msg.parsedContent !== undefined) return msg.parsedContent
  if (typeof msg.content === 'string' && msg.content.startsWith('{') && msg.content.endsWith('}')) {
    try {
      const obj = JSON.parse(msg.content)
      if (obj) {
        if (obj.text !== undefined) {
          msg.parsedContent = obj.text
          msg.replyTo = obj.replyTo || null
          msg.attachment = obj.attachment || null
          return obj.text
        }
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

// Format helpers
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileExt(filename?: string): string {
  if (!filename) return 'FILE'
  return filename.split('.').pop()?.toUpperCase() || 'FILE'
}

function isPdf(filename?: string): boolean {
  return !!filename?.toLowerCase().endsWith('.pdf')
}

function isSpreadsheet(filename?: string): boolean {
  const f = filename?.toLowerCase() || ''
  return f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')
}

function isDoc(filename?: string): boolean {
  const f = filename?.toLowerCase() || ''
  return f.endsWith('.doc') || f.endsWith('.docx') || f.endsWith('.txt')
}

function getFileBadgeClass(filename?: string): string {
  if (isPdf(filename)) return 'bg-red-500'
  if (isSpreadsheet(filename)) return 'bg-emerald-600'
  if (isDoc(filename)) return 'bg-blue-600'
  return 'bg-slate-600'
}

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
  const isFirstLoad = pending.value
  try {
    const data = await $fetch<any[]>('/api/chat')
    messages.value = data
    scrollToBottom()
    if (isFirstLoad) {
      nextTick(() => {
        if (chatContainer.value) {
          const bubbles = chatContainer.value.querySelectorAll('.message-bubble')
          const targetBubbles = Array.from(bubbles).slice(-15)
          if (targetBubbles.length) {
            animateStagger(targetBubbles, { duration: 0.22, stagger: 0.02, y: 10 })
          }
        }
      })
    }
  } catch (err) {
    console.error('Failed to load chat:', err)
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  initContext(chatContainer.value || undefined)
  loadMessages()
  inputRef.value?.focus()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
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

// Send message (Handles both text and attachments)
const sendMessage = async () => {
  if ((!newMessage.value.trim() && !pendingAttachment.value) || isSending.value) return
  
  isSending.value = true
  const content = newMessage.value
  const replyContext = replyingTo.value ? {
    id: replyingTo.value.id,
    senderName: replyingTo.value.user?.name || 'User',
    text: getMessageText(replyingTo.value).slice(0, 150)
  } : null

  const attachmentToSend = pendingAttachment.value

  newMessage.value = '' // Clear UI immediately
  replyingTo.value = null // Clear reply banner
  pendingAttachment.value = null // Clear attachment preview
  
  if (inputRef.value) inputRef.value.style.height = '24px'

  try {
    let uploadedAttachment = null

    // Upload attachment first if present
    if (attachmentToSend) {
      const formData = new FormData()
      formData.append('file', attachmentToSend.file, attachmentToSend.name)
      if (attachmentToSend.blurPreview) {
        formData.append('blurPreview', attachmentToSend.blurPreview)
      }

      const uploadRes = await $fetch<any>('/api/chat/upload', {
        method: 'POST',
        body: formData
      })

      if (uploadRes && uploadRes.success) {
        uploadedAttachment = {
          url: uploadRes.url,
          name: uploadRes.name,
          size: uploadRes.size,
          type: uploadRes.type,
          mimeType: uploadRes.mimeType,
          blurPreview: uploadRes.blurPreview || null
        }
      }
    }

    const newMsg = await $fetch<any>('/api/chat', {
      method: 'POST',
      body: { 
        content,
        replyTo: replyContext,
        attachment: uploadedAttachment
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
    if (attachmentToSend) {
      pendingAttachment.value = attachmentToSend
    }
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