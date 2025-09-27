'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  level?: 'page' | 'component' | 'global'
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error reporting service (e.g., Sentry)
      this.reportError(error, errorInfo)
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // This would integrate with your error reporting service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level || 'component',
    }

    // Send to error reporting service
    console.log('Error report:', errorReport)
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback based on error level
      const { level = 'component' } = this.props
      const { error } = this.state

      if (level === 'global') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Application Error</CardTitle>
                <CardDescription>
                  Something went wrong. Please try refreshing the page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.env.NODE_ENV === 'development' && error && (
                  <div className="rounded bg-muted p-3 text-sm">
                    <strong>Error:</strong> {error.message}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={this.handleRetry} className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

      if (level === 'page') {
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <div className="text-center space-y-4 max-w-md">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Page Error</h2>
              <p className="text-muted-foreground">
                This page encountered an error. You can try reloading or go back.
              </p>
              {process.env.NODE_ENV === 'development' && error && (
                <div className="rounded bg-muted p-3 text-sm text-left">
                  <strong>Error:</strong> {error.message}
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        )
      }

      // Component level error
      return (
        <div className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Component Error</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            This component failed to load properly.
          </p>
          {process.env.NODE_ENV === 'development' && error && (
            <div className="rounded bg-muted p-2 text-xs mb-3">
              {error.message}
            </div>
          )}
          <Button size="sm" onClick={this.handleRetry}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}