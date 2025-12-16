/**
 * Offline Queue Management
 * 
 * Manages a queue of mutations to be synced when the user comes back online.
 * Works in conjunction with the service worker's IndexedDB queue.
 */

interface QueuedMutation {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retries?: number;
}

/**
 * Open the offline queue database
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DannyOfflineDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
  });
}

/**
 * Add a mutation to the offline queue
 */
export async function queueMutation(
  url: string,
  method: string,
  body?: any,
  headers?: Record<string, string>
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');

  const mutation: QueuedMutation = {
    url,
    method,
    headers: headers || {},
    body: body ? JSON.stringify(body) : '',
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const request = store.add(mutation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all queued mutations
 */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await openDatabase();
  const tx = db.transaction('offlineQueue', 'readonly');
  const store = tx.objectStore('offlineQueue');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a mutation from the queue
 */
export async function removeMutation(id: number): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all queued mutations
 */
export async function clearQueue(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Process queued mutations when back online
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  const mutations = await getQueuedMutations();
  let success = 0;
  let failed = 0;

  for (const mutation of mutations) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body || undefined,
      });

      if (response.ok) {
        await removeMutation(mutation.id!);
        success++;
      } else {
        console.error('Failed to process mutation:', response.status, response.statusText);
        failed++;
      }
    } catch (error) {
      console.error('Error processing mutation:', error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get the count of queued mutations
 */
export async function getQueueCount(): Promise<number> {
  const mutations = await getQueuedMutations();
  return mutations.length;
}

/**
 * Setup online/offline event listeners
 */
export function setupOnlineListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = async () => {
    console.log('Back online, processing queue...');
    const result = await processQueue();
    console.log(`Processed ${result.success} mutations, ${result.failed} failed`);
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('Gone offline');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Check if the browser is currently online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

