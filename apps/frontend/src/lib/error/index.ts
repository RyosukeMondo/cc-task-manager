// Error Boundary Components
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary'

// Offline Detection and Handling
export {
  OfflineProvider,
  useOffline,
  useOnlineStatus,
  useOfflineAware,
} from './OfflineDetector'

// Retry Logic and Circuit Breaker
export {
  retryWithBackoff,
  withRetry,
  CircuitBreaker,
  classifyError,
  ErrorTypes,
  safeAsync,
  type RetryOptions,
  type RetryResult,
} from './RetryLogic'

// Comprehensive Error Handling Hooks
export {
  useErrorHandling,
  useApiErrorHandling,
  useFormErrorHandling,
} from './useErrorHandling'

// Re-export enhanced providers
export { ReactQueryProvider } from '../api/providers'