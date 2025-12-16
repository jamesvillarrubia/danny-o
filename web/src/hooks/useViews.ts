/**
 * Views Hook
 *
 * Fetches and manages dashboard views.
 * Now powered by TanStack Query for caching and deduplication.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useViewsQuery, VIEWS_QUERY_KEY, DEFAULT_VIEWS } from './queries/useViewsQuery';

/**
 * Hook for accessing dashboard views.
 *
 * @returns Views data and state
 *
 * @example
 * ```tsx
 * const { views, isLoading, refetch } = useViews();
 * ```
 */
export function useViews() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, isFetching } = useViewsQuery();

  // Provide refetch function for backward compatibility
  const refetch = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: VIEWS_QUERY_KEY });
  }, [queryClient]);

  return {
    // Fall back to default views if query hasn't loaded yet
    views: data ?? DEFAULT_VIEWS,
    isLoading: isLoading || isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch,
  };
}
