/**
 * Tasks Hook
 * 
 * Fetches tasks for the current view.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, View } from '../types';
import { getViewTasks } from '../api/client';

export function useTasks(viewSlug: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track the current fetch to handle race conditions
  const fetchIdRef = useRef(0);

  const fetchTasks = useCallback(async (): Promise<Task[]> => {
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getViewTasks(viewSlug, {});
      
      // Only update if this is still the current fetch
      if (fetchId === fetchIdRef.current) {
        setTasks(data.tasks);
        setView(data.view);
        return data.tasks;
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      if (fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setTasks([]);
      }
      return [];
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [viewSlug]);

  // Fetch when view changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    view,
    isLoading,
    error,
    refetch: fetchTasks,
  };
}

