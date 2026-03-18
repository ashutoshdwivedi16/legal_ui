import axios from 'axios'
import { isEmbedMode } from './embed'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // needed for /auth/refresh to send refresh_token cookie
})

// Token handlers registered by authStore to avoid circular dependency
// (authStore imports axios, axios cannot import authStore)
let _getAccessToken: () => string | null = () => null
let _setAccessToken: (token: string | null) => void = () => {}

export function registerTokenHandlers(
  getToken: () => string | null,
  setToken: (token: string | null) => void
) {
  _getAccessToken = getToken
  _setAccessToken = setToken
}

// Inject Bearer header from memory
apiClient.interceptors.request.use((config) => {
  const token = _getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Flag to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

function requestTokenFromParent(): Promise<string> {
  return new Promise((resolve, reject) => {
    const allowedOrigin = import.meta.env.VITE_EMBED_ALLOWED_ORIGIN
    if (!allowedOrigin) {
      reject(new Error('VITE_EMBED_ALLOWED_ORIGIN not configured'))
      return
    }

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('Token refresh timeout'))
    }, 10000)

    const handler = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin) return
      if (event.data?.type === 'TOKEN_REFRESHED' && event.data?.token) {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        resolve(event.data.token)
      }
    }

    window.addEventListener('message', handler)
    window.parent.postMessage({ type: 'TOKEN_REFRESH' }, allowedOrigin)
  })
}

// Response interceptor for handling 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints
      if (originalRequest.url?.startsWith('/auth/')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => apiClient(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        if (isEmbedMode()) {
          const newToken = await requestTokenFromParent()
          _setAccessToken(newToken)
        } else {
          const res = await apiClient.post<{ data: { accessToken: string } }>('/auth/refresh')
          _setAccessToken(res.data.data.accessToken)
        }
        processQueue()
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        _setAccessToken(null)
        if (!isEmbedMode()) {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
