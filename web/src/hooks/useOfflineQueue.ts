/**
 * useOfflineQueue Hook
 * 
 * React hook for managing offline queue state and providing UI feedback.
 */

import { useState, useEffect } from 'react';
import {
  getQueueCount,
  processQueue,
  setupOnlineListeners,
  isOnline as checkIsOnline,
} from '../lib/offline-queue';

interface OfflineQueueState {
  isOnline: boolean;
  queueCount: number;
  isProcessing: boolean;
  lastProcessResult: { success: number; failed: number } | null;
}

export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>({
    isOnline: checkIsOnline(),
    queueCount: 0,
    isProcessing: false,
    lastProcessResult: null,
  });

  // Update queue count
  const updateQueueCount = async () => {
    try {
      const count = await getQueueCount();
      setState(prev => ({ ...prev, queueCount: count }));
    } catch (error) {
      console.error('Failed to get queue count:', error);
    }
  };

  // Process the queue manually
  const processQueueManually = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const result = await processQueue();
      setState(prev => ({
        ...prev,
        isProcessing: false,
        lastProcessResult: result,
      }));
      await updateQueueCount();
      return result;
    } catch (error) {
      console.error('Failed to process queue:', error);
      setState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  };

  // Setup listeners and periodic queue count updates
  useEffect(() => {
    // Initial queue count
    updateQueueCount();

    // Setup online/offline listeners
    const cleanup = setupOnlineListeners(
      async () => {
        setState(prev => ({ ...prev, isOnline: true }));
        await updateQueueCount();
      },
      () => {
        setState(prev => ({ ...prev, isOnline: false }));
      }
    );

    // Update queue count every 30 seconds
    const interval = setInterval(updateQueueCount, 30000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  return {
    ...state,
    processQueue: processQueueManually,
    refreshQueueCount: updateQueueCount,
  };
}

