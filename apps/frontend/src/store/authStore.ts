import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'
import { connectSocket, disconnectSocket } from '../lib/socket'

interface User {
  _id: string
  name: string
  email: string
  role: string
  teamId: string
  avatar?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<{ message: string }>
  logout: () => Promise<void>
  clearError: () => void
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          const { user, accessToken, refreshToken } = data.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          set({ user, accessToken, refreshToken, isLoading: false })
          connectSocket()
        } catch (err: any) {
          const msg = err.response?.data?.error || 'Login failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/register', { name, email, password })
          set({ isLoading: false })
          return { message: data.data.message }
        } catch (err: any) {
          const msg = err.response?.data?.error || 'Registration failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout', { refreshToken: get().refreshToken })
        } catch { /* ignore */ }
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        disconnectSocket()
        set({ user: null, accessToken: null, refreshToken: null })
      },

      clearError: () => set({ error: null }),

      hydrate: async () => {
        const token = localStorage.getItem('accessToken')
        if (!token) return
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data.data.user })
          connectSocket()
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          set({ user: null, accessToken: null, refreshToken: null })
        }
      },
    }),
    {
      name: 'auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }),
    }
  )
)
