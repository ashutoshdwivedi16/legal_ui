import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query client configuration
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true
    },
  },
})

