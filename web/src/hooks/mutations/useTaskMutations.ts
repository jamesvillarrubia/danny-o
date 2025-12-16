/**
 * Task Mutations Hook
 *
 * Centralized mutations for all task operations with optimistic updates.
 * Uses TanStack Query mutations for automatic cache invalidation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  completeTask as completeTaskApi,
  reopenTask as reopenTaskApi,
  updateTask as updateTaskApi,
  createTask as createTaskApi,
  duplicateTask as duplicateTaskApi,
  deleteTask as deleteTaskApi,
} from '../../api/client';
import { TASKS_QUERY_KEY } from '../queries/useTasksQuery';
import type { Task } from '../../types';

/**
 * Options for completing a task.
 */
interface CompleteTaskOptions {
  actualMinutes?: number;
  context?: string;
}

/**
 * Options for updating a task.
 */
interface UpdateTaskOptions {
  content?: string;
  description?: string;
  priority?: number;
  projectId?: string;
  dueString?: string;
  labels?: string[];
  category?: string;
  timeEstimate?: string;
}

/**
 * Options for creating a task.
 */
interface CreateTaskOptions {
  content: string;
  description?: string;
  priority?: number;
  projectId?: string;
  dueString?: string;
  labels?: string[];
}

/**
 * Hook providing all task mutation operations.
 *
 * Each mutation includes:
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on error
 * - Cache invalidation on success
 *
 * @example
 * ```tsx
 * const { completeTask, updateTask, isUpdating } = useTaskMutations();
 *
 * // Complete a task
 * completeTask({ taskId: '123' });
 *
 * // Update a task
 * updateTask({ taskId: '123', updates: { content: 'New title' } });
 * ```
 */
export function useTaskMutations() {
  const queryClient = useQueryClient();

  /**
   * Complete a task mutation with optimistic update.
   */
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, options }: { taskId: string; options?: CompleteTaskOptions }) => {
      return completeTaskApi(taskId, options);
    },
    onMutate: async ({ taskId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY);

      // Optimistically update the cache
      queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === taskId
            ? { ...task, isCompleted: true, completedAt: new Date().toISOString() }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(TASKS_QUERY_KEY, context.previousTasks);
      }
    },
    onSettled: () => {
      // Always refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  /**
   * Reopen a completed task mutation with optimistic update.
   */
  const reopenTaskMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      return reopenTaskApi(taskId);
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      const previousTasks = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY);

      queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === taskId
            ? { ...task, isCompleted: false, completedAt: null }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(TASKS_QUERY_KEY, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  /**
   * Update a task mutation with optimistic update.
   */
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: UpdateTaskOptions }) => {
      return updateTaskApi(taskId, updates);
    },
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      const previousTasks = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY);

      queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === taskId
            ? {
                ...task,
                content: updates.content ?? task.content,
                description: updates.description ?? task.description,
                priority: updates.priority ?? task.priority,
                projectId: updates.projectId ?? task.projectId,
                labels: updates.labels ?? task.labels,
                metadata: {
                  ...task.metadata,
                  category: updates.category ?? task.metadata?.category,
                  timeEstimate: updates.timeEstimate ?? task.metadata?.timeEstimate,
                },
                updatedAt: new Date().toISOString(),
              }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(TASKS_QUERY_KEY, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  /**
   * Create a new task mutation.
   * No optimistic update since we don't know the ID yet.
   */
  const createTaskMutation = useMutation({
    mutationFn: async (options: CreateTaskOptions) => {
      return createTaskApi(options);
    },
    onSuccess: (newTask) => {
      // Add the new task to the cache
      queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (old) => {
        if (!old) return [newTask];
        return [newTask, ...old];
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  /**
   * Duplicate a task mutation.
   */
  const duplicateTaskMutation = useMutation({
    mutationFn: async ({ task }: { task: Task }) => {
      return duplicateTaskApi(task);
    },
    onSuccess: (newTask) => {
      queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (old) => {
        if (!old) return [newTask];
        return [newTask, ...old];
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  /**
   * Delete/archive a task mutation with optimistic update.
   */
  const deleteTaskMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      return deleteTaskApi(taskId);
    },
    onMutate: async ({ taskId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY);

      // Optimistically remove the task from cache
      queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.filter((task) => task.id !== taskId);
      });

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(TASKS_QUERY_KEY, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  return {
    // Mutation functions
    completeTask: completeTaskMutation.mutate,
    completeTaskAsync: completeTaskMutation.mutateAsync,
    reopenTask: reopenTaskMutation.mutate,
    reopenTaskAsync: reopenTaskMutation.mutateAsync,
    updateTask: updateTaskMutation.mutate,
    updateTaskAsync: updateTaskMutation.mutateAsync,
    createTask: createTaskMutation.mutate,
    createTaskAsync: createTaskMutation.mutateAsync,
    duplicateTask: duplicateTaskMutation.mutate,
    duplicateTaskAsync: duplicateTaskMutation.mutateAsync,
    deleteTask: deleteTaskMutation.mutate,
    deleteTaskAsync: deleteTaskMutation.mutateAsync,

    // Loading states
    isCompleting: completeTaskMutation.isPending,
    isReopening: reopenTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
    isCreating: createTaskMutation.isPending,
    isDuplicating: duplicateTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
    isAnyMutating:
      completeTaskMutation.isPending ||
      reopenTaskMutation.isPending ||
      updateTaskMutation.isPending ||
      createTaskMutation.isPending ||
      duplicateTaskMutation.isPending ||
      deleteTaskMutation.isPending,

    // Error states
    completeError: completeTaskMutation.error,
    reopenError: reopenTaskMutation.error,
    updateError: updateTaskMutation.error,
    createError: createTaskMutation.error,
    duplicateError: duplicateTaskMutation.error,
    deleteError: deleteTaskMutation.error,
  };
}
