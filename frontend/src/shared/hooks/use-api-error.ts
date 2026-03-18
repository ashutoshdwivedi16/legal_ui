import { useMemo } from 'react'
import type { AxiosError } from 'axios'

interface ApiErrorState {
  isServerError: boolean
  isForbidden: boolean
  message: string | null
}

export function useApiError(error: Error | null | undefined): ApiErrorState {
  return useMemo(() => {
    if (!error) {
      return { isServerError: false, isForbidden: false, message: null }
    }

    const axiosError = error as AxiosError
    const status = axiosError.response?.status

    if (status === 403) {
      return {
        isServerError: false,
        isForbidden: true,
        message: 'You do not have permission to perform this action.',
      }
    }

    if (status && status >= 500) {
      return {
        isServerError: true,
        isForbidden: false,
        message: 'Something went wrong. Please try again later.',
      }
    }

    return {
      isServerError: false,
      isForbidden: false,
      message: error.message,
    }
  }, [error])
}
