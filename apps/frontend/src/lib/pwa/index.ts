/**
 * PWA Library Exports
 * Progressive Web App functionality for CC Task Manager
 */

// Core managers
export { serviceWorkerManager, type ServiceWorkerState, type ServiceWorkerMessage } from './service-worker-manager';
export { backgroundSyncManager, type SyncQueueItem, type BackgroundSyncOptions } from './background-sync';

// React components and hooks
export { PWAProvider, usePWA } from './pwa-provider';
export { InstallPrompt } from './install-prompt';
export { OfflineIndicator } from './offline-indicator';

// Utility functions
export const PWAUtils = {
  /**
   * Check if the app is running in standalone mode
   */
  isStandalone(): boolean {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    return isStandalone || isInWebAppiOS;
  },

  /**
   * Check if PWA features are supported
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      'serviceWorker' in navigator &&
      'Promise' in window &&
      'Cache' in window &&
      'caches' in window
    );
  },

  /**
   * Check if background sync is supported
   */
  isBackgroundSyncSupported(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      'serviceWorker' in navigator &&
      'sync' in window.ServiceWorkerRegistration.prototype
    );
  },

  /**
   * Check if push notifications are supported
   */
  isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /**
   * Get install prompt availability
   */
  canShowInstallPrompt(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      !this.isStandalone() &&
      this.isSupported() &&
      'beforeinstallprompt' in window
    );
  },

  /**
   * Check network status
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  },

  /**
   * Get effective connection type (if available)
   */
  getConnectionType(): string | null {
    if (typeof navigator === 'undefined') return null;

    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    return connection?.effectiveType || null;
  },

  /**
   * Estimate network speed
   */
  isSlowConnection(): boolean {
    const connectionType = this.getConnectionType();
    return connectionType === 'slow-2g' || connectionType === '2g';
  },

  /**
   * Check if device is mobile
   */
  isMobile(): boolean {
    if (typeof window === 'undefined') return false;

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  },

  /**
   * Get app version from manifest
   */
  async getAppVersion(): Promise<string | null> {
    try {
      const response = await fetch('/manifest.json');
      const manifest = await response.json();
      return manifest.version || null;
    } catch {
      return null;
    }
  },

  /**
   * Calculate cache size (approximation)
   */
  async getCacheSize(): Promise<number> {
    if (!('caches' in window)) return 0;

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  },

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
};

export default {
  serviceWorkerManager,
  backgroundSyncManager,
  PWAProvider,
  usePWA,
  InstallPrompt,
  OfflineIndicator,
  PWAUtils
};