# Error Handling and Offline Capability

This module provides comprehensive error handling and offline capability for the frontend application, following requirements 5.1 and 5.2.

## Features

### 🛡️ Error Boundaries
- **Global, Page, and Component-level** error boundaries
- **Graceful degradation** with contextual fallback UI
- **Development vs Production** error display modes
- **Error reporting** integration ready

### 🌐 Offline Detection
- **Real-time connectivity monitoring** using browser APIs and network requests
- **Automatic reconnection detection** with periodic health checks
- **Visual offline indicators** with user-friendly messaging
- **Offline state management** with React Context

### 🔄 Retry Logic
- **Exponential backoff** with jitter for optimal retry timing
- **Smart retry conditions** based on error classification
- **Circuit breaker pattern** for preventing cascade failures
- **TanStack Query integration** for server state management

### 📱 User Experience
- **Background sync** when connection is restored
- **Data persistence** during offline periods
- **Clear status messaging** for connection states
- **Manual retry options** for user control

## Quick Start

### 1. Wrap your app with providers

```tsx
import { OfflineProvider, ErrorBoundary } from '@/lib/error'
import { ReactQueryProvider } from '@/lib/error'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ErrorBoundary level="global">
          <ReactQueryProvider>
            <OfflineProvider>
              {children}
            </OfflineProvider>
          </ReactQueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

### 2. Use error handling hooks

```tsx
import { useApiErrorHandling, useOfflineAware } from '@/lib/error'

function MyComponent() {
  const { isOffline } = useOfflineAware()
  const { error, handleError, retryOperation, shouldShowRetry } = useApiErrorHandling()

  const fetchData = async () => {
    try {
      const result = await retryOperation(() => api.getData())
      // Handle success
    } catch (error) {
      handleError(error)
    }
  }

  return (
    <div>
      {isOffline && <div>You're offline</div>}
      {shouldShowRetry && <button onClick={() => retryOperation(fetchData)}>Retry</button>}
    </div>
  )
}
```

### 3. Wrap components with error boundaries

```tsx
import { withErrorBoundary } from '@/lib/error'

const MyComponent = () => {
  // Component that might throw errors
  return <div>Content</div>
}

export default withErrorBoundary(MyComponent, {
  level: 'component',
  onError: (error, errorInfo) => {
    console.log('Component error:', error)
  }
})
```

## API Reference

### Components

#### `<ErrorBoundary>`
React Error Boundary component with multiple fallback levels.

**Props:**
- `level?: 'global' | 'page' | 'component'` - Error boundary scope
- `fallback?: ReactNode` - Custom fallback UI
- `onError?: (error: Error, errorInfo: ErrorInfo) => void` - Error callback

#### `<OfflineProvider>`
Context provider for offline state management.

**Props:**
- `onOffline?: () => void` - Callback when going offline
- `onOnline?: () => void` - Callback when coming online

### Hooks

#### `useErrorHandling(options?)`
Comprehensive error handling with retry logic.

**Returns:**
- `error: Error | null` - Current error state
- `isRetrying: boolean` - Whether a retry is in progress
- `retryCount: number` - Number of retry attempts
- `handleError: (error: unknown) => void` - Error handler function
- `retryOperation: <T>(operation: () => Promise<T>) => Promise<T>` - Retry wrapper
- `manualRetry: <T>(operation: () => Promise<T>) => Promise<void>` - Manual retry
- `clearError: () => void` - Clear error state
- `shouldShowRetry: boolean` - Whether to show retry UI

#### `useOfflineAware()`
Hook for offline state awareness.

**Returns:**
- `isOnline: boolean` - Online status
- `isOffline: boolean` - Offline status
- `lastOnlineTime: Date | null` - Last time online
- `reconnectAttempts: number` - Reconnection attempts

#### `useApiErrorHandling(options?)`
Specialized hook for API error handling with optimized retry settings.

#### `useFormErrorHandling(options?)`
Specialized hook for form error handling (no auto-retry).

### Utilities

#### `retryWithBackoff<T>(operation, options?)`
Retry function with exponential backoff.

**Parameters:**
- `operation: () => Promise<T>` - Async operation to retry
- `options?: RetryOptions` - Retry configuration

**Returns:** `Promise<RetryResult<T>>`

#### `withRetry<T>(fn, options?)`
Decorator for adding retry logic to functions.

#### `CircuitBreaker`
Circuit breaker pattern implementation for preventing cascade failures.

#### `classifyError(error)`
Utility to classify errors by type (NETWORK, SERVER, CLIENT, etc.).

## Configuration

### Retry Options

```tsx
interface RetryOptions {
  maxAttempts?: number        // Default: 3
  initialDelay?: number       // Default: 1000ms
  maxDelay?: number          // Default: 30000ms
  backoffFactor?: number     // Default: 2
  retryCondition?: (error: unknown) => boolean
  onRetry?: (attempt: number, error: unknown) => void
}
```

### TanStack Query Integration

The system automatically configures TanStack Query with:
- **Exponential backoff** retry delays
- **Smart retry conditions** based on error classification
- **Offline-first** network mode
- **Background refetch** on window focus and reconnection
- **Previous data retention** during refetch

## Error Types

The system classifies errors into categories for intelligent retry decisions:

- **NETWORK_ERROR** - Network connectivity issues (retryable)
- **TIMEOUT_ERROR** - Request timeouts (retryable)
- **SERVER_ERROR** - 5xx HTTP status codes (retryable)
- **CLIENT_ERROR** - 4xx HTTP status codes (not retryable)
- **UNKNOWN_ERROR** - Unclassified errors

## Best Practices

1. **Use appropriate error boundary levels** - Global for app crashes, component for isolated failures
2. **Implement manual retry options** - Give users control when automatic retries fail
3. **Provide clear offline messaging** - Keep users informed about connection status
4. **Cache critical data** - Use TanStack Query's caching for offline resilience
5. **Test offline scenarios** - Simulate network failures in development
6. **Monitor error rates** - Track retry attempts and failure patterns

## Integration with Existing Systems

The error handling system integrates seamlessly with:

- **TanStack Query** - Enhanced retry logic and offline support
- **React Context** - Offline state management
- **Shadcn/UI Components** - Consistent error UI patterns
- **TypeScript** - Full type safety throughout

This system ensures a resilient user experience during network issues and system failures while maintaining optimal performance and user feedback.