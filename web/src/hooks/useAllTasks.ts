/**
 * All Tasks Hook
 * 
 * Fetches ALL tasks in the background for features like the Filler panel
 * that need access to the complete task list regardless of current view.
 * 
 * This runs independently of the view-based useTasks hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task } from '../types';
import { getViewTasks } from '../api/client';

export function useAllTasks() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track the current fetch to handle race conditions
  const fetchIdRef = useRef(0);
  // Track if initial fetch has completed
  const hasFetchedRef = useRef(false);

  const fetchAllTasks = useCallback(async (): Promise<Task[]> => {
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch from "all" view to get complete task list
      console.log('[useAllTasks] Calling getViewTasks("all")...');
      const data = await getViewTasks('all', { limit: 1000 });
      console.log('[useAllTasks] Received', data.tasks.length, 'tasks');
      
      // Only update if this is still the current fetch
      if (fetchId === fetchIdRef.current) {
        setAllTasks(data.tasks);
        hasFetchedRef.current = true;
        return data.tasks;
      }
      return [];
    } catch (err) {
      console.error('[useAllTasks] Failed to fetch all tasks:', err);
      if (fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setAllTasks([]);
      }
      return [];
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch all tasks on mount
  useEffect(() => {
    console.log('[useAllTasks] Hook mounted, fetching all tasks...');
    fetchAllTasks();
  }, [fetchAllTasks]);

  return {
    allTasks,
    isLoading,
    error,
    refetch: fetchAllTasks,
    hasFetched: hasFetchedRef.current,
  };
}
