'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { classifyError, ErrorTypes } from '../error/RetryLogic'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on client errors (4xx)
              const errorType = classifyError(error)
              if (errorType === ErrorTypes.CLIENT) {
                return false
              }

              // Retry up to 3 times for network, timeout, and server errors
              if (failureCount < 3) {
                return [ErrorTypes.NETWORK, ErrorTypes.TIMEOUT, ErrorTypes.SERVER].includes(errorType)
              }

              return false
            },
            retryDelay: (attemptIndex) => {
              // Exponential backoff with jitter: 1s, 2s, 4s
              const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 10000)
              const jitter = Math.random() * 1000
              return baseDelay + jitter
            },
            // Enable background refetch when window regains focus for offline recovery
            refetchOnWindowFocus: 'always',
            // Retry stale queries when network reconnects
            refetchOnReconnect: 'always',
            // Keep data while refetching for better UX
            keepPreviousData: true,
            // Network mode configuration for offline handling
            networkMode: 'offlineFirst',
          },
          mutations: {
            retry: (failureCount, error) => {
              // Only retry mutations for network errors, not client errors
              const errorType = classifyError(error)

              if (errorType === ErrorTypes.CLIENT) {
                return false
              }

              // Retry mutations once for network/server errors
              return failureCount < 1 && [ErrorTypes.NETWORK, ErrorTypes.SERVER].includes(errorType)
            },
            retryDelay: 2000, // 2 second delay for mutation retries
            networkMode: 'offlineFirst',
          },
        },
        // Global error handling
        mutationCache: {
          onError: (error, variables, context, mutation) => {
            console.error('Mutation error:', {
              error,
              mutationKey: mutation.options.mutationKey,
              variables,
            })
          },
        },
        queryCache: {
          onError: (error, query) => {
            console.error('Query error:', {
              error,
              queryKey: query.queryKey,
            })
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}