/**
 * API Client for Danny Backend
 * 
 * Handles all HTTP communication with the NestJS API.
 * Supports dynamic environment switching between local dev and production.
 */

import type { Task, View, ChatResponse, ListTasksResponse, ListViewsResponse, ApiEnvironment } from '../types';

/** Default local development URL */
const LOCAL_API_URL = 'http://localhost:3001';

/** Fallback to environment variable if set */
const ENV_API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Runtime state for environment configuration.
 * These values are updated when the user changes settings.
 */
let currentEnvironment: ApiEnvironment = 'local';
let currentProductionUrl = '';

/**
 * Get the current API base URL based on environment setting.
 * 
 * Priority:
 * 1. If environment is 'production', use productionUrl from settings
 * 2. If environment is 'local', use localhost:3001
 * 3. Fallback to VITE_API_URL environment variable
 */
function getApiBaseUrl(): string {
  if (currentEnvironment === 'production' && currentProductionUrl) {
    return currentProductionUrl;
  }
  if (currentEnvironment === 'local') {
    return LOCAL_API_URL;
  }
  // Fallback to env variable or empty (proxy mode)
  return ENV_API_URL;
}

/**
 * Get the full API base path
 */
function getApiBase(): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/v1`;
}

/**
 * Check if the backend is healthy and ready to accept requests.
 * Returns true if healthy, false otherwise.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/health/ready`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
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

