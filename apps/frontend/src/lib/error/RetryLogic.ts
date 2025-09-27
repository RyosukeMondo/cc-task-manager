export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: unknown) => boolean
  onRetry?: (attempt: number, error: unknown) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: unknown
  attempts: number
  totalTime: number
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryCondition: (error: unknown) => {
    // Retry on network errors, 5xx server errors, and timeout errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()
      return (
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection')
      )
    }

    // Retry on HTTP errors
    if (typeof error === 'object' && error !== null) {
      const httpError = error as { status?: number; code?: string }
      if (httpError.status) {
        // Retry on 5xx server errors and 408 timeout
        return httpError.status >= 500 || httpError.status === 408
      }
      if (httpError.code) {
        // Retry on common network error codes
        return ['NETWORK_ERROR', 'TIMEOUT', 'CONNECTION_ERROR'].includes(httpError.code)
      }
    }

    return false
  },
  onRetry: () => {},
}

/**
 * Exponential backoff retry function
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...defaultRetryOptions, ...options }
  const startTime = Date.now()
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await operation()
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTime: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error

      // Don't retry if this is the last attempt or retry condition fails
      if (attempt === opts.maxAttempts || !opts.retryCondition(error)) {
        break
      }

      // Calculate delay with exponential backoff
      const baseDelay = opts.initialDelay * Math.pow(opts.backoffFactor, attempt - 1)
      const jitteredDelay = baseDelay + Math.random() * 1000 // Add jitter
      const delay = Math.min(jitteredDelay, opts.maxDelay)

      opts.onRetry(attempt, error)

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxAttempts,
    totalTime: Date.now() - startTime,
  }
}

/**
 * Retry decorator for functions
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const result = await retryWithBackoff(() => fn(...args), options)
    if (result.success) {
      return result.data
    }
    throw result.error
  }) as T
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime: number | null = null
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly options: {
      failureThreshold: number
      recoveryTimeout: number
      monitoringPeriod: number
    } = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime >= this.options.recoveryTimeout
    )
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState(): string {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  reset(): void {
    this.failureCount = 0
    this.lastFailureTime = null
    this.state = 'CLOSED'
  }
}

/**
 * Error classification utilities
 */
export const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  SERVER: 'SERVER_ERROR',
  CLIENT: 'CLIENT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
} as const

export function classifyError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('network') || message.includes('fetch')) {
      return ErrorTypes.NETWORK
    }

    if (message.includes('timeout')) {
      return ErrorTypes.TIMEOUT
    }
  }

  if (typeof error === 'object' && error !== null) {
    const httpError = error as { status?: number }
    if (httpError.status) {
      if (httpError.status >= 500) {
        return ErrorTypes.SERVER
      }
      if (httpError.status >= 400) {
        return ErrorTypes.CLIENT
      }
    }
  }

  return ErrorTypes.UNKNOWN
}

/**
 * Utility for handling async operations with proper error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<{ data: T | undefined; error: unknown | null }> {
  try {
    const data = await operation()
    return { data, error: null }
  } catch (error) {
    console.error('Safe async operation failed:', error)
    return { data: fallback, error }
  }
}