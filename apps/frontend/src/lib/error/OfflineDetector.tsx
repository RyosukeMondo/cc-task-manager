'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WifiOff, Wifi, AlertCircle } from 'lucide-react'

interface OfflineContextType {
  isOnline: boolean
  lastOnlineTime: Date | null
  reconnectAttempts: number
  manualRetry: () => void
}

const OfflineContext = createContext<OfflineContextType | null>(null)

export const useOffline = () => {
  const context = useContext(OfflineContext)
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}

interface OfflineProviderProps {
  children: ReactNode
  onOffline?: () => void
  onOnline?: () => void
}

export function OfflineProvider({ children, onOffline, onOnline }: OfflineProviderProps) {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine
    }
    return true
  })
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const checkOnlineStatus = async (): Promise<boolean> => {
    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
      })
      return response.ok
    } catch {
      return false
    }
  }

  const handleOnline = () => {
    setIsOnline(true)
    setReconnectAttempts(0)
    onOnline?.()
  }

  const handleOffline = () => {
    setIsOnline(false)
    setLastOnlineTime(new Date())
    onOffline?.()
  }

  const manualRetry = async () => {
    setReconnectAttempts(prev => prev + 1)
    const online = await checkOnlineStatus()
    if (online) {
      handleOnline()
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initial check
    checkOnlineStatus().then(online => {
      setIsOnline(online)
      if (!online) {
        setLastOnlineTime(new Date())
      }
    })

    // Listen to browser online/offline events
    const handleBrowserOnline = () => {
      // Double-check with actual network request
      checkOnlineStatus().then(online => {
        if (online) {
          handleOnline()
        }
      })
    }

    const handleBrowserOffline = () => {
      handleOffline()
    }

    window.addEventListener('online', handleBrowserOnline)
    window.addEventListener('offline', handleBrowserOffline)

    // Periodic connectivity check when offline
    const interval = setInterval(async () => {
      if (!isOnline) {
        const online = await checkOnlineStatus()
        if (online) {
          handleOnline()
        }
      }
    }, 10000) // Check every 10 seconds when offline

    return () => {
      window.removeEventListener('online', handleBrowserOnline)
      window.removeEventListener('offline', handleBrowserOffline)
      clearInterval(interval)
    }
  }, [isOnline])

  const contextValue: OfflineContextType = {
    isOnline,
    lastOnlineTime,
    reconnectAttempts,
    manualRetry,
  }

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
      <OfflineIndicator />
    </OfflineContext.Provider>
  )
}

function OfflineIndicator() {
  const { isOnline, lastOnlineTime, reconnectAttempts, manualRetry } = useOffline()
  const [showIndicator, setShowIndicator] = useState(!isOnline)

  useEffect(() => {
    if (!isOnline) {
      setShowIndicator(true)
    } else {
      // Hide indicator after a short delay when back online
      const timeout = setTimeout(() => setShowIndicator(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [isOnline])

  if (!showIndicator) return null

  const formatLastOnlineTime = () => {
    if (!lastOnlineTime) return 'Unknown'
    const now = new Date()
    const diff = now.getTime() - lastOnlineTime.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`
    }
    return `${seconds}s ago`
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <Card className={`border-2 ${isOnline ? 'border-green-500 bg-green-50' : 'border-orange-500 bg-orange-50'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-orange-600" />
              )}
              <div>
                <p className={`font-medium ${isOnline ? 'text-green-800' : 'text-orange-800'}`}>
                  {isOnline ? 'Back Online' : 'You\'re Offline'}
                </p>
                {!isOnline && (
                  <p className="text-sm text-orange-600">
                    Last online: {formatLastOnlineTime()}
                  </p>
                )}
              </div>
            </div>

            {!isOnline && (
              <div className="flex items-center gap-2">
                {reconnectAttempts > 0 && (
                  <span className="text-xs text-orange-600">
                    Attempts: {reconnectAttempts}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={manualRetry}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          {!isOnline && (
            <div className="mt-2 flex items-start gap-2 text-sm text-orange-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Some features may not work properly. Your changes will be saved when you're back online.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for components that need to handle offline state
export function useOnlineStatus() {
  const { isOnline } = useOffline()
  return isOnline
}

// Hook for showing offline-specific UI
export function useOfflineAware() {
  const { isOnline, lastOnlineTime, reconnectAttempts } = useOffline()

  return {
    isOnline,
    isOffline: !isOnline,
    lastOnlineTime,
    reconnectAttempts,
    shouldShowOfflineUI: !isOnline,
  }
}