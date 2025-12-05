/**
 * Views Hook
 * 
 * Fetches and manages dashboard views.
 */

import { useState, useEffect, useCallback } from 'react';
import type { View } from '../types';
import { getViews } from '../api/client';

// Default views to show while loading
const defaultViews: View[] = [
  { id: 0, name: 'Today', slug: 'today', filterConfig: { dueWithin: 'today' }, isDefault: true, orderIndex: 0 },
  { id: 0, name: 'This Week', slug: 'this-week', filterConfig: { dueWithin: '7d' }, isDefault: true, orderIndex: 1 },
  { id: 0, name: 'High Priority', slug: 'high-priority', filterConfig: { priority: [1, 2] }, isDefault: true, orderIndex: 2 },
  { id: 0, name: 'All Tasks', slug: 'all', filterConfig: { completed: false }, isDefault: true, orderIndex: 3 },
];

export function useViews() {
  const [views, setViews] = useState<View[]>(defaultViews);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchViews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getViews();
      setViews(data);
    } catch (err) {
      console.error('Failed to fetch views:', err);
      setError(err instanceof Error ? err.message : 'Failed to load views');
      // Keep default views on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  return {
    views,
    isLoading,
    error,
    refetch: fetchViews,
  };
}

