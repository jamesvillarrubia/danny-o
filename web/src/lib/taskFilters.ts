/**
 * Task Filtering and Sorting Utilities
 *
 * Client-side filtering logic for tasks. This is the single source of truth
 * for all task filtering in the frontend. Views are applied as filters on
 * the cached task list.
 *
 * Note: The backend has equivalent filtering for CLI/MCP consumers.
 * This client-side implementation mirrors that logic.
 */

import type { Task, ViewFilterConfig } from '../types';

/**
 * Sort configuration for tasks.
 */
export interface SortConfig {
  sortBy: 'due' | 'priority' | 'created' | 'title';
  direction: 'asc' | 'desc';
}

/**
 * Default sort configuration.
 */
export const DEFAULT_SORT_CONFIG: SortConfig = {
  sortBy: 'due',
  direction: 'asc',
};

/**
 * Filter tasks based on a filter configuration.
 *
 * @param tasks - Array of tasks to filter
 * @param filter - Filter configuration to apply
 * @returns Filtered array of tasks
 *
 * @example
 * ```ts
 * // Filter to high priority tasks
 * const highPriority = filterTasks(tasks, { priority: [3, 4] });
 *
 * // Filter to tasks due today
 * const dueToday = filterTasks(tasks, { dueWithin: 'today' });
 * ```
 */
export function filterTasks(tasks: Task[], filter: ViewFilterConfig | null): Task[] {
  if (!filter) {
    return tasks;
  }

  let result = [...tasks];

  // Filter by completion status
  if (filter.completed !== undefined) {
    result = result.filter((t) => t.isCompleted === filter.completed);
  }

  // Filter by specific task IDs
  if (filter.taskIds && filter.taskIds.length > 0) {
    const taskIdSet = new Set(filter.taskIds);
    result = result.filter((t) => taskIdSet.has(t.id));
  }

  // Filter by priority
  if (filter.priority && filter.priority.length > 0) {
    const prioritySet = new Set(filter.priority);
    result = result.filter((t) => prioritySet.has(t.priority));
  }

  // Filter by categories
  if (filter.categories && filter.categories.length > 0) {
    const categorySet = new Set(filter.categories);
    result = result.filter(
      (t) => t.metadata?.category && categorySet.has(t.metadata.category)
    );
  }

  // Filter by project
  if (filter.projectId) {
    result = result.filter((t) => t.projectId === filter.projectId);
  }

  // Filter by due date
  if (filter.dueWithin || filter.overdue) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    result = result.filter((t) => {
      if (!t.due?.date) {
        // No due date - exclude from date-filtered views
        return false;
      }

      const dueDate = new Date(t.due.date);
      const dueDateNormalized = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate()
      );

      // Check overdue
      if (filter.overdue && dueDateNormalized < today) {
        return true;
      }

      // Check within range
      if (filter.dueWithin) {
        let maxDate: Date;
        switch (filter.dueWithin) {
          case 'today':
            maxDate = today;
            break;
          case '7d':
            maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 7);
            break;
          case '14d':
            maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 14);
            break;
          case '30d':
            maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 30);
            break;
          default:
            maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 7);
        }

        // Include overdue tasks in date-range views
        if (dueDateNormalized <= maxDate) {
          return true;
        }
      }

      return false;
    });
  }

  // Apply limit (after filtering, before returning)
  if (filter.limit && filter.limit > 0 && result.length > filter.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

/**
 * Sort tasks based on sort configuration.
 *
 * @param tasks - Array of tasks to sort
 * @param config - Sort configuration
 * @returns New sorted array of tasks
 *
 * @example
 * ```ts
 * // Sort by due date ascending
 * const sorted = sortTasks(tasks, { sortBy: 'due', direction: 'asc' });
 * ```
 */
export function sortTasks(tasks: Task[], config: SortConfig): Task[] {
  const { sortBy, direction } = config;

  return [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'due': {
        // Tasks without due dates go to the end
        const aDate = a.due?.date ? new Date(a.due.date).getTime() : Infinity;
        const bDate = b.due?.date ? new Date(b.due.date).getTime() : Infinity;
        comparison = aDate - bDate;
        break;
      }
      case 'priority': {
        // Higher priority number = more important (4 is highest)
        comparison = b.priority - a.priority;
        break;
      }
      case 'created': {
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = aCreated - bCreated;
        break;
      }
      case 'title': {
        comparison = a.content.localeCompare(b.content);
        break;
      }
    }

    // Apply direction (for priority, desc is natural so we flip the logic)
    if (sortBy === 'priority') {
      return direction === 'desc' ? comparison : -comparison;
    }
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Filter and sort tasks in one operation.
 *
 * @param tasks - Array of tasks
 * @param filter - Filter configuration (optional)
 * @param sortConfig - Sort configuration
 * @returns Filtered and sorted array of tasks
 */
export function filterAndSortTasks(
  tasks: Task[],
  filter: ViewFilterConfig | null,
  sortConfig: SortConfig
): Task[] {
  const filtered = filterTasks(tasks, filter);
  return sortTasks(filtered, sortConfig);
}

/**
 * Check if a task matches a filter (without filtering the whole array).
 * Useful for determining if a single task should be visible.
 *
 * @param task - Task to check
 * @param filter - Filter configuration
 * @returns True if task matches the filter
 */
export function taskMatchesFilter(task: Task, filter: ViewFilterConfig | null): boolean {
  if (!filter) {
    return true;
  }

  // Check completion status
  if (filter.completed !== undefined && task.isCompleted !== filter.completed) {
    return false;
  }

  // Check task IDs
  if (filter.taskIds && filter.taskIds.length > 0 && !filter.taskIds.includes(task.id)) {
    return false;
  }

  // Check priority
  if (filter.priority && filter.priority.length > 0 && !filter.priority.includes(task.priority)) {
    return false;
  }

  // Check categories
  if (filter.categories && filter.categories.length > 0) {
    if (!task.metadata?.category || !filter.categories.includes(task.metadata.category)) {
      return false;
    }
  }

  // Check project
  if (filter.projectId && task.projectId !== filter.projectId) {
    return false;
  }

  // Check due date
  if (filter.dueWithin || filter.overdue) {
    if (!task.due?.date) {
      return false;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = new Date(task.due.date);
    const dueDateNormalized = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate()
    );

    if (filter.overdue && dueDateNormalized < today) {
      return true;
    }

    if (filter.dueWithin) {
      let maxDate: Date;
      switch (filter.dueWithin) {
        case 'today':
          maxDate = today;
          break;
        case '7d':
          maxDate = new Date(today);
          maxDate.setDate(maxDate.getDate() + 7);
          break;
        case '14d':
          maxDate = new Date(today);
          maxDate.setDate(maxDate.getDate() + 14);
          break;
        case '30d':
          maxDate = new Date(today);
          maxDate.setDate(maxDate.getDate() + 30);
          break;
        default:
          maxDate = new Date(today);
          maxDate.setDate(maxDate.getDate() + 7);
      }

      if (dueDateNormalized <= maxDate) {
        return true;
      }
    }

    return false;
  }

  return true;
}
