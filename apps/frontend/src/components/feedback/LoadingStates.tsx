'use client'

import React from 'react'
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// Basic Loading Spinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  label
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={cn('animate-spin', sizeClasses[size])} />
        {label && (
          <span className="text-sm text-muted-foreground animate-pulse">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

// Inline Loading Indicator
interface InlineLoadingProps {
  text?: string
  className?: string
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  text = 'Loading...',
  className
}) => (
  <div className={cn('flex items-center space-x-2', className)}>
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm text-muted-foreground">{text}</span>
  </div>
)

// Button Loading State
interface LoadingButtonProps {
  isLoading: boolean
  children: React.ReactNode
  loadingText?: string
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  children,
  loadingText,
  disabled,
  variant = 'default',
  size = 'default',
  onClick,
  className,
  type = 'button',
  ...props
}) => (
  <Button
    variant={variant}
    size={size}
    disabled={disabled || isLoading}
    onClick={onClick}
    className={className}
    type={type}
    {...props}
  >
    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {isLoading ? loadingText || 'Loading...' : children}
  </Button>
)

// Skeleton Loader Components
interface SkeletonProps {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div
    className={cn(
      'animate-pulse rounded-md bg-muted',
      className
    )}
  />
)

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        className={cn(
          'h-4',
          i === lines - 1 ? 'w-3/4' : 'w-full'
        )}
      />
    ))}
  </div>
)

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={className}>
    <CardHeader className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </CardHeader>
    <CardContent className="space-y-2">
      <SkeletonText lines={3} />
    </CardContent>
  </Card>
)

export const SkeletonTable: React.FC<{
  rows?: number
  columns?: number
  className?: string
}> = ({
  rows = 5,
  columns = 4,
  className
}) => (
  <div className={cn('space-y-3', className)}>
    {/* Header */}
    <div className="flex space-x-4">
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} className="h-6 flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex space-x-4">
        {Array.from({ length: columns }, (_, j) => (
          <Skeleton key={j} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
)

// Progress Loading with Steps
interface ProgressLoadingProps {
  steps: string[]
  currentStep: number
  progress?: number
  className?: string
}

export const ProgressLoading: React.FC<ProgressLoadingProps> = ({
  steps,
  currentStep,
  progress,
  className
}) => (
  <div className={cn('space-y-4', className)}>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Step {currentStep + 1} of {steps.length}</span>
        {progress !== undefined && <span>{Math.round(progress)}%</span>}
      </div>
      {progress !== undefined && <Progress value={progress} />}
    </div>

    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center space-x-3 text-sm',
            index < currentStep && 'text-green-600',
            index === currentStep && 'text-blue-600 font-medium',
            index > currentStep && 'text-muted-foreground'
          )}
        >
          {index < currentStep ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : index === currentStep ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{step}</span>
        </div>
      ))}
    </div>
  </div>
)

// Full Page Loading
interface FullPageLoadingProps {
  title?: string
  description?: string
  progress?: number
  steps?: string[]
  currentStep?: number
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({
  title = 'Loading',
  description = 'Please wait while we prepare your content...',
  progress,
  steps,
  currentStep
}) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {steps && currentStep !== undefined && (
          <ProgressLoading
            steps={steps}
            currentStep={currentStep}
            progress={progress}
          />
        )}
      </CardContent>
    </Card>
  </div>
)

// Empty State with Loading Option
interface EmptyStateProps {
  title: string
  description?: string
  isLoading?: boolean
  loadingText?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  isLoading = false,
  loadingText = 'Loading data...',
  action,
  icon,
  className
}) => (
  <div className={cn(
    'flex flex-col items-center justify-center min-h-[400px] p-8 text-center',
    className
  )}>
    <div className="space-y-4 max-w-md">
      {isLoading ? (
        <LoadingSpinner size="lg" label={loadingText} />
      ) : (
        <>
          {icon && <div className="mx-auto">{icon}</div>}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="pt-4">{action}</div>}
        </>
      )}
    </div>
  </div>
)

// Retry Loading Component
interface RetryLoadingProps {
  isLoading: boolean
  error?: string | null
  onRetry: () => void
  retryText?: string
  loadingText?: string
  className?: string
}

export const RetryLoading: React.FC<RetryLoadingProps> = ({
  isLoading,
  error,
  onRetry,
  retryText = 'Retry',
  loadingText = 'Loading...',
  className
}) => {
  if (isLoading) {
    return <InlineLoading text={loadingText} className={className} />
  }

  if (error) {
    return (
      <div className={cn('flex items-center space-x-2 text-destructive', className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="ml-2"
        >
          <RefreshCw className="mr-2 h-3 w-3" />
          {retryText}
        </Button>
      </div>
    )
  }

  return null
}

// Loading Overlay
interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  progress?: number
  className?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  progress,
  className
}) => {
  if (!isVisible) return null

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
      className
    )}>
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">{message}</p>
              {progress !== undefined && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {Math.round(progress)}% complete
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export type {
  LoadingSpinnerProps,
  InlineLoadingProps,
  LoadingButtonProps,
  ProgressLoadingProps,
  FullPageLoadingProps,
  EmptyStateProps,
  RetryLoadingProps,
  LoadingOverlayProps
}