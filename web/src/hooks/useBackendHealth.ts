/**
 * useBackendHealth Hook
 * 
 * Monitors backend health and provides status for gating data fetches.
 * Uses exponential backoff to avoid spamming the server during startup.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { checkBackendHealth } from '../api/client';

interface UseBackendHealthResult {
  isBackendReady: boolean;
  isChecking: boolean;
  retryCount: number;
  checkNow: () => void;
}

/**
 * Hook that checks backend health with exponential backoff.
 * Returns isBackendReady: true once the backend responds successfully.
 */
export function useBackendHealth(): UseBackendHealthResult {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const performHealthCheck = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setIsChecking(true);
    const healthy = await checkBackendHealth();
    
    if (!isMountedRef.current) return;
    
    if (healthy) {
      setIsBackendReady(true);
      setIsChecking(false);
      setRetryCount(0);
      console.log('[Health] Backend is ready');
    } else {
      // Schedule retry with exponential backoff (1s, 2s, 4s, 8s, max 10s)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      console.log(`[Health] Backend not ready, retrying in ${delay}ms (attempt ${retryCount + 1})`);
      
      setRetryCount(prev => prev + 1);
      setIsChecking(false);
      
      timeoutRef.current = setTimeout(() => {
        performHealthCheck();
      }, delay);
    }
  }, [retryCount]);

  // Manual check function
  const checkNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setRetryCount(0);
    performHealthCheck();
  }, [performHealthCheck]);

  // Start checking on mount
  useEffect(() => {
    isMountedRef.current = true;
    performHealthCheck();
    
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Only run on mount

  // Reset and recheck if backend becomes unavailable
  useEffect(() => {
    if (!isBackendReady) return;
    
    // Periodically verify backend is still healthy (every 30s)
    const interval = setInterval(async () => {
      const stillHealthy = await checkBackendHealth();
      if (!stillHealthy && isMountedRef.current) {
        console.log('[Health] Backend became unavailable, waiting for recovery...');
        setIsBackendReady(false);
        performHealthCheck();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isBackendReady, performHealthCheck]);

  return {
    isBackendReady,
    isChecking,
    retryCount,
    checkNow,
  };
}
