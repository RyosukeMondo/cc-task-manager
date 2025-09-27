'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOffline } from './OfflineDetector'
import { retryWithBackoff, classifyError, ErrorTypes, type RetryOptions } from './RetryLogic'

interface ErrorState {
  error: Error | null
  isRetrying: boolean
  retryCount: number
  lastErrorTime: Date | null
}

interface UseErrorHandlingOptions {
  retryOptions?: RetryOptions
  enableAutomaticRetry?: boolean
  onError?: (error: Error) => void
  onRetrySuccess?: () => void
}

export function useErrorHandling(options: UseErrorHandlingOptions = {}) {
  const { isOnline } = useOffline()
  const queryClient = useQueryClient()
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    lastErrorTime: null,
  })

  const {
    retryOptions = {},
    enableAutomaticRetry = true,
    onError,
    onRetrySuccess,
  } = options

  // Clear errors when coming back online
  useEffect(() => {
    if (isOnline && errorState.error) {
      const errorType = classifyError(errorState.error)
      if (errorType === ErrorTypes.NETWORK) {
        setErrorState(prev => ({
          ...prev,
          error: null,
          isRetrying: false,
        }))
        onRetrySuccess?.()
      }
    }
  }, [isOnline, errorState.error, onRetrySuccess])

  const handleError = useCallback((error: unknown) => {
    const errorObj = error instanceof Error ? error : new Error(String(error))

    setErrorState(prev => ({
      error: errorObj,
      isRetrying: false,
      retryCount: prev.retryCount,
      lastErrorTime: new Date(),
    }))

    onError?.(errorObj)
  }, [onError])

  const retryOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    customRetryOptions?: RetryOptions
  ): Promise<T> => {
    const finalOptions = { ...retryOptions, ...customRetryOptions }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
    }))

    try {
      const result = await retryWithBackoff(operation, {
        ...finalOptions,
        onRetry: (attempt, error) => {
          setErrorState(prev => ({
            ...prev,
            retryCount: attempt,
          }))
          finalOptions.onRetry?.(attempt, error)
        },
      })

      if (result.success) {
        setErrorState({
          error: null,
          isRetrying: false,
          retryCount: 0,
          lastErrorTime: null,
        })
        onRetrySuccess?.()
        return result.data!
      } else {
        throw result.error
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  }, [retryOptions, onRetrySuccess, handleError])

  const manualRetry = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<void> => {
    try {
      await retryOperation(operation)
    } catch {
      // Error is already handled by retryOperation
    }
  }, [retryOperation])

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      lastErrorTime: null,
    })
  }, [])

  const refreshQueries = useCallback(() => {
    queryClient.refetchQueries({
      type: 'active',
      stale: true,
    })
  }, [queryClient])

  return {
    // Error state
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    lastErrorTime: errorState.lastErrorTime,
    hasError: !!errorState.error,

    // Error classification
    errorType: errorState.error ? classifyError(errorState.error) : null,
    isNetworkError: errorState.error ? classifyError(errorState.error) === ErrorTypes.NETWORK : false,
    isServerError: errorState.error ? classifyError(errorState.error) === ErrorTypes.SERVER : false,
    isClientError: errorState.error ? classifyError(errorState.error) === ErrorTypes.CLIENT : false,

    // Actions
    handleError,
    retryOperation,
    manualRetry,
    clearError,
    refreshQueries,

    // Utilities
    shouldShowRetry: !!errorState.error && !errorState.isRetrying && isOnline,
    canRetry: !!errorState.error && [ErrorTypes.NETWORK, ErrorTypes.SERVER, ErrorTypes.TIMEOUT].includes(
      classifyError(errorState.error)
    ),
  }
}

// Specialized hook for API operations
export function useApiErrorHandling(options: UseErrorHandlingOptions = {}) {
  const errorHandling = useErrorHandling({
    ...options,
    retryOptions: {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 2,
      retryCondition: (error) => {
        const errorType = classifyError(error)
        return [ErrorTypes.NETWORK, ErrorTypes.SERVER, ErrorTypes.TIMEOUT].includes(errorType)
      },
      ...options.retryOptions,
    },
  })

  return errorHandling
}

// Hook for form submissions with error handling
export function useFormErrorHandling(options: UseErrorHandlingOptions = {}) {
  const errorHandling = useErrorHandling({
    ...options,
    retryOptions: {
      maxAttempts: 1, // Don't auto-retry form submissions
      ...options.retryOptions,
    },
    enableAutomaticRetry: false,
  })

  return errorHandling
}