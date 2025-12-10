/**
 * Projects Hook
 * 
 * Fetches and manages project data from the API.
 * Includes retry logic for cases where the server just restarted
 * and projects haven't been synced yet.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ListProjectsResponse } from '../types';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProjects = useCallback(async (isRetry = false) => {
    if (!isRetry) {
      setIsLoading(true);
      setError(null);
      retryCountRef.current = 0;
    }
    
    try {
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
      
      // If we got an empty result and haven't exhausted retries, try again
      // This handles the case where server just restarted and hasn't synced yet
      if (data.projects.length === 0 && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        console.log(`[useProjects] Got 0 projects, retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
        retryTimeoutRef.current = setTimeout(() => fetchProjects(true), RETRY_DELAY_MS);
        return;
      }
      
      setProjects(data.projects);
      
      // Create a lookup map for quick access
      const map: Record<string, Project> = {};
      data.projects.forEach((project) => {
        map[project.id] = project;
      });
      setProjectsMap(map);
      setIsLoading(false);
    } catch (err: any) {
      // Retry on error if we haven't exhausted retries
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        console.log(`[useProjects] Error fetching, retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
        retryTimeoutRef.current = setTimeout(() => fetchProjects(true), RETRY_DELAY_MS);
        return;
      }
      
      setError(err.message || 'Failed to fetch projects');
      setProjects([]);
      setProjectsMap({});
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    
    // Cleanup timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchProjects]);

  return { projects, projectsMap, isLoading, error, refetch: fetchProjects };
};

