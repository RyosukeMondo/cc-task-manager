'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { serviceWorkerManager, ServiceWorkerState } from './service-worker-manager';
import { backgroundSyncManager, SyncQueueItem } from './background-sync';
import InstallPrompt from './install-prompt';
import OfflineIndicator from './offline-indicator';

interface PWAContextValue {
  serviceWorkerState: ServiceWorkerState;
  syncQueue: SyncQueueItem[];
  isUpdateAvailable: boolean;
  isOffline: boolean;
  canInstall: boolean;

  // Actions
  updateServiceWorker: () => Promise<void>;
  registerBackgroundSync: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>) => Promise<string>;
  showInstallPrompt: boolean;
  setShowInstallPrompt: (show: boolean) => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
}

const PWAContext = createContext<PWAContextValue | null>(null);

interface PWAProviderProps {
  children: React.ReactNode;
  showInstallPrompt?: boolean;
  showOfflineIndicator?: boolean;
}

export function PWAProvider({
  children,
  showInstallPrompt = true,
  showOfflineIndicator = true
}: PWAProviderProps) {
  const [serviceWorkerState, setServiceWorkerState] = useState<ServiceWorkerState>(
    serviceWorkerManager.getState()
  );
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    // Register service worker
    serviceWorkerManager.register();

    // Subscribe to service worker state changes
    const unsubscribeSW = serviceWorkerManager.subscribe(setServiceWorkerState);

    // Update sync queue status
    const updateSyncQueue = () => {
      const status = backgroundSyncManager.getQueueStatus();
      setSyncQueue(status.items);
    };

    updateSyncQueue();

    // Set up periodic sync queue updates
    const syncInterval = setInterval(updateSyncQueue, 5000);

    return () => {
      unsubscribeSW();
      clearInterval(syncInterval);
    };
  }, []);

  const updateServiceWorker = useCallback(async () => {
    await serviceWorkerManager.skipWaiting();
    window.location.reload();
  }, []);

  const registerBackgroundSync = useCallback(async (
    item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>
  ) => {
    const id = await backgroundSyncManager.register(item);

    // Update sync queue status
    const status = backgroundSyncManager.getQueueStatus();
    setSyncQueue(status.items);

    return id;
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    return await serviceWorkerManager.requestNotificationPermission();
  }, []);

  const showNotification = useCallback(async (
    title: string,
    options?: NotificationOptions
  ) => {
    await serviceWorkerManager.showNotification(title, options);
  }, []);

  const contextValue: PWAContextValue = {
    serviceWorkerState,
    syncQueue,
    isUpdateAvailable: serviceWorkerState.isUpdateAvailable,
    isOffline: serviceWorkerState.isOffline,
    canInstall: serviceWorkerManager.canInstall(),
    updateServiceWorker,
    registerBackgroundSync,
    showInstallPrompt: showInstall,
    setShowInstallPrompt: setShowInstall,
    requestNotificationPermission,
    showNotification,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

      {/* PWA UI Components */}
      {showInstallPrompt && (
        <InstallPrompt
          onInstall={() => setShowInstall(false)}
          onDismiss={() => setShowInstall(false)}
        />
      )}

      {showOfflineIndicator && <OfflineIndicator />}

      {/* Update available notification */}
      {serviceWorkerState.isUpdateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-3">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Update Available
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                A new version of the app is available
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={updateServiceWorker}
              className="flex-1 text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={() => setServiceWorkerState(prev => ({ ...prev, isUpdateAvailable: false }))}
              className="text-xs px-3 py-1 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}

export function usePWA(): PWAContextValue {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

export default PWAProvider;