/**
 * Shared TypeScript types
 */

export interface ApiResponse<T> {
  data: T
  meta?: {
    page?: number
    pageSize?: number
    total?: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: string
}

