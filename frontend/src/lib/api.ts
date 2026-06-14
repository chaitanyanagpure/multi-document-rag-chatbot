import axios, { AxiosInstance } from 'axios'
import type {
  User,
  KnowledgeBase,
  Document,
  Chat,
  Message,
  Citation,
  OrgSettings
} from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Axios base client
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 120 seconds – covers large document uploads and slow LLM calls
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor for auto token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) throw new Error('No refresh token available')

        const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const { access_token, refresh_token: newRefreshToken } = refreshRes.data
        localStorage.setItem('access_token', access_token)
        localStorage.setItem('refresh_token', newRefreshToken)

        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`
        }
        return axiosInstance(originalRequest)
      } catch (err) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        if (typeof window !== 'undefined') {
          window.location.href = '/'
        }
        return Promise.reject(err)
      }
    }
    return Promise.reject(error)
  }
)

// Unified API mapping matching frontend page calls
export const api = {
  auth: {
    login: async (data: any) => {
      const res = await axiosInstance.post('/auth/login', data)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      return res.data
    },
    googleLogin: async (googleAccessToken: string) => {
      const res = await axiosInstance.post('/auth/google', { token: googleAccessToken })
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      return res.data
    },
    register: async (data: any) => {
      const res = await axiosInstance.post('/auth/register', data)
      return res.data
    },
    logout: async () => {
      try {
        await axiosInstance.post('/auth/logout')
      } catch (e) {}
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
    getMe: async (): Promise<User> => {
      const res = await axiosInstance.get('/auth/me')
      return res.data
    },
    updateMe: async (data: { full_name: string }): Promise<User> => {
      const res = await axiosInstance.put('/auth/me', data)
      return res.data
    },
    changePassword: async (data: any) => {
      const res = await axiosInstance.post('/auth/change-password', data)
      return res.data
    }
  },

  knowledgeBases: {
    list: async (): Promise<KnowledgeBase[]> => {
      const res = await axiosInstance.get('/kb')
      return res.data
    },
    create: async (data: { name: string; description: string; settings_json?: any }): Promise<KnowledgeBase> => {
      const res = await axiosInstance.post('/kb', data)
      return res.data
    },
    get: async (id: string): Promise<KnowledgeBase> => {
      const res = await axiosInstance.get(`/kb/${id}`)
      return res.data
    },
    update: async (id: string, data: any): Promise<KnowledgeBase> => {
      const res = await axiosInstance.put(`/kb/${id}`, data)
      return res.data
    },
    delete: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/kb/${id}`)
    }
  },

  documents: {
    list: async (kbId: string): Promise<Document[]> => {
      const res = await axiosInstance.get(`/kb/${kbId}/documents`)
      return res.data
    },
    upload: async (kbId: string, file: File, onUploadProgress?: (progressEvent: any) => void): Promise<Document> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await axiosInstance.post(`/kb/${kbId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 minutes for file upload + ingestion trigger
        onUploadProgress
      })
      return res.data
    },
    delete: async (kbId: string, docId: string): Promise<void> => {
      await axiosInstance.delete(`/kb/${kbId}/documents/${docId}`)
    },
    getStatus: (docId: string, onProgress: (progress: any) => void): EventSource => {
      const token = localStorage.getItem('access_token')
      const eventSource = new EventSource(`${API_URL}/documents/${docId}/status?token=${token}`)
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onProgress(data)
        } catch (e) {}
      }
      return eventSource
    }
  },

  chats: {
    list: async (): Promise<Chat[]> => {
      const res = await axiosInstance.get('/chats')
      return res.data
    },
    create: async (data: { title?: string; kb_id: string }): Promise<Chat> => {
      const res = await axiosInstance.post('/chats', data)
      return res.data
    },
    get: async (id: string): Promise<Chat> => {
      const res = await axiosInstance.get(`/chats/${id}`)
      return res.data
    },
    update: async (id: string, data: { title?: string; is_pinned?: boolean; folder_name?: string }): Promise<Chat> => {
      const res = await axiosInstance.put(`/chats/${id}`, data)
      return res.data
    },
    delete: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/chats/${id}`)
    }
  },

  messages: {
    list: async (chatId: string): Promise<Message[]> => {
      const res = await axiosInstance.get(`/chats/${chatId}/messages`)
      return res.data
    },
    sendMessage: async (chatId: string, message: string, onEvent: (event: any) => void): Promise<void> => {
      const token = localStorage.getItem('access_token')
      const payload = { message, config: {} }
      
      const response = await fetch(`${API_URL}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const cleanLine = line.trim()
          if (cleanLine.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(cleanLine.substring(6))
              onEvent(eventData)
            } catch (e) {}
          }
        }
      }
    }
  },

  analytics: {
    getOverview: async () => {
      const res = await axiosInstance.get('/analytics/overview')
      return res.data
    },
    getQueries: async (days: number) => {
      const res = await axiosInstance.get('/analytics/queries', { params: { days } })
      return res.data
    },
    getTokens: async (days: number) => {
      const res = await axiosInstance.get('/analytics/tokens', { params: { days } })
      return res.data
    },
    getLatency: async (days: number) => {
      const res = await axiosInstance.get('/analytics/latency', { params: { days } })
      return res.data
    },
    getDocuments: async (limit: number) => {
      const res = await axiosInstance.get('/analytics/documents', { params: { limit } })
      return res.data
    }
  },

  admin: {
    listUsers: async (): Promise<User[]> => {
      const res = await axiosInstance.get('/admin/users')
      return res.data
    },
    updateUser: async (userId: string, data: { role?: string; is_active?: boolean }): Promise<User> => {
      const res = await axiosInstance.put(`/admin/users/${userId}`, data)
      return res.data
    },
    deleteUser: async (userId: string): Promise<void> => {
      await axiosInstance.delete(`/admin/users/${userId}`)
    },
    getAuditLogs: async () => {
      const res = await axiosInstance.get('/admin/audit-logs')
      return res.data
    },
    getSystemStats: async () => {
      const res = await axiosInstance.get('/admin/system-stats')
      return res.data
    }
  },

  settings: {
    get: async (): Promise<OrgSettings> => {
      const res = await axiosInstance.get('/settings')
      return res.data
    },
    update: async (data: Partial<OrgSettings>): Promise<OrgSettings> => {
      const res = await axiosInstance.put('/settings', data)
      return res.data
    }
  }
}

export const authAPI = api.auth

export default api

