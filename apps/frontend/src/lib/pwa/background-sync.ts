/**
 * Background Sync Manager for PWA
 * Handles background synchronization of data when app comes back online
 */

export interface SyncQueueItem {
  id: string;
  type: 'task_create' | 'task_update' | 'task_delete' | 'user_action';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface BackgroundSyncOptions {
  maxRetries?: number;
  retryDelay?: number;
  queueName?: string;
}

class BackgroundSyncManager {
  private isSupported: boolean;
  private queue: Map<string, SyncQueueItem> = new Map();
  private readonly storageKey = 'cc-task-manager-sync-queue';
  private readonly defaultOptions: Required<BackgroundSyncOptions> = {
    maxRetries: 3,
    retryDelay: 5000,
    queueName: 'background-sync',
  };

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.isSupported = 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype;
      this.loadQueue();
    }
  }

  /**
   * Register background sync
   */
  async register(
    item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>,
    options: BackgroundSyncOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const id = this.generateId();

    const queueItem: SyncQueueItem = {
      id,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: opts.maxRetries,
      ...item,
    };

    this.queue.set(id, queueItem);
    this.saveQueue();

    if (this.isSupported) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(opts.queueName);
        console.log('Background sync registered:', id);
      } catch (error) {
        console.error('Failed to register background sync:', error);
        // Fallback to immediate retry
        this.processItem(queueItem);
      }
    } else {
      // Fallback for browsers without background sync
      this.processItem(queueItem);
    }

    return id;
  }

  /**
   * Process a single queue item
   */
  async processItem(item: SyncQueueItem): Promise<boolean> {
    try {
      const success = await this.executeSync(item);

      if (success) {
        this.queue.delete(item.id);
        this.saveQueue();
        console.log('Sync item processed successfully:', item.id);
        return true;
      } else {
        item.retryCount++;
        if (item.retryCount >= item.maxRetries) {
          console.error('Sync item exceeded max retries, removing:', item.id);
          this.queue.delete(item.id);
          this.saveQueue();
        } else {
          console.log(`Sync item failed, will retry (${item.retryCount}/${item.maxRetries}):`, item.id);
          this.saveQueue();
          // Schedule retry
          setTimeout(() => this.processItem(item), this.defaultOptions.retryDelay);
        }
        return false;
      }
    } catch (error) {
      console.error('Error processing sync item:', error);
      return false;
    }
  }

  /**
   * Process all queued items
   */
  async processQueue(): Promise<void> {
    console.log(`Processing sync queue with ${this.queue.size} items`);

    const items = Array.from(this.queue.values());
    const promises = items.map(item => this.processItem(item));

    await Promise.all(promises);
  }

  /**
   * Execute sync operation based on item type
   */
  private async executeSync(item: SyncQueueItem): Promise<boolean> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      let response: Response;

      switch (item.type) {
        case 'task_create':
          response = await fetch(`${apiUrl}/api/tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(item.data),
          });
          break;

        case 'task_update':
          response = await fetch(`${apiUrl}/api/tasks/${item.data.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(item.data),
          });
          break;

        case 'task_delete':
          response = await fetch(`${apiUrl}/api/tasks/${item.data.id}`, {
            method: 'DELETE',
          });
          break;

        case 'user_action':
          response = await fetch(`${apiUrl}/api/actions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(item.data),
          });
          break;

        default:
          console.error('Unknown sync type:', item.type);
          return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Sync execution failed:', error);
      return false;
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    size: number;
    items: SyncQueueItem[];
    isSupported: boolean;
  } {
    return {
      size: this.queue.size,
      items: Array.from(this.queue.values()),
      isSupported: this.isSupported,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue.clear();
    this.saveQueue();
  }

  /**
   * Remove specific item from queue
   */
  removeItem(id: string): boolean {
    const deleted = this.queue.delete(id);
    if (deleted) {
      this.saveQueue();
    }
    return deleted;
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const items: SyncQueueItem[] = JSON.parse(stored);
        this.queue = new Map(items.map(item => [item.id, item]));
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.queue = new Map();
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      const items = Array.from(this.queue.values());
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const backgroundSyncManager = new BackgroundSyncManager();
export default backgroundSyncManager;