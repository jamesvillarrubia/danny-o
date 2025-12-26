/**
 * Service Worker Registration and Management
 * 
 * Handles service worker lifecycle and registration for PWA functionality.
 */

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service worker registered:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available, prompt user to reload
          console.log('New service worker available, page will reload');
          if (confirm('A new version of Danny is available. Reload to update?')) {
            window.location.reload();
          }
        }
      });
    });

    // Register periodic sync if supported (for Todoist mode)
    if ('periodicSync' in registration) {
      try {
        await (registration as any).periodicSync.register('sync', {
          minInterval: 5 * 60 * 1000, // 5 minutes
        });
        console.log('Periodic sync registered');
      } catch (error) {
        console.warn('Periodic sync registration failed:', error);
      }
    }

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const result = await registration.unregister();
      console.log('Service worker unregistered:', result);
      return result;
    }
    return false;
  } catch (error) {
    console.error('Service worker unregistration failed:', error);
    return false;
  }
}

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
export function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Prompt user to install PWA if not already installed
 */
export function setupInstallPrompt(): void {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default install prompt
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install button or banner
    console.log('PWA install prompt available');
    
    // Dispatch custom event for UI to listen to
    window.dispatchEvent(new CustomEvent('danny-install-available', {
      detail: { prompt: deferredPrompt }
    }));
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
  });
}

/**
 * Trigger PWA install prompt
 */
export async function triggerInstall(deferredPrompt: any): Promise<boolean> {
  if (!deferredPrompt) {
    console.warn('Install prompt not available');
    return false;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);

  return outcome === 'accepted';
}