export async function createView(data: {
  name: string;
  slug?: string;
  filterConfig: View['filterConfig'];
}): Promise<View> {
  return fetchApi<View>('/views', {
    method: 'POST',
    body: JSON.stringify(data),
  });
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

/**
 * Reopen a completed task (undo completion).
 * Calls the backend to mark the task as incomplete again.
 */
export async function reopenTask(taskId: string): Promise<{ taskId: string; reopenedAt: string }> {
  return fetchApi<{ taskId: string; reopenedAt: string }>(
    `/tasks/${taskId}/reopen`,
    { method: 'POST' }
  );
}

export async function updateTask(
  taskId: string,
  updates: {
    content?: string;
    description?: string;
    priority?: number;
    projectId?: string;
    dueString?: string;
    labels?: string[];
    category?: string;
    timeEstimate?: string;
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
  projectId?: string;
  dueString?: string;
  labels?: string[];
}): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Duplicate an existing task by creating a new task with the same properties.
 * Copies: content, description, priority, projectId, dueString, labels
 * Does NOT copy: id, completion status, AI-generated metadata
 */
export async function duplicateTask(task: Task): Promise<Task> {
  return createTask({
    content: task.content,
    description: task.description,
    priority: task.priority,
    projectId: task.projectId,
    dueString: task.due?.date,
    labels: task.labels,
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

/**
 * Full resync all tasks with Todoist.
 * This clears the local cache and re-fetches everything from Todoist.
 * Use sparingly - it's more thorough but slower than incremental sync.
 */
export async function fullResyncTasks(): Promise<{
  synced: number;
  tasks: number;
  projects: number;
  labels: number;
  newTasks: number;
  duration: number;
}> {
  return fetchApi<{
    synced: number;
    tasks: number;
    projects: number;
    labels: number;
    newTasks: number;
    duration: number;
  }>('/tasks/sync', {
    method: 'POST',
    body: JSON.stringify({ fullSync: true }),
  });
}

// ==================== Chat API ====================

export interface ChatMessageOptions {
  message: string;
  pageContext?: {
    url?: string;
    title?: string;
    html?: string;
    text?: string;
    selection?: string;
  };
  /** Previous conversation messages for context continuity */
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export async function sendChatMessage(
  message: string,
  pageContext?: ChatMessageOptions['pageContext'],
  history?: ChatMessageOptions['history']
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, pageContext, history }),
  });
}

// ==================== AI Operations ====================

export interface ClassifyResponse {
  results: Array<{
    taskId: string;
    taskContent: string;
    category: string;
    confidence: number;
    reasoning?: string;
  }>;
  tasksProcessed: number;
  tasksClassified: number;
  duration: number;
}

/**
 * Classify tasks into categories.
 * 
 * @param taskIds - Optional specific task IDs to process. If not provided, processes unclassified tasks.
 * @param force - If true, re-classifies already classified tasks.
 * @param batchSize - Maximum tasks to process (default 10).
 */
export async function classifyTasks(options?: {
  taskIds?: string[];
  force?: boolean;
  batchSize?: number;
}): Promise<ClassifyResponse> {
  return fetchApi<ClassifyResponse>('/ai/classify', {
    method: 'POST',
    body: JSON.stringify({
      taskIds: options?.taskIds,
      force: options?.force ?? false,
      batchSize: options?.batchSize ?? 10,
    }),
  });
}

// Alias for backwards compatibility
export const classifyAndEstimateTasks = classifyTasks;

interface EstimateBatchResponse {
  results: Array<{
    taskId: string;
    taskContent: string;
    estimate: string;
    timeEstimateMinutes: number;
    size: string;
    confidence: number;
    reasoning: string;
    error?: string;
  }>;
  tasksProcessed: number;
  tasksEstimated: number;
  duration: number;
}

/**
 * Generate time estimates for multiple tasks in batch.
 * 
 * @param taskIds - Optional specific task IDs to estimate. If not provided, estimates tasks without estimates.
 * @param batchSize - Maximum tasks to process (default 10).
 */
export async function estimateTasksBatch(options?: {
  taskIds?: string[];
  batchSize?: number;
}): Promise<EstimateBatchResponse> {
  return fetchApi<EstimateBatchResponse>('/ai/estimateBatch', {
    method: 'POST',
    body: JSON.stringify({
      taskIds: options?.taskIds,
      batchSize: options?.batchSize ?? 10,
    }),
  });
}

/**
 * Generate time estimate for a single task.
 */
export async function estimateTaskTime(taskId: string): Promise<{
  taskId: string;
  taskContent: string;
  estimate: string;
  timeEstimateMinutes: number;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';
  confidence: number;
  reasoning: string;
}> {
  return fetchApi(`/ai/estimateTime`, {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

/**
 * Enrich URL-heavy tasks with context from their linked pages.
 * Fetches URL content, generates AI summary, and updates task descriptions.
 * 
 * @param limit - Maximum tasks to process (default 10)
 */
export async function enrichUrlTasks(options?: {
  limit?: number;
}): Promise<{
  found: number;
  enriched: number;
  failed: number;
  results: Array<{
    taskId: string;
    enriched: boolean;
    newTitle?: string;
    error?: string;
  }>;
}> {
  return fetchApi('/tasks/enrich-urls', {
    method: 'POST',
    body: JSON.stringify({
      limit: options?.limit ?? 10,
      applyChanges: true,
      includeQuestions: true,
    }),
  });
}

/**
 * Get productivity insights from completed tasks.
 * 
 * @param days - Number of days to analyze (default 7)
 */
export async function getProductivityInsights(options?: {
  days?: number;
}): Promise<{
  insights: Array<{
    type: string;
    title: string;
    description: string;
    data?: Record<string, unknown>;
  }>;
  recommendations: string[];
  period: string;
  stats: {
    tasksCompleted: number;
    averageCompletionTime?: number;
    mostProductiveCategory?: string;
  };
}> {
  return fetchApi('/ai/insights', {
    method: 'POST',
    body: JSON.stringify({
      days: options?.days ?? 7,
    }),
  });
}

// ==================== Settings ====================

/**
 * Set the API key in localStorage
 */
export function setApiKey(key: string): void {
  localStorage.setItem('danny_api_key', key);
}

/**
 * Clear the API key from localStorage
 */
export function clearApiKey(): void {
  localStorage.removeItem('danny_api_key');
}

/**
 * Set the environment configuration.
 * Called by useSettings when environment changes.
 * 
 * @param environment - 'local' or 'production'
 * @param productionUrl - Production API URL (optional, only used when environment is 'production')
 */
export function setEnvironment(environment: ApiEnvironment, productionUrl?: string): void {
  currentEnvironment = environment;
  if (productionUrl) {
    currentProductionUrl = productionUrl;
  }
}

/**
 * Test if the API key is valid by fetching views.
 * Uses the current environment configuration.
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
 * Get the current API base URL (for debugging/display)
 */
export function getCurrentApiBaseUrl(): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return '(using proxy)';
  }
  return baseUrl;
}

/**
 * Get the current environment
 */
export function getCurrentEnvironment(): ApiEnvironment {
  return currentEnvironment;
}
