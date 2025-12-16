/**
 * Tasks Query Hook
 *
 * Single source of truth for all tasks in the application.
 * Uses TanStack Query for caching and automatic background updates.
 *
 * All views and filters should derive from this cached data rather than
 * making separate API calls.
 */

import { useQuery } from '@tanstack/react-query';
import { getViewTasks } from '../../api/client';
import type { Task } from '../../types';

/** Query key for tasks - used for cache invalidation */
export const TASKS_QUERY_KEY = ['tasks'] as const;

/**
 * Fetch all tasks from the "all" view.
 * This becomes the single source of truth for the frontend.
 */
async function fetchAllTasks(): Promise<Task[]> {
  const data = await getViewTasks('all', { limit: 2000 });
  return data.tasks;
}

/**
 * Hook to get all tasks from the cache.
 *
 * @returns Query result with all tasks
 *
 * @example
 * ```tsx
 * const { data: tasks, isLoading, error } = useTasksQuery();
 *
 * // Filter tasks client-side
 * const highPriorityTasks = tasks?.filter(t => t.priority >= 3);
 * ```
 */
export function useTasksQuery() {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: fetchAllTasks,
    // Keep previous data while refetching to avoid flickering
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to get a specific task by ID from the cache.
 *
 * @param taskId - The task ID to find
 * @returns The task if found, undefined otherwise
 */
export function useTask(taskId: string | null | undefined) {
  const { data: tasks } = useTasksQuery();
  return tasks?.find((t) => t.id === taskId);
}
