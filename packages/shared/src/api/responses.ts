/**
 * API Response Types
 * 
 * Types for API responses consumed by the web frontend.
 */

import type { Task, View } from '../domain';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * List tasks response
 */
export interface ListTasksResponse {
  tasks: Task[];
  view: View;
  totalCount: number;
}

/**
 * List views response
 */
export interface ListViewsResponse {
  views: View[];
}

/**
 * Chat action
 */
export interface ChatAction {
  type: string;
  description: string;
  taskId?: string;
}

/**
 * Chat response
 */
export interface ChatResponse {
  response: string;
  success: boolean;
  turns?: number;
  actions?: ChatAction[];
}

/**
 * Sync mode configuration
 */
export interface SyncMode {
  mode: 'standalone' | 'todoist';
  todoistApiKeySet: boolean;
}

/**
 * Orphaned tasks report
 */
export interface OrphanedTasksReport {
  localOnly: Task[];
  todoistOnly: Task[];
  requiresUserDecision: boolean;
}

/**
 * Merge decision for conflict resolution
 */
export interface MergeDecision {
  task: Task;
  action: 'import_to_local' | 'push_to_todoist' | 'ignore';
}
