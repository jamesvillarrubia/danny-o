/**
 * Filtered Tasks Hook
 *
 * Provides filtered and sorted tasks derived from the global task cache.
 * This is the primary way components should access task data.
 */

import { useMemo } from 'react';
import { useTasksQuery } from '../queries/useTasksQuery';
import { filterAndSortTasks, type SortConfig, DEFAULT_SORT_CONFIG } from '../../lib/taskFilters';
import type { Task, ViewFilterConfig } from '../../types';

export type { SortConfig } from '../../lib/taskFilters';
export { DEFAULT_SORT_CONFIG } from '../../lib/taskFilters';

/**
 * Hook to get filtered and sorted tasks from the global cache.
 *
 * @param filter - Filter configuration to apply (from view or active filter)
 * @param sortConfig - Sort configuration
 * @returns Filtered and sorted tasks array
 *
 * @example
 * ```tsx
 * // Get tasks for a view
 * const viewFilter = views.find(v => v.slug === currentView)?.filterConfig;
 * const tasks = useFilteredTasks(viewFilter, { sortBy: 'due', direction: 'asc' });
 *
 * // Get high priority tasks
 * const highPriorityTasks = useFilteredTasks(
 *   { priority: [3, 4], completed: false },
 *   { sortBy: 'priority', direction: 'desc' }
 * );
 * ```
 */
export function useFilteredTasks(
  filter: ViewFilterConfig | null,
  sortConfig: SortConfig = DEFAULT_SORT_CONFIG
): Task[] {
  const { data: allTasks = [] } = useTasksQuery();

  return useMemo(() => {
    return filterAndSortTasks(allTasks, filter, sortConfig);
  }, [allTasks, filter, sortConfig]);
}

/**
 * Hook to get filtered tasks with loading and error states.
 *
 * @param filter - Filter configuration to apply
 * @param sortConfig - Sort configuration
 * @returns Object with tasks, loading state, and error
 */
export function useFilteredTasksWithStatus(
  filter: ViewFilterConfig | null,
  sortConfig: SortConfig = DEFAULT_SORT_CONFIG
) {
  const { data: allTasks = [], isLoading, error, isFetching } = useTasksQuery();

  const tasks = useMemo(() => {
    return filterAndSortTasks(allTasks, filter, sortConfig);
  }, [allTasks, filter, sortConfig]);

  return {
    tasks,
    isLoading: isLoading || isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
}

/**
 * Hook to get incomplete tasks (common filter).
 */
export function useIncompleteTasks(sortConfig: SortConfig = DEFAULT_SORT_CONFIG): Task[] {
  return useFilteredTasks({ completed: false }, sortConfig);
}

/**
 * Hook to get tasks due today or overdue.
 */
export function useTodayTasks(sortConfig: SortConfig = DEFAULT_SORT_CONFIG): Task[] {
  return useFilteredTasks({ dueWithin: 'today', completed: false }, sortConfig);
}

/**
 * Hook to get high priority tasks (P1 and P2).
 */
export function useHighPriorityTasks(sortConfig: SortConfig = DEFAULT_SORT_CONFIG): Task[] {
  return useFilteredTasks({ priority: [3, 4], completed: false }, sortConfig);
}
