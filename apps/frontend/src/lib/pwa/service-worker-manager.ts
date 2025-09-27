/**
 * Service Worker Manager for PWA functionality
 * Handles registration, updates, and communication with service worker
 */

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
}

export interface ServiceWorkerMessage {
  type: 'SKIP_WAITING' | 'CACHE_UPDATE' | 'SYNC_BACKGROUND' | 'NOTIFICATION_PERMISSION';
  payload?: any;
}

class ServiceWorkerManager {
  private state: ServiceWorkerState = {
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    isOffline: false,
    registration: null,
  };

  private listeners: ((state: ServiceWorkerState) => void)[] = [];

  constructor() {
    this.state.isSupported = 'serviceWorker' in navigator;
    this.state.isOffline = !navigator.onLine;

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Register the service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.state.isSupported) {
      console.warn('Service workers are not supported in this browser');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      this.state.registration = registration;
      this.state.isRegistered = true;

      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.state.isUpdateAvailable = true;
              this.notifyListeners();
            }
          });
        }
      });

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage);

      this.notifyListeners();
      console.log('Service worker registered successfully');
      return registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      return null;
    }
  }

  /**
   * Update the service worker
   */
  async update(): Promise<void> {
    if (this.state.registration) {
      await this.state.registration.update();
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async skipWaiting(): Promise<void> {
    if (this.state.registration?.waiting) {
      this.sendMessage({ type: 'SKIP_WAITING' });
      this.state.isUpdateAvailable = false;
      this.notifyListeners();
    }
  }

  /**
   * Send message to service worker
   */
  sendMessage(message: ServiceWorkerMessage): void {
    if (this.state.registration?.active) {
      this.state.registration.active.postMessage(message);
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ServiceWorkerState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current state
   */
  getState(): ServiceWorkerState {
    return { ...this.state };
  }

  /**
   * Check if app can be installed
   */
  canInstall(): boolean {
    return this.state.isSupported && this.state.isRegistered;
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.sendMessage({
        type: 'NOTIFICATION_PERMISSION',
        payload: { permission }
      });
      return permission;
    }

    return Notification.permission;
  }

  /**
   * Show notification
   */
  async showNotification(
    title: string,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.state.registration) {
      return;
    }

    if (Notification.permission === 'granted') {
      await this.state.registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'cc-task-manager',
        renotify: true,
        ...options,
      });
    }
  }

  /**
   * Handle messages from service worker
   */
  private handleMessage = (event: MessageEvent): void => {
    const { type, payload } = event.data;

    switch (type) {
      case 'CACHE_UPDATE':
        console.log('Cache updated:', payload);
        break;
      case 'SYNC_BACKGROUND':
        console.log('Background sync completed:', payload);
        break;
      default:
        console.log('Unknown message from service worker:', event.data);
    }
  };

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    this.state.isOffline = false;
    this.notifyListeners();
    console.log('App is back online');
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    this.state.isOffline = true;
    this.notifyListeners();
    console.log('App is offline');
  };

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    if (navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', this.handleMessage);
    }

    this.listeners = [];
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();
export default serviceWorkerManager;