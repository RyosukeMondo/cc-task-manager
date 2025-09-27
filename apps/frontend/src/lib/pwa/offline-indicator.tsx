'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { serviceWorkerManager, ServiceWorkerState } from './service-worker-manager';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const [swState, setSwState] = useState<ServiceWorkerState>(serviceWorkerManager.getState());
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const unsubscribe = serviceWorkerManager.subscribe(setSwState);
    return unsubscribe;
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Try to fetch a simple endpoint to test connectivity
      await fetch('/api/health', { cache: 'no-cache' });
      // If successful, the online event should trigger automatically
    } catch (error) {
      console.log('Still offline, retry failed');
    } finally {
      setTimeout(() => setIsRetrying(false), 1000);
    }
  };

  if (!swState.isOffline) {
    return null;
  }

  return (
    <div className={`
      fixed top-16 left-1/2 transform -translate-x-1/2 z-50
      bg-orange-100 dark:bg-orange-900/50
      border border-orange-200 dark:border-orange-800
      rounded-lg shadow-lg p-3
      ${className}
    `}>
      <div className="flex items-center gap-3">
        <WifiOff className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
            You're offline
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-300">
            Some features may be limited
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
          className="text-xs h-7 px-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
        >
          {isRetrying ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Wifi className="h-3 w-3" />
          )}
          {isRetrying ? 'Retrying...' : 'Retry'}
        </Button>
      </div>
    </div>
  );
}

export default OfflineIndicator;