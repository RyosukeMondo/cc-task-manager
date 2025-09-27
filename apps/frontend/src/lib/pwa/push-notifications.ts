/**
 * Push Notifications Manager for PWA
 * Handles push notification subscriptions and messaging
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

class PushNotificationManager {
  private subscription: PushSubscription | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = this.checkSupport();
  }

  /**
   * Check if push notifications are supported
   */
  private checkSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(applicationServerKey?: string): Promise<PushSubscription | null> {
    if (!this.isSupported || Notification.permission !== 'granted') {
      console.warn('Push notifications not available or not permitted');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        return existingSubscription;
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey || this.getApplicationServerKey(),
      });

      this.subscription = subscription;

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      console.log('Push notification subscription successful');
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      if (success) {
        await this.removeSubscriptionFromServer(this.subscription);
        this.subscription = null;
        console.log('Push notification unsubscription successful');
      }
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Get current subscription
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.isSupported) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  /**
   * Check if currently subscribed
   */
  async isSubscribed(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return subscription !== null;
  }

  /**
   * Show local notification
   */
  async showNotification(payload: NotificationPayload): Promise<void> {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-72x72.png',
        image: payload.image,
        tag: payload.tag || 'cc-task-manager',
        data: payload.data,
        actions: payload.actions || [],
        requireInteraction: payload.requireInteraction || false,
        silent: payload.silent || false,
        vibrate: payload.vibrate || [200, 100, 200],
        renotify: true,
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${apiUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: this.serializeSubscription(subscription),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      // Don't throw - subscription can still work locally
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${apiUrl}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: this.serializeSubscription(subscription),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscription from server');
      }
    } catch (error) {
      console.error('Error removing subscription from server:', error);
      // Don't throw - unsubscription can still work locally
    }
  }

  /**
   * Serialize subscription for transmission
   */
  private serializeSubscription(subscription: PushSubscription): PushSubscriptionData {
    const keys = subscription.getKey ? {
      p256dh: subscription.getKey('p256dh') ? this.arrayBufferToBase64(subscription.getKey('p256dh')!) : '',
      auth: subscription.getKey('auth') ? this.arrayBufferToBase64(subscription.getKey('auth')!) : '',
    } : { p256dh: '', auth: '' };

    return {
      endpoint: subscription.endpoint,
      keys,
    };
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get application server key (VAPID public key)
   * In production, this should come from environment variables
   */
  private getApplicationServerKey(): Uint8Array {
    // This is a placeholder VAPID key - replace with your actual public key
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      'BKxzfJMHG3lMnrBNYQ6rGJ5wB6s_Cz3Bz2BrwB2s_Cz3Bz2BrwB2s_Cz3Bz2BrwB2s_Cz3Bz2BrwB2s_Cz3';

    return new Uint8Array(
      atob(publicKey.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(char => char.charCodeAt(0))
    );
  }

  /**
   * Get notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Check if push notifications are supported
   */
  getSupport(): boolean {
    return this.isSupported;
  }
}

// Export singleton instance
export const pushNotificationManager = new PushNotificationManager();
export default pushNotificationManager;