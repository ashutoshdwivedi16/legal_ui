import { create } from 'zustand'
import apiClient, { registerTokenHandlers } from '@shared/lib/axios'
import type { User, AuthState } from '../types'

interface AuthActions {
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
}

type AuthStore = AuthState & { accessToken: string | null } & AuthActions

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      // Only call /auth/refresh if no token in memory (browser refresh, first load)
      // SPA navigations already have token in Zustand — skip the refresh call
      if (!get().accessToken) {
        const tokenRes = await apiClient.post<{ data: { accessToken: string } }>('/auth/refresh')
        const accessToken = tokenRes.data.data.accessToken
        set({ accessToken })
      }

      // Get user info (Bearer header auto-injected by interceptor)
      const response = await apiClient.get<{ data: User }>('/auth/me')
      set({
        isAuthenticated: true,
        user: response.data.data,
        isLoading: false,
      })
    } catch {
      set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        isLoading: false,
      })
    }
  },

  logout: async () => {
    try {
      const response = await apiClient.post<{ data: { logoutUrl: string } }>('/auth/logout')
      const logoutUrl = response.data.data?.logoutUrl
      set({ accessToken: null })
      window.location.href = logoutUrl || '/login'
    } catch {
      set({ accessToken: null })
      window.location.href = '/login'
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setAccessToken: (token) => set({ accessToken: token }),
}))

// Wire up token handlers so axios interceptors can access the store
// without importing authStore (which would create a circular dependency)
registerTokenHandlers(
  () => useAuthStore.getState().accessToken,
  (token) => useAuthStore.getState().setAccessToken(token)
)
