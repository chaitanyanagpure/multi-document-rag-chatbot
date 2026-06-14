import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, Chat, Message, KnowledgeBase } from '@/types'
import { generateId } from '@/lib/utils'

// ===========================
// Auth Store
// ===========================

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null, refreshToken?: string | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      setToken: (token, refreshToken = null) => {
        if (token) {
          localStorage.setItem('access_token', token)
        } else {
          localStorage.removeItem('access_token')
        }
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken)
        } else if (refreshToken === null) {
          localStorage.removeItem('refresh_token')
        }
        set({ token, refreshToken })
      },

      setLoading: (isLoading) => set({ isLoading }),

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// ===========================
// Chat Store
// ===========================

interface ChatState {
  chats: Chat[]
  activeChat: Chat | null
  messages: Message[]
  isStreaming: boolean
  streamingMessageId: string | null
  streamingContent: string
  isLoadingMessages: boolean
  isLoadingChats: boolean

  setChats: (chats: Chat[]) => void
  addChat: (chat: Chat) => void
  updateChat: (id: string, updates: Partial<Chat>) => void
  removeChat: (id: string) => void
  setActiveChat: (chat: Chat | null) => void

  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void

  startStreaming: (messageId: string) => void
  appendToken: (token: string) => void
  finishStreaming: (finalMessage: Message) => void
  clearStreaming: () => void

  setIsLoadingMessages: (loading: boolean) => void
  setIsLoadingChats: (loading: boolean) => void

  clearMessages: () => void
}

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: [],
  activeChat: null,
  messages: [],
  isStreaming: false,
  streamingMessageId: null,
  streamingContent: '',
  isLoadingMessages: false,
  isLoadingChats: false,

  setChats: (chats) => set({ chats }),

  addChat: (chat) =>
    set((state) => ({
      chats: [chat, ...state.chats],
    })),

  updateChat: (id, updates) =>
    set((state) => ({
      chats: state.chats.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      activeChat:
        state.activeChat?.id === id
          ? { ...state.activeChat, ...updates }
          : state.activeChat,
    })),

  removeChat: (id) =>
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
      activeChat: state.activeChat?.id === id ? null : state.activeChat,
      messages: state.activeChat?.id === id ? [] : state.messages,
    })),

  setActiveChat: (chat) =>
    set({ activeChat: chat, messages: [], streamingContent: '', isStreaming: false }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  startStreaming: (messageId) => {
    const streamingMessage: Message = {
      id: messageId,
      chat_id: get().activeChat?.id || '',
      role: 'assistant',
      content: '',
      is_streaming: true,
      created_at: new Date().toISOString(),
    }
    set((state) => ({
      isStreaming: true,
      streamingMessageId: messageId,
      streamingContent: '',
      messages: [...state.messages, streamingMessage],
    }))
  },

  appendToken: (token) =>
    set((state) => {
      const newContent = state.streamingContent + token
      return {
        streamingContent: newContent,
        messages: state.messages.map((m) =>
          m.id === state.streamingMessageId
            ? { ...m, content: newContent }
            : m
        ),
      }
    }),

  finishStreaming: (finalMessage) =>
    set((state) => ({
      isStreaming: false,
      streamingMessageId: null,
      streamingContent: '',
      messages: state.messages.map((m) =>
        m.id === state.streamingMessageId || m.id === finalMessage.id
          ? { ...finalMessage, is_streaming: false }
          : m
      ),
    })),

  clearStreaming: () =>
    set({ isStreaming: false, streamingMessageId: null, streamingContent: '' }),

  setIsLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),
  setIsLoadingChats: (isLoadingChats) => set({ isLoadingChats }),

  clearMessages: () => set({ messages: [], streamingContent: '', isStreaming: false }),
}))

// ===========================
// Knowledge Base Store
// ===========================

interface KBState {
  knowledgeBases: KnowledgeBase[]
  activeKB: KnowledgeBase | null
  isLoading: boolean

  setKnowledgeBases: (kbs: KnowledgeBase[]) => void
  addKnowledgeBase: (kb: KnowledgeBase) => void
  updateKnowledgeBase: (id: string, updates: Partial<KnowledgeBase>) => void
  removeKnowledgeBase: (id: string) => void
  setActiveKB: (kb: KnowledgeBase | null) => void
  setLoading: (loading: boolean) => void
}

export const useKBStore = create<KBState>()((set) => ({
  knowledgeBases: [],
  activeKB: null,
  isLoading: false,

  setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),

  addKnowledgeBase: (kb) =>
    set((state) => ({
      knowledgeBases: [kb, ...state.knowledgeBases],
    })),

  updateKnowledgeBase: (id, updates) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === id ? { ...kb, ...updates } : kb
      ),
      activeKB:
        state.activeKB?.id === id ? { ...state.activeKB, ...updates } : state.activeKB,
    })),

  removeKnowledgeBase: (id) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== id),
      activeKB: state.activeKB?.id === id ? null : state.activeKB,
    })),

  setActiveKB: (activeKB) => set({ activeKB }),

  setLoading: (isLoading) => set({ isLoading }),
}))

// ===========================
// UI Store (Toast, Sidebar State)
// ===========================

interface ToastItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface UIState {
  sidebarCollapsed: boolean
  chatSidebarOpen: boolean
  toasts: ToastItem[]

  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setChatSidebarOpen: (open: boolean) => void

  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void

  showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string) => void
  showWarning: (title: string, message?: string) => void
  showInfo: (title: string, message?: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      chatSidebarOpen: true,
      toasts: [],

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setChatSidebarOpen: (chatSidebarOpen) => set({ chatSidebarOpen }),

      addToast: (toast) => {
        const id = generateId()
        const duration = toast.duration || 5000
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }))
        if (duration > 0) {
          setTimeout(() => get().removeToast(id), duration)
        }
        return id
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      clearToasts: () => set({ toasts: [] }),

      showSuccess: (title, message) =>
        get().addToast({ type: 'success', title, message }),

      showError: (title, message) =>
        get().addToast({ type: 'error', title, message, duration: 8000 }),

      showWarning: (title, message) =>
        get().addToast({ type: 'warning', title, message }),

      showInfo: (title, message) =>
        get().addToast({ type: 'info', title, message }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        chatSidebarOpen: state.chatSidebarOpen,
      }),
    }
  )
)
