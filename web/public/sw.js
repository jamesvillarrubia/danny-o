/**
 * Service Worker for Danny PWA
 * 
 * Provides offline support, background sync, and caching strategies.
 */

const CACHE_NAME = 'danny-v1';
const RUNTIME_CACHE = 'danny-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/danny.svg',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first strategy for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: Network-first, fall back to offline queue
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful GET responses only (Cache API doesn't support POST)
          if (response && response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // If network fails, check cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If POST/PUT/PATCH/DELETE, queue for background sync
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            // Store in IndexedDB for background sync
            await queueOfflineRequest(request);
            
            // Return a synthetic response
            return new Response(
              JSON.stringify({
                error: 'offline',
                message: 'Request queued for sync when online',
              }),
              {
                status: 202, // Accepted
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          // Return offline response for GET requests
          return new Response(
            JSON.stringify({
              error: 'offline',
              message: 'You are currently offline',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // Static assets: Cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseClone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});

// Background Sync - retry failed requests when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'danny-sync') {
    event.waitUntil(syncOfflineRequests());
  }
});

// Periodic Background Sync - auto-sync tasks if in Todoist mode
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync') {
    event.waitUntil(performPeriodicSync());
  }
});

/**
 * Queue an offline request in IndexedDB for background sync
 */
async function queueOfflineRequest(request) {
  const db = await openDatabase();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');

  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now(),
  };

  await store.add(requestData);
  
  // Register background sync if supported
  if ('sync' in self.registration) {
    await self.registration.sync.register('danny-sync');
  }
}

/**
 * Sync queued offline requests
 */
async function syncOfflineRequests() {
  const db = await openDatabase();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');
  const requests = await store.getAll();

  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body,
      });

      if (response.ok) {
        // Remove from queue if successful
        await store.delete(requestData.id);
      }
    } catch (error) {
      console.error('Failed to sync offline request:', error);
      // Keep in queue for next sync attempt
    }
  }
}

/**
 * Perform periodic sync (when in Todoist mode)
 */
async function performPeriodicSync() {
  try {
    const response = await fetch('/api/v1/tasks/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log('Periodic sync completed successfully');
    }
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

/**
 * Open IndexedDB for offline queue
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DannyOfflineDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
  });
}

// Push notification handling (future feature)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New update from Danny',
    icon: '/danny.svg',
    badge: '/danny.svg',
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Danny', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

