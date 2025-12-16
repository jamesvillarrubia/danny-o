/**
 * Views Query Hook
 *
 * TanStack Query-based hook for fetching dashboard views.
 * Provides caching and automatic background updates.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getViews } from '../../api/client';
import type { View } from '../../types';

/** Query key for views - used for cache invalidation */
export const VIEWS_QUERY_KEY = ['views'] as const;

/** Default views to show while loading or on error */
export const DEFAULT_VIEWS: View[] = [
  { id: 0, name: 'Today', slug: 'today', filterConfig: { dueWithin: 'today' }, isDefault: true, orderIndex: 0 },
  { id: 0, name: 'This Week', slug: 'this-week', filterConfig: { dueWithin: '7d' }, isDefault: true, orderIndex: 1 },
  { id: 0, name: 'High Priority', slug: 'high-priority', filterConfig: { priority: [3, 4] }, isDefault: true, orderIndex: 2 },
  { id: 0, name: 'All Tasks', slug: 'all', filterConfig: { completed: false }, isDefault: true, orderIndex: 3 },
];

/**
 * Hook to get all views.
 *
 * @returns Query result with views array
 */
export function useViewsQuery() {
  return useQuery({
    queryKey: VIEWS_QUERY_KEY,
    queryFn: getViews,
    // Use default views as placeholder while loading
    placeholderData: DEFAULT_VIEWS,
  });
}

/**
 * Hook to get a specific view by slug.
 *
 * @param slug - The view slug to find
 * @returns The view if found, undefined otherwise
 */
export function useView(slug: string | null | undefined) {
  const { data: views } = useViewsQuery();
  return views?.find((v) => v.slug === slug);
}

/**
 * Hook to invalidate views cache.
 * Use after creating/updating/deleting views.
 */
export function useInvalidateViews() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: VIEWS_QUERY_KEY });
}
