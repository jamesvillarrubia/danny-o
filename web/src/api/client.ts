/**
 * API Client for Danny Backend
 * 
 * Handles all HTTP communication with the NestJS API.
 */

import type { Task, View, ChatResponse, ListTasksResponse, ListViewsResponse } from '../types';

/**
 * API base URL - uses environment variable in production, proxy in development
 * Set VITE_API_URL in your .env file or Vercel environment variables
 * Can also be overridden via ?apiUrl query parameter (for extension use)
 */
function resolveApiBaseUrl(): string {
  // Check for query parameter first (for extension/environment switching)
  const urlParams = new URLSearchParams(window.location.search);
  const queryApiUrl = urlParams.get('apiUrl');
  if (queryApiUrl) {
    return queryApiUrl;
  }
  
  // Fall back to environment variable
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Get the current API base URL (dynamically reads from URL params)
 */
function getApiBase(): string {
  const baseUrl = resolveApiBaseUrl();
  return baseUrl ? `${baseUrl}/api/v1` : '/api/v1';
}

/**
 * Get the API key from localStorage
 */
function getApiKey(): string {
  return localStorage.getItem('danny_api_key') || '';
}

/**
 * Make an authenticated API request
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const apiBase = getApiBase();

  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ==================== Views API ====================

export async function getViews(): Promise<View[]> {
  const data = await fetchApi<ListViewsResponse>('/views');
  return data.views;
}

export async function getView(slug: string): Promise<View> {
  return fetchApi<View>(`/views/${slug}`);
}

export async function getViewTasks(
  slug: string,
  options?: { limit?: number; offset?: number }
): Promise<ListTasksResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  
  const query = params.toString();
  const endpoint = `/views/${slug}/tasks${query ? `?${query}` : ''}`;
  
  return fetchApi<ListTasksResponse>(endpoint);
}

// ==================== Tasks API ====================

export async function getTask(taskId: string): Promise<Task> {
  return fetchApi<Task>(`/tasks/${taskId}`);
}

export async function completeTask(
  taskId: string,
  options?: { actualMinutes?: number; context?: string }
): Promise<{ taskId: string; completedAt: string }> {
  return fetchApi<{ taskId: string; completedAt: string }>(
    `/tasks/${taskId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }
  );
}

export async function updateTask(
  taskId: string,
  updates: {
    content?: string;
    description?: string;
    priority?: number;
    dueString?: string;
    labels?: string[];
    category?: string;
  }
): Promise<Task> {
  return fetchApi<Task>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function createTask(data: {
  content: string;
  description?: string;
  priority?: number;
  dueString?: string;
  labels?: string[];
}): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function syncTasks(): Promise<{
  synced: number;
  tasks: number;
  duration: number;
}> {
  return fetchApi<{ synced: number; tasks: number; duration: number }>(
    '/tasks/sync',
    { method: 'POST' }
  );
}

// ==================== Chat API ====================

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  return fetchApi<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ==================== Settings ====================

export function setApiKey(key: string): void {
  localStorage.setItem('danny_api_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('danny_api_key');
}

/**
 * Test if the API key is valid by fetching views
 */
export async function testApiKey(key: string): Promise<boolean> {
  try {
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/views`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the current API base URL (for debugging)
 * This function re-reads the URL to handle dynamic changes
 */
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl() || '(using proxy)';
}

// ==================== Sync Settings API ====================

import type { SyncMode, OrphanedTasksReport, MergeDecision } from '../types';

// Re-export types for convenience
export type { SyncMode, OrphanedTasksReport, MergeDecision };

export async function getSyncMode(): Promise<SyncMode> {
  return fetchApi<SyncMode>('/settings/sync-mode');
}

export async function setSyncMode(
  mode: 'standalone' | 'todoist',
  todoistApiKey?: string
): Promise<{ success: boolean; mode: string }> {
  return fetchApi<{ success: boolean; mode: string }>(
    '/settings/sync-mode',
    {
      method: 'POST',
      body: JSON.stringify({ mode, todoistApiKey }),
    }
  );
}

export async function detectOrphans(): Promise<OrphanedTasksReport> {
  return fetchApi<OrphanedTasksReport>('/sync/orphans');
}

export async function applyMergeDecisions(
  decisions: MergeDecision[]
): Promise<{ success: boolean; applied: number }> {
  return fetchApi<{ success: boolean; applied: number }>(
    '/sync/apply-merge-decisions',
    {
      method: 'POST',
      body: JSON.stringify({ decisions }),
    }
  );
}

// ==================== Config API ====================

/**
 * Get or generate the API key (public endpoint for first-time setup)
 */
export async function getOrGenerateApiKey(): Promise<{
  apiKey: string;
  confirmed: boolean;
  firstTime: boolean;
}> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/config/api-key`);
  
  if (!response.ok) {
    throw new Error('Failed to get API key');
  }
  
  return response.json();
}

/**
 * Confirm that the user has saved the API key
 */
export async function confirmApiKey(apiKey: string): Promise<{ success: boolean }> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/config/api-key/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to confirm API key');
  }
  
  return response.json();
}

