/**
 * Projects Query Hook
 *
 * TanStack Query-based hook for fetching projects.
 * Provides caching and automatic background updates.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ListProjectsResponse } from '../../types';

/** Query key for projects - used for cache invalidation */
export const PROJECTS_QUERY_KEY = ['projects'] as const;

/**
 * Fetch projects from the API.
 */
async function fetchProjects(): Promise<Project[]> {
  const apiKey = localStorage.getItem('danny_api_key');
  const apiBaseUrl = import.meta.env.VITE_API_URL || '';
  
  const response = await fetch(`${apiBaseUrl}/api/v1/projects`, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data: ListProjectsResponse = await response.json();
  return data.projects;
}

/**
 * Hook to get all projects.
 *
 * @returns Query result with projects array
 */
export function useProjectsQuery() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
    // Retry up to 3 times with 2 second delay (matches original behavior)
    retry: 3,
    retryDelay: 2000,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to get projects as a lookup map.
 *
 * @returns Map of project ID to project
 */
export function useProjectsMap() {
  const { data: projects } = useProjectsQuery();
  
  // Build map from projects array
  const map: Record<string, Project> = {};
  if (projects) {
    for (const project of projects) {
      map[project.id] = project;
    }
  }
  return map;
}

/**
 * Hook to get a specific project by ID.
 *
 * @param projectId - The project ID to find
 * @returns The project if found, undefined otherwise
 */
export function useProject(projectId: string | null | undefined) {
  const { data: projects } = useProjectsQuery();
  return projects?.find((p) => p.id === projectId);
}

/**
 * Hook to invalidate projects cache.
 */
export function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
}
