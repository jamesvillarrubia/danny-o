/**
 * Projects Hook
 *
 * Fetches and manages project data from the API.
 * Now powered by TanStack Query for caching and automatic retries.
 */

import { useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectsQuery, PROJECTS_QUERY_KEY } from './queries/useProjectsQuery';
import type { Project } from '../types';

/**
 * Hook for accessing projects data.
 *
 * @returns Projects data, lookup map, and state
 *
 * @example
 * ```tsx
 * const { projects, projectsMap, isLoading } = useProjects();
 *
 * // Get project name by ID
 * const projectName = projectsMap[task.projectId]?.name;
 * ```
 */
export const useProjects = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error, isFetching } = useProjectsQuery();

  // Build projects map for quick lookup
  const projectsMap = useMemo(() => {
    const map: Record<string, Project> = {};
    if (data) {
      for (const project of data) {
        map[project.id] = project;
      }
    }
    return map;
  }, [data]);

  // Provide refetch function for backward compatibility
  const refetch = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
  }, [queryClient]);

  return {
    projects: data ?? [],
    projectsMap,
    isLoading: isLoading || isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch,
  };
};
